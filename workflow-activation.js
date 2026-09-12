'use strict';
const crypto=require('node:crypto');
const {queueOwnedEvent,flushOwnedEvents}=require('./module-event-outbox');
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const clone=value=>JSON.parse(JSON.stringify(value));
const fail=(code,message,statusCode=409)=>{throw Object.assign(new Error(message),{code,statusCode});};
const groupId=workflow=>hash([workflow.created_by,workflow.name]);
function activation(core,ctx,workflow){
  const row=core.bucket(ctx,'automation_activations').find(row=>row?.id===groupId(workflow));
  return {activation_revision:row?.revision||0,activation_mode:row?(row.active_workflow_id?'SELECTED_VERSION':'PAUSED'):'LEGACY_VERSION_FLAGS',active_workflow_id:row?.active_workflow_id||null,effective_enabled:Boolean(workflow.enabled&&(!row||row.active_workflow_id===workflow.id))};
}
function setActivation(core,ctx,actor,workflowId,input){
  if(!input||typeof input!=='object'||Array.isArray(input))fail('automation_activation_invalid','Een activeringsverzoek is verplicht',422);
  const workflow=core.bucket(ctx,'automations').find(row=>row?.id===workflowId);
  if(!workflow)fail('automation_missing','Workflow niet gevonden',404);
  if(workflow.created_by!==actor.id&&!actor.permissions.has('*'))fail('automation_activation_forbidden','Alleen de workfloweigenaar of platformbeheerder kan de actieve versie wijzigen',403);
  if(!workflow.created_by)fail('automation_owner_missing','Een historische workflow zonder eigenaar kan niet automatisch worden toegewezen');
  if(input.confirm!==true||typeof input.active!=='boolean'||!Number.isSafeInteger(input.expected_revision)||input.expected_revision<0||typeof input.reason!=='string'||!input.reason.trim()||input.reason.length>500)fail('automation_activation_invalid','Bevestig de huidige activeringsrevisie met een reden',422);
  if(input.active&&!workflow.enabled)fail('automation_definition_disabled','Deze definitie staat uit; maak eerst een nieuwe versie');
  const id=groupId(workflow),rows=core.bucket(ctx,'automation_activations'),previous=rows.find(row=>row?.id===id),signature=hash({workflow_id:workflowId,actor_id:actor.id,input});
  if(previous?.request_signature===signature)return {...clone(previous),deduplicated:true};
  if((previous?.revision||0)!==input.expected_revision)fail('automation_activation_conflict','De actieve versie is gewijzigd; vernieuw en beoordeel opnieuw');
  if(!previous&&rows.length>=25000)fail('automation_activation_capacity','De limiet voor activeringsbeleid is bereikt',507);
  const result=core.moduleMutation(ctx,['automation_activations'],()=>{
    const row={id,schema_version:1,tenant_id:ctx.tenant_id,dealer_id:ctx.dealer_id,owner_id:workflow.created_by,workflow_name:workflow.name,active_workflow_id:input.active?workflow.id:null,status:input.active?'ACTIVE':'PAUSED',revision:(previous?.revision||0)+1,reason:input.reason.trim(),updated_by:actor.id,updated_at:core.now(),request_signature:signature};
    if(previous)rows[rows.indexOf(previous)]=row;else rows.push(row);
    core.audit(ctx,actor,'ACTIVATION','automation',workflowId,{activation_id:id,revision:row.revision,active_workflow_id:row.active_workflow_id,reason:row.reason});
    queueOwnedEvent(core,ctx,actor,'automation','activation',row,'updated');return clone(row);
  });
  try{flushOwnedEvents(core,ctx,actor);}catch{result.event_delivery='QUEUED_RETRY';}
  return result;
}
module.exports={activation,setActivation};
