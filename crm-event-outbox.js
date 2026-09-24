'use strict';
const {scopedMutation}=require('./scoped-mutation');
const SCOPE='crm:event_outbox',MAX_PENDING=25000,MAX_DELIVERED=1000,BATCH=50,AUTO_ATTEMPTS=5;
const clone=value=>JSON.parse(JSON.stringify(value));
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const cents=value=>finite(value)&&Number.isSafeInteger(Math.round(value*100))?Math.round(value*100):null;
function canonical(ctx,event,record){
 const entity=String(event.meta?.entity||''),recordId=event.meta?.record_id||null,type=event.type;
 let name='crm_record_changed';
 if(type==='crm.record.created')name=({leads:'lead_created',deals:'deal_created',appointments:'appointment_scheduled',quotes:'quote_created',tasks:'task_created',contacts:'contact_created',companies:'company_created'})[entity]||'crm_record_created';
 else if(type==='crm.record.deleted')name='crm_record_archived';
 else if(entity==='leads'&&/qualified|gekwalificeerd|hot/i.test(String(record?.status||'')))name='lead_qualified';
 else if(entity==='deals'&&/won|gewonnen/i.test(String(record?.status||'')))name='deal_won';
 else if(entity==='deals'&&/lost|verloren/i.test(String(record?.status||'')))name='deal_lost';
 else if(entity==='deals')name='deal_changed';
 else if(entity==='tasks'&&/done|completed|afgerond/i.test(String(record?.status||'')))name='task_completed';
 const closed=/^(?:won|lost|gewonnen|verloren)$/i.test(String(record?.status||'')),probability=record?.probability;
 return {event_id:event.event_id,event_name:name,occurred_at:event.occurred_at,actor_id:record?.updated_by||record?.created_by||event.meta?.actor_id||null,tenant_id:ctx.tenant_id,dealer_id:ctx.dealer_id,source_module:'crm',permissions:record?.owner_id?{user_ids:[record.owner_id],team_ids:record.team_id?[record.team_id]:[],roles:['MANAGER','MARKETING'],permission_keys:['crm:read_all']}:{roles:['MANAGER','MARKETING','VIEWER','SALES'],permission_keys:['crm:read_all','crm:read_assigned']},source:'foundly_crm',source_kind:'internal_service',entity_type:entity||'crm_record',entity_id:recordId,lead_id:entity==='leads'?recordId:record?.lead_id||null,customer_id:record?.contact_id||record?.person_id||null,campaign_id:record?.campaign_id||null,properties:{crm_event_type:type,changed_fields:event.meta?.fields||[],revision:record?.revision??null,status:record?.status??null,stage_id:record?.stage_id??null,owner_id:record?.owner_id??null,currency:typeof record?.currency==='string'&&/^[A-Z]{3}$/.test(record.currency)?record.currency:null,value_cents:cents(record?.value),open_value_cents:record?(closed?0:cents(record.value)):null,weighted_value_cents:finite(record?.value)&&finite(probability)&&probability>=0&&probability<=100?cents(record.value*probability/100):null,gross_margin_cents:cents(record?.margin)},consent_context:{purpose:'business_operations',legal_basis:'legitimate_interest'},privacy_classification:['leads','contacts','people'].includes(entity)?'PERSONAL':'INTERNAL',provenance:{source_kind:'internal_service',evidence:recordId?[recordId]:[]}};
}
function queue(core,ctx,event){
 const rows=core.adapter.bucket(ctx,SCOPE);if(rows.filter(row=>row.status!=='DELIVERED').length>=MAX_PENDING)throw Object.assign(Error('CRM event capacity reached'),{statusCode:507,code:'crm_event_capacity'});
 const entity=event.meta?.entity,recordId=event.meta?.record_id,record=entity&&recordId?core.collection(ctx,entity).find(row=>row.id===recordId):null;
 const envelope={...event,event_id:'crm:'+core.adapter.id(),occurred_at:core.adapter.now().toISOString()};envelope.canonical=canonical(ctx,envelope,record);
 rows.push({event:clone(envelope),status:'PENDING',attempts:0,next_attempt_at:null,last_error:null});
 const delivered=rows.filter(row=>row.status==='DELIVERED');for(const old of delivered.slice(0,Math.max(0,delivered.length-MAX_DELIVERED))){const index=rows.indexOf(old);if(index>=0)rows.splice(index,1);}
}
function flush(core,ctx,{force=false}={}){
 const adapter=core.adapter;if(typeof adapter.publish!=='function')return {available:false,attempted:0,delivered:0,pending:null};
 const now=adapter.now().getTime(),eligible=adapter.bucket(ctx,SCOPE).filter(row=>row.status==='PENDING'&&(force||row.attempts<AUTO_ATTEMPTS&&(!row.next_attempt_at||Date.parse(row.next_attempt_at)<=now))).slice(0,BATCH).map(row=>row.event.event_id);let delivered=0;
 for(const eventId of eligible){
  const row=adapter.bucket(ctx,SCOPE).find(row=>row.event.event_id===eventId);let success=false,errorCode=null;
  try{const receipt=adapter.publish(ctx,clone(row.event));success=Boolean(receipt&&(receipt.event_id===eventId||receipt.event?.event_id===eventId));if(!success)errorCode='crm_event_ack_unconfirmed';}
  catch(error){errorCode=typeof error.code==='string'&&/^[a-z][a-z0-9_]{0,79}$/.test(error.code)?error.code:'crm_event_delivery_failed';}
  try{scopedMutation(adapter,ctx,[SCOPE],()=>{const current=adapter.bucket(ctx,SCOPE).find(row=>row.event.event_id===eventId);current.attempts=Math.min(100000,(current.attempts||0)+1);current.status=success?'DELIVERED':'PENDING';current.last_error=errorCode;current.next_attempt_at=success?null:new Date(now+Math.min(300000,1000*2**Math.min(current.attempts-1,9))).toISOString();if(success)current.delivered_at=adapter.now().toISOString();});if(success)delivered++;}catch{/* The durable receipt is still pending; reuse its original event identity. */}
 }
 const pending=adapter.bucket(ctx,SCOPE).filter(row=>row.status==='PENDING');return {available:true,attempted:eligible.length,delivered,pending:pending.length,automatic_retries_exhausted:pending.filter(row=>row.attempts>=AUTO_ATTEMPTS).length};
}
module.exports={SCOPE,queue,flush,canonical};
