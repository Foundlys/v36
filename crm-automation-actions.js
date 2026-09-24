'use strict';
// New automatic effects explicitly opt in. Historical untyped definitions keep
// their recorded/planned outcome and never acquire new write authority on replay.
const ENTITIES=Object.freeze(['leads','contacts','companies','opportunities','deals','tasks','appointments','quotes']);
const FIELDS=Object.freeze(['name','title','status','description','email','phone','score','value','margin','amount','forecast_value','probability','next_action_at','last_contacted_at','expected_close_at']);
const EFFECTS=new Set(['assign','field_update','stage_change']),ID=/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/;
const failure=(code,message,statusCode=400)=>Object.assign(Error(message),{code,statusCode});
function validate(action){
 if(!EFFECTS.has(action.type)||action.execution_mode===undefined)return;
 if(action.execution_mode!=='AUTOMATIC_INTERNAL'||!ENTITIES.includes(action.target_entity))throw failure('crm_automation_target_invalid','Een ondersteund intern doeldomein is verplicht');
 if(action.type==='assign'&&!ID.test(String(action.owner_id||'')))throw failure('crm_automation_target_invalid','Een bestaande CRM-gebruiker is verplicht');
 if(action.type==='stage_change'&&(action.target_entity!=='deals'||!ID.test(String(action.stage_id||''))))throw failure('crm_automation_target_invalid','Een bestaande dealfase is verplicht');
 if(action.type==='field_update'&&(!FIELDS.includes(action.field)||!Object.hasOwn(action,'value')||action.value!==null&&!['string','number'].includes(typeof action.value)))throw failure('crm_automation_field_invalid','Een toegestaan bedrijfsveld en expliciete waarde zijn verplicht');
}
function access(core,ctx,actor,entity,operation){if(typeof core.adapter.authorizeAutomationAccess==='function')core.adapter.authorizeAutomationAccess(ctx,actor,entity,operation);}
function read(core,ctx,actor,entity,id){access(core,ctx,actor,entity,'read');return core.get(ctx,actor,entity,id);}
function execute(core,ctx,actor,event,action){
 if(!EFFECTS.has(action.type)||action.execution_mode===undefined)return null;validate(action);
 const entity=action.target_entity;if(event.entity!==entity||!ID.test(String(event.record_id||'')))throw failure('crm_automation_target_invalid','Het event heeft geen passend native CRM-doel',409);
 access(core,ctx,actor,entity,'write');const record=read(core,ctx,actor,entity,event.record_id),principal=core.context(ctx,actor).principal;
 if(!core.canWriteRecord(record,principal))throw failure('crm_forbidden','Deze CRM-mutatie is niet toegestaan',403);
 const sources=[];let patch;
 if(action.type==='assign'){
  const owner=read(core,ctx,actor,'users',action.owner_id);if(owner.enabled===false||/^(?:INACTIVE|DISABLED|ARCHIVED)$/i.test(owner.status||''))throw failure('crm_automation_assignee_unavailable','De CRM-gebruiker is niet actief',409);sources.push({entity:'users',id:owner.id});patch={owner_id:owner.id};
 }else if(action.type==='stage_change'){
  const stage=read(core,ctx,actor,'stages',action.stage_id),pipeline=read(core,ctx,actor,'pipelines',record.pipeline_id);if(stage.pipeline_id!==pipeline.id)throw failure('crm_stage_pipeline_mismatch','Fase hoort niet bij de pipeline van deze deal',409);sources.push({entity:'stages',id:stage.id},{entity:'pipelines',id:pipeline.id});
  patch={stage_id:stage.id,probability:stage.probability??record.probability,status:stage.status||record.status,stage_history:[...(record.stage_history||[]).slice(-49),{stage_id:stage.id,at:core.adapter.now().toISOString(),automation_event_id:event.id}]};
 }else{
  if(action.field==='score'&&action.value!==null&&(typeof action.value!=='number'||!Number.isFinite(action.value)||action.value<0||action.value>100))throw failure('crm_automation_field_invalid','Score moet een getal van 0 tot 100 zijn');
  if(['name','title','status','description','email','phone'].includes(action.field)&&action.value!==null&&typeof action.value!=='string')throw failure('crm_automation_field_invalid','Dit bedrijfsveld vereist tekst');
  if(['name','title'].includes(action.field)&&!String(action.value||'').trim())throw failure('crm_automation_field_invalid','Naam of titel mag niet leeg worden');patch={[action.field]:action.value};
 }
 const saved=core.update(ctx,actor,entity,record.id,patch,{expectedRevision:record.revision});
 return {type:action.type,status:'EXECUTED_INTERNAL',record_entity:entity,record_id:saved.id,before_revision:record.revision,after_revision:saved.revision,source_refs:sources,external_write:false,cascading_automations:false};
}
module.exports={validate,execute,access,read,contract:{execution_mode:'AUTOMATIC_INTERNAL',target_source:'EVENT_RECORD',entities:ENTITIES,fields:FIELDS,cascading_automations:false}};
