'use strict';

const $ = selector => document.querySelector(selector);
const state = { loading:null,loadGeneration:0,accessGeneration:0,reportGeneration:0,accessAllowed:true,reportsAllowed:false,zeroBusy:false,exportBusy:false,status: null, entities: [], dashboard: null, reports: null };
const MONEY_LABELS = { revenue: 'Omzet', gross_margin: 'Brutomarge', operating_result: 'Operationeel resultaat', cash: 'Cash', receivables: 'Debiteuren', payables: 'Crediteuren', overdue: 'Achterstallig', vat_position: 'BTW-positie' };

async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { accept: 'application/json', ...(options.body ? { 'content-type': 'application/json' } : {}), ...(options.headers || {}) } });
  const text = await response.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; }
  catch { data = { error: text || `HTTP ${response.status}` }; }
  if (!response.ok) throw Object.assign(new Error(data.error || data.code || `HTTP ${response.status}`), { status: response.status, data });
  return data;
}

let financeTransport='native';const financeConversation=crypto.randomUUID();
async function financeRequest(path,options={}){
 if(!state.accessAllowed)throw Object.assign(new Error('Finance access is unavailable'),{status:403});
 const generation=state.accessGeneration;
 try{
 if(financeTransport!=='zero'){const result=await api(path,options);if(generation!==state.accessGeneration)throw Object.assign(new Error('Finance access changed'),{status:403});return result;}
 let action;const data=options.body?JSON.parse(options.body):{};
 if(path==='/api/finance/forecast-scenarios')action={operation:'SCENARIO',input:data};
 else {const match=path.match(/^\/api\/finance\/periods\/([^/]+)\/(close-preview|close)$/);if(match)action={operation:match[2]==='close'?'CLOSE':'PREVIEW_CLOSE',input:{period_id:decodeURIComponent(match[1]),...data}};}
 if(!action){const result=await api(path,options);if(generation!==state.accessGeneration)throw Object.assign(new Error('Finance access changed'),{status:403});return result;}
 const result=await api('/api/zero/turn',{method:'POST',body:JSON.stringify({message:'Gekozen Finance-actie',conversation_id:financeConversation,turn_id:action.operation==='CLOSE'?data.request_id:crypto.randomUUID(),client_context:{finance_action:action}})});if(generation!==state.accessGeneration)throw Object.assign(new Error('Finance access changed'),{status:403});return result.finance_data;
 }catch(error){if(generation===state.accessGeneration&&[401,403].includes(error.status))invalidateFinanceAccess();throw error;}
}
$('#financeTransport').addEventListener('change',()=>{if([state.scenarioView,state.closeView].some(view=>view?.isConnected&&!view.canLeave())){$('#financeTransport').value=financeTransport;return;}financeTransport=$('#financeTransport').value;});

const financeCopy=(key,fallback,params={})=>globalThis.FoundlyI18n?FoundlyI18n.message('finance.page.'+key,params):String(fallback).replace(/\{([a-z_]+)\}/g,(_,name)=>String(params[name]??''));
const financeLive=read=>Object.freeze({toString:read}),financeUnknown=()=>globalThis.FoundlyI18n?FoundlyI18n.message('common.unknown'):'Onbekend',financeNoData=()=>globalThis.FoundlyI18n?FoundlyI18n.message('common.no_data'):'Geen brondata';
const financeValue=value=>financeCopy('value','{value}',{value}),financeAmount=(value,currency=state.reports?.currency)=>financeValue(financeLive(()=>money(value,currency))),financeNumber=(value,positive=false)=>financeLive(()=>Number.isSafeInteger(value)&&value>=(positive?1:0)?new Intl.NumberFormat(globalThis.FoundlyI18n?.locale||'nl-NL').format(value):String(financeUnknown()));
function financeRender(node,value){if(globalThis.FoundlyI18n)FoundlyI18n.renderText(node,value);else node.textContent=String(value??'');return node;}
function financeElement(tag,value='',className){const node=financeRender(document.createElement(tag),value);if(className)node.className=className;return node;}
function financeStack(host,rows){host.replaceChildren(...rows.map(([key,label,value])=>{const row=financeElement('div','','stack-row');row.append(financeElement('strong',key?financeCopy(key,label):label),financeElement('span',value));return row;}));}
function financeEnum(value){return ['REVENUE','EXPENSE','ASSET','LIABILITY','EQUITY','POSTED','REVERSAL','CORRECTION','OPEN','CLOSED'].includes(value)?financeCopy('enum.'+value.toLowerCase(),value):value||financeUnknown();}
const financeObserved=value=>financeLive(()=>typeof value==='string'&&value&&Number.isFinite(Date.parse(value))?new Intl.DateTimeFormat(globalThis.FoundlyI18n?.locale||'nl-NL',{dateStyle:'medium',timeStyle:'medium',timeZone:'UTC'}).format(new Date(value)):String(financeUnknown()));

function money(value,currency) { if(!Number.isSafeInteger(value)||!/^[A-Z]{3}$/.test(currency))return globalThis.FoundlyI18n?.t('common.unknown')||'Onbekend';return globalThis.FoundlyI18n?.currencyCents(value,currency)||new Intl.NumberFormat('nl-NL',{style:'currency',currency,minimumFractionDigits:2,maximumFractionDigits:2}).format(value/100); }
function formatDate(value) { if(typeof value!=='string'||!value||!Number.isFinite(Date.parse(value)))return globalThis.FoundlyI18n?.t('common.unknown')||'Onbekend';return new Intl.DateTimeFormat(globalThis.FoundlyI18n?.locale||'nl-NL',{dateStyle:'medium',timeZone:'UTC'}).format(new Date(value)); }
function filters() {
  const params = new URLSearchParams();
  if ($('#financeEntity').value) params.set('legal_entity_id', $('#financeEntity').value);
  if ($('#financeFrom').value) params.set('from', `${$('#financeFrom').value}T00:00:00.000Z`);
  if ($('#financeTo').value) params.set('to', `${$('#financeTo').value}T23:59:59.999Z`);
  return params;
}

function financeErrorText(error){return globalThis.FoundlyI18n?FoundlyI18n.message(error.status===401?'identity.auth_required':FoundlyI18n.errorKey(error.data?.code,error.status)):'Aanvraag mislukt';}
function unavailable(name){const component=state.loading?.components?.[name];return component?.status==='DISABLED'?financeCopy('disabled','Dit onderdeel is uitgeschakeld of niet beschikbaar binnen je toegang.'):component?.status==='ERROR'?financeCopy('component_error','Dit onderdeel kon niet laden: {reason}',{reason:financeErrorText({status:component.status_code})}):null;}

function financeControlState(){const unavailable=!state.accessAllowed||!state.reportsAllowed;$('#exportFinance').disabled=unavailable||state.exportBusy;$('#financeZeroInput').disabled=unavailable||state.zeroBusy;$('#financeZeroForm button').disabled=unavailable||state.zeroBusy;}
function invalidateFinanceAccess(){
 state.accessGeneration++;state.reportGeneration++;state.accessAllowed=state.reportsAllowed=false;state.zeroBusy=state.exportBusy=false;state.loading=state.status=state.dashboard=state.reports=null;state.entities=[];
 for(const id of ['financeKpis','financePnl','financeJournal','financeAging','financeForecast','financeComplianceContent','financePeriodClosing','financeEntity','financeZeroOutput'])$('#'+id).replaceChildren();
 state.scenarioView=state.closeView=null;$('#financeEntity').disabled=true;$('#financePnlEmpty').classList.remove('hidden');$('#financeJournalEmpty').classList.remove('hidden');
 for(const id of ['financePnlEmpty','financeJournalEmpty','journalCount','financeAgingBadge']){const node=$('#'+id);if(globalThis.FoundlyI18n)FoundlyI18n.renderText(node,FoundlyI18n.message('common.unknown'));else node.textContent='Onbekend';}
 financeControlState();$('#financeConnection').className='status-pill error';financeRender($('#financeConnection'),financeCopy('unavailable','Niet beschikbaar'));$('#financeNotice').className='notice error';financeRender($('#financeNotice'),financeErrorText({status:403}));
}
function mountPeriodClosing(){
 const required=['finance:ledger','finance:invoices','finance:payments'],enabled=required.every(cap=>state.loading?.capabilities?.includes(cap));
 if(!enabled){$('#financePeriodClosing').replaceChildren();state.closeView=null;return;}
 if(window.FoundlyFinancePeriodClosing&&!state.closeView?.isConnected){const generation=state.accessGeneration;state.closeView=window.FoundlyFinancePeriodClosing.create({document,request:financeRequest,isActive:()=>state.accessAllowed&&state.accessGeneration===generation});$('#financePeriodClosing').append(state.closeView);}
}

function renderEntities(){
 const selected=state.loading?.selected_entity_id||'',host=$('#financeEntity'),option=financeElement('option',financeCopy('all_entities','Alle entiteiten'));option.value='';const rows=[option];
 for(const entity of state.entities){const node=financeElement('option',entity.name);node.value=entity.id;rows.push(node);}
 if(selected&&!state.entities.some(entity=>entity.id===selected)){const node=financeElement('option',financeCopy('retained_filter','Bestaand entiteitsfilter behouden'));node.value=selected;rows.push(node);}host.replaceChildren(...rows);host.value=selected;host.disabled=Boolean(unavailable('entities'));
}
function renderKpis(){
 const host=$('#financeKpis'),reason=unavailable('dashboard');host.replaceChildren();if(reason){host.append(financeElement('div',reason,'empty'));return;}
 const groups=Array.isArray(state.dashboard?.currency_groups)&&state.dashboard.currency_groups.length>1?state.dashboard.currency_groups:[state.dashboard],widgets=groups.flatMap(group=>(Array.isArray(group?.widgets)?group.widgets:[]).filter(widget=>Object.hasOwn(MONEY_LABELS,widget.id)).map(widget=>({...widget,currency:widget.currency??group.currency??state.reports?.currency})));
 for(const widget of widgets){const card=financeElement('article','','kpi-card'),valid=widget.available===undefined||widget.available===true,label=financeCopy('kpi.'+widget.id,MONEY_LABELS[widget.id]);card.append(financeElement('h2',groups.length>1?financeValue(financeLive(()=>String(label)+' · '+(widget.currency||String(financeUnknown())))):label),financeElement('strong',valid?financeAmount(widget.value_cents,widget.currency):financeUnknown(),'kpi-value'),financeElement('span',state.dashboard.source==='posted_immutable_journal_entries'?financeCopy('posted_source','Geboekte, onveranderlijke journaalposten'):state.dashboard.source||financeUnknown(),'kpi-meta'));host.append(card);}
 if(!widgets.length)host.append(financeElement('div',financeNoData(),'empty'));
}
function renderPnl(){
 const known=Array.isArray(state.reports?.profit_and_loss?.rows),rows=known?state.reports.profit_and_loss.rows:[],host=$('#financePnl');host.replaceChildren();
 for(const row of rows){const tr=financeElement('tr');tr.append(financeElement('td',financeCopy('account','{code} · {name}',{code:row.code??financeUnknown(),name:row.name??financeUnknown()})),financeElement('td',financeEnum(row.type)),financeElement('td',financeAmount(row.debit_cents,row.currency??state.reports?.currency)),financeElement('td',financeAmount(row.credit_cents,row.currency??state.reports?.currency)),financeElement('td',financeAmount(row.balance_cents,row.currency??state.reports?.currency),Number.isSafeInteger(row.balance_cents)?row.balance_cents<0?'negative':'positive':''));host.append(tr);}
 $('#financePnlEmpty').classList.toggle('hidden',rows.length>0);financeRender($('#financePnlEmpty'),rows.length?'':known?financeCopy('pnl_empty','Nog geen geboekte omzet- of kostenregels voor deze selectie.'):financeNoData());
}
function renderAging(){
 const ar=state.reports?.ar_aging,ap=state.reports?.ap_aging,host=$('#financeAging');if(!ar||!ap){host.replaceChildren(financeElement('div',financeCopy('aging_empty','Geen agingdata beschikbaar.'),'empty'));financeRender($('#financeAgingBadge'),financeUnknown());return;}
 const values=['1_30','31_60','61_90','over_90'].map(key=>ar.buckets?.[key]),sum=values.every(value=>Number.isSafeInteger(value)&&value>=0)?values.reduce((total,value)=>total+BigInt(value),0n):null,overdue=sum!==null&&sum<=BigInt(Number.MAX_SAFE_INTEGER)?Number(sum):null;
 financeRender($('#financeAgingBadge'),overdue===null?financeUnknown():overdue?financeCopy('overdue','{amount} ACHTERSTALLIG',{amount:financeLive(()=>money(overdue,ar.currency??state.reports?.currency))}):financeCopy('no_overdue','GEEN ACHTERSTAND'));
 financeStack(host,[['open_ar','Open debiteuren',financeAmount(ar.total_cents)],['open_ap','Open crediteuren',financeAmount(ap.total_cents)],['ar_1_30','Debiteuren 1–30 dagen',financeAmount(ar.buckets?.['1_30'])],['ar_31_60','Debiteuren 31–60 dagen',financeAmount(ar.buckets?.['31_60'])],['ar_61_90','Debiteuren 61–90 dagen',financeAmount(ar.buckets?.['61_90'])],['ar_90','Debiteuren >90 dagen',financeAmount(ar.buckets?.over_90)]]);
}
function renderForecast(){
 const budget=state.reports?.budget_vs_actual,forecast=state.reports?.cash_forecast,rows=[];
 if(budget?.available===true)rows.push(['budget_approved','Goedgekeurd budget',financeAmount(budget.budget_cents,budget.currency??state.reports?.currency)],['actual','Werkelijk',financeAmount(budget.actual_cents,budget.currency??state.reports?.currency)],['variance','Verschil',financeAmount(budget.variance_cents,budget.currency??state.reports?.currency)]);
 else rows.push(['budget','Budget',budget?.reason&&budget.reason!=='Geen goedgekeurd budget ingeladen'?budget.reason:financeCopy('no_budget','Geen goedgekeurd budget ingeladen')]);
 if(forecast?.available===true){const currency=forecast.currency||state.reports?.currency;rows.push(['opening','Forecast beginsaldo',financeAmount(forecast.opening_cash_cents,currency)],[null,financeCopy('horizon','Forecast {days} dagen',{days:financeNumber(forecast.horizon_days,true)}),financeAmount(forecast.closing_cash_cents,currency)],['assumptions','Aannames',financeValue(financeNumber(Array.isArray(forecast.assumptions)?forecast.assumptions.length:null))]);}
 else rows.push(['forecast','Cashforecast',forecast?.reason&&forecast.reason!=='Geen forecastaannames of open cashplanning ingeladen'?forecast.reason:financeCopy('no_forecast','Geen forecastaannames of open cashplanning ingeladen')]);
 financeStack($('#financeForecast'),rows);
 if(forecast?.available===true&&window.FoundlyFinanceCashScenarios){const generation=state.loadGeneration,access=state.accessGeneration;state.scenarioView=window.FoundlyFinanceCashScenarios.create({document,request:financeRequest,forecastId:forecast.forecast_id,isActive:()=>state.accessAllowed&&state.accessGeneration===access&&state.loadGeneration===generation});$('#financeForecast').append(state.scenarioView);}
}
function renderCompliance(){
 const reports=state.reports,status=state.status,balanced=reports?.trial_balance?.balanced,contract=status?.schema?.posting_contract,gate=status?.schema?.purchase_posting_gate;
 financeStack($('#financeComplianceContent'),[['output_vat','Uitgaande BTW',financeAmount(reports?.vat_summary?.output_vat_cents)],['input_vat','Voorbelasting',financeAmount(reports?.vat_summary?.input_vat_cents)],['kpi.vat_position','BTW-positie',financeAmount(reports?.vat_summary?.position_cents)],['trial_balance','Proefbalans',balanced===true?financeCopy('balanced','IN BALANS'):balanced===false?financeCopy('unbalanced','NIET IN BALANS'):financeUnknown()],['posting_contract','Postingcontract',contract==='sum_debit_equals_sum_credit'?financeCopy('equal_totals','Totaal debet is gelijk aan totaal credit'):contract||financeUnknown()],['purchase_gate','Inkoopgoedkeuring',gate==='APPROVED_REQUIRED'?financeCopy('approval_required','Goedkeuring vereist'):gate||financeUnknown()]]);
}
function renderJournal(){
 const known=Array.isArray(state.reports?.general_ledger?.entries),entries=known?state.reports.general_ledger.entries:[],host=$('#financeJournal');financeRender($('#journalCount'),known?financeCopy('entries','{value} POSTEN',{value:financeNumber(entries.length)}):financeUnknown());host.replaceChildren();
 for(const entry of entries.slice(-200).reverse()){const row=financeElement('tr');row.append(financeElement('td',entry.entry_number??financeUnknown(),'mono'),financeElement('td',financeValue(financeLive(()=>formatDate(entry.date)))),financeElement('td',financeEnum(entry.entry_type||entry.status)),financeElement('td',entry.description),financeElement('td',financeEnum(entry.status)),financeElement('td',entry.source||financeUnknown()));host.append(row);}
 $('#financeJournalEmpty').classList.toggle('hidden',entries.length>0);financeRender($('#financeJournalEmpty'),entries.length?'':known?financeCopy('journal_empty','Nog geen geboekte journaalposten. Concepten worden niet als financiële werkelijkheid weergegeven.'):financeNoData());
}

async function load(refreshEntities = false) {
  await globalThis.FoundlyI18n?.ready;
  if([state.scenarioView,state.closeView].some(view=>view?.isConnected&&!view.canLeave())){
    $('#financeEntity').value=state.loading?.selected_entity_id||'';
    // Preserve a pending confirmation or authored draft when access is unchanged,
    // while still observing a current revocation on an explicit refresh.
    const access=state.accessGeneration;
    try{const {resolution}=await api('/api/composition');if(access!==state.accessGeneration)return;if(!resolution.visible_modules.includes('finance')){invalidateFinanceAccess();return;}if((state.loading?.capabilities||[]).some(cap=>!resolution.capabilities.includes(cap))){invalidateFinanceAccess();return load(refreshEntities);}}
    catch(error){if(access===state.accessGeneration){if([401,403].includes(error.status))invalidateFinanceAccess();financeRender($('#financeNotice'),financeErrorText(error));}}return;
  }
  const generation=++state.loadGeneration;
  const notice = $('#financeNotice');
  notice.className = 'notice';
  financeRender(notice,financeCopy('loading','Financiële administratie laden…'));
  try {
    const access=state.accessGeneration,loaded=await window.FoundlyFinanceLoading.load(api,filters());if(generation!==state.loadGeneration||access!==state.accessGeneration)return;
    if(Object.values(loaded.components).some(component=>component.status_code===401))throw Object.assign(new Error('Finance authentication is unavailable'),{status:401});
    state.loading=loaded;state.accessAllowed=true;state.reportsAllowed=loaded.components.reports?.status==='AVAILABLE';if(!state.reportsAllowed){state.reportGeneration++;$('#financeZeroOutput').replaceChildren();state.zeroBusy=state.exportBusy=false;}
    Object.assign(state,{status:loaded.status,entities:loaded.entities,dashboard:loaded.dashboard,reports:loaded.reports});renderEntities();
    renderKpis();
    const reportError=unavailable('reports');
    if(reportError){for(const selector of ['#financePnl','#financeJournal'])$(selector).replaceChildren();for(const selector of ['#financePnlEmpty','#financeJournalEmpty']){$(selector).classList.remove('hidden');financeRender($(selector),reportError);}for(const selector of ['#financeAging','#financeForecast','#financeComplianceContent'])$(selector).replaceChildren(financeElement('div',reportError,'empty'));financeRender($('#journalCount'),financeUnknown());financeRender($('#financeAgingBadge'),financeUnknown());}
    else{renderPnl();renderAging();renderForecast();renderCompliance();renderJournal();}
    const durable = state.status?.persistence?.durable===true;
    notice.className=state.loading.loading_status==='PARTIAL'?'notice error':'notice';
    financeRender(notice,unavailable('reports')||financeCopy('loaded','Financiële rapportages geladen · {storage} · {observed} UTC{entities}',{storage:durable?financeCopy('durable','Duurzame opslag waargenomen'):financeCopy('durable_unknown','Duurzame productieopslag niet bewezen'),observed:financeObserved(state.reports?.observed_at),entities:unavailable('entities')?financeCopy('entities_unavailable',' · Entiteitenlijst niet beschikbaar; bestaand filter behouden.'):''}));
    $('#financeConnection').className='status-pill';financeRender($('#financeConnection'),state.loading.loading_status==='PARTIAL'?financeCopy('partial','DEELS BESCHIKBAAR'):financeCopy('reachable','API BEREIKBAAR'));
    mountPeriodClosing();financeControlState();
  } catch (error) {
    if(generation!==state.loadGeneration)return;
    invalidateFinanceAccess();
    notice.className = 'notice error';
    financeRender(notice,financeCopy('load_error','Finance niet beschikbaar: {reason}',{reason:financeErrorText(error)}));
    $('#financeConnection').className = 'status-pill error';
    financeRender($('#financeConnection'),error.status===401?financeCopy('auth_required','AUTH VEREIST'):financeCopy('error','FOUT'));
  }
}

async function askZero(event) {
  event.preventDefault();
  if(!state.accessAllowed||!state.reportsAllowed||state.zeroBusy)return;
  const input = $('#financeZeroInput');
  const message = input.value.trim();
  if (!message) return;
  const access=state.accessGeneration,reports=state.reportGeneration;state.zeroBusy=true;financeControlState();
  input.value = '';
  financeRender($('#financeZeroOutput'),financeCopy('zero_loading','ZERO controleert geboekte journaaldata…'));
  try {
    const result = await api('/api/zero/turn', { method: 'POST', body: JSON.stringify({ message, conversation_id: sessionStorage.foundlyFinanceConversation || (sessionStorage.foundlyFinanceConversation = crypto.randomUUID()), turn_id: crypto.randomUUID(), preferred_module: 'finance', client_context: { surface: 'finance', legal_entity_id: $('#financeEntity').value || null, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone } }) });
    if(access!==state.accessGeneration||reports!==state.reportGeneration||!state.reportsAllowed)return;
    financeRender($('#financeZeroOutput'),result.display_text||result.answer||financeCopy('zero_empty','ZERO leverde geen tekstantwoord.'));
  } catch (error) { if(access===state.accessGeneration&&reports===state.reportGeneration){if(error.status===401)invalidateFinanceAccess();financeRender($('#financeZeroOutput'),financeErrorText(error));} }
  finally{if(access===state.accessGeneration&&reports===state.reportGeneration){state.zeroBusy=false;financeControlState();}}
}

async function exportJournal() {
  if(!state.accessAllowed||!state.reportsAllowed||state.exportBusy)return;const access=state.accessGeneration,reports=state.reportGeneration;state.exportBusy=true;financeControlState();
  const filters = {};
  if ($('#financeEntity').value) filters.legal_entity_id = $('#financeEntity').value;
  if ($('#financeFrom').value) filters.from = `${$('#financeFrom').value}T00:00:00.000Z`;
  if ($('#financeTo').value) filters.to = `${$('#financeTo').value}T23:59:59.999Z`;
  try {
    const result = await api('/api/finance/exports', { method: 'POST', body: JSON.stringify({ scope: 'journal_entries', format: 'CSV', filters }) });
    if(access!==state.accessGeneration||reports!==state.reportGeneration||!state.reportsAllowed)return;
    if(typeof result.content!=='string')throw Object.assign(new Error('Invalid Finance export response'),{code:'finance_response_invalid'});
    const blob = new Blob([result.content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `foundly-finance-journal-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    $('#financeNotice').className = 'notice success';
    financeRender($('#financeNotice'),financeCopy('exported','{value} journaalrecords geëxporteerd.',{value:financeNumber(result.count)}));
  } catch (error) {
    if(access!==state.accessGeneration||reports!==state.reportGeneration)return;if([401,403].includes(error.status))invalidateFinanceAccess();
    $('#financeNotice').className = 'notice error';
    financeRender($('#financeNotice'),financeCopy('export_error','Finance-export mislukt: {reason}',{reason:financeErrorText(error)}));
  }finally{if(access===state.accessGeneration&&reports===state.reportGeneration){state.exportBusy=false;financeControlState();}}
}

$('#refreshFinance').addEventListener('click', () => load(true));
$('#financeEntity').addEventListener('change', () => load(false));
$('#exportFinance').addEventListener('click', exportJournal);
$('#financeZeroForm').addEventListener('submit', askZero);
load(true);
