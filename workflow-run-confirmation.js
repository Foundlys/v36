'use strict';
// Native manual controls share the exact reviewed run boundary used by ZERO.
// They never call the legacy explicit-resume route when checking a request.
const crypto=require('node:crypto');
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
function preview(core,ctx,actor,workflowId,input){
  const observed=core.previewAutomationRun(ctx,actor,workflowId,input);
  return {...observed,preview_fingerprint:hash({actor_id:actor.id,ctx,preview:observed})};
}
function submit(core,ctx,actor,workflowId,input){
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!['event','inputs','preview_fingerprint','confirm','reason','request_id'].includes(key))||input.confirm!==true||typeof input.reason!=='string'||!input.reason.trim()||input.reason.length>500||typeof input.request_id!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/.test(input.request_id))throw Object.assign(Error('Bevestig de exacte gecontroleerde workflowuitvoering'),{code:'automation_run_confirmation_invalid',statusCode:422});
  const observed=preview(core,ctx,actor,workflowId,{event:input.event,inputs:input.inputs});
  if(input.preview_fingerprint!==observed.preview_fingerprint)throw Object.assign(Error('De workflow of invoer is gewijzigd; controleer opnieuw'),{code:'automation_run_confirmation_changed',statusCode:409});
  const run=core.runAutomation(ctx,actor,workflowId,observed.event,{inputs:observed.inputs,request_id:input.request_id,request_fingerprint:hash(input)});
  return {run,approval_is_separate:true};
}
module.exports={preview,submit};
