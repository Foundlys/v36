'use strict';
const crypto=require('node:crypto');
const {queueOwnedEvent,flushOwnedEvents}=require('./module-event-outbox');
const {signature}=require('./workflow-execution');
const clone=value=>JSON.parse(JSON.stringify(value));
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fail=(code,message,statusCode=409)=>{throw Object.assign(new Error(message),{code,statusCode});};
function context(core,ctx,actor,runId){
  const run=core.bucket(ctx,'automation_runs').find(row=>row?.run_id===runId);
  // Recovery must not borrow an administrator's broader target-domain rights.
  if(!run||run.actor_id!==actor.id)fail('automation_recovery_forbidden','Herstel vereist de oorspronkelijke uitvoerende gebruiker',403);
  const workflow=core.bucket(ctx,'automations').find(row=>row?.id===run.automation_id);
  if(!workflow)fail('automation_missing','Workflowdefinitie ontbreekt',404);
  if(signature({workflow:workflow.signature,trigger:run.trigger,inputs:run.inputs})!==run.request_signature)fail('automation_recovery_changed','Workflow of runinvoer komt niet overeen met de oorspronkelijke uitvoering');
  return {run,workflow};
}
function previewRecovery(core,ctx,actor,runId){
  const {run,workflow}=context(core,ctx,actor,runId);
  const step=run.steps.find(step=>['RUNNING','FAILED','DEAD_LETTER','BLOCKED'].includes(step.status));
  if(!step)fail('automation_recovery_not_required','Deze run heeft geen te verifiëren onzekere stap');
  const type=step.type,action=workflow.actions[step.index];
  if(!action||signature(action)!==signature(step.input))fail('automation_recovery_changed','De stapdefinitie is gewijzigd sinds de uitvoering');
  if(!action||String(action.type).toLowerCase()!==type||core.adapter.automationActionContract?.(type)?.idempotent!==true||typeof core.adapter.verifyAutomationAction!=='function')fail('automation_recovery_adapter_unavailable','Er is geen geverifieerd herstelcontract voor deze actie');
  const proof=core.adapter.verifyAutomationAction(ctx,actor,{...clone(action),type},{event:clone(run.trigger),inputs:clone(run.inputs),idempotency_key:step.idempotency_key,run_id:runId,step_index:step.index});
  if(!proof||proof.verified!==true||typeof proof.record_id!=='string'||!Number.isSafeInteger(proof.record_revision)||typeof proof.record_fingerprint!=='string'||proof.idempotency_key!==step.idempotency_key||proof.external_write!==false)fail('automation_recovery_unproven','Geen exact overeenkomende interne record bewezen; de run blijft ongewijzigd');
  const evidence={record_id:proof.record_id,record_revision:proof.record_revision,record_fingerprint:proof.record_fingerprint,entity:proof.entity,idempotency_key:proof.idempotency_key,external_write:false};
  const fingerprint=hash({request:run.request_signature,workflow:workflow.signature,step:clone(step),recovery_revision:run.recovery_revision||0,evidence});
  return {run_id:runId,step_index:step.index,step_type:type,previous_status:step.status,evidence,preview_fingerprint:fingerprint,action:'RECONCILE_VERIFIED_INTERNAL_RESULT',executes_next_step:false};
}
function recover(core,ctx,actor,runId,input){
  if(!input||Object.keys(input).some(key=>!['confirm','reason','preview_fingerprint'].includes(key))||input.confirm!==true||typeof input.reason!=='string'||!input.reason.trim()||input.reason.length>500||typeof input.preview_fingerprint!=='string')fail('automation_recovery_invalid','Bevestig het exacte bewijs met een reden',422);
  const {run}=context(core,ctx,actor,runId),requestSignature=hash({actor_id:actor.id,input});
  if(run.recoveries?.some(row=>row.request_signature===requestSignature))return {...clone(run),deduplicated:true};
  const preview=previewRecovery(core,ctx,actor,runId);
  if(input.preview_fingerprint!==preview.preview_fingerprint)fail('automation_recovery_changed','De run of bewijsrecord is gewijzigd; controleer opnieuw');
  const result=core.moduleMutation(ctx,['automation_runs'],()=>{
    const step=run.steps.find(step=>step.index===preview.step_index);
    run.recoveries=run.recoveries||[];run.recoveries.push({step_index:step.index,previous_status:step.status,previous_error:step.error||null,evidence:preview.evidence,actor_id:actor.id,reason:input.reason.trim(),at:core.now(),request_signature:requestSignature});
    step.status='SUCCEEDED';step.completed_at=core.now();delete step.error;step.verified_by_recovery=true;step.output_index=run.outputs.length;
    run.outputs.push({executed:true,...preview.evidence,verification:'EXACT_DURABLE_INTERNAL_RECORD'});
    run.recovery_revision=(run.recovery_revision||0)+1;run.status='RECOVERY_READY';run.completed_at=null;run.next_wakeup_at=null;
    core.audit(ctx,actor,'RECONCILE','automation',run.automation_id,{run_id:runId,step_index:step.index,record_id:preview.evidence.record_id,reason:input.reason.trim()});
    queueOwnedEvent(core,ctx,actor,'automation','run',run,'updated');return clone(run);
  });
  try{flushOwnedEvents(core,ctx,actor);}catch{result.event_delivery='QUEUED_RETRY';}
  return result;
}
module.exports={previewRecovery,recover};
