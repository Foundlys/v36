'use strict';
// ZERO uses the same private draft store and compiler as the native editor.
// These operations never publish, activate or execute a workflow.
const crypto=require('node:crypto');
const {compile,contract}=require('./workflow-authoring');
const {validateWorkflow,validateRetryContracts}=require('./workflow-execution');
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fail=(code,message,statusCode=422)=>{throw Object.assign(Error(message),{code,statusCode});};
const OPERATIONS=Object.freeze({RUN_PREVIEW:{tool:'automation_run_preview',mode:'read',permission:'write',name:'Workflowuitvoering controleren'},RUN_SUBMIT:{tool:'automation_run',mode:'write',permission:'write',name:'Workflowuitvoering expliciet bevestigen'},INSPECT_RUN:{tool:'automation_run_inspect',mode:'read',permission:'read',name:'Bewaarde workflowrun verklaren'},GENERATE:{tool:'automation_draft_generate',mode:'read',permission:'write',name:'Workflowconcept uit een beschrijving voorbereiden'},PREVIEW:{tool:'automation_draft_preview',mode:'read',permission:'write',name:'Workflowconcept voorbereiden'},SAVE:{tool:'automation_draft_save',mode:'write',permission:'write',name:'Workflowconcept expliciet bewaren'},READ:{tool:'automation_draft_read',mode:'read',permission:'read',name:'Eigen workflowconcept bekijken'}});
function tools(){return Object.entries(OPERATIONS).map(([operation,op])=>({tool_id:op.tool,name:op.name,engine:'automation',description:operation.startsWith('RUN_')?'Controleer exacte workflowinvoer en start uitsluitend na afzonderlijke bevestiging via de native engine. Vereiste goedkeuring blijft afzonderlijk.':operation==='INSPECT_RUN'?'Verklaar een actuele toegankelijke bewaarde run zonder uitvoering of nieuwe resultaatverificatie.':op.name+' via de native private conceptopslag. Publiceert, activeert of start geen workflow.',parameter_schema:{type:'object',properties:{operation:{type:'string',enum:[operation]},[operation.startsWith('RUN_')?'workflow_id':operation==='INSPECT_RUN'?'run_id':'draft_id']:{type:'string'},input:{type:'object'}},required:['operation',operation.startsWith('RUN_')?'workflow_id':operation==='INSPECT_RUN'?'run_id':'draft_id','input'],additionalProperties:false},required_permissions:[...new Set(['automation:read','automation:'+op.permission])],risk_level:operation==='RUN_SUBMIT'?'CONTEXT_DEPENDENT':op.mode==='write'?'MEDIUM_RISK':'READ_ONLY',mode:op.mode,provider:'foundly_automation',timeout_ms:3000,retry:{max_attempts:1},confirmation:operation==='RUN_SUBMIT'?'explicit_run_then_native_approval':op.mode==='write'?'explicit_native_draft':'never',handler:operation.startsWith('RUN_')?'automation_run_native':'automation_draft_native',verification:operation.startsWith('RUN_')?'current_workflow_exact_input_and_native_outcome':operation==='INSPECT_RUN'?'current_retained_run':'current_private_draft_revision_and_compiler',audit:'source_free_reference'}));}
function validate(action){
 if(['RUN_PREVIEW','RUN_SUBMIT'].includes(action?.operation)){
  const allowed=action.operation==='RUN_SUBMIT'?['event','inputs','preview_fingerprint','confirm','reason']:['event','inputs'];if(typeof action!=='object'||Array.isArray(action)||Object.keys(action).some(k=>!['operation','workflow_id','input'].includes(k))||typeof action.workflow_id!=='string'||!/^[A-Za-z0-9_.:-]{1,200}$/.test(action.workflow_id)||!action.input||typeof action.input!=='object'||Array.isArray(action.input)||Object.keys(action.input).some(k=>!allowed.includes(k))||JSON.stringify(action).length>130000)fail('automation_zero_action_invalid','Kies een geldige workflow en expliciete uitvoerinvoer');return OPERATIONS[action.operation];
 }
 if(action?.operation==='INSPECT_RUN'){
  if(typeof action!=='object'||Array.isArray(action)||Object.keys(action).some(k=>!['operation','run_id','input'].includes(k))||typeof action.run_id!=='string'||!/^[A-Za-z0-9_.:-]{1,200}$/.test(action.run_id)||!action.input||typeof action.input!=='object'||Array.isArray(action.input)||Object.keys(action.input).some(k=>k!=='step')||Object.hasOwn(action.input,'step')&&(!Number.isInteger(action.input.step)||action.input.step<0||action.input.step>99))fail('automation_zero_action_invalid','Kies een geldige run en stap');return OPERATIONS.INSPECT_RUN;
 }
 if(!action||typeof action!=='object'||Array.isArray(action)||Object.keys(action).some(key=>!['operation','draft_id','input'].includes(key))||!Object.hasOwn(OPERATIONS,action.operation)||typeof action.draft_id!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(action.draft_id)||!action.input||typeof action.input!=='object'||Array.isArray(action.input)||JSON.stringify(action).length>130000)fail('automation_zero_action_invalid','Kies een geldige workflowconceptactie met expliciete invoer');
 const keys=action.operation==='READ'?[]:action.operation==='GENERATE'?['prompt','expected_revision']:action.operation==='PREVIEW'?['draft','expected_revision']:['draft','expected_revision','preview_fingerprint','confirm','reason'];
 if(Object.keys(action.input).some(key=>!keys.includes(key)))fail('automation_zero_action_invalid','Onbekende invoer voor workflowconcept');
 return OPERATIONS[action.operation];
}
function execute(drafts,platform,ctx,actor,action,{message,conversation_id,turn_id,prior=null}){
 const op=validate(action);if(action.operation==='GENERATE')fail('automation_zero_action_invalid','Taalvoorbereiding vereist de asynchrone providerroute');drafts.resolver.assertTool(ctx,actor,op.tool);drafts.scope(ctx,actor,op.permission);
 const request_hash=hash({message,action});if(prior&&(prior.request_hash!==request_hash||prior.operation!==action.operation))fail('automation_zero_turn_conflict','Deze turn hoort bij een ander workflowconceptverzoek',409);
 const reference={operation:action.operation,tool_id:op.tool,...(action.operation.startsWith('RUN_')?{workflow_id:action.workflow_id}:action.operation==='INSPECT_RUN'?{run_id:action.run_id}:{draft_id:action.draft_id}),request_hash};
 if(action.operation.startsWith('RUN_')){
  drafts.resolver.assertCapability(ctx,actor,'automation:runs','read');const input=action.input,preview=platform.previewAutomationRun(ctx,actor,action.workflow_id,{event:input.event,inputs:input.inputs}),fingerprint=hash({actor_id:actor.id,ctx,preview});let data,actions=[];
  if(action.operation==='RUN_PREVIEW')data={...preview,preview_fingerprint:fingerprint};
  else{
   if(input.confirm!==true||typeof input.reason!=='string'||!input.reason.trim()||input.reason.length>500||input.preview_fingerprint!==fingerprint)fail('automation_zero_confirmation_invalid','Bevestig de exact gecontroleerde workflowuitvoering');
   const run=platform.runAutomation(ctx,actor,action.workflow_id,preview.event,{inputs:preview.inputs});data={run,approval_is_separate:true};actions=[{type:'WORKFLOW_RUN',tool_id:op.tool,run_id:run.run_id,status:run.status,replayed:Boolean(run.replayed)}];
  }
  return {ok:true,status:'completed',modules:['automation'],answer:action.operation==='RUN_PREVIEW'?'Uitvoerinvoer gecontroleerd. Controleer de passende stappen en bevestig deze uitvoering afzonderlijk.':`Native workflowrun: ${data.run.status}. Eventuele vereiste goedkeuring blijft een afzonderlijke stap.`,automation_data:data,automation_action_reference:reference,actions,syncs:[],plan:{goal:op.name,tools:[op.tool]},verification:{native_policy:true,workflow_started:action.operation==='RUN_SUBMIT',source_result_retained:false,approval_bypass:false},ui_commands:[]};
 }
 if(action.operation==='INSPECT_RUN'){
  drafts.resolver.assertCapability(ctx,actor,'automation:runs','read');const value=platform.inspectAutomationRun(ctx,actor,action.run_id,action.input),step=value.selected;
  return {ok:true,status:'completed',modules:['automation'],answer:`Bewaarde run ${value.run_id}: ${value.status}. Stap ${step.index+1} (${step.type}): ${step.status}. De voorwaarde is ${step.condition_matched?'waar':'onwaar'} voor de bewaarde runinvoer. Pogingen: ${step.attempts}.${step.error?' Geregistreerde fout: '+step.error:''} Dit is een uitlezing; er is niets uitgevoerd en het resultaat is niet opnieuw geverifieerd.`,automation_data:value,automation_action_reference:reference,actions:[],syncs:[],plan:{goal:op.name,tools:[op.tool]},verification:{read_only:true,workflow_started:false,outcome_reverified:false,source_result_retained:false},ui_commands:[]};
 }
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
async function generate(drafts,platform,ctx,actor,action,meta,model){
 const op=validate(action);if(action.operation!=='GENERATE')fail('automation_zero_action_invalid','Kies taalgestuurde voorbereiding');
 const input=action.input;if(typeof input.prompt!=='string'||!input.prompt.trim()||input.prompt.length>4000||!Number.isInteger(input.expected_revision)||input.expected_revision<0)fail('automation_zero_action_invalid','Beschrijf de workflow in maximaal 4000 tekens met de huidige revisie');
 const request_hash=hash({message:meta.message,action});if(meta.prior&&(meta.prior.operation!=='GENERATE'||meta.prior.request_hash!==request_hash))fail('automation_zero_turn_conflict','Deze turn hoort bij een ander workflowverzoek',409);
 const actorId=actor.id;
 const check=()=>{drafts.resolver.assertTool(ctx,actor,op.tool);drafts.scope(ctx,actor,'write');if(actor.id!==actorId)fail('automation_zero_actor_changed','De gebruiker is gewijzigd',403);const row=drafts.list(ctx,actor).items.find(row=>row.id===action.draft_id);if(input.expected_revision!==(row?.revision||0))fail('workflow_draft_conflict','Het concept is gewijzigd; bereid opnieuw voor',409);};
 check();const spec=contract(platform.schema().automation);
 const prompt=require('./workflow-language').instructions(spec);
 let output;try{output=await model(prompt,JSON.stringify({request:input.prompt}));}catch{check();fail('automation_language_unavailable','De taalprovider is niet beschikbaar; er is geen concept gemaakt',503);}
 // Current identity, entitlement and revision must still hold after provider IO.
 check();if(!output)fail('automation_language_unavailable','De taalprovider is niet beschikbaar; er is geen concept gemaakt',503);
 const proposal=require('./workflow-language').parse(output,spec),proposal_hash=hash(proposal);
 if(meta.prior&&meta.prior.proposal_hash!==proposal_hash)fail('automation_language_proposal_changed','Het modelvoorstel is veranderd; bereid met een nieuwe turn opnieuw voor',409);
 const reference={operation:'GENERATE',tool_id:op.tool,draft_id:action.draft_id,request_hash,proposal_hash};
 if(proposal.questions)return {ok:false,status:'needs_input',modules:['automation'],answer:'Verduidelijk de beschrijving: '+proposal.questions.join(' '),automation_data:{questions:proposal.questions,inference:true,executable:false},automation_action_reference:reference,actions:[],syncs:[],plan:{goal:op.name,tools:[op.tool]},verification:{executable:false,workflow_started:false,source_result_retained:false},ui_commands:[]};
 const result=execute(drafts,platform,ctx,actor,{operation:'PREVIEW',draft_id:action.draft_id,input:{draft:proposal.draft,expected_revision:input.expected_revision}},{...meta,prior:null});
 return {...result,answer:'Modelvoorstel ter controle. Controleer trigger, stappen en voorwaarden; bevestig apart om het als privéconcept te bewaren.',automation_data:{...result.automation_data,draft_id:action.draft_id,inference:true},automation_action_reference:reference,plan:{goal:op.name,steps:['check_current_policy','generate_untrusted_proposal','compile_native_draft','review_before_separate_save'],tools:[op.tool]}};
}
function naturalAction(message,conversationId,turnId){
 const inspection=message.match(/^(?:inspecteer|inspect|verklaar|explain)\s+(?:workflow\s+)?run\s+([A-Za-z0-9_.:-]{1,200})(?:\s+(?:stap|step)\s+(\d{1,3}))?$/i);if(inspection)return {operation:'INSPECT_RUN',run_id:inspection[1],input:inspection[2]?{step:Number(inspection[2])-1}:{}};
 if(!/\b(maak|ontwerp|bouw|genereer|create|design|build|generate)\b[\s\S]{0,80}\b(workflow|automatisering)\b/i.test(message))return null;
 return {operation:'GENERATE',draft_id:'language-'+hash({conversationId,turnId}).slice(0,40),input:{prompt:message,expected_revision:0}};
}
module.exports={OPERATIONS,tools,execute,generate,naturalAction,retain};
