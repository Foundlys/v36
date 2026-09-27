'use strict';

const $=selector=>document.querySelector(selector);
const state={loadGeneration:0,accessGeneration:0,zeroGeneration:0,zeroBusy:false,exportBusy:false,eventsAllowed:false,loading:null,streamConnected:false,dashboard:null,platform:null,connectors:null,automation:null,stream:null,refreshTimer:null};
const KPI_ORDER=['conversion_rate','win_rate','roas','mer','pipeline_value','weighted_pipeline','gross_margin','sales_cycle'];
const KPI_NAMES={conversion_rate:'Conversion rate',win_rate:'Win rate',roas:'Return on ad spend',mer:'Marketing efficiency ratio',pipeline_value:'Pipeline value',weighted_pipeline:'Weighted pipeline',gross_margin:'Gross margin',sales_cycle:'Sales cycle'};
const STAGE_LABELS={ad_impression:'Advertentie',ad_click:'Klik',session_started:'Bezoek',form_submitted:'Formulier',lead_created:'Lead',lead_qualified:'Gekwalificeerd',appointment_scheduled:'Afspraak',quote_created:'Offerte',deal_won:'Deal',invoice_created:'Factuur',invoice_paid:'Betaald'};
const SOURCE_STATES=['UNKNOWN','UNCONFIGURED','CONFIGURED','AUTHORIZING','AUTHENTICATED','PROBING','SYNCING','CONNECTED','DEGRADED','ERROR','EXPIRED','DISCONNECTED','REALTIME','NEAR_REALTIME','BATCH','STALE','CONFIGURED_UNVERIFIED','NOT_AVAILABLE'];
const analysisCopy=(key,fallback,params={})=>globalThis.FoundlyI18n?FoundlyI18n.message('analysis.page.'+key,params):String(fallback).replace(/\{([a-z_]+)\}/g,(_,name)=>String(params[name]??''));
const analysisLive=read=>Object.freeze({toString:read});
const analysisUnknown=()=>globalThis.FoundlyI18n?FoundlyI18n.message('common.unknown'):'Onbekend';
const analysisValue=value=>analysisCopy('value','{value}',{value});
function analysisRender(node,value){if(globalThis.FoundlyI18n)FoundlyI18n.renderText(node,value);else node.textContent=String(value??'');return node;}
function analysisElement(tag,value='',className){const node=analysisRender(document.createElement(tag),value);if(className)node.className=className;return node;}
const validCount=value=>Number.isSafeInteger(value)&&value>=0;
const analysisNumber=(value,count=false,options={})=>analysisLive(()=>typeof value==='number'&&Number.isFinite(value)&&(!count||validCount(value))?new Intl.NumberFormat(globalThis.FoundlyI18n?.locale||'nl-NL',options).format(value):String(analysisUnknown()));
const analysisState=value=>SOURCE_STATES.includes(value)?analysisCopy('state.'+value.toLowerCase(),value):analysisUnknown();
const analysisError=error=>globalThis.FoundlyI18n?FoundlyI18n.message(error.status===401?'identity.auth_required':FoundlyI18n.errorKey(error.code??error.data?.code,error.status)):String(error.message||'');

async function api(path,options={}){
 const response=await fetch(path,{...options,headers:{accept:'application/json',...(options.body?{'content-type':'application/json'}:{}),...(options.headers||{})}});
 const text=await response.text();let data={};try{data=text?JSON.parse(text):{};}catch{data={error:text||`HTTP ${response.status}`};}
 if(!response.ok)throw Object.assign(new Error(data.error||data.code||`HTTP ${response.status}`),{status:response.status,code:data.code,data});return data;
}
function formatDate(value,options={dateStyle:'short',timeStyle:'medium'}){return analysisLive(()=>typeof value==='string'&&value.trim()&&Number.isFinite(Date.parse(value))?new Intl.DateTimeFormat(globalThis.FoundlyI18n?.locale||'nl-NL',{...options,timeZone:'UTC'}).format(new Date(value)):String(analysisUnknown()));}
function formatMetric(metric){
 if(metric?.available!==true||typeof metric.value!=='number'||!Number.isFinite(metric.value))return {value:globalThis.FoundlyI18n?FoundlyI18n.message('common.no_data'):'Geen brondata',meta:analysisCopy('source_unavailable','Geen beschikbare brondata')};
 const value=metric.value,meta=analysisCopy('source_count','Bronrecords: {value}',{value:analysisNumber(metric.drilldown?.source_count,true)});
 if(metric.unit==='PERCENT')return {value:analysisValue(analysisNumber(value/100,false,{style:'percent',maximumFractionDigits:2})),meta};
 if(metric.unit==='RATIO')return {value:analysisCopy('ratio','{value}×',{value:analysisNumber(value,false,{maximumFractionDigits:2})}),meta};
 if(metric.unit==='CENTS')return {value:analysisCopy('minor_units','{value} kleinste valuta-eenheden',{value:analysisNumber(value,false,{maximumFractionDigits:4})}),meta};
 if(metric.unit==='DAYS'||metric.unit==='SECONDS')return {value:analysisCopy(metric.unit==='DAYS'?'days':'seconds',metric.unit==='DAYS'?'{value} dagen':'{value} sec.',{value:analysisNumber(value,false,{maximumFractionDigits:2})}),meta};
 return {value:analysisValue(analysisNumber(value,false,{maximumFractionDigits:2})),meta};
}
function query(){
 const params=new URLSearchParams({seconds:$('#analysisWindow').value}),from=$('#analysisFrom').value,to=$('#analysisTo').value,campaign=$('#analysisCampaign').value.trim();
 if(from)params.set('from',`${from}T00:00:00.000Z`);if(to)params.set('to',`${to}T23:59:59.999Z`);if(campaign)params.set('campaign_id',campaign);return params;
}
function unavailable(name){const component=state.loading?.components?.[name];return component?.status==='DISABLED'?analysisCopy('disabled','Dit onderdeel is uitgeschakeld of niet beschikbaar binnen je toegang.'):component?.status==='ERROR'?analysisCopy('component_error','Dit onderdeel kon niet laden: {reason}',{reason:analysisError({status:component.status_code})}):null;}
function renderConnection(){const node=$('#analysisConnection');node.className=state.streamConnected?'status-pill live':'status-pill';analysisRender(node,state.streamConnected?analysisCopy('stream_connected','EVENTSTREAM VERBONDEN'):state.loading?.status==='PARTIAL'?analysisCopy('partial_status','DEELS BESCHIKBAAR'):analysisCopy('api_reachable','API BEREIKBAAR'));}
function renderKpis(){
 const host=$('#analysisKpis'),kpis=state.dashboard?.kpis||{};host.replaceChildren();
 for(const id of KPI_ORDER){const metric=kpis[id],reason=unavailable('kpi:'+id),formatted=reason?{value:analysisCopy('unavailable','Niet beschikbaar'),meta:reason}:formatMetric(metric),card=analysisElement('article','','kpi-card'+(metric?.available===true&&!reason?'':' unavailable'));
  const title=!metric?.kpi?.name||metric.kpi.version===1&&metric.kpi.name===KPI_NAMES[id]?analysisCopy('kpi.'+id,KPI_NAMES[id]):metric.kpi.name;
  card.append(analysisElement('h2',title),analysisElement('strong',formatted.value,'kpi-value'),analysisElement('span',analysisCopy('metric_meta','v{version} · {details}',{version:analysisNumber(metric?.kpi?.version,true),details:formatted.meta}),'kpi-meta'));host.append(card);
 }
}
function renderFunnel(){
 const host=$('#analysisFunnel'),reason=unavailable('funnel');host.replaceChildren();if(reason){host.append(analysisElement('div',reason,'empty'));analysisRender($('#funnelSource'),analysisCopy('unavailable','Niet beschikbaar'));return;}
 const funnel=state.dashboard?.funnel,stages=Array.isArray(funnel?.stages)?funnel.stages:[];
 analysisRender($('#funnelSource'),analysisCopy('events','Events: {value}',{value:analysisNumber(funnel?.events,true)}));
 if(!stages.length){host.append(analysisElement('div',Array.isArray(funnel?.stages)?analysisCopy('funnel_empty','Nog geen canonical journey-events. Koppel een echte bron of registreer interne business-events om de funnel te vullen.'):analysisCopy('source_unavailable','Geen beschikbare brondata'),'empty'));return;}
 const maximum=Math.max(1,...stages.filter(stage=>validCount(stage.count)).map(stage=>stage.count));
 for(const stage of stages){const row=analysisElement('div','','funnel-row'),label=Object.hasOwn(STAGE_LABELS,stage.stage)?analysisCopy('stage.'+stage.stage,STAGE_LABELS[stage.stage]):stage.stage;row.append(analysisElement('label',label));
  if(validCount(stage.count)){const meter=analysisElement('meter',analysisValue(analysisNumber(stage.count,true)));meter.min=0;meter.max=maximum;meter.value=stage.count;row.append(meter);}else row.append(analysisElement('span',analysisUnknown()));
  row.append(analysisElement('output',analysisValue(analysisNumber(stage.count,true))));host.append(row);
 }
}
function renderEvents(){
 const host=$('#analysisEvents'),reason=unavailable('realtime');host.replaceChildren();if(reason){host.append(analysisElement('div',reason,'empty'));analysisRender($('#eventFreshness'),analysisCopy('unavailable','Niet beschikbaar'));return;}
 const realtime=state.dashboard?.realtime,events=Array.isArray(realtime?.latest)?realtime.latest:[],fresh=realtime?.freshness;
 analysisRender($('#eventFreshness'),fresh?analysisCopy('freshness','{state} · {seconds} sec.',{state:analysisState(fresh.classification),seconds:analysisNumber(fresh.freshness_seconds,true)}):analysisCopy('freshness_unknown','Actualiteit onbekend'));
 for(const event of events.slice(0,12)){const row=analysisElement('div','','stack-row'),time=analysisElement('time',analysisCopy('time','{value} UTC',{value:formatDate(event.received_at)}));if(typeof event.received_at==='string')time.setAttribute('datetime',event.received_at);row.append(analysisElement('strong',event.event_name),time,analysisElement('span',event.source||event.provider||analysisUnknown(),'mono'),analysisElement('span',event.event_id,'mono'));host.append(row);}
 if(!events.length)host.append(analysisElement('div',Array.isArray(realtime?.latest)?analysisCopy('events_empty','Geen realtime events in het gekozen venster.'):analysisCopy('source_unavailable','Geen beschikbare brondata'),'empty'));
}
function renderHistory(){
 const host=$('#analysisHistory'),empty=$('#analysisHistoryEmpty'),reason=unavailable('historical');host.replaceChildren();if(reason){analysisRender($('#rollupCount'),analysisCopy('unavailable','Niet beschikbaar'));empty.classList.remove('hidden');analysisRender(empty,reason);return;}
 const rows=Array.isArray(state.dashboard?.historical?.rollups)?state.dashboard.historical.rollups:[];analysisRender($('#rollupCount'),analysisCopy('buckets','Tijdvakken: {value}',{value:analysisNumber(Array.isArray(state.dashboard?.historical?.rollups)?rows.length:null,true)}));
 for(const row of rows.slice(-200).reverse()){const tr=analysisElement('tr');for(const value of [analysisValue(formatDate(row.date,{dateStyle:'medium'})),row.event_name,row.source||analysisUnknown(),analysisValue(analysisNumber(row.events,true)),analysisCopy('time','{value} UTC',{value:formatDate(row.last_received_at)})])tr.append(analysisElement('td',value));host.append(tr);}
 empty.classList.toggle('hidden',rows.length>0);analysisRender(empty,rows.length?'':Array.isArray(state.dashboard?.historical?.rollups)?analysisCopy('history_empty','Geen historische rollups binnen het gekozen bereik.'):analysisCopy('source_unavailable','Geen beschikbare brondata'));
}
function sourceCard(name,status,details){const card=analysisElement('div','','source-card');card.append(analysisElement('strong',name),analysisElement('span',analysisState(status),'source-state'+(status==='CONNECTED'?' connected':'')),analysisElement('span',details));return card;}
function providerVerified(row){return row?.connected===true&&row.authenticated===true&&row.probe_ok===true&&row.initial_sync_ok===true;}
function renderSources(){
 const providers=state.platform?.providers||{},connectors=Array.isArray(state.connectors?.items)?state.connectors.items:[],host=$('#analysisSources'),platformReason=unavailable('platform'),realtimeReason=unavailable('realtime'),connectorsReason=unavailable('connectors');host.replaceChildren();
 host.append(sourceCard('Foundly Event Gateway',realtimeReason?'NOT_AVAILABLE':state.dashboard?.realtime?.freshness?.classification||'UNKNOWN',realtimeReason||analysisCopy('window_events','Events in venster: {value}',{value:analysisNumber(state.dashboard?.realtime?.events,true)})));
 for(const [id,name]of [['meta','Meta'],['google','Google']]){const row=providers[id],verified=providerVerified(row),status=platformReason?'NOT_AVAILABLE':verified?'CONNECTED':row?.configured===true?'CONFIGURED_UNVERIFIED':row?.configured===false&&row.connected===false?'UNCONFIGURED':'UNKNOWN';host.append(sourceCard(analysisCopy('measurement','{provider} measurement',{provider:name}),status,platformReason||(verified?analysisCopy('connection_verified','Probe en initiële sync bewezen'):analysisCopy('connection_unverified','Geen providerverbinding geclaimd'))));}
 if(connectorsReason)host.append(sourceCard(analysisCopy('connector_status','Connectorstatus'),'NOT_AVAILABLE',connectorsReason));
 else for(const row of connectors.slice(0,9)){const status=row.state==='CONNECTED'&&!providerVerified(row)?'UNKNOWN':row.state;host.append(sourceCard(row.provider,status,row.last_sync_at?analysisCopy('sync','Syncwaarneming: {value} UTC',{value:formatDate(row.last_sync_at)}):analysisCopy('no_sync','Nog geen bewezen sync')));}
}
function renderAutomation(){
 const host=$('#analysisAutomationContent'),reason=unavailable('automation');host.replaceChildren();if(reason){host.append(analysisElement('div',reason,'empty'));return;}
 const data=state.automation||{},rows=[['workflows','Workflowversies',analysisValue(analysisNumber(data.workflow_count,true))],['runs','Runs',analysisValue(analysisNumber(data.run_count,true))],['approvals','Wacht op goedkeuring',analysisValue(analysisNumber(data.awaiting_approval,true))],['failures','Fouten',analysisValue(analysisNumber(data.failed,true))],['adapter','Execution adapter',data.execution_adapter||analysisUnknown()]];
 for(const [key,label,value]of rows){const row=analysisElement('div','','stack-row');row.append(analysisElement('strong',analysisCopy(key,label)),analysisElement('span',value));host.append(row);}
}
function clearAnalysisObservations(){
 state.accessGeneration++;state.zeroGeneration++;state.eventsAllowed=false;state.loading=state.dashboard=state.platform=state.connectors=state.automation=null;
 for(const id of ['analysisKpis','analysisFunnel','analysisEvents','analysisHistory','analysisSources','analysisAutomationContent','analysisZeroOutput'])$('#'+id).replaceChildren();
 for(const id of ['funnelSource','eventFreshness','rollupCount'])analysisRender($('#'+id),analysisCopy('unavailable','Niet beschikbaar'));
 analysisRender($('#analysisHistoryEmpty'),'');$('#analysisHistoryEmpty').classList.add('hidden');$('#exportEvents').disabled=true;
}
async function load(){
 await globalThis.FoundlyI18n?.ready;const generation=++state.loadGeneration,notice=$('#analysisNotice');notice.className='notice';analysisRender(notice,analysisCopy('loading','Canonical analytics laden…'));
 try{
  const loaded=await window.FoundlyAnalysisLoading.load(api,query(),KPI_ORDER);if(generation!==state.loadGeneration)return;
  state.loading=loaded;Object.assign(state,{dashboard:loaded.dashboard,platform:loaded.platform,connectors:loaded.connectors,automation:loaded.automation});
  const deniedRead=part=>part?.status==='ERROR'&&[401,403].includes(part.status_code),eventDenied=['realtime','historical'].some(name=>deniedRead(loaded.components?.[name])),accessChanged=Object.values(loaded.components||{}).some(deniedRead)||state.eventsAllowed&&loaded.events_enabled!==true;
  if(accessChanged){state.accessGeneration++;state.zeroGeneration++;analysisRender($('#analysisZeroOutput'),'');}state.eventsAllowed=loaded.events_enabled===true&&!eventDenied;$('#exportEvents').disabled=!state.eventsAllowed||state.exportBusy;
  const cohortsAllowed=loaded.cohorts_enabled===true&&state.eventsAllowed;cohortView.setEnabled(cohortsAllowed,loaded.cohorts_writable);modelView.setEnabled(loaded.models_enabled,loaded.cohorts_writable,cohortsAllowed);actionView.setEnabled(cohortsAllowed,loaded.cohorts_writable);
  renderKpis();renderFunnel();renderEvents();renderHistory();renderSources();renderAutomation();
  notice.className=loaded.status==='PARTIAL'?'notice error':'notice';analysisRender(notice,loaded.status==='PARTIAL'?analysisCopy('partial','Een of meer onderdelen konden niet laden; de beschikbare gegevens staan hieronder.'):analysisCopy('loaded','Analytics geladen · {time} UTC. {persistence}',{time:formatDate(loaded.observed_at),persistence:state.platform?.persistence?.durable===true?analysisCopy('durable','Duurzame opslag bewezen.'):analysisCopy('durability_unverified','Duurzame productieopslag niet bewezen.')}));
  if(state.eventsAllowed){if(!state.stream)connectStream();}else{state.stream?.close();state.stream=null;state.streamConnected=false;}renderConnection();
 }catch(error){
  if(generation!==state.loadGeneration)return;cohortView.setEnabled(false);modelView.setEnabled(false);actionView.setEnabled(false);state.stream?.close();state.stream=null;state.streamConnected=false;clearAnalysisObservations();
  notice.className='notice error';analysisRender(notice,analysisCopy('load_failed','Analysis niet beschikbaar: {reason}',{reason:analysisError(error)}));$('#analysisConnection').className='status-pill error';analysisRender($('#analysisConnection'),error.status===401?analysisCopy('auth_required','AANMELDEN VEREIST'):analysisCopy('error_status','FOUT'));
 }
}
function scheduleRefresh(){clearTimeout(state.refreshTimer);state.refreshTimer=setTimeout(load,500);}
function connectStream(){if(!window.EventSource)return;state.stream?.close();const stream=new EventSource('/api/platform/events/stream');state.stream=stream;state.streamConnected=false;stream.addEventListener('platform.event',()=>{if(state.stream===stream)scheduleRefresh();});stream.addEventListener('ready',()=>{if(state.stream!==stream)return;state.streamConnected=true;renderConnection();});stream.onerror=()=>{if(state.stream!==stream)return;state.streamConnected=false;renderConnection();};}
async function exportEvents(){
 if(state.exportBusy||!state.eventsAllowed)return;state.exportBusy=true;$('#exportEvents').disabled=true;const generation=state.accessGeneration;
 try{const result=await api('/api/platform/exports',{method:'POST',body:JSON.stringify({scope:'events',format:'CSV'})});if(generation!==state.accessGeneration||!state.eventsAllowed)return;
  const blob=new Blob([result.content],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download=`foundly-events-${new Date().toISOString().slice(0,10)}.csv`;anchor.click();URL.revokeObjectURL(url);analysisRender($('#analysisNotice'),analysisCopy('exported','Tenantgebonden eventrecords geëxporteerd en geaudit: {value}',{value:analysisNumber(result.count,true)}));
 }catch(error){if(generation===state.accessGeneration){$('#analysisNotice').className='notice error';analysisRender($('#analysisNotice'),analysisCopy('export_failed','Export mislukt: {reason}',{reason:analysisError(error)}));}}finally{state.exportBusy=false;$('#exportEvents').disabled=!state.eventsAllowed;}
}
async function askZero(event){
 event.preventDefault();const input=$('#analysisZeroInput'),message=input.value.trim();if(!message||state.zeroBusy||!state.loading)return;input.value='';state.zeroBusy=true;const generation=++state.zeroGeneration,access=state.accessGeneration;analysisRender($('#analysisZeroOutput'),analysisCopy('zero_pending','ZERO onderzoekt je vraag…'));
 try{const result=await api('/api/zero/turn',{method:'POST',body:JSON.stringify({message,conversation_id:sessionStorage.foundlyAnalysisConversation||(sessionStorage.foundlyAnalysisConversation=crypto.randomUUID()),turn_id:crypto.randomUUID(),preferred_module:'analysis',client_context:{surface:'analysis',cohort_definition:cohortView.selectedDefinition(),timezone:Intl.DateTimeFormat().resolvedOptions().timeZone}})});if(generation===state.zeroGeneration&&access===state.accessGeneration)analysisRender($('#analysisZeroOutput'),result.display_text||result.answer);
 }catch(error){if(generation===state.zeroGeneration&&access===state.accessGeneration)analysisRender($('#analysisZeroOutput'),analysisError(error));}finally{state.zeroBusy=false;}
}

$('#refreshAnalysis').addEventListener('click',load);$('#exportEvents').addEventListener('click',exportEvents);$('#analysisZeroForm').addEventListener('submit',askZero);window.addEventListener('beforeunload',()=>state.stream?.close());
const cohortView=window.FoundlyCohortUI.mount(document,api),actionConversation=crypto.randomUUID();
const actionView=window.FoundlyAnalysisActions.create({document,request:api,zeroRequest:async(action,turn)=>{const response=await api('/api/zero/turn',{method:'POST',body:JSON.stringify({message:'Gekozen Analysis-actie',conversation_id:actionConversation,turn_id:turn,preferred_module:'analysis',client_context:{analysis_action:action}})});if(!response.analysis_action_data)throw Error('Het actuele Analysis-resultaat ontbreekt.');return response.analysis_action_data;}});document.getElementById('analysisActions').append(actionView);
const modelView=window.FoundlyAnalysisModels.create({document,request:api,onPropose:selection=>actionView.propose(selection)});document.getElementById('analysisModels').append(modelView);load();
