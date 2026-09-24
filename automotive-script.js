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

function safeExternalUrl(value) {
  try {
    const url = new URL(String(value));
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.toString() : null;
  } catch { return null; }
}

function vehicleName(candidate = {}) {
  return [candidate.vehicle?.make, candidate.vehicle?.model, candidate.vehicle?.variant, candidate.vehicle?.trim].filter(Boolean).join(' ') || searchCopy('name_missing','Naam niet geleverd');
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
 app.status=app.overview=null;$('#automotiveOverviewGrid').replaceChildren();$('#providerGrid').replaceChildren();autoRender($('#partnerName'),autoCopy('dealer_unknown','Dealer onbekend'));autoRender($('#footerVersion'),autoUnknown());autoRender($('#automotiveObserved'),autoUnknown());autoRender($('#inventoryOperationState'),autoCopy('inventory_unknown','Voorraadwaarnemingen zijn niet beschikbaar.'));autoRender($('#correlationState'),autoUnknown());autoRender($('#searchState'),autoError({status:403}));$('#railStatusLight').className='status-light error';autoRender($('#railStatusText'),autoCopy('unavailable_short','Niet beschikbaar'));
}
async function loadStatus(){
 const token=++app.statusGeneration,access=app.accessGeneration;
 try{const [status,overview]=await Promise.all([api('/api/automotive/status'),api('/api/automotive/overview')]);if(token!==app.statusGeneration||access!==app.accessGeneration)return;app.status=status;app.overview=overview;app.accessAllowed=true;$('#searchButton').disabled=app.searchPending;$('#zeroQuery').disabled=$('#zeroForm button').disabled=app.zeroPending;renderSystemStatus();renderOverview();}
 catch(error){if(token!==app.statusGeneration||access!==app.accessGeneration)return;app.status=app.overview=null;$('#automotiveOverviewGrid').replaceChildren();autoRender($('#partnerName'),autoCopy('dealer_unknown','Dealer onbekend'));autoRender($('#footerVersion'),autoCopy('unavailable','Providerstatus is niet beschikbaar.'));autoRender($('#automotiveObserved'),autoUnknown());autoRender($('#inventoryOperationState'),autoCopy('inventory_unknown','Voorraadwaarnemingen zijn niet beschikbaar.'));if([401,403].includes(error.status))invalidateAutomotiveAccess();$('#railStatusLight').className='status-light error';autoRender($('#railStatusText'),autoCopy('unavailable_short','Niet beschikbaar'));
  const host=$('#providerGrid');host.replaceChildren();const card=autoElement('div','','empty-state small');card.append(autoElement('h3',autoCopy('unavailable','Providerstatus is niet beschikbaar.')),autoElement('p',autoError(error)));host.append(card);toast(autoCopy('load_error','Providerstatus: {reason}',{reason:autoError(error)}),'error');}
}

const searchCopy=(key,fallback,params={})=>globalThis.FoundlyI18n?FoundlyI18n.message('automotive.search.'+key,params):String(fallback).replace(/\{([a-z_]+)\}/g,(_,name)=>String(params[name]??''));
function autoAttr(node,key,value){if(globalThis.FoundlyI18n)FoundlyI18n.renderAttribute(node,key,value);else node.setAttribute(key,String(value));}
const autoFinite=value=>typeof value==='number'&&Number.isFinite(value),autoDecimal=(value,options={})=>autoLive(()=>autoFinite(value)?new Intl.NumberFormat(globalThis.FoundlyI18n?.locale||'nl-NL',{maximumFractionDigits:2,...options}).format(value):String(autoUnknown())),autoMoney=value=>autoDecimal(value,{style:'currency',currency:'EUR',maximumFractionDigits:0});
const SEARCH_ENUMS=['PETROL','DIESEL','ELECTRIC','HYBRID','PLUGIN_HYBRID','LPG','HYDROGEN','AUTOMATIC','MANUAL','AWD','RWD','FWD','COMPLETED','PARTIAL','INSUFFICIENT_EVIDENCE'];
function searchEnum(value){const code=typeof value==='string'?value.toUpperCase():'';if(AUTO_STATES.includes(code))return autoState(code);return SEARCH_ENUMS.includes(code)?searchCopy('enum.'+code.toLowerCase(),code):typeof value==='string'&&value?value:autoUnknown();}
function autoEmpty(title,body,small=false){const node=autoElement('div','','empty-state'+(small?' small':''));node.append(autoElement('h3',title),autoElement('p',body));return node;}
function autoLoading(message){const node=autoElement('div','','loading-grid'),ring=autoElement('span','','loading-ring');autoAttr(ring,'aria-label',message);node.append(ring);return node;}
function searchDenied(error,access){if([401,403].includes(error.status)&&access===app.accessGeneration){invalidateAutomotiveAccess();return true;}return false;}
const criteriaLabels={make:'Merk',model:'Model',variant:'Variant',trim:'Uitvoering',year_min:'Vanaf',year_max:'Tot',mileage_min_km:'Km vanaf',mileage_max_km:'Km maximaal',purchase_price_min_eur:'Prijs vanaf',purchase_price_max_eur:'Inkoop maximaal',country:'Land',fuel:'Brandstof',transmission:'Transmissie',drivetrain:'Aandrijving',power_min_kw:'Vermogen vanaf',options:'Opties'};
function criteriaValue(key,value){
 if(['purchase_price_min_eur','purchase_price_max_eur'].includes(key))return autoValue(autoMoney(value));
 if(['mileage_min_km','mileage_max_km','power_min_kw'].includes(key))return searchCopy('unit','{value} {unit}',{value:autoDecimal(value),unit:key==='power_min_kw'?'kW':'km'});
 if(['fuel','transmission','drivetrain'].includes(key))return searchEnum(value);
 if(['year_min','year_max'].includes(key))return autoCount(value)?String(value):autoUnknown();
 if(Array.isArray(value))return value.join(', ');return value;
}
function renderCriteria(search){
 const panel=$('#criteriaPanel'),list=autoElement('dl'),execution=autoElement('div','','provider-execution');
 const fields=Object.entries(search.criteria||{}).filter(([,value])=>value!==null&&value!==undefined&&value!==''&&(!Array.isArray(value)||value.length));
 for(const [key,value]of fields){const row=autoElement('div');row.append(autoElement('dt',Object.hasOwn(criteriaLabels,key)?searchCopy('field.'+key,criteriaLabels[key]):key),autoElement('dd',criteriaValue(key,value)));list.append(row);}
 for(const provider of Array.isArray(search.provider_executions)?search.provider_executions:[]){const state=providerState(provider);execution.append(autoElement('span',searchCopy('provider_state','{provider} · {state}',{provider:provider.provider||autoUnknown(),state:autoState(state)}),'state-pill '+state.toLowerCase()));}
 panel.replaceChildren(list,execution);panel.hidden=false;
}
function analysisFor(id){return app.analyses.get(id)||null;}
function displayScore(score){return score?.available===true&&autoFinite(score.score)&&score.score>=0&&score.score<=100?autoValue(autoDecimal(score.score)):autoUnknown();}
function vehicleImage(candidate,className){const host=autoElement('div','',className);if(Array.isArray(candidate.vehicle?.images)&&candidate.vehicle.images.length){const image=autoElement('img');image.src='/api/automotive/images/'+encodeURIComponent(candidate.canonical_listing_id)+'/0';autoAttr(image,'alt',vehicleName(candidate));image.loading='lazy';image.addEventListener('error',()=>image.remove(),{once:true});host.append(image);}return host;}
function vehicleButton(candidate,value,className){const button=autoElement('button',value,className);button.type='button';button.setAttribute('data-vehicle-id',candidate.canonical_listing_id);button.addEventListener('click',()=>showVehicle(candidate.canonical_listing_id));return button;}
function vehicleCard(candidate){
 const card=autoElement('article','','vehicle-card'),image=vehicleImage(candidate,'vehicle-image'),raw=candidate.listing?.freshness?.classification,freshness=['LIVE','CACHED','STALE','UNAVAILABLE'].includes(raw)?raw:'UNKNOWN';
 image.append(autoElement('span',autoState(freshness),'freshness '+freshness.toLowerCase()),autoElement('span',candidate.identity?.provider||autoUnknown(),'provider-label'));
 const body=autoElement('div','','vehicle-body'),titleRow=autoElement('div','','vehicle-title-row'),title=autoElement('h3',vehicleName(candidate)),score=autoElement('span',displayScore(analysisFor(candidate.canonical_listing_id)?.buy_score),'mini-score');autoAttr(title,'title',vehicleName(candidate));autoAttr(score,'title','Foundly Buy Score');titleRow.append(title,score);
 const specs=autoElement('div','','vehicle-specs');for(const [key,name,value]of [['year','Bouwjaar',autoCount(candidate.vehicle?.build_year)?String(candidate.vehicle.build_year):autoUnknown()],['mileage','Kilometers',autoValue(autoDecimal(candidate.vehicle?.mileage_km))],['fuel','Brandstof',searchEnum(candidate.vehicle?.fuel)]]){const item=autoElement('div');item.append(autoElement('span',searchCopy(key,name)),autoElement('strong',value));specs.append(item);}
 body.append(titleRow,autoElement('p',autoValue(autoMoney(candidate.commercial?.gross_price_eur)),'vehicle-price'),autoElement('p',[candidate.seller?.city,candidate.seller?.country].filter(Boolean).join(', ')||searchCopy('location_unknown','Locatie onbekend'),'vehicle-location'),specs,vehicleButton(candidate,searchCopy('open','Open bewijs')));card.append(image,body);return card;
}
function renderResults(){
 const known=Array.isArray(app.search?.results),host=$('#vehicleGrid');autoRender($('#resultCount'),known?autoValue(autoNumber(app.results.length)):autoUnknown());
 if(!app.results.length){const title=app.search?.status==='unavailable'?searchCopy('providers_unavailable','Geen marketplace-provider bereikbaar'):known?searchCopy('no_matches','Geen passende echte listings'):searchCopy('results_unknown','Zoekresultaten niet beschikbaar');host.replaceChildren(autoEmpty(title,searchCopy('no_inventory','Pas criteria aan of configureer een officiële marketplace-provider. Er wordt geen demo-inventaris ingevuld.')));return;}
 host.replaceChildren(...app.results.slice(0,24).map(vehicleCard));
}
async function enrichResults(generation=app.searchGeneration,access=app.accessGeneration){
 const candidates=app.results.slice(0,24),analyses=await Promise.all(candidates.map(async candidate=>{try{const payload=await api(`/api/automotive/vehicles/${encodeURIComponent(candidate.canonical_listing_id)}/analysis`);return [candidate.canonical_listing_id,payload.analysis];}catch(error){searchDenied(error,access);return [candidate.canonical_listing_id,null];}}));
 if(generation!==app.searchGeneration||access!==app.accessGeneration||!app.accessAllowed)return;
 for(const [id,analysis]of analyses)if(analysis)app.analyses.set(id,analysis);
 const score=candidate=>{const value=analysisFor(candidate.canonical_listing_id)?.buy_score;return value?.available===true&&autoFinite(value.score)&&value.score>=0&&value.score<=100?value.score:-1;};app.results.sort((left,right)=>score(right)-score(left));renderResults();
}
function setSearchLoading(loading){$('#searchButton').disabled=loading||!app.accessAllowed;autoRender($('#searchButton').querySelector('span'),loading?searchCopy('searching','Providers zoeken'):searchCopy('analyse','Analyseer markt'));if(loading)$('#vehicleGrid').replaceChildren(autoLoading(searchCopy('search_loading','Providers worden doorzocht')));}
async function runSearch(query){
 if(!app.accessAllowed||app.searchPending)return;const generation=++app.searchGeneration,access=app.accessGeneration;app.searchPending=true;app.search=null;app.results=[];app.analyses.clear();app.selectedId=null;app.detailGeneration++;$('#vehicleDetail').hidden=true;$('#detailContent').replaceChildren();$('#criteriaPanel').replaceChildren();$('#criteriaPanel').hidden=true;autoRender($('#resultCount'),autoUnknown());autoRender($('#correlationState'),autoUnknown());setSearchLoading(true);autoRender($('#searchState'),searchCopy('active','Provider-query actief'));
 try{const search=await api('/api/automotive/search',{method:'POST',body:JSON.stringify({query})});if(generation!==app.searchGeneration||access!==app.accessGeneration||!app.accessAllowed)return;
  if(!Array.isArray(search.results))throw Object.assign(new Error('Invalid Automotive search response'),{code:'automotive_response_invalid'});
  app.search=search;app.results=search.results;renderCriteria(search);autoRender($('#correlationState'),typeof search.correlation_id==='string'&&search.correlation_id?searchCopy('trace','Trace {id}',{id:search.correlation_id.slice(0,12)}):searchCopy('trace_done','Trace voltooid'));autoRender($('#searchState'),searchCopy('result_state','{state} · {count} listings',{state:searchEnum(search.status),count:autoNumber(app.results.length)}));renderResults();await enrichResults(generation,access);
  if(generation!==app.searchGeneration||access!==app.accessGeneration||!app.accessAllowed)return;if(!app.results.length)toast(searchCopy('empty_query','De query is uitgevoerd; er zijn geen echte passende marketplace-listings.'),search.status==='unavailable'?'error':'info');
 }catch(error){if(generation!==app.searchGeneration||access!==app.accessGeneration)return;if(searchDenied(error,access)){toast(autoError(error),'error');return;}app.search=null;app.results=[];autoRender($('#searchState'),searchCopy('failed','Query mislukt'));$('#vehicleGrid').replaceChildren(autoEmpty(searchCopy('incomplete','Zoekopdracht niet voltooid'),autoError(error)));toast(autoError(error),'error');
 }finally{if(generation===app.searchGeneration&&access===app.accessGeneration){app.searchPending=false;setSearchLoading(false);}}
}

const detailCopy=(key,fallback,params={})=>globalThis.FoundlyI18n?FoundlyI18n.message('automotive.detail.'+key,params):String(fallback).replace(/\{([a-z_]+)\}/g,(_,name)=>String(params[name]??''));
const detailEnums=['HIGH','MEDIUM','LOW','FACT','ESTIMATE','CALCULATION','NEEDS_INPUT','ESTIMATED','NOT_APPLICABLE'];
function detailEnum(value){const code=typeof value==='string'?value.toUpperCase():'';return detailEnums.includes(code)?detailCopy('enum.'+code.toLowerCase(),code):searchEnum(value);}
const detailFields={purchase_price:'purchase',bpm:'bpm',transport_eur:'transport',registration_eur:'registration',inspection_eur:'inspection',handling_eur:'handling',other_eur:'other',purchase_price_eur:'purchase',fx_rate_to_eur:'fx_rate',co2_g_km:'co2',first_registration:'first_registration',valid_first_registration:'valid_registration'};
function detailField(value){return Object.hasOwn(detailFields,value)?detailCopy('field.'+detailFields[value],value):value;}
const detailScoreValue=value=>autoFinite(value)&&value>=0&&value<=100?autoDecimal(value):autoUnknown();
function metric(title,value,note){const node=autoElement('article','','metric-card');node.append(autoElement('span',title),autoElement('strong',value),autoElement('small',note||''));return node;}
function detailGrid(...nodes){const grid=autoElement('div','','metric-grid');grid.append(...nodes);return grid;}
function whyContent(analysis){
 const score=analysis.buy_score||{},components=Array.isArray(score.components)?score.components:[];
 if(score.available!==true)return autoEmpty(detailCopy('score_unavailable','Buy Score niet beschikbaar'),score.reason&&score.reason!=='Minimaal drie evidence-backed componenten vereist'?score.reason:detailCopy('insufficient_components','Minimaal drie onderbouwde componenten vereist.'),true);
 const names={'Acquisition Advantage':'acquisition_advantage','Expected Margin':'expected_margin','Supply Scarcity':'supply_scarcity','Dealer Fit':'dealer_fit','Data Confidence':'data_confidence','Risk':'risk'};
 return detailGrid(...components.map(item=>metric(Object.hasOwn(names,item.name)?detailCopy('component.'+names[item.name],item.name):item.name,detailCopy('score_value','{value}/100',{value:detailScoreValue(item.score)}),detailCopy('weight','Zekerheid: {confidence} · gewicht {weight}',{confidence:detailEnum(item.confidence),weight:autoDecimal(item.weight)}))));
}
function marketContent(analysis){
 const signals=analysis.market_signals||{},comparable=analysis.comparables||{},root=autoElement('div'),value=signals.price_position?.value;
 root.append(detailGrid(
  metric(detailCopy('nl_comparables','Nederlandse vergelijkbare listings'),autoValue(autoNumber(comparable.comparable_count)),detailCopy('confidence','Zekerheid: {value}',{value:detailEnum(comparable.confidence)})),
  metric(detailCopy('median_price','Mediane vraagprijs'),autoValue(autoMoney(comparable.price_distribution_eur?.median)),detailCopy('percentiles','p25 {low} · p75 {high}',{low:autoMoney(comparable.price_distribution_eur?.p25),high:autoMoney(comparable.price_distribution_eur?.p75)})),
  metric(detailCopy('scarcity','Schaarste van listings'),detailEnum(signals.listing_scarcity?.value),detailCopy('matched','{count} vergelijkbare Nederlandse listings',{count:autoNumber(comparable.comparable_count)})),
  metric(detailCopy('price_position','Prijspositie'),autoValue(autoFinite(value)?autoDecimal(value/100,{style:'percent'}):autoUnknown()),detailCopy('versus_median','Ten opzichte van de Nederlandse listingmediaan'))
 ),autoElement('div',detailCopy('sales_warning','Werkelijke verkoopvraag blijft {type}: marketplace-aanbod bewijst geen gerealiseerde verkopen.',{type:detailEnum(signals.actual_sales_demand?.type)}),'today-warning'));return root;
}
function economicsContent(analysis){
 const economics=analysis.economics||{},margin=economics.expected_gross_margin_range||{},root=autoElement('div');root.append(detailGrid(
  metric(detailCopy('all_in','Totale inkoopkosten'),autoValue(autoMoney(economics.all_in_acquisition_eur)),detailEnum(economics.status)),
  metric(detailCopy('retail_median','Verwachte verkoopmediaan'),autoValue(autoMoney(economics.expected_retail_range?.expected_eur)),detailEnum(economics.expected_retail_range?.type)),
  metric(detailCopy('margin','Geschatte marge'),autoValue(autoMoney(margin.expected_eur)),detailCopy('range','{low} – {high}',{low:autoMoney(margin.low_eur),high:autoMoney(margin.high_eur)})),
  metric(detailCopy('bpm_estimate','Geschatte BPM'),autoValue(autoMoney(economics.bpm?.estimated_payable_bpm_eur)),economics.bpm?.rule_version||detailCopy('not_calculable','Niet berekenbaar'))
 ));const list=autoElement('ul','','evidence-list');for(const item of Array.isArray(economics.breakdown)?economics.breakdown:[]){const row=autoElement('li');row.append(autoElement('span',detailCopy('component_type','{component} · {type}',{component:detailField(item.component),type:detailEnum(item.type)})),autoElement('strong',autoValue(autoMoney(item.value_eur))));list.append(row);}root.append(list);
 if(Array.isArray(economics.missing_fields)&&economics.missing_fields.length)root.append(autoElement('div',detailCopy('missing','Nog nodig: {fields}',{fields:autoLive(()=>economics.missing_fields.map(value=>String(detailField(value))).join(', '))}),'today-warning'));return root;
}
function comparablesContent(analysis){
 const rows=analysis.comparables?.listings;if(!Array.isArray(rows))return autoEmpty(detailCopy('comparables_unknown','Vergelijkingsdata niet beschikbaar'),autoNoData(),true);
 if(!rows.length)return autoEmpty(detailCopy('no_comparables','Geen verdedigbare vergelijkbare listings'),detailCopy('no_replacement','Foundly toont geen vervangende marktwaarde.'),true);
 const host=autoElement('div','','table-wrap'),table=autoElement('table','','detail-table'),head=autoElement('thead'),header=autoElement('tr'),body=autoElement('tbody');for(const [key,label]of [['provider','Provider'],['price','Prijs'],['km','Km'],['year','Jaar'],['match','Match'],['freshness','Actualiteit'],['source','Bron']])header.append(autoElement('th',detailCopy(key,label)));head.append(header);
 for(const row of rows){const tr=autoElement('tr');for(const value of [row.provider||autoUnknown(),autoValue(autoMoney(row.price_eur)),autoValue(autoDecimal(row.mileage_km)),autoCount(row.build_year)?String(row.build_year):autoUnknown(),detailCopy('score_value','{value}/100',{value:detailScoreValue(row.similarity_score)}),autoState(row.freshness?.classification)])tr.append(autoElement('td',value));const source=safeExternalUrl(row.source_url),cell=autoElement('td',source?'':autoUnknown());if(source)cell.append(detailLink(source,detailCopy('listing','Listing')));tr.append(cell);body.append(tr);}table.append(head,body);host.append(table);return host;
}
function risksContent(analysis){
 const risks=analysis.risks;if(!Array.isArray(risks))return autoEmpty(detailCopy('risks_unknown','Risicowaarnemingen niet beschikbaar'),autoNoData(),true);
 if(!risks.length)return autoEmpty(detailCopy('no_risks','Geen expliciete datarisico’s gemarkeerd'),detailCopy('inspection_note','Dit vervangt geen fysieke, technische of juridische voertuiginspectie.'),true);
 const known=['VIN_UNKNOWN','VAT_SEMANTICS_UNKNOWN','LISTING_STALE','INSUFFICIENT_NL_COMPARABLES','ECONOMICS_INPUT_MISSING'],list=autoElement('ul','','risk-list');for(const risk of risks){const row=autoElement('li');row.append(autoElement('span','','risk-dot '+(risk.severity==='HIGH'?'high':'')),autoElement('strong',known.includes(risk.code)?detailCopy('risk.'+risk.code.toLowerCase(),risk.code):risk.code),autoElement('span',detailEnum(risk.severity)));list.append(row);}return list;
}
function detailLink(url,value){const link=autoElement('a',value);link.href=url;link.target='_blank';link.rel='noopener noreferrer';return link;}
function sourceContent(analysis){
 const candidate=analysis.candidate||{},source=safeExternalUrl(candidate.identity?.source_url),list=autoElement('ul','','source-list'),verified=candidate.provenance?.provider_verified;
 for(const [key,name,value]of [
  ['provider','Provider',candidate.identity?.provider||autoUnknown()],['listing_id','Provider listing-ID',candidate.identity?.provider_listing_id||autoUnknown()],
  ['seller','Aanbieder',candidate.seller?.name||detailCopy('not_supplied','Niet geleverd')],['location','Locatie',[candidate.seller?.city,candidate.seller?.country].filter(Boolean).join(', ')||detailCopy('not_supplied','Niet geleverd')],
  ['verified','Providergeverifieerd',verified===true?detailCopy('yes','JA'):verified===false?detailCopy('no','NEE'):autoUnknown()],['transformation','Transformatie',candidate.provenance?.transformation_version||autoUnknown()],['raw_reference','Ruwe bronreferentie',candidate.provenance?.raw_source_reference||autoUnknown()],
  ['observed','Waarneming',detailCopy('utc','{time} UTC',{time:autoTime(analysis.observed_at)})]
 ]){const row=autoElement('li');row.append(autoElement('span',detailCopy(key,name)),autoElement('strong',value));list.append(row);}
 const row=autoElement('li'),value=autoElement('strong',source?'':detailCopy('no_url','Geen veilige URL geleverd'));if(source)value.append(detailLink(source,detailCopy('open_listing','Open providerlisting')));row.append(autoElement('span',detailCopy('source','Bron')),value);list.append(row);return list;
}
function renderDetailContent(){const analysis=analysisFor(app.selectedId);if(!analysis){$('#detailContent').replaceChildren();return;}const renderers={why:whyContent,market:marketContent,economics:economicsContent,comparables:comparablesContent,risks:risksContent,source:sourceContent};$('#detailContent').replaceChildren((renderers[app.activeTab]||whyContent)(analysis));}
function clearVehicleDetail(){app.selectedId=null;for(const id of ['detailContent','detailImage','detailProvider','detailTitle','detailSubtitle'])$('#'+id).replaceChildren();autoRender($('#detailScore').querySelector('strong'),autoUnknown());$('#sourceLink').removeAttribute('href');$('#sourceLink').hidden=true;$('#vehicleDetail').hidden=true;}
async function showVehicle(id){
 if(!app.accessAllowed)return;const generation=++app.detailGeneration,access=app.accessGeneration;clearVehicleDetail();
 try{let analysis=analysisFor(id);if(!analysis){const payload=await api(`/api/automotive/vehicles/${encodeURIComponent(id)}/analysis`);if(generation!==app.detailGeneration||access!==app.accessGeneration||!app.accessAllowed)return;analysis=payload.analysis;if(!analysis?.candidate)throw Object.assign(new Error('Invalid Automotive analysis response'),{code:'automotive_response_invalid'});app.analyses.set(id,analysis);}
  app.selectedId=id;const candidate=analysis.candidate;autoRender($('#detailProvider'),searchCopy('provider_state','{provider} · {state}',{provider:candidate.identity?.provider||autoUnknown(),state:autoState(candidate.listing?.freshness?.classification)}));autoRender($('#detailTitle'),vehicleName(candidate));autoRender($('#detailSubtitle'),detailCopy('subtitle','{price} · {mileage} km · {year} · {location}',{price:autoMoney(candidate.commercial?.gross_price_eur),mileage:autoDecimal(candidate.vehicle?.mileage_km),year:autoCount(candidate.vehicle?.build_year)?String(candidate.vehicle.build_year):detailCopy('year_unknown','Jaar onbekend'),location:[candidate.seller?.city,candidate.seller?.country].filter(Boolean).join(', ')||searchCopy('location_unknown','Locatie onbekend')}));autoRender($('#detailScore').querySelector('strong'),displayScore(analysis.buy_score));
  const source=safeExternalUrl(candidate.identity?.source_url);$('#sourceLink').hidden=!source;if(source)$('#sourceLink').href=source;const image=vehicleImage({...candidate,canonical_listing_id:id},'detail-image');$('#detailImage').replaceChildren(...image.childNodes);renderDetailContent();$('#vehicleDetail').hidden=false;$('#vehicleDetail').scrollIntoView({behavior:'smooth',block:'start'});
 }catch(error){if(generation===app.detailGeneration&&access===app.accessGeneration){searchDenied(error,access);toast(searchCopy('detail_error','Voertuiganalyse: {reason}',{reason:autoError(error)}),'error');}}
}

function renderToday(payload){
 const host=$('#todayList'),known=Array.isArray(payload.opportunities),opportunities=known?payload.opportunities:[];
 if(!opportunities.length){host.replaceChildren(autoEmpty(known?searchCopy('no_top','Geen onderbouwde Top 3'):searchCopy('today_unavailable','Kansen niet beschikbaar'),payload.reason==='NO_REAL_MARKETPLACE_DATA'?searchCopy('no_records','Er zijn geen echte geverifieerde marketplace-listings beschikbaar.'):payload.explanation||payload.reason||searchCopy('insufficient','Er is onvoldoende bronbewijs voor een aanbeveling.'),true));return;}
 const rows=opportunities.map(item=>{const candidate=item.candidate||{};app.analyses.set(candidate.canonical_listing_id,item);const button=vehicleButton(candidate,'','today-item'),copy=autoElement('span','','today-copy');copy.append(autoElement('strong',vehicleName(candidate)),autoElement('span',searchCopy('today_summary','{price} · {provider} · {freshness}',{price:autoMoney(candidate.commercial?.gross_price_eur),provider:candidate.identity?.provider||autoUnknown(),freshness:autoState(candidate.listing?.freshness?.classification)})));button.append(autoElement('span',autoValue(autoNumber(item.rank)),'today-rank'),copy,autoElement('span',displayScore(item.buy_score),'today-score'));return button;});
 if(payload.warning)rows.push(autoElement('div',payload.personalisation==='UNCONFIGURED'?searchCopy('no_profile','Dealerprofiel ontbreekt; aanbevelingen bevatten geen dealerspecifieke voorkeuren.'):payload.warning,'today-warning'));host.replaceChildren(...rows);
}
async function loadToday(){
 if(!app.accessAllowed)return;const generation=++app.todayGeneration,access=app.accessGeneration;$('#todayList').replaceChildren(autoLoading(searchCopy('today_loading','Kansen worden berekend')));
 try{const payload=await api('/api/automotive/opportunities/today?limit=3');if(generation===app.todayGeneration&&access===app.accessGeneration&&app.accessAllowed)renderToday(payload);}
 catch(error){if(generation!==app.todayGeneration||access!==app.accessGeneration)return;searchDenied(error,access);$('#todayList').replaceChildren(autoEmpty(searchCopy('today_unavailable','Kansen niet beschikbaar'),autoError(error),true));}
}
async function askZero(message){
 if(!app.accessAllowed||app.zeroPending)return;app.zeroPending=true;const access=app.accessGeneration,input=$('#zeroQuery'),button=$('#zeroForm button');input.disabled=button.disabled=true;autoRender($('#zeroAnswer'),searchCopy('zero_loading','ZERO analyseert de tenantcontext…'));
 try{app.zeroTurn++;const payload=await api('/api/zero/turn',{method:'POST',body:JSON.stringify({message,conversation_id:app.zeroConversationId,turn_id:`automotive-ui-${Date.now()}-${app.zeroTurn}`})});if(access!==app.accessGeneration||!app.accessAllowed)return;
  autoRender($('#zeroAnswer'),payload.display_text||payload.answer||searchCopy('zero_empty','ZERO leverde geen tekstantwoord.'));const context=payload.automotive_data?.context;if(Array.isArray(context?.ranked)&&context.ranked.length){for(const analysis of context.ranked)app.analyses.set(analysis.candidate.canonical_listing_id,analysis);if(context.selected_candidate_id)app.selectedId=context.selected_candidate_id;renderResults();}input.value='';
 }catch(error){if(access!==app.accessGeneration)return;if(error.status===401)invalidateAutomotiveAccess();autoRender($('#zeroAnswer'),searchCopy('zero_error','ZERO kon de opdracht niet afronden: {reason}',{reason:autoError(error)}));toast(autoError(error),'error');
 }finally{if(access===app.accessGeneration){app.zeroPending=false;input.disabled=button.disabled=false;input.focus();}}
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
