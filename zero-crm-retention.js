'use strict';
const crypto=require('node:crypto');
const NOTICE='Analyse uitgevoerd. Vraag opnieuw voor actuele toegankelijke brongegevens.';
const hash=value=>crypto.createHash('sha256').update(String(value)).digest('hex');
function isCrmRead(result){return Boolean(result?.crm_data&&result.modules?.includes('crm')&&!(result.actions||[]).length);}
const DOMAIN_TOOLS=new Set(['procurement_summary','sales_pipeline','calendar_agenda','communication_drafts','marketing_campaigns']);
const PLATFORM_TOOLS=new Set(['analysis_campaign_outcome','analysis_funnel','analysis_kpi','finance_report','knowledge_search','automation_status']);
function internalKind(result){
  if(!result||result.actions?.length)return null;const tools=result.plan?.tools||[];
  if(result.read_reference&&['DOMAIN','PLATFORM'].includes(result.read_reference.kind))return result.read_reference.kind;
  if(result.domain_data&&tools.length&&tools.every(tool=>DOMAIN_TOOLS.has(tool)))return 'DOMAIN';
  if(tools.length&&tools.every(tool=>PLATFORM_TOOLS.has(tool))&&['analysis_data','finance_data','knowledge_data','automation_data'].some(key=>result[key]))return 'PLATFORM';
  return null;
}
function isSourceRead(result){return isCrmRead(result)||Boolean(internalKind(result));}
function retainInternal(result,message){
  return {ok:result.ok,status:result.status,modules:[...(result.modules||[])],actions:[],syncs:[],web:{used:false,sources:[],error:null},voice_mode:result.voice_mode,answer:NOTICE,display_text:NOTICE,spoken_text:NOTICE,ui_commands:[],plan:{goal:'Actuele broninformatie opnieuw opvragen',steps:['read_current_sources'],tools:[...(result.plan?.tools||[])]},read_reference:result.read_reference||{kind:internalKind(result),module:result.modules?.[0],message_hash:hash(message)},verification:{read_only:true,current_source_recalculation_required:true,source_result_retained:false}};
}
function retain(result,message){
  if(result?.calendar_action_reference)return require('./calendar-zero').retain(result);
  if(result?.analysis_action_reference)return require('./analysis-actions-zero').retain(result);
  if(result?.sales_action_reference)return require('./sales-zero').retain(result);
  if(result?.automation_action_reference)return require('./workflow-zero').retain(result);
  if(result?.communication_action_reference)return require('./communication-zero').retain(result);
  if(!isCrmRead(result))return internalKind(result)?retainInternal(result,message):result;
  const previous=result.crm_data.read_reference,inventoryId=previous?.inventory_id||result.crm_data.inventory?.id||null;
  return {ok:result.ok,status:result.status,modules:['crm'],actions:[],syncs:[],web:{used:false,sources:[],error:null},voice_mode:result.voice_mode,answer:NOTICE,display_text:NOTICE,spoken_text:NOTICE,ui_commands:[],plan:{goal:'CRM-informatie opnieuw opvragen',steps:['read_current_crm'],tools:[...(result.plan?.tools||[])]},crm_data:{read_reference:{message_hash:previous?.message_hash||hash(message),inventory_id:inventoryId}},verification:{read_only:true,current_source_recalculation_required:true,source_result_retained:false}};
}
function audit(row){
  if(row?.result_snapshot?.calendar_action_reference||row?.result_snapshot?.analysis_action_reference||row?.result_snapshot?.sales_action_reference||row?.result_snapshot?.automation_action_reference||row?.result_snapshot?.communication_action_reference){const result=retain(row.result_snapshot);return {...row,plan:result.plan,response:result.answer,spoken_response:result.answer,actions:[],verification:result.verification,result_snapshot:result};}
  if(!isSourceRead(row?.result_snapshot))return row;
  const result=retain(row.result_snapshot,row.transcript||'');
  return {...row,plan:result.plan,response:NOTICE,spoken_response:NOTICE,verification:result.verification,result_snapshot:result};
}
function conversation(rows,audits,conversationId){
  return rows.map(row=>{
    if(row.role!=='assistant')return row;
    const matching=audits.filter(item=>item.conversation_id===conversationId&&item.timestamp===row.at&&item.owner_id===row.owner_id);
    if(['CRM_READ','INTERNAL_READ'].includes(row.retention_scope)||matching.some(item=>isSourceRead(item.result_snapshot)))return {...row,content:NOTICE};
    if(!row.retention_scope&&!matching.length)return {...row,content:'Dit oudere antwoord heeft geen verifieerbare bronverwijzing meer. Stel de vraag opnieuw.',source_access:'UNVERIFIED'};
    return row;
  });
}
function replayContext(reference,message,input={}){
  if(!reference||reference.message_hash!==hash(message))throw Object.assign(new Error('Deze turn hoort bij een andere CRM-vraag; gebruik een nieuwe turn.'),{code:'crm_turn_conflict',statusCode:409});
  const supplied=input.crm_inventory_id||input.inventory_id||input.crm?.inventory_id;
  if(reference.inventory_id&&supplied&&supplied!==reference.inventory_id)throw Object.assign(new Error('Deze turn hoort bij een andere voorraadselectie; gebruik een nieuwe turn.'),{code:'crm_turn_conflict',statusCode:409});
  return reference.inventory_id?{crm_inventory_id:reference.inventory_id}:{};
}
module.exports={isCrmRead,isSourceRead,internalKind,retain,audit,conversation,replayContext};
