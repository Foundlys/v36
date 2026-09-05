'use strict';

const $ = selector => document.querySelector(selector);
const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
const state = { dashboard: null, platform: null, connectors: null, automation: null, stream: null, refreshTimer: null };
const KPI_ORDER = ['conversion_rate', 'win_rate', 'roas', 'mer', 'pipeline_value', 'weighted_pipeline', 'gross_margin', 'sales_cycle'];
const STAGE_LABELS = { ad_impression: 'Advertentie', ad_click: 'Klik', session_started: 'Bezoek', form_submitted: 'Formulier', lead_created: 'Lead', lead_qualified: 'Gekwalificeerd', appointment_scheduled: 'Afspraak', quote_created: 'Offerte', deal_won: 'Deal', invoice_created: 'Factuur', invoice_paid: 'Betaald' };

async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { accept: 'application/json', ...(options.body ? { 'content-type': 'application/json' } : {}), ...(options.headers || {}) } });
  const text = await response.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; }
  catch { data = { error: text || `HTTP ${response.status}` }; }
  if (!response.ok) throw Object.assign(new Error(data.error || data.code || `HTTP ${response.status}`), { status: response.status, data });
  return data;
}

function formatDate(value) {
  if (!value) return 'Onbekend';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Onbekend' : new Intl.DateTimeFormat('nl-NL', { dateStyle: 'short', timeStyle: 'medium' }).format(date);
}

function formatMetric(metric) {
  if (!metric?.available) return { value: 'Geen brondata', meta: metric?.unavailable_reason || 'NO_VERIFIED_SOURCE_DATA' };
  const number = Number(metric.value);
  if (metric.unit === 'CENTS') return { value: new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(number / 100), meta: `${metric.drilldown.source_count} bronrecords` };
  if (metric.unit === 'PERCENT') return { value: `${new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 2 }).format(number)}%`, meta: `${metric.drilldown.source_count} bronrecords` };
  if (metric.unit === 'RATIO') return { value: `${new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 2 }).format(number)}×`, meta: `${metric.drilldown.source_count} bronrecords` };
  return { value: `${new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 2 }).format(number)} ${metric.unit === 'DAYS' ? 'dagen' : metric.unit === 'SECONDS' ? 'sec.' : ''}`.trim(), meta: `${metric.drilldown.source_count} bronrecords` };
}

function query() {
  const params = new URLSearchParams({ seconds: $('#analysisWindow').value });
  const from = $('#analysisFrom').value;
  const to = $('#analysisTo').value;
  const campaign = $('#analysisCampaign').value.trim();
  if (from) params.set('from', `${from}T00:00:00.000Z`);
  if (to) params.set('to', `${to}T23:59:59.999Z`);
  if (campaign) params.set('campaign_id', campaign);
  return params;
}

function renderKpis() {
  const kpis = state.dashboard?.kpis || {};
  $('#analysisKpis').innerHTML = KPI_ORDER.map(id => {
    const metric = kpis[id];
    const formatted = formatMetric(metric);
    return `<article class="kpi-card${metric?.available ? '' : ' unavailable'}"><h2>${escapeHtml(metric?.kpi?.name || id)}</h2><strong class="kpi-value">${escapeHtml(formatted.value)}</strong><span class="kpi-meta">v${escapeHtml(metric?.kpi?.version || '—')} · ${escapeHtml(formatted.meta)}</span></article>`;
  }).join('');
}

function renderFunnel() {
  const funnel = state.dashboard?.funnel;
  const stages = funnel?.stages || [];
  if (!stages.length || !funnel.events) {
    $('#analysisFunnel').innerHTML = '<div class="empty">Nog geen canonical journey-events. Koppel een echte bron of registreer interne business-events om de funnel te vullen.</div>';
    return;
  }
  const maximum = Math.max(1, ...stages.map(stage => Number(stage.count || 0)));
  $('#analysisFunnel').innerHTML = stages.map(stage => `<div class="funnel-row"><label>${escapeHtml(STAGE_LABELS[stage.stage] || stage.stage)}</label><meter min="0" max="${maximum}" value="${Number(stage.count || 0)}">${Number(stage.count || 0)}</meter><output>${Number(stage.count || 0)}</output></div>`).join('');
  $('#funnelSource').textContent = `${funnel.events} EVENTS`;
}

function renderEvents() {
  const realtime = state.dashboard?.realtime;
  const events = realtime?.latest || [];
  $('#eventFreshness').textContent = realtime?.freshness ? `${realtime.freshness.classification} · ${realtime.freshness.freshness_seconds ?? '—'} sec.` : 'Freshness onbekend';
  $('#analysisEvents').innerHTML = events.length ? events.slice(0, 12).map(event => `<div class="stack-row"><strong>${escapeHtml(event.event_name)}</strong><time datetime="${escapeHtml(event.received_at)}">${escapeHtml(formatDate(event.received_at))}</time><span class="mono">${escapeHtml(event.source || event.provider || 'unknown')}</span><span class="mono">${escapeHtml(event.event_id)}</span></div>`).join('') : '<div class="empty">Geen realtime events in het gekozen venster.</div>';
}

function renderHistory() {
  const rows = state.dashboard?.historical?.rollups || [];
  $('#rollupCount').textContent = `${rows.length} BUCKETS`;
  $('#analysisHistory').innerHTML = rows.slice(-200).reverse().map(row => `<tr><td>${escapeHtml(row.date)}</td><td>${escapeHtml(row.event_name)}</td><td>${escapeHtml(row.source || '—')}</td><td>${Number(row.events || 0)}</td><td>${escapeHtml(formatDate(row.last_received_at))}</td></tr>`).join('');
  $('#analysisHistoryEmpty').classList.toggle('hidden', rows.length > 0);
  $('#analysisHistoryEmpty').textContent = rows.length ? '' : 'Geen historische rollups binnen het gekozen bereik.';
}

function sourceCard(name, status, details) {
  const connected = status === 'CONNECTED';
  return `<div class="source-card"><strong>${escapeHtml(name)}</strong><span class="source-state${connected ? ' connected' : ''}">${escapeHtml(status)}</span><span>${escapeHtml(details)}</span></div>`;
}

function renderSources() {
  const providers = state.platform?.providers || {};
  const connectors = state.connectors?.items || [];
  const cards = [
    sourceCard('Foundly Event Gateway', state.dashboard?.realtime?.freshness?.classification || 'UNKNOWN', `${state.dashboard?.realtime?.events || 0} events in venster`),
    sourceCard('Meta measurement', providers.meta?.connected ? 'CONNECTED' : providers.meta?.configured ? 'CONFIGURED / UNVERIFIED' : 'NOT CONFIGURED', providers.meta?.connected ? 'Probe en initiële sync bewezen' : 'Geen providerverbinding geclaimd'),
    sourceCard('Google measurement', providers.google?.connected ? 'CONNECTED' : providers.google?.configured ? 'CONFIGURED / UNVERIFIED' : 'NOT CONFIGURED', providers.google?.connected ? 'Probe en initiële sync bewezen' : 'Geen providerverbinding geclaimd'),
    ...connectors.slice(0, 9).map(row => sourceCard(row.provider, row.state, row.last_sync_at ? `Sync ${formatDate(row.last_sync_at)}` : 'Nog geen bewezen sync'))
  ];
  $('#analysisSources').innerHTML = cards.join('');
}

function renderAutomation() {
  const data = state.automation || {};
  const rows = [
    ['Workflowversies', data.workflow_count ?? 0],
    ['Runs', data.run_count ?? 0],
    ['Wacht op goedkeuring', data.awaiting_approval ?? 0],
    ['Fouten', data.failed ?? 0],
    ['Execution adapter', data.execution_adapter || 'UNKNOWN']
  ];
  $('#analysisAutomationContent').innerHTML = rows.map(([label, value]) => `<div class="stack-row"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(value)}</span></div>`).join('');
}

async function load() {
  const notice = $('#analysisNotice');
  notice.className = 'notice';
  notice.textContent = 'Canonical analytics laden…';
  try {
    const params = query();
    [state.dashboard, state.platform, state.connectors, state.automation] = await Promise.all([
      api(`/api/analysis/dashboard?${params}`),
      api('/api/platform/status'),
      api('/api/platform/connectors'),
      api('/api/automation/status')
    ]);
    renderKpis();
    renderFunnel();
    renderEvents();
    renderHistory();
    renderSources();
    renderAutomation();
    const persistence = state.platform.persistence || {};
    notice.className = `notice${persistence.durable ? ' success' : ''}`;
    notice.textContent = persistence.durable ? `Data actueel. Duurzame versleutelde opslag bewezen · ${formatDate(state.dashboard.observed_at)}` : `Data geladen · duurzame productieopslag niet bewezen · ${formatDate(state.dashboard.observed_at)}`;
    $('#analysisConnection').className = 'status-pill live';
    $('#analysisConnection').textContent = 'LIVE API';
  } catch (error) {
    notice.className = 'notice error';
    notice.textContent = `Analysis niet beschikbaar: ${error.message}`;
    $('#analysisConnection').className = 'status-pill error';
    $('#analysisConnection').textContent = error.status === 401 ? 'AUTH VEREIST' : 'ERROR';
  }
}

function scheduleRefresh() {
  clearTimeout(state.refreshTimer);
  state.refreshTimer = setTimeout(load, 500);
}

function connectStream() {
  if (!window.EventSource) return;
  state.stream?.close();
  const stream = new EventSource('/api/platform/events/stream');
  state.stream = stream;
  stream.addEventListener('platform.event', scheduleRefresh);
  stream.addEventListener('ready', () => { $('#analysisConnection').className = 'status-pill live'; $('#analysisConnection').textContent = 'SSE LIVE'; });
  stream.onerror = () => { $('#analysisConnection').className = 'status-pill'; $('#analysisConnection').textContent = 'SSE HERSTELT'; };
}

async function exportEvents() {
  try {
    const result = await api('/api/platform/exports', { method: 'POST', body: JSON.stringify({ scope: 'events', format: 'CSV' }) });
    const blob = new Blob([result.content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `foundly-events-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    $('#analysisNotice').textContent = `${result.count} tenant-scoped eventrecords geëxporteerd en geaudit.`;
  } catch (error) { $('#analysisNotice').className = 'notice error'; $('#analysisNotice').textContent = `Export mislukt: ${error.message}`; }
}

async function askZero(event) {
  event.preventDefault();
  const input = $('#analysisZeroInput');
  const message = input.value.trim();
  if (!message) return;
  input.value = '';
  $('#analysisZeroOutput').textContent = 'ZERO verifieert KPI-bronnen…';
  try {
    const result = await api('/api/zero/turn', { method: 'POST', body: JSON.stringify({ message, conversation_id: sessionStorage.foundlyAnalysisConversation || (sessionStorage.foundlyAnalysisConversation = crypto.randomUUID()), turn_id: crypto.randomUUID(), preferred_module: 'analysis', client_context: { surface: 'analysis', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone } }) });
    $('#analysisZeroOutput').textContent = result.display_text || result.answer;
  } catch (error) { $('#analysisZeroOutput').textContent = error.message; }
}

$('#refreshAnalysis').addEventListener('click', load);
$('#exportEvents').addEventListener('click', exportEvents);
$('#analysisZeroForm').addEventListener('submit', askZero);
window.addEventListener('beforeunload', () => state.stream?.close());
load();
connectStream();
