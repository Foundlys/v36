'use strict';
const crypto=require('node:crypto'),reviews=require('./communication-send-reviews'),mime=require('./communication-mime'),{assertCorePermission}=require('./core-access-contracts');
const recovery=require('./communication-submission-recovery');
const SCOPE='communication:submissions',hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'),clone=value=>JSON.parse(JSON.stringify(value));
const fail=(code,message,statusCode=409)=>{throw Object.assign(new Error(message),{code,statusCode});};
const uncertain=row=>['CONNECTING','DATA_IN_FLIGHT','UNKNOWN'].includes(row.status);
function blocks(core,ctx,draftId,basis){return core.adapter.bucket(ctx,SCOPE).some(row=>row.draft_id===draftId&&(uncertain(row)||row.status==='ACCEPTED_BY_PROVIDER'&&row.basis_fingerprint===basis));}
function metadata(row){const {mime_data,transport_instance_id,transport_runtime,...publicRow}=row;return {...clone(publicRow),delivery_verified:false,retry_available:false,reconciliation_required:uncertain(row),provider_acceptance:row.status==='ACCEPTED_BY_PROVIDER'?true:uncertain(row)?null:false};}
class MailSubmissions{
 constructor(core,{configuration,account,allowedHosts=()=>[],submit=require('./communication-smtp').createTransport().submit}){Object.assign(this,{core,configuration,account,allowedHosts,submit});}
 read(ctx,actor,id){this.core.scope(ctx,actor);this.core.resolver.assertCapability(ctx,actor,'communication:drafts');return this.core.get(ctx,actor,'drafts',id);}
 authorize(ctx,actor,id){const draft=this.read(ctx,actor,id);this.core.scope(ctx,actor,'write');for(const cap of ['communication:drafts','communication:inbox'])this.core.resolver.assertCapability(ctx,actor,cap,'write');assertCorePermission(actor,'connectors:manage');return draft;}
 sources(ctx,actor,id,review){
  this.authorize(ctx,actor,id);if(review.status!=='APPROVED_INTERNAL'||review.draft_id!==id)fail('mail_review_unavailable','Een actuele interne goedkeuring ontbreekt');
  if(!this.core.adapter.memberActive?.(ctx,review.requester_id)||!this.core.adapter.memberActive?.(ctx,review.reviewer_id)||review.requester_id===review.reviewer_id)fail('mail_review_authority_changed','De huidige aanvrager of beoordelaar is niet beschikbaar',403);
  const people=[[actor,'write'],[this.core.adapter.memberPrincipal(ctx,review.requester_id),'write'],[this.core.adapter.memberPrincipal(ctx,review.reviewer_id),'approve']];let plan;
  for(const [person,operation] of people){this.core.scope(ctx,person,operation);this.core.resolver.assertCapability(ctx,person,'communication:drafts',operation);const value=reviews.basis(this.core,ctx,person,id,review.purpose,this.account);if(hash(value)!==review.basis_fingerprint)fail('mail_sources_changed','Het concept, account of de voorkeuren zijn gewijzigd');plan=value;}
  return plan;
 }
 reviewState(ctx,actor,id,review){let canSubmit=false;try{this.sources(ctx,actor,id,review);canSubmit=!blocks(this.core,ctx,id,review.basis_fingerprint);}catch(error){if(![401,403,404,409,422].includes(error.statusCode))throw error;}
  return {can_submit:canSubmit,ready_for_submission:canSubmit,submissions:this.core.adapter.bucket(ctx,SCOPE).filter(row=>row.draft_id===id&&row.review_id===review.id).map(row=>this.view(ctx,actor,row))};
 }
 view(ctx,actor,row){const proof=recovery.project(this.core,ctx,row);let canReconcile=false;if(proof.available)try{this.authorize(ctx,actor,row.draft_id);canReconcile=true;}catch(error){if(![401,403,404].includes(error.statusCode))throw error;}return {...metadata(row),recovery:proof,can_reconcile:canReconcile};}
 list(ctx,actor,id){this.read(ctx,actor,id);return {items:this.core.adapter.bucket(ctx,SCOPE).filter(row=>row.draft_id===id).map(row=>this.view(ctx,actor,row)),coverage:'RETAINED_SUBMISSION_ATTEMPTS',delivery_verified:false};}
 async execute(ctx,actor,id,reviewId,input,{idempotency_key}={}){
  this.authorize(ctx,actor,id);
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!['expected_review_revision','confirm','reason'].includes(key))||input.confirm!==true||typeof input.reason!=='string'||!input.reason.trim()||input.reason.length>1000||!Number.isSafeInteger(input.expected_review_revision)||input.expected_review_revision<1||typeof idempotency_key!=='string'||!idempotency_key||idempotency_key.length>200)fail('mail_submission_confirmation_required','Bevestig de exacte verzending met een reden en actiesleutel',422);
  const rows=this.core.adapter.bucket(ctx,SCOPE),key=hash(idempotency_key),fingerprint=hash({id,reviewId,input}),prior=rows.find(row=>row.actor_id===actor.id&&row.action_key===key);
  if(prior){if(prior.action_fingerprint!==fingerprint)fail('mail_submission_action_conflict','Deze actiesleutel heeft andere inhoud');return {submission:metadata(prior),deduplicated:true};}
  const getReview=()=>this.core.adapter.bucket(ctx,reviews.SCOPE).find(row=>row.id===reviewId&&row.draft_id===id),review=getReview();if(!review)fail('mail_review_unavailable','Beoordeling niet gevonden',404);
  if(review.revision!==input.expected_review_revision)fail('mail_review_changed','De beoordeling is intussen gewijzigd');const plan=this.sources(ctx,actor,id,review),config=this.configuration(ctx);require('./communication-smtp').configuration(config);const configHash=hash(config);
  if(blocks(this.core,ctx,id,review.basis_fingerprint))fail('mail_submission_exists','Deze verzending is al aangeboden of vereist eerst onderzoek');
  if(rows.length>=1000||rows.filter(row=>row.draft_id===id).length>=100||this.core.bucket(ctx,'messages').length>=25000)fail('mail_submission_capacity','De limiet voor bewaarde verzendingen is bereikt',507);
  const receiptActor={id:actor.id,roles:[],permissions:[]},attemptId=crypto.randomUUID(),created_at=new Date().toISOString(),files=plan.snapshot.attachments.map(ref=>require('./communication-attachments').read(this.core,ctx,actor,id,ref.id).attachment),message=mime.compose(plan,{attempt_id:attemptId,created_at,files});
  if(rows.some(row=>typeof row.mime_data!=='string')||rows.reduce((sum,row)=>sum+row.mime_data.length,0)+message.size_bytes>16*1024*1024)fail('mail_submission_capacity','De bewaarde verzendinhoud is niet beschikbaar of heeft zijn limiet bereikt',507);
  this.core.mutate(ctx,()=>{rows.push({id:attemptId,draft_id:id,review_id:reviewId,basis_fingerprint:review.basis_fingerprint,requester_id:review.requester_id,reviewer_id:review.reviewer_id,actor_id:actor.id,owner_id:review.requester_id,action_key:key,action_fingerprint:fingerprint,reason:input.reason.trim(),status:'CONNECTING',revision:1,created_at,updated_at:created_at,message_id:message.message_id,payload_sha256:message.sha256,payload_size_bytes:message.size_bytes,mime_data:message.data,transport_instance_id:recovery.INSTANCE,transport_runtime:require('./communication-process-observation').stamp(),schema_version:2});this.core.adapter.audit(ctx,actor,'MAIL_SUBMISSION_STARTED',SCOPE,attemptId,{review_id:reviewId,payload_sha256:message.sha256});});
  recovery.begin(ctx,attemptId);try{
  const current=()=>rows.find(row=>row.id===attemptId),authorize=()=>{const now=getReview();if(!now||now.revision!==input.expected_review_revision||hash(this.configuration(ctx))!==configHash)fail('mail_submission_sources_changed','De beoordeelde bron of accountconfiguratie is gewijzigd');this.sources(ctx,actor,id,now);if(!['CONNECTING','DATA_IN_FLIGHT'].includes(current()?.status))fail('mail_submission_state_changed','De verzendpoging is intussen gewijzigd');};
  let result;
  try{result=await this.submit(config,message,{allowedHosts:this.allowedHosts(),authorize,beforeData:()=>{authorize();this.core.mutate(ctx,()=>{Object.assign(current(),{status:'DATA_IN_FLIGHT',revision:2,updated_at:new Date().toISOString()});});}});}catch(error){result={state:current()?.status==='DATA_IN_FLIGHT'?'UNKNOWN':'NOT_SUBMITTED',provider_acceptance:current()?.status==='DATA_IN_FLIGHT'?null:false,external_send:current()?.status==='DATA_IN_FLIGHT',error_code:'mail_transport_failed'};}
  const accepted=current()?.status==='DATA_IN_FLIGHT'&&result?.state==='ACCEPTED_BY_PROVIDER'&&result.provider_acceptance===true&&result.external_send===true&&result.tls_verified===true&&result.authentication_verified===true&&result.smtp_code===250&&/^[a-f0-9]{64}$/.test(result.receipt_sha256||'');
  const notSubmitted=result?.state==='NOT_SUBMITTED'&&result.provider_acceptance===false&&result.external_send===false,rejected=current()?.status==='DATA_IN_FLIGHT'&&result?.state==='REJECTED_BY_PROVIDER'&&result.provider_acceptance===false&&result.external_send===true&&Number.isInteger(result.smtp_code)&&result.smtp_code>=400&&result.smtp_code<=599;
  const status=accepted?'ACCEPTED_BY_PROVIDER':notSubmitted?'NOT_SUBMITTED':rejected?'REJECTED_BY_PROVIDER':'UNKNOWN';
  const at=new Date().toISOString(),record=accepted?{id:attemptId,title:plan.snapshot.title,content:plan.snapshot.content,to:plan.snapshot.to,cc:plan.snapshot.cc||[],from:plan.from,attachments:plan.snapshot.attachments,owner_id:review.requester_id,owned_entity:'messages',direction:'OUTBOUND',status:'ACCEPTED_BY_PROVIDER',delivery_state:'ACCEPTED_BY_PROVIDER',delivery_verified:false,provider:'email',internet_message_id:message.message_id,...(plan.snapshot.reply_context?{source_message_ref:{id:plan.snapshot.reply_context.source_id,revision:plan.snapshot.reply_context.source_revision,hash:plan.snapshot.reply_context.source_hash,mode:plan.snapshot.reply_context.mode},in_reply_to:plan.snapshot.reply_context.headers.in_reply_to,references:plan.snapshot.reply_context.headers.references,thread_headers_available:plan.snapshot.reply_context.headers.available}:{}),provider_message_id:null,submission_id:attemptId,source_draft_id:id,review_id:reviewId,payload_sha256:message.sha256,sent_at:at,created_at:at,updated_at:at,revision:1,schema_version:1,provenance:{source:'SMTP_SUBMISSION',acceptance_verified:true,delivery_verified:false,receipt_sha256:result.receipt_sha256}}:null;
  const observed={status,smtp_code:Number.isInteger(result?.smtp_code)?result.smtp_code:null,receipt_sha256:accepted?result.receipt_sha256:null,error_code:/^(smtp_|mail_|send_|composition_|core_|identity_)/.test(result?.error_code||'')?result.error_code:null,record,observed_at:at};
  // Commit the observed outcome separately before materializing Messages. A
  // later atomic-write failure cannot erase a successfully retained receipt.
  if(status!=='UNKNOWN')try{recovery.retain(this.core,ctx,current(),observed);}catch{}
  // Record the observed external outcome even if rights changed after DATA.
  // Those rights still gate the response, all reads, and every future action.
  // Receipt attribution carries no roles or permissions and is never used to
  // authorize transport, publication, or a new business action.
  try{this.core.mutate(ctx,()=>{
   const row=current();Object.assign(row,{status,revision:row.revision+1,updated_at:at,smtp_code:Number.isInteger(result?.smtp_code)?result.smtp_code:null,receipt_sha256:accepted?result.receipt_sha256:null,error_code:/^(smtp_|mail_|send_|composition_|core_|identity_)/.test(result?.error_code||'')?result.error_code:null});
   if(accepted){this.core.bucket(ctx,'messages').push(record);this.core.recordEvent(ctx,receiptActor,'messages',record,'created');}
   this.core.adapter.audit(ctx,receiptActor,'MAIL_SUBMISSION_OUTCOME',SCOPE,attemptId,{status,delivery_verified:false,observation_only:true,authority_reused:false});
  });}catch{fail('mail_submission_outcome_unavailable','De uitkomst kon niet worden opgeslagen. Niet opnieuw verzenden; onderzoek de bewaarde poging.',503);}
  try{this.core.flush(ctx,actor);}catch{}
  this.authorize(ctx,actor,id);return {submission:metadata(current()),deduplicated:false};
  }finally{recovery.end(ctx,attemptId);}
 }
 reconcile(ctx,actor,id,submissionId,input,{idempotency_key}={}){
  this.authorize(ctx,actor,id);
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!['expected_revision','confirm','reason'].includes(key))||input.confirm!==true||typeof input.reason!=='string'||!input.reason.trim()||input.reason.length>1000||!Number.isSafeInteger(input.expected_revision)||input.expected_revision<1||typeof idempotency_key!=='string'||!idempotency_key||idempotency_key.length>200)fail('mail_reconciliation_confirmation_required','Bevestig het herstellen uit bewaard bewijs met een reden en actuele versie',422);
  const rows=this.core.adapter.bucket(ctx,SCOPE),row=rows.find(value=>value.id===submissionId&&value.draft_id===id);if(!row)fail('mail_submission_unavailable','De poging is niet beschikbaar',404);
  const operations=this.core.adapter.bucket(ctx,'communication:draft_operations'),actionKey=hash(['MAIL_RECONCILIATION',idempotency_key]),fingerprint=hash({id,submissionId,input}),prior=operations.find(value=>value.key===actionKey&&value.actor_id===actor.id);
  if(prior){if(prior.fingerprint!==fingerprint)fail('mail_reconciliation_action_conflict','Deze actiesleutel heeft andere inhoud');return {submission:this.view(ctx,actor,row),deduplicated:true,external_send:false};}
  if(row.revision!==input.expected_revision)fail('mail_submission_revision_conflict','De poging is intussen gewijzigd');const proof=recovery.inspect(this.core,ctx,row);if(!proof.available)fail('mail_reconciliation_evidence_unavailable','Er is geen herstelbaar duurzaam bewijs voor deze poging');
  if(operations.length>=25000)fail('mail_reconciliation_capacity','De limiet voor bewaarde herstelacties is bereikt',507);
  const receipt=proof.receipt,at=new Date().toISOString(),status=receipt?.status||'NOT_SUBMITTED',messages=this.core.bucket(ctx,'messages');
  if(status==='ACCEPTED_BY_PROVIDER'&&(messages.length>=25000||messages.some(message=>message.id===row.id||message.submission_id===row.id)))fail('mail_reconciliation_record_conflict','De bestaande berichtregistratie kan niet veilig worden vervangen');
  const observer={id:actor.id,roles:[],permissions:[]};
  this.core.mutate(ctx,()=>{
   Object.assign(row,{status,revision:row.revision+1,updated_at:at,smtp_code:receipt?.smtp_code??null,receipt_sha256:receipt?.receipt_sha256??null,error_code:receipt?.error_code??null,reconciled_at:at,reconciled_by:actor.id,reconciliation_kind:proof.kind,reconciliation_reason:input.reason.trim()});
   if(receipt?.record){const record=clone(receipt.record);messages.push(record);this.core.recordEvent(ctx,observer,'messages',record,'created');}
   operations.push({key:actionKey,actor_id:actor.id,fingerprint,submission_id:row.id});
   this.core.adapter.audit(ctx,observer,'MAIL_SUBMISSION_RECONCILED',SCOPE,row.id,{status,evidence_kind:proof.kind,observation_only:true,external_send:false,delivery_verified:false});
  });
  try{this.core.flush(ctx,actor);}catch{}return {submission:this.view(ctx,actor,row),deduplicated:false,external_send:false};
 }

}
function summary(core,ctx,actor){
 const unavailable=reason=>({available:false,total_retained:null,status_counts:null,provider_acceptance_unknown:null,delivered_total:null,external_mailbox_total:null,coverage:'CURRENT_SOURCE_AUTHORIZED_ATTEMPTS_ONLY',reason});
 try{
  core.scope(ctx,actor);core.resolver.assertCapability(ctx,actor,'communication:drafts');const readable=require('./communication-drafts').revisionAccess(core,ctx,actor),allowed=new Set(core.bucket(ctx,'drafts').filter(row=>!row.deleted_at&&core.visible(row,actor)&&readable(row)).map(row=>row.id)),rows=core.adapter.bucket(ctx,SCOPE);
  if(rows.length>1000||rows.some(row=>!row||typeof row.draft_id!=='string'))return unavailable('SUBMISSION_SOURCE_INCOMPLETE');
  const visible=rows.filter(row=>allowed.has(row.draft_id)),counts={CONNECTING:0,DATA_IN_FLIGHT:0,UNKNOWN:0,NOT_SUBMITTED:0,REJECTED_BY_PROVIDER:0,ACCEPTED_BY_PROVIDER:0};
  if(new Set(visible.map(row=>row.id)).size!==visible.length||visible.some(row=>typeof row.id!=='string'||!Object.hasOwn(counts,row.status)||!Number.isSafeInteger(row.revision)||row.revision<1||typeof row.mime_data!=='string'||!Number.isSafeInteger(row.payload_size_bytes)||Buffer.byteLength(row.mime_data)!==row.payload_size_bytes||crypto.createHash('sha256').update(row.mime_data).digest('hex')!==row.payload_sha256))return unavailable('SUBMISSION_SOURCE_INCOMPLETE');
  for(const row of visible)counts[row.status]++;return {available:true,total_retained:visible.length,status_counts:counts,provider_acceptance_unknown:counts.CONNECTING+counts.DATA_IN_FLIGHT+counts.UNKNOWN,delivered_total:null,external_mailbox_total:null,coverage:'CURRENT_SOURCE_AUTHORIZED_ATTEMPTS_ONLY',reason:null};
 }catch(error){if(['capability_disabled','composition_module_disabled'].includes(error.code)||[401,403,404].includes(error.statusCode))return unavailable('SUBMISSION_SOURCE_UNAVAILABLE');throw error;}
}
function exportOwned(core,ctx,drafts){const allowed=new Set(drafts.map(row=>row.id));return core.adapter.bucket(ctx,SCOPE).filter(row=>allowed.has(row.draft_id)).map(row=>({...metadata(row),retained_mime:row.mime_data}));}
module.exports={MailSubmissions,SCOPE,blocks,exportOwned,summary};
