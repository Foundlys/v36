'use strict';

const app = {
  status: null,
  statusGeneration: 0, accessGeneration: 0, accessAllowed: true, searchGeneration: 0, todayGeneration: 0, detailGeneration: 0, searchPending: false, zeroPending: false,
  overview: null,
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
  return (typeof value==='number'||typeof value==='string'&&value.trim()!=='')&&Number.isFinite(Number(value)) ? new Intl.NumberFormat((globalThis.FoundlyI18n?.locale||'nl-NL'), { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(value)) : (globalThis.FoundlyI18n?.t('common.unknown')||'Onbekend');
}

function formatNumber(value, suffix = '') {
  return (typeof value==='number'||typeof value==='string'&&value.trim()!=='')&&Number.isFinite(Number(value)) ? `${new Intl.NumberFormat((globalThis.FoundlyI18n?.locale||'nl-NL')).format(Number(value))}${suffix}` : '—';
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
  autoRender(node, message);
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

const autoCopy=(key,fallback,params={})=>globalThis.FoundlyI18n?FoundlyI18n.message('automotive.status.'+key,params):String(fallback).replace(/\{([a-z_]+)\}/g,(_,name)=>String(params[name]??''));
const autoLive=read=>Object.freeze({toString:read}),autoUnknown=()=>globalThis.FoundlyI18n?FoundlyI18n.message('common.unknown'):'Onbekend',autoNoData=()=>globalThis.FoundlyI18n?FoundlyI18n.message('common.no_data'):'Geen brondata';
function autoRender(node,value){if(globalThis.FoundlyI18n)FoundlyI18n.renderText(node,value);else node.textContent=String(value??'');return node;}
function autoElement(tag,value='',className){const node=autoRender(document.createElement(tag),value);if(className)node.className=className;return node;}
const autoCount=value=>Number.isSafeInteger(value)&&value>=0,autoNumber=value=>autoLive(()=>autoCount(value)?new Intl.NumberFormat(globalThis.FoundlyI18n?.locale||'nl-NL').format(value):String(autoUnknown())),autoValue=value=>autoCopy('value','{value}',{value});
const autoTime=value=>autoLive(()=>typeof value==='string'&&value.trim()&&Number.isFinite(Date.parse(value))?new Intl.DateTimeFormat(globalThis.FoundlyI18n?.locale||'nl-NL',{dateStyle:'short',timeStyle:'medium',timeZone:'UTC'}).format(new Date(value)):String(autoUnknown()));
const autoError=error=>globalThis.FoundlyI18n?FoundlyI18n.message(error.status===401?'identity.auth_required':FoundlyI18n.errorKey(error.code,error.status)):error.message;
const AUTO_STATES=['CONNECTED','AWAITING_ACCESS','AUTHENTICATED','CONFIGURED','UNCONFIGURED','UNAVAILABLE','LIVE','CACHED','STALE','ERROR','DEGRADED','EXPIRED','DISCONNECTED','AUTHORIZING','PROBING','SYNCING','UNKNOWN','SEARCH_OBSERVED'];
const autoState=state=>AUTO_STATES.includes(state)?autoCopy('state.'+state.toLowerCase(),state):autoUnknown();
function registryVerified(row){return row.connection_state==='CONNECTED'&&['AUTHENTICATED','AUTHENTICATED_PUBLIC'].includes(row.authentication_state)&&row.probe_state==='PASS'&&(row.sync_state==='PASS'||row.authentication_state==='AUTHENTICATED_PUBLIC'||['openai','voice','openai_realtime'].includes(row.connector_id));}
function searchObserved(row){return row?.authenticated===true&&row.configured===true&&row.adapter_available===true&&row.probe==='PASS'&&row.real_search==='PASS'&&typeof row.last_attempt_at==='string'&&Number.isFinite(Date.parse(row.last_attempt_at));}
function providerState(provider){
 if(provider.connection_state)return provider.connection_state==='CONNECTED'&&!registryVerified(provider)?'UNKNOWN':AUTO_STATES.includes(provider.connection_state)?provider.connection_state:'UNKNOWN';
 if(provider.state)return provider.state==='LIVE'&&!(provider.success===true&&provider.called===true)?'UNKNOWN':AUTO_STATES.includes(provider.state)?provider.state:'UNKNOWN';
 if(searchObserved(provider))return 'SEARCH_OBSERVED';if(provider.authenticated===true)return 'AUTHENTICATED';if(provider.configured===true)return 'CONFIGURED';if(provider.configured===false)return 'UNCONFIGURED';return 'UNKNOWN';
}
function providerExplanation(provider){
 const state=providerState(provider);
 if(state==='CONNECTED')return autoCopy('verified_records','Records: {value} · geslaagde probe',{value:autoNumber(provider.records)});
 if(state==='AWAITING_ACCESS')return autoCopy('access_required','Adapter beschikbaar · legitieme provider- of partnertoegang vereist');
 if(state==='AUTHENTICATED')return autoCopy('auth_only','Authenticatie aanwezig · vereiste probe of initiële sync nog niet bewezen');
 if(state==='CONFIGURED')return autoCopy('configured_only','Configuratie aanwezig · providerautorisatie nog niet bewezen');
 if(state==='UNCONFIGURED')return autoCopy('unconfigured','Connectorcontract beschikbaar · configuratie ontbreekt');
 if(state==='SEARCH_OBSERVED')return autoCopy('search_observed','Geslaagde zoekopdracht waargenomen: {time} UTC',{time:autoTime(provider.last_attempt_at)});
 if(state==='LIVE')return autoCopy('normalized','Genormaliseerde records: {value} · {latency} ms',{value:autoNumber(provider.records_normalized),latency:autoNumber(provider.latency_ms)});
 if(state==='CACHED'||state==='STALE')return autoCopy('cached','Cache-records: {value} · laatste live aanvraag mislukt',{value:autoNumber(provider.records_from_cache)});
 if(provider.safe_error||provider.error?.code)return autoCopy('provider_error','Providercontrole mislukt.');
 return provider.adapter_available===false?autoCopy('adapter_inactive','Adapter niet actief zonder toegang'):autoCopy('evidence_missing','Providerbewijs niet beschikbaar.');
}
function renderProviders(providers){
 const required=['rdw','mobile_de','marktplaats','autoscout24','vwe','autotelex','rdc','ecb_fx','openai'],host=$('#providerGrid'),rows=Array.isArray(providers)?providers:[];host.replaceChildren();
 for(const id of required){const matches=rows.filter(row=>(row.connector_id||row.provider)===id);if(!matches.length)continue;const provider=matches[0],state=matches.length===1?providerState(provider):'UNKNOWN',card=autoElement('article','','provider-card'),head=autoElement('div','','provider-head');head.append(autoElement('strong',provider.name||provider.provider||provider.connector_id),autoElement('span',autoState(state),'state-pill '+state.toLowerCase()));card.append(head,autoElement('p',matches.length===1?providerExplanation(provider):autoCopy('conflict','Tegenstrijdige providerwaarnemingen; status onbekend.')));host.append(card);}
 if(!host.children.length){const empty=autoElement('div','','empty-state small');empty.append(autoElement('p',autoCopy('unavailable','Providerstatus is niet beschikbaar.')));host.append(empty);}
}
function overviewValue(value,available){return available===true?autoValue(autoNumber(value)):available===false?autoNoData():autoUnknown();}
function renderOverview(){
 const data=app.overview;if(!data)return;const rows=data.provider_health,ids=Array.isArray(rows)?rows.map(row=>row.connector_id||row.provider):[],known=Array.isArray(rows)&&ids.every(id=>typeof id==='string'&&id)&&new Set(ids).size===ids.length,connected=known?rows.filter(registryVerified).length:null;
 const scores=Array.isArray(data.top_buy_scores)?data.top_buy_scores.map(row=>row.score).filter(value=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=100):[],topScore=scores.length?Math.max(...scores):null,count=value=>Array.isArray(value)?value.length:null;
 const metrics=[
  ['provider_health','Providerstatus',autoCopy('coverage','{connected} / {total}',{connected:autoNumber(connected),total:autoNumber(known?rows.length:null)}),'connector_registry','Connector Registry'],
  ['today','Kansen van vandaag',autoValue(autoNumber(count(data.today_opportunities))),'marketplace_data','Marketplace-brondata'],
  ['top_scores','Hoogste Buy Scores',topScore===null?autoUnknown():autoValue(autoLive(()=>new Intl.NumberFormat(globalThis.FoundlyI18n?.locale||'nl-NL',{maximumFractionDigits:2}).format(topScore))),'scoring','Scoring op basis van bewijs'],
  ['searches','Recente zoekopdrachten',autoValue(autoNumber(count(data.recent_searches))),'tenant_history','Tenanthistorie'],
  ['movement','Marktbeweging',overviewValue(data.market_movement?.value,data.market_movement?.available),'no_series','Geen bewezen marktreeks'],
  ['risk','Voorraadrisico',overviewValue(data.inventory_risk?.at_risk,data.inventory_risk?.available),'persisted_inventory','Bewaarde voorraad'],
  ['stale','Oude voorraad',overviewValue(data.stale_stock?.records,data.stale_stock?.available),'ninety_days','Ouder dan 90 dagen'],
  ['recommendations','Recente ZERO-aanbevelingen',autoValue(autoNumber(count(data.recent_zero_recommendations))),'persisted_only','Alleen bewaarde aanbevelingen'],
  ['freshness','Actualiteit van data',autoValue(autoNumber(Array.isArray(data.data_freshness)?data.data_freshness.filter(row=>['AVAILABLE','LIVE_REFERENCE'].includes(row.status)).length:null)),'source_registry','Source Registry'],
  ['source_coverage','Brondekking',autoValue(autoNumber(count(data.source_coverage))),'with_records','Bronnen met records']
 ];
 const host=$('#automotiveOverviewGrid');host.replaceChildren();for(const [key,name,value,noteKey,note]of metrics){const card=autoElement('article'),missing=key==='provider_health'&&!known||String(value)===String(autoUnknown())||String(value)===String(autoNoData());card.append(autoElement('span',autoCopy(key,name)),autoElement('strong',value,missing?'unavailable':''),autoElement('small',autoCopy(noteKey,note)));host.append(card);}
 autoRender($('#automotiveObserved'),autoCopy('observed','Waargenomen: {time} UTC',{time:autoTime(data.observed_at)}));
 autoRender($('#inventoryOperationState'),data.inventory_risk?.available===true?autoCopy('inventory_records','{records} bewaarde voorraadrecords · {risk} met expliciet hoog risico.',{records:autoNumber(data.inventory_risk.records),risk:autoNumber(data.inventory_risk.at_risk)}):data.inventory_risk?.available===false?autoCopy('no_inventory','Geen werkelijke voorraadrecords beschikbaar; Foundly toont geen demo-inventaris.'):autoCopy('inventory_unknown','Voorraadwaarnemingen zijn niet beschikbaar.'));renderProviders(data.provider_health);
}
function renderSystemStatus(){
 const status=app.status;if(!status)return;autoRender($('#footerVersion'),autoCopy('version','Foundly {version} · Automotive-schema {schema}',{version:status.version??autoUnknown(),schema:status.schema_version??autoUnknown()}));autoRender($('#partnerName'),status.dealer_profile?.display_name||autoCopy('dealer_unknown','Dealer onbekend'));
 const providers=Array.isArray(status.providers)?status.providers:[],configured=providers.some(provider=>provider.configured===true),observed=providers.some(provider=>provider.category==='MARKETPLACE'&&searchObserved(provider));
 $('#railStatusLight').className='status-light '+(observed?'ok':configured?'partial':'error');autoRender($('#railStatusText'),observed?autoCopy('search_status','Zoekopdracht waargenomen'):configured?autoCopy('configured_status','Toegang geconfigureerd'):autoCopy('limited','Beperkte brondata'));if(!app.overview)renderProviders(status.providers);
}
function invalidateAutomotiveAccess(){
 app.accessGeneration++;app.accessAllowed=false;app.searchPending=app.zeroPending=false;app.search=null;app.results=[];app.analyses.clear();app.selectedId=null;
 for(const id of ['vehicleGrid','criteriaPanel','todayList','detailContent','detailImage','detailProvider','detailTitle','detailSubtitle','zeroAnswer'])$('#'+id).replaceChildren();
 autoRender($('#resultCount'),autoUnknown());autoRender($('#detailScore').querySelector('strong'),autoUnknown());$('#sourceLink').removeAttribute('href');$('#sourceLink').hidden=true;$('#vehicleDetail').hidden=true;$('#criteriaPanel').hidden=true;$('#searchButton').disabled=true;$('#zeroQuery').disabled=true;$('#zeroForm button').disabled=true;
}
async function loadStatus(){
 const token=++app.statusGeneration,access=app.accessGeneration;
 try{const [status,overview]=await Promise.all([api('/api/automotive/status'),api('/api/automotive/overview')]);if(token!==app.statusGeneration||access!==app.accessGeneration)return;app.status=status;app.overview=overview;app.accessAllowed=true;$('#searchButton').disabled=app.searchPending;$('#zeroQuery').disabled=$('#zeroForm button').disabled=app.zeroPending;renderSystemStatus();renderOverview();}
 catch(error){if(token!==app.statusGeneration||access!==app.accessGeneration)return;app.status=app.overview=null;$('#automotiveOverviewGrid').replaceChildren();autoRender($('#partnerName'),autoCopy('dealer_unknown','Dealer onbekend'));autoRender($('#footerVersion'),autoCopy('unavailable','Providerstatus is niet beschikbaar.'));autoRender($('#automotiveObserved'),autoUnknown());autoRender($('#inventoryOperationState'),autoCopy('inventory_unknown','Voorraadwaarnemingen zijn niet beschikbaar.'));if([401,403].includes(error.status))invalidateAutomotiveAccess();$('#railStatusLight').className='status-light error';autoRender($('#railStatusText'),autoCopy('unavailable_short','Niet beschikbaar'));
  const host=$('#providerGrid');host.replaceChildren();const card=autoElement('div','','empty-state small');card.append(autoElement('h3',autoCopy('unavailable','Providerstatus is niet beschikbaar.')),autoElement('p',autoError(error)));host.append(card);toast(autoCopy('load_error','Providerstatus: {reason}',{reason:autoError(error)}),'error');}
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

async function enrichResults(generation=app.searchGeneration,access=app.accessGeneration) {
  const candidates = app.results.slice(0, 24);
  const analyses = await Promise.all(candidates.map(async candidate => {
    try {
      const payload = await api(`/api/automotive/vehicles/${encodeURIComponent(candidate.canonical_listing_id)}/analysis`);
      return [candidate.canonical_listing_id, payload.analysis];
    } catch { return [candidate.canonical_listing_id, null]; }
  }));
  if(generation!==app.searchGeneration||access!==app.accessGeneration||!app.accessAllowed)return;
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
  if(!app.accessAllowed)return;const generation=++app.searchGeneration,access=app.accessGeneration;app.searchPending=true;
  setSearchLoading(true);
  $('#searchState').textContent = 'Provider-query actief';
  try {
    const search = await api('/api/automotive/search', { method: 'POST', body: JSON.stringify({ query }) });
    if(generation!==app.searchGeneration||access!==app.accessGeneration||!app.accessAllowed)return;
    app.search = search;
    app.results = search.results || [];
    app.analyses.clear();
    renderCriteria(search);
    $('#correlationState').textContent = search.correlation_id ? `Trace ${search.correlation_id.slice(0, 12)}` : 'Trace voltooid';
    $('#searchState').textContent = `${label(search.status)} · ${app.results.length} listings`;
    renderResults();
    await enrichResults(generation,access);
    if(generation!==app.searchGeneration||access!==app.accessGeneration||!app.accessAllowed)return;
    if (!app.results.length) toast('De query is uitgevoerd; er zijn geen echte passende marketplace-listings.', search.status === 'unavailable' ? 'error' : 'info');
  } catch (error) {
    if(generation!==app.searchGeneration||access!==app.accessGeneration)return;
    app.results = [];
    $('#searchState').textContent = 'Query mislukt';
    $('#vehicleGrid').innerHTML = `<div class="empty-state"><h3>Zoekopdracht niet voltooid</h3><p>${escapeHtml(error.message)}</p></div>`;
    toast(error.message, 'error');
  } finally { if(generation===app.searchGeneration&&access===app.accessGeneration){app.searchPending=false;setSearchLoading(false);} }
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
  if(!app.accessAllowed)return;const generation=++app.detailGeneration,access=app.accessGeneration;
  try {
    let analysis = analysisFor(id);
    if (!analysis) {
      const payload = await api(`/api/automotive/vehicles/${encodeURIComponent(id)}/analysis`);
      if(generation!==app.detailGeneration||access!==app.accessGeneration||!app.accessAllowed)return;
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
  } catch (error) { if(generation===app.detailGeneration&&access===app.accessGeneration)toast(`Voertuiganalyse: ${error.message}`, 'error'); }
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
  if(!app.accessAllowed)return;const generation=++app.todayGeneration,access=app.accessGeneration;
  $('#todayList').innerHTML = '<div class="loading-grid"><span class="loading-ring" aria-label="Kansen worden berekend"></span></div>';
  try { const payload=await api('/api/automotive/opportunities/today?limit=3');if(generation===app.todayGeneration&&access===app.accessGeneration&&app.accessAllowed)renderToday(payload); }
  catch (error) { if(generation!==app.todayGeneration||access!==app.accessGeneration)return;$('#todayList').innerHTML = `<div class="empty-state small"><h3>Kansen niet beschikbaar</h3><p>${escapeHtml(error.message)}</p></div>`; }
}

async function askZero(message) {
  if(!app.accessAllowed||app.zeroPending)return;app.zeroPending=true;const access=app.accessGeneration;
  const input = $('#zeroQuery'), button = $('#zeroForm button');
  input.disabled = true;
  button.disabled = true;
  $('#zeroAnswer').textContent = 'ZERO analyseert de tenantcontext…';
  try {
    app.zeroTurn++;
    const payload = await api('/api/zero/turn', { method: 'POST', body: JSON.stringify({ message, conversation_id: app.zeroConversationId, turn_id: `automotive-ui-${Date.now()}-${app.zeroTurn}` }) });
    if(access!==app.accessGeneration||!app.accessAllowed)return;
    $('#zeroAnswer').textContent = payload.display_text || payload.answer || 'ZERO leverde geen tekstantwoord.';
    const context = payload.automotive_data?.context;
    if (context?.ranked?.length) {
      for (const analysis of context.ranked) app.analyses.set(analysis.candidate.canonical_listing_id, analysis);
      if (context.selected_candidate_id) app.selectedId = context.selected_candidate_id;
      renderResults();
    }
    input.value = '';
  } catch (error) {
    if(access!==app.accessGeneration)return;
    $('#zeroAnswer').textContent = `ZERO kon de opdracht niet afronden: ${error.message}`;
    toast(error.message, 'error');
  } finally { if(access===app.accessGeneration){app.zeroPending=false;input.disabled = false; button.disabled = false; input.focus();} }
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
$('#closeDetail').addEventListener('click', () => { app.detailGeneration++;$('#vehicleDetail').hidden = true; });
$$('.detail-tabs button').forEach(button => button.addEventListener('click', () => {
  app.activeTab = button.dataset.tab;
  $$('.detail-tabs button').forEach(tab => tab.setAttribute('aria-selected', String(tab === button)));
  renderDetailContent();
}));

Promise.resolve(globalThis.FoundlyI18n?.ready).then(()=>Promise.allSettled([loadStatus(), loadToday()]));
