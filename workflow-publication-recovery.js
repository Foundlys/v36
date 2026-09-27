'use strict';
const crypto=require('node:crypto');
const NAME='automation_publication_requests',SCOPE='platform:'+NAME,LIMIT=10000;
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value),id=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(value),hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value),clone=value=>JSON.parse(JSON.stringify(value));
const digest=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'),fail=(code,message,statusCode=409)=>{throw Object.assign(Error(message),{code:'automation_publication_'+code,statusCode});};
const definitionFingerprint=row=>digest({name:row.name,version:row.version,trigger:row.trigger,actions:row.actions,enabled:row.enabled!==false,approval_required:Boolean(row.approval_required)});
const context=(ctx,actor)=>({tenant_id:ctx.tenant_id,dealer_id:ctx.dealer_id,actor_id:actor.id});
function match(receipt,metadata){if(!['request_fingerprint','definition_fingerprint'].every(key=>receipt[key]===metadata[key]))fail('conflict','Deze publicatiereferentie hoort bij andere invoer');}
function result(core,ctx,receipt){
 if(receipt.state!=='APPLIED')fail('unverifiable','De publicatie-uitkomst kan niet worden bevestigd');
 const row=core.bucket(ctx,'automations').find(row=>row.id===receipt.workflow_id);
 if(!row)fail('unavailable','De bevestigde workflowversie is niet meer beschikbaar');
 if(row.tenant_id!==ctx.tenant_id||row.dealer_id!==ctx.dealer_id||row.immutable_version!==true||!hash(row.signature)||row.signature!==receipt.definition_fingerprint||definitionFingerprint(row)!==row.signature)fail('unverifiable','De bewaarde workflowversie kan niet worden bevestigd');
 return row;
}
// Called only after native current permission and definition validation. The
// returned retain callback must join the definition/audit/event transaction.
function prepare(core,ctx,actor,input,signature){
 if(!Object.hasOwn(input,'request_id'))return null;
 if(!id(input.request_id))fail('request_invalid','Een geldige publicatiereferentie is verplicht',422);
 const metadata={request_id:input.request_id,request_fingerprint:digest(input),definition_fingerprint:signature},rows=core.bucket(ctx,NAME),receipt=rows.find(row=>row.actor_id===actor.id&&row.request_id===metadata.request_id),envelope={request_id:metadata.request_id,request_fingerprint:metadata.request_fingerprint,request_context:context(ctx,actor)};
 if(receipt){match(receipt,metadata);if(receipt.state==='NOT_APPLIED')fail('abandoned','Deze publicatieaanvraag is afgesloten');return {record:result(core,ctx,receipt),envelope};}
 if(rows.length>=LIMIT)fail('capacity','Het maximumaantal publicatiereferenties is bereikt',507);
 return {envelope,retain(row){rows.push({...metadata,actor_id:actor.id,state:'APPLIED',workflow_id:row.id,recorded_at:core.now()});}};
}
// Current automation:manage permission is checked by the owning native method.
// Recovery never publishes, activates, executes or flushes events.
function recover(core,ctx,actor,input){
 if(!object(input)||Object.keys(input).some(key=>!['request_id','request_fingerprint','definition_fingerprint','confirm'].includes(key))||!id(input.request_id)||!hash(input.request_fingerprint)||!hash(input.definition_fingerprint)||input.confirm!==true)fail('recovery_invalid','Bevestig de exacte publicatieaanvraag',422);
 const metadata={request_id:input.request_id,request_fingerprint:input.request_fingerprint,definition_fingerprint:input.definition_fingerprint},rows=core.bucket(ctx,NAME),receipt=rows.find(row=>row.actor_id===actor.id&&row.request_id===input.request_id),envelope={...metadata,request_context:context(ctx,actor)};
 if(receipt){match(receipt,metadata);if(receipt.state==='NOT_APPLIED')return {...envelope,state:'NOT_APPLIED',record:null};return {...envelope,state:'APPLIED',record:clone(result(core,ctx,receipt))};}
 if(rows.length>=LIMIT)fail('capacity','Het maximumaantal publicatiereferenties is bereikt',507);
 return core.moduleMutation(ctx,[NAME],()=>{rows.push({...metadata,actor_id:actor.id,state:'NOT_APPLIED',recorded_at:core.now()});core.audit(ctx,actor,'CLOSE','automation_publication',null,{content_logged:false});return {...envelope,state:'NOT_APPLIED',record:null};});
}
module.exports={NAME,SCOPE,prepare,recover,definitionFingerprint};
