'use strict';
(function(root){
 const fallback={inspect:'Run en voorwaarden verklaren',loading:'Bewaarde run controleren…',ready:'Uitlezing gereed.',failed:'Rungegevens konden niet worden opgehaald.',invalid:'De bewaarde runuitlezing kon niet worden bevestigd.',missing:'ontbreekt',omitted:'{type} (inhoud weggelaten)',truncated:'{value}… (ingekort)',true:'waar',false:'onwaar',and:'EN',or:'OF',not:'NIET',unconditional:'Geen voorwaarde: waar',comparison:'{field} · {operator} · waarde {actual}{expected} → {matched}',expected:' · verwacht {value}',group:'{kind} → {matched}',heading:'{name} · versie {version}',retained:'Bewaarde runstatus: {status}. De conditieverklaring gebruikt de bewaarde invoer. Acties zijn niet uitgevoerd of opnieuw geverifieerd.',choose:'Stap voor verklaring',step:'{index}. {type} · {status}',selected:'Status: {status} · pogingen: {attempts} · uitvoerregistratie: {output}',error:'Deze stap bevat een geregistreerde fout. De bewaarde diagnose is niet opnieuw geverifieerd.',wake:'Bewaard hervattijdstip (UTC): {time}'};
 const statuses=new Set(['RUNNING','PLANNED','PLANNED_INTERNAL','SUCCEEDED','ERROR','FAILED','BLOCKED','AWAITING_APPROVAL','WAITING_TIME','WAITING_RETRY','DEAD_LETTER','RECOVERY_READY','SKIPPED_CONDITION','NOT_REACHED']);
 const actions=new Set(['create_task','assign','notify','approved_communication','update_field','move_pipeline','create_document','create_invoice_draft','run_analysis','webhook','zero_task','approval_request','financial_posting','payment','filing','critical_setting','delay']);
 const operators=new Set(['eq','ne','gt','gte','lt','lte','exists','in']),outputs=new Set(['NONE','REPORTED_EXECUTED','REPORTED_NOT_EXECUTED','UNKNOWN']);
 const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
 function descriptor(d){
  if(!record(d)||typeof d.present!=='boolean')return false;
  if(!d.present)return d.type==='missing'&&d.value===undefined&&d.value_omitted===undefined&&d.truncated===undefined;
  if(d.type==='object'||d.type==='array')return d.value_omitted===true&&d.value===undefined&&d.truncated===undefined;
  if(d.value_omitted!==undefined)return false;
  if(d.type==='string')return typeof d.value==='string'&&d.value.length<=2000&&typeof d.truncated==='boolean';
  if(d.truncated!==undefined)return false;
  return d.type==='null'?d.value===null:d.type==='number'?typeof d.value==='number'&&Number.isFinite(d.value):d.type==='boolean'&&typeof d.value==='boolean';
 }
 function validTrace(n,depth=0,budget={nodes:0}){
  if(!record(n)||depth>5||++budget.nodes>200||typeof n.matched!=='boolean')return false;
  if(n.kind==='unconditional')return n.matched===true&&n.children===undefined;
  if(['all','any','not'].includes(n.kind)){
   if(!Array.isArray(n.children)||!n.children.length||n.children.length>20||n.kind==='not'&&n.children.length!==1||!n.children.every(c=>validTrace(c,depth+1,budget)))return false;
   return n.matched===(n.kind==='all'?n.children.every(c=>c.matched):n.kind==='any'?n.children.some(c=>c.matched):!n.children[0].matched);
  }
  if(n.kind!=='comparison'||n.children!==undefined||typeof n.field!=='string'||!/^(event|inputs)(?:\.[A-Za-z][A-Za-z0-9_]{0,79}){1,5}$/.test(n.field)||/(?:__proto__|constructor|prototype)/.test(n.field)||!operators.has(n.operator)||!descriptor(n.actual))return false;
  if(n.operator==='exists')return n.expected===undefined;
  const scalar=d=>descriptor(d)&&d.present===true&&!d.value_omitted;
  if(n.operator==='in')return Array.isArray(n.expected)&&n.expected.length>0&&n.expected.length<=100&&n.expected.every(scalar);
  return scalar(n.expected)&&(!['gt','gte','lt','lte'].includes(n.operator)||n.expected.type==='number');
 }
 function verified(data,run,step){
  if(!record(data)||data.run_id!==run.run_id||data.workflow_id!==run.automation_id||data.workflow_version!==run.workflow_version||typeof data.workflow_name!=='string'||!Number.isSafeInteger(data.workflow_version)||data.workflow_version<1||typeof data.request_signature!=='string'||!/^[a-f0-9]{64}$/.test(data.request_signature)||data.request_signature!==run.request_signature||!statuses.has(data.status)||data.read_only!==true||data.execution_performed!==false||data.outcome_reverified!==false||data.basis!=='CURRENT_AUTHORIZED_RETAINED_RUN_AND_IMMUTABLE_DEFINITION'||data.scope!=='CURRENT_AUTHORIZED_RUNS'||!Array.isArray(data.steps)||!data.steps.length||data.steps.length>100)return false;
  if(data.steps.some((s,index)=>!record(s)||s.index!==index||!actions.has(s.type)||!statuses.has(s.status)||typeof s.condition_matched!=='boolean'||!Number.isSafeInteger(s.attempts)||s.attempts<0))return false;
  const s=data.selected;if(!record(s)||!Number.isSafeInteger(s.index)||!data.steps[s.index]||step!==undefined&&s.index!==Number(step))return false;
  if(['type','status','condition_matched','attempts'].some(key=>s[key]!==data.steps[s.index][key])||!outputs.has(s.recorded_output)||!(s.error===null||typeof s.error==='string'&&s.error.length<=1000)||!(s.next_wakeup_at===null||typeof s.next_wakeup_at==='string'&&/^\d{4}-\d\d-\d\dT/.test(s.next_wakeup_at)&&/(?:Z|[+-]\d{2}:\d{2})$/.test(s.next_wakeup_at)&&Number.isFinite(Date.parse(s.next_wakeup_at))))return false;
  return validTrace(s.condition)&&s.condition.matched===s.condition_matched;
 }
 function create({document,run,request,isActive=()=>true}){
  const i18n=root.FoundlyI18n,el=tag=>document.createElement(tag),box=el('section'),inspect=el('button'),output=el('div'),notice=el('output'),chooser=el('div'),bindings=new Map();let generation=0,currentSelect=null;
  const active=()=>box.isConnected&&isActive(),number=value=>i18n?i18n.number(value):String(value);
  const copy=(key,params={})=>i18n?i18n.t('workflow.inspector.'+key,params):(fallback[key]||key).replace(/\{(\w+)\}/g,(_,name)=>String(params[name]));
  const status=value=>i18n?i18n.t('workflow.status.'+value.toLowerCase()):value,action=value=>i18n?i18n.t('workflow.action.'+value):value;
  function bind(node,read,group='output'){const entry={read,group,last:read()};node.textContent=entry.last;bindings.set(node,entry);return node;}
  const owned=(tag,read)=>bind(el(tag),read);
  const clear=(detailsOnly=false)=>{output.replaceChildren();if(!detailsOnly){currentSelect=null;chooser.replaceChildren();}for(const [node,entry]of bindings)if(entry.group==='output'||!detailsOnly&&entry.group==='selection')bindings.delete(node);};
  const message=key=>bind(notice,()=>copy(key),'control');
  inspect.type='button';notice.setAttribute('aria-live','polite');bind(inspect,()=>copy('inspect'),'control');box.append(inspect,notice,chooser,output);
  document.addEventListener?.('foundly:locale',()=>{if(!active())return;for(const [node,entry]of bindings)if(node.textContent===entry.last){entry.last=entry.read();node.textContent=entry.last;}});
  function scalar(d){
   if(!d.present)return copy('missing');if(d.value_omitted)return copy('omitted',{type:i18n?copy('type.'+d.type):d.type});
   const value=d.type==='number'?(i18n?i18n.number(d.value,{maximumSignificantDigits:21}):String(d.value)):d.type==='boolean'?copy(String(d.value)):JSON.stringify(d.value);return d.truncated?copy('truncated',{value}):value;
  }
  function trace(node,host){
   // Keep the live text in its own span; repainting a group must not destroy its children.
   const item=el('li');item.append(owned('span',()=>node.kind==='unconditional'?copy('unconditional'):node.kind==='comparison'?copy('comparison',{field:node.field,operator:i18n?copy('operator.'+node.operator):node.operator,actual:scalar(node.actual),expected:node.expected===undefined?'':copy('expected',{value:Array.isArray(node.expected)?node.expected.map(scalar).join(', '):scalar(node.expected)}),matched:copy(String(node.matched))}):copy('group',{kind:copy({all:'and',any:'or',not:'not'}[node.kind]),matched:copy(String(node.matched))})));host.append(item);
   if(node.children){const children=el('ul');item.append(children);node.children.forEach(n=>trace(n,children));}
  }
  async function load(step){
   if(!active()||step!==undefined&&!/^\d{1,3}$/.test(String(step)))return;const seq=++generation;inspect.disabled=true;clear(true);message('loading');
   try{
    const data=await request('/api/automation/runs/'+encodeURIComponent(run.run_id)+'/inspection'+(step===undefined?'':'?step='+step));if(!active()||seq!==generation)return;
    if(!verified(data,run,step))throw Object.assign(Error('invalid_inspection'),{invalidInspection:true});
    output.append(owned('h4',()=>copy('heading',{name:data.workflow_name,version:number(data.workflow_version)})),owned('p',()=>copy('retained',{status:status(data.status)})));
    for(const [node,entry]of bindings)if(entry.group==='selection')bindings.delete(node);chooser.replaceChildren();const label=el('label'),select=el('select');label.append(bind(el('span'),()=>copy('choose'),'selection'));for(const s of data.steps){const option=bind(el('option'),()=>copy('step',{index:number(s.index+1),type:action(s.type),status:status(s.status)}),'selection');option.value=String(s.index);select.append(option);}select.value=String(data.selected.index);currentSelect=select;label.append(select);chooser.append(label);select.addEventListener('change',()=>{if(currentSelect===select)return load(select.value);});
    const s=data.selected;output.append(owned('p',()=>copy('selected',{status:status(s.status),attempts:number(s.attempts),output:i18n?copy('output.'+s.recorded_output.toLowerCase()):s.recorded_output})));if(s.error)output.append(owned('p',()=>copy('error')));if(s.next_wakeup_at)output.append(owned('p',()=>copy('wake',{time:i18n?i18n.date(s.next_wakeup_at,{dateStyle:'medium',timeStyle:'medium',timeZone:'UTC'}):s.next_wakeup_at})));
    const list=el('ul');output.append(list);trace(s.condition,list);message('ready');
   }catch(error){if(active()&&seq===generation){clear();const denied=error.status===403||error.statusCode===403,auth=error.status===401||error.statusCode===401;bind(notice,()=>i18n&&(denied||auth)?i18n.t(denied?'common.access_denied':'identity.auth_required'):copy(error.invalidInspection?'invalid':'failed'),'control');}}
   finally{if(active()&&seq===generation)inspect.disabled=false;}
  }
  inspect.addEventListener('click',()=>{if(!inspect.disabled)return load();});return box;
 }
 root.FoundlyWorkflowInspector={create};
})(globalThis);
