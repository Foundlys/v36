'use strict';

const $ = selector => document.querySelector(selector);
const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
const state = { loading:null,loadGeneration:0,status: null, entities: [], dashboard: null, reports: null };
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
 if(financeTransport!=='zero')return api(path,options);
 let action;const data=options.body?JSON.parse(options.body):{};
 if(path==='/api/finance/forecast-scenarios')action={operation:'SCENARIO',input:data};
 else {const match=path.match(/^\/api\/finance\/periods\/([^/]+)\/(close-preview|close)$/);if(match)action={operation:match[2]==='close'?'CLOSE':'PREVIEW_CLOSE',input:{period_id:decodeURIComponent(match[1]),...data}};}
 if(!action)return api(path,options);
 const result=await api('/api/zero/turn',{method:'POST',body:JSON.stringify({message:'Gekozen Finance-actie',conversation_id:financeConversation,turn_id:action.operation==='CLOSE'?data.request_id:crypto.randomUUID(),client_context:{finance_action:action}})});return result.finance_data;
}
$('#financeTransport').addEventListener('change',()=>{if([state.scenarioView,state.closeView].some(view=>view?.isConnected&&!view.canLeave())){$('#financeTransport').value=financeTransport;return;}financeTransport=$('#financeTransport').value;});

function money(value) { if(typeof value!=='number'||!Number.isFinite(value))return 'Niet beschikbaar';return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(value || 0) / 100); }
function formatDate(value) { if (!value) return '—'; const date = new Date(value); return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('nl-NL', { dateStyle: 'medium' }).format(date); }
function filters() {
  const params = new URLSearchParams();
  if ($('#financeEntity').value) params.set('legal_entity_id', $('#financeEntity').value);
  if ($('#financeFrom').value) params.set('from', `${$('#financeFrom').value}T00:00:00.000Z`);
  if ($('#financeTo').value) params.set('to', `${$('#financeTo').value}T23:59:59.999Z`);
  return params;
}

function unavailable(name){const component=state.loading?.components?.[name];return component?.status==='DISABLED'?'Dit onderdeel is uitgeschakeld of niet beschikbaar binnen je toegang.':component?.status==='ERROR'?'Dit onderdeel kon niet laden: '+component.message:null;}

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
  const rows = state.reports?.profit_and_loss?.rows || [];
  $('#financePnl').innerHTML = rows.map(row => `<tr><td>${escapeHtml(row.code)} · ${escapeHtml(row.name)}</td><td>${escapeHtml(row.type)}</td><td>${escapeHtml(money(row.debit_cents))}</td><td>${escapeHtml(money(row.credit_cents))}</td><td class="${Number(row.balance_cents) < 0 ? 'negative' : 'positive'}">${escapeHtml(money(row.balance_cents))}</td></tr>`).join('');
  $('#financePnlEmpty').classList.toggle('hidden', rows.length > 0);
  $('#financePnlEmpty').textContent = rows.length ? '' : 'Nog geen geboekte omzet- of kostenregels voor deze selectie.';
}

function renderAging() {
  const ar = state.reports?.ar_aging;
  const ap = state.reports?.ap_aging;
  if (!ar || !ap) { $('#financeAging').innerHTML = '<div class="empty">Geen agingdata beschikbaar.</div>'; return; }
  const overdue = ['1_30', '31_60', '61_90', 'over_90'].reduce((total, key) => total + Number(ar.buckets[key] || 0), 0);
  $('#financeAgingBadge').textContent = overdue ? `${money(overdue)} OVERDUE` : 'GEEN ACHTERSTAND';
  const rows = [
    ['Open debiteuren', money(ar.total_cents)],
    ['Open crediteuren', money(ap.total_cents)],
    ['Debiteuren 1–30 dagen', money(ar.buckets['1_30'])],
    ['Debiteuren 31–60 dagen', money(ar.buckets['31_60'])],
    ['Debiteuren 61–90 dagen', money(ar.buckets['61_90'])],
    ['Debiteuren >90 dagen', money(ar.buckets.over_90)]
  ];
  $('#financeAging').innerHTML = rows.map(([label, value]) => `<div class="stack-row"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(value)}</span></div>`).join('');
}

function renderForecast() {
  const budget = state.reports?.budget_vs_actual;
  const forecast = state.reports?.cash_forecast;
  const rows = [];
  if (budget?.available) {
    rows.push(['Goedgekeurd budget', money(budget.budget_cents)], ['Werkelijk', money(budget.actual_cents)], ['Verschil', money(budget.variance_cents)]);
  } else rows.push(['Budget', budget?.reason || 'Geen goedgekeurd budget ingeladen']);
  if (forecast?.available) {
    rows.push(['Forecast beginsaldo', new Intl.NumberFormat('nl-NL',{style:'currency',currency:forecast.currency||'EUR'}).format(forecast.opening_cash_cents/100)], [`Forecast ${forecast.horizon_days} dagen`, new Intl.NumberFormat('nl-NL',{style:'currency',currency:forecast.currency||'EUR'}).format(forecast.closing_cash_cents/100)], ['Aannames', forecast.assumptions?.length || 0]);
  } else rows.push(['Cashforecast', forecast?.reason || 'Geen forecast ingeladen']);
  $('#financeForecast').innerHTML = rows.map(([label, value]) => `<div class="stack-row"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(value)}</span></div>`).join('');
  if(forecast?.available&&window.FoundlyFinanceCashScenarios){const generation=state.loadGeneration;state.scenarioView=window.FoundlyFinanceCashScenarios.create({document,request:financeRequest,forecastId:forecast.forecast_id,isActive:()=>state.loadGeneration===generation});$('#financeForecast').append(state.scenarioView);}
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
  const entries = state.reports?.general_ledger?.entries || [];
  $('#journalCount').textContent = `${entries.length} ENTRIES`;
  $('#financeJournal').innerHTML = entries.slice(-200).reverse().map(entry => `<tr><td class="mono">${escapeHtml(entry.entry_number)}</td><td>${escapeHtml(formatDate(entry.date))}</td><td>${escapeHtml(entry.entry_type)}</td><td>${escapeHtml(entry.description)}</td><td>${escapeHtml(entry.status)}</td><td>${escapeHtml(entry.source || 'manual')}</td></tr>`).join('');
  $('#financeJournalEmpty').classList.toggle('hidden', entries.length > 0);
  $('#financeJournalEmpty').textContent = entries.length ? '' : 'Nog geen geboekte journaalposten. Concepten worden niet als financiële werkelijkheid weergegeven.';
}

async function load(refreshEntities = false) {
  if([state.scenarioView,state.closeView].some(view=>view?.isConnected&&!view.canLeave())){$('#financeEntity').value=state.loading?.selected_entity_id||'';return;}
  const generation=++state.loadGeneration;
  const notice = $('#financeNotice');
  notice.className = 'notice';
  notice.textContent = 'Financiële administratie laden…';
  try {
    const loaded=await window.FoundlyFinanceLoading.load(api,filters());if(generation!==state.loadGeneration)return;
    state.loading=loaded;Object.assign(state,{status:loaded.status,entities:loaded.entities,dashboard:loaded.dashboard,reports:loaded.reports});renderEntities();
    renderKpis();
    const reportError=unavailable('reports');
    if(reportError){for(const selector of ['#financePnl','#financeJournal'])$(selector).innerHTML='';for(const selector of ['#financePnlEmpty','#financeJournalEmpty']){$(selector).classList.remove('hidden');$(selector).textContent=reportError;}for(const selector of ['#financeAging','#financeForecast','#financeComplianceContent'])$(selector).innerHTML=`<div class="empty">${escapeHtml(reportError)}</div>`;$('#journalCount').textContent='NIET BESCHIKBAAR';$('#financeAgingBadge').textContent='NIET BESCHIKBAAR';}
    else{renderPnl();renderAging();renderForecast();renderCompliance();renderJournal();}
    const durable = Boolean(state.status?.persistence?.durable);
    notice.className=state.loading.loading_status==='PARTIAL'?'notice error':'notice';
    notice.textContent=unavailable('reports')||`Financiële rapportages geladen · ${durable?'duurzame opslag bewezen':'duurzame productieopslag niet bewezen'} · ${formatDate(state.reports?.observed_at)}${unavailable('entities')?' · Entiteitenlijst niet beschikbaar; bestaand filter behouden.':''}`;
    $('#financeConnection').className='status-pill';$('#financeConnection').textContent=state.loading.loading_status==='PARTIAL'?'DEELS BESCHIKBAAR':'API BEREIKBAAR';
  } catch (error) {
    if(generation!==state.loadGeneration)return;
    notice.className = 'notice error';
    notice.textContent = `Finance niet beschikbaar: ${error.message}`;
    $('#financeConnection').className = 'status-pill error';
    $('#financeConnection').textContent = error.status === 401 ? 'AUTH VEREIST' : 'ERROR';
  }
}

async function askZero(event) {
  event.preventDefault();
  const input = $('#financeZeroInput');
  const message = input.value.trim();
  if (!message) return;
  input.value = '';
  $('#financeZeroOutput').textContent = 'ZERO controleert geboekte journaaldata…';
  try {
    const result = await api('/api/zero/turn', { method: 'POST', body: JSON.stringify({ message, conversation_id: sessionStorage.foundlyFinanceConversation || (sessionStorage.foundlyFinanceConversation = crypto.randomUUID()), turn_id: crypto.randomUUID(), preferred_module: 'finance', client_context: { surface: 'finance', legal_entity_id: $('#financeEntity').value || null, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone } }) });
    $('#financeZeroOutput').textContent = result.display_text || result.answer;
  } catch (error) { $('#financeZeroOutput').textContent = error.message; }
}

async function exportJournal() {
  const filters = {};
  if ($('#financeEntity').value) filters.legal_entity_id = $('#financeEntity').value;
  if ($('#financeFrom').value) filters.from = `${$('#financeFrom').value}T00:00:00.000Z`;
  if ($('#financeTo').value) filters.to = `${$('#financeTo').value}T23:59:59.999Z`;
  try {
    const result = await api('/api/finance/exports', { method: 'POST', body: JSON.stringify({ scope: 'journal_entries', format: 'CSV', filters }) });
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
    $('#financeNotice').className = 'notice error';
    $('#financeNotice').textContent = `Finance-export mislukt: ${error.message}`;
  }
}

$('#refreshFinance').addEventListener('click', () => load(true));
$('#financeEntity').addEventListener('change', () => load(false));
$('#exportFinance').addEventListener('click', exportJournal);
$('#financeZeroForm').addEventListener('submit', askZero);
load(true);

if(window.FoundlyFinancePeriodClosing){state.closeView=window.FoundlyFinancePeriodClosing.create({document,request:financeRequest});$('#financePeriodClosing').append(state.closeView);}
