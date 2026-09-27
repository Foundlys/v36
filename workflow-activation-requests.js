'use strict';
const crypto=require('node:crypto'),{definitionFingerprint}=require('./workflow-publication-recovery');
const NAME='automation_activation_requests',SCOPE='platform:'+NAME,LIMIT=10000,hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'),clone=value=>JSON.parse(JSON.stringify(value));
const fields=['request_id','request_fingerprint','workflow_id','workflow_signature','expected_revision','active'],object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value),id=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/.test(value),digest=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const fail=(code,message,statusCode=409)=>{throw Object.assign(Error(message),{code:'automation_activation_request_'+code,statusCode});},realm=(ctx,actor)=>({tenant_id:ctx.tenant_id,dealer_id:ctx.dealer_id,actor_id:actor.id});
function validate(meta){if(!object(meta)||Object.keys(meta).some(key=>!fields.includes(key))||!['request_id','workflow_id'].every(key=>id(meta[key]))||!['request_fingerprint','workflow_signature'].every(key=>digest(meta[key]))||!Number.isSafeInteger(meta.expected_revision)||meta.expected_revision<0||typeof meta.active!=='boolean')fail('invalid','Kies de exacte activeringsaanvraag',422);}
function context(core,ctx,actor,workflowId){
  const matches=core.bucket(ctx,'automations').filter(row=>row?.id===workflowId),workflow=matches[0];if(matches.length!==1)fail('unavailable','De oorspronkelijke workflowversie is niet beschikbaar');
  if(workflow.created_by!==actor.id&&!actor.permissions.has('*'))throw Object.assign(Error('Alleen de workfloweigenaar of platformbeheerder kan deze activering controleren'),{code:'automation_activation_forbidden',statusCode:403});
  if(workflow.tenant_id!==ctx.tenant_id||workflow.dealer_id!==ctx.dealer_id||workflow.immutable_version!==true||definitionFingerprint(workflow)!==workflow.signature||!workflow.created_by)fail('unverifiable','De oorspronkelijke workflowversie kan niet worden bevestigd');return workflow;
}
function match(receipt,meta){if(!fields.every(key=>receipt[key]===meta[key]))fail('conflict','Deze activeringsaanvraag hoort bij een andere keuze of revisie');}
function outcome(core,ctx,actor,receipt,workflow){
  if(receipt.state!=='APPLIED'||receipt.actor_id!==actor.id||receipt.workflow_signature!==workflow.signature)fail('unverifiable','De bewaarde activeringsaanvraag kan niet worden bevestigd');
  const activationId=require('./workflow-activation').groupId(workflow),matches=core.bucket(ctx,'automation_activations').filter(row=>row.id===activationId),row=matches[0];if(matches.length!==1||!Number.isSafeInteger(row.revision)||row.revision<1)fail('unverifiable','De bewaarde activering kan niet worden bevestigd');
  if(row.revision>receipt.result_revision)return {state:'SUPERSEDED',activation:null,workflow:null};
  if(row.revision!==receipt.result_revision||row.request_signature!==receipt.native_signature)fail('unverifiable','De bewaarde activeringsrevisie kan niet worden bevestigd');
  if(row.tenant_id!==ctx.tenant_id||row.dealer_id!==ctx.dealer_id||row.updated_by!==actor.id||row.owner_id!==workflow.created_by||row.workflow_name!==workflow.name||row.revision!==receipt.expected_revision+1||row.active_workflow_id!==(receipt.active?workflow.id:null)||row.status!==(receipt.active?'ACTIVE':'PAUSED')||hash(row)!==receipt.result_digest)fail('unverifiable','De bewaarde activering wijkt af van de bevestigde keuze');
  return {state:'APPLIED',activation:clone(row),workflow:clone(workflow)};
}
function prepare(core,ctx,actor,workflow,input){
  if(!Object.hasOwn(input,'request_id'))return null;context(core,ctx,actor,workflow.id);
  const meta={request_id:input.request_id,request_fingerprint:hash(input),workflow_id:workflow.id,workflow_signature:workflow.signature,expected_revision:input.expected_revision,active:input.active};validate(meta);
  const rows=core.bucket(ctx,NAME),receipt=rows.find(row=>row.actor_id===actor.id&&row.request_id===meta.request_id),envelope={...meta,request_context:realm(ctx,actor)};
  if(receipt){match(receipt,meta);if(receipt.state==='NOT_APPLIED')fail('abandoned','Deze activeringsaanvraag is afgesloten');const current=outcome(core,ctx,actor,receipt,workflow);if(current.state==='SUPERSEDED')fail('superseded','Een latere keuze heeft deze activering vervangen');return {record:current.activation,envelope};}
  if(rows.length>=LIMIT)fail('capacity','Het maximumaantal activeringsreferenties is bereikt',507);
  return {envelope,retain:row=>{if(row.revision!==meta.expected_revision+1)fail('unverifiable','De oorspronkelijke activeringsrevisie kan niet worden bevestigd');rows.push({...meta,actor_id:actor.id,state:'APPLIED',result_revision:row.revision,native_signature:row.request_signature,result_digest:hash(row),recorded_at:core.now()});}};
}
function recover(core,ctx,actor,input){
  if(!object(input)||input.confirm!==true||Object.keys(input).some(key=>!fields.includes(key)&&key!=='confirm'))fail('invalid','Bevestig de exacte herstelreferentie',422);const meta=Object.fromEntries(fields.map(key=>[key,input[key]]));validate(meta);const workflow=context(core,ctx,actor,meta.workflow_id);if(workflow.signature!==meta.workflow_signature)fail('conflict','Deze aanvraag hoort bij een andere workflowversie');
  const rows=core.bucket(ctx,NAME),receipt=rows.find(row=>row.actor_id===actor.id&&row.request_id===meta.request_id),envelope={...meta,request_context:realm(ctx,actor),activation_performed:false,execution_performed:false};
  if(receipt){match(receipt,meta);return {...envelope,...(receipt.state==='NOT_APPLIED'?{state:'NOT_APPLIED',activation:null,workflow:null}:outcome(core,ctx,actor,receipt,workflow))};}
  if(rows.length>=LIMIT)fail('capacity','Het maximumaantal activeringsreferenties is bereikt',507);
  return core.moduleMutation(ctx,[NAME],()=>{rows.push({...meta,actor_id:actor.id,state:'NOT_APPLIED',recorded_at:core.now()});core.audit(ctx,actor,'CLOSE','automation_activation_request',null,{content_logged:false});return {...envelope,state:'NOT_APPLIED',activation:null,workflow:null};});
}
module.exports={NAME,SCOPE,prepare,recover};
