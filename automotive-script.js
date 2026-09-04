'use strict';

const app = {
  status: null,
  search: null,
  results: [],
  analyses: new Map(),
  selectedId: null,
  activeTab: 'why',
  zeroConversationId: sessionStorage.getItem('foundly-automotive-zero-conversation') || `automotive-${crypto.randomUUID()}`,
  zeroTurn: 0
};
sessionStorage.setItem('foundly-automotive-zero-conversation', app.zeroConversationId);

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);

function safeExternalUrl(value) {
  try {
    const url = new URL(String(value));
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.toString() : null;
  } catch { return null; }
}

function formatEur(value) {
  return Number.isFinite(Number(value)) ? new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(value)) : 'Onbekend';
}

function formatNumber(value, suffix = '') {
  return Number.isFinite(Number(value)) ? `${new Intl.NumberFormat('nl-NL').format(Number(value))}${suffix}` : '—';
}

function label(value) {
  return String(value ?? 'UNKNOWN').replaceAll('_', ' ').toLowerCase().replace(/(^|\s)\S/g, letter => letter.toUpperCase());
}

function vehicleName(candidate = {}) {
  return [candidate.vehicle?.make, candidate.vehicle?.model, candidate.vehicle?.variant, candidate.vehicle?.trim].filter(Boolean).join(' ') || 'Naam niet geleverd';
}

function toast(message, type = 'info') {
  const node = document.createElement('div');
  node.className = `toast ${type}`;
  node.textContent = message;
  $('#toastRegion').append(node);
  setTimeout(() => node.remove(), 5200);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { accept: 'application/json', ...(options.body ? { 'content-type': 'application/json' } : {}), ...(options.headers || {}) }
  });
  const text = await response.text();
  let payload;
  try { payload = text ? JSON.parse(text) : {}; } catch { payload = { error: 'Ongeldig serverantwoord' }; }
  if (!response.ok) throw Object.assign(new Error(payload.error || `HTTP ${response.status}`), { status: response.status, code: payload.code });
  return payload;
}

function providerState(provider) {
  if (provider.state) return provider.state;
  if (provider.probe === 'PASS') return 'LIVE';
  if (provider.authenticated) return 'CONFIGURED';
  if (provider.configured) return 'CONFIGURED';
  return 'UNAVAILABLE';
}

function providerExplanation(provider) {
  if (provider.state === 'LIVE' || provider.probe === 'PASS') return `${formatNumber(provider.records_normalized || 0)} records genormaliseerd · ${formatNumber(provider.latency_ms, ' ms')}`;
  if (provider.state === 'CACHED' || provider.state === 'STALE') return `${formatNumber(provider.records_from_cache || 0)} echte cache-records · live refresh faalde`;
  if (provider.error?.code) return provider.error.code;
  if (provider.provider === 'rdw' && provider.authenticated) return 'Publieke vehicle-truth adapter gereed';
  if (provider.authenticated) return 'Authenticatie aanwezig · probe nog niet uitgevoerd';
  if (provider.configured) return 'Configuratie aanwezig · authenticatie ontbreekt';
  return provider.adapter_available === false ? 'Adapter bewust niet actief zonder toegang' : 'Providerconfiguratie ontbreekt';
}

function renderProviders(providers = []) {
  $('#providerGrid').innerHTML = providers.map(provider => {
    const state = providerState(provider);
    return `<article class="provider-card">
      <div class="provider-head"><strong>${escapeHtml(provider.provider)}</strong><span class="state-pill ${escapeHtml(state.toLowerCase())}">${escapeHtml(state)}</span></div>
      <p>${escapeHtml(providerExplanation(provider))}</p>
    </article>`;
  }).join('') || '<div class="empty-state small"><p>Providerstatus is niet beschikbaar.</p></div>';
}

function renderSystemStatus() {
  const status = app.status;
  if (!status) return;
  $('#footerVersion').textContent = `Foundly ${status.version} · Automotive schema ${status.schema_version}`;
  const profile = status.dealer_profile || {};
  $('#partnerName').textContent = profile.display_name || 'House of Cars';
  const readyProviders = (status.providers || []).filter(provider => provider.authenticated).length;
  const marketplaceReady = (status.providers || []).some(provider => provider.category === 'MARKETPLACE' && provider.authenticated);
  $('#railStatusLight').className = `status-light ${marketplaceReady ? 'ok' : readyProviders ? 'partial' : 'error'}`;
  $('#railStatusText').textContent = marketplaceReady ? 'Market ready' : 'Data limited';
  renderProviders(status.providers || []);
}

async function loadStatus() {
  try {
    app.status = await api('/api/automotive/status');
    renderSystemStatus();
  } catch (error) {
    $('#railStatusLight').className = 'status-light error';
    $('#railStatusText').textContent = 'Unavailable';
    $('#providerGrid').innerHTML = `<div class="empty-state small"><h3>Status niet beschikbaar</h3><p>${escapeHtml(error.message)}</p></div>`;
    toast(`Providerstatus: ${error.message}`, 'error');
  }
}

const criteriaLabels = {
  make: 'Merk', model: 'Model', variant: 'Variant', trim: 'Uitvoering', year_min: 'Vanaf', year_max: 'Tot',
  mileage_min_km: 'Km vanaf', mileage_max_km: 'Km maximaal', purchase_price_min_eur: 'Prijs vanaf',
  purchase_price_max_eur: 'Inkoop maximaal', country: 'Land', fuel: 'Brandstof', transmission: 'Transmissie',
  drivetrain: 'Aandrijving', power_min_kw: 'Vermogen vanaf', options: 'Opties'
};

function criteriaValue(key, value) {
  if (key.includes('price')) return formatEur(value);
  if (key.includes('mileage')) return formatNumber(value, ' km');
  if (key === 'power_min_kw') return formatNumber(value, ' kW');
  if (Array.isArray(value)) return value.join(', ');
  return label(value);
}

function renderCriteria(search) {
  const fields = Object.entries(search.criteria || {}).filter(([, value]) => value !== null && value !== undefined && value !== '' && (!Array.isArray(value) || value.length));
  $('#criteriaPanel').hidden = false;
  $('#criteriaPanel').innerHTML = `<dl>${fields.map(([key, value]) => `<div><dt>${escapeHtml(criteriaLabels[key] || label(key))}</dt><dd>${escapeHtml(criteriaValue(key, value))}</dd></div>`).join('')}</dl>
    <div class="provider-execution">${(search.provider_executions || []).map(provider => `<span class="state-pill ${escapeHtml(provider.state.toLowerCase())}">${escapeHtml(provider.provider)} · ${escapeHtml(provider.state)}</span>`).join('')}</div>`;
}

function analysisFor(id) { return app.analyses.get(id) || null; }

function vehicleCard(candidate) {
  const analysis = analysisFor(candidate.canonical_listing_id), score = analysis?.buy_score?.score;
  const freshness = candidate.listing?.freshness?.classification || 'UNAVAILABLE';
  const location = [candidate.seller?.city, candidate.seller?.country].filter(Boolean).join(', ') || 'Locatie onbekend';
  const image = candidate.vehicle?.images?.length ? `<img src="/api/automotive/images/${encodeURIComponent(candidate.canonical_listing_id)}/0" alt="${escapeHtml(vehicleName(candidate))}" loading="lazy">` : '';
  return `<article class="vehicle-card">
    <div class="vehicle-image">${image}<span class="freshness ${escapeHtml(freshness.toLowerCase())}">${escapeHtml(freshness)}</span><span class="provider-label">${escapeHtml(candidate.identity?.provider || 'provider')}</span></div>
    <div class="vehicle-body">
      <div class="vehicle-title-row"><h3 title="${escapeHtml(vehicleName(candidate))}">${escapeHtml(vehicleName(candidate))}</h3><span class="mini-score" title="Foundly Buy Score">${score ?? '—'}</span></div>
      <p class="vehicle-price">${escapeHtml(formatEur(candidate.commercial?.gross_price_eur))}</p>
      <p class="vehicle-location">${escapeHtml(location)}</p>
      <div class="vehicle-specs">
        <div><span>Bouwjaar</span><strong>${escapeHtml(candidate.vehicle?.build_year || '—')}</strong></div>
        <div><span>Kilometers</span><strong>${escapeHtml(formatNumber(candidate.vehicle?.mileage_km))}</strong></div>
        <div><span>Brandstof</span><strong>${escapeHtml(label(candidate.vehicle?.fuel || '—'))}</strong></div>
      </div>
      <button type="button" data-vehicle-id="${escapeHtml(candidate.canonical_listing_id)}">Open evidence</button>
    </div>
  </article>`;
}

function bindVehicleButtons(root = document) {
  root.querySelectorAll('[data-vehicle-id]').forEach(button => button.addEventListener('click', () => showVehicle(button.dataset.vehicleId)));
  root.querySelectorAll('.vehicle-image img, .detail-image img').forEach(image => image.addEventListener('error', () => image.remove(), { once: true }));
}

function renderResults() {
  $('#resultCount').textContent = app.results.length ? String(app.results.length) : '0';
  if (!app.results.length) {
    const state = app.search?.status === 'unavailable' ? 'Geen marketplace-provider bereikbaar' : 'Geen passende echte listings';
    const providerText = (app.search?.provider_executions || []).map(item => `${item.provider}: ${item.state}${item.error?.code ? ` (${item.error.code})` : ''}`).join(' · ');
    $('#vehicleGrid').innerHTML = `<div class="empty-state"><span class="empty-orbit" aria-hidden="true"></span><h3>${escapeHtml(state)}</h3><p>${escapeHtml(providerText || 'Pas criteria aan of configureer een officiële marketplace-provider. Er wordt geen demo-inventaris ingevuld.')}</p></div>`;
    return;
  }
  $('#vehicleGrid').innerHTML = app.results.slice(0, 24).map(vehicleCard).join('');
  bindVehicleButtons($('#vehicleGrid'));
}

async function enrichResults() {
  const candidates = app.results.slice(0, 24);
  const analyses = await Promise.all(candidates.map(async candidate => {
    try {
      const payload = await api(`/api/automotive/vehicles/${encodeURIComponent(candidate.canonical_listing_id)}/analysis`);
      return [candidate.canonical_listing_id, payload.analysis];
    } catch { return [candidate.canonical_listing_id, null]; }
  }));
  for (const [id, analysis] of analyses) if (analysis) app.analyses.set(id, analysis);
  app.results.sort((left, right) => (analysisFor(right.canonical_listing_id)?.buy_score?.score ?? -1) - (analysisFor(left.canonical_listing_id)?.buy_score?.score ?? -1));
  renderResults();
}

function setSearchLoading(loading) {
  $('#searchButton').disabled = loading;
  $('#searchButton').querySelector('span').textContent = loading ? 'Providers zoeken' : 'Analyseer markt';
  if (loading) $('#vehicleGrid').innerHTML = '<div class="loading-grid"><span class="loading-ring" aria-label="Providers worden doorzocht"></span></div>';
}

async function runSearch(query) {
  setSearchLoading(true);
  $('#searchState').textContent = 'Provider-query actief';
  try {
    const search = await api('/api/automotive/search', { method: 'POST', body: JSON.stringify({ query }) });
    app.search = search;
    app.results = search.results || [];
    app.analyses.clear();
    renderCriteria(search);
    renderProviders(search.provider_executions || []);
    $('#correlationState').textContent = search.correlation_id ? `Trace ${search.correlation_id.slice(0, 12)}` : 'Trace voltooid';
    $('#searchState').textContent = `${label(search.status)} · ${app.results.length} listings`;
    renderResults();
    await enrichResults();
    if (!app.results.length) toast('De query is uitgevoerd; er zijn geen echte passende marketplace-listings.', search.status === 'unavailable' ? 'error' : 'info');
  } catch (error) {
    app.results = [];
    $('#searchState').textContent = 'Query mislukt';
    $('#vehicleGrid').innerHTML = `<div class="empty-state"><h3>Zoekopdracht niet voltooid</h3><p>${escapeHtml(error.message)}</p></div>`;
    toast(error.message, 'error');
  } finally { setSearchLoading(false); }
}

function metric(title, value, note) {
  return `<article class="metric-card"><span>${escapeHtml(title)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(note || '')}</small></article>`;
}

function whyContent(analysis) {
  const score = analysis.buy_score || {}, components = score.components || [];
  if (!score.available) return `<div class="empty-state small"><h3>Buy Score niet beschikbaar</h3><p>${escapeHtml(score.reason || 'Onvoldoende evidence-backed componenten.')}</p></div>`;
  return `<div class="metric-grid">${components.map(component => metric(component.name, `${component.score}/100`, `${component.confidence} confidence · gewicht ${component.weight}`)).join('')}</div>`;
}

function marketContent(analysis) {
  const signals = analysis.market_signals || {}, comparable = analysis.comparables || {};
  return `<div class="metric-grid">
    ${metric('Nederlandse comparables', formatNumber(comparable.comparable_count), `${comparable.confidence || 'UNAVAILABLE'} confidence`)}
    ${metric('Mediaan vraagprijs', formatEur(comparable.price_distribution_eur?.median), `p25 ${formatEur(comparable.price_distribution_eur?.p25)} · p75 ${formatEur(comparable.price_distribution_eur?.p75)}`)}
    ${metric('Listing scarcity', label(signals.listing_scarcity?.value || 'UNKNOWN'), signals.listing_scarcity?.evidence || 'Geen voldoende bronset')}
    ${metric('Prijspositie', signals.price_position?.value === null || signals.price_position?.value === undefined ? 'Onbekend' : `${signals.price_position.value}%`, 'Ten opzichte van de NL listingmediaan')}
  </div><div class="today-warning">Actual sales demand blijft ${escapeHtml(signals.actual_sales_demand?.type || 'UNKNOWN')}: marketplace-aanbod is geen bewijs van gerealiseerde verkopen.</div>`;
}

function economicsContent(analysis) {
  const economics = analysis.economics || {}, margin = economics.expected_gross_margin_range || {};
  return `<div class="metric-grid">
    ${metric('All-in acquisition', formatEur(economics.all_in_acquisition_eur), economics.status || 'UNKNOWN')}
    ${metric('Retail mediaan', formatEur(economics.expected_retail_range?.expected_eur), economics.expected_retail_range?.type || 'UNKNOWN')}
    ${metric('Marge estimate', formatEur(margin.expected_eur), `${formatEur(margin.low_eur)} – ${formatEur(margin.high_eur)}`)}
    ${metric('BPM estimate', formatEur(economics.bpm?.estimated_payable_bpm_eur), economics.bpm?.rule_version || 'Niet berekenbaar')}
  </div>
  <ul class="evidence-list">${(economics.breakdown || []).map(item => `<li><span>${escapeHtml(label(item.component))} · ${escapeHtml(item.type)}</span><strong>${escapeHtml(formatEur(item.value_eur))}</strong></li>`).join('')}</ul>
  ${economics.missing_fields?.length ? `<div class="today-warning">Nog nodig: ${escapeHtml(economics.missing_fields.join(', '))}</div>` : ''}`;
}

function comparablesContent(analysis) {
  const rows = analysis.comparables?.listings || [];
  if (!rows.length) return '<div class="empty-state small"><h3>Geen verdedigbare comparables</h3><p>Foundly toont geen vervangende marktwaarde.</p></div>';
  return `<div class="table-wrap"><table class="detail-table"><thead><tr><th>Provider</th><th>Prijs</th><th>Km</th><th>Jaar</th><th>Match</th><th>Freshness</th><th>Bron</th></tr></thead><tbody>${rows.map(row => {
    const source = safeExternalUrl(row.source_url);
    return `<tr><td>${escapeHtml(row.provider)}</td><td>${escapeHtml(formatEur(row.price_eur))}</td><td>${escapeHtml(formatNumber(row.mileage_km))}</td><td>${escapeHtml(row.build_year || '—')}</td><td>${escapeHtml(`${row.similarity_score}/100`)}</td><td>${escapeHtml(row.freshness?.classification || 'UNAVAILABLE')}</td><td>${source ? `<a href="${escapeHtml(source)}" target="_blank" rel="noopener noreferrer">Listing</a>` : '—'}</td></tr>`;
  }).join('')}</tbody></table></div>`;
}

function risksContent(analysis) {
  const risks = analysis.risks || [];
  return risks.length ? `<ul class="risk-list">${risks.map(risk => `<li><span class="risk-dot ${risk.severity === 'HIGH' ? 'high' : ''}"></span><strong>${escapeHtml(label(risk.code))}</strong><span>${escapeHtml(risk.severity)}</span></li>`).join('')}</ul>` : '<div class="empty-state small"><h3>Geen expliciete datarisico’s gemarkeerd</h3><p>Dit vervangt geen fysieke, technische of juridische voertuiginspectie.</p></div>';
}

function sourceContent(analysis) {
  const candidate = analysis.candidate || {}, source = safeExternalUrl(candidate.identity?.source_url);
  return `<ul class="source-list">
    <li><span>Provider</span><strong>${escapeHtml(candidate.identity?.provider || 'UNKNOWN')}</strong></li>
    <li><span>Provider listing-ID</span><strong>${escapeHtml(candidate.identity?.provider_listing_id || 'UNKNOWN')}</strong></li>
    <li><span>Aanbieder</span><strong>${escapeHtml(candidate.seller?.name || 'Niet geleverd')}</strong></li>
    <li><span>Locatie</span><strong>${escapeHtml([candidate.seller?.city, candidate.seller?.country].filter(Boolean).join(', ') || 'Niet geleverd')}</strong></li>
    <li><span>Provider verified</span><strong>${candidate.provenance?.provider_verified ? 'JA' : 'NEE'}</strong></li>
    <li><span>Transformation</span><strong>${escapeHtml(candidate.provenance?.transformation_version || 'UNKNOWN')}</strong></li>
    <li><span>Raw reference</span><strong>${escapeHtml(candidate.provenance?.raw_source_reference || 'UNKNOWN')}</strong></li>
    <li><span>Bron</span><strong>${source ? `<a href="${escapeHtml(source)}" target="_blank" rel="noopener noreferrer">Open providerlisting</a>` : 'Geen veilige URL geleverd'}</strong></li>
  </ul>`;
}

function renderDetailContent() {
  const analysis = analysisFor(app.selectedId);
  if (!analysis) return;
  const renderers = { why: whyContent, market: marketContent, economics: economicsContent, comparables: comparablesContent, risks: risksContent, source: sourceContent };
  $('#detailContent').innerHTML = (renderers[app.activeTab] || whyContent)(analysis);
}

async function showVehicle(id) {
  try {
    let analysis = analysisFor(id);
    if (!analysis) {
      const payload = await api(`/api/automotive/vehicles/${encodeURIComponent(id)}/analysis`);
      analysis = payload.analysis;
      app.analyses.set(id, analysis);
    }
    app.selectedId = id;
    const candidate = analysis.candidate;
    $('#detailProvider').textContent = `${candidate.identity?.provider || 'provider'} · ${candidate.listing?.freshness?.classification || 'UNAVAILABLE'}`;
    $('#detailTitle').textContent = vehicleName(candidate);
    $('#detailSubtitle').textContent = `${formatEur(candidate.commercial?.gross_price_eur)} · ${formatNumber(candidate.vehicle?.mileage_km, ' km')} · ${candidate.vehicle?.build_year || 'jaar onbekend'} · ${[candidate.seller?.city, candidate.seller?.country].filter(Boolean).join(', ') || 'locatie onbekend'}`;
    $('#detailScore').querySelector('strong').textContent = analysis.buy_score?.score ?? '—';
    const source = safeExternalUrl(candidate.identity?.source_url);
    $('#sourceLink').hidden = !source;
    if (source) $('#sourceLink').href = source;
    $('#detailImage').innerHTML = candidate.vehicle?.images?.length ? `<img src="/api/automotive/images/${encodeURIComponent(id)}/0" alt="${escapeHtml(vehicleName(candidate))}">` : '';
    bindVehicleButtons($('#vehicleDetail'));
    renderDetailContent();
    $('#vehicleDetail').hidden = false;
    $('#vehicleDetail').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) { toast(`Voertuiganalyse: ${error.message}`, 'error'); }
}

function renderToday(payload) {
  const opportunities = payload.opportunities || [];
  if (!opportunities.length) {
    $('#todayList').innerHTML = `<div class="empty-state small"><h3>Geen evidence-backed Top 3</h3><p>${escapeHtml(payload.explanation || payload.reason || 'Er zijn geen echte marketplace-records beschikbaar.')}</p></div>`;
    return;
  }
  for (const item of opportunities) app.analyses.set(item.candidate.canonical_listing_id, item);
  $('#todayList').innerHTML = opportunities.map(item => `<button class="today-item" type="button" data-vehicle-id="${escapeHtml(item.candidate.canonical_listing_id)}"><span class="today-rank">${escapeHtml(item.rank)}</span><span class="today-copy"><strong>${escapeHtml(vehicleName(item.candidate))}</strong><span>${escapeHtml(formatEur(item.candidate.commercial?.gross_price_eur))} · ${escapeHtml(item.candidate.identity.provider)} · ${escapeHtml(item.candidate.listing.freshness.classification)}</span></span><span class="today-score">${escapeHtml(item.buy_score.score)}</span></button>`).join('') + (payload.warning ? `<div class="today-warning">${escapeHtml(payload.warning)}</div>` : '');
  bindVehicleButtons($('#todayList'));
}

async function loadToday() {
  $('#todayList').innerHTML = '<div class="loading-grid"><span class="loading-ring" aria-label="Kansen worden berekend"></span></div>';
  try { renderToday(await api('/api/automotive/opportunities/today?limit=3')); }
  catch (error) { $('#todayList').innerHTML = `<div class="empty-state small"><h3>Kansen niet beschikbaar</h3><p>${escapeHtml(error.message)}</p></div>`; }
}

async function askZero(message) {
  const input = $('#zeroQuery'), button = $('#zeroForm button');
  input.disabled = true;
  button.disabled = true;
  $('#zeroAnswer').textContent = 'ZERO analyseert de tenantcontext…';
  try {
    app.zeroTurn++;
    const payload = await api('/api/zero/turn', { method: 'POST', body: JSON.stringify({ message, conversation_id: app.zeroConversationId, turn_id: `automotive-ui-${Date.now()}-${app.zeroTurn}` }) });
    $('#zeroAnswer').textContent = payload.display_text || payload.answer || 'ZERO leverde geen tekstantwoord.';
    const context = payload.automotive_data?.context;
    if (context?.ranked?.length) {
      for (const analysis of context.ranked) app.analyses.set(analysis.candidate.canonical_listing_id, analysis);
      if (context.selected_candidate_id) app.selectedId = context.selected_candidate_id;
      renderResults();
    }
    input.value = '';
  } catch (error) {
    $('#zeroAnswer').textContent = `ZERO kon de opdracht niet afronden: ${error.message}`;
    toast(error.message, 'error');
  } finally { input.disabled = false; button.disabled = false; input.focus(); }
}

$('#automotiveSearchForm').addEventListener('submit', event => {
  event.preventDefault();
  const query = $('#automotiveQuery').value.trim();
  if (query) runSearch(query);
});
$('#zeroForm').addEventListener('submit', event => {
  event.preventDefault();
  const message = $('#zeroQuery').value.trim();
  if (message) askZero(message);
});
$('#refreshStatus').addEventListener('click', loadStatus);
$('#refreshToday').addEventListener('click', loadToday);
$('#closeDetail').addEventListener('click', () => { $('#vehicleDetail').hidden = true; });
$$('.detail-tabs button').forEach(button => button.addEventListener('click', () => {
  app.activeTab = button.dataset.tab;
  $$('.detail-tabs button').forEach(tab => tab.setAttribute('aria-selected', String(tab === button)));
  renderDetailContent();
}));

Promise.allSettled([loadStatus(), loadToday()]);
