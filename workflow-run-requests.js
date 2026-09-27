'use strict';
// Metadata-only attribution of an explicit run request. Reading an accepted
// request never calls the execution engine or verifies an external effect.
const {signature}=require('./workflow-execution'),{definitionFingerprint}=require('./workflow-publication-recovery');
const NAME='automation_run_requests',SCOPE='platform:'+NAME,LIMIT=10000;
const clone=value=>JSON.parse(JSON.stringify(value)),object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value),id=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/.test(value),hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const fields=['request_id','request_fingerprint','workflow_id','event_id','workflow_signature','request_signature'],fail=(code,message,statusCode=409)=>{throw Object.assign(Error(message),{code:'automation_run_request_'+code,statusCode});};
function validate(meta){if(!object(meta)||Object.keys(meta).some(key=>!fields.includes(key))||!['request_id','workflow_id','event_id'].every(key=>id(meta[key]))||!['request_fingerprint','workflow_signature','request_signature'].every(key=>hash(meta[key])))fail('invalid','Kies een geldige uitvoeraanvraag',422);}
function match(receipt,meta){if(!fields.every(key=>receipt[key]===meta[key]))fail('conflict','Deze uitvoeraanvraag hoort bij andere invoer');}
const realm=(ctx,actor)=>({tenant_id:ctx.tenant_id,dealer_id:ctx.dealer_id,actor_id:actor.id});
function result(core,ctx,actor,receipt){
 if(receipt.state!=='APPLIED')fail('unverifiable','De uitvoeraanvraag kan niet worden bevestigd');
 const runs=core.bucket(ctx,'automation_runs').filter(row=>row.run_id===receipt.run_id),workflows=core.bucket(ctx,'automations').filter(row=>row.id===receipt.workflow_id);
 if(!runs.length||!workflows.length)fail('unavailable','De bewaarde run of workflowversie is niet meer beschikbaar');
 const run=runs[0],workflow=workflows[0];
 if(runs.length!==1||workflows.length!==1||receipt.actor_id!==actor.id||run.actor_id!==actor.id||run.tenant_id!==ctx.tenant_id||run.dealer_id!==ctx.dealer_id||workflow.tenant_id!==ctx.tenant_id||workflow.dealer_id!==ctx.dealer_id||run.automation_id!==receipt.workflow_id||run.workflow_version!==workflow.version||run.event_id!==receipt.event_id||(run.trigger?.event_id||run.trigger?.id)!==receipt.event_id||workflow.immutable_version!==true||workflow.signature!==receipt.workflow_signature||definitionFingerprint(workflow)!==receipt.workflow_signature||run.request_signature!==receipt.request_signature||signature({workflow:workflow.signature,trigger:run.trigger,inputs:run.inputs})!==receipt.request_signature)fail('unverifiable','De bewaarde run en uitvoerinvoer kunnen niet worden bevestigd');
 return clone(run);
}
// Called after native authority, workflow and event validation. Retain must join
// the initial run reservation transaction, before the first possible effect.
function prepare(core,ctx,actor,workflow,eventId,requestSignature,options,existing){
 if(!Object.hasOwn(options,'request_id')&&!Object.hasOwn(options,'request_fingerprint'))return null;
 if(options.approval)fail('approval_separate','Gebruik de afzonderlijke native goedkeuringsstap',422);
 const meta={request_id:options.request_id,request_fingerprint:options.request_fingerprint,workflow_id:workflow.id,event_id:eventId,workflow_signature:workflow.signature,request_signature:requestSignature};validate(meta);
 const rows=core.bucket(ctx,NAME),receipt=rows.find(row=>row.actor_id===actor.id&&row.request_id===meta.request_id),envelope={...meta,request_context:realm(ctx,actor)};
 if(receipt){match(receipt,meta);if(receipt.state==='NOT_APPLIED')fail('abandoned','Deze uitvoeraanvraag is afgesloten');return {record:result(core,ctx,actor,receipt),envelope};}
 if(existing&&existing.actor_id!==actor.id)fail('forbidden','Deze run behoort tot een andere gebruiker',403);
 if(rows.length>=LIMIT)fail('capacity','Het maximumaantal uitvoerreferenties is bereikt',507);
 if(workflow.immutable_version!==true||definitionFingerprint(workflow)!==workflow.signature)fail('unverifiable','De workflowversie kan niet worden bevestigd');
 const retain=run=>rows.push({...meta,actor_id:actor.id,state:'APPLIED',run_id:run.run_id,recorded_at:core.now()});
 if(existing){const record=result(core,ctx,actor,{...meta,actor_id:actor.id,state:'APPLIED',run_id:existing.run_id});core.moduleMutation(ctx,[NAME],()=>retain(existing));return {record,envelope};}
 return {retain,envelope};
}
// A missing key is closed atomically. A delayed submit with that key is refused
// by prepare, including after restart. Other keys retain their own authority.
function recover(core,ctx,actor,input){
 if(!object(input)||input.confirm!==true||Object.keys(input).some(key=>!fields.includes(key)&&key!=='confirm'))fail('invalid','Bevestig de exacte uitvoeraanvraag',422);
 const meta=Object.fromEntries(fields.map(key=>[key,input[key]]));validate(meta);
 const rows=core.bucket(ctx,NAME),receipt=rows.find(row=>row.actor_id===actor.id&&row.request_id===meta.request_id),envelope={...meta,request_context:realm(ctx,actor),execution_performed:false,outcome_reverified:false,approval_is_separate:true};
 if(receipt){match(receipt,meta);if(receipt.state==='NOT_APPLIED')return {...envelope,state:'NOT_APPLIED',run:null};return {...envelope,state:'APPLIED',run:result(core,ctx,actor,receipt)};}
 if(rows.length>=LIMIT)fail('capacity','Het maximumaantal uitvoerreferenties is bereikt',507);
 return core.moduleMutation(ctx,[NAME],()=>{rows.push({...meta,actor_id:actor.id,state:'NOT_APPLIED',recorded_at:core.now()});core.audit(ctx,actor,'CLOSE','automation_run_request',null,{content_logged:false});return {...envelope,state:'NOT_APPLIED',run:null};});
}
module.exports={NAME,SCOPE,prepare,recover};
