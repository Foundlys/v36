'use strict';
const crypto=require('node:crypto'),clone=value=>JSON.parse(JSON.stringify(value)),hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const NAME='automation_result_requests',SCOPE='platform:'+NAME,LIMIT=10000,fields=['request_id','request_fingerprint','workflow_id','workflow_signature','run_id','request_signature','step_index','preview_fingerprint'];
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value),id=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/.test(value),digest=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const fail=(code,message,statusCode=409)=>{throw Object.assign(Error(message),{code:'automation_result_request_'+code,statusCode});},realm=(ctx,actor)=>({tenant_id:ctx.tenant_id,dealer_id:ctx.dealer_id,actor_id:actor.id});
function validate(meta){if(!object(meta)||Object.keys(meta).some(key=>!fields.includes(key))||!['request_id','workflow_id','run_id'].every(key=>id(meta[key]))||!['request_fingerprint','workflow_signature','request_signature','preview_fingerprint'].every(key=>digest(meta[key]))||!Number.isSafeInteger(meta.step_index)||meta.step_index<0||meta.step_index>=100)fail('invalid','Kies de exacte resultaatherstelaanvraag',422);}
function find(rows,actor,requestId){const matches=rows.filter(row=>row.actor_id===actor.id&&row.request_id===requestId);if(matches.length>1)fail('unverifiable','De herstelreferentie is niet eenduidig');return matches[0];}
function outcome(core,ctx,actor,receipt){
 const {run,workflow}=require('./workflow-recovery').context(core,ctx,actor,receipt.run_id),entries=(run.recoveries||[]).filter(row=>row.request_signature===receipt.native_signature),entry=entries[0];
 if(receipt.state!=='APPLIED'||receipt.actor_id!==actor.id||run.automation_id!==receipt.workflow_id||workflow.signature!==receipt.workflow_signature||run.request_signature!==receipt.request_signature||entries.length!==1||hash(entry)!==receipt.result_digest||entry.step_index!==receipt.step_index||!Number.isSafeInteger(receipt.result_revision)||receipt.result_revision<1||run.recovery_revision<receipt.result_revision)fail('unverifiable','De vastgelegde resultaatherstelling kan niet worden bevestigd');
 return {run:clone(run),workflow:clone(workflow),reconciliation:clone(entry),recovery_revision:receipt.result_revision};
}
function prepare(core,ctx,actor,workflow,run,input){
 const rows=core.bucket(ctx,NAME),requestId=Object.hasOwn(input,'request_id')?input.request_id:'native-recovery:'+hash({run_id:run.run_id,input});if(!id(requestId))fail('invalid','Een geldige herstelreferentie is vereist',422);
 const base={request_id:requestId,request_fingerprint:hash(input),workflow_id:workflow.id,workflow_signature:workflow.signature,run_id:run.run_id,request_signature:run.request_signature,preview_fingerprint:input.preview_fingerprint},receipt=find(rows,actor,requestId),request={envelope:null};
 if(receipt){if(!Object.entries(base).every(([key,value])=>receipt[key]===value))fail('conflict','Deze herstelreferentie hoort bij andere invoer of ander bewijs');validate(Object.fromEntries(fields.map(key=>[key,receipt[key]])));if(receipt.state==='NOT_APPLIED')fail('abandoned','Deze resultaatherstelaanvraag is afgesloten');return {record:outcome(core,ctx,actor,receipt).run,envelope:{...Object.fromEntries(fields.map(key=>[key,receipt[key]])),request_context:realm(ctx,actor)}};}
 if(rows.length>=LIMIT)fail('capacity','Het maximumaantal herstelreferenties is bereikt',507);
 request.retain=(record,entry)=>{const meta={...base,step_index:entry.step_index};validate(meta);request.envelope={...meta,request_context:realm(ctx,actor)};rows.push({...meta,actor_id:actor.id,state:'APPLIED',native_signature:entry.request_signature,result_digest:hash(entry),result_revision:record.recovery_revision,recorded_at:core.now()});};return request;
}
function recover(core,ctx,actor,input){
 if(!object(input)||input.confirm!==true||Object.keys(input).some(key=>!fields.includes(key)&&key!=='confirm'))fail('invalid','Bevestig de exacte herstelreferentie',422);const meta=Object.fromEntries(fields.map(key=>[key,input[key]]));validate(meta);
 const {run,workflow}=require('./workflow-recovery').context(core,ctx,actor,meta.run_id);if(run.automation_id!==meta.workflow_id||workflow.signature!==meta.workflow_signature||run.request_signature!==meta.request_signature||meta.step_index>=workflow.actions.length)fail('conflict','Deze herstelreferentie hoort bij een andere run of stap');
 const rows=core.bucket(ctx,NAME),receipt=find(rows,actor,meta.request_id),envelope={...meta,request_context:realm(ctx,actor),execution_performed:false},absent={state:'NOT_APPLIED',run:null,workflow:null,reconciliation:null,recovery_revision:null};
 if(receipt){if(!fields.every(key=>receipt[key]===meta[key]))fail('conflict','Deze herstelreferentie hoort bij andere invoer of ander bewijs');return {...envelope,...(receipt.state==='NOT_APPLIED'?absent:{state:'APPLIED',...outcome(core,ctx,actor,receipt)})};}
 if(rows.length>=LIMIT)fail('capacity','Het maximumaantal herstelreferenties is bereikt',507);
 return core.moduleMutation(ctx,[NAME],()=>{rows.push({...meta,actor_id:actor.id,state:'NOT_APPLIED',recorded_at:core.now()});core.audit(ctx,actor,'CLOSE','automation_result_request',null,{content_logged:false});return {...envelope,...absent};});
}
module.exports={NAME,SCOPE,prepare,recover};
