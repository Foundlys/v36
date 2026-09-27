'use strict';
const crypto=require('node:crypto'),{signature}=require('./workflow-execution'),{definitionFingerprint}=require('./workflow-publication-recovery');
const NAME='automation_approval_requests',SCOPE='platform:'+NAME,LIMIT=10000;
const clone=value=>JSON.parse(JSON.stringify(value)),hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'),object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const fields=['request_id','request_fingerprint','workflow_id','run_id','request_signature','step_index','run_actor_id'],id=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/.test(value),digest=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const fail=(code,message,statusCode=409)=>{throw Object.assign(Error(message),{code:'automation_approval_request_'+code,statusCode});};
function invalidBinding(){throw Object.assign(Error('Bevestig de exacte run met een reden'),{code:'automation_approval_binding_invalid',statusCode:422});}
function authority(actor){if(!actor.permissions.has('*')&&!actor.permissions.has('automation:approve'))throw Object.assign(Error('Goedkeuringsrecht ontbreekt'),{code:'automation_approval_forbidden',statusCode:403});}
const realm=(ctx,actor)=>({tenant_id:ctx.tenant_id,dealer_id:ctx.dealer_id,actor_id:actor.id});
function validate(meta){if(!object(meta)||Object.keys(meta).some(key=>!fields.includes(key))||!['request_id','workflow_id','run_id','run_actor_id'].every(key=>id(meta[key]))||!['request_fingerprint','request_signature'].every(key=>digest(meta[key]))||!Number.isSafeInteger(meta.step_index)||meta.step_index<0||meta.step_index>99)fail('invalid','Kies de exacte goedkeuringsaanvraag',422);}
function context(core,ctx,actor,runId){
  authority(actor);const rows=core.bucket(ctx,'automation_runs').filter(run=>run.run_id===runId);if(rows.length!==1)fail('unavailable','De oorspronkelijke run is niet beschikbaar');const run=rows[0];
  if(run.actor_id!==actor.id&&!actor.permissions.has('*'))fail('forbidden','Deze run is niet toegankelijk',403);
  const workflows=core.bucket(ctx,'automations').filter(row=>row.id===run.automation_id),workflow=workflows[0];
  if(workflows.length!==1||workflow.immutable_version!==true||definitionFingerprint(workflow)!==workflow.signature||run.tenant_id!==ctx.tenant_id||run.dealer_id!==ctx.dealer_id||workflow.tenant_id!==ctx.tenant_id||workflow.dealer_id!==ctx.dealer_id||run.workflow_version!==workflow.version||signature({workflow:workflow.signature,trigger:run.trigger,inputs:run.inputs})!==run.request_signature)fail('unverifiable','De run en workflowversie kunnen niet worden bevestigd');
  return {run,workflow};
}
function preview(core,ctx,actor,runId){
  const {run,workflow}=context(core,ctx,actor,runId),step=run.steps.find(row=>row.status==='AWAITING_APPROVAL');
  if(run.status!=='AWAITING_APPROVAL'||run.approval||!step||step.idempotency_key!==`workflow:${run.run_id}:${step.index}`||!workflow.actions[step.index]||signature(step.input)!==signature(workflow.actions[step.index]))fail('changed','Deze exacte stap wacht niet meer op goedkeuring');
  const native=core.previewAutomationRun(ctx,actor,workflow.id,{event:run.trigger,inputs:run.inputs});
  const basis={request_context:realm(ctx,actor),workflow_signature:workflow.signature,activation_revision:native.activation_revision,run_id:run.run_id,request_signature:run.request_signature,step:clone(step),recovery_revision:run.recovery_revision||0};
  return {...basis,workflow_id:workflow.id,workflow_version:workflow.version,definition:native.definition,event:clone(run.trigger),inputs:clone(run.inputs),run_actor_id:run.actor_id,preview_fingerprint:hash(basis),execution_performed:false,approval_performed:false};
}
function match(receipt,meta){if(!fields.every(key=>receipt[key]===meta[key]))fail('conflict','Deze goedkeuringsaanvraag hoort bij andere invoer');}
function result(core,ctx,actor,receipt){
  const {run}=context(core,ctx,actor,receipt.run_id);
  if(receipt.state!=='APPLIED'||run.automation_id!==receipt.workflow_id||run.request_signature!==receipt.request_signature||!run.approval||hash(run.approval)!==receipt.approval_digest||run.approval.actor_id!==actor.id||run.approval.reference!==receipt.request_id)fail('unverifiable','De oorspronkelijke goedkeuring kan niet worden bevestigd');
  return clone(run);
}
// Called before the engine can replay or resume. The reference is reserved in
// the same durable transaction as the grant, before any downstream effect.
function prepare(core,ctx,actor,workflow,run,input){
  if(input===undefined)return null;authority(actor);
  if(!object(input)||Object.keys(input).some(key=>!['run_id','request_signature','reference','reason','step_index','preview_fingerprint'].includes(key))||!id(input.reference)||typeof input.reason!=='string'||!input.reason.trim()||input.reason.length>500||!run||input.run_id!==run.run_id||input.request_signature!==run.request_signature)invalidBinding();
  const rows=core.bucket(ctx,NAME),receipt=rows.find(row=>row.actor_id===actor.id&&row.request_id===input.reference),stepIndex=input.step_index??receipt?.step_index??run.steps.find(row=>row.status==='AWAITING_APPROVAL')?.index;
  const meta={request_id:input.reference,request_fingerprint:hash(input),workflow_id:workflow.id,run_id:run.run_id,request_signature:run.request_signature,step_index:stepIndex,run_actor_id:run.actor_id};validate(meta);const envelope={...meta,request_context:realm(ctx,actor)};
  if(receipt){match(receipt,meta);if(receipt.state==='NOT_APPLIED')fail('abandoned','Deze goedkeuringsaanvraag is afgesloten');return {record:result(core,ctx,actor,receipt),envelope};}
  const current=preview(core,ctx,actor,run.run_id);if(current.step.index!==stepIndex||Object.hasOwn(input,'preview_fingerprint')&&input.preview_fingerprint!==current.preview_fingerprint)fail('changed','De gecontroleerde stap of workflow is gewijzigd');
  if(rows.length>=LIMIT)fail('capacity','Het maximumaantal goedkeuringsreferenties is bereikt',507);
  return {envelope,retain:record=>rows.push({...meta,actor_id:actor.id,state:'APPLIED',approval_digest:hash(record.approval),recorded_at:core.now()})};
}
function recover(core,ctx,actor,input){
  authority(actor);if(!object(input)||input.confirm!==true||Object.keys(input).some(key=>!fields.includes(key)&&key!=='confirm'))fail('invalid','Bevestig de exacte herstelreferentie',422);const meta=Object.fromEntries(fields.map(key=>[key,input[key]]));validate(meta);
  const {run}=context(core,ctx,actor,meta.run_id);if(run.actor_id!==meta.run_actor_id||run.automation_id!==meta.workflow_id||run.request_signature!==meta.request_signature||!run.steps.some(step=>step.index===meta.step_index))fail('conflict','De herstelreferentie hoort bij een andere run of stap');
  const rows=core.bucket(ctx,NAME),receipt=rows.find(row=>row.actor_id===actor.id&&row.request_id===meta.request_id),envelope={...meta,request_context:realm(ctx,actor),execution_performed:false,approval_performed:false};
  if(receipt){match(receipt,meta);return {...envelope,state:receipt.state,run:receipt.state==='NOT_APPLIED'?null:result(core,ctx,actor,receipt),workflow:receipt.state==='NOT_APPLIED'?null:clone(context(core,ctx,actor,meta.run_id).workflow)};}
  if(rows.length>=LIMIT)fail('capacity','Het maximumaantal goedkeuringsreferenties is bereikt',507);
  return core.moduleMutation(ctx,[NAME],()=>{rows.push({...meta,actor_id:actor.id,state:'NOT_APPLIED',recorded_at:core.now()});core.audit(ctx,actor,'CLOSE','automation_approval_request',null,{content_logged:false});return {...envelope,state:'NOT_APPLIED',run:null,workflow:null};});
}
module.exports={NAME,SCOPE,prepare,preview,recover};
