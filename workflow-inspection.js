'use strict';
const crypto=require('node:crypto');
const {signature,validateWorkflow,matchesCondition}=require('./workflow-execution');
const {visible}=require('./workflow-run-query');
const fail=(code,message,statusCode=409)=>{throw Object.assign(Error(message),{code,statusCode});};
function inspect(core,ctx,actor,runId,query={}){
 if(typeof runId!=='string'||!/^[A-Za-z0-9_.:-]{1,200}$/.test(runId)||!query||typeof query!=='object'||Array.isArray(query)||Object.keys(query).some(k=>k!=='step'))fail('automation_inspection_invalid','Kies een geldige run en stap',422);
 const run=core.bucket(ctx,'automation_runs').find(row=>row?.run_id===runId&&visible(actor,row));if(!run)fail('automation_run_missing','Run niet gevonden',404);
 const workflow=core.bucket(ctx,'automations').find(row=>row?.id===run.automation_id&&visible(actor,row,'automations'));if(!workflow)fail('automation_missing','Workflow niet toegankelijk',404);
 validateWorkflow(workflow.actions);
 const definition={name:workflow.name,version:workflow.version,trigger:workflow.trigger,actions:workflow.actions,enabled:workflow.enabled!==false,approval_required:Boolean(workflow.approval_required)};
 if(crypto.createHash('sha256').update(JSON.stringify(definition)).digest('hex')!==workflow.signature||signature({workflow:workflow.signature,trigger:run.trigger,inputs:run.inputs})!==run.request_signature)fail('automation_inspection_changed','De bewaarde definitie of invoer wijkt af van de oorspronkelijke run');
 if(!Array.isArray(run.steps)||run.steps.some(s=>!s||!Number.isInteger(s.index)||s.index<0||s.index>=workflow.actions.length)||new Set(run.steps.map(s=>s.index)).size!==run.steps.length)fail('automation_inspection_changed','De bewaarde stappen zijn inconsistent');
 for(const step of run.steps)if(signature(step.input)!==signature(workflow.actions[step.index]))fail('automation_inspection_changed','Een bewaarde stap wijkt af van de workflowversie');
 const index=query.step===undefined?(run.steps.find(s=>['RUNNING','FAILED','DEAD_LETTER','BLOCKED','AWAITING_APPROVAL','WAITING_RETRY','WAITING_TIME'].includes(s.status))?.index??0):Number(query.step);
 if(query.step!==undefined&&!/^\d{1,3}$/.test(String(query.step))||!Number.isInteger(index)||index<0||index>=workflow.actions.length)fail('automation_inspection_invalid','Kies een bestaande stap',422);
 let remaining=16000;
 const display=value=>{if(value===undefined)return {present:false,type:'missing'};if(value!==null&&typeof value==='object')return {present:true,type:Array.isArray(value)?'array':'object',value_omitted:true};if(typeof value==='string'){const length=Math.min(2000,remaining),text=value.slice(0,length);remaining-=text.length;return {present:true,type:'string',value:text,truncated:text.length!==value.length};}return {present:true,type:value===null?'null':typeof value,value};};
 const trace=c=>{
  if(c===undefined)return {kind:'unconditional',matched:true};
  if(c.all||c.any||c.not){const kind=c.all?'all':c.any?'any':'not',children=(c.all||c.any||[c.not]).map(trace);return {kind,matched:kind==='all'?children.every(c=>c.matched):kind==='any'?children.some(c=>c.matched):!children[0].matched,children};}
  const actual=c.field.split('.').reduce((v,k)=>v&&Object.hasOwn(v,k)?v[k]:undefined,{event:run.trigger,inputs:run.inputs});
  return {kind:'comparison',field:c.field,operator:c.operator,actual:display(actual),...(c.operator==='exists'?{}:{expected:Array.isArray(c.value)?c.value.map(display):display(c.value)}),matched:matchesCondition(c,run.trigger,run.inputs)};
 };
 const step=run.steps.find(s=>s.index===index),action=workflow.actions[index];
 const steps=workflow.actions.map((a,i)=>{const s=run.steps.find(s=>s.index===i);return {index:i,type:a.type,status:s?.status||'NOT_REACHED',condition_matched:matchesCondition(a.when,run.trigger,run.inputs),attempts:s?.attempts||0};});
 return {run_id:runId,workflow_id:workflow.id,workflow_name:workflow.name,workflow_version:workflow.version,status:run.status,request_signature:run.request_signature,steps,selected:{...steps[index],condition:trace(action.when),error:typeof step?.error==='string'?step.error.slice(0,1000):null,next_wakeup_at:step?.next_retry_at||step?.wake_at||null,started_at:step?.started_at||null,completed_at:step?.completed_at||null,recorded_output:step?.output_index===undefined?'NONE':run.outputs?.[step.output_index]?.executed===true?'REPORTED_EXECUTED':run.outputs?.[step.output_index]?.executed===false?'REPORTED_NOT_EXECUTED':'UNKNOWN'},approval:{required:workflow.approval_required,recorded:Boolean(run.approval?.approved)},read_only:true,execution_performed:false,outcome_reverified:false,basis:'CURRENT_AUTHORIZED_RETAINED_RUN_AND_IMMUTABLE_DEFINITION',scope:'CURRENT_AUTHORIZED_RUNS'};
}
module.exports={inspect};
