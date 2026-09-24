'use strict';

const $ = selector => document.querySelector(selector);
const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
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

function money(value,currency='EUR') { if(!Number.isSafeInteger(value)||!/^[A-Z]{3}$/.test(currency))return globalThis.FoundlyI18n?.t('common.unknown')||'Onbekend';return globalThis.FoundlyI18n?.currencyCents(value,currency)||new Intl.NumberFormat('nl-NL',{style:'currency',currency,minimumFractionDigits:2,maximumFractionDigits:2}).format(value/100); }
function formatDate(value) { if (!value) return '—'; const date = new Date(value); return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat((globalThis.FoundlyI18n?.locale||'nl-NL'), { dateStyle: 'medium', ...(/^\d{4}-\d{2}-\d{2}$/.test(String(value))?{timeZone:'UTC'}:{}) }).format(date); }
function filters() {
  const params = new URLSearchParams();
  if ($('#financeEntity').value) params.set('legal_entity_id', $('#financeEntity').value);
  if ($('#financeFrom').value) params.set('from', `${$('#financeFrom').value}T00:00:00.000Z`);
  if ($('#financeTo').value) params.set('to', `${$('#financeTo').value}T23:59:59.999Z`);
  return params;
}

function financeErrorText(error){return globalThis.FoundlyI18n?.t(error.status===401?'identity.auth_required':FoundlyI18n.errorKey(error.data?.code,error.status))||'Aanvraag mislukt';}
function unavailable(name){const component=state.loading?.components?.[name];return component?.status==='DISABLED'?'Dit onderdeel is uitgeschakeld of niet beschikbaar binnen je toegang.':component?.status==='ERROR'?'Dit onderdeel kon niet laden: '+financeErrorText({status:component.status_code}):null;}

function financeControlState(){const unavailable=!state.accessAllowed||!state.reportsAllowed;$('#exportFinance').disabled=unavailable||state.exportBusy;$('#financeZeroInput').disabled=unavailable||state.zeroBusy;$('#financeZeroForm button').disabled=unavailable||state.zeroBusy;}
function invalidateFinanceAccess(){
 state.accessGeneration++;state.reportGeneration++;state.accessAllowed=state.reportsAllowed=false;state.zeroBusy=state.exportBusy=false;state.loading=state.status=state.dashboard=state.reports=null;state.entities=[];
 for(const id of ['financeKpis','financePnl','financeJournal','financeAging','financeForecast','financeComplianceContent','financePeriodClosing','financeEntity','financeZeroOutput'])$('#'+id).replaceChildren();
 state.scenarioView=state.closeView=null;$('#financeEntity').disabled=true;$('#financePnlEmpty').classList.remove('hidden');$('#financeJournalEmpty').classList.remove('hidden');
 for(const id of ['financePnlEmpty','financeJournalEmpty','journalCount','financeAgingBadge']){const node=$('#'+id);if(globalThis.FoundlyI18n)FoundlyI18n.renderText(node,FoundlyI18n.message('common.unknown'));else node.textContent='Onbekend';}
 financeControlState();
}
function mountPeriodClosing(){
 const required=['finance:ledger','finance:invoices','finance:payments'],enabled=required.every(cap=>state.loading?.capabilities?.includes(cap));
 if(!enabled){$('#financePeriodClosing').replaceChildren();state.closeView=null;return;}
 if(window.FoundlyFinancePeriodClosing&&!state.closeView?.isConnected){const generation=state.accessGeneration;state.closeView=window.FoundlyFinancePeriodClosing.create({document,request:financeRequest,isActive:()=>state.accessAllowed&&state.accessGeneration===generation});$('#financePeriodClosing').append(state.closeView);}
}

function renderEntities() {
  const selected = state.loading?.selected_entity_id||'';
  $('#financeEntity').innerHTML = `<option value="">Alle entiteiten</option>${state.entities.map(entity => `<option value="${escapeHtml(entity.id)}">${escapeHtml(entity.name)}</option>`).join('')}`;
  if(selected&&!state.entities.some(entity=>entity.id===selected))$('#financeEntity').insertAdjacentHTML('beforeend',`<option value="${escapeHtml(selected)}">Bestaand entiteitsfilter behouden</option>`);
  $('#financeEntity').value=selected;$('#financeEntity').disabled=Boolean(unavailable('entities'));
}

function renderKpis() {
  const reason=unavailable('dashboard');if(reason){$('#financeKpis').innerHTML=`<div class="empty">${escapeHtml(reason)}</div>`;return;}
  const widgets = (state.dashboard?.widgets || []).filter(widget => MONEY_LABELS[widget.id]);
  $('#financeKpis').innerHTML = widgets.map(widget => `<article class="kpi-card"><h2>${escapeHtml(MONEY_LABELS[widget.id])}</h2><strong class="kpi-value">${escapeHtml(widget.available===false?'Niet beschikbaar':money(widget.value_cents))}</strong><span class="kpi-meta">${escapeHtml(state.dashboard.source || 'posted_immutable_journal_entries')}</span></article>`).join('');
}

function renderPnl() {
  const known=Array.isArray(state.reports?.profit_and_loss?.rows),rows=known?state.reports.profit_and_loss.rows:[];
  $('#financePnl').innerHTML = rows.map(row => `<tr><td>${escapeHtml(row.code)} · ${escapeHtml(row.name)}</td><td>${escapeHtml(row.type)}</td><td>${escapeHtml(money(row.debit_cents))}</td><td>${escapeHtml(money(row.credit_cents))}</td><td class="${Number(row.balance_cents) < 0 ? 'negative' : 'positive'}">${escapeHtml(money(row.balance_cents))}</td></tr>`).join('');
  $('#financePnlEmpty').classList.toggle('hidden', rows.length > 0);
  $('#financePnlEmpty').textContent = rows.length ? '' : known?'Nog geen geboekte omzet- of kostenregels voor deze selectie.':globalThis.FoundlyI18n?.t('common.no_data')||'Geen brondata';
}

function renderAging() {
  const ar = state.reports?.ar_aging;
  const ap = state.reports?.ap_aging;
  if (!ar || !ap) { $('#financeAging').innerHTML = '<div class="empty">Geen agingdata beschikbaar.</div>';if(globalThis.FoundlyI18n)FoundlyI18n.renderText($('#financeAgingBadge'),FoundlyI18n.message('common.unknown'));else $('#financeAgingBadge').textContent='Onbekend';return; }
  const values=['1_30','31_60','61_90','over_90'].map(key=>ar.buckets?.[key]),sum=values.every(value=>Number.isSafeInteger(value)&&value>=0)?values.reduce((total,value)=>total+BigInt(value),0n):null,overdue=sum!==null&&sum<=BigInt(Number.MAX_SAFE_INTEGER)?Number(sum):null;
  if(overdue===null&&globalThis.FoundlyI18n)FoundlyI18n.renderText($('#financeAgingBadge'),FoundlyI18n.message('common.unknown'));else $('#financeAgingBadge').textContent=overdue===null?'Onbekend':overdue?`${money(overdue)} OVERDUE`:'GEEN ACHTERSTAND';
  const rows = [
    ['Open debiteuren', money(ar.total_cents)],
    ['Open crediteuren', money(ap.total_cents)],
    ['Debiteuren 1–30 dagen', money(ar.buckets?.['1_30'])],
    ['Debiteuren 31–60 dagen', money(ar.buckets?.['31_60'])],
    ['Debiteuren 61–90 dagen', money(ar.buckets?.['61_90'])],
    ['Debiteuren >90 dagen', money(ar.buckets?.over_90)]
  ];
  $('#financeAging').innerHTML = rows.map(([label, value]) => `<div class="stack-row"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(value)}</span></div>`).join('');
}

function renderForecast() {
  const budget = state.reports?.budget_vs_actual;
  const forecast = state.reports?.cash_forecast;
  const rows = [];
  if (budget?.available===true) {
    rows.push(['Goedgekeurd budget', money(budget.budget_cents)], ['Werkelijk', money(budget.actual_cents)], ['Verschil', money(budget.variance_cents)]);
  } else rows.push(['Budget', budget?.reason || 'Geen goedgekeurd budget ingeladen']);
  if (forecast?.available===true) {
    const horizon=Number.isSafeInteger(forecast.horizon_days)&&forecast.horizon_days>0?forecast.horizon_days:globalThis.FoundlyI18n?.t('common.unknown')||'Onbekend';
    rows.push(['Forecast beginsaldo',money(forecast.opening_cash_cents,forecast.currency||state.reports?.currency||'EUR')], [`Forecast ${horizon} dagen`,money(forecast.closing_cash_cents,forecast.currency||state.reports?.currency||'EUR')], ['Aannames',Array.isArray(forecast.assumptions)?forecast.assumptions.length:globalThis.FoundlyI18n?.t('common.unknown')||'Onbekend']);
  } else rows.push(['Cashforecast', forecast?.reason || 'Geen forecast ingeladen']);
  $('#financeForecast').innerHTML = rows.map(([label, value]) => `<div class="stack-row"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(value)}</span></div>`).join('');
  if(forecast?.available===true&&window.FoundlyFinanceCashScenarios){const generation=state.loadGeneration,access=state.accessGeneration;state.scenarioView=window.FoundlyFinanceCashScenarios.create({document,request:financeRequest,forecastId:forecast.forecast_id,isActive:()=>state.accessAllowed&&state.accessGeneration===access&&state.loadGeneration===generation});$('#financeForecast').append(state.scenarioView);}
}

function renderCompliance() {
  const reports = state.reports;
  const status = state.status;
  const rows = [
    ['Uitgaande BTW', money(reports?.vat_summary?.output_vat_cents)],
    ['Voorbelasting', money(reports?.vat_summary?.input_vat_cents)],
    ['BTW-positie', money(reports?.vat_summary?.position_cents)],
    ['Proefbalans', reports?.trial_balance?.balanced===true?'IN BALANS':reports?.trial_balance?.balanced===false?'NIET IN BALANS':'NIET BESCHIKBAAR'],
    ['Postingcontract', status?.schema?.posting_contract || 'UNKNOWN'],
    ['Inkoopgoedkeuring', status?.schema?.purchase_posting_gate || 'UNKNOWN']
  ];
  $('#financeComplianceContent').innerHTML = rows.map(([label, value]) => `<div class="stack-row"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(value)}</span></div>`).join('');
}

function renderJournal() {
  const known=Array.isArray(state.reports?.general_ledger?.entries),entries=known?state.reports.general_ledger.entries:[];
  $('#journalCount').textContent = known?`${entries.length} ENTRIES`:globalThis.FoundlyI18n?.t('common.unknown')||'Onbekend';
  $('#financeJournal').innerHTML = entries.slice(-200).reverse().map(entry => `<tr><td class="mono">${escapeHtml(entry.entry_number)}</td><td>${escapeHtml(formatDate(entry.date))}</td><td>${escapeHtml(entry.entry_type)}</td><td>${escapeHtml(entry.description)}</td><td>${escapeHtml(entry.status)}</td><td>${escapeHtml(entry.source || 'manual')}</td></tr>`).join('');
  $('#financeJournalEmpty').classList.toggle('hidden', entries.length > 0);
  $('#financeJournalEmpty').textContent = entries.length ? '' : known?'Nog geen geboekte journaalposten. Concepten worden niet als financiële werkelijkheid weergegeven.':globalThis.FoundlyI18n?.t('common.no_data')||'Geen brondata';
}

async function load(refreshEntities = false) {
  await globalThis.FoundlyI18n?.ready;
  if([state.scenarioView,state.closeView].some(view=>view?.isConnected&&!view.canLeave())){
    $('#financeEntity').value=state.loading?.selected_entity_id||'';
    // Preserve a pending confirmation or authored draft when access is unchanged,
    // while still observing a current revocation on an explicit refresh.
    const access=state.accessGeneration;
    try{const {resolution}=await api('/api/composition');if(access!==state.accessGeneration)return;if(!resolution.visible_modules.includes('finance')){invalidateFinanceAccess();return;}if((state.loading?.capabilities||[]).some(cap=>!resolution.capabilities.includes(cap))){invalidateFinanceAccess();return load(refreshEntities);}}
    catch(error){if(access===state.accessGeneration){if([401,403].includes(error.status))invalidateFinanceAccess();$('#financeNotice').textContent=financeErrorText(error);}}return;
  }
  const generation=++state.loadGeneration;
  const notice = $('#financeNotice');
  notice.className = 'notice';
  notice.textContent = (globalThis.FoundlyI18n?globalThis.FoundlyI18n.t("static.3a5084e9"):'Financiële administratie laden…');
  try {
    const access=state.accessGeneration,loaded=await window.FoundlyFinanceLoading.load(api,filters());if(generation!==state.loadGeneration||access!==state.accessGeneration)return;
    if(Object.values(loaded.components).some(component=>component.status_code===401))throw Object.assign(new Error('Finance authentication is unavailable'),{status:401});
    state.loading=loaded;state.accessAllowed=true;state.reportsAllowed=loaded.components.reports?.status==='AVAILABLE';if(!state.reportsAllowed){state.reportGeneration++;$('#financeZeroOutput').replaceChildren();state.zeroBusy=state.exportBusy=false;}
    Object.assign(state,{status:loaded.status,entities:loaded.entities,dashboard:loaded.dashboard,reports:loaded.reports});renderEntities();
    renderKpis();
    const reportError=unavailable('reports');
    if(reportError){for(const selector of ['#financePnl','#financeJournal'])$(selector).innerHTML='';for(const selector of ['#financePnlEmpty','#financeJournalEmpty']){$(selector).classList.remove('hidden');$(selector).textContent=reportError;}for(const selector of ['#financeAging','#financeForecast','#financeComplianceContent'])$(selector).innerHTML=`<div class="empty">${escapeHtml(reportError)}</div>`;$('#journalCount').textContent='NIET BESCHIKBAAR';$('#financeAgingBadge').textContent='NIET BESCHIKBAAR';}
    else{renderPnl();renderAging();renderForecast();renderCompliance();renderJournal();}
    const durable = state.status?.persistence?.durable===true;
    notice.className=state.loading.loading_status==='PARTIAL'?'notice error':'notice';
    notice.textContent=unavailable('reports')||`Financiële rapportages geladen · ${durable?'duurzame opslag bewezen':'duurzame productieopslag niet bewezen'} · ${formatDate(state.reports?.observed_at)}${unavailable('entities')?' · Entiteitenlijst niet beschikbaar; bestaand filter behouden.':''}`;
    $('#financeConnection').className='status-pill';$('#financeConnection').textContent=state.loading.loading_status==='PARTIAL'?'DEELS BESCHIKBAAR':'API BEREIKBAAR';
    mountPeriodClosing();financeControlState();
  } catch (error) {
    if(generation!==state.loadGeneration)return;
    invalidateFinanceAccess();
    notice.className = 'notice error';
    notice.textContent = `Finance niet beschikbaar: ${financeErrorText(error)}`;
    $('#financeConnection').className = 'status-pill error';
    $('#financeConnection').textContent = error.status === 401 ? 'AUTH VEREIST' : 'ERROR';
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
  $('#financeZeroOutput').textContent = 'ZERO controleert geboekte journaaldata…';
  try {
    const result = await api('/api/zero/turn', { method: 'POST', body: JSON.stringify({ message, conversation_id: sessionStorage.foundlyFinanceConversation || (sessionStorage.foundlyFinanceConversation = crypto.randomUUID()), turn_id: crypto.randomUUID(), preferred_module: 'finance', client_context: { surface: 'finance', legal_entity_id: $('#financeEntity').value || null, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone } }) });
    if(access!==state.accessGeneration||reports!==state.reportGeneration||!state.reportsAllowed)return;
    $('#financeZeroOutput').textContent = result.display_text || result.answer;
  } catch (error) { if(access===state.accessGeneration&&reports===state.reportGeneration){if(error.status===401)invalidateFinanceAccess();$('#financeZeroOutput').textContent=globalThis.FoundlyI18n?.error(error.data?.code,error.status)||'Aanvraag mislukt';} }
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
    const blob = new Blob([result.content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `foundly-finance-journal-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    $('#financeNotice').className = 'notice success';
    $('#financeNotice').textContent = `${result.count} tenant-scoped journaalrecords geëxporteerd; autorisatie en audit zijn vastgelegd.`;
  } catch (error) {
    if(access!==state.accessGeneration||reports!==state.reportGeneration)return;if([401,403].includes(error.status))invalidateFinanceAccess();
    $('#financeNotice').className = 'notice error';
    $('#financeNotice').textContent = `Finance-export mislukt: ${financeErrorText(error)}`;
  }finally{if(access===state.accessGeneration&&reports===state.reportGeneration){state.exportBusy=false;financeControlState();}}
}

$('#refreshFinance').addEventListener('click', () => load(true));
$('#financeEntity').addEventListener('change', () => load(false));
$('#exportFinance').addEventListener('click', exportJournal);
$('#financeZeroForm').addEventListener('submit', askZero);
load(true);
