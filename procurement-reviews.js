'use strict';
const crypto=require('node:crypto');
const {compareBids}=require('./procurement-sourcing');
const fail=(code,message,statusCode=422)=>{throw Object.assign(new Error(message),{code,statusCode});};
const clone=value=>JSON.parse(JSON.stringify(value));
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
function validatePolicy(domain,ctx,actor,entity,value,previous){
  if(entity==='awards')fail('award_action_required','Gebruik de expliciete toekennings- en beoordelingsacties');
  if(entity!=='approval_policies')return;
  domain.scope(ctx,actor,'manage');
  if(!/^[A-Z]{3}$/.test(value.currency||'')||!Number.isSafeInteger(value.minimum_value_cents)||value.minimum_value_cents<0)fail('approval_policy_amount_invalid','Valuta en een ondergrens in gehele centen zijn verplicht');
  if(!Array.isArray(value.approval_steps)||!value.approval_steps.length||value.approval_steps.length>5||value.approval_steps.some(id=>typeof id!=='string'||!/^[A-Za-z0-9_.:-]{1,200}$/.test(id))||new Set(value.approval_steps).size!==value.approval_steps.length)fail('approval_policy_steps_invalid','Kies één tot vijf verschillende bevoegde gebruikers in volgorde');
  if(value.allow_self_approval!==undefined&&typeof value.allow_self_approval!=='boolean')fail('approval_policy_self_invalid','Zelfgoedkeuring moet expliciet waar of onwaar zijn');
  if(!['DRAFT','OPEN','ARCHIVED'].includes(value.status||'DRAFT'))fail('approval_policy_status_invalid','Gebruik Concept, Open of Gearchiveerd');
  if(value.status==='OPEN'&&domain.bucket(ctx,entity).some(row=>row.id!==previous?.id&&row.status==='OPEN'&&row.currency===value.currency&&row.minimum_value_cents===value.minimum_value_cents))fail('approval_policy_ambiguous','Er is al een actief beleid voor deze valuta en ondergrens',409);
}
function previewAward(domain,ctx,actor,rfqId,bidId){
  domain.resolver.assertCapability(ctx,actor,'procurement:approvals');
  const comparison=compareBids(domain,ctx,actor,rfqId),bid=comparison.items.find(row=>row.id===bidId&&row.comparable),rfq=domain.get(ctx,actor,'rfqs',rfqId);
  if(!bid)fail('award_bid_not_comparable','Kies een volledige bieding voor de actuele aanvraag',409);
  if(['CANCELLED','ARCHIVED'].includes(rfq.status))fail('rfq_closed','De aanvraag is gesloten',409);
  const policy=domain.bucket(ctx,'approval_policies').filter(row=>row.status==='OPEN'&&row.currency===bid.currency&&row.minimum_value_cents<=bid.total_cents).sort((a,b)=>b.minimum_value_cents-a.minimum_value_cents)[0];
  if(!policy)fail('approval_policy_required','Configureer eerst een actief goedkeuringsbeleid voor dit bedrag en deze valuta',409);
  const proposal={rfq_id:rfq.id,rfq_revision:rfq.revision,bid_id:bid.id,bid_revision:bid.revision,policy_id:policy.id,policy_revision:policy.revision,supplier_id:bid.supplier_id,value_cents:bid.total_cents,currency:bid.currency,bid_lines:bid.lines,evidence_reference:bid.evidence_reference,approval_steps:policy.approval_steps,allow_self_approval:policy.allow_self_approval===true};
  return {...proposal,title:`Toekenning: ${rfq.title}`,preview_fingerprint:hash(proposal),external_commitment:false,provider_verified:false};
}
function action(domain,ctx,actor,operation,input,options,callback){
  const key=options?.idempotency_key;if(typeof key!=='string'||!key.length||key.length>200)fail('award_idempotency_required','Een unieke actie-ID is verplicht');
  const fingerprint=hash({operation,input}),keys=domain.adapter.bucket(ctx,'procurement:idempotency'),prior=keys.find(row=>row.key===key&&row.actor_id===actor.id);
  if(prior){if(prior.fingerprint!==fingerprint)fail('idempotency_conflict','Actie-ID heeft andere inhoud',409);return {record:domain.get(ctx,actor,'awards',prior.record_id),deduplicated:true,external_commitment:false};}
  const result=domain.mutate(ctx,()=>{const record=callback();keys.push({key,actor_id:actor.id,fingerprint,record_id:record.id});return {record:clone(record),deduplicated:false,external_commitment:false};});
  try{domain.flush(ctx,actor);}catch{result.event_delivery='QUEUED_RETRY';}return result;
}
function prepareAward(domain,ctx,actor,rfqId,input,options={}){
  domain.resolver.assertCapability(ctx,actor,'procurement:approvals','write');
  return action(domain,ctx,actor,`prepare:${rfqId}`,input,options,()=>{
    const preview=previewAward(domain,ctx,actor,rfqId,input.bid_id);
    if(input.confirm!==true||input.preview_fingerprint!==preview.preview_fingerprint)fail('award_preview_changed','Bevestig de actuele bieding en het actuele goedkeuringsbeleid',409);
    if(!String(input.reason||'').trim()||String(input.reason).length>1000)fail('award_reason_required','Leg de reden voor deze keuze vast');
    if(domain.bucket(ctx,'awards').some(row=>row.rfq_id===rfqId&&row.rfq_revision===preview.rfq_revision&&!['CANCELLED','REJECTED_INTERNAL'].includes(row.status)))fail('award_already_active','Deze aanvraagrevisie heeft al een actieve toekenning',409);
    if(domain.bucket(ctx,'awards').length>=25000)fail('domain_capacity','Recordlimiet bereikt',507);
    if(!preview.allow_self_approval&&preview.approval_steps.includes(actor.id))fail('award_self_approval_forbidden','Het beleid vereist beoordelaars die verschillen van de aanvrager',403);
    const now=new Date().toISOString(),row={...preview,id:crypto.randomUUID(),tenant_id:ctx.tenant_id,dealer_id:ctx.dealer_id,owner_id:actor.id,owned_entity:'awards',source_module:'procurement',schema_version:1,revision:1,status:'APPROVAL_REQUIRED',reason:String(input.reason).trim(),reviews:[],created_at:now,updated_at:now,provenance:{source_id:'authorized_user_decision',actor_id:actor.id,classification:'INTERNAL_PROPOSAL',provider_verified:false}};
    domain.bucket(ctx,'awards').push(row);domain.recordEvent(ctx,actor,'awards',row,'created');return row;
  });
}
function reviewAward(domain,ctx,actor,id,input,options={}){
  domain.resolver.assertCapability(ctx,actor,'procurement:approvals','approve');
  return action(domain,ctx,actor,`review:${id}`,input,options,()=>{
    domain.get(ctx,actor,'awards',id);const row=domain.bucket(ctx,'awards').find(row=>row.id===id);
    if(row.status!=='APPROVAL_REQUIRED')fail('award_not_pending','Deze toekenning wacht niet op goedkeuring',409);
    if(input.confirm!==true||input.expected_revision!==row.revision)fail('award_revision_conflict','Bevestig de actuele revisie',409);
    const step=row.reviews.filter(review=>review.decision==='APPROVE').length;
    if(row.approval_steps[step]!==actor.id)fail('award_approver_mismatch','Alleen de aangewezen volgende beoordelaar kan beslissen',403);
    if(!row.allow_self_approval&&row.owner_id===actor.id)fail('award_self_approval_forbidden','Dit beleid vereist een andere beoordelaar',403);
    if(!['APPROVE','REJECT'].includes(input.decision)||!String(input.reason||'').trim()||String(input.reason).length>1000)fail('award_review_invalid','Goedkeuren of afwijzen vereist een reden');
    // Recheck the source revisions and current mandatory policy even for later steps.
    domain.resolver.assertCapability(ctx,actor,'procurement:sourcing');
    // Assigned reviewers inspect the persisted proposal; verify its already-bound
    // source references internally without impersonating the proposal owner.
    const rfq=domain.bucket(ctx,'rfqs').find(item=>item.id===row.rfq_id),bid=domain.bucket(ctx,'bids').find(item=>item.id===row.bid_id),policy=domain.bucket(ctx,'approval_policies').filter(item=>item.status==='OPEN'&&item.currency===row.currency&&item.minimum_value_cents<=row.value_cents).sort((a,b)=>b.minimum_value_cents-a.minimum_value_cents)[0];
    if(!rfq||!bid||!policy||['CANCELLED','ARCHIVED'].includes(rfq.status)||['CANCELLED','ARCHIVED'].includes(bid.status)||rfq.revision!==row.rfq_revision||bid.revision!==row.bid_revision||policy.id!==row.policy_id||policy.revision!==row.policy_revision)fail('award_evidence_changed','Aanvraag, bieding of verplicht beleid is gewijzigd; bereid een nieuwe toekenning voor',409);
    row.reviews.push({step,actor_id:actor.id,decision:input.decision,reason:String(input.reason).trim(),record_revision:row.revision,at:new Date().toISOString()});
    row.status=input.decision==='REJECT'?'REJECTED_INTERNAL':row.reviews.length===row.approval_steps.length?'APPROVED_INTERNAL':'APPROVAL_REQUIRED';row.revision++;row.updated_at=new Date().toISOString();
    domain.recordEvent(ctx,actor,'awards',row,row.status==='APPROVED_INTERNAL'?'approved':'updated');return row;
  });
}
function cancelAward(domain,ctx,actor,id,input,options={}){
  domain.resolver.assertCapability(ctx,actor,'procurement:approvals','write');
  return action(domain,ctx,actor,`cancel:${id}`,input,options,()=>{
    domain.get(ctx,actor,'awards',id);const row=domain.bucket(ctx,'awards').find(row=>row.id===id);
    if(row.owner_id!==actor.id)fail('award_cancel_forbidden','Alleen de aanvrager kan dit voorstel intrekken',403);
    if(row.status!=='APPROVAL_REQUIRED'||input.confirm!==true||input.expected_revision!==row.revision)fail('award_cancel_conflict','Alleen een actuele wachtende toekenning kan worden ingetrokken',409);
    row.status='CANCELLED';row.revision++;row.updated_at=new Date().toISOString();domain.recordEvent(ctx,actor,'awards',row,'updated');return row;
  });
}
module.exports={validatePolicy,previewAward,prepareAward,reviewAward,cancelAward};
