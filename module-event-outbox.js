'use strict';
const crypto=require('node:crypto');
function queueOwnedEvent(core,ctx,actor,module,entity,record,action){
  const recordId=record.id||record.run_id,revision=record.revision||record.version||record.status;
  const identity=JSON.stringify([module,entity,recordId,action,revision,(record.steps||[]).map(step=>[step.index,step.status])]);
  const eventId=`module:${crypto.createHash('sha256').update(identity).digest('hex')}`,rows=core.bucket(ctx,'module_event_outbox');
  if(rows.some(row=>row.event.event_id===eventId))return;
  rows.push({status:'PENDING',attempts:0,event:{event_id:eventId,event_name:`${module}.${entity}.${action}.v1`,event_version:1,tenant_id:ctx.tenant_id,dealer_id:ctx.dealer_id,actor_id:actor.id,source_module:module,source:`foundly_${module}`,occurred_at:core.now(),entity_type:entity,entity_id:recordId,correlation_id:record.run_id||recordId,causation_id:record.event_id||null,properties:{revision,status:record.status||null},permissions:{user_ids:[record.owner_id||record.actor_id||record.created_by||actor.id]},consent_context:{purpose:'business_operations',legal_basis:'contract'},privacy_classification:'INTERNAL',idempotency_key:eventId}});
}
function flushOwnedEvents(core,ctx,actor){
  const rows=core.bucket(ctx,'module_event_outbox').filter(row=>row.status==='PENDING').slice(0,50);let delivered=0;
  for(const row of rows){
    try{row.attempts++;core.ingestEvent(ctx,{id:actor.id,roles:actor.roles,permissions:['events:write']},row.event,{idempotencyKey:row.event.idempotency_key});row.status='DELIVERED';row.delivered_at=core.now();core.commit();delivered++;}
    catch(error){row.status='PENDING';row.error=String(error.code||'canonical_event_unavailable').slice(0,100);}
  }
  return {attempted:rows.length,delivered,pending:core.bucket(ctx,'module_event_outbox').filter(row=>row.status==='PENDING').length};
}
module.exports={queueOwnedEvent,flushOwnedEvents};
