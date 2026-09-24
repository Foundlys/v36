'use strict';

const $=(selector,root=document)=>root.querySelector(selector),$$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const escapeHtml=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const state={crmAccessGeneration:0,schemaGeneration:0,recordsGeneration:0,pipelinesGeneration:0,boardGeneration:0,customerGeneration:0,automationsGeneration:0,zeroGeneration:0,zeroBusy:false,recordEditor:null,formWrites:{},formNotices:{},actionWrites:{},actionFeedback:{},dashboardGeneration:0,dashboardAccessGeneration:0,statusGeneration:0,dashboardSaving:false,dashboardRequest:null,schema:null,summary:null,analytics:null,dashboard:null,pipelines:[],board:null,entity:'leads',records:[],editing:false,changeToken:null,polling:false,lastDashboardRefresh:0};
const ENTITY_LABELS={leads:'Leads',contacts:'Contacten',companies:'Bedrijven',deals:'Deals',opportunities:'Opportunities',tasks:'Taken',appointments:'Afspraken',activities:'Activiteiten',notes:'Notities',calls:'Calls',emails:'E-mails',messages:'Berichten',segments:'Segmenten',products:'Producten',vehicles:'Voertuigen',quotes:'Offertes',orders:'Orders',campaigns:'Campagnes'};
const PRIMARY_FIELD={deals:'title',opportunities:'title',tasks:'title',appointments:'title',activities:'type',notes:'content',quotes:'number',orders:'number'};

async function api(path,options={}){
  const response=await fetch(path,{...options,headers:{accept:'application/json',...(options.body?{'content-type':'application/json'}:{}),...(options.headers||{})}}),text=await response.text();let data={};try{data=text?JSON.parse(text):{}}catch{data={error:text||`HTTP ${response.status}`}}
  if(!response.ok){const error=Object.assign(new Error(data.error||data.code||`HTTP ${response.status}`),{status:response.status,code:data.code,data});if([401,403].includes(response.status))invalidateCrmAccess(error);throw error;}return data;
}
function invalidateCrmAccess(error){
 state.crmAccessGeneration++;
 if(state.pipelineRequest)state.pipelineRequest.paused=true;
 state.pipelineRequest=state.pipelineRun=null;state.pipelineBusy=false;state.pipelineEditor=null;
 const pipelineForm=$('#pipelineForm'),profileForm=$('#provisionForm');pipelineForm.reset?.();
 if(pipelineForm.elements?.name)pipelineForm.elements.name.disabled=false;
 $('#pipelineStages').replaceChildren();$('#pipelineCreateNotice').hidden=true;
 if($('#pipelineDialog').open)$('#pipelineDialog').close();
 for(const {node,disabled}of state.provisionRequest?.controls||[])node.disabled=disabled;
 state.provisionRequest=state.provisionRun=null;state.provisionBusy=false;profileForm.reset?.();
 for(const form of [pipelineForm,profileForm]){const submit=form.querySelector('button[type="submit"]');if(submit)submit.disabled=false;}
 if(state.provisionNotice)crmRender(state.provisionNotice,crmError(error));
 state.actionWrites={};state.actionFeedback={};for(const kind of ['archive','stage']){crmActionHost(kind).replaceChildren();crmActionControls(kind);}for(const item of Object.values(state.formWrites)){crmFormControls(item.form,false,false);crmRender(item.notice,crmError(error));}state.formWrites={};for(const key of ['schemaGeneration','recordsGeneration','pipelinesGeneration','boardGeneration','customerGeneration','automationsGeneration','zeroGeneration'])state[key]++;state.schema=state.board=state.recordEditor=null;state.records=[];state.pipelines=[];state.zeroBusy=false;
 for(const id of ['recordRows','pipelineSelect','pipelineBoard','customer360','automationList','schemaSummary','customObjectWorkspace','nativeFieldsWorkspace','zeroOutput'])$('#'+id).replaceChildren();
 for(const id of ['recordDialog','customerDialog','nativeFieldsDialog','widgetDialog']){const dialog=$('#'+id);if(dialog.open)dialog.close();}$('#recordForm').reset?.();
 crmRender($('#recordEmpty'),crmError(error));$('#recordEmpty').classList.remove('hidden');invalidateDashboard(error,state.dashboardGeneration);
}
function toast(message,error=false){const node=$('#toast');crmRender(node,message);node.className=error?'show error':'show';clearTimeout(toast.timer);toast.timer=setTimeout(()=>node.className='',3800)}
function formatDate(value){if(!value)return '—';const date=new Date(value),dateOnly=/^\d{4}-\d{2}-\d{2}$/.test(String(value));return Number.isNaN(date.getTime())?'—':new Intl.DateTimeFormat((globalThis.FoundlyI18n?.locale||'nl-NL'),dateOnly?{dateStyle:'medium',timeZone:'UTC'}:{dateStyle:'medium',timeStyle:'short'}).format(date)}
function formatMetric(metric){
 const locale=globalThis.FoundlyI18n?.locale||'nl-NL',number=value=>typeof value==='number'&&Number.isFinite(value),missing=()=>({value:globalThis.FoundlyI18n?.t('common.no_data')||'Geen data',unit:'',available:false});
 if(metric?.available!==true||!number(metric.value)||metric.unit==='count'&&(!Number.isSafeInteger(metric.value)||metric.value<0))return missing();
 if(metric.unit==='currency'){if(typeof metric.currency==='string'&&/^[A-Z]{3}$/.test(metric.currency))return {value:new Intl.NumberFormat(locale,{style:'currency',currency:metric.currency,maximumFractionDigits:2}).format(metric.value),unit:'',available:true};return {value:new Intl.NumberFormat(locale,{maximumFractionDigits:2}).format(metric.value),unit:globalThis.FoundlyI18n?.t('crm.dashboard.currency_unknown')||'Valuta niet vermeld',available:true};}
 if(metric.unit==='percent')return {value:new Intl.NumberFormat(locale,{style:'percent',maximumFractionDigits:1}).format(metric.value/100),unit:'',available:true};
 if(['days','hours'].includes(metric.unit))return {value:new Intl.NumberFormat(locale,{style:'unit',unit:metric.unit==='days'?'day':'hour',unitDisplay:'short',maximumFractionDigits:1}).format(metric.value),unit:'',available:true};
 return {value:new Intl.NumberFormat(locale,{maximumFractionDigits:metric.unit==='count'?0:1}).format(metric.value),unit:metric.unit==='count'?'':metric.unit||'',available:true};
}
const crmCopy=(key,fallback,params={})=>globalThis.FoundlyI18n?FoundlyI18n.message('crm.dashboard.'+key,params):String(fallback).replace(/\{([a-z_]+)\}/g,(_,name)=>String(params[name]??''));
const crmLive=read=>Object.freeze({toString:read}),crmUnknown=()=>globalThis.FoundlyI18n?FoundlyI18n.message('common.unknown'):'Onbekend',crmNoData=()=>globalThis.FoundlyI18n?FoundlyI18n.message('common.no_data'):'Geen brondata';
const crmValue=value=>crmCopy('value','{value}',{value}),crmFinite=value=>typeof value==='number'&&Number.isFinite(value),crmCount=value=>Number.isSafeInteger(value)&&value>=0;
const crmNumber=(value,count=false)=>crmLive(()=>((count?crmCount:crmFinite)(value)?new Intl.NumberFormat(globalThis.FoundlyI18n?.locale||'nl-NL',{maximumFractionDigits:count?0:2}).format(value):String(crmUnknown())));
const crmMoney=row=>crmLive(()=>{const value=formatMetric({available:true,value:row?.value,unit:'currency',currency:row?.currency});return value.available?[value.value,value.unit].filter(Boolean).join(' · '):String(crmUnknown());});
const crmDate=value=>crmLive(()=>typeof value==='string'&&value&&Number.isFinite(Date.parse(value))?new Intl.DateTimeFormat(globalThis.FoundlyI18n?.locale||'nl-NL',/^\d{4}-\d{2}-\d{2}$/.test(value)?{dateStyle:'medium',timeZone:'UTC'}:{dateStyle:'medium',timeStyle:'short',timeZone:'UTC'}).format(new Date(value)):String(crmUnknown()));
function crmRender(node,value){if(globalThis.FoundlyI18n)FoundlyI18n.renderText(node,value);else node.textContent=String(value??'');return node;}
function crmElement(tag,value='',className){const node=crmRender(document.createElement(tag),value);if(className)node.className=className;return node;}
function crmAttribute(node,attribute,value){if(globalThis.FoundlyI18n)FoundlyI18n.renderAttribute(node,attribute,value);else node.setAttribute(attribute,String(value??''));return node;}
const crmSource=(key,params={})=>globalThis.FoundlyI18n?FoundlyI18n.message('crm.source.'+key,params):key;
const CRM_ENTITY_NAMES=new Set(['leads','contacts','companies','people','deals','opportunities','tasks','appointments','activities','notes','calls','emails','messages','segments','products','vehicles','quotes','orders','campaigns','documents','consents','pipelines','stages','automations','audit_events']);
const crmEntity=value=>CRM_ENTITY_NAMES.has(value)?crmSource('entity.'+value):value||crmUnknown();
const crmSourceValue=value=>value===null||value===undefined||value===''?crmUnknown():typeof value==='object'?crmUnknown():value;
const crmPercent=value=>crmLive(()=>crmFinite(value)&&value>=0&&value<=100?new Intl.NumberFormat(globalThis.FoundlyI18n?.locale||'nl-NL',{style:'percent',maximumFractionDigits:1}).format(value/100):String(crmUnknown()));
function crmViewTitle(name,entity,active){let key;try{key=Object.values(JSON.parse(active?.getAttribute('data-i18n-text')||'{}'))[0];}catch{}crmRender($('#viewTitle'),key&&globalThis.FoundlyI18n?FoundlyI18n.message(key):name==='records'?crmEntity(entity):crmSource('view.'+name));}
function crmSourceField(label,value){return crmElement('p',crmSource('field_value',{label,value}));}

function crmError(error){return globalThis.FoundlyI18n?FoundlyI18n.message(error?.status===401?'identity.auth_required':FoundlyI18n.errorKey(error?.code,error?.status)):'Aanvraag mislukt';}
function crmLabel(value){return ['leads','qualified_leads','pipeline_value','won_value','lost_value','conversion','win_rate','average_deal_value','margin','sales_cycle','response_time','follow_up_rate','appointments','no_show_rate','forecast','open_tasks','my_leads','my_tasks','my_pipeline','priority_leads','source_performance','owner_performance','pipeline','lead_trend','campaign_attribution','stalled_deals','activity'].includes(value)?crmCopy('metric.'+value,value):value||crmUnknown();}
function crmWidgetType(value){return ['KPI','LINE','BAR','FUNNEL','PIPELINE','TABLE','LEADERBOARD','FORECAST','ACTIVITY_FEED'].includes(value)?crmCopy('type.'+value,value):value??crmUnknown();}
function crmFreshness(){crmRender($('#dashboardFreshness'),crmCopy('freshness','Laatst gecontroleerd {time} UTC · alleen vastgelegde CRM-data',{time:crmLive(()=>state.lastDashboardRefresh?new Intl.DateTimeFormat(globalThis.FoundlyI18n?.locale||'nl-NL',{timeStyle:'medium',timeZone:'UTC'}).format(new Date(state.lastDashboardRefresh)):String(crmUnknown()))}));}

function titleize(value){return String(value||'').replaceAll('_',' ').replace(/\b\w/g,char=>char.toUpperCase())}
function localDate(value){const date=new Date(value);return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`}
function gridClass(widget){return `x-${Math.max(1,Math.min(12,Number(widget.x||0)+1))} w-${Math.max(1,Math.min(12,Number(widget.w||4)))} h-${Math.max(2,Math.min(12,Number(widget.h||3)))}`}
function packWidgets(widgets=[]){let x=0,y=0,rowHeight=0;for(const widget of widgets){widget.w=Math.max(1,Math.min(12,Number(widget.w||4)));widget.h=Math.max(2,Math.min(12,Number(widget.h||3)));if(x+widget.w>12){x=0;y+=rowHeight||3;rowHeight=0}widget.x=x;widget.y=y;x+=widget.w;rowHeight=Math.max(rowHeight,widget.h);if(x>=12){x=0;y+=rowHeight;rowHeight=0}}return widgets}
function deltaBody(metricName){
 const item=state.analytics?.comparison?.metrics?.[metricName];if(item?.available!==true||!crmFinite(item.absolute_delta))return null;
 const delta=crmLive(()=>{const locale=globalThis.FoundlyI18n?.locale||'nl-NL',options={maximumFractionDigits:2,signDisplay:'exceptZero'};if(item.unit==='currency'&&typeof item.currency==='string'&&/^[A-Z]{3}$/.test(item.currency))Object.assign(options,{style:'currency',currency:item.currency});if(['hours','days'].includes(item.unit))Object.assign(options,{style:'unit',unit:item.unit==='hours'?'hour':'day',unitDisplay:'short'});let absolute=new Intl.NumberFormat(locale,options).format(item.absolute_delta);if(item.unit==='percent')absolute=String(crmCopy('percentage_points','{value} procentpunt',{value:absolute}));else if(item.unit==='currency'&&!options.currency)absolute+=' · '+String(crmCopy('currency_unknown','Valuta niet vermeld'));return absolute+(crmFinite(item.percent_delta)?' · '+new Intl.NumberFormat(locale,{style:'percent',maximumFractionDigits:1,signDisplay:'exceptZero'}).format(item.percent_delta/100):'');});
 return crmElement('p',crmCopy('comparison','{value} t.o.v. vorige periode',{value:delta}),'comparison '+(item.absolute_delta<0?'down':'up'));
}

function setView(name,entity,section){
  $$('.view').forEach(view=>view.classList.toggle('active',view.id===`view-${name}`));
  const navButtons=$$('#crmNav button'),matching=navButtons.filter(button=>button.dataset.view===name&&(!entity||button.dataset.entity===entity)),active=section?matching.find(button=>button.dataset.section===section):matching[0];
  navButtons.forEach(button=>button.classList.toggle('active',button===active));
  if(entity){state.entity=entity;$('#recordEntity').value=entity}crmViewTitle(name,state.entity,active);
  if(name==='objects'){const host=$('#customObjectWorkspace');if(!host.firstChild)host.append(window.FoundlyCrmObjects.create({document,request:api,isActive:()=>$('#view-objects').classList.contains('active'),onExport:data=>{const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='foundly-crm-custom-objects.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}}));else host.firstChild.refresh();}
  if(name==='dashboard')loadDashboard().catch(showError);if(name==='pipeline')loadPipelines().catch(showError);if(name==='records')loadRecords().catch(showError);if(name==='automation')loadAutomations().catch(showError);if(name==='settings')loadSchema().catch(showError);
}
function showError(error){toast(crmError(error),true)}

async function loadStatus(){
 const generation=++state.statusGeneration,access=state.dashboardAccessGeneration,node=$('#crmConnection');
 try{const status=await api('/api/crm/status');if(generation!==state.statusGeneration||access!==state.dashboardAccessGeneration)return null;crmRender(node,crmCopy('fetched','Opgehaald · {count} records',{count:crmNumber(status.records,true)}));node.classList.add('online');if(state.changeToken===null)state.changeToken=typeof status.change_token==='string'?status.change_token:null;return status;}
 catch(error){if(generation===state.statusGeneration&&access===state.dashboardAccessGeneration){node.classList.remove('online');crmRender(node,crmError(error));if([401,403].includes(error.status))invalidateDashboard(error,state.dashboardGeneration);}throw error;}
}

async function pollLiveStatus(){if(state.polling)return;state.polling=true;try{const previous=state.changeToken,status=await loadStatus();if(!status)return;if(status.change_token&&previous&&status.change_token!==previous){state.changeToken=status.change_token;const active=$('.view.active')?.id;if(active==='view-dashboard'&&!state.editing)await refreshDashboardData();else if(active==='view-records')await loadRecords();else if(active==='view-pipeline')await loadPipelines();else if(active==='view-automation')await loadAutomations()}else if(status.change_token)state.changeToken=status.change_token}catch{$('#crmConnection').classList.remove('online')}finally{state.polling=false}}
function renderCrmSchema(schema){
 const host=$('#schemaSummary');host.replaceChildren();const section=(title,value)=>{const node=crmElement('article');node.append(crmElement('h3',crmSource(title)),crmElement('p',value));host.append(node);return node;};
 const entities=schema?.entities,widgets=schema?.dashboard_widget_types;
 section('schema_entities',crmValue(entities&&typeof entities==='object'&&!Array.isArray(entities)?crmNumber(Object.keys(entities).length,true):crmUnknown()));
 const widget=section('schema_widgets',crmValue(Array.isArray(widgets)?crmNumber(widgets.length,true):crmUnknown()));if(Array.isArray(widgets))widget.append(crmElement('p',crmValue(crmLive(()=>widgets.map(value=>String(crmWidgetType(value))).join(' · ')))));
 section('schema_external',schema?.contracts?.external_writes==='never_without_explicit_authorization_and_connector'?crmSource('schema_external_policy'):crmUnknown());
}
async function loadSchema(){const generation=++state.schemaGeneration,access=state.crmAccessGeneration,current=()=>generation===state.schemaGeneration&&access===state.crmAccessGeneration;try{if(!state.schema){const schema=await api('/api/crm/schema');if(!current())return null;state.schema=schema;}renderCrmSchema(state.schema);return state.schema;}catch(error){if(current()){state.schema=null;crmRender($('#schemaSummary'),crmError(error));}throw error;}}

function dashboardQuery(){const query=new URLSearchParams();if($('#dateFrom').value)query.set('from',new Date(`${$('#dateFrom').value}T00:00:00`).toISOString());if($('#dateTo').value)query.set('to',new Date(`${$('#dateTo').value}T23:59:59.999`).toISOString());if($('#comparePeriod').checked)query.set('compare','true');for(const [field,node] of [['status',$('#dashboardStatusFilter')],['owner_id',$('#dashboardOwnerFilter')],['source_id',$('#dashboardSourceFilter')]])if(node.value.trim())query.set(`filter.${field}`,node.value.trim());return query}
function dashboardSettings(){return {from:$('#dateFrom').value?new Date(`${$('#dateFrom').value}T00:00:00`).toISOString():null,to:$('#dateTo').value?new Date(`${$('#dateTo').value}T23:59:59.999`).toISOString():null,compare:$('#comparePeriod').checked,status:$('#dashboardStatusFilter').value.trim()||null,owner_id:$('#dashboardOwnerFilter').value.trim()||null,source_id:$('#dashboardSourceFilter').value.trim()||null}}
async function loadSummary(generation=state.dashboardGeneration){const summary=await api(`/api/crm/summary?${dashboardQuery()}`);if(generation!==state.dashboardGeneration)return null;state.summary=summary;state.analytics=summary.analytics;state.lastDashboardRefresh=Date.now();return summary}

function syncDashboardControls({filters=true}={}){const dashboard=state.dashboard||{},settings=dashboard.filters||{};$('#dashboardShare').value=dashboard.share_mode||'PRIVATE';$('#dashboardTeam').value=dashboard.team_id||'';$('#dashboardTeamWrap').classList.toggle('hidden',$('#dashboardShare').value!=='TEAM');if(filters&&dashboard.persisted!==false){if(settings.from)$('#dateFrom').value=localDate(settings.from);if(settings.to)$('#dateTo').value=localDate(settings.to);$('#comparePeriod').checked=Boolean(settings.compare);$('#dashboardStatusFilter').value=settings.status||'';$('#dashboardOwnerFilter').value=settings.owner_id||'';$('#dashboardSourceFilter').value=settings.source_id||''}}
function invalidateDashboard(error,generation){
 if(generation!==state.dashboardGeneration)return;state.dashboardGeneration++;state.summary=state.analytics=null;state.lastDashboardRefresh=0;
 if([401,403].includes(error?.status)){state.dashboardAccessGeneration++;state.statusGeneration++;state.dashboard=null;state.dashboardRequest=null;state.editing=false;state.changeToken=null;$('#crmConnection').classList.remove('online');crmRender($('#crmConnection'),crmError(error));for(const id of ['dashboardShare','dashboardTeam','dashboardOwnerFilter','dashboardSourceFilter','dashboardStatusFilter'])$('#'+id).value='';}
 $('#widgetGrid').replaceChildren();$('#dashboardNotice').classList.remove('ready');crmRender($('#dashboardNotice'),crmError(error));crmRender($('#dashboardFreshness'),'');dashboardControlState();
}

async function loadDashboard({forcePreset=false}={}){
 if(state.dashboardRequest){await loadStatus();if(state.dashboardRequest)crmRender($('#dashboardNotice'),crmCopy('retry_pending','Herhaal eerst de openstaande bewaaractie.'));return null;}
 const generation=++state.dashboardGeneration;$('#dashboardNotice').classList.remove('ready');crmRender($('#dashboardNotice'),crmCopy('loading','Werkelijke CRM-data laden…'));
 try{const preset=$('#dashboardPreset').value.replace(' ','_'),query=new URLSearchParams({preset});if(forcePreset)query.set('force_preset','true');const dashboard=await api(`/api/crm/dashboard?${query}`);if(generation!==state.dashboardGeneration)return null;state.dashboard=dashboard.dashboard;syncDashboardControls({filters:!forcePreset});const summary=await loadSummary(generation);if(generation!==state.dashboardGeneration)return null;renderDashboard();$('#dashboardNotice').classList.add('ready');crmRender($('#dashboardNotice'),crmCopy('loaded','Vastgelegde CRM-data opgehaald'));crmFreshness();return summary;}
 catch(error){invalidateDashboard(error,generation);throw error;}
}
async function refreshDashboardData(){
 if(state.dashboardRequest){await loadStatus();if(state.dashboardRequest)crmRender($('#dashboardNotice'),crmCopy('retry_pending','Herhaal eerst de openstaande bewaaractie.'));return null;}
 if(!state.dashboard)return loadDashboard();const generation=++state.dashboardGeneration;$('#dashboardNotice').classList.remove('ready');crmRender($('#dashboardNotice'),crmCopy('refreshing','Werkelijke CRM-data vernieuwen…'));
 try{const summary=await loadSummary(generation);if(generation!==state.dashboardGeneration)return null;renderDashboard();$('#dashboardNotice').classList.add('ready');crmRender($('#dashboardNotice'),crmCopy('loaded','Vastgelegde CRM-data opgehaald'));crmFreshness();return summary;}
 catch(error){invalidateDashboard(error,generation);throw error;}
}

function widgetBody(widget){
 const empty=(rows,key,fallback)=>[crmElement('p',Array.isArray(rows)?crmCopy(key,fallback):crmNoData(),'unavailable')],table=rows=>{const table=crmElement('table'),body=crmElement('tbody');for(const values of rows){const row=crmElement('tr');row.append(...values.map(value=>crmElement('td',value)));body.append(row);}table.append(body);return table;};
 const metric=state.analytics?.metrics?.[widget.metric];if(metric){const formatted=formatMetric(metric);if(!formatted.available)return [crmElement('p',crmCopy('metric_empty','Geen echte brondata voor deze metric.'),'unavailable')];const amount=crmElement('div','','metric');amount.append(crmElement('span',crmValue(crmLive(()=>formatMetric(metric).value))),crmElement('span',crmValue(crmLive(()=>formatMetric(metric).unit)),'unit'));return [amount,deltaBody(widget.metric),crmElement('p',crmCopy('source_records','{count} bronrecords',{count:crmNumber(metric.source_count,true)}),'unavailable')].filter(Boolean);}
 if(widget.metric==='priority_leads'){const rows=state.summary?.priority_leads?.items;return Array.isArray(rows)&&rows.length?[table(rows.slice(0,5).map(item=>[item?.lead?.name??crmUnknown(),crmValue(crmNumber(item?.priority_score))]))]:empty(rows,'leads_empty','Geen echte leads beschikbaar.');}
 if(widget.metric==='source_performance'){
  const rows=state.analytics?.source_performance;if(!Array.isArray(rows)||!rows.length)return empty(rows,'source_empty','Geen bronattributie beschikbaar.');
  const visible=rows.slice(0,12),currency=row=>typeof row?.currency==='string'&&/^[A-Z]{3}$/.test(row.currency)?row.currency:null,allMoney=visible.every(row=>crmFinite(row?.value)&&row.value>=0&&currency(row)===currency(visible[0])),allCounts=visible.every(row=>row?.value===undefined&&crmCount(row?.leads)),field=allMoney?'value':allCounts?'leads':null;
  if(!field)return [table(visible.map(row=>[row?.source_id??crmUnknown(),crmValue(crmMoney(row))]))];
  const maximum=Math.max(...visible.map(row=>row[field]),1),spark=crmElement('div','','spark'),legend=crmElement('div','','legend');
  for(const row of visible){const bar=crmElement('i','','bar-'+(row[field]===0?0:Math.max(1,Math.min(20,Math.round(row[field]/maximum*20)))));crmAttribute(bar,'title',crmCopy(field==='value'?'source_value':'source_leads',field==='value'?'{source} · Waarde: {value}':'{source} · Leads: {value}',{source:row.source_id??crmUnknown(),value:field==='value'?crmMoney(row):crmNumber(row.leads,true)}));spark.append(bar);}
  for(const row of visible.slice(0,4))legend.append(crmElement('span',row.source_id??crmUnknown()));return [spark,legend];
 }
 if(['owner_performance','pipeline'].includes(widget.metric)){
  const owner=widget.metric==='owner_performance',rows=owner?state.analytics?.owner_performance:state.analytics?.pipeline_stages;if(!Array.isArray(rows)||!rows.length)return empty(rows,owner?'owner_empty':'pipeline_empty',owner?'Geen verkopersdata beschikbaar.':'Geen pipelinegegevens beschikbaar.');
  const host=crmElement(owner?'ol':'div','',owner?'leaderboard':'funnel');for(const row of owner?rows.slice(0,6):rows){const item=crmElement(owner?'li':'div');item.append(crmElement('span',(owner?row?.owner_id:row?.name)??crmUnknown()),crmElement('strong',crmCopy('deals_value','{count} deals · {value}',{count:crmNumber(row?.deals,true),value:crmMoney(row)})));host.append(item);}return [host];
 }
 if(widget.metric==='lead_trend'){
  const rows=state.analytics?.trends?.lead_trend;if(!Array.isArray(rows)||!rows.length)return empty(rows,'trend_empty','Geen leadtrend beschikbaar.');const visible=rows.slice(-20);
  if(visible.some(row=>!crmCount(row?.leads)))return [table(visible.map(row=>[crmValue(crmDate(row?.date)),crmValue(crmNumber(row?.leads,true))]))];
  const maximum=Math.max(...visible.map(row=>row.leads),1),spark=crmElement('div','','spark trend');for(const row of visible){const bar=crmElement('i','','bar-'+(row.leads===0?0:Math.max(1,Math.min(20,Math.round(row.leads/maximum*20)))));crmAttribute(bar,'title',crmCopy('trend_leads','{date} · {count} leads',{date:crmDate(row.date),count:crmNumber(row.leads,true)}));spark.append(bar);}return [spark];
 }
 if(widget.metric==='campaign_attribution'){const rows=state.analytics?.campaigns;return Array.isArray(rows)&&rows.length?[table(rows.slice(0,8).map(row=>[row?.name??crmUnknown(),crmValue(crmNumber(row?.attributions,true))]))]:empty(rows,'campaign_empty','Geen campagne-attributie beschikbaar.');}
 if(widget.metric==='stalled_deals'){const rows=state.analytics?.stalled_deals;return Array.isArray(rows)&&rows.length?[table(rows.slice(0,8).map(row=>[row?.title??crmUnknown(),crmValue(crmDate(row?.next_action_at||row?.updated_at))]))]:empty(rows,'stalled_empty','Geen vastgelopen deals volgens het deterministische contract.');}
 if(widget.metric==='activity'){const rows=state.analytics?.activity_feed;if(!Array.isArray(rows)||!rows.length)return empty(rows,'activity_empty','Nog geen activiteiten vastgelegd.');const host=crmElement('div','','activity-feed');for(const row of rows.slice(0,8)){const item=crmElement('p');item.append(crmElement('strong',row?.type==='activity'?crmCopy('metric.activity','Activiteit'):row?.type??crmUnknown()),crmElement('span',crmCopy('activity_row','{summary} · {date}',{summary:row?.summary||row?.status||crmCopy('recorded_activity','Vastgelegde activiteit'),date:crmDate(row?.at)})));host.append(item);}return [host];}
 return [crmElement('p',crmCopy('widget_empty','Deze widget heeft nog geen beschikbare brondata.'),'unavailable')];
}

function renderDashboard(){
 dashboardControlState();const grid=$('#widgetGrid');grid.classList.toggle('editing',state.editing);grid.replaceChildren();const widgets=state.dashboard?.widgets;
 if(!Array.isArray(widgets)||!widgets.length){grid.append(crmElement('div',Array.isArray(widgets)?crmCopy('dashboard_empty','Dit dashboard heeft nog geen widgets. Kies + WIDGET.'):crmNoData(),'empty'));return;}
 widgets.forEach((widget,index)=>{const card=crmElement('article','','widget '+(widget.type==='KPI'?'':'chart ')+gridClass(widget));card.draggable=state.editing&&!state.dashboardRequest;card.dataset.widget=widget.id;card.setAttribute('data-widget',widget.id);const controls=crmElement('div','','widget-tools');
  for(const [action,glyph,label]of [['down','−','smaller'],['up','+','larger'],['remove','×','remove']]){const button=crmElement('button',glyph);button.type='button';button.setAttribute(action==='remove'?'data-remove':'data-size',action);crmAttribute(button,'title',crmCopy(label,{smaller:'Kleiner',larger:'Groter',remove:'Verwijderen'}[label]));button.disabled=!state.editing||Boolean(state.dashboardRequest);controls.append(button);}
  card.append(controls,crmElement('h3',crmLabel(widget.metric||widget.type)),...widgetBody(widget),crmElement('small',crmCopy('position','{type} · positie {number}',{type:crmWidgetType(widget.type),number:crmNumber(index+1,true)}),'unavailable'));grid.append(card);
 });bindWidgetEditing();
}

function bindWidgetEditing(){
 const dashboard=state.dashboard,access=state.dashboardAccessGeneration,active=card=>state.editing&&!state.dashboardRequest&&state.dashboard===dashboard&&access===state.dashboardAccessGeneration&&card.isConnected&&Array.isArray(dashboard?.widgets);
 $$('.widget').forEach(card=>{card.ondragstart=event=>{if(!active(card)){event.preventDefault();return;}event.dataTransfer.setData('text/plain',card.dataset.widget);};card.ondragover=event=>{if(active(card))event.preventDefault();};card.ondrop=event=>{event.preventDefault();if(!active(card))return;const from=event.dataTransfer.getData('text/plain'),to=card.dataset.widget;if(from===to)return;const widgets=dashboard.widgets,a=widgets.findIndex(item=>item.id===from),b=widgets.findIndex(item=>item.id===to);if(a<0||b<0)return;const [moved]=widgets.splice(a,1);widgets.splice(b,0,moved);packWidgets(widgets);renderDashboard();};card.onclick=event=>{if(!active(card))return;const widget=dashboard.widgets.find(item=>item.id===card.dataset.widget);if(!widget)return;if(event.target.closest('[data-remove]')){dashboard.widgets=dashboard.widgets.filter(item=>item.id!==widget.id);packWidgets(dashboard.widgets);renderDashboard();}else if(event.target.closest('[data-size="up"]')){widget.w=Math.min(12,(widget.w||4)+2);widget.h=Math.min(12,(widget.h||3)+1);packWidgets(dashboard.widgets);renderDashboard();}else if(event.target.closest('[data-size="down"]')){widget.w=Math.max(2,(widget.w||4)-2);widget.h=Math.max(2,(widget.h||3)-1);packWidgets(dashboard.widgets);renderDashboard();}};});
}

function dashboardControlState(){
 const locked=Boolean(state.dashboardRequest)||!state.dashboard;for(const id of ['dashboardPreset','dashboardShare','dashboardTeam','dateFrom','dateTo','comparePeriod','dashboardStatusFilter','dashboardOwnerFilter','dashboardSourceFilter','editDashboard','addWidget'])$('#'+id).disabled=locked;$('#saveDashboard').disabled=!state.dashboard||state.dashboardSaving;
}
async function saveDashboard(){
 if(!state.dashboard||state.dashboardSaving)return;
 if(!state.dashboardRequest){const payload={...state.dashboard,name:state.dashboard.name||String(crmCopy('default_name','Mijn CRM-dashboard')),widgets:state.dashboard.widgets||[],filters:dashboardSettings(),share_mode:$('#dashboardShare').value,team_id:$('#dashboardShare').value==='TEAM'?$('#dashboardTeam').value.trim():undefined,is_default:true};if(payload.persisted===false||String(payload.id||'').startsWith('preset-'))delete payload.id;delete payload.persisted;state.dashboardRequest=Object.freeze({method:payload.id?'PATCH':'POST',headers:Object.freeze({'idempotency-key':`dashboard-${crypto.randomUUID()}`,...(payload.revision?{'if-match':`"${payload.revision}"`}:{})}),body:JSON.stringify(payload)});}
 state.dashboardSaving=true;const request=state.dashboardRequest,generation=++state.dashboardGeneration,access=state.dashboardAccessGeneration;renderDashboard();crmRender($('#dashboardNotice'),crmCopy('saving','Dashboardweergave bewaren…'));
 try{const response=await api('/api/crm/dashboard',request);if(generation!==state.dashboardGeneration||access!==state.dashboardAccessGeneration)return;if(!response?.dashboard||typeof response.dashboard.id!=='string'||!response.dashboard.id||!Array.isArray(response.dashboard.widgets)||!Number.isSafeInteger(response.dashboard.revision)||response.dashboard.revision<1)throw new Error('CRM dashboard response unavailable');state.dashboardRequest=null;state.dashboard=response.dashboard;state.editing=false;syncDashboardControls();renderDashboard();crmRender($('#dashboardNotice'),crmCopy('saved','Dashboardweergave opgeslagen'));
  try{await loadStatus();}catch(error){if([401,403].includes(error.status))throw error;crmRender($('#dashboardNotice'),crmCopy('saved_status_failed','Dashboard opgeslagen; de actuele verbindingsstatus kon niet laden.'));return;}
  if(access===state.dashboardAccessGeneration)toast(crmCopy('saved','Dashboardweergave opgeslagen'));
 }catch(error){if(access===state.dashboardAccessGeneration){if([401,403].includes(error.status))invalidateDashboard(error,state.dashboardGeneration);else{if(error.status>=400&&error.status<500&&![408,429].includes(error.status))state.dashboardRequest=null;crmRender($('#dashboardNotice'),state.dashboardRequest?crmCopy('retry_error','Bewaren niet bevestigd. Herhaal dezelfde bewaaractie. {reason}',{reason:crmError(error)}):crmError(error));renderDashboard();}}throw error;}
 finally{state.dashboardSaving=false;dashboardControlState();}
}

async function loadPipelines(){
 const generation=++state.pipelinesGeneration,access=state.crmAccessGeneration,current=()=>generation===state.pipelinesGeneration&&access===state.crmAccessGeneration,select=$('#pipelineSelect'),selected=select.value;state.boardGeneration++;state.board=null;select.replaceChildren();crmRender($('#pipelineBoard'),crmCopy('source_loading','CRM-brongegevens laden…'));
 try{const response=await api('/api/crm/pipelines?limit=200&sort=updated_at&order=desc');if(!current())return null;state.pipelines=Array.isArray(response.items)?response.items:[];select.replaceChildren(...state.pipelines.map(row=>{const option=crmElement('option',row.name);option.value=row.id;return option;}));select.value=state.pipelines.some(row=>row.id===selected)?selected:state.pipelines[0]?.id||'';
 if(!state.pipelines.length){crmRender($('#pipelineBoard'),Array.isArray(response.items)?crmCopy('pipelines_empty','Nog geen pipeline geconfigureerd. Maak een pipeline of gebruik het bedrijfsprofiel.'):crmNoData());return;}await loadPipelineBoard(select.value);}
 catch(error){if(current()){state.pipelines=[];select.replaceChildren();crmRender($('#pipelineBoard'),crmError(error));}throw error;}
}

function crmStageTotal(stage,complete){
 if(!Array.isArray(stage.deals)||!complete)return crmNoData();
 const groups=new Map();for(const deal of stage.deals){if(!crmFinite(deal?.value))return crmUnknown();const currency=typeof deal.currency==='string'&&/^[A-Z]{3}$/.test(deal.currency)?deal.currency:null;groups.set(currency,(groups.get(currency)||0)+deal.value);}
 if(groups.size>1)return crmSource('mixed_currencies');
 const [currency,value]=groups.size?[...groups][0]:[null,0];return crmMoney({value,currency});
}
function renderPipelineBoard(board){
 const host=$('#pipelineBoard');host.replaceChildren();if(!Array.isArray(board?.stages)){crmRender(host,crmNoData());return;}
 if(board.coverage?.complete===false)host.append(crmElement('p',crmSource('partial_pipeline'),'hint'));
 if(!board.stages.length){host.append(crmElement('div',crmSource('stages_empty'),'empty'));return;}
 for(const stage of board.stages){if(!stage||typeof stage!=='object'){host.append(crmElement('p',crmNoData()));continue;}
  const section=crmElement('section','','stage'),head=crmElement('div','','stage-head'),drop=crmElement('div','','stage-drop');section.dataset.stage=stage.id;
  head.append(crmElement('h3',crmSourceValue(stage.name)),crmElement('span',crmSource('stage_summary',{total:Array.isArray(stage.deals)?crmNumber(stage.deals.length,true):crmUnknown(),value:crmStageTotal(stage,board.coverage?.complete===true)})));section.append(head,drop);host.append(section);
  if(!Array.isArray(stage.deals)){drop.append(crmElement('p',crmNoData()));continue;}
  for(const deal of stage.deals){if(!deal||typeof deal!=='object'){drop.append(crmElement('p',crmNoData()));continue;}const card=crmElement('article','','deal-card'),meta=crmElement('div','','deal-meta');card.draggable=true;card.dataset.deal=deal.id;card.dataset.revision=String(deal.revision);card.append(crmElement('h4',crmSourceValue(deal.title)),meta);meta.append(crmElement('span',crmValue(crmPercent(deal.probability))),crmElement('span',crmValue(crmMoney(deal))));drop.append(card);}
 }
 bindPipelineDrag();
}
async function loadPipelineBoard(id){
 const generation=++state.boardGeneration,access=state.crmAccessGeneration,current=()=>generation===state.boardGeneration&&access===state.crmAccessGeneration;state.board=null;$('#pipelineBoard').replaceChildren();if(!id)return;crmRender($('#pipelineBoard'),crmCopy('source_loading','CRM-brongegevens laden…'));
 try{const response=await api(`/api/crm/pipelines/${encodeURIComponent(id)}/board`);if(!current())return null;state.board=response.board;renderPipelineBoard(state.board);}catch(error){if(current()){state.board=null;crmRender($('#pipelineBoard'),crmError(error));}throw error;}
}

function crmActionHost(kind){return kind==='archive'?$('#recordActionNotice'):$('#pipelineActionNotice');}
function crmActionControls(kind){if(kind==='archive')$$('[data-archive]').forEach(node=>node.disabled=Boolean(state.actionWrites.archive));else $$('.deal-card').forEach(node=>node.draggable=!state.actionWrites.stage);}
function crmActionNotice(kind,run,message,retry=false){
 const host=crmActionHost(kind),subject=crmElement('p',crmCopy('action_subject','{action}: {name}',{action:crmCopy(kind==='archive'?'action_archive':'action_move',kind),name:run.label})),feedback=crmElement('p',message);host.replaceChildren(subject,feedback);
 if(retry){const button=crmElement('button',crmCopy('action_retry','Dezelfde actie opnieuw proberen'),'ghost');button.type='button';button.onclick=()=>{if(state.actionWrites[kind]===run)return executeCrmAction(kind,run).catch(showError);};host.append(button);}
}
async function executeCrmAction(kind,run){
 if(state.actionWrites[kind]!==run||run.busy)return;const access=state.crmAccessGeneration,current=()=>state.actionWrites[kind]===run&&access===state.crmAccessGeneration,noticeCurrent=()=>state.actionFeedback[kind]===run&&access===state.crmAccessGeneration;run.busy=true;state.actionFeedback[kind]=run;crmActionControls(kind);crmActionNotice(kind,run,crmCopy('form_saving','Wijziging bewaren…'));
 try{
  let result;try{result=await api(run.path,run.request);if(!current())return;if(!run.validate(result))throw new Error('CRM action response unavailable');}
  catch(error){if(current()){const definitive=error.status>=400&&error.status<500&&![408,429].includes(error.status);if(definitive){delete state.actionWrites[kind];crmActionControls(kind);}crmActionNotice(kind,run,definitive?crmError(error):crmCopy('action_unconfirmed','De uitkomst is niet bevestigd. Probeer dezelfde actie opnieuw. {reason}',{reason:crmError(error)}),!definitive);}throw error;}
  if(!current())return;delete state.actionWrites[kind];crmActionControls(kind);const message=run.saved(result);crmActionNotice(kind,run,message);
  try{await run.refresh();if(noticeCurrent())toast(message);}catch(error){if(access!==state.crmAccessGeneration)return;if(noticeCurrent()){crmActionNotice(kind,run,message);crmActionHost(kind).append(crmElement('p',crmCopy('saved_refresh_failed','Opgeslagen; de actuele brongegevens konden niet vernieuwen.')));}}
 }finally{run.busy=false;}
}
function bindPipelineDrag(){
 const board=state.board,access=state.crmAccessGeneration,active=node=>Boolean(board)&&state.board===board&&access===state.crmAccessGeneration&&node.isConnected;
 $$('.deal-card').forEach(card=>card.ondragstart=event=>{if(!active(card)||state.actionWrites.stage){event.preventDefault();return;}event.dataTransfer.setData('application/json',JSON.stringify({id:card.dataset.deal,revision:card.dataset.revision}));});
 $$('.stage').forEach(stage=>{stage.ondragover=event=>{if(!active(stage))return;event.preventDefault();stage.classList.add('drag-over');};stage.ondragleave=()=>stage.classList.remove('drag-over');stage.ondrop=async event=>{
  event.preventDefault();stage.classList.remove('drag-over');if(!active(stage))return;
  try{const deal=JSON.parse(event.dataTransfer.getData('application/json'));let run=state.actionWrites.stage;if(run){if(deal.id===run.id&&stage.dataset.stage===run.target)return await executeCrmAction('stage',run);toast(crmCopy('action_pending','Rond eerst de openstaande actie af.'),true);return;}
   const source=board.stages.flatMap(row=>Array.isArray(row?.deals)?row.deals:[]).find(row=>row?.id===deal.id),target=stage.dataset.stage;if(!source||String(source.revision)!==String(deal.revision)||!Number.isSafeInteger(source.revision)||source.revision<1||!board.stages.some(row=>row?.id===target))return;
   run={id:source.id,target,label:source.title||source.id,path:`/api/crm/deals/${encodeURIComponent(source.id)}/stage`,request:Object.freeze({method:'PATCH',headers:Object.freeze({'if-match':`"${source.revision}"`,'idempotency-key':`stage-${crypto.randomUUID()}`,'x-foundly-event-id':crypto.randomUUID()}),body:JSON.stringify({stage_id:target})}),validate:response=>response?.deal?.id===source.id&&(response.deal.stage_id===target||response.deal.requested_stage_id===target&&typeof response.deal.stage_id==='string'&&response.deal.stage_id.length>0)&&Number.isSafeInteger(response.deal.revision)&&response.deal.revision>source.revision&&['RECORDED','LEGACY_OUTCOME_UNVERIFIED'].includes(response.deal.automation_status),saved:response=>response.deal.automation_status==='LEGACY_OUTCOME_UNVERIFIED'?crmCopy('move_legacy_review','De verplaatsing is vastgelegd; de eerdere automationuitkomst moet worden gecontroleerd.'):crmCopy('move_saved','Dealverplaatsing opgeslagen'),refresh:async()=>{if(state.board?.pipeline?.id===board.pipeline.id)await loadPipelineBoard(board.pipeline.id);}};
   state.actionWrites.stage=run;await executeCrmAction('stage',run);
  }catch(error){if(access===state.crmAccessGeneration)showError(error);}
 };});crmActionControls('stage');
}

function openPipelineDialog(){
  const form=$('#pipelineForm'),dialog=$('#pipelineDialog');
  if(!state.pipelineCloseBound){dialog.addEventListener('close',()=>{if(state.pipelineRequest)state.pipelineRequest.paused=true;});state.pipelineCloseBound=true;}
  if(!state.pipelineRequest){form.reset();form.elements.name.disabled=false;state.pipelineEditor=window.FoundlyCrmPipelineEditor.create({document,i18n:globalThis.FoundlyI18n});$('#pipelineStages').replaceChildren(state.pipelineEditor);$('#pipelineCreateNotice').hidden=true;}
  $('#pipelineDialog').showModal();requestAnimationFrame(()=>form.querySelector(state.pipelineRequest?'button[type="submit"]':'input[name="name"]').focus());
}
async function createPipeline(event){
  event.preventDefault();if(state.pipelineBusy||!$('#pipelineDialog').open)return;
  const form=event.currentTarget,i18n=globalThis.FoundlyI18n,submit=form.querySelector('button[type="submit"]');
  if(!state.pipelineRequest){const name=form.elements.name.value.trim();if(!name||name.length>160)throw Error(i18n.t('common.required'));state.pipelineRequest={id:crypto.randomUUID(),name,stages:state.pipelineEditor.read()};}
  const pending=state.pipelineRequest,access=state.crmAccessGeneration,current=()=>state.pipelineRun===pending&&access===state.crmAccessGeneration;pending.paused=false;state.pipelineRun=pending;state.pipelineBusy=true;form.elements.name.disabled=true;state.pipelineEditor.setDisabled(true);submit.disabled=true;$('#pipelineCreateNotice').hidden=false;
  const valid=row=>row&&typeof row.id==='string'&&row.id&&Number.isSafeInteger(row.revision)&&row.revision>0;
  try{
    const response=await api('/api/crm/pipelines',{method:'POST',headers:{'idempotency-key':`pipeline-${pending.id}`},body:JSON.stringify({name:pending.name})});if(!current())return;const pipeline=response.record;if(!valid(pipeline))throw Error('CRM pipeline response unavailable');
    for(const stage of pending.stages){
      if(!current())return;if(pending.paused||!$('#pipelineDialog').open)throw Error(i18n.t('crm.pipeline.paused'));
      const response=await api('/api/crm/stages',{method:'POST',headers:{'idempotency-key':`pipeline-stage-${pending.id}-${stage.position}`},body:JSON.stringify({...stage,pipeline_id:pipeline.id})});if(!current())return;
      if(!valid(response.record)||response.record.pipeline_id!==pipeline.id||response.record.position!==stage.position)throw Error('CRM stage response unavailable');
    }
    state.pipelineRequest=null;form.elements.name.disabled=false;state.pipelineEditor.setDisabled(false);$('#pipelineCreateNotice').hidden=true;$('#pipelineDialog').close();form.reset();
    try{await loadPipelines();if(!current())return;$('#pipelineSelect').value=pipeline.id;await loadPipelineBoard(pipeline.id);if(current())toast(i18n.message?i18n.message('crm.pipeline.created'):i18n.t('crm.pipeline.created'));}
    catch(error){if(current())toast(i18n.message?i18n.message('crm.dashboard.saved_refresh_failed'):i18n.t('crm.dashboard.saved_refresh_failed'));}
  }finally{if(state.pipelineRun===pending){state.pipelineRun=null;state.pipelineBusy=false;submit.disabled=false;}}
}

async function loadRecords(){
 const entity=$('#recordEntity').value||state.entity,generation=++state.recordsGeneration,access=state.crmAccessGeneration,current=()=>generation===state.recordsGeneration&&access===state.crmAccessGeneration&&state.entity===entity;
 state.entity=entity;state.records=[];const rows=$('#recordRows'),empty=$('#recordEmpty');rows.replaceChildren();crmRender(empty,crmCopy('source_loading','CRM-brongegevens laden…'));empty.classList.remove('hidden');
 try{const query=new URLSearchParams({limit:'100',sort:'updated_at',order:'desc'}),search=$('#recordSearch').value.trim();if(search)query.set('q',search);const response=await api(`/api/crm/${encodeURIComponent(entity)}?${query}`);if(!current())return null;state.records=Array.isArray(response.items)?response.items:[];
  for(const record of state.records){if(!record||typeof record!=='object'){const row=crmElement('tr'),cell=crmElement('td',crmNoData());cell.colSpan=5;row.append(cell);rows.append(row);continue;}const row=crmElement('tr'),identity=crmElement('td'),actions=crmElement('td','','row-actions');identity.append(crmElement('strong',record.name||record.title||record.number||record.type||record.channel||crmSource('unnamed')),document.createElement('br'),crmElement('small',crmSourceValue(record.email||record.phone||record.id)));row.append(identity,crmElement('td',crmSourceValue(record.status)),crmElement('td',crmSourceValue(record.owner_id)),crmElement('td',crmValue(crmDate(record.updated_at))),actions);
   const action=(attribute,label,handler,danger=false)=>{const button=crmElement('button',label,'ghost'+(danger?' danger':''));button.type='button';button.setAttribute(attribute,record.id);button.onclick=()=>{if(current()&&button.isConnected)return handler();};actions.append(button);};
   if(['contacts','leads','people'].includes(entity))action('data-360',crmSource('customer_profile'),()=>openCustomer(record.id).catch(showError));action('data-edit',crmSource('edit'),()=>openRecordDialog(record,entity));if(['contacts','companies','people','leads','opportunities','deals','tasks','appointments'].includes(entity))action('data-fields',crmSource('custom_fields'),()=>openNativeFields(entity,record.id));action('data-archive',crmCopy('action_archive','Archiveren'),()=>archiveRecord(record.id).catch(showError),true);rows.append(row);
  }
  empty.classList.toggle('hidden',state.records.length>0);crmRender(empty,Array.isArray(response.items)?crmSource('records_empty'):crmNoData());crmActionControls('archive');
 }catch(error){if(current()){state.records=[];rows.replaceChildren();crmRender(empty,crmError(error));}throw error;}
}

function openNativeFields(entity,id){const dialog=$('#nativeFieldsDialog'),host=$('#nativeFieldsWorkspace'),access=state.crmAccessGeneration;if(host.firstChild?.dataset.unsaved==='true'){toast(crmSource('custom_fields_unsaved'),true);dialog.showModal();return;}host.replaceChildren();dialog.showModal();host.append(window.FoundlyCrmObjects.create({document,request:api,nativeRecord:{entity,id},isActive:()=>dialog.open&&access===state.crmAccessGeneration,onExport:data=>{const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='foundly-crm-custom-fields.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}}));}
function renderCustomer(data){
 const host=$('#customer360');host.replaceChildren();if(!data||!data.subject||typeof data.subject!=='object'){crmRender(host,crmNoData());return;}
 const section=key=>{const node=crmElement('section');node.append(crmElement('h3',crmSource(key)));host.append(node);return node;},subject=data.subject,identity=section('identity');identity.append(crmElement('strong',crmSourceValue(subject.name)),crmElement('p',[subject.email,subject.phone].filter(value=>typeof value==='string').join(' ')));
 section('lifecycle').append(crmSourceField(crmSource('status'),crmSourceValue(subject.status)),crmSourceField(crmSource('score'),crmNumber(subject.score)));
 const relations=section('relations');for(const entity of ['deals','tasks','appointments','documents'])relations.append(crmSourceField(crmEntity(entity),Array.isArray(data[entity])?crmNumber(data[entity].length,true):crmNoData()));
 const list=(key,items,limit,render)=>{const node=section(key);if(!Array.isArray(items))node.append(crmElement('p',crmNoData()));else if(!items.length)node.append(crmElement('p',crmSource(key+'_empty')));else for(const row of items.slice(0,limit))node.append(row&&typeof row==='object'?render(row):crmElement('p',crmNoData()));};
 list('timeline',data.timeline,30,row=>{const node=crmElement('article');node.append(crmElement('strong',crmEntity(row.timeline_type)),crmElement('p',crmValue(crmDate(row.occurred_at||row.scheduled_at||row.consented_at||row.revoked_at||row.created_at))),crmElement('p',crmSourceValue(row.summary||row.title||row.content||row.status)));return node;});
 list('history',data.history,20,row=>{const node=crmElement('article');node.append(crmElement('strong',['CREATE','UPDATE','DELETE'].includes(row.action)?crmSource('history.'+row.action):crmSourceValue(row.action)),crmElement('p',crmValue(crmDate(row.created_at))),crmElement('p',crmEntity(row.entity)));return node;});
 list('consents',data.consents,300,row=>crmSourceField(crmSourceValue(row.purpose),crmSourceValue(row.status)));
 window.FoundlyCrmObjects.appendCustomer(document,host,data.custom_objects);
}
async function openCustomer(id){const dialog=$('#customerDialog'),generation=++state.customerGeneration,access=state.crmAccessGeneration,current=()=>generation===state.customerGeneration&&access===state.crmAccessGeneration&&dialog.open;dialog.onclose=()=>{state.customerGeneration++;$('#customer360').replaceChildren();};crmRender($('#customer360'),crmCopy('source_loading','CRM-brongegevens laden…'));if(!dialog.open)dialog.showModal();try{const data=(await api(`/api/crm/customers/${encodeURIComponent(id)}/360`)).customer;if(!current())return null;renderCustomer(data);}catch(error){if(current())crmRender($('#customer360'),crmError(error));throw error;}}

function crmFormControls(form,locked,busy){for(const node of form.querySelectorAll('input,select,textarea'))node.disabled=locked;const button=form.querySelector('button');if(button)button.disabled=busy;}
async function saveCrmForm(kind,form,prepare,onSaved,savedCopy){
 let run=state.formWrites[kind];if(run?.busy)return;
 if(!run){const prepared=prepare();let notice=state.formNotices[kind];if(!notice){notice=crmElement('p','','wide hint');form.append(notice);state.formNotices[kind]=notice;}run={...prepared,form,notice,busy:false};state.formWrites[kind]=run;}
 const access=state.crmAccessGeneration,current=()=>state.formWrites[kind]===run&&access===state.crmAccessGeneration;run.busy=true;crmFormControls(run.form,true,true);crmRender(run.notice,crmCopy('form_saving','Wijziging bewaren…'));
 try{
  let response;try{response=await api(run.path,run.request);if(!current())return;if(!response?.record||typeof response.record.id!=='string'||!response.record.id||!Number.isSafeInteger(response.record.revision)||response.record.revision<1)throw new Error('CRM record response unavailable');}
  catch(error){if(current()){const definitive=error.status>=400&&error.status<500&&![408,429].includes(error.status);if(definitive){delete state.formWrites[kind];crmFormControls(run.form,false,false);}crmRender(run.notice,definitive?crmError(error):crmCopy('retry_error','Bewaren niet bevestigd. Herhaal dezelfde bewaaractie. {reason}',{reason:crmError(error)}));}throw error;}
  if(!current())return;delete state.formWrites[kind];crmFormControls(run.form,false,false);crmRender(run.notice,savedCopy);
  try{await onSaved(response,run);}catch(error){if(access!==state.crmAccessGeneration)throw error;crmRender(run.notice,crmCopy('saved_refresh_failed','Opgeslagen; de actuele brongegevens konden niet vernieuwen.'));}
 }finally{run.busy=false;if(current())crmFormControls(run.form,true,false);}
}
function openRecordDialog(record=null,entity=state.entity){if(state.formWrites.record){if(!$('#recordDialog').open)$('#recordDialog').showModal();toast(crmCopy('retry_pending','Herhaal eerst de openstaande bewaaractie.'));return;}state.recordEditor={entity,id:record?.id||null,access:state.crmAccessGeneration};const form=$('#recordForm'),field=PRIMARY_FIELD[entity]||'name',input=form.elements.name;form.reset();input.dataset.field=field;crmRender($('#dialogTitle'),crmSource('editor_title',{action:crmSource(record?'edit':'new'),entity:crmEntity(entity)}));crmAttribute(input,'placeholder',crmSource('field.'+field));form.elements.id.value=record?.id||'';form.elements.revision.value=record?.revision||'';if(record){input.value=record[field]||record.name||'';for(const name of ['status','email','phone','value','probability','owner_id','team_id','source_id','channel','direction','note'])if(form.elements[name])form.elements[name].value=record[name]??'';if(record.next_action_at)form.elements.next_action_at.value=new Date(record.next_action_at).toISOString().slice(0,16)}$('#recordDialog').showModal()}
async function saveRecord(event){
 event.preventDefault();const form=event.currentTarget,editor=state.recordEditor;if(!editor||editor.access!==state.crmAccessGeneration)return;
 return saveCrmForm('record',form,()=>{const data=Object.fromEntries(new FormData(form).entries()),id=data.id,revision=data.revision,primary=data.name,field=form.elements.name.dataset.field||'name';delete data.id;delete data.revision;delete data.name;data[field]=primary;for(const key of Object.keys(data))if(data[key]==='')delete data[key];for(const key of ['value','probability'])if(data[key]!==undefined)data[key]=Number(data[key]);if(data.next_action_at)data.next_action_at=new Date(data.next_action_at).toISOString();return {editor,path:`/api/crm/${encodeURIComponent(editor.entity)}${id?`/${encodeURIComponent(id)}`:''}`,request:Object.freeze({method:id?'PATCH':'POST',headers:Object.freeze({'idempotency-key':`record-${crypto.randomUUID()}`,...(revision?{'if-match':`"${revision}"`}:{})}),body:JSON.stringify(data)})};},async(response,run)=>{if(state.recordEditor!==run.editor)return;state.recordEditor=null;$('#recordDialog').close();await Promise.all([loadRecords(),loadStatus()]);toast(crmCopy('record_saved','CRM-record opgeslagen'));},crmCopy('record_saved','CRM-record opgeslagen'));
}

async function archiveRecord(id){
 let run=state.actionWrites.archive;if(run){if(run.id===id&&run.entity===state.entity)return executeCrmAction('archive',run);toast(crmCopy('action_pending','Rond eerst de openstaande actie af.'),true);return;}
 const entity=state.entity,record=state.records.find(item=>item?.id===id);if(!record||!Number.isSafeInteger(record.revision)||record.revision<1)return;const label=record.name||record.title||record.number||record.id;if(!confirm(String(crmCopy('archive_confirm','{name} archiveren?',{name:label}))))return;
 run={id,entity,label,path:`/api/crm/${encodeURIComponent(entity)}/${encodeURIComponent(id)}`,request:Object.freeze({method:'DELETE',headers:Object.freeze({'idempotency-key':`archive-${crypto.randomUUID()}`,'if-match':`"${record.revision}"`})}),validate:response=>response?.ok===true&&response.id===id&&typeof response.deleted_at==='string'&&Number.isFinite(Date.parse(response.deleted_at)),saved:()=>crmCopy('archive_saved','CRM-record gearchiveerd'),refresh:async()=>{await Promise.all([loadRecords(),loadStatus()]);}};state.actionWrites.archive=run;return executeCrmAction('archive',run);
}

const CRM_TRIGGER_NAMES=new Set(['new_lead','stage_change','no_contact','appointment','quote','deal_won','deal_lost','product_interest','campaign_source','score_threshold','webhook']);
const CRM_ACTION_NAMES=new Set(['task','notify','assign','message','email','follow_up','field_update','stage_change','webhook','zero_task']);
function crmAutomationLabel(kind,value){return (kind==='trigger'?CRM_TRIGGER_NAMES:CRM_ACTION_NAMES).has(value)?crmSource(kind+'.'+value):crmSourceValue(value);}
async function loadAutomations(){const generation=++state.automationsGeneration,access=state.crmAccessGeneration,current=()=>generation===state.automationsGeneration&&access===state.crmAccessGeneration,host=$('#automationList');crmRender(host,crmCopy('source_loading','CRM-brongegevens laden…'));try{const response=await api('/api/crm/automations?limit=100&sort=updated_at&order=desc');if(!current())return null;const rows=Array.isArray(response.items)?response.items:null;if(!rows){crmRender(host,crmNoData());return;}host.replaceChildren();if(!rows.length){crmRender(host,crmSource('automations_empty'));return;}for(const row of rows){if(!row||typeof row!=='object'){host.append(crmElement('p',crmNoData()));continue;}const node=crmElement('article');node.append(crmElement('h3',crmSourceValue(row.name)),crmSourceField(crmSource('trigger'),crmAutomationLabel('trigger',row.trigger?.type||row.trigger)),crmSourceField(crmSource('actions'),Array.isArray(row.actions)?crmLive(()=>row.actions.map(action=>String(crmAutomationLabel('action',action?.type))).join(', ')):crmNoData()),crmElement('p',row.enabled===false?crmSource('disabled'):row.enabled===true?crmSource('enabled'):crmUnknown()));host.append(node);}}catch(error){if(current())crmRender(host,crmError(error));throw error;}}

async function saveAutomation(event){
 event.preventDefault();const form=event.currentTarget;
 return saveCrmForm('automation',form,()=>{const data=Object.fromEntries(new FormData(form).entries());return {path:'/api/crm/automations',request:Object.freeze({method:'POST',headers:Object.freeze({'idempotency-key':`automation-${crypto.randomUUID()}`}),body:JSON.stringify({name:data.name,enabled:true,trigger:{type:data.trigger},actions:[{type:data.action,title:String(crmCopy('automation_follow_up','{name} · opvolging',{name:data.name}))}]})})};},async()=>{form.reset();await loadAutomations();toast(crmCopy('automation_saved','Automation opgeslagen'));},crmCopy('automation_saved','Automation opgeslagen'));
}

async function provision(event){
  event.preventDefault();if(state.provisionBusy)return;const form=event.currentTarget,i18n=globalThis.FoundlyI18n,submit=form.querySelector('button[type="submit"]');
  if(!state.provisionNotice){state.provisionNotice=document.createElement('output');state.provisionNotice.setAttribute('role','status');form.append(state.provisionNotice);}
  const notice=(key,params={})=>i18n.bind?i18n.bind(state.provisionNotice,key,undefined,params):(state.provisionNotice.textContent=i18n.t(key,params));
  if(!state.provisionRequest){const data=Object.fromEntries(new FormData(form).entries());if(['business_name','country','industry','segment'].some(key=>!String(data[key]||'').trim())){notice('common.required');return;}data.defaults_locale=i18n.locale;state.provisionRequest={id:crypto.randomUUID(),body:JSON.stringify(data),controls:[...form.querySelectorAll('input,select,textarea')].map(node=>({node,disabled:node.disabled}))};}
  const pending=state.provisionRequest,access=state.crmAccessGeneration,current=()=>state.provisionRun===pending&&state.crmAccessGeneration===access;state.provisionRun=pending;state.provisionBusy=true;submit.disabled=true;for(const {node}of pending.controls)node.disabled=true;notice('crm.profile.retry');
  const release=()=>{for(const {node,disabled}of pending.controls)node.disabled=disabled;state.provisionRequest=null;};
  try{
    let result;try{result=await api('/api/crm/provision',{method:'POST',headers:{'idempotency-key':`provision-${pending.id}`},body:pending.body});if(!current())return;
      const record=row=>row&&typeof row.id==='string'&&row.id&&Number.isSafeInteger(row.revision)&&row.revision>0;
      if(result?.ok!==true||!['RECORDED_ATOMIC','LEGACY_OUTCOME_UNVERIFIED'].includes(result.configuration_status)||typeof result.profile?.business_name!=='string'||!record(result.tenant_record)||!record(result.pipeline)||!record(result.dashboard)||!Array.isArray(result.stages)||result.stages.length!==6||new Set(result.stages.map(row=>row?.id)).size!==6||!result.stages.every(row=>record(row)&&row.pipeline_id===result.pipeline.id))throw Error('CRM profile response unavailable');
    }catch(error){if(current()){const definitive=error.status>=400&&error.status<500&&![408,429].includes(error.status)||['crm_profile_invalid','crm_profile_locale_invalid'].includes(error.code||error.data?.code);if(definitive)release();notice(definitive?'common.request_failed':'crm.profile.retry');}throw error;}
    release();form.reset();notice(result.configuration_status==='LEGACY_OUTCOME_UNVERIFIED'?'crm.profile.legacy_review':'crm.profile.created',{name:result.profile.business_name});
    try{await loadStatus();}catch(error){if(current())notice('crm.dashboard.saved_refresh_failed');}
  }finally{if(state.provisionRun===pending){state.provisionRun=null;state.provisionBusy=false;submit.disabled=false;}}
}

function runUiCommands(commands=[]){for(const command of commands){if(command.type==='OPEN_ENGINE'&&['analysis','finance'].includes(command.target)){location.href=`/${command.target}`;return}if(command.type==='OPEN_ENGINE'&&command.target==='crm')setView('dashboard');if(command.type==='FOCUS_NODE'&&command.target==='crm')setView('dashboard');if(command.type==='SHOW_TASK')setView('records','tasks')}}
async function runZero(event){
 event.preventDefault();const input=$('#zeroInput'),message=input.value.trim();if(!message||state.zeroBusy)return;const generation=++state.zeroGeneration,access=state.crmAccessGeneration,current=()=>generation===state.zeroGeneration&&access===state.crmAccessGeneration;state.zeroBusy=true;crmRender($('#zeroOutput'),crmCopy('zero_loading','ZERO analyseert de CRM-context…'));
 try{const result=await api('/api/zero/turn',{method:'POST',body:JSON.stringify({message,conversation_id:sessionStorage.foundlyCrmConversation||(sessionStorage.foundlyCrmConversation=crypto.randomUUID()),turn_id:crypto.randomUUID(),client_context:{surface:'crm',timezone:Intl.DateTimeFormat().resolvedOptions().timeZone}})});if(!current())return;const answer=result.display_text||result.answer;if(typeof answer!=='string')throw new Error('CRM ZERO response unavailable');crmRender($('#zeroOutput'),answer);if(input.value.trim()===message)input.value='';runUiCommands(Array.isArray(result.ui_commands)?result.ui_commands:[]);if(result.modules?.includes('crm'))await Promise.allSettled([loadStatus(),loadDashboard()]);}
 catch(error){if(current()){crmRender($('#zeroOutput'),crmError(error));showError(error);}}
 finally{if(current())state.zeroBusy=false;}
}

function filterCommandPalette(){const query=$('#commandSearch').value.trim().toLocaleLowerCase(globalThis.FoundlyI18n?.locale||'nl-NL');$$('#commandList button').forEach(button=>button.hidden=Boolean(query&&!button.textContent.toLocaleLowerCase(globalThis.FoundlyI18n?.locale||'nl-NL').includes(query)))}
function openCommandPalette(){const dialog=$('#commandDialog');if(!dialog.open)dialog.showModal();$('#commandSearch').value='';filterCommandPalette();requestAnimationFrame(()=>$('#commandSearch').focus())}
function closeCommandPalette(){const dialog=$('#commandDialog');if(dialog.open)dialog.close()}

function bind(){
  $$('#crmNav button').forEach(button=>button.onclick=()=>setView(button.dataset.view,button.dataset.entity,button.dataset.section));$('#recordEntity').onchange=()=>{state.entity=$('#recordEntity').value;crmViewTitle('records',state.entity);loadRecords().catch(showError)};$('#recordSearch').oninput=()=>{clearTimeout(bind.searchTimer);bind.searchTimer=setTimeout(()=>loadRecords().catch(showError),220)};$('#refreshRecords').onclick=()=>loadRecords().catch(showError);$('#createRecord').onclick=()=>openRecordDialog();$('#newRecord').onclick=()=>{const active=$('.view.active')?.id;if(active==='view-pipeline')openPipelineDialog();else{if(active!=='view-records')setView('records','leads');openRecordDialog()}};$('#recordForm').onsubmit=event=>saveRecord(event).catch(showError);
  $('#refreshDashboard').onclick=()=>refreshDashboardData().catch(showError);$('#dashboardPreset').onchange=()=>loadDashboard({forcePreset:true}).catch(showError);for(const node of [$('#dateFrom'),$('#dateTo'),$('#comparePeriod'),$('#dashboardStatusFilter'),$('#dashboardOwnerFilter'),$('#dashboardSourceFilter')])node.onchange=()=>refreshDashboardData().catch(showError);$('#dashboardShare').onchange=()=>$('#dashboardTeamWrap').classList.toggle('hidden',$('#dashboardShare').value!=='TEAM');$('#editDashboard').onclick=()=>{if(!state.dashboard||state.dashboardRequest)return;state.editing=!state.editing;renderDashboard()};$('#saveDashboard').onclick=()=>saveDashboard().catch(showError);$('#addWidget').onclick=()=>{if(state.dashboard&&!state.dashboardRequest)$('#widgetDialog').showModal();};$('#widgetForm').onsubmit=event=>{event.preventDefault();if(state.dashboardRequest||!Array.isArray(state.dashboard?.widgets))return;const input=Object.fromEntries(new FormData(event.currentTarget).entries());state.dashboard.widgets.push({id:`widget-${crypto.randomUUID()}`,type:input.type,metric:input.metric,x:0,y:0,w:input.type==='KPI'?4:8,h:input.type==='KPI'?2:4,filters:{}});packWidgets(state.dashboard.widgets);state.editing=true;$('#widgetDialog').close();event.currentTarget.reset();renderDashboard()};
  $('#pipelineSelect').onchange=()=>loadPipelineBoard($('#pipelineSelect').value).catch(showError);$('#refreshPipeline').onclick=()=>loadPipelines().catch(showError);$('#createPipeline').onclick=openPipelineDialog;$('#pipelineForm').onsubmit=event=>createPipeline(event).catch(showError);$('#automationForm').onsubmit=event=>saveAutomation(event).catch(showError);$('#provisionForm').onsubmit=event=>provision(event).catch(showError);$('#zeroForm').onsubmit=runZero;$('#commandButton').onclick=openCommandPalette;$('#commandSearch').oninput=filterCommandPalette;$$('#commandList [data-command-view]').forEach(button=>button.onclick=()=>{closeCommandPalette();setView(button.dataset.commandView,button.dataset.commandEntity)});$('#commandList [data-command-zero]').onclick=()=>{closeCommandPalette();$('#zeroInput').focus()};document.addEventListener('keydown',event=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();openCommandPalette()}if(event.key==='/'&&!/input|textarea|select/i.test(document.activeElement?.tagName)){event.preventDefault();$('#zeroInput').focus()}});
}

async function init(){await globalThis.FoundlyI18n?.ready;const today=new Date(),from=new Date(today);from.setDate(from.getDate()-29);$('#dateFrom').value=localDate(from);$('#dateTo').value=localDate(today);bind();try{await Promise.all([loadStatus(),loadSchema(),loadDashboard()]);const section=new URLSearchParams(location.search).get('section'),target=$$('#crmNav button').find(button=>button.dataset.section===section&&!button.hidden&&!button.disabled);if(target)target.click();if(state.summary)crmFreshness();setInterval(pollLiveStatus,5000)}catch(error){showError(error);crmRender($('#crmConnection'),crmError(error))}}
init();
