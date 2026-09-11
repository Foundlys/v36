'use strict';
const crypto=require('node:crypto');
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fail=(code,message,statusCode=422)=>{throw Object.assign(Error(message),{code,statusCode});};
const OPERATIONS=Object.freeze({
 REVIEW_LIST:{tool:'communication_review_list',name:'Actuele verzendbeoordelingen bekijken',mode:'read',capabilities:['communication:drafts'],permission:'read'},
 SEND_PREVIEW:{tool:'communication_send_preview',name:'Exacte mailinhoud voorbereiden',mode:'read',capabilities:['communication:drafts','communication:threads'],permission:'write'},
 REVIEWERS:{tool:'communication_reviewers',name:'Bevoegde mailbeoordelaar zoeken',mode:'read',capabilities:['communication:drafts','communication:threads'],permission:'write'},
 PREPARE_REVIEW:{tool:'communication_prepare_review',name:'Mailbeoordeling aanvragen',mode:'write',capabilities:['communication:drafts','communication:threads'],permission:'write'},
 DECIDE_REVIEW:{tool:'communication_decide_review',name:'Toegewezen mailbeoordeling beslissen',mode:'write',capabilities:['communication:drafts','communication:threads'],permission:'approve'},
 CANCEL_REVIEW:{tool:'communication_cancel_review',name:'Eigen mailbeoordeling intrekken',mode:'write',capabilities:['communication:drafts'],permission:'write'},
 SUBMIT:{tool:'communication_submit_approved',name:'Exact goedgekeurde mail aanbieden',mode:'write',capabilities:['communication:drafts','communication:threads','communication:inbox'],permission:'write',external:true},
 REPLY_PREVIEW:{tool:'communication_reply_preview',name:'Brongebonden antwoord voorbereiden',mode:'read',capabilities:['communication:drafts','communication:inbox'],permission:'write'},
 CREATE_REPLY:{tool:'communication_create_reply',name:'Brongebonden antwoordconcept bewaren',mode:'write',capabilities:['communication:drafts','communication:inbox'],permission:'write'}
});
function tools(){return Object.entries(OPERATIONS).map(([operation,op])=>({tool_id:op.tool,name:op.name,engine:'communication',description:op.name+' via de actuele native Communication-policy; geen algemene provider- of modeluitvoering.',parameter_schema:{type:'object',properties:{operation:{type:'string',enum:[operation]},draft_id:{type:'string'},message_id:{type:'string'},review_id:{type:'string'},input:{type:'object'}},required:['operation','input'],additionalProperties:false},required_permissions:['communication:'+op.permission,...(op.external?['connectors:manage']:[])],risk_level:op.external?'HIGH_RISK':op.mode==='write'?'MEDIUM_RISK':'READ_ONLY',mode:op.mode,provider:'foundly_communication',timeout_ms:op.external?35000:3000,retry:{max_attempts:1},confirmation:op.mode==='write'?'explicit_native_policy':'never',handler:'communication_native',verification:'current_exact_native_source_policy_and_durable_receipt',audit:'source_free_reference'}));}
function validate(action){
 if(!action||typeof action!=='object'||Array.isArray(action)||Object.keys(action).some(key=>!['operation','draft_id','message_id','review_id','input'].includes(key))||!Object.hasOwn(OPERATIONS,action.operation)||!action.input||typeof action.input!=='object'||Array.isArray(action.input)||JSON.stringify(action).length>20000)fail('communication_zero_action_invalid','Kies een geldige Communication-actie met expliciete inhoud');
 const message=['REPLY_PREVIEW','CREATE_REPLY'].includes(action.operation),review=['DECIDE_REVIEW','CANCEL_REVIEW','SUBMIT'].includes(action.operation),valid=value=>typeof value==='string'&&value.length>0&&value.length<=200&&/^[A-Za-z0-9_.:-]+$/.test(value);
 if(!valid(action[message?'message_id':'draft_id'])||Object.hasOwn(action,message?'draft_id':'message_id')||review&&!valid(action.review_id)||!review&&Object.hasOwn(action,'review_id'))fail('communication_zero_source_required','Kies de actuele bron en eventuele beoordeling');
 const fields=({REVIEW_LIST:[],SEND_PREVIEW:['purpose'],REVIEWERS:['q','purpose'],REPLY_PREVIEW:['mode']})[action.operation];if(fields&&(Object.keys(action.input).some(key=>!fields.includes(key))||fields.some(key=>typeof action.input[key]!=='string')))fail('communication_zero_action_invalid','Ongeldige parameters voor deze leesactie');
 return OPERATIONS[action.operation];
}
function authorize(core,ctx,actor,action){const op=validate(action);core.resolver.assertTool(ctx,actor,op.tool);core.scope(ctx,actor,op.permission);for(const capability of op.capabilities)core.resolver.assertCapability(ctx,actor,capability,op.permission);if(op.external)require('./core-access-contracts').assertCorePermission(actor,'connectors:manage');core.get(ctx,actor,action.message_id?'messages':'drafts',action.message_id||action.draft_id);return op;}
async function execute(core,ctx,actor,action,{message,conversation_id,turn_id,prior=null,account,submissions}){
 const op=authorize(core,ctx,actor,action),request_hash=hash({message,action}),reference={operation:action.operation,tool_id:op.tool,draft_id:action.draft_id||null,message_id:action.message_id||null,review_id:action.review_id||null,request_hash};
 if(prior&&(prior.request_hash!==request_hash||prior.operation!==action.operation))fail('communication_zero_turn_conflict','Deze turn hoort bij een andere Communication-actie',409);
 const options={idempotency_key:hash(['COMMUNICATION_ZERO',actor.id,conversation_id,turn_id])},reviews=require('./communication-send-reviews'),replies=require('./communication-replies');let value;
 switch(action.operation){
  case 'REVIEW_LIST':value=reviews.list(core,ctx,actor,action.draft_id,account);value.items=value.items.map(row=>({...row,...submissions.reviewState(ctx,actor,action.draft_id,row),can_cancel:row.can_cancel&&!require('./communication-submissions').blocks(core,ctx,action.draft_id,row.basis_fingerprint)}));break;
  case 'SEND_PREVIEW':value=reviews.preview(core,ctx,actor,action.draft_id,action.input.purpose,account);break;
  case 'REVIEWERS':value=reviews.reviewers(core,ctx,actor,action.draft_id,action.input,account);break;
  case 'PREPARE_REVIEW':value=reviews.prepare(core,ctx,actor,action.draft_id,action.input,options,account);break;
  case 'DECIDE_REVIEW':case 'CANCEL_REVIEW':value=reviews.decide(core,ctx,actor,action.draft_id,action.review_id,action.input,options,account,action.operation==='CANCEL_REVIEW');break;
  case 'SUBMIT':value=await submissions.execute(ctx,actor,action.draft_id,action.review_id,action.input,options);break;
  case 'REPLY_PREVIEW':value=replies.preview(core,ctx,actor,action.message_id,action.input.mode,account);break;
  case 'CREATE_REPLY':value=replies.create(core,ctx,actor,action.message_id,action.input,options,account);break;
 }
 authorize(core,ctx,actor,action);
 const outcome=value.submission,answer=outcome?outcome.provider_acceptance===true?'De mailprovider heeft deze verzending geaccepteerd. Bezorging is niet geverifieerd.':outcome.provider_acceptance===null?'De verzenduitkomst is onbekend. De bewaarde poging vereist onderzoek; niet opnieuw verzenden.':'De provider heeft geen acceptatie bevestigd. Bekijk de bewaarde poging.':op.mode==='read'?'De actuele toegankelijke Communication-bron is opgehaald. Bekijk de inhoud en kies een expliciete vervolgactie.':'De Communication-actie is volgens de actuele bron- en beoordelingsregels vastgelegd. Er is geen mail verzonden.';
 return {ok:true,status:outcome?.provider_acceptance===null?'partial':'completed',answer,modules:['communicatie'],actions:op.mode==='write'?[{type:action.operation,tool_id:op.tool,status:outcome?.status||'RECORDED',deduplicated:Boolean(value.deduplicated),external_send:outcome?(outcome.provider_acceptance===null?null:outcome.status!=='NOT_SUBMITTED'):false}]:[],syncs:[],web:{used:false,sources:[],error:null},voice_mode:outcome?.provider_acceptance===null?'WARNING':op.mode==='write'?'SUCCESS':'ANALYSIS',plan:{goal:op.name,steps:['validate_current_native_source_policy',op.mode==='read'?'read_current_source':'execute_native_idempotent_action'],tools:[op.tool]},communication_data:value,communication_action_reference:reference,verification:{native_policy:true,delivery_verified:false,source_result_retained:false},ui_commands:[]};
}
function retain(result){const {communication_data,...safe}=result,answer='Communication-actie verwerkt. Vraag de actuele bron opnieuw op om de huidige toegankelijke inhoud en uitkomst te bekijken.';return {...safe,answer,display_text:answer,spoken_text:answer,actions:[],verification:{native_policy:true,current_source_recalculation_required:true,source_result_retained:false}};}
module.exports={OPERATIONS,tools,validate,authorize,execute,retain};
