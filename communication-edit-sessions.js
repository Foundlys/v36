'use strict';
const crypto=require('node:crypto'),{scopedMutation}=require('./scoped-mutation');
const SCOPE='communication:draft_edit_sessions',TTL_MS=60000,hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'),clone=value=>JSON.parse(JSON.stringify(value));
const fail=(code,message,statusCode=422)=>{throw Object.assign(Error(message),{code,statusCode});};
function authorize(core,ctx,actor,id,operation='read'){
 core.scope(ctx,actor,operation);core.resolver.assertCapability(ctx,actor,'communication:drafts',operation);const draft=core.get(ctx,actor,'drafts',id);
 if(draft.deleted_at)fail('record_not_found','Concept niet gevonden',404);
 if(operation==='write'&&!core.adapter.memberActive?.(ctx,actor.id))fail('draft_editor_member_required','Een actieve tenantgebruiker is vereist',403);return draft;
}
function retained(core,ctx,id){
 const rows=core.adapter.bucket(ctx,SCOPE).filter(row=>row.draft_id===id),row=rows[0];
 if(rows.length>1||row&&(!Number.isSafeInteger(row.revision)||row.revision<1||!['ACTIVE','RELEASED'].includes(row.status)||!Number.isSafeInteger(row.expires_at)||typeof row.holder_id!=='string'||typeof row.token!=='string'||row.token.length!==64||hash(row.working_copy)!==row.working_copy_sha256))fail('draft_editor_unavailable','De bewaarde bewerkingssessie is niet verifieerbaar',409);return row;
}
function active(core,ctx,row){
 if(!row||row.status!=='ACTIVE'||row.expires_at<=Date.now())return false;
 if(!core.adapter.memberActive?.(ctx,row.holder_id))return false;
 const holder=core.adapter.memberPrincipal?.(ctx,row.holder_id);if(!holder)fail('draft_editor_unavailable','Actuele bewerkingsrechten zijn niet beschikbaar',503);
 try{authorize(core,ctx,holder,row.draft_id,'write');return true;}catch(error){if([401,403,404].includes(error.statusCode))return false;throw error;}
}
function view(core,ctx,actor,draft,row){
 const isActive=active(core,ctx,row);let canWrite=false;try{authorize(core,ctx,actor,draft.id,'write');canWrite=true;}catch(error){if(![401,403].includes(error.statusCode))throw error;}
 return {draft_id:draft.id,revision:row?.revision||0,grant_id:isActive?row.grant_id:null,current_draft_revision:draft.revision,active:isActive,holder_id:isActive?row.holder_id:null,holder_name:isActive?(core.adapter.draftMember?.(ctx,row.holder_id)?.display_name||'Gebruiker niet beschikbaar'):null,expires_at:isActive?row.expires_at:null,can_write:canWrite,working_copy:row?.working_copy?clone(row.working_copy):null,working_copy_base_revision:row?.base_revision??null,working_copy_current:row?.base_revision===draft.revision,working_copy_saved:Boolean(row?.working_copy&&row.base_revision===draft.revision&&Object.entries(row.working_copy).every(([key,value])=>JSON.stringify(value)===JSON.stringify(draft[key]??(key==='to'?[]:'')))),external_send:false};
}
function get(core,ctx,actor,id){const draft=authorize(core,ctx,actor,id);return view(core,ctx,actor,draft,retained(core,ctx,id));}
function assertEdit(core,ctx,actor,id,token){
 const row=retained(core,ctx,id),isActive=active(core,ctx,row);
 if(token&&(!isActive||row.holder_id!==actor.id||token!==row.token)||isActive&&(row.holder_id!==actor.id||token!==row.token))fail('draft_editor_conflict','De bewerkingssessie is verlopen of overgenomen; bekijk de actuele versie',409);
}
function change(core,ctx,actor,id,kind,input,options={}){
 const draft=authorize(core,ctx,actor,id,'write');if(!['claim','takeover','renew','release'].includes(kind))fail('draft_editor_action_invalid','Ongeldige bewerkingsactie');
 const fields=['expected_lease_revision','expected_draft_revision',...(kind==='renew'?['working_copy']:['confirm','reason'])];
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!fields.includes(key)))fail('draft_editor_input_invalid','Ongeldige bewerkingsgegevens');
 if(kind!=='renew'&&(input.confirm!==true||typeof input.reason!=='string'||!input.reason.trim()||input.reason.length>1000))fail('draft_editor_confirmation_required','Bevestig de bewerkingsactie met een reden');
 if(typeof options.idempotency_key!=='string'||!options.idempotency_key||options.idempotency_key.length>200)fail('draft_editor_action_required','Een unieke actie-ID is vereist');
 const rows=core.adapter.bucket(ctx,SCOPE),row=retained(core,ctx,id),receipts=core.adapter.bucket(ctx,'communication:draft_operations'),key=hash(['EDIT_SESSION',kind,options.idempotency_key]),fingerprint=hash({id,input,token:options.edit_token||null}),prior=receipts.find(item=>item.key===key&&item.actor_id===actor.id);
 if(prior){if(prior.fingerprint!==fingerprint)fail('draft_editor_action_conflict','Deze actiesleutel heeft andere inhoud',409);const model=view(core,ctx,actor,draft,row);return {...model,deduplicated:true,...(model.active&&row.holder_id===actor.id&&row.grant_id===prior.grant_id&&kind!=='release'?{edit_token:row.token}:{})};}
 if(!Number.isSafeInteger(input.expected_lease_revision)||input.expected_lease_revision!==(row?.revision||0))fail('draft_editor_changed','De bewerkingssessie is gewijzigd; vernieuw de status',409);
 if(!Number.isSafeInteger(input.expected_draft_revision)||input.expected_draft_revision!==draft.revision)fail('draft_editor_source_changed','Het concept is gewijzigd; bekijk de actuele inhoud',409);
 if(receipts.length>=25000||!row&&rows.length>=25000)fail('draft_editor_capacity','De limiet voor bewaarde bewerkingssessies is bereikt',507);
 const isActive=active(core,ctx,row);
 if(kind==='claim'&&isActive)fail('draft_editor_busy','Dit concept wordt al bewerkt; overnemen vereist een afzonderlijke bevestiging',409);
 if(kind==='takeover'&&!isActive)fail('draft_editor_changed','De eerdere sessie is niet meer actief; start een nieuwe sessie',409);
 if(['renew','release'].includes(kind)&&(!isActive||row.holder_id!==actor.id||options.edit_token!==row.token))fail('draft_editor_conflict','Deze bewerkingssessie is niet meer van jou',409);
 if(Object.hasOwn(input,'working_copy')){
  const copy=input.working_copy;if(!copy||typeof copy!=='object'||Array.isArray(copy)||Object.keys(copy).some(key=>!['title','content','description','to'].includes(key)))fail('draft_editor_input_invalid','Ongeldige conceptinhoud');
  require('./communication-drafts').validateInput(copy);
 }
 return scopedMutation(core.adapter,ctx,[SCOPE,'communication:draft_operations','platform:audit'],()=>{
  const now=Date.now(),grant=['claim','takeover'].includes(kind),next={...(row||{}),draft_id:id,holder_id:actor.id,revision:(row?.revision||0)+1,status:kind==='release'?'RELEASED':'ACTIVE',expires_at:kind==='release'?now:now+TTL_MS,updated_at:new Date(now).toISOString(),token:grant?crypto.randomBytes(32).toString('hex'):row.token,grant_id:grant?crypto.randomUUID():row.grant_id};
  if(Object.hasOwn(input,'working_copy')){next.working_copy=clone(input.working_copy);next.base_revision=draft.revision;}
  else if(!row){next.working_copy=null;next.base_revision=draft.revision;}
  next.working_copy_sha256=hash(next.working_copy);
  if(row)rows[rows.indexOf(row)]=next;else rows.push(next);
  receipts.push({key,actor_id:actor.id,fingerprint,grant_id:next.grant_id});
  // Frequent presence updates do not emit business events or retain source text in audit.
  if(kind!=='renew')core.adapter.audit(ctx,actor,'DRAFT_EDIT_'+kind.toUpperCase(),'communication:drafts',id,{lease_revision:next.revision,draft_revision:draft.revision,reason:input.reason.trim(),previous_holder_id:row?.holder_id||null});
  return {...view(core,ctx,actor,draft,next),deduplicated:false,...(kind!=='release'?{edit_token:next.token}:{})};
 });
}
function exportOwned(core,ctx,drafts){const ids=new Set(drafts.map(row=>row.id));return core.adapter.bucket(ctx,SCOPE).filter(row=>ids.has(row.draft_id)).map(({token,...row})=>({...clone(row),working_copy_saved:false,external_send:false}));}
module.exports={SCOPE,TTL_MS,get,change,assertEdit,exportOwned};
