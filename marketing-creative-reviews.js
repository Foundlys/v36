'use strict';
const crypto=require('node:crypto');
const clone=value=>JSON.parse(JSON.stringify(value));
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fail=(code,message,statusCode=422)=>{throw Object.assign(new Error(message),{code,statusCode});};
function sourceFingerprint(row){return hash({id:row.id,revision:row.revision,owner_id:row.owner_id,title:row.title,content:row.content,status:row.status,delivery_state:row.delivery_state});}
function reviewReadable(domain,ctx,actor,row){if(domain.id!=='marketing'||row.owned_entity!=='creative_reviews')return true;const source=domain.bucket(ctx,'creatives').find(item=>item.id===row.creative_id);return Boolean(source&&domain.visible(source,actor));}
function command(domain,ctx,actor,operation,input,options,mutate){
  const key=options?.idempotency_key;if(typeof key!=='string'||!key||key.length>200)fail('creative_review_key_required','Een unieke actie-ID is verplicht');
  const fingerprint=hash({operation,input}),keys=domain.adapter.bucket(ctx,'marketing:idempotency'),prior=keys.find(row=>row.actor_id===actor.id&&row.key===key);
  if(prior){if(prior.fingerprint!==fingerprint)fail('idempotency_conflict','Actie-ID heeft andere inhoud',409);return {record:domain.get(ctx,actor,'creative_reviews',prior.record_id),deduplicated:true,publication_executed:false};}
  const result=domain.mutate(ctx,()=>{const row=mutate();keys.push({key,actor_id:actor.id,fingerprint,record_id:row.id});return {record:clone(row),deduplicated:false,publication_executed:false};});
  try{domain.flush(ctx,actor);}catch{result.event_delivery='QUEUED_RETRY';}return result;
}
function prepareCreativeReview(domain,ctx,actor,id,input,options={}){
  domain.scope(ctx,actor,'write');domain.resolver.assertCapability(ctx,actor,'marketing:campaigns','write');
  if(!input||Object.keys(input).some(key=>!['expected_revision','approval_steps','reason','confirm'].includes(key))||input.confirm!==true||typeof input.reason!=='string'||!input.reason.trim()||input.reason.length>1000)fail('creative_review_request_invalid','Bevestig de aanvraag met een onderbouwing');
  const steps=input.approval_steps;if(!Array.isArray(steps)||!steps.length||steps.length>5||steps.some(id=>typeof id!=='string'||!/^[A-Za-z0-9_.:-]{1,200}$/.test(id))||new Set(steps).size!==steps.length)fail('creative_review_steps_invalid','Kies één tot vijf verschillende beoordelaars in volgorde');
  if(steps.includes(actor.id))fail('creative_review_self_forbidden','De aanvrager kan niet zelf beoordelen',403);
  return command(domain,ctx,actor,'prepare:'+id,input,options,()=>{
    const source=domain.get(ctx,actor,'creatives',id);if(source.revision!==input.expected_revision||source.status==='APPROVED_INTERNAL'||source.status==='ARCHIVED'||source.deleted_at)fail('creative_review_source_changed','Kies een actuele niet-goedgekeurde creatie',409);
    const rows=domain.bucket(ctx,'creative_reviews');if(rows.some(row=>row.creative_id===id&&row.status==='APPROVAL_REQUIRED'))fail('creative_review_pending','Er staat al een beoordeling open; trek deze eerst in',409);if(rows.length>=5000)fail('creative_review_capacity','Het maximum aantal bewaarde beoordelingen is bereikt',507);
    const now=new Date().toISOString(),row={id:crypto.randomUUID(),tenant_id:ctx.tenant_id,dealer_id:ctx.dealer_id,owner_id:actor.id,owned_entity:'creative_reviews',source_module:'marketing',schema_version:1,revision:1,title:source.title,status:'APPROVAL_REQUIRED',creative_id:source.id,creative_revision:source.revision,source_fingerprint:sourceFingerprint(source),creative_snapshot:source,approval_steps:[...steps],reviews:[],reason:input.reason.trim(),created_at:now,updated_at:now,publication_executed:false,provenance:{source_id:'owned_marketing_creative',actor_id:actor.id,provider_verified:false}};
    rows.push(row);domain.recordEvent(ctx,actor,'creative_reviews',row,'created');return row;
  });
}
function reviewCreative(domain,ctx,actor,id,input,options={}){
  domain.scope(ctx,actor,'approve');domain.resolver.assertCapability(ctx,actor,'marketing:campaigns','approve');
  if(!input||Object.keys(input).some(key=>!['expected_revision','decision','reason','confirm'].includes(key))||input.confirm!==true||!['APPROVE','REJECT'].includes(input.decision)||typeof input.reason!=='string'||!input.reason.trim()||input.reason.length>1000)fail('creative_review_decision_invalid','Bevestig goedkeuring of afwijzing met een reden');
  return command(domain,ctx,actor,'review:'+id,input,options,()=>{
    domain.get(ctx,actor,'creative_reviews',id);const row=domain.bucket(ctx,'creative_reviews').find(row=>row.id===id);
    if(row.owner_id===actor.id||row.approval_steps[row.reviews.length]!==actor.id)fail('creative_review_reviewer_forbidden','Alleen de aangewezen volgende beoordelaar mag beslissen',403);
    if(row.status!=='APPROVAL_REQUIRED'||row.revision!==input.expected_revision)fail('creative_review_conflict','De beoordeling is intussen gewijzigd',409);
    const source=domain.get(ctx,actor,'creatives',row.creative_id);if(sourceFingerprint(source)!==row.source_fingerprint)fail('creative_review_source_changed','De creatie is gewijzigd; vraag een nieuwe beoordeling aan',409);
    const now=new Date().toISOString();row.reviews.push({actor_id:actor.id,step:row.reviews.length,decision:input.decision,reason:input.reason.trim(),record_revision:row.revision,at:now});row.status=input.decision==='REJECT'?'REJECTED_INTERNAL':row.reviews.length===row.approval_steps.length?'APPROVED_INTERNAL':'APPROVAL_REQUIRED';row.revision++;row.updated_at=now;
    if(row.status==='APPROVED_INTERNAL'){const current=domain.bucket(ctx,'creatives').find(item=>item.id===row.creative_id);current.status='APPROVED_INTERNAL';current.revision++;current.updated_at=now;current.approved_by=actor.id;current.approval_reference_id=row.id;row.approved_creative_revision=current.revision;domain.recordEvent(ctx,actor,'creatives',current,'approved');}
    domain.recordEvent(ctx,actor,'creative_reviews',row,row.status==='APPROVED_INTERNAL'?'approved':'updated');return row;
  });
}
function withdrawCreativeReview(domain,ctx,actor,id,input,options={}){
  domain.scope(ctx,actor,'write');domain.resolver.assertCapability(ctx,actor,'marketing:campaigns','write');
  if(!input||Object.keys(input).some(key=>!['expected_revision','reason','confirm'].includes(key))||input.confirm!==true||typeof input.reason!=='string'||!input.reason.trim()||input.reason.length>1000)fail('creative_review_withdraw_invalid','Bevestig intrekken met een reden');
  return command(domain,ctx,actor,'withdraw:'+id,input,options,()=>{
    domain.get(ctx,actor,'creative_reviews',id);const row=domain.bucket(ctx,'creative_reviews').find(row=>row.id===id);
    if(row.owner_id!==actor.id)fail('creative_review_owner_required','Alleen de aanvrager kan intrekken',403);
    if(row.status!=='APPROVAL_REQUIRED'||row.revision!==input.expected_revision)fail('creative_review_conflict','De beoordeling is intussen gewijzigd',409);
    row.status='WITHDRAWN';row.withdrawal_reason=input.reason.trim();row.revision++;row.updated_at=new Date().toISOString();domain.recordEvent(ctx,actor,'creative_reviews',row,'updated');return row;
  });
}
module.exports={prepareCreativeReview,reviewCreative,withdrawCreativeReview,reviewReadable};
