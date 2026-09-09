'use strict';
const crypto=require('node:crypto');
const NOTICE='CRM-analyse uitgevoerd. Vraag opnieuw voor actuele toegankelijke brongegevens.';
const hash=value=>crypto.createHash('sha256').update(String(value)).digest('hex');
function isCrmRead(result){return Boolean(result?.crm_data&&result.modules?.includes('crm')&&!(result.actions||[]).length);}
function retain(result,message){
  if(!isCrmRead(result))return result;
  const previous=result.crm_data.read_reference,inventoryId=previous?.inventory_id||result.crm_data.inventory?.id||null;
  return {ok:result.ok,status:result.status,modules:['crm'],actions:[],syncs:[],web:{used:false,sources:[],error:null},voice_mode:result.voice_mode,answer:NOTICE,display_text:NOTICE,spoken_text:NOTICE,ui_commands:[],plan:{goal:'CRM-informatie opnieuw opvragen',steps:['read_current_crm'],tools:[...(result.plan?.tools||[])]},crm_data:{read_reference:{message_hash:previous?.message_hash||hash(message),inventory_id:inventoryId}},verification:{read_only:true,current_source_recalculation_required:true,source_result_retained:false}};
}
function audit(row){
  if(!isCrmRead(row?.result_snapshot))return row;
  const result=retain(row.result_snapshot,row.transcript||'');
  return {...row,plan:result.plan,response:NOTICE,spoken_response:NOTICE,verification:result.verification,result_snapshot:result};
}
function conversation(rows,audits,conversationId){
  return rows.map(row=>{
    if(row.role!=='assistant')return row;
    const matching=audits.filter(item=>item.conversation_id===conversationId&&item.timestamp===row.at&&item.owner_id===row.owner_id);
    if(row.retention_scope==='CRM_READ'||matching.some(item=>isCrmRead(item.result_snapshot)))return {...row,content:NOTICE};
    if(!row.retention_scope&&!matching.length)return {...row,content:'Dit oudere antwoord heeft geen verifieerbare bronverwijzing meer. Stel de vraag opnieuw.',source_access:'UNVERIFIED'};
    return row;
  });
}
function replayContext(reference,message,input={}){
  if(!reference||reference.message_hash!==hash(message))throw Object.assign(new Error('Deze turn hoort bij een andere CRM-vraag; gebruik een nieuwe turn.'),{code:'crm_turn_conflict',statusCode:409});
  const supplied=input.crm_inventory_id||input.inventory_id||input.crm?.inventory_id;
  if(supplied&&supplied!==reference.inventory_id)throw Object.assign(new Error('Deze turn hoort bij een andere voorraadselectie; gebruik een nieuwe turn.'),{code:'crm_turn_conflict',statusCode:409});
  return reference.inventory_id?{crm_inventory_id:reference.inventory_id}:{};
}
module.exports={isCrmRead,retain,audit,conversation,replayContext};
