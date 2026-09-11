'use strict';
const crypto=require('node:crypto');
const SCOPE='communication:send_reviews',clone=value=>JSON.parse(JSON.stringify(value)),hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fail=(code,message,statusCode=422)=>{throw Object.assign(new Error(message),{code,statusCode});};
function address(value){
 if(typeof value!=='string'||value.length>254||!/^[-A-Za-z0-9!#$%&'*+/=?^_`{|}~.]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,63}$/.test(value))return false;
 const local=value.split('@')[0],domain=value.split('@')[1];return local.length<=64&&!local.startsWith('.')&&!local.endsWith('.')&&!value.includes('..')&&domain.split('.').every(part=>part.length<=63&&!part.startsWith('-')&&!part.endsWith('-'));
}
function authorize(core,ctx,actor,id,operation='read'){if(!actor?.id)fail('send_actor_unavailable','De bevoegde gebruiker is niet beschikbaar',403);core.scope(ctx,actor,operation);core.resolver.assertCapability(ctx,actor,'communication:drafts',operation);return core.get(ctx,actor,'drafts',id);}
function basis(core,ctx,actor,id,purpose,getAccount){
 const draft=authorize(core,ctx,actor,id);core.resolver.assertCapability(ctx,actor,'communication:threads');
 if(typeof purpose!=='string'||!purpose.trim()||purpose.length>100)fail('send_purpose_invalid','Leg het doel van deze correspondentie vast');purpose=purpose.trim();
 if(!Number.isSafeInteger(draft.revision)||draft.revision<1||!Array.isArray(draft.to)||!draft.to.length||draft.to.length>100||draft.to.some(value=>!address(value))||new Set(draft.to).size!==draft.to.length)fail('send_recipients_unavailable','Kies unieke ondersteunde e-mailontvangers voor een versie van dit concept');
 require('./communication-drafts').validateInput(draft);require('./communication-mime').validateContent(draft);
 const account=getAccount(ctx);if(!account||account.provider!=='email'||!address(account.from)||typeof account.binding!=='string'||account.binding.length!==64)fail('send_account_unavailable','Een geldige afzender en accountconfiguratie ontbreken',409);
 const recipients=[...draft.to,...(draft.cc||[])];if(recipients.length>100||recipients.some(value=>!address(value))||new Set(recipients).size!==recipients.length)fail('send_recipients_unavailable','Kies unieke ondersteunde ontvangers in Aan en Cc');
 const attachments=require('./communication-attachments').references(core,ctx,id,draft.attachments),preferences=core.bucket(ctx,'preferences'),policy=[];
 require('./communication-attachments').assertSendable(core,ctx,id,attachments);
 for(const recipient of recipients){
  const matches=preferences.filter(row=>!row.deleted_at&&row.status!=='ARCHIVED'&&row.subject_id===recipient&&row.purpose===purpose),row=matches[0];
  if(matches.length!==1||!core.visible(row,actor)||row.status!=='GRANTED'||!Number.isSafeInteger(row.revision)||row.revision<1)fail('send_preference_unavailable','De actuele voorkeuren voor dit doel zijn niet eenduidig beschikbaar',409);
  policy.push({id:row.id,revision:row.revision,hash:hash({subject_id:row.subject_id,purpose:row.purpose,status:row.status,legal_basis:row.legal_basis??null})});
 }
 const template_context=require('./communication-templates').sendContext(core,ctx,actor,draft),reply_context=require('./communication-threads').sendContext(core,ctx,actor,draft,account),snapshot={title:draft.title,content:draft.content,to:[...draft.to],...(draft.cc?.length?{cc:[...draft.cc]}:{}),attachments,...(reply_context?{reply_context}:{}),...(template_context?{template_context}:{})},sourceHash=hash(snapshot);
 return {draft_id:id,draft_revision:draft.revision,source_hash:sourceHash,snapshot,purpose,from:account.from,account_binding:account.binding,preference_refs:policy,policy_provenance:'USER_RECORDED_PREFERENCES_NOT_PROVIDER_VERIFIED'};
}
function preview(core,ctx,actor,id,purpose,getAccount){
 authorize(core,ctx,actor,id,'write');const plan=basis(core,ctx,actor,id,purpose,getAccount),{account_binding,...publicPlan}=plan;
 return {...publicPlan,preview_fingerprint:hash(plan),external_send:false,separate_reviewer_required:true};
}
function metadata(row){const {account_binding,...publicRow}=row;return clone(publicRow);}
function reviewers(core,ctx,actor,id,query,getAccount){
 authorize(core,ctx,actor,id,'write');if(!query||Object.keys(query).some(key=>!['q','purpose'].includes(key))||typeof query.q!=='string'||query.q.trim().length<2||query.q.length>100)fail('send_reviewer_query_invalid','Zoek met minimaal twee en maximaal honderd tekens');
 const plan=basis(core,ctx,actor,id,query.purpose,getAccount),candidates=core.adapter.draftCollaborators?.(ctx,query.q.trim());if(!Array.isArray(candidates))fail('send_reviewers_unavailable','Beoordelaars zoeken is niet beschikbaar',503);
 const items=candidates.filter(member=>{if(member.id===actor.id)return false;try{const principal=core.adapter.memberPrincipal?.(ctx,member.id);authorize(core,ctx,principal,id,'approve');return hash(basis(core,ctx,principal,id,query.purpose,getAccount))===hash(plan);}catch(error){if([401,403,404,409].includes(error.statusCode))return false;throw error;}}).slice(0,20).map(member=>({id:member.id,display_name:member.display_name}));
 return {items,search_window_limited:candidates.length>20};
}
function list(core,ctx,actor,id,getAccount){
 authorize(core,ctx,actor,id);const rows=core.adapter.bucket(ctx,SCOPE).filter(row=>row.draft_id===id);let canPrepare=false;try{authorize(core,ctx,actor,id,'write');canPrepare=true;}catch(error){if(error.statusCode!==403)throw error;}
 const currentPlans=new Map();
 return {items:rows.slice().reverse().map(row=>{let current=false,canReview=false;try{if(!currentPlans.has(row.purpose)){try{currentPlans.set(row.purpose,hash(basis(core,ctx,actor,id,row.purpose,getAccount)));}catch(error){if(![401,403,404,409,422].includes(error.statusCode))throw error;currentPlans.set(row.purpose,null);}}current=currentPlans.get(row.purpose)===row.basis_fingerprint;if(current&&row.status==='APPROVAL_REQUIRED'&&row.reviewer_id===actor.id){authorize(core,ctx,actor,id,'approve');canReview=true;}}catch(error){if(![401,403,404,409,422].includes(error.statusCode))throw error;}return {...metadata(row),source_current:current,can_review:canReview,can_cancel:['APPROVAL_REQUIRED','APPROVED_INTERNAL'].includes(row.status)&&row.requester_id===actor.id&&canPrepare,ready_for_submission:false};}),can_prepare:canPrepare,external_send:false};
}
function operation(core,ctx,actor,input,options,kind,execute){
 if(typeof options.idempotency_key!=='string'||!options.idempotency_key||options.idempotency_key.length>200)fail('send_idempotency_required','Een unieke actie-ID is verplicht');
 const receipts=core.adapter.bucket(ctx,'communication:draft_operations'),key=hash([kind,options.idempotency_key]),fingerprint=hash(input),seen=receipts.find(row=>row.key===key&&row.actor_id===actor.id);
 if(seen){if(seen.fingerprint!==fingerprint)fail('send_action_conflict','Deze actiesleutel heeft andere inhoud',409);const row=core.adapter.bucket(ctx,SCOPE).find(row=>row.id===seen.review_id);if(!row)fail('send_review_unavailable','De bewaarde beoordeling ontbreekt',409);return {review:metadata(row),deduplicated:true,external_send:false};}
 if(receipts.length>=25000)fail('send_review_capacity','De limiet voor bewaarde acties is bereikt',507);
 const result=core.mutate(ctx,()=>{const row=execute();receipts.push({key,actor_id:actor.id,fingerprint,review_id:row.id});return {review:metadata(row),deduplicated:false,external_send:false};});try{core.flush(ctx,actor);}catch{result.event_delivery='QUEUED_RETRY';}return result;
}
function confirmation(input,fields){if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!fields.includes(key))||input.confirm!==true||typeof input.reason!=='string'||!input.reason.trim()||input.reason.length>1000)fail('send_review_confirmation_required','Bevestig de exacte beoordeling met een reden');}
function prepare(core,ctx,actor,id,input,options,getAccount){
 authorize(core,ctx,actor,id,'write');confirmation(input,['purpose','expected_revision','preview_fingerprint','reviewer_id','confirm','reason']);
 const plan=basis(core,ctx,actor,id,input.purpose,getAccount);if(input.expected_revision!==plan.draft_revision||input.preview_fingerprint!==hash(plan))fail('send_basis_changed','Het concept, account of de voorkeuren zijn gewijzigd',409);
 if(typeof input.reviewer_id!=='string'||input.reviewer_id===actor.id||!core.adapter.memberActive?.(ctx,input.reviewer_id))fail('send_reviewer_unavailable','Kies een andere actieve bevoegde beoordelaar',403);
 const reviewer=core.adapter.memberPrincipal?.(ctx,input.reviewer_id);authorize(core,ctx,reviewer,id,'approve');if(hash(basis(core,ctx,reviewer,id,input.purpose,getAccount))!==hash(plan))fail('send_reviewer_unavailable','De beoordelaar kan deze bron niet verifiëren',403);
 return operation(core,ctx,actor,{draft_id:id,...input},options,'SEND_PREPARE',()=>{
  if(require('./communication-submissions').blocks(core,ctx,id,hash(plan)))fail('send_submission_exists','Een bestaande verzendpoging verhindert een nieuwe beoordeling',409);
  const rows=core.adapter.bucket(ctx,SCOPE);if(rows.length>=2500||rows.filter(row=>row.draft_id===id).length>=100)fail('send_review_capacity','De limiet voor bewaarde verzendbeoordelingen is bereikt',507);
  if(rows.some(row=>row.draft_id===id&&['APPROVAL_REQUIRED','APPROVED_INTERNAL'].includes(row.status)&&row.basis_fingerprint===hash(plan)))fail('send_review_exists','Voor deze inhoud bestaat al een open of goedgekeurde beoordeling',409);
  const now=new Date().toISOString(),row={id:crypto.randomUUID(),...plan,basis_fingerprint:hash(plan),owner_id:actor.id,requester_id:actor.id,reviewer_id:input.reviewer_id,reason:input.reason.trim(),status:'APPROVAL_REQUIRED',revision:1,created_at:now,updated_at:now,owned_entity:'send_reviews',schema_version:1};rows.push(row);core.recordEvent(ctx,actor,'send_reviews',row,'created');return row;
 });
}
function decide(core,ctx,actor,id,reviewId,input,options,getAccount,cancel=false){
 authorize(core,ctx,actor,id,cancel?'write':'approve');confirmation(input,cancel?['expected_revision','reason','confirm']:['expected_revision','decision','reason','confirm']);
 const row=core.adapter.bucket(ctx,SCOPE).find(row=>row.id===reviewId&&row.draft_id===id);if(!row)fail('send_review_not_found','Beoordeling niet gevonden',404);
 if(cancel?row.requester_id!==actor.id:row.reviewer_id!==actor.id||row.requester_id===actor.id)fail('send_reviewer_forbidden','Deze beoordeling is niet aan jou toegewezen',403);
 if(!cancel&&!core.adapter.memberActive?.(ctx,actor.id))fail('send_reviewer_unavailable','De beoordelaar is niet meer actief',403);
 if(!cancel&&!['APPROVE','REJECT'].includes(input.decision))fail('send_review_decision_invalid','Kies goedkeuren of afwijzen');
 return operation(core,ctx,actor,{draft_id:id,review_id:reviewId,...input},options,cancel?'SEND_CANCEL':'SEND_REVIEW',()=>{
  if(cancel&&require('./communication-submissions').blocks(core,ctx,id,row.basis_fingerprint))fail('send_submission_exists','Deze verzending is al aangeboden of vereist onderzoek',409);
  if(row.revision!==input.expected_revision||!(cancel?['APPROVAL_REQUIRED','APPROVED_INTERNAL']:['APPROVAL_REQUIRED']).includes(row.status))fail('send_review_changed','De beoordeling is intussen gewijzigd',409);
  if(!cancel&&hash(basis(core,ctx,actor,id,row.purpose,getAccount))!==row.basis_fingerprint)fail('send_basis_changed','Het concept, account of de voorkeuren zijn gewijzigd',409);
  row.status=cancel?'CANCELLED':input.decision==='APPROVE'?'APPROVED_INTERNAL':'REJECTED';row.revision++;row.updated_at=new Date().toISOString();row.decision_reason=input.reason.trim();row.decided_by=actor.id;core.recordEvent(ctx,actor,'send_reviews',row,'updated');return row;
 });
}
function exportOwned(core,ctx,drafts){const allowed=new Set(drafts.map(row=>row.id));return core.adapter.bucket(ctx,SCOPE).filter(row=>allowed.has(row.draft_id)).map(metadata);}
module.exports={SCOPE,address,preview,reviewers,list,prepare,decide,exportOwned,basis};
