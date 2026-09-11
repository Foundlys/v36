'use strict';
// ZERO uses the same private draft store and compiler as the native editor.
// These operations never publish, activate or execute a workflow.
const crypto=require('node:crypto');
const {compile,contract}=require('./workflow-authoring');
const {validateWorkflow,validateRetryContracts}=require('./workflow-execution');
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fail=(code,message,statusCode=422)=>{throw Object.assign(Error(message),{code,statusCode});};
const OPERATIONS=Object.freeze({PREVIEW:{tool:'automation_draft_preview',mode:'read',permission:'write',name:'Workflowconcept voorbereiden'},SAVE:{tool:'automation_draft_save',mode:'write',permission:'write',name:'Workflowconcept expliciet bewaren'},READ:{tool:'automation_draft_read',mode:'read',permission:'read',name:'Eigen workflowconcept bekijken'}});
function tools(){return Object.entries(OPERATIONS).map(([operation,op])=>({tool_id:op.tool,name:op.name,engine:'automation',description:op.name+' via de native private conceptopslag. Publiceert, activeert of start geen workflow.',parameter_schema:{type:'object',properties:{operation:{type:'string',enum:[operation]},draft_id:{type:'string'},input:{type:'object'}},required:['operation','draft_id','input'],additionalProperties:false},required_permissions:[...new Set(['automation:read','automation:'+op.permission])],risk_level:op.mode==='write'?'MEDIUM_RISK':'READ_ONLY',mode:op.mode,provider:'foundly_automation',timeout_ms:3000,retry:{max_attempts:1},confirmation:op.mode==='write'?'explicit_native_draft':'never',handler:'automation_draft_native',verification:'current_private_draft_revision_and_compiler',audit:'source_free_reference'}));}
function validate(action){
 if(!action||typeof action!=='object'||Array.isArray(action)||Object.keys(action).some(key=>!['operation','draft_id','input'].includes(key))||!Object.hasOwn(OPERATIONS,action.operation)||typeof action.draft_id!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(action.draft_id)||!action.input||typeof action.input!=='object'||Array.isArray(action.input)||JSON.stringify(action).length>130000)fail('automation_zero_action_invalid','Kies een geldige workflowconceptactie met expliciete invoer');
 const keys=action.operation==='READ'?[]:action.operation==='PREVIEW'?['draft','expected_revision']:['draft','expected_revision','preview_fingerprint','confirm','reason'];
 if(Object.keys(action.input).some(key=>!keys.includes(key)))fail('automation_zero_action_invalid','Onbekende invoer voor workflowconcept');
 return OPERATIONS[action.operation];
}
function execute(drafts,platform,ctx,actor,action,{message,conversation_id,turn_id,prior=null}){
 const op=validate(action);drafts.resolver.assertTool(ctx,actor,op.tool);drafts.scope(ctx,actor,op.permission);
 const request_hash=hash({message,action});if(prior&&(prior.request_hash!==request_hash||prior.operation!==action.operation))fail('automation_zero_turn_conflict','Deze turn hoort bij een ander workflowconceptverzoek',409);
 const reference={operation:action.operation,tool_id:op.tool,draft_id:action.draft_id,request_hash};
 const existing=drafts.list(ctx,actor).items.find(row=>row.id===action.draft_id);let value;
 if(action.operation==='READ'){
   if(!existing)fail('workflow_draft_missing','Concept niet gevonden',404);
   value={record:existing,executable:false};
 }else{
   const input=action.input;if(!input.draft||typeof input.draft!=='object'||Array.isArray(input.draft))fail('workflow_draft_invalid','Kies expliciete workflowconceptinvoer');if(!Number.isInteger(input.expected_revision)||input.expected_revision<0)fail('workflow_draft_conflict','Kies de huidige conceptrevisie',409);
   // The native store alone resolves ownership and last-request replay on SAVE.
   // PREVIEW may never imply an overwrite of another writer's retained revision.
   if(action.operation==='PREVIEW'&&input.expected_revision!==(existing?.revision||0))fail('workflow_draft_conflict','Dit concept is gewijzigd; laad de actuele versie',409);
   const definition=compile(input.draft,contract(platform.schema().automation));validateWorkflow(definition.actions);validateRetryContracts(platform,definition.actions);
   const fingerprint=hash({actor_id:actor.id,tenant_id:ctx.tenant_id,dealer_id:ctx.dealer_id,draft_id:action.draft_id,revision:input.expected_revision,draft:input.draft,definition});
   if(action.operation==='PREVIEW')value={draft:input.draft,definition,expected_revision:input.expected_revision,preview_fingerprint:fingerprint,executable:false,publication_required:true};
   else{
     if(input.confirm!==true||typeof input.reason!=='string'||!input.reason.trim()||input.reason.length>500||input.preview_fingerprint!==fingerprint)fail('automation_zero_confirmation_invalid','Bevestig het exact voorbereide workflowconcept met een reden');
     value=drafts.save(ctx,actor,action.draft_id,{draft:input.draft,expected_revision:input.expected_revision});
   }
 }
 const answer=action.operation==='SAVE'?'Het private workflowconcept is bewaard. Publicatie, activatie en uitvoering zijn niet uitgevoerd.':action.operation==='READ'?'Het actuele eigen workflowconcept is opgehaald.':'Het workflowconcept is gecontroleerd. Bevestig apart om dit private concept te bewaren.';
 return {ok:true,status:'completed',modules:['automation'],answer,actions:action.operation==='SAVE'?[{type:'SAVE_WORKFLOW_DRAFT',tool_id:op.tool,status:'DRAFT',deduplicated:Boolean(value.deduplicated),external_write:false}]:[],syncs:[],web:{used:false,sources:[],error:null},voice_mode:action.operation==='SAVE'?'SUCCESS':'ANALYSIS',automation_data:value,automation_action_reference:reference,plan:{goal:op.name,steps:['validate_current_private_draft_policy',op.mode==='write'?'save_private_draft':'prepare_current_draft'],tools:[op.tool]},verification:{native_policy:true,executable:false,workflow_started:false,source_result_retained:false},ui_commands:[]};
}
function retain(result){const {automation_data,...safe}=result,answer='Workflowconceptactie verwerkt. Vraag het actuele eigen concept opnieuw op.';return {...safe,answer,display_text:answer,spoken_text:answer,actions:[],verification:{native_policy:true,executable:false,workflow_started:false,source_result_retained:false,current_source_recalculation_required:true}};}
module.exports={OPERATIONS,tools,execute,retain};
