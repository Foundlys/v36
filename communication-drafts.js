'use strict';
const crypto=require('node:crypto');
const clone=value=>JSON.parse(JSON.stringify(value)),hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fail=(code,message,statusCode=422)=>{throw Object.assign(new Error(message),{code,statusCode});};
const FIELDS=['title','content','description','to','thread_id','related_refs'];
function validateInput(input){
 for(const [field,max] of [['title',1000],['content',12000],['description',12000],['thread_id',200]])if(Object.hasOwn(input,field)&&(typeof input[field]!=='string'||input[field].length>max))fail('draft_content_invalid','De conceptinhoud is ongeldig of te lang');
 if(Object.hasOwn(input,'to')&&(!Array.isArray(input.to)||input.to.length>100||input.to.some(value=>typeof value!=='string'||value.length>320||!/^\S+@\S+\.\S+$/.test(value))))fail('recipients_invalid','Ongeldige e-mailontvangers');
 if(Object.hasOwn(input,'related_refs')&&(!Array.isArray(input.related_refs)||input.related_refs.length>100))fail('draft_content_invalid','Ongeldige conceptverwijzingen');
}
function content(row){return Object.fromEntries(FIELDS.filter(field=>row[field]!==undefined).map(field=>[field,clone(row[field])]));}
function readable(core,ctx,actor,row){if(core.id!=='communication'||row.owned_entity!=='draft_revisions')return true;const draft=core.bucket(ctx,'drafts').find(draft=>draft.id===row.draft_id);return Boolean(draft&&(!draft.owned_entity||draft.owned_entity==='drafts')&&core.visible(draft,actor));}
function metadata(row){const {snapshot,...publicRow}=row;return clone(publicRow);}
function append(core,ctx,actor,row,prior=null,annotation={}){
 const history=core.bucket(ctx,'draft_revisions');
 const capture=(source,baseline)=>{
  const snapshot=content(source),contentHash=hash(snapshot),existing=history.find(item=>item.draft_id===source.id&&item.draft_revision===source.revision);
  if(existing){if(existing.content_hash!==contentHash)fail('draft_history_conflict','De bewaarde revisie wijkt af van deze bron',409);return;}
  if(history.length>=25000||history.filter(item=>item.draft_id===source.id).length>=500)fail('draft_history_capacity','De limiet voor bewaarde revisies is bereikt; geschiedenis wordt niet verwijderd',507);
  const now=new Date().toISOString(),entry={id:crypto.randomUUID(),tenant_id:ctx.tenant_id,dealer_id:ctx.dealer_id,owner_id:source.owner_id,title:source.title,draft_id:source.id,draft_revision:Number.isSafeInteger(source.revision)?source.revision:null,snapshot,content_hash:contentHash,source_updated_at:source.updated_at,captured_at:now,captured_by:actor.id,capture_kind:baseline?(Number.isSafeInteger(source.revision)?'RETAINED_BASELINE':'UNVERSIONED_RETAINED_BASELINE'):'CURRENT_REVISION',status:'RECORDED',revision:1,created_at:now,updated_at:now,source_module:'communication',owned_entity:'draft_revisions',schema_version:1,...(!baseline?annotation:{})};history.push(entry);core.recordEvent(ctx,actor,'draft_revisions',entry,'created');
 };
 if(prior)capture(prior,true);capture(row,false);
}
function authorize(core,ctx,actor,id,operation='read'){core.scope(ctx,actor,operation);core.resolver.assertCapability(ctx,actor,'communication:drafts',operation);return core.get(ctx,actor,'drafts',id);}
function history(core,ctx,actor,id,query={}){
 const draft=authorize(core,ctx,actor,id);if(Object.keys(query).some(key=>!['limit','offset'].includes(key)))fail('draft_history_query_invalid','Niet-ondersteunde historiefilter');
 const integer=(value,fallback)=>value===undefined?fallback:/^\d+$/.test(String(value))?Number(value):NaN,limit=integer(query.limit,20),offset=integer(query.offset,0);
 if(!Number.isSafeInteger(limit)||limit<1||limit>100||!Number.isSafeInteger(offset)||offset<0||offset>25000)fail('draft_history_query_invalid','Kies een geldige pagina');
 const rows=core.bucket(ctx,'draft_revisions').filter(row=>row.draft_id===id).sort((a,b)=>b.draft_revision-a.draft_revision);let canWrite=false;try{core.scope(ctx,actor,'write');core.resolver.assertCapability(ctx,actor,'communication:drafts','write');canWrite=true;}catch(error){if(error.statusCode!==403)throw error;}return {items:rows.slice(offset,offset+limit).map(metadata),total:rows.length,limit,offset,next_offset:offset+limit<rows.length?offset+limit:null,current_revision:draft.revision??null,collaborator_ids:draft.collaborator_ids||[],collaborators:(draft.collaborator_ids||[]).map(id=>({id,display_name:core.adapter.draftMember?.(ctx,id)?.display_name||'Niet beschikbare medebewerker'})),can_write:canWrite,can_share:canWrite&&(draft.owner_id===actor.id||core.visible({owner_id:null},actor))};
}
function operation(core,ctx,actor,id,input,options,kind,execute){
 const draft=authorize(core,ctx,actor,id,'write');
 if(kind==='SHARE'&&draft.owner_id!==actor.id&&!core.visible({owner_id:null},actor))fail('draft_share_forbidden','Alleen de eigenaar of beheerder kan het concept delen',403);
 const fields=kind==='SHARE'?['collaborator_ids','expected_revision','confirm','reason']:['source_revision','expected_revision','confirm','reason'];
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!fields.includes(key)))fail('draft_action_invalid','Ongeldige conceptactie');
 if(input.confirm!==true||typeof input.reason!=='string'||!input.reason.trim()||input.reason.length>1000)fail('draft_confirmation_required','Bevestiging en een reden zijn verplicht');
 if(typeof options.idempotency_key!=='string'||!options.idempotency_key||options.idempotency_key.length>200)fail('draft_idempotency_required','Een geldige Idempotency-Key is verplicht');
 const key=hash([kind,options.idempotency_key]),fingerprint=hash({id,input}),receipts=core.adapter.bucket(ctx,'communication:draft_operations'),seen=receipts.find(row=>row.key===key&&row.actor_id===actor.id);
 if(seen){if(seen.fingerprint!==fingerprint)fail('draft_action_conflict','Deze actiesleutel heeft andere inhoud',409);return {record:draft,receipt:clone(seen.receipt),deduplicated:true,external_send:false};}
 if(input.expected_revision!==(draft.revision??null)||draft.revision!=null&&(!Number.isSafeInteger(draft.revision)||draft.revision<1||draft.revision>=Number.MAX_SAFE_INTEGER))fail('record_revision_conflict','Het concept is intussen gewijzigd',409);
 const result=core.mutate(ctx,()=>{
  const record=execute(draft);const receipt={kind,draft_id:id,source_revision:kind==='RESTORE'?input.source_revision:null,result_revision:record.revision,reason:input.reason.trim(),actor_id:actor.id,at:new Date().toISOString()};
  receipts.push({key,actor_id:actor.id,fingerprint,receipt});core.adapter.audit(ctx,actor,kind,'communication:drafts',id,{expected_revision:input.expected_revision,result_revision:record.revision,reason:receipt.reason});return {record:clone(record),receipt,deduplicated:false,external_send:false};
 });try{core.flush(ctx,actor);}catch{result.event_delivery='QUEUED_RETRY';}return result;
}
function share(core,ctx,actor,id,input,options={}){
 return operation(core,ctx,actor,id,input,options,'SHARE',prior=>{
  const ids=input.collaborator_ids;if(!Array.isArray(ids)||ids.length>20||ids.some(id=>typeof id!=='string'||!id||id.length>200)||new Set(ids).size!==ids.length)fail('draft_collaborators_invalid','Kies maximaal twintig unieke gebruikers');
  if(ids.some(member=>!core.adapter.memberActive?.(ctx,member)))fail('draft_collaborator_unavailable','Een gekozen gebruiker is niet actief in deze tenant',404);
  const row=core.bucket(ctx,'drafts').find(row=>row.id===id);row.collaborator_ids=[...ids];row.revision=(row.revision||0)+1;row.owned_entity='drafts';row.delivery_state='NOT_SENT';row.updated_at=new Date().toISOString();
  append(core,ctx,actor,row,prior,{access_change:{before:prior.collaborator_ids||[],after:[...ids]},change_reason:input.reason.trim()});core.recordEvent(ctx,actor,'drafts',row,'updated');return row;
 });
}
function restore(core,ctx,actor,id,input,options={}){
 return operation(core,ctx,actor,id,input,options,'RESTORE',prior=>{
  if(!Number.isSafeInteger(input.source_revision)||input.source_revision<1)fail('draft_revision_invalid','Kies een geldige bronrevisie');
  const matches=core.bucket(ctx,'draft_revisions').filter(row=>row.draft_id===id&&row.draft_revision===input.source_revision),version=matches[0];if(matches.length!==1||!version.snapshot||hash(version.snapshot)!==version.content_hash)fail('draft_revision_unavailable','De bronrevisie is niet verifieerbaar',409);
  const patch={title:version.snapshot.title,content:version.snapshot.content,description:version.snapshot.description||'',to:version.snapshot.to||[],thread_id:version.snapshot.thread_id||'',related_refs:version.snapshot.related_refs||[],status:'DRAFT'};
  const record=core.saveOwned(ctx,actor,'drafts',patch,{id,expected_revision:prior.revision}).record,entry=core.bucket(ctx,'draft_revisions').find(row=>row.draft_id===id&&row.draft_revision===record.revision);entry.restored_from=input.source_revision;entry.change_reason=input.reason.trim();return record;
 });
}
function collaborators(core,ctx,actor,id,query={}){
 const draft=authorize(core,ctx,actor,id,'write');
 if(draft.owner_id!==actor.id&&!core.visible({owner_id:null},actor))fail('draft_share_forbidden','Alleen de eigenaar of beheerder kan medebewerkers kiezen',403);
 if(Object.keys(query).some(key=>key!=='q')||typeof query.q!=='string'||query.q.trim().length<2||query.q.length>100)fail('draft_collaborator_query_invalid','Zoek met minimaal twee en maximaal honderd tekens');
 if(typeof core.adapter.draftCollaborators!=='function')fail('draft_collaborators_unavailable','Gebruikers zoeken is niet beschikbaar',503);
 const members=core.adapter.draftCollaborators(ctx,query.q.trim());
 return {items:members.slice(0,20).map(member=>({id:member.id,display_name:member.display_name})),has_more:members.length>20};
}
module.exports={append,readable,metadata,history,share,restore,collaborators,validateInput};
