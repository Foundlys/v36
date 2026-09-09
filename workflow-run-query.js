'use strict';
const fail=(code,message)=>{throw Object.assign(new Error(message),{code,statusCode:422});};
function privileged(actor){return actor.permissions.has('*')||actor.permissions.has('automation:manage');}
function visible(actor,row,collection='automation_runs'){
  if(privileged(actor))return true;if(!row)return false;
  if(['automation_tasks','automation_documents','automation_activations'].includes(collection))return row.owner_id===actor.id;
  return collection==='automations'?row.created_by===actor.id:row.actor_id===actor.id;
}
function queryRuns(core,ctx,actor,query={}){
  const limit=Number(query.limit??50),offset=Number(query.offset??0);
  if(!Number.isInteger(limit)||limit<1||limit>100||!Number.isInteger(offset)||offset<0||offset>25000)fail('automation_query_page_invalid','Gebruik maximaal honderd runs per pagina');
  const text=String(query.q||'').trim().toLowerCase();if(text.length>200)fail('automation_query_text_invalid','Zoektekst is te lang');
  const statuses=String(query.status||'').split(',').filter(Boolean).map(s=>s.toUpperCase());if(statuses.some(status=>!['RUNNING','SUCCEEDED','ERROR','BLOCKED','AWAITING_APPROVAL','WAITING_TIME','WAITING_RETRY','DEAD_LETTER','RECOVERY_READY'].includes(status)))fail('automation_query_status_invalid','Onbekende uitvoerstatus');
  const dates={};for(const key of ['from','to'])if(query[key]){if(typeof query[key]!=='string'||!/(?:Z|[+-]\d{2}:\d{2})$/.test(query[key])||!Number.isFinite(Date.parse(query[key])))fail('automation_query_date_invalid','Gebruik een geldig tijdstip met UTC-offset');dates[key]=Date.parse(query[key]);}if(dates.from!==undefined&&dates.to!==undefined&&dates.to<=dates.from)fail('automation_query_date_invalid','Einde moet na start liggen');
  const rows=core.bucket(ctx,'automation_runs').filter(row=>row&&typeof row==='object'&&typeof row.run_id==='string'&&visible(actor,row)&&(!statuses.length||statuses.includes(row.status))&&(!query.workflow_id||row.automation_id===query.workflow_id)&&(!query.event_id||row.event_id===query.event_id)&&(!query.actor_id||row.actor_id===query.actor_id)&&(query.retried!=='true'||row.status==='WAITING_RETRY'||Array.isArray(row.steps)&&row.steps.some(step=>Number(step?.attempts)>1))&&(dates.from===undefined||Date.parse(row.started_at)>=dates.from)&&(dates.to===undefined||Date.parse(row.started_at)<dates.to)&&(!text||[row.run_id,row.automation_id,row.event_id,row.status,...(Array.isArray(row.steps)?row.steps:[]).flatMap(step=>[step?.type,step?.status,step?.error])].some(value=>String(value||'').toLowerCase().includes(text))));
  rows.sort((a,b)=>(Date.parse(b.started_at)||0)-(Date.parse(a.started_at)||0)||String(b.run_id||'').localeCompare(String(a.run_id||'')));
  return {items:JSON.parse(JSON.stringify(rows.slice(offset,offset+limit).map(row=>({...row,steps:(Array.isArray(row.steps)?row.steps:[]).filter(step=>step&&typeof step==='object'),can_recover:row.actor_id===actor.id&&privileged(actor)})))),total:rows.length,limit,offset,next_offset:offset+limit<rows.length?offset+limit:null,can_manage:privileged(actor),retryable_actions:core.schema().automation.retryable_actions,scope:'CURRENT_AUTHORIZED_RUNS',search_scope:'RUN_WORKFLOW_EVENT_STEP_AND_ERROR_METADATA',read_only:true};
}
module.exports={visible,queryRuns};
