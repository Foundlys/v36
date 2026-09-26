'use strict';
const crypto=require('node:crypto'),{signature}=require('./workflow-execution'),{definitionFingerprint}=require('./workflow-publication-recovery');
const NAME='automation_resume_requests',SCOPE='platform:'+NAME,LIMIT=10000,hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'),clone=value=>JSON.parse(JSON.stringify(value));
const fields=['request_id','request_fingerprint','workflow_id','workflow_signature','run_id','request_signature','step_index','preview_fingerprint'],object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value),id=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/.test(value),digest=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const fail=(code,message,statusCode=409)=>{throw Object.assign(Error(message),{code:'automation_resume_request_'+code,statusCode});},realm=(ctx,actor)=>({tenant_id:ctx.tenant_id,dealer_id:ctx.dealer_id,actor_id:actor.id});
const states=new Set(['RUNNING','PLANNED','SUCCEEDED','ERROR','BLOCKED','AWAITING_APPROVAL','WAITING_TIME','WAITING_RETRY','DEAD_LETTER','RECOVERY_READY']),stepStates=new Set([...states,'FAILED','PLANNED_INTERNAL','SKIPPED_CONDITION']);
function validate(meta){if(!object(meta)||Object.keys(meta).some(key=>!fields.includes(key))||!['request_id','workflow_id','run_id'].every(key=>id(meta[key]))||!['request_fingerprint','workflow_signature','request_signature','preview_fingerprint'].every(key=>digest(meta[key]))||!Number.isSafeInteger(meta.step_index)||meta.step_index<0||meta.step_index>100)fail('invalid','Kies de exacte hervataanvraag',422);}
function context(core,ctx,actor,runId){
 const rows=core.bucket(ctx,'automation_runs').filter(row=>row?.run_id===runId),run=rows[0];if(rows.length!==1)fail('unavailable','De oorspronkelijke run is niet beschikbaar');
 if(run.actor_id!==actor.id)fail('forbidden','Hervatten vereist de oorspronkelijke uitvoerende gebruiker',403);
 const workflows=core.bucket(ctx,'automations').filter(row=>row?.id===run.automation_id),workflow=workflows[0];
 if(workflows.length!==1||workflow.immutable_version!==true||definitionFingerprint(workflow)!==workflow.signature||run.tenant_id!==ctx.tenant_id||run.dealer_id!==ctx.dealer_id||workflow.tenant_id!==ctx.tenant_id||workflow.dealer_id!==ctx.dealer_id||run.workflow_version!==workflow.version||signature({workflow:workflow.signature,trigger:run.trigger,inputs:run.inputs})!==run.request_signature||!Array.isArray(run.steps)||run.steps.length>workflow.actions.length||run.steps.some((step,index)=>step.index!==index||step.idempotency_key!==`workflow:${run.run_id}:${index}`||signature(step.input)!==signature(workflow.actions[index])))fail('unverifiable','De run, stappen en workflowversie kunnen niet worden bevestigd');
 if(!states.has(run.status)||!Array.isArray(run.outputs)||!Array.isArray(run.errors)||run.steps.some(step=>!stepStates.has(step.status)||step.status==='SUCCEEDED'&&step.type!=='delay'&&(!Number.isSafeInteger(step.output_index)||step.output_index<0||run.outputs[step.output_index]?.executed!==true))||run.status==='SUCCEEDED'&&(run.steps.length!==workflow.actions.length||run.steps.some(step=>!['SUCCEEDED','SKIPPED_CONDITION'].includes(step.status))))fail('unverifiable','De geregistreerde uitvoerstatus kan niet worden bevestigd');return {run,workflow};
}
function preview(core,ctx,actor,runId){
 const {run,workflow}=context(core,ctx,actor,runId);if(!['WAITING_TIME','WAITING_RETRY','RECOVERY_READY'].includes(run.status))fail('changed','Deze run wacht niet op afzonderlijke hervatting');
 const step=run.steps.find(row=>!['SUCCEEDED','SKIPPED_CONDITION'].includes(row.status)),index=step?.index??run.steps.length;
 if(['WAITING_TIME','WAITING_RETRY'].includes(run.status)&&(!step||step.status!==run.status||!Number.isFinite(Date.parse(run.next_wakeup_at))))fail('unverifiable','De wachtende stap kan niet worden bevestigd');
 if(run.status==='RECOVERY_READY'&&step&&step.status!=='PLANNED_INTERNAL')fail('unverifiable','De gecontroleerde stap kan niet worden bevestigd');
 const native=core.previewAutomationRun(ctx,actor,workflow.id,{event:run.trigger,inputs:run.inputs}),basis={request_context:realm(ctx,actor),workflow_signature:workflow.signature,activation_revision:native.activation_revision,run_id:run.run_id,request_signature:run.request_signature,step_index:index,step:step?clone(step):null,run_status:run.status,recovery_revision:run.recovery_revision||0,next_wakeup_at:run.next_wakeup_at||null};
 return {...basis,workflow_id:workflow.id,workflow:clone(workflow),run:clone(run),preview_fingerprint:hash(basis),execution_performed:false};
}
function match(receipt,meta){if(!fields.every(key=>receipt[key]===meta[key]))fail('conflict','Deze hervataanvraag hoort bij andere invoer of een andere stap');}
function result(core,ctx,actor,receipt){const {run,workflow}=context(core,ctx,actor,receipt.run_id);if(receipt.state!=='APPLIED'||receipt.actor_id!==actor.id||run.automation_id!==receipt.workflow_id||workflow.signature!==receipt.workflow_signature||run.request_signature!==receipt.request_signature||receipt.step_index>workflow.actions.length)fail('unverifiable','De oorspronkelijke hervataanvraag kan niet worden bevestigd');return clone(run);}
function prepare(core,ctx,actor,workflow,run,input){
 if(input===undefined)return null;if(!object(input)||Object.keys(input).some(key=>!['request_id','confirm','reason','run_id','request_signature','step_index','preview_fingerprint'].includes(key))||input.confirm!==true||typeof input.reason!=='string'||!input.reason.trim()||input.reason.length>500||!run||input.run_id!==run.run_id||input.request_signature!==run.request_signature)fail('invalid','Bevestig de exacte run en stap met een reden',422);
 const meta={request_id:input.request_id,request_fingerprint:hash(input),workflow_id:workflow.id,workflow_signature:workflow.signature,run_id:run.run_id,request_signature:run.request_signature,step_index:input.step_index,preview_fingerprint:input.preview_fingerprint};validate(meta);
 const rows=core.bucket(ctx,NAME),receipt=rows.find(row=>row.actor_id===actor.id&&row.request_id===meta.request_id),envelope={...meta,request_context:realm(ctx,actor)};
 if(receipt){match(receipt,meta);if(receipt.state==='NOT_APPLIED')fail('abandoned','Deze hervataanvraag is afgesloten');return {record:result(core,ctx,actor,receipt),envelope};}
 const current=preview(core,ctx,actor,run.run_id);if(current.step_index!==meta.step_index||current.preview_fingerprint!==meta.preview_fingerprint)fail('changed','De gecontroleerde run, stap of activering is gewijzigd');
 if(rows.length>=LIMIT)fail('capacity','Het maximumaantal hervatreferenties is bereikt',507);
 return {envelope,retain:()=>rows.push({...meta,actor_id:actor.id,state:'APPLIED',recorded_at:core.now()})};
}
function resume(core,ctx,actor,runId,input){if(!object(input))fail('invalid','Bevestig de exacte run en stap met een reden',422);const {run,workflow}=context(core,ctx,actor,runId);return core.runAutomation(ctx,actor,workflow.id,run.trigger,{inputs:run.inputs,resume:input});}
function recover(core,ctx,actor,input){
 if(!object(input)||input.confirm!==true||Object.keys(input).some(key=>!fields.includes(key)&&key!=='confirm'))fail('invalid','Bevestig de exacte herstelreferentie',422);const meta=Object.fromEntries(fields.map(key=>[key,input[key]]));validate(meta);
 const {run,workflow}=context(core,ctx,actor,meta.run_id);if(run.automation_id!==meta.workflow_id||workflow.signature!==meta.workflow_signature||run.request_signature!==meta.request_signature||meta.step_index>workflow.actions.length)fail('conflict','De herstelreferentie hoort bij een andere run of stap');
 const rows=core.bucket(ctx,NAME),receipt=rows.find(row=>row.actor_id===actor.id&&row.request_id===meta.request_id),envelope={...meta,request_context:realm(ctx,actor),execution_performed:false};
 if(receipt){match(receipt,meta);return {...envelope,state:receipt.state,run:receipt.state==='NOT_APPLIED'?null:result(core,ctx,actor,receipt),workflow:receipt.state==='NOT_APPLIED'?null:clone(workflow)};}
 if(rows.length>=LIMIT)fail('capacity','Het maximumaantal hervatreferenties is bereikt',507);
 return core.moduleMutation(ctx,[NAME],()=>{rows.push({...meta,actor_id:actor.id,state:'NOT_APPLIED',recorded_at:core.now()});core.audit(ctx,actor,'CLOSE','automation_resume_request',null,{content_logged:false});return {...envelope,state:'NOT_APPLIED',run:null,workflow:null};});
}
// Legacy native HTTP execution has one stable request identity. A repeated
// event is an observation; advancing a wait requires the separate resume API.
function invoke(core,ctx,actor,workflowId,event,options={}){
 if(!object(options)||Object.hasOwn(options,'resume'))fail('separate','Gebruik de afzonderlijke gecontroleerde hervatting',422);
 if(options.approval||Object.hasOwn(options,'request_id')||Object.hasOwn(options,'request_fingerprint'))return core.runAutomation(ctx,actor,workflowId,event,options);
 const fingerprint=signature({workflow_id:workflowId,event,options}),result=core.runAutomation(ctx,actor,workflowId,event,{...options,request_id:'native-run:'+fingerprint,request_fingerprint:fingerprint});
 if(result.steps.some(step=>step.status==='RUNNING'))throw Object.assign(Error('Controleer het resultaat van de onderbroken stap vóór hervatten'),{code:'automation_outcome_indeterminate',statusCode:409});return result;
}
module.exports={NAME,SCOPE,context,preview,prepare,resume,recover,invoke};
