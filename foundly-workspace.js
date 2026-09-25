'use strict';

(() => {
  const byId = id => document.getElementById(id);
  const dashboardSession=window.FoundlyDashboardSession.create();
  const dashboardSelectionKey=()=>JSON.stringify([state.workspaceId,byId('dashboardScope').value||'PERSONAL',byId('dashboardQualifier').value.trim()]);
  const workspaceId = location.pathname.replace(/^\/+|\/+$/g, '') || 'home';
  const state = {
    workspaceId,
    navigation: [],
    workspace: null,
    dashboard: null,
    snapshot: null,
    sources: [],
    connectors: [],
    activeSection: 'OVERVIEW',
    editing: false,
    draggedWidget: null,
    conversationId: null,
    recordQuery: ''
  };

  let accessGeneration=0,workspaceLoad=0,registryLoad=0,zeroTurn=0,dashboardWrite=null;
  const dashboardControlState=new Map();
  let connectorView=0,connectorSession=null;const connectorForms=new WeakMap(),connectorActions=new Set(),connectorSyncRequests=new Map();
  const liveMessages=new WeakMap(),liveBindings=new Set(),evidenceViews=new WeakMap(),composerViews=new WeakMap(),identityViews=new WeakMap(),domainViews=new WeakMap(),domainRequests=new Map();
  const i18n=()=>globalThis.FoundlyI18n;
  const copy=(key,params={})=>i18n()?.message(key.startsWith('common.')||key.startsWith('module.')||key.startsWith('analysis.')?key:'workspace.page.'+key,params)||key;
  function live(read){const value=Object.freeze({toString:()=>String(read())});liveMessages.set(value,read);return value;}
  function writeText(element,value,attribute){
    for(const binding of liveBindings)if(binding.element===element&&binding.attribute===attribute)liveBindings.delete(binding);
    const paint=text=>attribute?i18n()?.renderAttribute(element,attribute,text)||element.setAttribute(attribute,String(text)):i18n()?.renderText(element,text)||(element.textContent=String(text??''));
    const read=liveMessages.get(value);if(!read){paint(value);return element;}
    const binding={element,attribute,read,last:null};binding.paint=()=>{const text=String(read());paint(text);binding.last=attribute?element.getAttribute(attribute):element.textContent;};binding.paint();liveBindings.add(binding);return element;
  }
  document.addEventListener('foundly:locale',()=>{for(const binding of liveBindings){const {element,attribute,last}=binding;if(!element.isConnected){liveBindings.delete(binding);continue;}if((attribute?element.getAttribute(attribute):element.textContent)!==last){liveBindings.delete(binding);continue;}binding.paint();}});
  const unknown=()=>copy('common.unknown'),number=value=>live(()=>i18n().number(value)),count=value=>Number.isSafeInteger(value)&&value>=0?number(value):unknown();
  const time=value=>live(()=>typeof value==='string'&&value?i18n().date(value,{dateStyle:'medium',timeStyle:'short',timeZone:'UTC'}):String(unknown()));
  const boolean=value=>value===true?copy('yes'):value===false?copy('no'):unknown();
  const knownStates=new Set(['UNKNOWN','UNCONFIGURED','CONFIGURED','AUTHORIZING','AUTHENTICATED','PROBING','SYNCING','CONNECTED','DEGRADED','ERROR','EXPIRED','DISCONNECTED','REALTIME','NEAR_REALTIME','BATCH','STALE','CONFIGURED_UNVERIFIED','NOT_AVAILABLE']);
  const stateText=value=>knownStates.has(value)?copy('analysis.page.state.'+value.toLowerCase()):value===null||value===undefined||value===''?unknown():String(value);
  const ownedSections=new Set(globalThis.FoundlyLocales?.workspaceSections||[]);
  const sectionLabel=section=>ownedSections.has(section)?copy('section.'+section.toLowerCase().replaceAll(' ','_')):String(section??'');
  const sourceRows=()=>Array.isArray(state.snapshot?.sources)?state.snapshot.sources:[];
  function retireWorkspace(error){
    accessGeneration++;workspaceLoad++;registryLoad++;zeroTurn++;dashboardWrite=null;connectorSyncRequests.clear();domainRequests.clear();lockDashboard(false);dashboardSession.beginLoad(dashboardSelectionKey());
    document.title='Foundly OS';
    Object.assign(state,{workspace:null,dashboard:null,snapshot:null,sources:[],connectors:[],navigation:[],editing:false,draggedWidget:null,conversationId:null,communicationZeroToken:(state.communicationZeroToken||0)+1});
    for(const id of ['dashboardGrid','recordHead','recordRows','sourceMatrix','sourceRegistryGrid','connectorGrid','globalSearchResults','contextContent','metricDialogContent','connectorDetail','zeroActions','globalNav','workspaceTabs'])replaceChildren(byId(id));
    for(const id of ['metricDialog','connectorDialog','widgetDialog','searchDialog'])byId(id)?.close?.();
    for(const id of ['workspaceTitle','workspaceDescription','workspaceEyebrow','contextEyebrow','contextTitle','contextDescription','connectorDialogTitle','metricDialogTitle','recordsTitle','recordCount','connectorCount','sourceRegistryCount','provisionerOutput','zeroOutput'])writeText(byId(id),unknown());
    for(const id of ['sourceFilter','statusFilter','connectorCategory','connectorIndustry','connectorCapability','connectorAuth','connectorTenant','connectorState','sourceRegistryCategory','sourceRegistryCapability','sourceRegistryType','sourceRegistryStatus'])fillSelect(byId(id),[]);
    for(const id of ['saveDashboard','addWidget','industryDashboardPreset','editDashboard','exportWorkspace'])byId(id).disabled=true;
    byId('recordEmpty').hidden=false;byId('workspaceNotice').className='workspace-notice error';writeText(byId('workspaceNotice'),friendlyError(error));
    writeText(byId('workspaceRuntime'),copy('runtime_unavailable'));byId('workspaceRuntime').className='ConnectionBadge error';writeText(byId('sidebarStatus'),copy('check_required'));byId('sidebarStatusLight').className='error';
  }

  const describedSections=new Set(globalThis.FoundlyLocales?.workspaceSectionDescriptions||[]);

  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined && text !== null) {
      if(i18n())writeText(element,text);else element.textContent=String(text);
    }
    return element;
  }

  function replaceChildren(target, children = []) {
    target.replaceChildren(...children.filter(Boolean));
    return target;
  }

  function badge(value, extra = 'ConnectionBadge') {
    const normalized = String(value || 'UNKNOWN').toLowerCase().replace(/[^a-z0-9_-]+/g, '_');
    return node('span', `${extra} ${normalized}`, stateText(value));
  }

  async function request(path, options = {}, isCurrent = () => true) {
    const headers = { accept: 'application/json', ...(options.headers || {}) };
    if (options.body && !headers['content-type']) headers['content-type'] = 'application/json';
    const epoch=accessGeneration;
    const response = await fetch(path, { credentials: 'same-origin', ...options, headers });
    const data = await response.json().catch(() => ({}));
    if(!isCurrent())throw Object.assign(Error('workspace_observation_retired'),{stale:true});
    if (!response.ok) {
      const error = new Error(data.error || data.code || `HTTP ${response.status}`);
      error.status = response.status;
      error.code = data.code || 'request_failed';
      error.data = data;
      if([401,403].includes(response.status)&&epoch===accessGeneration)retireWorkspace(error);
      throw error;
    }
    if(epoch!==accessGeneration)throw Object.assign(Error('workspace_observation_retired'),{stale:true});
    return data;
  }

  function toast(message, isError = false) {
    const element = node('div', `toast${isError ? ' error' : ''}`, message);
    byId('toastRegion').append(element);
    window.setTimeout(() => element.remove(), 5000);
  }

  function friendlyError(error) {
    if(error?.status===401)return copy('session_required');
    if(error?.status===403)return copy('common.access_denied');
    if(error?.status===404)return copy('source_missing');
    if([409,412,428].includes(error?.status))return copy('revision_conflict');
    if(error?.status===429)return copy('common.rate_limited');
    return copy('common.request_failed');
  }

  function formatMetric(metric) {
    if(!metric||metric.available!==true||metric.value===null||metric.value===undefined||metric.value==='')return unknown();
    const value=metric.value;
    if(metric.unit==='CURRENCY_CENTS')return live(()=>i18n().currencyCents(value,metric.currency));
    if(metric.unit==='CURRENCY')return live(()=>i18n().currency(value,metric.currency));
    if(metric.unit==='STATUS')return stateText(value);
    if(['VERSION','IDENTITY','ROLES','PROFILE'].includes(metric.unit))return typeof value==='string'?value:unknown();
    if(typeof value!=='number'||!Number.isFinite(value))return unknown();
    if(['COUNT','EVENTS','SOURCES','CONNECTORS','RECORDS','VEHICLES','EVENTS_PER_HOUR','CONNECTED_PROVIDERS','REAL_OPPORTUNITIES','SEARCHES','PERSISTED_RECOMMENDATIONS','CAMPAIGNS','ACTIVITIES','ROLLUPS','VERSIONS','DEPENDENCIES','RUNS','CONNECTED_CHANNELS','CAPABILITIES'].includes(metric.unit)&&(!Number.isSafeInteger(value)||value<0))return unknown();
    if(metric.unit==='PERCENT')return live(()=>i18n().number(value/100,{style:'percent',maximumFractionDigits:2}));
    if(metric.unit==='RATIO')return live(()=>i18n().number(value,{maximumFractionDigits:2})+'×');
    return live(()=>i18n().number(value,{maximumFractionDigits:2}));
  }

  function renderNavigation() {
    const links = state.navigation.map(item => {
      const link = node('a', '', copy('module.'+(item.id==='home'?'core':item.id)));
      link.href = item.route;
      if (item.id === state.workspaceId) link.setAttribute('aria-current', 'page');
      return link;
    });
    replaceChildren(byId('globalNav'), links);
  }

  function renderTabs() {
    const tabs = (state.workspace?.sections || []).map((section, index) => {
      const button = node('button', index === 0 ? 'active' : '', sectionLabel(section));
      button.type = 'button';
      button.id = `workspace-tab-${index}`;
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-selected', index === 0 ? 'true' : 'false');
      button.setAttribute('aria-controls', state.workspaceId === 'connectors' ? 'sectionConnectors' : section === 'OVERVIEW' ? 'sectionOverview' : state.workspaceId === 'settings' && section === 'PROVISIONER' ? 'settingsProvisioner' : 'sectionContext');
      button.tabIndex = index === 0 ? 0 : -1;
      button.addEventListener('click', () => selectSection(section, button));
      button.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const all = [...byId('workspaceTabs').querySelectorAll('[role="tab"]')], current = all.indexOf(button);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? all.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + all.length) % all.length;
        all[next].focus(); all[next].click();
      });
      return button;
    });
    replaceChildren(byId('workspaceTabs'), tabs);
  }

  function creativeWorkCanLeave(){return !(state.creativeHistoryViews||[]).some(view=>view.isConnected&&!view.canLeave());}
  function selectSection(section, button) {
    if(!creativeWorkCanLeave())return;
    state.activeSection = section;zeroTurn++;state.communicationZeroToken=(state.communicationZeroToken||0)+1;const zeroActions=byId('zeroActions');if(zeroActions)replaceChildren(zeroActions,[]);
    for (const tab of byId('workspaceTabs').querySelectorAll('button')) {
      const selected = tab === button;
      tab.classList.toggle('active', selected);
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    }
    const isConnectorView = state.workspaceId === 'connectors';
    const isProvisioner = state.workspaceId === 'settings' && section === 'PROVISIONER';
    const isOverview = section === 'OVERVIEW' || (state.workspaceId === 'connectors' && section === 'ALL');
    byId('sectionOverview').hidden = !isOverview || isConnectorView;
    byId('sectionOperations').hidden = !isOverview || isConnectorView;
    byId('sectionConnectors').hidden = !isConnectorView;
    byId('settingsProvisioner').hidden = !isProvisioner;
    byId('sectionContext').hidden = isOverview || isConnectorView || isProvisioner;
    if (isConnectorView) {
      byId('connectorState').value = section === 'ALL' ? '' : section.replace(' ', '_');
      renderConnectors();
    } else if (!isOverview && !isProvisioner) {
      renderContext(section);
    }
  }

  function openMetricDrilldown(widget, metric) {
    if (state.editing) return;
    if(!state.snapshot||!state.dashboard)return;
    writeText(byId('metricDialogTitle'),widget.label);
    const list = node('dl');
    const facts = [
      [copy('value'),formatMetric(metric)],[copy('available'),boolean(metric?.available)],
      [copy('unit'),metric?.unit||unknown()],[copy('source'),metric?.source||unknown()],
      [copy('freshness'),stateText(metric?.freshness)],[copy('observed_utc'),time(state.snapshot?.observed_at)],
      [copy('workspace'),state.workspace?.label||state.workspaceId]
    ];
    for (const [label, value] of facts) list.append(node('dt', '', label), node('dd', '', value));
    const note = node('p', 'panel-copy', metric?.detail ? String(metric.detail) : copy('metric_detail_note'));
    replaceChildren(byId('metricDialogContent'), [list, note]);
    byId('metricDialog').showModal();
  }

  function renderDashboard() {
    const grid = byId('dashboardGrid');
    grid.classList.toggle('editing', state.editing);
    const widgets = state.dashboard?.widgets || [];
    const cards = widgets.map((widget, index) => {
      const metric = state.snapshot?.metrics?.[widget.metric] || { available: false, source: 'NO_MEASURED_VALUE', freshness: 'UNKNOWN' };
      const card = node('article', `KPICard w-${widget.w || 4} h-${widget.h || 3}`);
      card.draggable = state.editing&&!dashboardWrite;
      card.dataset.widgetId = widget.id;
      card.tabIndex = state.editing ? -1 : 0;
      card.setAttribute('role', 'button');
      writeText(card,copy('open_metric',{label:widget.label}),'aria-label');
      card.append(node('h3', '', widget.label));
      card.append(node('strong', metric.available !== true ? 'metric-value metric-unavailable' : 'metric-value', formatMetric(metric)));
      const meta = node('span', 'metric-meta', metric.available !== true ? copy('metric_unavailable') : live(()=>`${metric.unit||String(unknown())} · ${stateText(metric.freshness)}`));
      card.append(meta, node('span', 'widget-source', metric.source || unknown()));
      const tools = node('div', 'widget-tools');
      const up = node('button', '', '↑'); up.type = 'button'; writeText(up,copy('move_forward'),'title');
      const down = node('button', '', '↓'); down.type = 'button'; writeText(down,copy('move_back'),'title');
      const size = node('button', '', widget.w >= 8 ? '−' : '+'); size.type = 'button'; writeText(size,copy('resize'),'title');
      const remove = node('button', '', '×'); remove.type = 'button'; writeText(remove,copy('remove_widget'),'title');
      up.addEventListener('click', () => {if(card.isConnected&&state.editing&&!dashboardWrite)moveWidget(index, -1);});
      down.addEventListener('click', () => {if(card.isConnected&&state.editing&&!dashboardWrite)moveWidget(index, 1);});
      size.addEventListener('click', () => {if(card.isConnected&&state.editing&&!dashboardWrite)resizeWidget(index);});
      remove.addEventListener('click', () => {if(card.isConnected&&state.editing&&!dashboardWrite)removeWidget(index);});
      tools.append(up, down, size, remove); card.append(tools);
      card.addEventListener('dragstart', () => { if(card.isConnected&&state.editing&&!dashboardWrite)state.draggedWidget = widget.id; });
      card.addEventListener('dragover', event => { if (state.editing) event.preventDefault(); });
      card.addEventListener('drop', event => { event.preventDefault(); if(card.isConnected&&state.editing&&!dashboardWrite)reorderWidget(state.draggedWidget, widget.id); });
      card.addEventListener('click', event => { if (card.isConnected&&!event.target.closest('.widget-tools')) openMetricDrilldown(widget, metric); });
      card.addEventListener('keydown', event => { if ((event.key === 'Enter' || event.key === ' ') && !state.editing&&card.isConnected) { event.preventDefault(); openMetricDrilldown(widget, metric); } });
      return card;
    });
    replaceChildren(grid, cards.length ? cards : [node('div', 'EmptyState NoDataState', copy('widgets_empty'))]);
  }

  function moveWidget(index, delta) {
    const next = index + delta;
    if (next < 0 || next >= state.dashboard.widgets.length) return;
    const widgets = state.dashboard.widgets;
    [widgets[index], widgets[next]] = [widgets[next], widgets[index]];
    renderDashboard();
  }

  function reorderWidget(fromId, toId) {
    if (!fromId || fromId === toId) return;
    const widgets = state.dashboard.widgets, from = widgets.findIndex(item => item.id === fromId), to = widgets.findIndex(item => item.id === toId);
    if (from < 0 || to < 0) return;
    const [item] = widgets.splice(from, 1); widgets.splice(to, 0, item); renderDashboard();
  }

  function resizeWidget(index) {
    const item = state.dashboard.widgets[index];
    item.w = item.w >= 8 ? 4 : item.w >= 6 ? 8 : 6;
    item.h = item.w >= 8 ? 5 : 3;
    renderDashboard();
  }

  function removeWidget(index) {
    state.dashboard.widgets.splice(index, 1);
    renderDashboard();
  }

  function recordDisplayFields(rows) {
    const preferred = ['name', 'title', 'display_name', 'entity_type', 'event_name', 'status', 'provider', 'source', 'connection_state', 'freshness', 'confidence', 'amount_cents', 'created_at', 'updated_at', 'occurred_at'];
    const forbidden = /secret|password|token|authorization|credential|api[_-]?key|client[_-]?secret|raw|payload/i;
    const keys = new Set();
    for (const row of rows.slice(0, 40)) {
      for (const key of Object.keys(row || {})) {
        if (keys.size >= 8 || forbidden.test(key) || key === 'tenant_id' || key === 'dealer_id') continue;
        const value = row[key];
        if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) keys.add(key);
      }
    }
    return [...keys].sort((a, b) => {
      const ai = preferred.indexOf(a), bi = preferred.indexOf(b);
      return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
    }).slice(0, 7);
  }

  function recordTimestamp(row) {
    for (const key of ['occurred_at', 'received_at', 'created_at', 'updated_at', 'date', 'timestamp']) {
      const parsed = Date.parse(row?.[key] || '');
      if (Number.isFinite(parsed)) return parsed;
    }
    return null;
  }

  function recordSourceIds(row) {
    return [row?.source_id, row?.provider, row?.source, row?.provenance?.source_id, row?.provenance?.provider].filter(Boolean).map(String);
  }

  function filteredWorkspaceRows() {
    const raw = Array.isArray(state.snapshot?.rows) ? state.snapshot.rows : [];
    const textQuery = state.recordQuery.toLowerCase(), from = byId('dateFrom').value, to = byId('dateTo').value;
    const source = byId('sourceFilter').value, status = byId('statusFilter').value;
    const fromTime = from ? Date.parse(`${from}T00:00:00.000Z`) : null, toTime = to ? Date.parse(`${to}T23:59:59.999Z`) : null;
    return raw.filter(row => {
      if (textQuery && !Object.entries(row || {}).some(([key, value]) => !/secret|password|token|credential|payload/i.test(key) && ['string', 'number', 'boolean'].includes(typeof value) && String(value).toLowerCase().includes(textQuery))) return false;
      if (source && !recordSourceIds(row).includes(source)) return false;
      if (status && ![row?.status, row?.connection_state, row?.freshness, row?.freshness_status].filter(Boolean).map(String).includes(status)) return false;
      if (fromTime !== null || toTime !== null) {
        const timestamp = recordTimestamp(row);
        if (timestamp === null || fromTime !== null && timestamp < fromTime || toTime !== null && timestamp > toTime) return false;
      }
      return true;
    });
  }

  function renderRecords() {
    const raw = Array.isArray(state.snapshot?.rows) ? state.snapshot.rows : [], filtered = filteredWorkspaceRows();
    const safeRows = filtered.slice(0, 250);
    const fields = recordDisplayFields(safeRows.length ? safeRows : raw);
    const header = node('tr');
    for (const field of fields) header.append(node('th','',['name','title','status','provider','amount_cents','currency','updated_at','created_at','occurred_at','event_name','entity_type','confidence'].includes(field)?copy('field.'+field):field==='source'?copy('source'):field==='freshness'?copy('freshness'):field==='connection_state'?copy('field.status'):field));
    replaceChildren(byId('recordHead'), fields.length ? [header] : []);
    const rows = safeRows.map(row => {
      const tr = node('tr');
      for (const field of fields) {
        let value = row[field];
        if(field.endsWith('_cents'))value=live(()=>i18n().currencyCents(row[field],row.currency));
        else if(field.endsWith('_at')||field==='date')value=time(value);
        else if(typeof value==='number')value=number(value);
        else if(typeof value==='boolean')value=boolean(value);
        else value=value===null||value===undefined||value===''?unknown():String(value).slice(0,300);
        tr.append(node('td','',value));
      }
      return tr;
    });
    replaceChildren(byId('recordRows'), rows);
    byId('recordEmpty').hidden = rows.length > 0;
    writeText(byId('recordCount'),Array.isArray(state.snapshot?.rows)?live(()=>copy('records_count',{shown:i18n().number(rows.length),total:i18n().number(raw.length)})):copy('records_unavailable'));
    writeText(byId('recordsTitle'),copy('records_title',{name:state.workspace?.short_label||state.workspaceId}));
    writeText(byId('recordEmpty'),Array.isArray(state.snapshot?.rows)?copy('records_empty'):copy('records_unavailable'));
  }

  function renderSources() {
    const sourceFilter = byId('sourceFilter').value, statusFilter = byId('statusFilter').value;
    const available = sourceRows().filter(source => {
      if (sourceFilter && source.source_id !== sourceFilter) return false;
      if (statusFilter && ![source.connection_status, source.freshness_status].includes(statusFilter)) return false;
      return true;
    }).slice(0, 24);
    const rows = available.map(source => {
      const row = node('article', 'source-row');
      row.append(node('strong', '', source.display_name || source.name || source.source_id));
      row.append(badge(source.connection_status || source.freshness_status, 'FreshnessBadge'));
      const categories = (source.categories || []).slice(0, 3).join(' · ') || copy('uncategorized');
      row.append(node('p','',live(()=>copy('source_summary',{categories:String(categories),count:String(count(source.records_available)),provenance:String(source.provenance_supported===true?copy('provenance_present'):source.provenance_supported===false?copy('provenance_absent'):unknown())}))));
      return row;
    });
    replaceChildren(byId('sourceMatrix'), rows.length ? rows : [node('div', 'EmptyState NoDataState', Array.isArray(state.snapshot?.sources)?copy('sources_empty'):copy('sources_unavailable'))]);
  }

  function fillSelect(select, values, current = '') {
    const first = node('option','',copy('all'));first.value='';
    replaceChildren(select, [first, ...[...new Set(values.filter(Boolean))].sort().map(value => {
      const option = node('option', '', stateText(value)); option.value = value; return option;
    })]);
    if ([...select.options].some(option => option.value === current)) select.value = current;
  }

  function populateWorkspaceFilters() {
    const rows = Array.isArray(state.snapshot?.rows) ? state.snapshot.rows : [], currentSource = byId('sourceFilter').value, currentStatus = byId('statusFilter').value;
    fillSelect(byId('sourceFilter'), [...state.sources.map(row => row.source_id), ...rows.flatMap(recordSourceIds)], currentSource);
    fillSelect(byId('statusFilter'), [...state.sources.flatMap(row => [row.connection_status, row.freshness_status]), ...rows.flatMap(row => [row.status, row.connection_state, row.freshness, row.freshness_status])], currentStatus);
  }

  function connectorFilters() {
    return {
      category: byId('connectorCategory').value,
      industry: byId('connectorIndustry').value,
      capability: byId('connectorCapability').value,
      auth: byId('connectorAuth').value,
      tenant: byId('connectorTenant').value,
      state: byId('connectorState').value
    };
  }

  function renderConnectors() {
    const filters = connectorFilters();
    const connectors = state.connectors.filter(connector => {
      if (filters.category && !(connector.category || []).includes(filters.category)) return false;
      if (filters.industry && !(connector.industries || []).includes(filters.industry)) return false;
      if (filters.capability && !(connector.capabilities || []).includes(filters.capability)) return false;
      if (filters.auth && connector.auth_type !== filters.auth) return false;
      if (filters.tenant && connector.tenant_scope !== filters.tenant) return false;
      if (filters.state && connector.connection_state !== filters.state) return false;
      return true;
    });
    writeText(byId('connectorCount'),live(()=>copy('connectors_count',{shown:i18n().number(connectors.length),total:i18n().number(state.connectors.length)})));
    const cards = connectors.map(connector => {
      const card = node('article', `ConnectorCard ${connector.connection_state === 'AWAITING_ACCESS' ? 'AwaitingAccessState' : ['DEGRADED', 'ERROR'].includes(connector.connection_state) ? 'DegradedState' : ''}`);
      const head = node('div', 'connector-card-head'), title = node('div');
      title.append(node('h3', '', connector.name), node('span', 'connector-provider', connector.provider));
      head.append(title, badge(connector.connection_state)); card.append(head);
      const categories = node('div', 'connector-categories');
      for (const category of (connector.category || []).slice(0, 4)) categories.append(node('span', '', category.replaceAll('_', ' ')));
      card.append(categories);
      const facts = node('div', 'connector-facts');
      for(const [label,value] of [[copy('configuration'),connectorState(connector.configuration_state)],[copy('authentication'),connectorState(connector.authentication_state)],[copy('probe'),connectorState(connector.probe_state)],[copy('last_probe'),time(connector.last_probe)],[copy('latency'),live(()=>typeof connector.latency==='number'&&Number.isFinite(connector.latency)&&connector.latency>=0?i18n().number(connector.latency)+' ms':String(unknown()))],[copy('sync'),connectorState(connector.sync_state)],[copy('freshness'),connectorState(connector.freshness)],[copy('records'),count(connector.records)]]){
        const fact=node('div');fact.append(node('span','',label),node('strong','',value));facts.append(fact);
      }
      card.append(facts);
      if (connector.requires_partner_approval && connector.connection_state !== 'CONNECTED') card.append(node('p', 'connector-warning', copy('external_approval')));
      if (connector.safe_error) card.append(node('p', 'connector-safe-error', copy('safe_error',{code:connector.safe_error})));
      const actions = node('div', 'connector-card-actions'), inspect = node('button', '', connector.setup_action==='INSPECT'?copy('inspect'):copy('setup'));
      inspect.type = 'button'; inspect.addEventListener('click', () => openConnector(connector.connector_id)); actions.append(inspect); card.append(actions);
      return card;
    });
    replaceChildren(byId('connectorGrid'), cards.length ? cards : [node('div', 'EmptyState NoDataState', copy('connectors_empty'))]);
  }

  function populateConnectorFilters() {
    const current = connectorFilters();
    fillSelect(byId('connectorCategory'), state.connectors.flatMap(row => row.category || []), current.category);
    fillSelect(byId('connectorIndustry'), state.connectors.flatMap(row => row.industries || []), current.industry);
    fillSelect(byId('connectorCapability'), state.connectors.flatMap(row => row.capabilities || []), current.capability);
    fillSelect(byId('connectorAuth'), state.connectors.map(row => row.auth_type), current.auth);
    fillSelect(byId('connectorTenant'), state.connectors.map(row => row.tenant_scope), current.tenant);
    fillSelect(byId('connectorState'), state.connectors.map(row => row.connection_state), current.state);
  }

  function sourceRegistryFilters() {
    return {
      query: byId('sourceRegistrySearch').value.trim().toLowerCase(),
      category: byId('sourceRegistryCategory').value,
      capability: byId('sourceRegistryCapability').value,
      type: byId('sourceRegistryType').value,
      status: byId('sourceRegistryStatus').value
    };
  }

  function populateSourceRegistryFilters() {
    const current = sourceRegistryFilters();
    fillSelect(byId('sourceRegistryCategory'), state.sources.flatMap(row => row.categories || []), current.category);
    fillSelect(byId('sourceRegistryCapability'), state.sources.flatMap(row => row.capabilities || []), current.capability);
    fillSelect(byId('sourceRegistryType'), state.sources.flatMap(row => row.source_type || []), current.type);
    fillSelect(byId('sourceRegistryStatus'), state.sources.map(row => row.connection_status), current.status);
  }

  function renderSourceRegistry() {
    const filters = sourceRegistryFilters();
    const sources = state.sources.filter(source => {
      if (filters.query && !`${source.source_id} ${source.provider_id} ${source.display_name} ${source.description}`.toLowerCase().includes(filters.query)) return false;
      if (filters.category && !(source.categories || []).includes(filters.category)) return false;
      if (filters.capability && !(source.capabilities || []).includes(filters.capability)) return false;
      if (filters.type && !(source.source_type || []).includes(filters.type)) return false;
      if (filters.status && source.connection_status !== filters.status) return false;
      return true;
    });
    writeText(byId('sourceRegistryCount'),live(()=>copy('sources_count',{shown:i18n().number(sources.length),total:i18n().number(state.sources.length)})));
    const cards = sources.map(source => {
      const card = node('article', 'SourceRegistryCard'), header = node('header'), title = node('div');
      title.append(node('h3', '', source.display_name), node('span', '', `${source.source_id} · ${source.provider_id}`));
      header.append(title, badge(source.connection_status));
      const facts = node('div', 'source-registry-facts');
      facts.append(node('span', '', live(()=>copy('probe_value',{value:String(stateText(source.probe_status))}))), node('span', '', live(()=>copy('sync_value',{value:String(stateText(source.sync_status))}))), node('span', '', live(()=>copy('freshness_value',{value:String(stateText(source.freshness_status))}))), node('span', '', live(()=>copy('records_total',{count:String(count(source.records_available))}))));
      const categories = node('div', 'connector-categories');
      for (const category of (source.categories || []).slice(0, 4)) categories.append(node('span', '', category.replaceAll('_', ' ')));
      card.append(header, node('p', '', source.description), categories, facts, node('p', '', source.provenance_supported===true?copy('provenance_present'):source.provenance_supported===false?copy('provenance_absent'):unknown()));
      return card;
    });
    replaceChildren(byId('sourceRegistryGrid'), cards.length ? cards : [node('div', 'EmptyState NoDataState', copy('sources_filtered_empty'))]);
  }

  function detailFact(label, value) {
    const box = node('div'); box.append(node('span', '', label), node('strong', '', value ?? '—')); return box;
  }

  function oauthPath(connector) {
    const id = connector.connector_id;
    if (['meta', 'facebook', 'instagram', 'facebook_pages'].includes(id)) return `/api/connect/meta?return_to=${encodeURIComponent('/connectors')}`;
    if (id === 'google' || ['google_ads', 'ga4', 'search_console', 'google_calendar'].includes(id)) return `/api/google/connect?return_to=${encodeURIComponent('/connectors')}`;
    if (['linkedin', 'tiktok'].includes(id)) return `/api/connect/${id}?return_to=${encodeURIComponent('/connectors')}`;
    if (id === 'wix') return `/api/connect/wix?return_to=${encodeURIComponent('/connectors')}`;
    return `/api/connector-runtime/oauth/${encodeURIComponent(id)}/start?return_to=${encodeURIComponent('/connectors')}`;
  }

  function connectorState(value){
    const keys={NOT_RUN:'not_run',AUTHENTICATED_PUBLIC:'public_access',LIVE_REFERENCE:'live_reference',AVAILABLE:'available',RECORDS_AVAILABLE:'retained_records'};
    if(value==='NOT_VERIFIED')return i18n().message('integrations.unproven');if(value==='NOT_CONFIGURED')return i18n().message('integrations.unconfigured');
    if(value==='PASS'||value==='FAIL')return i18n().message(value==='PASS'?'integrations.pass':'integrations.error');
    return keys[value]?copy(keys[value]):stateText(value);
  }

  async function openConnector(connectorId) {
    if(connectorSession?.busy)return toast(copy('connector_busy'),true);
    const dialog=byId('connectorDialog'),root=byId('connectorDetail'),ticket=++connectorView;
    const current=()=>ticket===connectorView&&dialog.open;
    connectorSession=null;dialog.onclose=()=>{if(dialog.open)return;connectorView++;connectorSession=null;replaceChildren(root);writeText(byId('connectorDialogTitle'),unknown());};
    replaceChildren(root,[node('p','panel-copy',copy('connector_loading'))]);writeText(byId('connectorDialogTitle'),copy('connector_loading'));if(!dialog.open)dialog.showModal();
    try {
      const [{ connector }, config] = await Promise.all([
        request(`/api/connector-registry/${encodeURIComponent(connectorId)}`),
        request(`/api/connector-runtime/config/${encodeURIComponent(connectorId)}`).catch(error => error.status === 404 ? null : Promise.reject(error))
      ]);
      if(!current())return;if(!connector||connector.connector_id!==connectorId)throw Error('connector_observation_unconfirmed');
      writeText(byId('connectorDialogTitle'),connector.name);
      const summary = node('div', 'connector-detail-summary');
      summary.append(
        detailFact(copy('lifecycle'), connectorState(connector.connection_state)), detailFact(copy('configuration'), connectorState(connector.configuration_state)),
        detailFact(copy('authentication'), connectorState(connector.authentication_state)), detailFact(copy('probe'), connectorState(connector.probe_state)),
        detailFact(copy('sync'), connectorState(connector.sync_state)), detailFact(copy('records'),count(connector.records)),
        detailFact(copy('last_probe'),connector.last_probe?time(connector.last_probe):connector.probe_state==='NOT_RUN'?copy('not_run'):unknown()),
        detailFact(copy('latency'),typeof connector.latency==='number'&&Number.isFinite(connector.latency)&&connector.latency>=0?live(()=>i18n().number(connector.latency)+' ms'):unknown()), detailFact(copy('freshness'),connectorState(connector.freshness))
      );
      const labels = ['OVERVIEW', 'CAPABILITIES', 'SETUP', 'AUTHENTICATION', 'DATA', 'SYNC', 'EVENTS', 'ERRORS', 'AUDIT'];
      const initialTab = connector.setup_action === 'INSPECT' ? 'OVERVIEW' : 'SETUP', tabs = node('div', 'connector-tabs');
      tabs.setAttribute('role', 'tablist');
      const panels = new Map();
      const panel = (label, children) => {
        const element = node('section', 'connector-tab-panel');
        element.id = `connector-panel-${label.toLowerCase()}`; element.setAttribute('role', 'tabpanel');element.setAttribute('aria-labelledby','connector-tab-'+label.toLowerCase()); element.hidden = label !== initialTab;
        replaceChildren(element, children); panels.set(label, element); return element;
      };

      const overview = panel('OVERVIEW', [
        node('p','panel-copy',copy('connector_overview')),
        detailFact(copy('field.provider'),connector.provider),detailFact(copy('contract'),connector.documentation_reference)
      ]);
      const capabilityList = node('div', 'capability-list');
      for (const capability of connector.capabilities || []) capabilityList.append(node('span', '', capability));
      const capabilities = panel('CAPABILITIES', [capabilityList, node('p', 'panel-copy', live(()=>copy('connector_industries',{industries:(connector.industries||[]).join(', ')||String(unknown()),scope:connector.tenant_scope||String(unknown())})))]);

      const setupChildren = [];
      setupChildren.push(node('p', 'connector-warning', connector.requires_partner_approval===true && connector.connection_state !== 'CONNECTED' ? copy('connector_partner'):copy('connector_secrets')));
      const variableStatuses = connector.credential_contract?.environment_variable_status || (connector.credential_contract?.environment_variables || []).map(name => ({ name, present: false, runtime_visible: false }));
      if (variableStatuses.length) {
        setupChildren.push(node('p', 'panel-copy', copy('connector_variables')));
        const list = node('ul', 'runtime-variable-list');
        for (const variable of variableStatuses) {
          const item = node('li'), status = node('strong', variable.runtime_visible===true?'present':'absent',variable.runtime_visible===true?copy('connector_visible'):variable.runtime_visible===false?copy('connector_absent'):unknown());
          item.append(node('span', '', variable.name), status); list.append(item);
        }
        setupChildren.push(list);
      }
      const form = node('form', 'connector-setup-form'); form.dataset.connectorId = connector.connector_id;
      const configuredFields = connector.credential_contract?.accepts_tenant_encrypted_configuration===true ? (connector.credential_contract?.fields || config?.credential_fields || []) : [];
      const fieldKeys = new Set();
      for (const field of configuredFields) {
        if (!field?.key || fieldKeys.has(field.key)) continue;
        fieldKeys.add(field.key);
        const label = node('label', '', field.label || field.key), input = node('input');
        input.name = field.key; input.type = field.secret === false ? 'text' : 'password'; input.autocomplete = 'new-password'; writeText(input,copy(config?.configured===true?'connector_saved_placeholder':'connector_enter_placeholder'),'placeholder');
        label.append(input); form.append(label);
      }
      if (!form.children.length) form.append(node('p', 'panel-copy', String(connector.auth_type||'').includes('PUBLIC')?copy('connector_public'):copy('connector_no_fields')));
      const session={id:connectorId,form,current,busy:false,revision:config?.ok===true&&Number.isSafeInteger(config.revision)&&config.revision>=0?config.revision:null,pending:null,conflict:false};connectorForms.set(form,session);connectorSession=session;
      setupChildren.push(form);
      const canSync=connector.configuration_state==='CONFIGURED'&&connector.probe_state==='PASS'&&['AUTHENTICATED','AUTHENTICATED_PUBLIC'].includes(connector.authentication_state);
      const actions = node('div', 'connector-actions');
      if (form.querySelector('input')) { const save = node('button', 'primary-button', copy('connector_save')); save.type = 'submit'; actions.append(save); form.addEventListener('submit', saveConnector); }
      if (connector.callback_contract?.required===true) { const authorize = node('a', 'primary-button',copy('connector_authorize')); authorize.href = oauthPath(connector);authorize.addEventListener('click',event=>{if(!current()||session.busy)event.preventDefault();}); actions.append(authorize); }
      const test = node('button', 'secondary-button',copy('connector_test')); test.type = 'button'; test.addEventListener('click', () => current()&&test.isConnected&&!session.busy?testConnector(connector.connector_id):undefined); actions.append(test);
      if (canSync) { const sync = node('button', 'secondary-button',copy('connector_sync')); sync.type='button';session.syncControl=sync;sync.addEventListener('click', () => current()&&sync.isConnected&&!session.busy?syncConnector(connector.connector_id):undefined); actions.append(sync); }
      form.append(actions);
      const setup = panel('SETUP', setupChildren);
      const authentication = panel('AUTHENTICATION', [
        detailFact(copy('auth_type'),connector.auth_type),detailFact(copy('authentication'),connectorState(connector.authentication_state)),
        detailFact(copy('callback'),connector.callback_contract?.required===true?connector.callback_contract.route:copy('not_applicable')),
        node('p','panel-copy',live(()=>copy('connector_scopes',{scopes:(connector.required_scopes||[]).join(', ')||String(copy('connector_no_scopes'))})))
      ]);
      const data=panel('DATA',[detailFact(copy('records'),count(connector.records)),detailFact(copy('freshness'),connectorState(connector.freshness)),detailFact(copy('scope'),connector.tenant_scope),node('p','panel-copy',copy('connector_records_note'))]);
      const syncPanel=panel('SYNC',[detailFact(copy('sync'),connectorState(connector.sync_state)),detailFact(copy('last_sync'),connector.last_sync?time(connector.last_sync):connector.sync_state==='NOT_RUN'?copy('not_run'):unknown()),node('p','panel-copy',copy(canSync?'connector_sync_available':'connector_sync_disabled'))]);
      const eventsPanel=panel('EVENTS',[node('div','EmptyState NoDataState',copy('connector_no_events'))]);
      const errors=panel('ERRORS',[connector.safe_error?node('p','connector-safe-error',connector.safe_error):node('div','EmptyState NoDataState',copy('connector_no_errors'))]);
      const audit=panel('AUDIT',[detailFact(copy('contract'),connector.documentation_reference),node('p','panel-copy',copy('connector_audit_note'))]);
      const activate=button=>{for(const candidate of tabs.querySelectorAll('button')){const active=candidate===button;candidate.classList.toggle('active',active);candidate.setAttribute('aria-selected',String(active));candidate.tabIndex=active?0:-1;}for(const candidate of panels.values())candidate.hidden=candidate.id!==button.getAttribute('aria-controls');};
      for(const label of labels){
        const button=node('button',label===initialTab?'active':'',copy(label.toLowerCase()));button.type='button';button.id='connector-tab-'+label.toLowerCase();button.setAttribute('role','tab');button.setAttribute('aria-selected',String(label===initialTab));button.setAttribute('aria-controls',panels.get(label).id);button.tabIndex=label===initialTab?0:-1;
        button.addEventListener('click',()=>activate(button));button.addEventListener('keydown',event=>{const options=[...tabs.querySelectorAll('button')],index=options.indexOf(button),target=event.key==='Home'?0:event.key==='End'?options.length-1:event.key==='ArrowRight'?(index+1)%options.length:event.key==='ArrowLeft'?(index+options.length-1)%options.length:null;if(target!==null){event.preventDefault();activate(options[target]);options[target].focus();}});tabs.append(button);
      }
      replaceChildren(root, [summary, tabs, overview, capabilities, setup, authentication, data, syncPanel, eventsPanel, errors, audit]);
    } catch (error) {if(!current())return;connectorSession=null;replaceChildren(root,[node('p','connector-safe-error',friendlyError(error))]);writeText(byId('connectorDialogTitle'),unknown());toast(friendlyError(error),true);}
  }

  async function saveConnector(event) {
    event.preventDefault();const form=event.currentTarget,session=connectorForms.get(form);if(!session||!session.current()||!form.isConnected||session.busy||session.conflict)return;
    if(!session.pending){
      if(session.revision===null)return toast(copy('connector_save_unconfirmed'),true);
      const credentials=Object.create(null);for(const input of form.querySelectorAll('input'))if(input.value)credentials[input.name]=input.value;
      if(!Object.keys(credentials).length)return toast(copy('connector_no_values'),true);
      session.pending=Object.freeze({body:JSON.stringify({credentials,expected_revision:session.revision}),key:crypto.randomUUID()});
    }
    const pending=session.pending,controls=[...form.querySelectorAll('input,button')];session.busy=true;controls.forEach(control=>control.disabled=true);
    try{
      const result=await request(`/api/connector-runtime/config/${encodeURIComponent(session.id)}`,{method:'PUT',body:pending.body,headers:{'idempotency-key':pending.key}});
      if(result?.ok!==true||result.id!==session.id||result.request_id!==pending.key||!Number.isSafeInteger(result.revision)||result.revision!==session.revision+1)throw Error('connector_save_unconfirmed');
      session.pending=null;session.revision=result.revision;
      if(!session.current()||!form.isConnected)return;for(const input of form.querySelectorAll('input'))input.value='';toast(copy('connector_saved'));
      try{await reloadRegistries();}catch(error){if(session.current()&&!error.stale)toast(copy('connector_saved_refresh_failed'),true);}
    }catch(error){
      if([400,404,409,412,428].includes(error.status)){session.pending=null;session.conflict=true;}
      if(session.current()&&!error.stale)toast(session.conflict?copy('connector_conflict'):copy('connector_save_unconfirmed'),true);
    }finally{
      session.busy=false;for(const control of controls){control.disabled=session.conflict||Boolean(session.pending&&control.type!=='submit');if(control.type==='submit')writeText(control,copy(session.pending?'connector_retry':'connector_save'));}
    }
  }

  async function testConnector(connectorId) {
    const key='test:'+connectorId;if(connectorActions.has(key))return;connectorActions.add(key);
    const session=connectorSession?.id===connectorId?connectorSession:null,ticket=connectorView,revision=session?.revision??null,current=()=>session?session.current()&&session.revision===revision:ticket===connectorView;
    try{
      const result=await request(`/api/connector-runtime/test/${encodeURIComponent(connectorId)}`,{method:'POST',body:'{}'});if(!current())return;
      const observedRevision=result?.connector?.configuration_revision;
      const connected=result?.ok===true&&result.connector?.id===connectorId&&result.connector.connected===true&&Number.isSafeInteger(observedRevision)&&observedRevision>=0&&(revision===null||observedRevision===revision);
      const smtp=result?.ok===true&&connectorId==='email'&&result.connector?.id==='email'&&result.connector.authenticated===true&&result.connector.authentication_verified===true&&result.connector.tls_verified===true&&result.external_send===false&&result.connector.connected===false&&result.connector.mailbox_access_verified===false&&result.connector.send_verified===false;
      toast(copy(connected?'connector_probe_pass':smtp?'connector_smtp_verified':'connector_probe_unconfirmed'),!connected&&!smtp);await reloadRegistries();
    }catch(error){if(current()&&!error.stale)toast(friendlyError(error),true);}finally{connectorActions.delete(key);}
  }

  async function syncConnector(connectorId) {
    const session=connectorSession?.id===connectorId?connectorSession:null,ticket=connectorView,current=()=>session?session.current():ticket===connectorView;
    const key='sync:'+connectorId;if(connectorActions.has(key)||session?.syncConflict)return;connectorActions.add(key);
    let pending=connectorSyncRequests.get(connectorId);if(!pending){pending=Object.freeze({key:crypto.randomUUID(),expectedRevision:session?.revision??null,body:JSON.stringify(session?.revision===null||!session?{}:{expected_revision:session.revision})});connectorSyncRequests.set(connectorId,pending);}
    if(session?.syncControl)session.syncControl.disabled=true;
    try{
      const result=await request(`/api/connector-runtime/sync/${encodeURIComponent(connectorId)}`,{method:'POST',body:pending.body,headers:{'idempotency-key':pending.key}});if(!current())return;
      const counts=['ingested','received','duplicate_items','created','updated','unchanged'];
      const verified=result?.ok===true&&result.id===connectorId&&result.request_id===pending.key&&typeof result.proof_id==='string'&&/^[a-f0-9]{64}$/.test(result.proof_id)&&Number.isSafeInteger(result.configuration_revision)&&result.configuration_revision>=0&&(pending.expectedRevision===null||result.configuration_revision===pending.expectedRevision)&&counts.every(name=>Number.isSafeInteger(result[name])&&result[name]>=0)&&result.received-result.ingested===result.duplicate_items&&result.created+result.updated+result.unchanged===result.ingested&&result.target==='data'&&result.source_class==='EXTERNAL_PROVIDER_OBSERVATIONS'&&result.source_complete===false&&result.customer_objects_changed===false;
      toast(verified?live(()=>copy('connector_sync_count',{count:i18n().number(result.ingested)})):copy('connector_sync_unconfirmed'),!verified);
      if(verified){connectorSyncRequests.delete(connectorId);try{await loadWorkspaceData();}catch(error){if(current()&&!error.stale)toast(copy('connector_sync_refresh_failed'),true);}}
    }catch(error){
      if([400,404,409,412,413,422,428].includes(error.status)){connectorSyncRequests.delete(connectorId);if(session&&[409,412,428].includes(error.status))session.syncConflict=true;}
      if(current()&&!error.stale)toast(error.status?friendlyError(error):copy('connector_sync_unconfirmed'),true);
    }finally{
      connectorActions.delete(key);if(session?.syncControl){session.syncControl.disabled=Boolean(session.syncConflict);writeText(session.syncControl,copy(connectorSyncRequests.has(connectorId)?'connector_retry':'connector_sync'));}
    }
  }

  function renderContext(section) {
    const description = describedSections.has(section)?copy('section_description.'+section.toLowerCase().replaceAll(' ','_')):copy('section_description_fallback',{workspace:state.workspace?.label||'Foundly'});
    const workspaceLabel=state.workspace?.short_label||'WORKSPACE';
    writeText(byId('contextEyebrow'),live(()=>`${workspaceLabel} · ${sectionLabel(section)}`));
    writeText(byId('contextTitle'),sectionLabel(section));
    writeText(byId('contextDescription'),description);
    const content = byId('contextContent'), items = [];
    if(state.workspaceId==='settings'&&['USERS','ROLES'].includes(section)){renderIdentityUsers(section,content);return;}
    if(state.workspaceId==='settings'&&section==='CAPABILITIES'){renderComposer(content);return;}
    if(state.workspaceId==='marketing'&&['MEASUREMENT','ATTRIBUTION'].includes(section)&&window.FoundlyMarketingMetrics){replaceChildren(content,[window.FoundlyMarketingTransport.create({document,request,build:call=>window.FoundlyMarketingMetrics.create({document,request:call,isActive:()=>content.isConnected&&state.workspaceId==='marketing'&&state.activeSection===section}),isActive:()=>content.isConnected&&state.workspaceId==='marketing'&&state.activeSection===section})]);return;}
    if(state.workspaceId==='sales'&&['SEQUENCES','SEQUENCE_RUNS'].includes(section)){const conversationId=state.conversationId||crypto.randomUUID(),active=()=>state.activeSection===section&&state.workspaceId==='sales';let view;view=window.FoundlySalesSequences.create({document,request,isActive:active,zeroRequest:async(action,turn)=>{if(!active()||!view?.isConnected)throw Error('De Sales-weergave is niet meer actief.');const response=await request('/api/zero/turn',{method:'POST',body:JSON.stringify({message:'Gekozen Sales-actie',conversation_id:conversationId,turn_id:turn,preferred_module:'sales',client_context:{sales_action:action}})});if(!active()||!view.isConnected)throw Error('De Sales-weergave is niet meer actief.');state.conversationId=conversationId;byId('zeroOutput').textContent=response.display_text||response.answer;if(!response.sales_data)throw Error('Het actuele Sales-resultaat ontbreekt.');return response.sales_data;}});replaceChildren(content,[view]);return;}
    if(state.workspaceId==='sales'&&section==='PIPELINES'){replaceChildren(content,[window.FoundlySalesPipeline.create({document,request,isActive:()=>state.activeSection===section&&state.workspaceId==='sales'})]);return;}
    if(state.workspaceId==='sales'&&section==='FORECAST_HIERARCHIES'){const view=window.FoundlySalesHierarchy.create({document,request,isActive:()=>state.activeSection===section&&state.workspaceId==='sales',renderResult:(host,result,filters)=>{appendForecastResult(host,result);appendForecastSnapshotForm(host,result,filters,null,{id:result.hierarchy.id,node_id:result.hierarchy.node_id});appendForecastScenario(host,result,filters,{id:result.hierarchy.id,node_id:result.hierarchy.node_id});}});replaceChildren(content,[view]);return;}
    if(state.workspaceId==='sales'&&section==='FORECAST'){renderSalesForecast(content);return;}
    if(state.workspaceId==='calendar'&&section==='EVENT_PREPARATION'){const conversationId=state.conversationId||crypto.randomUUID(),active=()=>state.activeSection===section&&state.workspaceId==='calendar';let view;view=window.FoundlyCalendarEventPreparation.create({document,request,isActive:active,zeroRequest:async(action,turn)=>{if(!active()||!view?.isConnected)throw Error('De Calendar-weergave is niet meer actief.');const response=await request('/api/zero/turn',{method:'POST',body:JSON.stringify({message:'Gekozen Calendar-actie',conversation_id:conversationId,turn_id:turn,preferred_module:'calendar',client_context:{calendar_action:action}})});if(!active()||!view.isConnected)throw Error('De Calendar-weergave is niet meer actief.');state.conversationId=conversationId;byId('zeroOutput').textContent=response.display_text||response.answer;if(!response.calendar_data)throw Error('Het actuele Calendar-resultaat ontbreekt.');return response.calendar_data;}});replaceChildren(content,[view]);return;}
    if(state.workspaceId==='calendar'&&section==='SCHEDULING'){renderScheduling(content);return;}
    if(state.workspaceId==='automation'){renderAutomationSection(section,content);return;}
    if ((state.workspace?.domain_entities || []).includes(section.toLowerCase())) {
      renderDomainSection(section.toLowerCase(), content);
      return;
    }
    renderEvidenceSection(section,content);
  }

  async function renderEvidenceSection(section,content){
    const workspace=state.workspaceId,epoch=accessGeneration,ticket={};evidenceViews.set(content,ticket);
    const current=()=>content.isConnected&&evidenceViews.get(content)===ticket&&state.workspaceId===workspace&&state.activeSection===section&&accessGeneration===epoch;
    replaceChildren(content,[node('p','LoadingState',copy('section_loading'))]);
    try{
      const result=await request(`/api/workspaces/${workspace}/sections/${encodeURIComponent(section)}`);if(!current())return;
      const statuses=['AVAILABLE','NOT_IMPLEMENTED','MODULE_UNAVAILABLE','USE_WORKSPACE_EXPORT','OPEN_MODULE'];
      if(result?.ok!==true||result.workspace_id!==workspace||result.section!==section||!statuses.includes(result.status)||!Array.isArray(result.items)||result.status!=='AVAILABLE'&&result.items.length>0||result.items.some(row=>!row||typeof row!=='object'||Array.isArray(row))){replaceChildren(content,[node('p','ErrorState',copy('section_unavailable'))]);return;}
      const items=[];
      if(result.status==='NOT_IMPLEMENTED'){items.push(node('p','EmptyState',copy('section_unimplemented')));if(typeof result.reason==='string'&&result.reason!=='Dit onderdeel heeft nog geen volledig aangesloten gegevenscontract.')items.push(node('p','',result.reason));}
      else if(result.status==='MODULE_UNAVAILABLE')items.push(node('p','EmptyState',copy('section_module_unavailable')));
      else if(result.status==='USE_WORKSPACE_EXPORT')items.push(node('p','',copy('section_export_hint')));
      else if(result.status==='OPEN_MODULE'){
        const target=state.navigation.find(item=>item.route===result.route);if(target){const link=node('a','primary-button',copy('section_open',{module:target.label}));link.href=target.route;items.push(link);}else items.push(node('p','EmptyState',copy('section_module_unavailable')));
      }
      const ownedFields=new Set(['name','title','status','provider','amount_cents','currency','updated_at','created_at','occurred_at','event_name','entity_type','confidence','record_type','schema_version','internal_id','observed_at','ingested_at','expires_at','last_verified_at','source_id','provenance','superseded_by','supersedes']);
      const dates=new Set(['updated_at','created_at','occurred_at','observed_at','ingested_at','expires_at','last_verified_at']),counts=new Set(['records_available','record_count']);
      for(const row of result.items){
        const card=node('article','context-item'),heading=row.title||row.name||row.event_name||row.subject||row.source_name||row.connector_id||row.internal_id||row.id||section;
        card.append(node('h3','',typeof heading==='string'?heading:section));const list=node('dl');
        const fields=Object.entries(row).filter(([,value])=>value!==undefined);
        for(const [key,value] of fields.slice(0,18)){
          const label=node('dt','',ownedFields.has(key)?copy('field.'+key):counts.has(key)?copy('records'):key==='source'?copy('source'):key);
          let observed=value===null?unknown():typeof value==='object'?JSON.stringify(value):String(value);
          if(dates.has(key))observed=time(value);
          else if(counts.has(key))observed=count(value);
          else if(key==='amount_cents')observed=live(()=>i18n().currencyCents(value,row.currency));
          else if(key==='confidence')observed=typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1?number(value):unknown();
          list.append(label,node('dd','',observed));
        }
        card.append(list);if(fields.length>18)card.append(node('p','',live(()=>copy('section_fields_shown',{shown:i18n().number(18),total:i18n().number(fields.length)}))));items.push(card);
      }
      if(!items.length)items.push(node('p','EmptyState',copy('section_empty')));
      replaceChildren(content,items);
    }catch(error){if(current()&&!error.stale)replaceChildren(content,[node('p','ErrorState',friendlyError(error))]);}
  }

  async function renderComposer(content) {
    const workspace=state.workspaceId,epoch=accessGeneration,ticket={};composerViews.set(content,ticket);
    const active=()=>workspace==='settings'&&state.workspaceId===workspace&&state.activeSection==='CAPABILITIES'&&accessGeneration===epoch&&content.isConnected&&composerViews.get(content)===ticket;
    if(!active())return;
    replaceChildren(content,[node('p','LoadingState',copy('composer_loading'))]);
    const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value),strings=value=>Array.isArray(value)&&value.every(v=>typeof v==='string')&&new Set(value).size===value.length;
    const equal=(a,b)=>strings(a)&&strings(b)&&a.length===b.length&&a.every(value=>b.includes(value));
    const revision=value=>Number.isSafeInteger(value)&&value>=0;
    const invalid=()=>Object.assign(Error('composition_observation_invalid'),{code:'composition_observation_invalid'});
    const failure=error=>error.code==='composition_observation_invalid'?copy('composer_invalid'):friendlyError(error);
    const ownedModules=new Set(['procurement','sales','crm','marketing','finance','analysis','calendar','communication','automation']);
    const moduleLabel=id=>ownedModules.has(id)?copy('module.'+id):id;
    const extraCapabilities=new Set(['sourcing','pipeline','contacts','companies','relationships','ledger','invoices','payments','reports','kpis','funnel']);
    const capabilityLabel=value=>{const suffix=value.split(':')[1];return extraCapabilities.has(suffix)?copy('composer_capability.'+suffix):ownedSections.has(suffix?.toUpperCase())?sectionLabel(suffix.toUpperCase()):value;};
    try {
      const [catalog,current]=await Promise.all([request('/api/composition/catalog'),request('/api/composition')]);if(!active())return;
      if(catalog?.ok!==true||!record(catalog.industries)||!record(catalog.bundles)||!Array.isArray(catalog.modules)||!catalog.modules.length||catalog.modules.length>50||catalog.modules.some(m=>!record(m)||typeof m.module_id!=='string'||typeof m.display_name!=='string'||!strings(m.provided_capabilities)||m.provided_capabilities.some(c=>!c.startsWith(m.module_id+':')))||new Set(catalog.modules.map(m=>m.module_id)).size!==catalog.modules.length)throw invalid();
      const moduleIds=catalog.modules.map(m=>m.module_id),resolution=current?.resolution;
      if(current?.ok!==true||!record(resolution)||resolution.schema_version!=='foundly-capability-resolution/1.0.0'||!revision(resolution.revision)||typeof resolution.tenant_id!=='string'||typeof resolution.dealer_id!=='string'||!strings(resolution.entitlements)||!strings(resolution.enabled_modules)||resolution.entitlements.some(id=>!moduleIds.includes(id))||resolution.enabled_modules.some(id=>!resolution.entitlements.includes(id))||!Object.hasOwn(catalog.industries,resolution.industry_id)||catalog.industries[resolution.industry_id]?.production!==true||Object.values(catalog.bundles).some(ids=>!strings(ids)||ids.some(id=>!moduleIds.includes(id)))||current.profile!==null&&(!record(current.profile)||!record(current.profile.capability_flags)||current.profile.revision!==resolution.revision||current.profile.tenant_id!==resolution.tenant_id||current.profile.dealer_id!==resolution.dealer_id))throw invalid();
      const capabilities=catalog.modules.flatMap(module=>module.provided_capabilities);
      if(current.profile===null?resolution.revision!==0||resolution.legacy_compatibility!==true:resolution.legacy_compatibility!==false||resolution.revision<1||current.profile.industry_id!==resolution.industry_id||!equal(current.profile.entitlements,resolution.entitlements)||!equal(current.profile.enabled_modules,resolution.enabled_modules)||Object.entries(current.profile.capability_flags).some(([key,value])=>!capabilities.includes(key)||typeof value!=='boolean'))throw invalid();
      const form=node('form','domain-record-form'),industryLabel=node('label','',copy('composer_industry')),industry=node('select'),bundleLabel=node('label','',copy('composer_bundle')),bundle=node('select'),groups=node('div','composition-modules');
      const present=()=>active()&&form.isConnected;
      for(const [id,pack]of Object.entries(catalog.industries))if(pack?.production===true){if(pack.industry_id!==id)throw invalid();const option=node('option','',['GENERAL','AUTOMOTIVE'].includes(id)?copy('composer_industry_'+id.toLowerCase()):id);option.value=id;industry.append(option);}
      industry.value=resolution.industry_id;industryLabel.append(industry);
      const custom=node('option','',copy('composer_custom'));custom.value='';bundle.append(custom);
      for(const name of Object.keys(catalog.bundles)){const option=node('option','',ownedModules.has(name.toLowerCase())?moduleLabel(name.toLowerCase()):['COMPLETE','OPERATIONS'].includes(name)?copy('composer_bundle_'+name.toLowerCase()):name);option.value=name;bundle.append(option);}bundleLabel.append(bundle);
      const choices=[];
      for(const module of catalog.modules){
        const group=node('fieldset'),legend=node('legend','',ownedModules.has(module.module_id)?moduleLabel(module.module_id):module.display_name),entitled=node('input'),enabled=node('input');
        entitled.type=enabled.type='checkbox';entitled.checked=resolution.entitlements.includes(module.module_id);enabled.checked=resolution.enabled_modules.includes(module.module_id);
        const accessLabel=node('label'),activeLabel=node('label');accessLabel.append(entitled,node('span','',copy('composer_entitlement')));activeLabel.append(enabled,node('span','',copy('composer_enabled')));group.append(legend,accessLabel,activeLabel);
        const flags=[];for(const capability of module.provided_capabilities){const label=node('label'),input=node('input');input.type='checkbox';input.checked=current.profile?.capability_flags?.[capability]!==false;label.append(input,node('span','',capabilityLabel(capability)));group.append(label);flags.push({capability,input});}
        entitled.addEventListener('change',()=>{if(!entitled.checked)enabled.checked=false;});enabled.addEventListener('change',()=>{if(enabled.checked)entitled.checked=true;});
        groups.append(group);choices.push({id:module.module_id,entitled,enabled,flags});
      }
      bundle.addEventListener('change',()=>{if(!bundle.value||!Object.hasOwn(catalog.bundles,bundle.value))return;for(const choice of choices)choice.entitled.checked=choice.enabled.checked=catalog.bundles[bundle.value].includes(choice.id);});
      const notice=node('p','',copy('composer_retained')),preview=node('button','primary-button',copy('composer_preview')),apply=node('button','',copy('composer_apply')),refresh=node('button','',copy('composer_refresh')),output=node('output','workspace-notice');
      output.setAttribute('aria-live','polite');preview.type='submit';apply.type=refresh.type='button';apply.hidden=true;
      form.append(industryLabel,bundleLabel,groups,notice,preview,apply,refresh,output);
      const canManage=current.can_manage===true;let prepared=null,draftVersion=0,previewing=false,writing=false,uncertain=false,confirmed=false;
      const payload=()=>({industry_id:industry.value,entitlements:choices.filter(c=>c.entitled.checked).map(c=>c.id),enabled_modules:choices.filter(c=>c.enabled.checked).map(c=>c.id),capability_flags:Object.fromEntries(choices.flatMap(c=>c.flags.map(f=>[f.capability,f.input.checked]))),expected_revision:resolution.revision});
      const lock=()=>{for(const input of form.querySelectorAll('input,select'))input.disabled=!canManage||writing||uncertain||confirmed;preview.disabled=!canManage||previewing||writing||uncertain||confirmed;apply.disabled=!canManage||writing;refresh.disabled=writing;};
      if(!canManage)writeText(notice,copy('composer_manage_only'));
      function changed(){if(writing||uncertain||confirmed)return;draftVersion++;prepared=null;apply.hidden=true;writeText(output,copy('composer_changed'));}
      form.addEventListener('change',changed);
      const profileMatches=(profile,input)=>record(profile)&&profile.tenant_id===resolution.tenant_id&&profile.dealer_id===resolution.dealer_id&&profile.industry_id===input.industry_id&&equal(profile.entitlements,input.entitlements)&&equal(profile.enabled_modules,input.enabled_modules)&&record(profile.capability_flags)&&equal(Object.keys(profile.capability_flags),Object.keys(input.capability_flags))&&Object.keys(input.capability_flags).every(key=>profile.capability_flags[key]===input.capability_flags[key])&&revision(profile.revision)&&/^[a-f0-9]{64}$/.test(profile.signature||'');
      function validPreview(result,input){
        if(result?.ok!==true||result.persistent_changes!==false||result.data_deleted!==false||result.expected_revision!==resolution.revision||!profileMatches(result.profile,input)||![resolution.revision,resolution.revision+1].includes(result.profile.revision))return false;
        const next=result.resolution,diff=result.diff;
        return record(next)&&next.schema_version===resolution.schema_version&&next.tenant_id===resolution.tenant_id&&next.dealer_id===resolution.dealer_id&&next.revision===result.profile.revision&&next.industry_id===input.industry_id&&equal(next.entitlements,input.entitlements)&&equal(next.enabled_modules,input.enabled_modules)&&record(diff)&&equal(diff.enabled,input.enabled_modules.filter(id=>!resolution.enabled_modules.includes(id)))&&equal(diff.disabled,resolution.enabled_modules.filter(id=>!input.enabled_modules.includes(id)))&&diff.industry_changed===(resolution.industry_id!==input.industry_id);
      }
      form.addEventListener('submit',async event=>{
        event.preventDefault();if(!present()||!canManage||previewing||writing||uncertain||confirmed)return;
        const version=draftVersion,input=payload(),body=JSON.stringify(input);previewing=true;prepared=null;apply.hidden=true;lock();
        try{
          const result=await request('/api/composition/preview',{method:'POST',body});if(!present()||version!==draftVersion||body!==JSON.stringify(payload()))return;if(!validPreview(result,input))throw invalid();
          prepared={body,profile:result.profile};apply.hidden=false;writeText(apply,copy('composer_apply'));
          const entitled=input.entitlements.filter(id=>!resolution.entitlements.includes(id)),revoked=resolution.entitlements.filter(id=>!input.entitlements.includes(id)),capabilityChanges=Object.keys(input.capability_flags).filter(cap=>input.capability_flags[cap]!==(current.profile?.capability_flags?.[cap]!==false));
          const moduleList=ids=>ids.map(id=>String(moduleLabel(id))).join(', ')||String(copy('composer_none'));
          const capabilityList=enabled=>capabilityChanges.filter(cap=>input.capability_flags[cap]===enabled).map(cap=>`${moduleLabel(cap.split(':')[0])} / ${capabilityLabel(cap)}`).join(', ')||String(copy('composer_none'));
          writeText(output,live(()=>copy('composer_preview_summary',{entitled:moduleList(entitled),revoked:moduleList(revoked),enabled:moduleList(result.diff.enabled),disabled:moduleList(result.diff.disabled),capabilities_enabled:capabilityList(true),capabilities_disabled:capabilityList(false),industry:result.diff.industry_changed?String(copy('composer_industry_changed')):''})));
        }catch(error){if(present()&&version===draftVersion&&!error.stale)writeText(output,failure(error));}
        finally{previewing=false;if(present())lock();}
      });
      apply.addEventListener('click',async()=>{
        if(!present()||!canManage||!prepared||writing||confirmed)return;if(!uncertain&&JSON.stringify(payload())!==prepared.body){changed();return;}
        const attempt=prepared;writing=true;lock();
        try{
          const result=await request('/api/composition',{method:'PUT',body:attempt.body});if(!present())return;
          if(result?.ok!==true||typeof result.created!=='boolean'||result.data_deleted!==undefined&&result.data_deleted!==false||!profileMatches(result.profile,JSON.parse(attempt.body))||result.profile.revision!==attempt.profile.revision||result.profile.signature!==attempt.profile.signature)throw invalid();
          confirmed=true;uncertain=false;prepared=null;apply.hidden=true;writeText(output,copy('composer_saved'));
          const nav=await request('/api/workspaces');if(!present())return;if(!Array.isArray(nav.workspaces))throw invalid();state.navigation=nav.workspaces;renderNavigation();toast(copy('composer_saved'));await renderComposer(content);
        }catch(error){
          if(!present()||error.stale)return;
          if(confirmed)writeText(output,copy('composer_saved_refresh_failed'));
          else if(error.status>=400&&error.status<500&&![408,429].includes(error.status)){prepared=null;apply.hidden=true;writeText(output,failure(error));}
          else{uncertain=true;writeText(output,copy('composer_unconfirmed'));writeText(apply,copy('composer_retry'));}
        }finally{writing=false;if(present())lock();}
      });
      refresh.addEventListener('click',()=>{if(present()&&!writing)return renderComposer(content);});
      replaceChildren(content,[form]);lock();
    }catch(error){if(active()&&!error.stale)replaceChildren(content,[node('p','ErrorState',failure(error))]);}
  }

  async function renderIdentityUsers(section,content){
    const epoch=accessGeneration,ticket={};identityViews.set(content,ticket);
    const active=()=>state.workspaceId==='settings'&&state.activeSection===section&&accessGeneration===epoch&&content.isConnected&&identityViews.get(content)===ticket;
    const invalid=()=>Object.assign(Error('identity_observation_invalid'),{identityInvalid:true});
    const text=value=>typeof value==='string'&&value.length>0,strings=value=>Array.isArray(value)&&value.every(text)&&new Set(value).size===value.length;
    const roles=['ADMIN','FOUNDER','SUPER_ADMIN','MANAGER','FINANCE_ADMIN','APPROVER','ANALYST','VIEWER','SALES','ACCOUNTANT','MARKETING'],modules=['procurement','sales','crm','marketing','finance','analysis','calendar','communication','automation'],operations=['read','write','export','manage','approve'];
    const permissions=modules.flatMap(module=>operations.map(op=>module+':'+op));
    const roleLabel=value=>roles.includes(value)?copy('identity_role.'+value.toLowerCase()):String(value);
    const permissionLabel=value=>permissions.includes(value)?live(()=>{const [module,op]=value.split(':');return copy('module.'+module)+' / '+copy('identity_permission.'+op);}):String(value);
    const list=(values,label)=>values.map(value=>String(label(value))).join(', ')||String(copy('composer_none'));
    const memberValid=member=>member&&text(member.id)&&text(member.username)&&text(member.display_name)&&strings(member.roles)&&member.roles.length>0&&member.roles.every(role=>roles.includes(role))&&strings(member.permissions)&&member.permissions.every(value=>permissions.includes(value))&&typeof member.enrolled==='boolean'&&['ACTIVE','INVITED','SUSPENDED'].includes(member.status)&&Number.isSafeInteger(member.revision)&&member.revision>0&&!(member.status==='ACTIVE'&&!member.enrolled)&&!(member.status==='INVITED'&&member.enrolled);
    const errorCopy=error=>error?.identityInvalid?copy('identity_invalid'):friendlyError(error);
    replaceChildren(content,[node('p','LoadingState',copy('identity_loading'))]);
    try{
      const session=await request('/api/identity/session');if(!active())return;
      if(session.authenticated===false){retireWorkspace({status:401});const link=node('a','',copy('identity_sign_in'));link.href='/login';replaceChildren(content,[link]);return;}
      if(session.authenticated!==true||typeof session.can_manage!=='boolean'||!text(session.tenant_id)||!text(session.dealer_id)||!text(session.principal?.id)||!strings(session.principal.roles)||!strings(session.principal.permissions)||!['MEMBER_SESSION','BOOTSTRAP_ADMIN','DEVELOPMENT_OR_ADMIN'].includes(session.authentication_method))throw invalid();
      const items=[],self=node('article','context-item');self.append(node('h3','',copy('identity_current_user')),node('p','',session.principal.id),node('p','',live(()=>copy('identity_roles_value',{roles:list(session.principal.roles,roleLabel)}))));
      if(session.principal.permissions.length)self.append(node('p','',live(()=>copy('identity_permissions_value',{permissions:list(session.principal.permissions,permissionLabel)}))));
      if(session.authentication_method==='MEMBER_SESSION'){const logout=node('button','',copy('identity_logout'));logout.type='button';logout.setAttribute('data-identity-action','logout');let busy=false;logout.addEventListener('click',async()=>{if(!active()||busy)return;busy=true;logout.disabled=true;try{const result=await request('/api/identity/logout',{method:'POST',body:'{}'});if(!active())return;if(result.ok!==true)throw invalid();retireWorkspace({status:401});location.assign('/login');}catch(error){if(active()){toast(errorCopy(error),true);busy=false;logout.disabled=false;}}});self.append(logout);}
      items.push(self);
      if(section==='ROLES'||!session.can_manage){if(!session.can_manage)items.push(node('p','',copy('identity_manage_only')));replaceChildren(content,items);return;}
      const data=await request('/api/identity/users');if(!active())return;
      if(data.tenant_id!==session.tenant_id||!Array.isArray(data.items)||!data.items.every(memberValid)||new Set(data.items.map(row=>row.id)).size!==data.items.length||!strings(data.roles)||data.roles.length!==roles.length||data.roles.some(role=>!roles.includes(role))||!strings(data.permissions)||data.permissions.length!==permissions.length||data.permissions.some(value=>!permissions.includes(value)))throw invalid();
      const storageKey='foundly.identity.requests.v1:'+JSON.stringify([session.tenant_id,session.dealer_id,session.principal.id]);
      const metadataValid=row=>row&&typeof row.request_id==='string'&&/^[A-Za-z0-9_.:-]{8,160}$/.test(row.request_id)&&['INVITE','UPDATE_ACCESS','REISSUE_INVITE'].includes(row.operation)&&(row.operation==='INVITE'?row.target_id===null&&row.expected_revision===0:text(row.target_id)&&Number.isSafeInteger(row.expected_revision)&&row.expected_revision>0)&&Object.keys(row).every(key=>['request_id','operation','target_id','expected_revision'].includes(key));
      const readPending=()=>{const raw=sessionStorage.getItem(storageKey),rows=raw===null?[]:JSON.parse(raw);if(!Array.isArray(rows)||rows.length>100||!rows.every(metadataValid)||new Set(rows.map(row=>row.request_id)).size!==rows.length)throw invalid();return rows;};
      const storePending=rows=>{if(rows.length)sessionStorage.setItem(storageKey,JSON.stringify(rows));else sessionStorage.removeItem(storageKey);};
      const forget=key=>storePending(readPending().filter(row=>row.request_id!==key));
      let prior=[],storageReady=true;try{prior=readPending();}catch{storageReady=false;}
      const invitation=node('div'),recovery=node('div'),forms=[];invitation.setAttribute('role','status');
      const acknowledgement=(result,pending,payload)=>{
        if(result.ok!==true||result.request_id!==pending.request_id||result.operation!==pending.operation||result.actor_id!==session.principal.id||result.tenant_id!==session.tenant_id||result.dealer_id!==session.dealer_id)throw invalid();
        if(result.status==='NOT_APPLIED'){if(payload||result.target_id!==pending.target_id||result.expected_revision!==pending.expected_revision||result.member!==undefined||result.invite_token!==undefined)throw invalid();return;}
        if(!memberValid(result.member)||result.member.revision!==pending.expected_revision+1||(pending.target_id!==null&&result.member.id!==pending.target_id))throw invalid();
        if(payload&&pending.operation==='INVITE'&&(result.member.username!==payload.username.toLowerCase()||result.member.display_name!==payload.display_name))throw invalid();
        const same=(a,b)=>JSON.stringify([...a].sort())===JSON.stringify([...b].sort());
        if(payload&&pending.operation!=='REISSUE_INVITE'&&(!same(result.member.roles,payload.roles)||!same(result.member.permissions,payload.permissions)))throw invalid();
        if(pending.operation==='UPDATE_ACCESS'){if(result.sessions_revoked!==true||payload&&result.member.status!==payload.status||result.invite_token!==undefined)throw invalid();}
        else if(result.delivered!==false||result.member.status!=='INVITED'||result.member.enrolled||!/^[a-f0-9]{64}$/.test(result.invite_token||'')||typeof result.expires_at!=='string'||!Number.isFinite(Date.parse(result.expires_at))||Date.parse(result.expires_at)<=Date.now()||result.expires_at!==result.member.invite_expires_at||typeof session.public_origin!=='string'||!/^https?:\/\/[^/?#\s]+$/.test(session.public_origin)||result.enrollment_url!==session.public_origin+'/login#invite='+result.invite_token)throw invalid();
      };
      const showResult=result=>{
        const summary=node('p','',live(()=>copy('identity_result',{name:result.member.display_name,status:String(copy('identity_status.'+result.member.status.toLowerCase())),revision:i18n().number(result.member.revision)})));
        if(!result.invite_token){replaceChildren(invitation,[summary,node('p','',copy('identity_saved'))]);return;}
        const label=node('label'),link=node('textarea');link.value=result.enrollment_url;link.readOnly=true;label.append(node('span','',copy('identity_invitation_link')),link);
        replaceChildren(invitation,[summary,node('p','',live(()=>copy('identity_invitation_ready',{expires:String(time(result.expires_at))}))),label]);
      };
      const lockTarget=target=>{for(const entry of forms)if(entry.target===target){entry.done=true;entry.lock();}};
      for(const pending of prior){const row=node('article','context-item'),notice=node('output'),recover=node('button','',copy('identity_recover'));notice.setAttribute('role','status');recover.type='button';recover.setAttribute('data-identity-action','recover');let busy=false,done=false;row.append(node('p','',copy('identity_pending')),recover,notice);recovery.append(row);recover.addEventListener('click',async()=>{
        if(!active()||busy||done)return;busy=true;recover.disabled=true;
        try{const result=await request('/api/identity/requests/'+encodeURIComponent(pending.request_id)+'/recover',{method:'POST',body:JSON.stringify({operation:pending.operation,target_id:pending.target_id,expected_revision:pending.expected_revision,confirm:true})});if(!active())return;acknowledgement(result,pending);if(result.status==='NOT_APPLIED')writeText(notice,copy('identity_not_applied'));else showResult(result);done=true;lockTarget(pending.target_id);try{forget(pending.request_id);}catch{writeText(notice,copy('identity_saved_metadata'));}if(!notice.textContent)writeText(notice,copy('identity_recovered'));}
        catch(error){if(active()){if(error.code==='identity_request_superseded'){done=true;try{forget(pending.request_id);}catch{}writeText(notice,copy('identity_superseded'));}else writeText(notice,copy('identity_unconfirmed'));}}
        finally{if(active()){busy=false;recover.disabled=done;}}
      });}
      if(!storageReady)recovery.append(node('p','ErrorState',copy('identity_storage_required')));
      function memberForm(member){
        const form=node('form','domain-record-form'),notice=node('output'),fields={},roleInputs=[],permissionInputs=[];notice.setAttribute('role','status');
        const entry={target:member?.id||null,done:false,lock:null};forms.push(entry);let busy=false,pending=null,payload=null,path=null,method=null;
        const retained=prior.some(row=>row.target_id===entry.target),controls=[];
        const field=(name,type,label)=>{const wrap=node('label'),input=node(type==='select'?'select':'input');input.name=name;if(type!=='select')input.type=type;wrap.append(node('span','',copy(label)),input);form.append(wrap);controls.push(input);fields[name]=input;return input;};
        if(!member){field('username','text','identity_username').required=true;fields.username.maxLength=200;field('display_name','text','identity_name').required=true;fields.display_name.maxLength=200;}
        const roleGroup=node('fieldset'),permissionGroup=node('details');roleGroup.append(node('legend','',copy('identity_roles')));permissionGroup.append(node('summary','',copy('identity_permissions')));
        for(const [values,container,inputs,selected,label]of [[data.roles,roleGroup,roleInputs,member?.roles||['VIEWER'],roleLabel],[data.permissions,permissionGroup,permissionInputs,member?.permissions||[],permissionLabel]])for(const value of values){const wrap=node('label'),input=node('input');input.type='checkbox';input.value=value;input.checked=selected.includes(value);wrap.append(input,node('span','',label(value)));container.append(wrap);inputs.push(input);controls.push(input);}
        form.append(roleGroup,permissionGroup);
        if(member){const status=field('status','select','identity_status');for(const value of member.enrolled?['ACTIVE','SUSPENDED']:['SUSPENDED']){const option=node('option','',copy('identity_status.'+value.toLowerCase()));option.value=value;status.append(option);}status.value=member.status==='INVITED'?'SUSPENDED':member.status;}
        const reason=field('reason','text','identity_reason'),confirm=field('confirm','checkbox','identity_confirm');reason.required=true;reason.maxLength=500;confirm.required=true;
        const save=node('button','primary-button',copy(member?'identity_update':'identity_invite'));save.type='submit';const renew=member&&!member.enrolled?node('button','',copy('identity_reissue')):null;
        if(renew){renew.type='button';renew.setAttribute('data-identity-action','reissue');}form.append(save,...(renew?[renew]:[]),notice);
        entry.lock=()=>{for(const control of controls)control.disabled=busy||entry.done||retained||!storageReady||Boolean(pending);save.disabled=busy||entry.done||retained||!storageReady||Boolean(pending&&pending.operation==='REISSUE_INVITE');if(renew)renew.disabled=busy||entry.done||retained||!storageReady||Boolean(pending&&pending.operation!=='REISSUE_INVITE');};entry.lock();
        async function submit(operation){
          if(!active()||!form.isConnected||busy||entry.done||retained||!storageReady||pending&&pending.operation!==operation)return;
          if(!pending){
            if(!reason.reportValidity()||!confirm.reportValidity())return;
            payload=operation==='REISSUE_INVITE'?{expected_revision:member.revision,confirm:confirm.checked,reason:reason.value.trim()}:{roles:roleInputs.filter(input=>input.checked).map(input=>input.value),permissions:permissionInputs.filter(input=>input.checked).map(input=>input.value),reason:reason.value.trim(),confirm:confirm.checked,...(member?{status:fields.status.value,expected_revision:member.revision}:{username:fields.username.value.trim(),display_name:fields.display_name.value.trim()})};
            try{const rows=readPending();if(rows.length>=100||rows.some(row=>row.target_id===entry.target))throw invalid();const requestId=crypto.randomUUID(),metadata={request_id:requestId,operation,target_id:entry.target,expected_revision:member?.revision||0};if(!metadataValid(metadata))throw invalid();storePending([...rows,metadata]);pending=metadata;}catch{writeText(notice,copy('identity_storage_required'));return;}
            path='/api/identity/users'+(member?'/'+encodeURIComponent(member.id):'')+(operation==='REISSUE_INVITE'?'/reissue':'');method=operation==='UPDATE_ACCESS'?'PUT':'POST';
          }
          busy=true;entry.lock();writeText(notice,copy('identity_saving'));
          try{const result=await request(path,{method,headers:{'idempotency-key':pending.request_id},body:JSON.stringify(payload)});if(!active())return;acknowledgement(result,pending,payload);showResult(result);entry.done=true;try{forget(pending.request_id);writeText(notice,copy('identity_saved'));}catch{writeText(notice,copy('identity_saved_metadata'));}}
          catch(error){if(!active())return;if(error.status>=400&&error.status<500&&![408,429].includes(error.status)){try{forget(pending.request_id);}catch{}pending=null;entry.done=[409,412,428].includes(error.status);writeText(notice,errorCopy(error));}else{writeText(notice,copy('identity_unconfirmed'));writeText(operation==='REISSUE_INVITE'?renew:save,copy('identity_retry'));}}
          finally{if(active()){busy=false;entry.lock();}}
        }
        form.addEventListener('submit',event=>{event.preventDefault();return submit(member?'UPDATE_ACCESS':'INVITE');});if(renew)renew.addEventListener('click',()=>submit('REISSUE_INVITE'));return form;
      }
      items.push(recovery,node('h3','',copy('identity_new_user')),memberForm(null),invitation);
      const refresh=node('button','',copy('identity_refresh'));refresh.type='button';refresh.setAttribute('data-identity-action','refresh');refresh.addEventListener('click',()=>{if(active())return renderIdentityUsers(section,content);});items.push(refresh);
      for(const member of data.items){const card=node('details','context-item');card.append(node('summary','',live(()=>`${member.display_name} · ${member.username} · ${copy('identity_status.'+member.status.toLowerCase())}`)),node('p','',live(()=>copy('identity_member_id',{id:member.id}))),node('p','',live(()=>copy('identity_revision_roles',{revision:i18n().number(member.revision),roles:list(member.roles,roleLabel)}))),memberForm(member));items.push(card);}
      if(active())replaceChildren(content,items);
    }catch(error){if(active()&&!error.stale)replaceChildren(content,[node('p','ErrorState',errorCopy(error))]);}
  }

  async function renderAutomationSection(section,content,query={}) {
    if(!content.isConnected||state.workspaceId!=='automation'||state.activeSection!==section)return;
    const token=state.automationQueryToken=(state.automationQueryToken||0)+1,epoch=accessGeneration,current=()=>content.isConnected&&state.workspaceId==='automation'&&state.activeSection===section&&token===state.automationQueryToken&&epoch===accessGeneration;
    const read=(path,options)=>request(path,options,current),object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value),integer=value=>Number.isSafeInteger(value)&&value>=0,invalid=()=>Object.assign(Error('automation_view_invalid'),{code:'automation_view_invalid'});
    const labels={loading:'Workflowgegevens laden…',invalid:'De ontvangen workflowgegevens kunnen niet worden bevestigd.',search:'Zoek op run, workflow, event, stap of foutmelding',run_status:'Uitvoerstatus',all_statuses:'Alle statussen',find:'Zoeken',run_count:'{count} toegankelijke uitvoeringen · vanaf {from}',previous:'Vorige',next:'Volgende',version_state:'Versie {version} · {state}',active:'Actief',paused:'Gepauzeerd of uitgeschakeld',trigger:'Trigger: {value}',dependencies:'Acties: {actions}. Rechten worden opnieuw gecontroleerd bij uitvoering.',step:'{index}. {action}: {status}',attempts:' · {count} poging(en)',step_error:' · Deze stap bevat een geregistreerde fout; controleer de stapdetails.',wake:'Volgende poging vanaf {time} (UTC). Eerdere resultaten blijven behouden.',empty:'Geen workflows of runs voor dit onderdeel.',empty_page:'Geen uitvoeringen op deze pagina; kies een andere pagina.',retry_help:'Alleen ondersteunde acties met een vastgelegd retrybeleid worden na tijdelijke fouten herhaald. Een onderbroken stap met onbekende uitkomst vereist afzonderlijke beoordeling.',dead_letter:'Het maximumaantal pogingen is bereikt. Deze run blijft bewaard voor beoordeling en wordt niet automatisch herhaald.'};
    const text=(key,params={})=>i18n()?i18n().t('workflow.list.'+key,params):(labels[key]||key).replace(/\{(\w+)\}/g,(_,name)=>String(params[name])),owned=key=>live(()=>text(key)),numeric=value=>i18n()?i18n().number(value):String(value),registered=(kind,value)=>typeof value==='string'&&Object.hasOwn(globalThis.FoundlyLocales?.messages?.['nl-NL']||{},'workflow.'+kind+'.'+value)?i18n().t('workflow.'+kind+'.'+value):i18n()?String(unknown()):String(value??'—'),statusText=value=>registered('status',String(value||'').toLowerCase());
    replaceChildren(content,[node('p','LoadingState',owned('loading'))]);
    try {
      const workflowSections=['WORKFLOWS','TRIGGERS','ACTIONS','DEPENDENCIES'],data=workflowSections.includes(section)?await read('/api/automation/workflows'):{};if(!current())return;
      if(workflowSections.includes(section)&&(!object(data)||!Array.isArray(data.workflows)||!integer(data.workflow_count)||data.workflow_count!==data.workflows.length||typeof data.can_manage!=='boolean'||data.workflows.some(row=>!object(row)||typeof row.id!=='string'||typeof row.name!=='string'||!integer(row.version)||row.version<1||!Array.isArray(row.actions)||row.actions.some(action=>!object(action))||!object(row.trigger))))throw invalid();
      const result=[];let page;
      if(!workflowSections.includes(section)){
        const defaults=section==='APPROVALS'?{status:'AWAITING_APPROVAL'}:section==='FAILURES'?{status:'ERROR,BLOCKED,DEAD_LETTER,RECOVERY_READY,RUNNING'}:section==='RETRIES'?{retried:'true'}:{},filters={...defaults,...query,limit:'50'};
        page=await read('/api/automation/runs?'+new URLSearchParams(filters));if(!current())return;if(!object(page)||!Array.isArray(page.items)||!integer(page.total)||!integer(page.offset)||!(page.next_offset===null||integer(page.next_offset))||typeof page.can_manage!=='boolean'||page.items.some(row=>!object(row)||typeof row.run_id!=='string'||typeof row.automation_id!=='string'||!Array.isArray(row.steps)||row.steps.some(step=>!object(step))))throw invalid();data.runs=page.items;data.request_context=page.request_context;const composition=await read('/api/composition');if(!current())return;if(!object(composition?.resolution)||!Array.isArray(composition.resolution.capabilities))throw invalid();data.can_manage=page.can_manage===true&&composition.resolution.capabilities.includes('automation:workflows');data.retryable_actions=page.retryable_actions;data.can_approve=data.can_manage&&composition.resolution.capabilities.includes('automation:approvals');
        const form=node('form','domain-record-form'),search=node('input'),label=node('label'),status=node('select'),statusLabel=node('label'),find=node('button','secondary-button',owned('find'));search.value=query.q||'';search.maxLength=200;label.append(node('span','',owned('search')),search);
        for(const value of ['', 'RUNNING','PLANNED','SUCCEEDED','ERROR','BLOCKED','AWAITING_APPROVAL','WAITING_TIME','WAITING_RETRY','DEAD_LETTER','RECOVERY_READY']){const option=node('option','',live(()=>value?statusText(value):text('all_statuses')));option.value=value;status.append(option);}status.value=query.status||'';statusLabel.append(node('span','',owned('run_status')),status);find.type='submit';form.append(label,statusLabel,find);form.addEventListener('submit',event=>{event.preventDefault();if(!current())return;return renderAutomationSection(section,content,{q:search.value.trim(),...(status.value?{status:status.value}:{}),offset:'0'});});result.push(form,node('p','',live(()=>text('run_count',{count:numeric(page.total),from:numeric(page.total?page.offset+1:0)}))));
        const navigation=node('div');for(const [title,offset]of [['previous',page.offset>=50?page.offset-50:null],['next',page.next_offset]]){const button=node('button','secondary-button',owned(title));button.type='button';button.disabled=offset===null;button.addEventListener('click',()=>{if(current()&&!button.disabled)return renderAutomationSection(section,content,{...query,offset:String(offset)});});navigation.append(button);}result.push(navigation);
      }
      if(section==='WORKFLOWS'&&data.can_manage&&window.FoundlyWorkflowActivation)result.push(window.FoundlyWorkflowActivation.create({document,request:read,requestContext:data.request_context,isActive:current}));
      if(['RUNS','FAILURES','RETRIES'].includes(section)&&data.can_manage&&window.FoundlyWorkflowResume)result.push(window.FoundlyWorkflowResume.create({document,request:read,requestContext:data.request_context,isActive:current}));
      if(section==='APPROVALS'&&data.can_approve&&window.FoundlyWorkflowApproval)result.push(window.FoundlyWorkflowApproval.create({document,request:read,requestContext:data.request_context,isActive:current}));
      if(section==='WORKFLOWS'&&data.can_manage){
        const drafts=await read('/api/automation/drafts');if(!current())return;if(!object(drafts)||!Array.isArray(drafts.items)||!object(drafts.request_context))throw invalid();const editorBox=node('div'),chooser=node('select'),label=node('label','','Bewaard concept'),open=node('button','secondary-button','Concept openen'),message=node('output');
        chooser.append(node('option','','Nieuw concept'));chooser.firstChild.value='';for(const draft of drafts.items){const option=node('option','',`${draft.draft.name||'Naamloos concept'} · revisie ${draft.revision}`);option.value=draft.id;chooser.append(option);}label.append(chooser);open.type='button';
        const rememberDraft=record=>{if(!current())return;const index=drafts.items.findIndex(row=>row.id===record.id);if(index>=0)drafts.items[index]=record;else drafts.items.push(record);let option=[...chooser.options].find(row=>row.value===record.id);if(!option){option=node('option');option.value=record.id;chooser.append(option);}option.textContent=`${record.draft.name||'Naamloos concept'} · revisie ${record.revision}`;chooser.value=record.id;};
        const show=draft=>{const editor=window.FoundlyWorkflowEditor.create({document,spec:data.editor_contract,request:read,draft,onDraftRecovered:rememberDraft,requestContext:drafts.request_context,isActive:current,zeroRequest:async(action,turnId)=>{if(!editor.isConnected||!content.isConnected||state.workspaceId!=='automation'||state.activeSection!==section||token!==state.automationQueryToken)throw Error('De workflowweergave is niet meer actief.');const response=await read('/api/zero/turn',{method:'POST',body:JSON.stringify({message:action.operation==='SAVE'?'Bewaar het expliciet bevestigde workflowconcept':'Bereid het gekozen workflowconcept voor',conversation_id:state.conversationId,turn_id:turnId,preferred_module:'automation',client_context:{automation_action:action}})});if(!editor.isConnected||!content.isConnected||state.workspaceId!=='automation'||state.activeSection!==section||token!==state.automationQueryToken)throw Error('De workflowweergave is niet meer actief.');state.conversationId=response.conversation_id||state.conversationId;return response.automation_data;},onSaved:()=>{if(current())return renderAutomationSection(section,content);}});editorBox.replaceChildren(editor);};show();
        open.addEventListener('click',()=>{if(!current())return;if(editorBox.querySelector('form')?.dataset.unsaved==='true'){message.textContent='Bewaar eerst je huidige invoer, of bewaar deze als nieuw concept.';return;}try{show(drafts.items.find(row=>row.id===chooser.value)||null);message.textContent='';}catch(error){message.textContent=error.message;}});
        const template=node('button','secondary-button',(globalThis.FoundlyI18n?globalThis.FoundlyI18n.t("static.6fd8b6ae"):'Branchesjabloon kiezen'));template.type='button';
        template.addEventListener('click',async()=>{if(!current()||template.disabled)return;if(editorBox.querySelector('form')?.dataset.unsaved==='true'){message.textContent='Bewaar eerst je huidige invoer, of bewaar deze als nieuw concept.';return;}template.disabled=true;try{await chooseIndustryPreset('automation','workflow',selected=>{if(!current())return;show({draft:selected.draft});message.textContent='Sjabloon geopend als nieuw concept. Bewaar het concept of controleer de workflowversie voordat je deze opslaat.';});}catch(error){if(current())message.textContent=friendlyError(error);}finally{if(current())template.disabled=false;}});
        const language=window.FoundlyWorkflowGenerator.create({document,spec:data.editor_contract,requestContext:drafts.request_context,recoverRequest:read,isActive:current,zeroRequest:async(action,turnId)=>{
          const active=()=>language.isConnected&&current();if(!active())throw Error('De workflowweergave is niet meer actief.');
          const response=await read('/api/zero/turn',{method:'POST',body:JSON.stringify({message:action.operation==='GENERATE'?'Bereid een workflow uit mijn beschrijving voor':'Bewaar het gecontroleerde workflowvoorstel',conversation_id:state.conversationId,turn_id:turnId,preferred_module:'automation',client_context:{automation_action:action}})});
          if(!active())throw Error('De workflowweergave is niet meer actief.');state.conversationId=response.conversation_id||state.conversationId;return response.automation_data;
        },onSaved:record=>{if(!current())return;const index=drafts.items.findIndex(row=>row.id===record.id);if(index>=0)drafts.items[index]=record;else{drafts.items.push(record);const option=node('option','',`${record.draft.name} · revisie ${record.revision}`);option.value=record.id;chooser.append(option);}chooser.value=record.id;}});
        result.push(language,label,open,template,message,editorBox);
      }
      const rows=workflowSections.includes(section)?data.workflows:data.runs;
      for(const row of rows||[]){
        const card=node('article','context-item');card.append(node('h3','',row.name||row.run_id),node('p','',live(()=>workflowSections.includes(section)?text('version_state',{version:numeric(row.version),state:row.effective_enabled===true?text('active'):row.effective_enabled===false?text('paused'):String(unknown())}):statusText(row.status))));
        if(['TRIGGERS','WORKFLOWS'].includes(section))card.append(node('p','',live(()=>text('trigger',{value:registered('trigger',row.trigger?.type)}))));
        if(['ACTIONS','WORKFLOWS'].includes(section))for(const action of row.actions||[])card.append(node('p','',live(()=>registered('action',action.type)+' · '+(action.title||action.message||''))));
        if(section==='DEPENDENCIES')card.append(node('p','',live(()=>text('dependencies',{actions:(row.actions||[]).map(a=>registered('action',a.type)).join(', ')}))));
        if(row.run_id)card.append(window.FoundlyWorkflowInspector.create({document,run:row,request:read,isActive:current}));
        if(row.steps)for(const step of row.steps)card.append(node('p','',live(()=>text('step',{index:integer(step.index)?numeric(step.index+1):String(unknown()),action:registered('action',step.type),status:statusText(step.status)})+(integer(step.attempts)?text('attempts',{count:numeric(step.attempts)}):'')+(step.error?text('step_error'):''))));
        if(['WAITING_RETRY','WAITING_TIME'].includes(row.status)){
          card.append(node('p','',live(()=>text('wake',{time:typeof row.next_wakeup_at==='string'&&Number.isFinite(Date.parse(row.next_wakeup_at))&&/(?:Z|[+-]\d{2}:\d{2})$/.test(row.next_wakeup_at)?String(time(row.next_wakeup_at)):String(unknown())}))));

        }
        if(data.can_manage&&row.can_recover&&row.steps?.some(step=>['RUNNING','FAILED','DEAD_LETTER','BLOCKED'].includes(step.status)&&(data.retryable_actions||[]).includes(step.type))){
          const inspect=node('button','','Controleer opgeslagen resultaat'),notice=node('output');inspect.type='button';notice.setAttribute('role','status');card.append(inspect,notice);
          inspect.addEventListener('click',async()=>{if(!current()||inspect.disabled)return;inspect.disabled=true;try{const preview=await read(`/api/automation/runs/${row.run_id}/recovery`);if(!current())return;const absent=preview.action==='PREPARE_VERIFIED_ABSENT_INTERNAL_RETRY',form=node('form'),label=node('label','','Reden voor herstel'),reason=node('input'),confirmLabel=node('label','',absent?'Ik heb de bewezen afwezigheid en deze afzonderlijke voorbereiding van een nieuwe poging gecontroleerd':'Ik heb deze interne record en revisie gecontroleerd'),confirm=node('input'),save=node('button','',absent?'Nieuwe poging afzonderlijk voorbereiden':'Bewezen stap als voltooid vastleggen');reason.required=true;reason.maxLength=500;label.append(reason);confirm.type='checkbox';confirm.required=true;confirmLabel.append(confirm);save.type='submit';form.append(node('p','',absent?`Geen interne ${preview.evidence.entity}-record met deze uitvoersleutel gevonden. Dit is geen voltooiing. Bevestigen bereidt alleen een nieuwe poging voor; hervatten is een afzonderlijke stap.`:`Gevonden: ${preview.evidence.entity} · ${preview.evidence.record_id} · revisie ${preview.evidence.record_revision}. Volgende stappen worden nog niet uitgevoerd.`),label,confirmLabel,save);card.append(form);
            form.addEventListener('submit',async event=>{event.preventDefault();if(!current()||save.disabled)return;save.disabled=true;try{await read(`/api/automation/runs/${row.run_id}/recovery`,{method:'POST',body:JSON.stringify({preview_fingerprint:preview.preview_fingerprint,reason:reason.value.trim(),confirm:confirm.checked})});if(current())await renderAutomationSection(section,content);}catch(error){if(current())notice.textContent=friendlyError(error);if(current())save.disabled=false;}});
          }catch(error){if(current())notice.textContent=friendlyError(error);if(current())inspect.disabled=false;}});
        }
        if(['WAITING_TIME','WAITING_RETRY','RECOVERY_READY'].includes(row.status)&&data.can_manage&&row.can_recover&&window.FoundlyWorkflowResume)card.append(window.FoundlyWorkflowResume.create({document,row,request:read,requestContext:data.request_context,isActive:current}));
        if(row.status==='DEAD_LETTER')card.append(node('p','',owned('dead_letter')));
        if(section==='WORKFLOWS'&&data.can_manage&&row.can_activate===true&&window.FoundlyWorkflowActivation)card.append(window.FoundlyWorkflowActivation.create({document,workflow:row,request:read,requestContext:data.request_context,isActive:current}));
        if(section==='WORKFLOWS'&&data.can_manage)appendManualWorkflowRun(row,card,content,current,data.request_context);
        if(section==='APPROVALS'&&data.can_approve&&window.FoundlyWorkflowApproval)card.append(window.FoundlyWorkflowApproval.create({document,row,request:read,requestContext:data.request_context,isActive:current}));
        result.push(card);
      }
      if(!rows?.length)result.push(node('p','EmptyState',owned(page?.total>0?'empty_page':'empty')));
      if(section==='RETRIES')result.push(node('p','',owned('retry_help')));
      if(current())replaceChildren(content,result);
    }catch(error){if(current())replaceChildren(content,[node('p','ErrorState',live(()=>error.code==='automation_view_invalid'?text('invalid'):friendlyError(error)))]);}
  }

  function appendManualWorkflowRun(workflow,card,content,isCurrent=()=>true,requestContext){
    const contract=window.FoundlyWorkflowAuthoring,controls=window.FoundlyWorkflowRunZero,form=node('form','domain-record-form'),fields={};
    const active=()=>form.isConnected&&content.isConnected&&isCurrent(),text=(key,params={})=>i18n()?.t('workflow.manual.'+key,params)||key,owned=(key,params={})=>live(()=>text(key,params));
    const referenceLabel=node('label'),reference=node('input');referenceLabel.append(node('span','',owned('reference')));reference.required=true;reference.maxLength=200;reference.value=crypto.randomUUID();referenceLabel.append(reference);form.append(referenceLabel);
    try{
      for(const field of contract.runFields(workflow)){
        if(field.fixed){form.append(node('p','',owned('fixed',{path:field.path})));continue;}
        const holder=node('fieldset'),legend=node('legend','',field.path),typeLabel=node('label'),type=node('select'),valueLabel=node('label'),value=node('input');typeLabel.append(node('span','',owned('type')));valueLabel.append(node('span','',owned('value')));value.maxLength=12000;
        for(const id of ['absent','text','number','boolean','null']){const option=node('option','',owned('type_'+id));option.value=id;type.append(option);}type.value='absent';typeLabel.append(type);valueLabel.append(value);holder.append(legend,typeLabel,valueLabel);form.append(holder);
        const sync=()=>{valueLabel.hidden=['absent','null'].includes(type.value);value.disabled=valueLabel.hidden;value.required=['number','boolean'].includes(type.value);};type.addEventListener('change',sync);sync();fields[field.path]={type,value};
      }
    }catch{card.append(node('p','ErrorState',owned('invalid')));return;}
    form.append(node('p','',owned('help')));card.append(form);
    if(!controls?.createNative||!requestContext){card.append(node('p','ErrorState',owned('unavailable')));return;}
    const locks=new Map(),busy=()=>[...locks.values()].some(Boolean),available=()=>workflow.effective_enabled===true&&active(),getInput=()=>contract.manualRunInput(workflow,reference.value.trim(),Object.fromEntries(Object.entries(fields).map(([path,field])=>[path,{type:field.type.value,value:field.value.value}])));
    const options=mode=>({document,workflow,requestContext,inputHost:form,getInput,isActive:active,canRequest:()=>!busy()&&available(),request:(path,options)=>request(path,options,active),onBusy:value=>{if(!active())return;locks.set(mode,value);form.inert=busy()||!available();}});
    const native=controls.createNative(options('native'));card.append(native);
    form.addEventListener('submit',event=>{event.preventDefault();});
    const zero=controls.create({...options('zero'),restorePending:false,zeroRequest:async(action,turnId)=>{
      if(!active())throw Error('automation_view_retired');
      const response=await request('/api/zero/turn',{method:'POST',body:JSON.stringify({message:action.operation==='RUN_PREVIEW'?'Controleer deze workflowuitvoering':'Start de afzonderlijk bevestigde workflowuitvoering',conversation_id:state.conversationId,turn_id:turnId,preferred_module:'automation',client_context:{automation_action:action}})},active);
      if(!active())throw Error('automation_view_retired');state.conversationId=response.conversation_id||state.conversationId;return response.automation_data;
    }});card.append(zero);
  }

  async function renderScheduling(content){
    const form=node('form','domain-record-form'),notice=node('output'),results=node('div','scheduling-slots'),fields={};
    for(const [name,label,value] of [['from','Vanaf (datum met UTC-offset)',''],['to','Tot (datum met UTC-offset)',''],['duration_minutes','Duur in minuten','30'],['title','Titel voor de afspraak','']]){
      const holder=node('label','',label),input=node('input');input.name=name;input.required=true;input.value=value;if(name==='duration_minutes'){input.type='number';input.min='5';input.max='480';}if(['from','to'].includes(name))input.placeholder='2026-10-01T09:00:00+02:00';holder.append(input);form.append(holder);fields[name]=input;
    }
    const distribution=node('select'),label=node('label','','Verdeling');for(const [value,title] of [['AVAILABILITY','Eerst beschikbaar'],['ROUND_ROBIN','Minste afspraken in deze periode']]){const option=node('option','',title);option.value=value;distribution.append(option);}label.append(distribution);form.append(label);
    const search=node('button','primary-button','Zoek beschikbare tijdsloten');search.type='submit';notice.setAttribute('aria-live','polite');form.append(search,notice);
    form.addEventListener('submit',async event=>{event.preventDefault();search.disabled=true;replaceChildren(results,[]);try{
      const query=new URLSearchParams({from:fields.from.value,to:fields.to.value,duration_minutes:fields.duration_minutes.value,distribution:distribution.value});
      const slots=await request(`/api/calendar/scheduling/slots?${query}`);notice.textContent=slots.items.length?`${slots.items.length} beschikbare tijdsloten. Bevestig één tijdslot om te boeken.`:'Geen beschikbaarheid geregistreerd binnen deze periode.';
      for(const slot of slots.items.slice(0,50)){
        const card=node('article','context-item'),at=new Intl.DateTimeFormat((globalThis.FoundlyI18n?.locale||'nl-NL'),{timeZone:slot.timezone,dateStyle:'medium',timeStyle:'short'}).format(new Date(slot.start_at)),button=node('button','secondary-button',`Bevestig ${at}`);button.type='button';card.append(node('p','',`${at} · ${slot.timezone}`),button);
        const key=crypto.randomUUID();button.addEventListener('click',async()=>{button.disabled=true;try{await request('/api/calendar/scheduling/book',{method:'POST',headers:{'idempotency-key':key},body:JSON.stringify({...slot,title:fields.title.value.trim(),confirm:true})});notice.textContent='Afspraak opgeslagen in de interne agenda.';replaceChildren(results,[]);}catch(error){notice.textContent=friendlyError(error);button.disabled=false;}});results.append(card);
      }
    }catch(error){notice.textContent=friendlyError(error);}finally{search.disabled=false;}});
    replaceChildren(content,[node('p','panel-copy','Tijdsloten volgen de geregistreerde beschikbaarheid en afspraken. Externe agenda’s tellen alleen mee na een geverifieerde import.'),form,results]);
  }

  function appendForecastResult(parent,result) {
    if(result.scenario){const scenario=result.scenario,panel=node('section');panel.append(node('h3','',scenario.title+' · scenario'),node('p','',scenario.reason),node('p','','Gebruikersaannames, geen omzetboeking of voorspelling met bewezen zekerheid.'));
      const amount=value=>value===null?'niet volledig berekenbaar':(value/100).toFixed(2);
      for(const group of scenario.groups)panel.append(node('p','',`${group.currency} · vastgelegde basis: ${amount(group.baseline_projected_cents)} · scenario: ${amount(group.scenario_projected_cents)} · verschil: ${amount(group.delta_cents)}`));
      const details=node('details');details.append(node('summary','','Expliciete kansaanpassingen'));for(const row of scenario.items.filter(item=>item.assumption_applied))details.append(node('p','',`${row.title} · revisie ${row.revision} · aangenomen ${row.scenario_probability_bps===null?'vastgelegde winkans':(row.scenario_probability_bps/100).toFixed(2)+'%'} · bedrag ${row.scenario_value_cents===null?'niet vastgelegd':(row.scenario_value_cents/100).toFixed(2)} ${row.currency||''} · sluitdatum ${row.scenario_close_date||'niet vastgelegd'} · ${row.included_in_period?'binnen periode':row.scenario_exclusion_reason}`));panel.append(details);parent.append(panel,node('h3','','Vastgelegde uitgangssituatie (zonder scenario)'));
    }

    parent.append(node('p','',`${result.filters.from} t/m ${result.filters.to} · vastgelegd ${new Date(result.observed_at).toLocaleString((globalThis.FoundlyI18n?.locale||'nl-NL'))}. Gewogen kansen zijn geen geboekte omzet.`));
    if(!result.available)parent.append(node('p','','Geen bruikbare kansen binnen deze periode.'));
    for(const group of result.groups){const money=value=>value===null?'Niet beschikbaar':new Intl.NumberFormat((globalThis.FoundlyI18n?.locale||'nl-NL'),{style:'currency',currency:group.currency}).format(value/100);parent.append(node('p','',`${group.currency}: open ${money(group.open_cents)} · gewogen ${money(group.weighted_cents)} · gewonnen ${money(group.won_cents)} · ${group.probability_missing_count} open kansen zonder kanspercentage`));}
    if(result.excluded.length)parent.append(node('p','',`${result.excluded.length} records missen een geldige sluitdatum, bedrag of valuta en zijn buiten de berekening gehouden.`));
    if(result.quotas?.status==='PIPELINE_TARGET_NOT_DEFINED')parent.append(node('p','','Voor deze pipeline is geen afzonderlijk doel vastgelegd.'));
    for(const quota of result.quotas?.items||[]){const labels={NO_EXACT_PERIOD_TARGET:'Geen doel voor exact deze periode',NO_SOURCE_RECORDS:'Geen bronrecords',INCOMPLETE_SOURCE_RECORDS:'Onvolledige brongegevens',ZERO_TARGET:'Doel is nul',AMBIGUOUS_TARGET:'Meerdere doelen voor dezelfde periode'};parent.append(node('p','',`${quota.owner_id} · ${quota.currency} · doel: ${quota.quota?(quota.quota.target_cents/100).toFixed(2):'niet vastgelegd'} · gerealiseerd: ${quota.attainment_percent===null?(labels[quota.unavailable_reason]||'niet beschikbaar'):quota.attainment_percent.toFixed(1)+'%'} · inclusief gewogen kansen: ${quota.projected_attainment_percent===null?'niet beschikbaar':quota.projected_attainment_percent.toFixed(1)+'%'}`));}
    const details=node('details');details.append(node('summary','','Berekeningsbasis'));
    for(const item of result.items)details.append(node('p','',`${item.title} · ${item.date} · ${item.currency} ${(item.value_cents/100).toFixed(2)} · ${item.status} · kans ${item.probability===null?'niet vastgelegd':Math.round(item.probability*100)+'%'} · revisie ${item.revision}`));
    for(const item of result.excluded)details.append(node('p','',`${item.id}: ${item.reason}`));parent.append(details);
  }
  function appendForecastSnapshotForm(parent,result,filters,scenario=null,hierarchy=null) {
    const form=node('form'),label=node('label','','Naam voor bewaarde prognose'),title=node('input'),save=node('button','secondary-button',scenario?'Scenario bewaren':'Berekening bewaren'),notice=node('output');
    title.required=true;title.maxLength=240;label.append(title);save.type='submit';notice.setAttribute('role','status');form.append(label,save,notice);parent.append(form);const key=crypto.randomUUID();let busy=false;
    form.addEventListener('submit',async event=>{event.preventDefault();if(!form.isConnected||busy)return;busy=true;save.disabled=true;try{await request('/api/sales/forecast/snapshots',{method:'POST',headers:{'idempotency-key':key},body:JSON.stringify({title:title.value,filters,...(hierarchy?{hierarchy}:{}),...(scenario?{scenario}:{}),basis_fingerprint:result.basis_fingerprint,confirm:true})});if(!form.isConnected)return;notice.textContent='Opgeslagen onder Bewaarde prognoses; verkoopkansen zijn niet aangepast.';}catch(error){if(form.isConnected)notice.textContent=friendlyError(error);save.disabled=false;busy=false;}});
  }
  function appendForecastScenario(parent,baseline,filters,hierarchy=null) {
    const candidates=baseline.scenario_candidates||baseline.items.filter(row=>row.status!=='WON');if(!candidates.length)return;
    const form=node('form','domain-record-form'),titleLabel=node('label','','Scenarionaam'),title=node('input'),reasonLabel=node('label','','Onderbouwing'),reason=node('textarea'),choices=[],output=node('div'),notice=node('output');
    title.required=reason.required=true;title.maxLength=160;reason.maxLength=1000;titleLabel.append(title);reasonLabel.append(reason);form.append(node('h3','','Scenario vergelijken'),node('p','','Vergelijk veronderstelde winkansen, bedragen en sluitdatums. Laat een aanpassing leeg om de vastgelegde waarde te gebruiken. Datums kunnen kansen in of uit deze periode verplaatsen. Bronrecords blijven behouden.'),titleLabel,reasonLabel);
    for(const row of candidates.slice(0,200)){const group=node('fieldset'),chooseLabel=node('label','','Verkoopkans aanpassen'),choose=node('input');choose.type='checkbox';chooseLabel.prepend(choose);group.append(node('legend','',row.title+' · '+(row.currency||'valuta ontbreekt')+' '+(row.value_cents===null?'bedrag ontbreekt':(row.value_cents/100).toFixed(2))+' · '+(row.date||'sluitdatum ontbreekt')),chooseLabel);const inputs={};for(const [key,label,type]of [['probability_bps','Veronderstelde winkans (%)','number'],['value_cents','Verondersteld bedrag (centen)','number'],['expected_close_date','Veronderstelde sluitdatum','date']]){const holder=node('label','',label),input=node('input');input.type=type;input.disabled=true;if(type==='number'){input.min='0';input.step=key==='probability_bps'?'0.01':'1';if(key==='probability_bps')input.max='100';}holder.append(input);group.append(holder);inputs[key]=input;}choose.addEventListener('change',()=>{for(const input of Object.values(inputs))input.disabled=!choose.checked;});choices.push({row,choose,inputs});form.append(group);}
    if((baseline.scenario_candidate_total||candidates.length)>200)form.append(node('p','','De eerste 200 toegankelijke open kansen zijn selecteerbaar, met de geselecteerde periode eerst. Beperk eigenaar, pipeline of valuta voor een kleinere selectie.'));
    const calculate=node('button','secondary-button','Scenario berekenen');calculate.type='submit';notice.setAttribute('role','status');form.append(calculate,notice);parent.append(form,output);let generation=0;
    form.addEventListener('input',()=>{generation++;output.replaceChildren();});
    form.addEventListener('submit',async event=>{event.preventDefault();if(!form.isConnected||calculate.disabled)return;const token=++generation;calculate.disabled=true;const scenario={title:title.value,reason:reason.value,adjustments:choices.filter(x=>x.choose.checked).map(x=>({opportunity_id:x.row.id,expected_revision:x.row.revision,...Object.fromEntries(Object.entries(x.inputs).filter(([key,input])=>input.value.trim()!=='').map(([key,input])=>[key,key==='expected_close_date'?input.value:key==='probability_bps'?Math.round(Number(input.value)*100):Number(input.value)]))}))};
      try{const result=await request(hierarchy?'/api/sales/forecast/hierarchies/'+encodeURIComponent(hierarchy.id)+'/query':'/api/sales/forecast/scenarios/query',{method:'POST',body:JSON.stringify({filters,scenario,...(hierarchy?{node_id:hierarchy.node_id}:{})})});if(token!==generation||!form.isConnected)return;output.replaceChildren();appendForecastResult(output,result);appendForecastSnapshotForm(output,result,filters,scenario,hierarchy);notice.textContent='Scenario berekend met expliciete aannames; er is niets aan de verkoopkansen gewijzigd.';}catch(error){if(token===generation)notice.textContent=friendlyError(error);}finally{calculate.disabled=false;}});
  }
  function renderSalesForecast(content) {
    const form=node('form','domain-record-form'),fields={},resultBox=node('div'),notice=node('output'),now=new Date(),first=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1)).toISOString().slice(0,10),last=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+1,0)).toISOString().slice(0,10);let generation=0;
    for(const [name,text,value] of [['from','Van',first],['to','Tot en met',last],['currency','Valuta (leeg voor alle)',''],['owner_id','Eigenaar-ID (leeg voor alle toegankelijke)',''],['pipeline_id','Pipeline-ID (leeg voor alle toegankelijke)','']]){const label=node('label','',text),input=node('input');input.name=name;input.type=['from','to'].includes(name)?'date':'text';input.value=value;input.required=['from','to'].includes(name);if(name==='currency'){input.maxLength=3;input.placeholder='EUR';}label.append(input);form.append(label);fields[name]=input;}
    const calculate=node('button','primary-button','Prognose berekenen');calculate.type='submit';notice.setAttribute('role','status');form.append(calculate,notice);replaceChildren(content,[form,resultBox]);form.addEventListener('input',()=>{generation++;resultBox.replaceChildren();});
    form.addEventListener('submit',async event=>{event.preventDefault();const token=++generation;calculate.disabled=true;try{const filters={from:fields.from.value,to:fields.to.value,...(fields.currency.value.trim()?{currency:fields.currency.value.trim().toUpperCase()}:{}),...(fields.owner_id.value.trim()?{owner_id:fields.owner_id.value.trim()}:{}),...(fields.pipeline_id.value.trim()?{pipeline_id:fields.pipeline_id.value.trim()}:{})},result=await request(`/api/sales/forecast?${new URLSearchParams(filters)}`);if(token!==generation||!form.isConnected)return;resultBox.replaceChildren();appendForecastResult(resultBox,result);appendForecastSnapshotForm(resultBox,result,filters);appendForecastScenario(resultBox,result,filters);notice.textContent='Prognose berekend uit vastgelegde verkoopkansen.';}catch(error){if(token===generation)notice.textContent=friendlyError(error);}finally{calculate.disabled=false;}});
  }

  function appendCreativeReviewRequest(record,parent,content) {
    const details=node('details');details.append(node('summary','','Inhoud laten beoordelen'));
    const form=node('form'),reviewerLabel=node('label','','Beoordelaars, in volgorde (gebruikers-ID’s)'),reviewers=node('input'),reasonLabel=node('label','','Onderbouwing'),reason=node('textarea'),confirmLabel=node('label','','Ik vraag beoordeling aan van deze inhoud en revisie'),confirm=node('input'),button=node('button','secondary-button','Beoordeling aanvragen'),notice=node('output');
    reviewers.required=reason.required=confirm.required=true;reviewers.maxLength=1000;reason.maxLength=1000;confirm.type='checkbox';reviewerLabel.append(reviewers);reasonLabel.append(reason);confirmLabel.prepend(confirm);button.type='submit';notice.setAttribute('role','status');form.append(node('p','','Beoordelaars moeten al toegang tot deze creatie en goedkeuringsrechten hebben. Deze aanvraag publiceert niets.'),reviewerLabel,reasonLabel,confirmLabel,button,notice);details.append(form);parent.append(details);const key=crypto.randomUUID();
    form.addEventListener('submit',async event=>{event.preventDefault();button.disabled=true;try{await request(`/api/marketing/creatives/${encodeURIComponent(record.id)}/reviews`,{method:'POST',headers:{'idempotency-key':key},body:JSON.stringify({expected_revision:record.revision,approval_steps:reviewers.value.split(',').map(x=>x.trim()).filter(Boolean),reason:reason.value,confirm:confirm.checked})});notice.textContent='Vastgelegd onder Creative reviews. De creatie is niet gepubliceerd.';}catch(error){notice.textContent=friendlyError(error);button.disabled=false;}});
  }
  function appendCreativeReview(record,parent,content) {
    const details=node('details');details.append(node('summary','','Inhoud en beoordelingen'),node('p','',`Bronrevisie ${record.creative_revision} · ${record.reason} · volgorde: ${record.approval_steps.join(' → ')}`),node('pre','',record.creative_snapshot.content),node('p','','Interne inhoudsbeoordeling. Geen providerpublicatie uitgevoerd.'));
    for(const review of record.reviews)details.append(node('p','',`${review.actor_id}: ${review.decision} · ${review.reason}`));if(record.withdrawal_reason)details.append(node('p','',record.withdrawal_reason));parent.append(details);
    if(record.status!=='APPROVAL_REQUIRED')return;
    const form=node('form'),decisionLabel=node('label','','Besluit'),decision=node('select'),reasonLabel=node('label','','Reden'),reason=node('textarea'),confirmLabel=node('label','','Ik bevestig deze beoordelingsrevisie'),confirm=node('input'),save=node('button','secondary-button','Besluit vastleggen'),withdraw=node('button','secondary-button','Aanvraag intrekken'),notice=node('output');
    for(const [value,label] of [['APPROVE','Inhoud goedkeuren'],['REJECT','Afwijzen']]){const option=node('option','',label);option.value=value;decision.append(option);}decisionLabel.append(decision);reason.required=true;reason.maxLength=1000;reasonLabel.append(reason);confirm.type='checkbox';confirm.required=true;confirmLabel.prepend(confirm);save.type='submit';withdraw.type='button';notice.setAttribute('role','status');form.append(decisionLabel,reasonLabel,confirmLabel,save,withdraw,notice);details.append(form);const key=crypto.randomUUID(),withdrawKey=crypto.randomUUID();
    form.addEventListener('submit',async event=>{event.preventDefault();save.disabled=true;try{await request(`/api/marketing/creative_reviews/${encodeURIComponent(record.id)}/approve`,{method:'POST',headers:{'idempotency-key':key},body:JSON.stringify({expected_revision:record.revision,decision:decision.value,reason:reason.value,confirm:confirm.checked})});await renderDomainSection('creative_reviews',content);}catch(error){notice.textContent=friendlyError(error);save.disabled=false;}});
    withdraw.addEventListener('click',async()=>{if(!form.reportValidity())return;withdraw.disabled=true;try{await request(`/api/marketing/creative_reviews/${encodeURIComponent(record.id)}/withdraw`,{method:'POST',headers:{'idempotency-key':withdrawKey},body:JSON.stringify({expected_revision:record.revision,reason:reason.value,confirm:confirm.checked})});await renderDomainSection('creative_reviews',content);}catch(error){notice.textContent=friendlyError(error);withdraw.disabled=false;}});
  }

  async function renderProcurementComparison(record,content,notice) {
    try {
      const comparison=await request(`/api/procurement/rfqs/${encodeURIComponent(record.id)}/comparison`),panel=node('div','bid-comparison');
      panel.append(node('h3','',`Biedingen: ${comparison.title}`),node('p','',`${comparison.comparable_count} volledige biedingen · revisie ${comparison.rfq_revision}. Vastgelegde prijzen; geen leveranciersverificatie of bestelling.`));
      for(const bid of comparison.items){
        const item=node('div');item.append(node('p','',`${bid.title} · ${bid.comparable?new Intl.NumberFormat((globalThis.FoundlyI18n?.locale||'nl-NL'),{style:'currency',currency:comparison.currency}).format(bid.total_cents/100):'Niet vergelijkbaar: '+bid.reasons.join(', ')} · Levertijd: ${bid.delivery_days===null?'niet vastgelegd':bid.delivery_days+' dagen'} · Herkomst: ${bid.evidence_reference}`));
        if(bid.comparable){const button=node('button','secondary-button','Voorstel voorbereiden');button.type='button';button.addEventListener('click',()=>prepareProcurementAward(comparison,bid,item));item.append(button);}panel.append(item);
      }
      if(!comparison.items.length)panel.append(node('p','','Nog geen biedingen vastgelegd.'));
      else {
        const allocationForm=node('form','domain-record-form'),allocationResult=node('div'),choices=[];
        allocationForm.append(node('h4','','Artikelen verdelen'),node('p','','Kies een volledige verdeling of een deeltoewijzing. Bij deeltoewijzingen tellen eerdere goedgekeurde aantallen en bedragen mee.'));
        const allocationMode=node('select'),modeLabel=node('label','','Omvang van deze toewijzing');for(const [value,title]of [['FULL','Volledige aanvraag'],['INCREMENTAL','Deel van resterende aanvraag']]){const option=node('option','',title);option.value=value;allocationMode.append(option);}allocationMode.value='FULL';modeLabel.append(allocationMode);allocationForm.append(modeLabel);allocationMode.addEventListener('change',()=>replaceChildren(allocationResult,[]));
        for(const line of comparison.requested_lines||[]){const group=node('fieldset');group.append(node('legend','',`${line.item_id} · ${line.description} · gevraagd: ${line.quantity}`));
          for(const bid of comparison.items.filter(row=>row.reasons.every(reason=>reason==='INCOMPLETE_SCOPE'))){const offered=bid.lines.find(item=>item.item_id===line.item_id);if(!offered)continue;const label=node('label','',`${bid.title} · ${(offered.unit_price_cents/100).toFixed(2)} ${comparison.currency} per stuk`),input=node('input');input.type='number';input.min='0';input.max=String(offered.quantity);input.step='1';input.value='0';input.name=`allocation_${line.item_id}_${bid.id}`;label.append(input);group.append(label);choices.push({input,bid_id:bid.id,item_id:line.item_id});}allocationForm.append(group);
        }
        const allocationTransport=node('select'),transportLabel=node('label','',(globalThis.FoundlyI18n?globalThis.FoundlyI18n.t("static.ef06fd08"):'Bediening'));for(const [value,title]of [['native','Native Procurement'],['zero','ZERO']]){const option=node('option','',title);option.value=value;allocationTransport.append(option);}allocationTransport.value='native';transportLabel.append(allocationTransport);allocationForm.append(transportLabel);
        const prepare=node('button','secondary-button','Verdeling controleren');prepare.type='submit';allocationForm.append(prepare);allocationForm.addEventListener('input',()=>replaceChildren(allocationResult,[]));
        allocationForm.addEventListener('submit',event=>{event.preventDefault();const allocations=choices.filter(row=>Number(row.input.value)>0).map(({input,bid_id,item_id})=>({bid_id,item_id,quantity:Number(input.value)}));prepareProcurementAward(comparison,null,allocationResult,allocations,allocationMode.value,allocationTransport.value);});panel.append(allocationForm,allocationResult);
      }
      content.querySelector('.bid-comparison')?.remove();content.append(panel);
    }catch(error){notice.textContent=friendlyError(error);}
  }
  async function prepareProcurementAward(comparison,bid,parent,allocations,allocationMode='FULL',transportMode='native') {
    parent.querySelector('.award-proposal')?.remove();const box=node('div','award-proposal'),notice=node('output');notice.setAttribute('role','status');box.append(notice);let call=request;if(typeof window!=='undefined'&&window.FoundlyProcurementTransport&&!comparison.order_id)parent.append(window.FoundlyProcurementTransport.create({document,request,initialMode:transportMode,build:wrapped=>{call=wrapped;return box;}}));else parent.append(box);
    try{
      const order=Boolean(comparison.order_id),basePath=order?`/api/procurement/orders/${encodeURIComponent(comparison.order_id)}`:`/api/procurement/rfqs/${encodeURIComponent(comparison.rfq_id)}`,preview=allocations?await call(basePath+(allocationMode==='INCREMENTAL'?'/incremental-allocation-preview':'/allocation-preview'),{method:'POST',body:JSON.stringify({allocations})}):await call(basePath+(order?'/approval-preview':`/award-preview?bid_id=${encodeURIComponent(bid.id)}`)),form=node('form'),label=node('label','',order?'Waarom deze order?':allocations?'Waarom deze artikelverdeling?':'Waarom deze bieding?'),reason=node('textarea'),submit=node('button','primary-button','Ter goedkeuring vastleggen');reason.required=true;reason.maxLength=1000;label.append(reason);submit.type='submit';
      box.prepend(node('p','',`Totaal: ${new Intl.NumberFormat((globalThis.FoundlyI18n?.locale||'nl-NL'),{style:'currency',currency:preview.currency}).format(preview.value_cents/100)}`));for(const line of preview.allocation_lines||[])box.append(node('p','',`${line.item_id}: ${line.quantity} × ${(line.unit_price_cents/100).toFixed(2)} ${preview.currency} · ${line.supplier_id} · ${line.evidence_reference}`));
      if(preview.allocation_kind==='ITEM_INCREMENTAL'){box.append(node('p','',`Eerder goedgekeurd: ${(preview.previously_approved_cents/100).toFixed(2)} ${preview.currency} · cumulatieve beoordelingsgrondslag: ${(preview.approval_basis_cents/100).toFixed(2)} ${preview.currency}`));for(const line of preview.remaining_lines)box.append(node('p','',`${line.item_id}: eerder ${line.previously_approved_quantity}, nu ${line.selected_quantity}, hierna resterend ${line.remaining_quantity}`));}
      box.prepend(node('p','',`Verplichte beoordelingsvolgorde: ${preview.approval_steps.join(' → ')}. Dit legt een intern voorstel vast.`));form.append(label,submit);box.append(form);const key=crypto.randomUUID();
      form.addEventListener('submit',async event=>{event.preventDefault();submit.disabled=true;try{await call(basePath+(order?'/approvals':'/awards'),{method:'POST',headers:{'idempotency-key':key},body:JSON.stringify({...(!order?(allocations?{allocations,...(allocationMode==='INCREMENTAL'?{allocation_mode:'INCREMENTAL'}:{})}:{bid_id:bid.id}):{}),preview_fingerprint:preview.preview_fingerprint,reason:reason.value,confirm:true})});form.remove();notice.textContent='Voorstel vastgelegd. Open Voorstellen en beoordelingen om verder te gaan.';}catch(error){notice.textContent=friendlyError(error);submit.disabled=false;}});
    }catch(error){notice.textContent=friendlyError(error);}
  }
  function appendAwardReview(record,cell,content) {
    const details=node('details'),summary=node('summary','','Voorstel en beoordelingen');details.append(summary,node('p','',`${new Intl.NumberFormat((globalThis.FoundlyI18n?.locale||'nl-NL'),{style:'currency',currency:record.currency}).format(record.value_cents/100)} · ${record.reason} · Herkomst: ${record.evidence_reference||(['ITEM_SPLIT','ITEM_INCREMENTAL'].includes(record.allocation_kind)?'Per artikel vastgelegd':'—')}`));
    if(record.allocation_kind==='ITEM_INCREMENTAL')details.append(node('p','',`Cumulatieve beoordelingsgrondslag: ${(record.approval_basis_cents/100).toFixed(2)} ${record.currency}; eerder goedgekeurd ${(record.previously_approved_cents/100).toFixed(2)} ${record.currency}`));
    for(const line of record.bid_lines||record.allocation_lines||[])details.append(node('p','',`${line.item_id} · ${line.quantity} × ${(line.unit_price_cents/100).toFixed(2)} ${record.currency}${line.supplier_id?' · '+line.supplier_id+' · '+line.evidence_reference:''}`));
    for(const review of record.reviews||[])details.append(node('p','',`${review.actor_id}: ${review.decision} · ${review.reason}`));
    if(record.status==='APPROVAL_REQUIRED'){
      details.append(node('p','',`Volgende beoordelaar: ${record.approval_steps[(record.reviews||[]).length]}`));
      const form=node('form'),label=node('label','','Reden beoordeling'),reason=node('textarea'),decisionLabel=node('label','','Beslissing'),decision=node('select'),submit=node('button','primary-button','Beslissing bevestigen'),cancel=node('button','secondary-button','Voorstel intrekken'),notice=node('output');
      for(const [value,text] of [['APPROVE','Goedkeuren'],['REJECT','Afwijzen']]){const option=node('option','',text);option.value=value;decision.append(option);}reason.required=true;reason.maxLength=1000;label.append(reason);decisionLabel.append(decision);submit.type='submit';cancel.type='button';notice.setAttribute('role','status');form.append(label,decisionLabel,submit,cancel,notice);details.append(form);
      const reviewKey=crypto.randomUUID(),cancelKey=crypto.randomUUID();
      form.addEventListener('submit',async event=>{event.preventDefault();submit.disabled=true;try{await request(`/api/procurement/awards/${encodeURIComponent(record.id)}/approve`,{method:'POST',headers:{'idempotency-key':reviewKey},body:JSON.stringify({expected_revision:record.revision,decision:decision.value,reason:reason.value,confirm:true})});await renderDomainSection('awards',content);}catch(error){notice.textContent=friendlyError(error);submit.disabled=false;}});
      cancel.addEventListener('click',async()=>{cancel.disabled=true;try{await request(`/api/procurement/awards/${encodeURIComponent(record.id)}/cancel`,{method:'POST',headers:{'idempotency-key':cancelKey},body:JSON.stringify({expected_revision:record.revision,confirm:true})});await renderDomainSection('awards',content);}catch(error){notice.textContent=friendlyError(error);cancel.disabled=false;}});
    }
    cell.append(details);
  }

  function appendTemplateDraft(record,cell,content,options={}){
    const call=options.request||request,alive=()=>content.isConnected&&details.isConnected&&state.workspaceId==='communication'&&state.activeSection.toLowerCase()==='templates'&&(!options.alive||options.alive()),route='/api/communication/templates/'+encodeURIComponent(record.id);
    const details=node('details'),panel=node('div'),notice=node('p');notice.setAttribute('role','status');details.append(node('summary','','Concept uit sjabloon'),panel,notice);cell.append(details);let loaded=false;
    details.addEventListener('toggle',async()=>{
      if(!details.open||loaded||!alive())return;loaded=true;
      try{
        const schema=await call(route+'/draft-preview',{method:'POST',body:JSON.stringify({variables:{}})});if(!alive())return;
        const form=node('form'),values=new Map(),to=node('input'),cc=node('input'),previewButton=node('button','secondary-button','Concept bekijken'),previewBody=node('div'),reason=node('textarea'),confirm=node('input'),save=node('button','primary-button','Intern concept opslaan');let plan=null,generation=0,busy=false,key=crypto.randomUUID(),previous=null;
        const field=(name,input)=>{const label=node('label','',name);label.append(input);form.append(label);};
        for(const name of schema.required_fields){const input=node('textarea');input.required=true;input.maxLength=2048;values.set(name,input);field(name,input);}to.maxLength=12000;cc.maxLength=12000;field('Aan',to);field('Cc',cc);previewButton.type='button';reason.required=true;reason.maxLength=1000;confirm.type='checkbox';confirm.required=true;save.type='submit';save.disabled=true;
        form.append(previewButton,previewBody);field('Reden',reason);field('Ik bevestig dit interne concept',confirm);form.append(save);panel.append(node('p','','Vul de velden zelf in. Verzenden vereist daarna een afzonderlijke beoordeling en bevestiging.'),form);
        const input=()=>({variables:Object.fromEntries([...values].map(([name,control])=>[name,control.value])),to:to.value.split(',').map(value=>value.trim()).filter(Boolean),cc:cc.value.split(',').map(value=>value.trim()).filter(Boolean)});
        const invalidate=()=>{generation++;plan=null;confirm.checked=false;save.disabled=true;replaceChildren(previewBody,[]);};for(const control of [...values.values(),to,cc])control.addEventListener('input',invalidate);
        previewButton.addEventListener('click',async()=>{if(!alive()||busy)return;const version=++generation,proposed=input();plan=null;save.disabled=true;confirm.checked=false;previewButton.disabled=true;try{const result=await call(route+'/draft-preview',{method:'POST',body:JSON.stringify(proposed)});if(!alive()||version!==generation)return;if(!result.ready_to_create){notice.textContent='Vul de ontbrekende velden in: '+result.missing_fields.join(', ');return;}plan={...result,input:proposed};replaceChildren(previewBody,[node('h4','',result.title),node('pre','',result.content),node('p','',`Aan: ${result.to.join(', ')||'nog niet ingevuld'} · Cc: ${result.cc.join(', ')||'geen'}`)]);notice.textContent='Bekijk de inhoud en bevestig het interne concept.';save.disabled=false;}catch(error){if(alive()&&version===generation)notice.textContent=friendlyError(error);}finally{if(alive())previewButton.disabled=false;}});
        form.addEventListener('submit',async event=>{event.preventDefault();if(!alive()||busy||!plan)return;busy=true;save.disabled=true;previewButton.disabled=true;const selected=plan;try{const encoded=JSON.stringify({...selected.input,source_revision:selected.source_revision,source_hash:selected.source_hash,preview_fingerprint:selected.preview_fingerprint,confirm:confirm.checked,reason:reason.value});if(previous!==null&&previous!==encoded)key=crypto.randomUUID();previous=encoded;await call(route+'/drafts',{method:'POST',headers:{'idempotency-key':key},body:encoded});if(!alive())return;plan=null;replaceChildren(panel,[node('p','','Concept opgeslagen. Je vindt het onder Drafts. Er is niets verzonden.')]);notice.textContent='Intern concept opgeslagen.';}catch(error){if(alive()){notice.textContent=friendlyError(error);save.disabled=!plan;previewButton.disabled=false;busy=false;}}});
      }catch(error){if(alive()){notice.textContent=friendlyError(error);loaded=false;}}
    });
  }

  function appendMessageDraftActions(record,cell,content,options={}){
    const call=options.request||request,alive=()=>content.isConnected&&state.workspaceId==='communication'&&(!options.alive||options.alive());
    const details=node('details'),summary=node('summary','','Antwoord of doorstuurconcept'),panel=node('div'),notice=node('p');notice.setAttribute('role','status');details.append(summary,panel,notice);cell.append(details);
    const mode=node('select'),modeLabel=node('label','','Soort concept'),load=node('button','secondary-button','Bronbericht bekijken');load.type='button';
    for(const [value,label] of [['REPLY','Antwoordconcept'],['REPLY_ALL','Allen beantwoorden'],['FORWARD','Doorstuurconcept']]){const option=node('option','',label);option.value=value;mode.append(option);}
    modeLabel.append(mode);panel.append(modeLabel,load);
    load.addEventListener('click',async()=>{
      if(!alive())return;load.disabled=true;mode.disabled=true;
      try{
        const preview=await call(`/api/communication/messages/${encodeURIComponent(record.id)}/draft-preview?mode=${encodeURIComponent(mode.value)}`),form=node('form'),title=node('input'),to=node('input'),cc=node('input'),text=node('textarea'),save=node('button','primary-button','Concept opslaan');
        if(!alive())return;title.value=preview.title;title.required=true;title.maxLength=1000;to.value=(preview.suggested_to||[]).join(', ');to.required=true;to.maxLength=12000;to.readOnly=preview.mode!=='FORWARD';cc.value=(preview.suggested_cc||[]).join(', ');cc.maxLength=12000;cc.readOnly=preview.mode!=='FORWARD';text.required=true;text.maxLength=12000;save.type='submit';save.disabled=!preview.recipient_available;
        form.append(node('p','','Dit concept blijft gekoppeld aan het bronbericht. Er wordt niets verzonden.'),node('pre','',preview.source_excerpt),node('small','',preview.source_excerpt_truncated?'Een deel van het bronbericht wordt getoond.':''));
        for(const [name,input] of [['Onderwerp',title],['Aan',to],['Cc',cc],['Concepttekst',text]]){const label=node('label','',name);label.append(input);form.append(label);}
        form.append(save);panel.append(form);
        if(preview.mode!=='FORWARD'&&preview.threading?.available===false)form.append(node('p','','Gespreksheaders zijn niet beschikbaar. Dit wordt bij de verzendbeoordeling opnieuw getoond.'));
        if(!preview.recipient_available)notice.textContent='De bronontvangers of ingestelde afzender zijn niet volledig beschikbaar. Dit antwoordconcept is niet beschikbaar.';
        let lastPayload=null,key=crypto.randomUUID();
        form.addEventListener('submit',async event=>{
          event.preventDefault();if(!alive())return;save.disabled=true;
          try{
            const payload={mode:preview.mode,source_revision:preview.source_revision,source_hash:preview.source_hash,title:title.value,content:text.value,to:to.value.split(',').map(value=>value.trim()).filter(Boolean),...(preview.mode==='REPLY_ALL'||cc.value.trim()?{cc:cc.value.split(',').map(value=>value.trim()).filter(Boolean)}:{}),...(preview.mode==='REPLY_ALL'?{recipient_binding:preview.recipient_binding}:{})},encoded=JSON.stringify(payload);
            if(lastPayload!==null&&lastPayload!==encoded)key=crypto.randomUUID();lastPayload=encoded;
            await call(`/api/communication/messages/${encodeURIComponent(record.id)}/drafts`,{method:'POST',headers:{'idempotency-key':key},body:encoded});
            notice.textContent='Concept opgeslagen. Je vindt het onder Drafts. Er is niets verzonden.';
          }catch(error){notice.textContent=friendlyError(error);save.disabled=false;}
        });
      }catch(error){notice.textContent=friendlyError(error);load.disabled=false;mode.disabled=false;}
    });
  }

  function appendSendReviews(record,cell,content,options={}){
    const call=options.request||request;
    const details=node('details'),panel=node('div'),notice=node('p');notice.setAttribute('role','status');details.append(node('summary','','Verzendbeoordeling'),panel,notice);cell.append(details);const route=`/api/communication/drafts/${encodeURIComponent(record.id)}/send-reviews`;let loaded=false;const currentView=()=>content.isConnected&&state.workspaceId==='communication'&&state.activeSection.toLowerCase()==='drafts'&&(!options.alive||options.alive());
    const redraw=async()=>{if(options.onComplete){if(currentView())await options.onComplete();return;}if(content.isConnected&&state.workspaceId==='communication'&&state.activeSection.toLowerCase()==='drafts')await renderDomainSection('drafts',content);};
    const decisionForm=(row,cancel)=>{
      const form=node('form'),reason=node('textarea'),label=node('label','','Reden'),confirm=node('input'),confirmLabel=node('label','','Ik bevestig deze beoordeling'),choice=node('select'),submit=node('button','primary-button',cancel?'Beoordeling intrekken':'Beslissing vastleggen');reason.required=true;reason.maxLength=1000;confirm.type='checkbox';confirm.required=true;submit.type='submit';label.append(reason);confirmLabel.append(confirm);form.append(label,confirmLabel);
      if(!cancel){choice.required=true;for(const [value,text] of [['','Kies een beslissing'],['APPROVE','Goedkeuren'],['REJECT','Afwijzen']]){const option=node('option','',text);option.value=value;choice.append(option);}const choiceLabel=node('label','','Beslissing');choiceLabel.append(choice);form.append(choiceLabel);}form.append(submit);let key=crypto.randomUUID(),previous=null;
      form.addEventListener('submit',async event=>{event.preventDefault();if(!currentView())return;submit.disabled=true;try{const encoded=JSON.stringify({expected_revision:row.revision,reason:reason.value,confirm:confirm.checked,...(!cancel?{decision:choice.value}:{})});if(previous!==null&&encoded!==previous)key=crypto.randomUUID();previous=encoded;await call(route+'/'+encodeURIComponent(row.id)+(cancel?'/cancel':'/approve'),{method:'POST',headers:{'idempotency-key':key},body:encoded});await redraw();}catch(error){notice.textContent=friendlyError(error);submit.disabled=false;}});return form;
    };
    const submissionForm=row=>{
      const form=node('form'),reason=node('textarea'),reasonLabel=node('label','','Reden voor verzending'),confirm=node('input'),confirmLabel=node('label','','Ik bevestig dat deze exacte inhoud en ontvangers extern worden aangeboden'),submit=node('button','primary-button','Goedgekeurd bericht aanbieden');reason.required=true;reason.maxLength=1000;reasonLabel.append(reason);confirm.type='checkbox';confirm.required=true;confirmLabel.append(confirm);submit.type='submit';form.append(node('p','','De mailprovider kan het bericht accepteren. Bezorging bij de ontvanger blijft onbevestigd.'),reasonLabel,confirmLabel,submit);let key=crypto.randomUUID(),previous=null,busy=false;
      form.addEventListener('submit',async event=>{event.preventDefault();if(!currentView()||busy)return;busy=true;submit.disabled=true;try{const encoded=JSON.stringify({expected_review_revision:row.revision,reason:reason.value,confirm:confirm.checked});if(previous!==null&&previous!==encoded)key=crypto.randomUUID();previous=encoded;await call(route+'/'+encodeURIComponent(row.id)+'/submit',{method:'POST',headers:{'idempotency-key':key},body:encoded});await redraw();}catch(error){notice.textContent=friendlyError(error)+' Controleer de bewaarde verzendpoging voordat je een nieuwe actie begint.';submit.disabled=false;busy=false;}});return form;
    };
    const recoveryForm=attempt=>{
      const form=node('form'),reason=node('textarea'),label=node('label','','Reden voor herstel'),confirm=node('input'),confirmLabel=node('label','','Ik bevestig herstel uit het bewaarde bewijs'),save=node('button','primary-button','Verzenduitkomst herstellen');reason.required=true;reason.maxLength=1000;confirm.type='checkbox';confirm.required=true;save.type='submit';label.append(reason);confirmLabel.append(confirm);form.append(node('p','',attempt.recovery?.kind==='RETIRED_BEFORE_DATA'?'De gestopte poging bereikte de duurzame verzendgrens niet. Herstel registreert dat het bericht niet is aangeboden.':'Een duurzaam bewaard transportantwoord is beschikbaar. Herstel verwerkt uitsluitend die eerdere uitkomst.'),node('p','','Deze actie verzendt geen mail. Bezorging blijft onbevestigd.'),label,confirmLabel,save);let key=crypto.randomUUID(),previous=null,busy=false;
      form.addEventListener('submit',async event=>{event.preventDefault();if(!currentView()||busy)return;busy=true;save.disabled=true;try{const encoded=JSON.stringify({expected_revision:attempt.revision,reason:reason.value,confirm:confirm.checked});if(previous!==null&&previous!==encoded)key=crypto.randomUUID();previous=encoded;await call('/api/communication/drafts/'+encodeURIComponent(record.id)+'/submissions/'+encodeURIComponent(attempt.id)+'/reconcile',{method:'POST',headers:{'idempotency-key':key},body:encoded});await redraw();}catch(error){if(currentView()){notice.textContent=friendlyError(error);save.disabled=false;busy=false;}}});return form;
    };
    details.addEventListener('toggle',async()=>{
      if(!details.open||loaded)return;loaded=true;notice.textContent='Beoordelingen laden…';
      try{
        const model=await call(route);if(!currentView())return;replaceChildren(panel,[]);notice.textContent='Beoordelen verzendt niets. Een bericht aanbieden is een aparte bevestigde actie.';
        for(const row of model.items){const item=node('article','context-item');item.append(node('h4','',`${row.status} · ${row.purpose}`),node('p','',`Van: ${row.from} · Aan: ${row.snapshot.to.join(', ')} · Cc: ${(row.snapshot.cc||[]).join(', ')||'geen'}`),node('h5','',row.snapshot.title),node('pre','',row.snapshot.content),node('p','',`Bijlagen: ${row.snapshot.attachments.map(file=>file.name).join(', ')||'geen'}`),node('p','',row.reason),node('p','',row.source_current?'Deze beoordeling hoort bij de actuele bronnen.':'De bron of toegang is gewijzigd; deze beoordeling is niet uitvoerbaar.'));appendReplyContext(row.snapshot,item);for(const attempt of row.submissions||[]){const labels={ACCEPTED_BY_PROVIDER:'Door mailprovider geaccepteerd; bezorging onbevestigd',REJECTED_BY_PROVIDER:'Door mailprovider afgewezen',NOT_SUBMITTED:'Niet aangeboden',CONNECTING:'Verzendpoging gestart; uitkomst nog onbekend',DATA_IN_FLIGHT:'Inhoud aangeboden; uitkomst nog onbekend',UNKNOWN:'Uitkomst onbekend; onderzoek vereist'};item.append(node('p','',labels[attempt.status]||'Verzendstatus niet beschikbaar'));if(attempt.reconciliation_required)item.append(node('p','',attempt.can_reconcile?'Niet opnieuw verzenden. Deze poging kan uit bewaard bewijs worden hersteld.':'Niet opnieuw verzenden. Er is geen herstelbaar bewijs beschikbaar of de poging is nog actief.'));if(attempt.can_reconcile)item.append(recoveryForm(attempt));}if(row.can_submit)item.append(submissionForm(row));if(row.can_review)item.append(decisionForm(row,false));if(row.can_cancel)item.append(decisionForm(row,true));panel.append(item);}
        if(!model.items.length)panel.append(node('p','','Nog geen verzendbeoordelingen.'));
        if(model.can_prepare){
          const form=node('form'),purpose=node('input'),purposeLabel=node('label','','Doel volgens de vastgelegde voorkeuren'),previewButton=node('button','secondary-button','Exacte inhoud bekijken'),previewBody=node('div'),search=node('input'),searchLabel=node('label','','Beoordelaar zoeken'),searchButton=node('button','secondary-button','Beoordelaars zoeken'),reviewer=node('select'),reviewerLabel=node('label','','Bevoegde beoordelaar'),reason=node('textarea'),reasonLabel=node('label','','Reden voor beoordeling'),confirm=node('input'),confirmLabel=node('label','','Ik bevestig deze inhoud en ontvangers'),submit=node('button','primary-button','Beoordeling aanvragen');let plan=null,key=crypto.randomUUID(),previous=null,previewGeneration=0,searchGeneration=0;
          purpose.required=true;purpose.maxLength=100;purposeLabel.append(purpose);previewButton.type='button';search.type='search';search.maxLength=100;searchLabel.append(search);searchButton.type='button';reviewer.required=true;reviewerLabel.append(reviewer);reason.required=true;reason.maxLength=1000;reasonLabel.append(reason);confirm.type='checkbox';confirm.required=true;confirmLabel.append(confirm);submit.type='submit';submit.disabled=true;
          const clearReviewers=()=>{const option=node('option','','Kies een beoordelaar');option.value='';replaceChildren(reviewer,[option]);};clearReviewers();
          form.append(purposeLabel,previewButton,previewBody,searchLabel,searchButton,reviewerLabel,reasonLabel,confirmLabel,submit);panel.append(form);
          purpose.addEventListener('input',()=>{previewGeneration++;searchGeneration++;plan=null;submit.disabled=true;clearReviewers();replaceChildren(previewBody,[]);});
          previewButton.addEventListener('click',async()=>{previewButton.disabled=true;const selectedPurpose=purpose.value,generation=++previewGeneration;plan=null;submit.disabled=true;try{const value=await call(route+'/preview?purpose='+encodeURIComponent(selectedPurpose));if(!currentView()||generation!==previewGeneration||purpose.value!==selectedPurpose)return;plan=value;replaceChildren(previewBody,[node('p','',`Van: ${value.from} · Aan: ${value.snapshot.to.join(', ')} · Cc: ${(value.snapshot.cc||[]).join(', ')||'geen'}`),node('h5','',value.snapshot.title),node('pre','',value.snapshot.content),node('p','',`Bijlagen: ${value.snapshot.attachments.map(file=>file.name).join(', ')||'geen'}`)]);appendReplyContext(value.snapshot,previewBody);submit.disabled=false;}catch(error){if(currentView()&&generation===previewGeneration){plan=null;submit.disabled=true;notice.textContent=friendlyError(error);}}finally{previewButton.disabled=false;}});
          searchButton.addEventListener('click',async()=>{searchButton.disabled=true;const selectedPurpose=purpose.value,selectedQuery=search.value,generation=++searchGeneration;try{const found=await call(route+'/reviewers?'+new URLSearchParams({q:selectedQuery,purpose:selectedPurpose}));if(!currentView()||generation!==searchGeneration||purpose.value!==selectedPurpose||search.value!==selectedQuery)return;clearReviewers();for(const member of found.items){const option=node('option','',member.display_name);option.value=member.id;reviewer.append(option);}notice.textContent=found.items.length?(found.search_window_limited?'Verfijn de naam om andere bevoegde beoordelaars te vinden.':'Kies de beoordelaar die deze inhoud mag beoordelen.'):'Geen bevoegde beoordelaars gevonden.';}catch(error){if(currentView()&&generation===searchGeneration)notice.textContent=friendlyError(error);}finally{searchButton.disabled=false;}});
          form.addEventListener('submit',async event=>{event.preventDefault();if(!currentView())return;submit.disabled=true;try{if(!plan||!reviewer.value)throw new Error('Bekijk de actuele inhoud en kies een beoordelaar.');const encoded=JSON.stringify({purpose:plan.purpose,expected_revision:plan.draft_revision,preview_fingerprint:plan.preview_fingerprint,reviewer_id:reviewer.value,reason:reason.value,confirm:confirm.checked});if(previous!==null&&encoded!==previous)key=crypto.randomUUID();previous=encoded;await call(route,{method:'POST',headers:{'idempotency-key':key},body:encoded});await redraw();}catch(error){notice.textContent=friendlyError(error);submit.disabled=!plan;}});
        }
      }catch(error){notice.textContent=friendlyError(error);loaded=false;}
    });
  }

  async function zeroCommunicationRequest(source,route,options={},alive=()=>true){
    if(!alive())throw Error('De gekozen Communication-bron is niet meer actief.');const url=new URL(route,location.origin),method=options.method||'GET',input=options.body?JSON.parse(options.body):Object.fromEntries(url.searchParams);let action;
    if(source.kind==='draft'){
      const recoveryPrefix='/api/communication/drafts/'+encodeURIComponent(source.id)+'/submissions/',recoveryMatch=url.pathname.startsWith(recoveryPrefix)?url.pathname.slice(recoveryPrefix.length).match(/^([^/]+)\/reconcile$/):null;if(method==='POST'&&recoveryMatch){action={operation:'RECONCILE',draft_id:source.id,submission_id:decodeURIComponent(recoveryMatch[1]),input};}else{
      const prefix='/api/communication/drafts/'+encodeURIComponent(source.id)+'/send-reviews';if(!url.pathname.startsWith(prefix))throw Error('Deze actie hoort niet bij het geselecteerde concept.');const suffix=url.pathname.slice(prefix.length);let operation,review_id;
      if(method==='GET'&&suffix==='')operation='REVIEW_LIST';else if(method==='GET'&&suffix==='/preview')operation='SEND_PREVIEW';else if(method==='GET'&&suffix==='/reviewers')operation='REVIEWERS';else if(method==='POST'&&suffix==='')operation='PREPARE_REVIEW';else{const match=suffix.match(/^\/([^/]+)\/(approve|cancel|submit)$/);if(method!=='POST'||!match)throw Error('Deze Communication-actie is niet beschikbaar.');operation={approve:'DECIDE_REVIEW',cancel:'CANCEL_REVIEW',submit:'SUBMIT'}[match[2]];review_id=decodeURIComponent(match[1]);}
      action={operation,draft_id:source.id,...(review_id?{review_id}:{}),input};}
    }else if(source.kind==='template'){
      const prefix='/api/communication/templates/'+encodeURIComponent(source.id);if(method==='POST'&&url.pathname===prefix+'/draft-preview')action={operation:'TEMPLATE_PREVIEW',template_id:source.id,input};else if(method==='POST'&&url.pathname===prefix+'/drafts')action={operation:'CREATE_TEMPLATE_DRAFT',template_id:source.id,input};else throw Error('Deze actie hoort niet bij het geselecteerde sjabloon.');
    }else{
      const prefix='/api/communication/messages/'+encodeURIComponent(source.id);if(url.pathname===prefix+'/delivery-report'&&method==='GET')action={operation:'DELIVERY_REPORT',message_id:source.id,input};else if(url.pathname===prefix+'/draft-preview'&&method==='GET')action={operation:'REPLY_PREVIEW',message_id:source.id,input};else if(url.pathname===prefix+'/drafts'&&method==='POST')action={operation:'CREATE_REPLY',message_id:source.id,input};else throw Error('Deze actie hoort niet bij het geselecteerde bericht.');
    }
    const names={DELIVERY_REPORT:'Onderzoek deze bewaarde bezorgmelding zonder verzendstatus te wijzigen',TEMPLATE_PREVIEW:'Bekijk het sjabloon met mijn expliciete waarden',CREATE_TEMPLATE_DRAFT:'Bewaar mijn bevestigde interne sjabloonconcept',RECONCILE:'Herstel de verzenduitkomst uit het bewaarde bewijs zonder mail te verzenden',REVIEW_LIST:'Bekijk de actuele mailbeoordelingen',SEND_PREVIEW:'Bekijk de exacte mailinhoud',REVIEWERS:'Zoek een bevoegde mailbeoordelaar',PREPARE_REVIEW:'Vraag de bevestigde mailbeoordeling aan',DECIDE_REVIEW:'Leg mijn bevestigde beoordeling vast',CANCEL_REVIEW:'Trek mijn bevestigde mailbeoordeling in',SUBMIT:'Bied deze exact goedgekeurde mail extern aan',REPLY_PREVIEW:'Bekijk de bron voor dit antwoordconcept',CREATE_REPLY:'Bewaar dit expliciete antwoordconcept'};
    const result=await request('/api/zero/turn',{method:'POST',body:JSON.stringify({message:names[action.operation],conversation_id:source.conversation_id||state.conversationId,turn_id:options.headers?.['idempotency-key']||crypto.randomUUID(),preferred_module:'communication',client_context:{communication_action:action}})});
    if(!alive())throw Error('De gekozen Communication-bron is niet meer actief.');source.conversation_id=result.conversation_id;state.conversationId=result.conversation_id||state.conversationId;byId('zeroOutput').textContent=result.display_text||result.answer;if(!result.communication_data)throw Error('De actuele Communication-uitkomst is niet beschikbaar.');return result.communication_data;
  }
  function appendZeroCommunication(record,cell,content,kind){
    const button=node('button','secondary-button',kind==='template'?'Met ZERO invullen':kind==='draft'?'Met ZERO beoordelen':'Met ZERO beantwoorden');button.type='button';cell.append(button);
    button.addEventListener('click',()=>{
      if(!content.isConnected||state.workspaceId!=='communication')return;const host=byId('zeroActions');if(!host)return;const token=state.communicationZeroToken=(state.communicationZeroToken||0)+1,source={id:record.id,kind},section=state.activeSection,alive=()=>content.isConnected&&state.workspaceId==='communication'&&state.activeSection===section&&state.communicationZeroToken===token;
      const mount=()=>{if(!alive())return;replaceChildren(host,[node('h3','',kind==='template'?'Sjabloon invullen met ZERO':kind==='draft'?'Mail beoordelen met ZERO':'Antwoord voorbereiden met ZERO'),node('p','',record.title||'Onderwerp niet beschikbaar')]);const options={alive,request:(route,input)=>zeroCommunicationRequest(source,route,input,alive),onComplete:mount};if(kind==='template')appendTemplateDraft(record,host,content,options);else if(kind==='draft')appendSendReviews(record,host,content,options);else appendMessageDraftActions(record,host,content,options);host.querySelector('details').open=true;};mount();host.scrollIntoView?.({block:'nearest'});
    });
  }

  function appendDraftComments(record,cell,content){
    const details=node('details'),status=node('p'),items=node('div'),controls=node('div');details.append(node('summary','','Interne reacties'),status,items,controls);cell.append(details);status.setAttribute('role','status');
    const route=`/api/communication/drafts/${encodeURIComponent(record.id)}/comments`,alive=()=>content.isConnected&&details.isConnected&&state.workspaceId==='communication'&&state.activeSection.toLowerCase()==='drafts';let generation=0;
    async function load(offset=0){const version=++generation;status.textContent='Reacties laden…';try{const model=await request(route+'?offset='+offset);if(!alive()||version!==generation)return;replaceChildren(items,[]);replaceChildren(controls,[]);status.textContent=`${model.total} bewaarde interne reacties · conceptrevisie ${model.current_draft_revision}`;
      const form=node('form'),text=node('textarea'),reply=node('select'),send=node('button','primary-button','Reactie plaatsen');text.required=true;text.maxLength=4000;reply.append(node('option','','Geen antwoord op een reactie'));reply.firstChild.value='';send.type='submit';
      for(const row of model.items){const article=node('article');article.append(node('p','',`${row.author_name} · bij conceptrevisie ${row.source_revision}${row.reply_to_id?' · antwoord op een eerdere reactie':''}`),node('pre','',row.status==='WITHDRAWN'?'Reactie ingetrokken door de auteur.':row.content));items.append(article);const option=node('option','',`${row.author_name}: ${row.status==='WITHDRAWN'?'Ingetrokken reactie':row.content.slice(0,80)}`);option.value=row.id;reply.append(option);
        if(row.can_withdraw){const withdraw=node('form'),reason=node('textarea'),confirm=node('input'),button=node('button','secondary-button','Mijn reactie intrekken');reason.required=true;reason.maxLength=1000;confirm.type='checkbox';confirm.required=true;for(const [labelText,input] of [['Reden voor intrekken',reason],['Ik trek mijn reactie in; het origineel blijft bewaard',confirm]]){const label=node('label','',labelText);label.append(input);withdraw.append(label);}button.type='submit';withdraw.append(button);article.append(withdraw);let key=crypto.randomUUID(),previous=null;
          withdraw.addEventListener('submit',async event=>{event.preventDefault();if(!alive()||!confirm.checked||!reason.value.trim())return;button.disabled=true;const body=JSON.stringify({expected_draft_revision:model.current_draft_revision,expected_comment_revision:row.revision,confirm:true,reason:reason.value.trim()});if(previous!==null&&previous!==body)key=crypto.randomUUID();previous=body;try{await request(route+'/'+encodeURIComponent(row.id)+'/withdraw',{method:'POST',headers:{'idempotency-key':key},body});if(alive())await load(offset);}catch(error){if(alive()){status.textContent=friendlyError(error);button.disabled=false;}}});}
      }
      if(model.can_comment){for(const [labelText,input] of [['Interne reactie',text],['Antwoorden op',reply]]){const label=node('label','',labelText);label.append(input);form.append(label);}form.append(node('small','','Deze reactie is alleen zichtbaar voor huidige medebewerkers en wordt niet verzonden.'),send);controls.append(form);let key=crypto.randomUUID(),previous=null;
        form.addEventListener('submit',async event=>{event.preventDefault();if(!alive()||!text.value.trim())return;send.disabled=true;const body=JSON.stringify({content:text.value.trim(),reply_to_id:reply.value||null,expected_draft_revision:model.current_draft_revision});if(previous!==null&&previous!==body)key=crypto.randomUUID();previous=body;try{await request(route,{method:'POST',headers:{'idempotency-key':key},body});if(alive())await load(offset);}catch(error){if(alive()){status.textContent=friendlyError(error);send.disabled=false;}}});}
      if(offset){const previous=node('button','secondary-button','Vorige reacties');previous.type='button';previous.addEventListener('click',()=>load(Math.max(0,offset-model.limit)));controls.append(previous);}
      if(model.next_offset!==null){const next=node('button','secondary-button','Volgende reacties');next.type='button';next.addEventListener('click',()=>load(model.next_offset));controls.append(next);}
    }catch(error){if(alive()&&version===generation){replaceChildren(items,[]);replaceChildren(controls,[]);status.textContent=friendlyError(error);}}}
    const refresh=node('button','secondary-button','Reacties vernieuwen');refresh.type='button';refresh.addEventListener('click',()=>load());details.append(refresh);details.addEventListener('toggle',async()=>{if(details.open)await load();else generation++;});
  }

  function appendDraftEditor(record,cell,content){
    const details=node('details'),status=node('p'),preview=node('pre'),controls=node('div'),editor=node('form'),notice=node('p'),fields=new Map();details.append(node('summary','','Samen bewerken'),status,preview,controls,editor,notice);cell.append(details);status.setAttribute('role','status');notice.setAttribute('role','status');
    const route=`/api/communication/drafts/${encodeURIComponent(record.id)}`,alive=()=>content.isConnected&&details.isConnected&&state.workspaceId==='communication'&&state.activeSection.toLowerCase()==='drafts';
    let model=null,token=null,grant=null,timer=null,busy=false,dirty=false,loaded=false,sequence=0,lastRenew=0,workingRevision=null,controlsSignature=null;
    for(const [name,title,tag] of [['title','Titel','input'],['content','Inhoud','textarea'],['description','Omschrijving','textarea'],['to','Aan, gescheiden door komma’s','input'],['cc','Cc, gescheiden door komma’s','input']]){const label=node('label','',title),input=node(tag);input.maxLength=name==='title'?1000:12000;input.required=['title','content'].includes(name);label.append(input);editor.append(label);fields.set(name,input);input.addEventListener('input',()=>{dirty=true;});}
    const save=node('button','primary-button','Werktekst als concept opslaan');save.type='submit';editor.append(save);editor.hidden=true;
    function lock(){token=null;grant=null;for(const input of fields.values())input.disabled=true;save.disabled=true;}
    function handleError(error){lock();if([401,403,404].includes(error.status)){fill({});editor.hidden=true;preview.textContent='';replaceChildren(controls,[]);controlsSignature=null;}return friendlyError(error);}
    function fill(copy){for(const [name,input] of fields)input.value=Array.isArray(copy?.[name])?copy[name].join(', '):String(copy?.[name]||'');dirty=false;}
    function values(){return Object.fromEntries([...fields].map(([name,input])=>[name,['to','cc'].includes(name)?input.value.split(',').map(value=>value.trim()).filter(Boolean):input.value]));}
    function stop(){if(timer)clearTimeout(timer);timer=null;}
    function schedule(){stop();if(alive()&&details.open)timer=setTimeout(tick,2000);}
    function draw(){if(!model)return;status.textContent=model.active?`${model.holder_name} bewerkt dit concept · sessie geldig tot ${new Date(model.expires_at).toLocaleTimeString((globalThis.FoundlyI18n?.locale||'nl-NL'))}`:'Er is geen actieve bewerkingssessie.';
      preview.textContent=model.working_copy?`Gedeelde werktekst · ${model.working_copy_saved?'komt overeen met de opgeslagen conceptrevisie':'nog niet als concept opgeslagen'}${model.working_copy_current?'':' · hoort bij een eerdere conceptrevisie'}\n${model.working_copy.title||''}\n${model.working_copy.content||''}`:'Er is nog geen gedeelde werktekst.';
      if(token&&(!model.active||model.grant_id!==grant)){lock();notice.textContent='Je sessie is verlopen of overgenomen. Je lokale tekst blijft hieronder staan; bekijk de actuele werktekst voordat je opnieuw overneemt.';}
      const signature=JSON.stringify([model.active,model.grant_id,model.can_write,Boolean(token)]);if(signature===controlsSignature)return;controlsSignature=signature;replaceChildren(controls,[]);if(!model.can_write)return;
      const form=node('form'),reason=node('textarea'),confirm=node('input'),kind=token?'release':model.active?'takeover':'claim',button=node('button','secondary-button',kind==='release'?'Bewerking vrijgeven':kind==='takeover'?'Bewerking overnemen':'Bewerking starten');reason.required=true;reason.maxLength=1000;confirm.type='checkbox';confirm.required=true;
      for(const [title,input] of [['Reden',reason],[kind==='takeover'?'Ik neem de actuele werktekst over; de vorige editor kan daarna niet meer opslaan':kind==='release'?'Ik geef de bewerking vrij; werktekst blijft bewaard':'Ik start een bewerkingssessie',confirm]]){const label=node('label','',title);label.append(input);form.append(label);}button.type='submit';form.append(button);controls.append(form);
      let key=crypto.randomUUID(),previous=null;form.addEventListener('submit',async event=>{event.preventDefault();if(!alive()||busy||!confirm.checked||!reason.value.trim())return;busy=true;button.disabled=true;const body=JSON.stringify({expected_lease_revision:model.revision,expected_draft_revision:model.current_draft_revision,confirm:true,reason:reason.value.trim()});if(previous!==null&&previous!==body)key=crypto.randomUUID();previous=body;try{const result=await request(route+'/edit-session/'+kind,{method:'POST',headers:{'idempotency-key':key,...(token?{'x-communication-edit-token':token}:{})},body});if(!alive())return;model=result;token=result.edit_token||null;grant=result.grant_id;lastRenew=Date.now();if(token){const current=await request(route);if(!alive())return;if(current.record.revision!==model.current_draft_revision)throw new Error('Het concept is gewijzigd tijdens het starten; vernieuw de status.');fill(model.working_copy_current&&model.working_copy?model.working_copy:current.record);workingRevision=current.record.revision;editor.hidden=false;for(const input of fields.values())input.disabled=false;save.disabled=false;notice.textContent='Wijzigingen worden als gedeelde werktekst zichtbaar. Alleen Opslaan maakt een nieuwe conceptrevisie.';}else{lock();notice.textContent='Bewerking vrijgegeven. De gedeelde werktekst blijft bewaard.';}draw();}catch(error){if(alive())notice.textContent=handleError(error);}finally{busy=false;if(alive())button.disabled=false;schedule();}});
    }
    async function refresh(){const version=++sequence;try{const next=await request(route+'/edit-session');if(!alive()||!details.open||version!==sequence)return;model=next;draw();loaded=true;}catch(error){if(alive()&&version===sequence){status.textContent=handleError(error);}}}
    async function tick(){timer=null;if(!alive()||!details.open)return;if(busy){schedule();return;}busy=true;try{if(token&&(dirty||Date.now()-lastRenew>=20000)){
      const copy=values(),sentDirty=dirty;const result=await request(route+'/edit-session/renew',{method:'POST',headers:{'idempotency-key':crypto.randomUUID(),'x-communication-edit-token':token},body:JSON.stringify({expected_lease_revision:model.revision,expected_draft_revision:workingRevision,...(sentDirty?{working_copy:copy}:{})})});if(!alive())return;model=result;lastRenew=Date.now();if(JSON.stringify(values())===JSON.stringify(copy))dirty=false;draw();
    }else await refresh();}catch(error){if(alive()){notice.textContent=handleError(error)+' Je lokale tekst blijft behouden. Vernieuw de status voordat je verdergaat.';}}finally{busy=false;schedule();}}
    editor.addEventListener('submit',async event=>{event.preventDefault();if(!alive()||busy||!token)return;busy=true;save.disabled=true;for(const input of fields.values())input.disabled=true;stop();try{const result=await request(route,{method:'PUT',headers:{'idempotency-key':crypto.randomUUID(),'x-communication-edit-token':token},body:JSON.stringify({...values(),expected_revision:workingRevision})});if(!alive())return;workingRevision=result.record.revision;dirty=false;model=await request(route+'/edit-session/renew',{method:'POST',headers:{'idempotency-key':crypto.randomUUID(),'x-communication-edit-token':token},body:JSON.stringify({expected_lease_revision:model.revision,expected_draft_revision:workingRevision,working_copy:values()})});if(!alive())return;lastRenew=Date.now();notice.textContent=`Conceptrevisie ${workingRevision} opgeslagen. Er is niets verzonden.`;draw();}catch(error){if(alive()){notice.textContent=handleError(error)+' Je lokale tekst blijft behouden.';}}finally{busy=false;if(token){save.disabled=false;for(const input of fields.values())input.disabled=false;}schedule();}});
    const reload=node('button','secondary-button','Bewerkingsstatus vernieuwen');reload.type='button';reload.addEventListener('click',async()=>{if(busy||!alive())return;busy=true;try{await refresh();}finally{busy=false;schedule();}});details.append(reload);
    details.addEventListener('toggle',async()=>{stop();if(!details.open){sequence++;return;}if(!loaded)await refresh();else if(!busy)await refresh();schedule();});
  }

  function appendDraftAttachments(record,cell,content){
    const sizeLabel=bytes=>!Number.isSafeInteger(bytes)||bytes<1?'onbekend':bytes%(1024*1024)===0?`${bytes/(1024*1024)} MiB`:bytes%1024===0?`${bytes/1024} KiB`:`${bytes} bytes`;
    const details=node('details'),panel=node('div'),notice=node('p');notice.setAttribute('role','status');details.append(node('summary','','Bijlagen'),panel,notice);cell.append(details);
    const route=`/api/communication/drafts/${encodeURIComponent(record.id)}/attachments`;const alive=()=>content.isConnected&&details.isConnected&&state.workspaceId==='communication'&&state.activeSection.toLowerCase()==='drafts';let loaded=false;
    const reload=async()=>{
      const model=await request(route);if(!alive())return;replaceChildren(panel,[]);
      panel.append(node('p','',`Tekst tot ${sizeLabel(model.max_bytes)}; PDF, PNG, JPEG en Office-documenten tot ${sizeLabel(model.max_binary_bytes)} vereisen een lokale malwarecontrole. Maximaal ${model.max_current} bijlagen en ${sizeLabel(model.max_current_bytes)} per concept. Bestanden worden niet inline geopend of verzonden. Geef een actieve bewerking vrij voordat je bijlagen wijzigt.`));
      if(!model.items.length)panel.append(node('p','','Dit concept heeft geen bijlagen.'));
      const redraw=async()=>{if(content.isConnected&&state.workspaceId==='communication'&&state.activeSection.toLowerCase()==='drafts')await renderDomainSection('drafts',content);};
      for(const attachment of model.items){
        const item=node('article','context-item'),download=node('button','secondary-button',attachment.validation==='SIGNATURE_AND_LOCAL_CLAMAV'?'Bestand downloaden':'Tekstbestand downloaden');download.type='button';download.setAttribute('aria-label',`${attachment.name} downloaden`);item.append(node('p','',`${attachment.name} · ${attachment.size_bytes} bytes`),download);panel.append(item);item.append(node('small','',attachment.validation==='SIGNATURE_AND_LOCAL_CLAMAV'?`Malwarecontrole: geen dreiging gedetecteerd op ${attachment.scan_observed_at}; dit is geen veiligheidsgarantie.`:'Tekstbijlage; geen malwarecontrole uitgevoerd.'));
        download.addEventListener('click',async()=>{
          if(!alive())return;download.disabled=true;let href;
          try{
            const result=await request(route+'/'+encodeURIComponent(attachment.id)),value=result.attachment,bytes=Uint8Array.from(atob(value.content_base64),char=>char.charCodeAt(0)),actual=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),byte=>byte.toString(16).padStart(2,'0')).join('');
            if(!alive())return;if(actual!==value.sha256||bytes.length!==value.size_bytes)throw new Error('De bijlage kon niet worden geverifieerd.');
            href=URL.createObjectURL(new Blob([bytes],{type:value.validation==='SIGNATURE_AND_LOCAL_CLAMAV'?'application/octet-stream':'text/plain;charset=utf-8'}));const link=node('a');link.href=href;link.download=value.name;document.body.append(link);link.click();link.remove();notice.textContent='Bestand gedownload.';
          }catch(error){notice.textContent=friendlyError(error);}finally{download.disabled=false;if(href)setTimeout(()=>URL.revokeObjectURL(href),1000);}
        });
        if(model.can_write){const remove=node('button','secondary-button','Uit concept verwijderen');remove.type='button';remove.setAttribute('aria-label',`${attachment.name} uit concept verwijderen`);item.append(remove);const key=crypto.randomUUID();remove.addEventListener('click',async()=>{if(!alive())return;remove.disabled=true;try{await request(route+'/detach',{method:'POST',headers:{'idempotency-key':key},body:JSON.stringify({attachment_id:attachment.id,expected_revision:model.current_revision})});await redraw();if(!alive())return;notice.textContent='Bijlage verwijderd uit het huidige concept; de geschiedenis blijft bewaard.';}catch(error){notice.textContent=friendlyError(error);remove.disabled=false;}});}
      }
      if(model.can_write){
        const form=node('form'),file=node('input'),label=node('label','','Bestand kiezen'),submit=node('button','primary-button','Bijlage opslaan');file.type='file';file.accept=(model.accepted_extensions||['.txt']).join(',');file.required=true;submit.type='submit';submit.disabled=model.items.length>=model.max_current;label.append(file);form.append(label,submit);panel.append(form);let key=crypto.randomUUID(),lastPayload=null;
        form.addEventListener('submit',async event=>{
          event.preventDefault();if(!alive())return;submit.disabled=true;
          try{
            const selected=file.files?.[0],isText=/\.txt$/i.test(selected?.name||''),limit=isText?model.max_bytes:model.max_binary_bytes;if(!selected||!Number.isFinite(limit)||selected.size>limit)throw new Error(`Kies een ondersteund bestand van maximaal ${sizeLabel(limit)}.`);
            const bytes=new Uint8Array(await selected.arrayBuffer());if(!alive())return;let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);
            const encoded=JSON.stringify({name:selected.name,content_base64:btoa(binary),expected_revision:model.current_revision});if(lastPayload!==null&&lastPayload!==encoded)key=crypto.randomUUID();lastPayload=encoded;
            await request(route,{method:'POST',headers:{'idempotency-key':key},body:encoded});await redraw();if(!alive())return;notice.textContent='Bijlage bij het concept opgeslagen.';
          }catch(error){notice.textContent=friendlyError(error);submit.disabled=false;}
        });
      }
    };
    details.addEventListener('toggle',async()=>{if(!details.open||loaded)return;loaded=true;notice.textContent='Bijlagen laden…';try{await reload();if(alive())notice.textContent='Downloads behouden de originele bytes. Een scan is geen veiligheidsgarantie.';}catch(error){notice.textContent=friendlyError(error);loaded=false;}});
  }

  function appendDraftCollaboration(record,cell,content){
    const details=node('details'),summary=node('summary','','Delen en versiegeschiedenis'),body=node('div'),notice=node('p');
    notice.setAttribute('role','status');details.append(summary,body,notice);cell.append(details);
    const route=`/api/communication/drafts/${encodeURIComponent(record.id)}`;
    let loaded=false,model=null;
    const actionForm=(buttonLabel,submitAction)=>{
      const form=node('form'),reason=node('textarea'),reasonLabel=node('label','','Reden'),confirm=node('input'),confirmLabel=node('label','','Ik bevestig deze wijziging'),submit=node('button','primary-button',buttonLabel);
      const expectedRevision=model.current_revision;
      let key=crypto.randomUUID(),previousInput=null;
      reason.required=true;reason.maxLength=1000;confirm.type='checkbox';confirm.required=true;submit.type='submit';
      reasonLabel.append(reason);confirmLabel.append(confirm);form.append(reasonLabel,confirmLabel,submit);
      form.addEventListener('submit',async event=>{
        event.preventDefault();submit.disabled=true;
        try{
          const input={reason:reason.value,confirm:confirm.checked,expected_revision:expectedRevision},signature=JSON.stringify(input);
          if(previousInput!==null&&signature!==previousInput)key=crypto.randomUUID();previousInput=signature;
          await submitAction(input,key);
          if(content.isConnected&&state.workspaceId==='communication'&&state.activeSection.toLowerCase()==='drafts')await renderDomainSection('drafts',content);
        }catch(error){notice.textContent=friendlyError(error);submit.disabled=false;}
      });return form;
    };
    const appendPage=page=>{
      for(const version of page.items){
        const item=node('article','context-item'),preview=node('button','secondary-button','Revisie bekijken'),previewBody=node('div');preview.type='button';
        item.append(node('h4','',`Revisie ${version.draft_revision??'onbekend'} · ${version.title||record.title}`),node('p','',version.change_reason||version.capture_kind),preview,previewBody);body.append(item);
        preview.addEventListener('click',async()=>{
          preview.disabled=true;
          try{
            const result=await request(`/api/communication/draft_revisions/${encodeURIComponent(version.id)}`),snapshot=result.record.snapshot;
            replaceChildren(previewBody,[node('h5','',snapshot.title||'Ouder concept'),node('pre','',snapshot.content||''),node('p','',`Aan: ${(snapshot.to||[]).join(', ')||'niet opgegeven'} · Cc: ${(snapshot.cc||[]).join(', ')||'geen'}`)]);
            previewBody.append(node('p','',`Bijlagen: ${(snapshot.attachments||[]).map(item=>item.name).join(', ')||'geen'}`));
            if(model.can_write&&Number.isSafeInteger(version.draft_revision))previewBody.append(actionForm('Deze inhoud als nieuwe revisie herstellen',(input,key)=>request(route+'/restore',{method:'POST',headers:{'idempotency-key':key},body:JSON.stringify({...input,source_revision:version.draft_revision})})));
          }catch(error){notice.textContent=friendlyError(error);preview.disabled=false;}
        });
      }
      if(page.next_offset!==null){
        const more=node('button','secondary-button','Meer revisies');more.type='button';body.append(more);
        more.addEventListener('click',async()=>{
          more.disabled=true;
          try{
            const next=await request(route+`/revisions?offset=${page.next_offset}`);
            if(next.current_revision!==model.current_revision)throw new Error('Het concept is gewijzigd. Open de concepten opnieuw om de actuele geschiedenis te laden.');
            more.remove();appendPage(next);
          }catch(error){notice.textContent=friendlyError(error);more.disabled=false;}
        });
      }
    };
    const appendSharing=()=>{
      const selected=new Map(model.collaborators.map(member=>[member.id,member.display_name])),chosen=node('div'),search=node('input'),label=node('label','','Medebewerker zoeken'),searchButton=node('button','secondary-button',(globalThis.FoundlyI18n?globalThis.FoundlyI18n.t("static.23d150c5"):'Zoeken')),results=node('div');
      search.type='search';search.maxLength=100;searchButton.type='button';label.append(search);
      const redraw=()=>{
        replaceChildren(chosen,[]);
        for(const [id,name] of selected){const row=node('p','',name+' '),remove=node('button','secondary-button',(globalThis.FoundlyI18n?globalThis.FoundlyI18n.t("static.f69c8424"):'Verwijderen'));remove.type='button';remove.setAttribute('aria-label',`${name} verwijderen`);remove.addEventListener('click',()=>{selected.delete(id);redraw();});row.append(remove);chosen.append(row);}
        if(!selected.size)chosen.append(node('p','','Alleen de eigenaar en bevoegde beheerders hebben toegang.'));
      };
      let shareSignature=null,shareKey=null;
      const form=actionForm('Toegang bijwerken',(input,key)=>{
        const payload={...input,collaborator_ids:[...selected.keys()]},signature=JSON.stringify(payload);
        if(signature!==shareSignature){shareSignature=signature;shareKey=crypto.randomUUID();}
        return request(route+'/collaborators',{method:'POST',headers:{'idempotency-key':shareKey},body:JSON.stringify(payload)});
      });
      form.prepend(chosen,label,searchButton,results);
      form.append(node('small','','Delen geeft toegang tot dit concept en zijn geschiedenis. Bewerken vereist eigen Communication-schrijfrechten. Verwijder medebewerkers en sla op om hun toegang in te trekken.'));
      search.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();searchButton.click();}});
      searchButton.addEventListener('click',async()=>{
        searchButton.disabled=true;
        try{
          const found=await request(route+'/collaborator-options?q='+encodeURIComponent(search.value.trim()));replaceChildren(results,[]);
          for(const member of found.items){const choose=node('button','secondary-button',member.display_name);choose.type='button';choose.disabled=selected.has(member.id);choose.addEventListener('click',()=>{if(selected.size>=20){notice.textContent='Kies maximaal twintig medebewerkers.';return;}selected.set(member.id,member.display_name);choose.disabled=true;redraw();});results.append(choose);}
          results.append(node('p','',found.has_more?'Verfijn je zoekopdracht om meer medebewerkers te vinden.':found.items.length?'':'Geen actieve medebewerkers gevonden.'));
        }catch(error){notice.textContent=friendlyError(error);}finally{searchButton.disabled=false;}
      });redraw();body.append(form);
    };
    details.addEventListener('toggle',async()=>{
      if(!details.open||loaded)return;loaded=true;notice.textContent='Geschiedenis laden…';
      try{
        model=await request(route+'/revisions');replaceChildren(body,[]);
        notice.textContent=`${model.total} bewaarde revisies. Herstellen bewaart de huidige toegangsrechten en verzendt niets.`;
        if(model.can_share)appendSharing();appendPage(model);
      }catch(error){notice.textContent=friendlyError(error);loaded=false;}
    });
  }

  function appendCommunicationDeliveryReport(record,body,alive){
    if(record.direction!=='INBOUND'||record.provider_transport!=='IMAP')return;
    const panel=node('section'),native=node('button','secondary-button','Bezorgmelding onderzoeken'),zero=node('button','secondary-button','Bezorgmelding met ZERO onderzoeken'),notice=node('p'),result=node('div'),source={id:record.id,kind:'message'};let busy=false;
    native.type=zero.type='button';notice.setAttribute('role','status');panel.append(native,zero,notice,result);body.append(panel);
    async function load(useZero){if(busy||!alive())return;busy=true;native.disabled=zero.disabled=true;replaceChildren(result,[]);notice.textContent='Bewaarde bron controleren…';try{
      const route='/api/communication/messages/'+encodeURIComponent(record.id)+'/delivery-report',model=useZero?await zeroCommunicationRequest(source,route,{},alive):await request(route);
      if(!alive())return;if(model.source_revision!==record.revision)throw Error('Het bericht is gewijzigd. Open de actuele bron opnieuw.');
      if(!model.report?.available){notice.textContent='Bezorgmelding niet beschikbaar: '+(model.report?.reason||'ONBEKEND');return;}
      notice.textContent='Onbevestigde bezorgmelding. Afzender en daadwerkelijke bezorging zijn niet geverifieerd. De verzendstatus en voorkeuren blijven ongewijzigd.';
      result.append(node('p','',model.correlation.status),node('p','',model.report.reporting_mta));
      for(const row of model.report.recipients)result.append(node('pre','',`${row.original_recipient?'Oorspronkelijk: '+row.original_recipient+' · ':''}Laatste ontvanger: ${row.final_recipient} · ${row.action} · ${row.status} · ${row.recipient_match===true?'exacte ontvanger':row.recipient_match===false?'ontvanger wijkt af':'koppeling onbekend'}\n${row.diagnostic||'Geen diagnose vermeld'}`));
      if(model.correlation.unreported_recipients?.length)result.append(node('p','',`Geen melding voor: ${model.correlation.unreported_recipients.join(', ')}`));
    }catch(error){if(alive()){replaceChildren(result,[]);notice.textContent=friendlyError(error);}}finally{busy=false;if(alive())native.disabled=zero.disabled=false;}}
    native.addEventListener('click',()=>load(false));zero.addEventListener('click',()=>load(true));
  }
  function appendCommunicationConversation(record,body,alive){
    const details=node('details'),panel=node('div'),status=node('p');status.setAttribute('role','status');details.append(node('summary','','Gerelateerde bewaarde berichten'),status,panel);body.append(details);let loaded=false,version=0;
    const load=async(offset=0)=>{const current=++version;status.textContent='Gesprek laden…';try{
      const result=await request(`/api/communication/messages/${encodeURIComponent(record.id)}/conversation?limit=25&offset=${offset}`);if(!alive()||current!==version)return;replaceChildren(panel,[]);status.textContent=`${result.total_retained_visible} zichtbare bewaarde berichten verbonden via onbevestigde mailheaders. Externe gespreksvolledigheid is onbekend. ${result.ambiguous_identifiers?'Dubbele bericht-ID’s worden niet samengevoegd.':''} ${result.headers_available?'':'Sommige headers zijn niet beschikbaar.'}`;
      panel.append(node('p','',`Genoemde adressen: ${result.participants.join(', ')||'niet beschikbaar'}. ${result.participants_complete?'':'Onvolledige deelnemersgegevens.'} Identiteiten zijn niet geverifieerd.`));
      for(const message of result.items){const item=node('details'),content=node('div'),notice=node('p');notice.setAttribute('role','status');item.append(node('summary','',message.title||'Onderwerp niet beschikbaar'),node('p','',`${message.from||'Afzender onbekend'} · ${message.received_at||message.sent_at||'Ontvangst/verzendtijd onbekend'}`),content,notice);panel.append(item);let opened=false;
        item.addEventListener('toggle',async()=>{if(!item.open||opened||!alive())return;opened=true;try{const view=await request('/api/communication/messages/'+encodeURIComponent(message.id)+'/view');if(!alive()||current!==version)return;if(view.record.revision!==message.revision)throw Error('Het bericht is gewijzigd. Laad het gesprek opnieuw.');const text=view.record.content;replaceChildren(content,[node('pre','',view.record.content_available!==false&&view.record.content_complete!==false&&typeof text==='string'?text:'Berichtinhoud niet beschikbaar')]);}catch(error){if(alive()&&current===version){notice.textContent=friendlyError(error);opened=false;}}});
      }
      for(const [label,next] of [['Vorige gespreksberichten',offset>0?Math.max(0,offset-25):null],['Volgende gespreksberichten',result.next_offset]])if(next!==null){const button=node('button','secondary-button',label);button.type='button';button.addEventListener('click',()=>load(next));panel.append(button);}
    }catch(error){if(alive()&&current===version){status.textContent=friendlyError(error);loaded=false;}}};details.addEventListener('toggle',()=>{if(!details.open||loaded||!alive())return;loaded=true;return load(0);});
  }
  function appendReplyContext(snapshot,panel){
    const reply=snapshot.reply_context;if(!reply)return;panel.append(node('p','',`${reply.mode==='REPLY'?'Antwoord':'Doorsturen'} op bewaard bronbericht ${reply.source_id}, revisie ${reply.source_revision}.`));
    panel.append(node('p','',reply.headers.available?(reply.headers.in_reply_to.length?'Antwoordverwijzing: '+reply.headers.in_reply_to.join(', '):'Er wordt geen In-Reply-To-header toegevoegd.'):'Gespreksheaders ontbreken of zijn niet ondersteund; externe gespreksgroepering is niet beschikbaar.'));
    if(reply.headers.references.length)panel.append(node('p','',`Gespreksverwijzingen: ${reply.headers.references.join(', ')}`));
  }

  function appendCommunicationMailOAuth(panel,alive,onRefresh){
    const details=node('details'),summary=node('summary','','Google-mailtoegang'),status=node('p'),controls=node('div');status.setAttribute('role','status');details.append(summary,status,controls);panel.append(details);let version=0,busy=false;
    const load=async()=>{const current=++version;replaceChildren(controls,[]);status.textContent='Mailtoegang laden…';try{const model=await request('/api/communication/mail-oauth');if(!alive()||current!==version)return;
      status.textContent=!model.selected?'Kies GOOGLE_OAUTH en vul de mail-clientgegevens in bij Connectors om Google-mailtoegang te koppelen.':!model.configured?'De mail-clientgegevens of het vaste retouradres zijn nog niet beschikbaar.':!model.grant_available?'Geen bruikbare mailtoestemming beschikbaar. Start een nieuwe toestemmingsaanvraag.':`${model.email}: mailtoestemming bewaard. ${model.access_token_current?'Token geldig tot '+model.expires_at+'.':'Het toegangstoken moet worden vernieuwd.'} SMTP-verificatie, inboxwaarnemingen en bezorging worden afzonderlijk vastgesteld.`;
      if(!model.configured||!model.can_manage)return;
      const action=(kind,title)=>{const form=node('form'),label=node('label','','Reden'),reason=node('input'),checkLabel=node('label'),confirm=node('input'),button=node('button','secondary-button',title);reason.required=true;reason.maxLength=1000;confirm.type='checkbox';confirm.required=true;button.type='submit';label.append(reason);checkLabel.append(confirm,node('span','',kind==='start'?'Ik bevestig dat ik bij Google expliciet mailtoegang wil verlenen.':kind==='disconnect'?'Ik bevestig het lokaal ontkoppelen. Toestemming bij Google wordt hierdoor niet ingetrokken.':'Ik bevestig het vernieuwen van deze mailtoegang.'));form.append(label,checkLabel,button);controls.append(form);let key=crypto.randomUUID(),previous=null;
        form.addEventListener('submit',async event=>{event.preventDefault();if(busy||!alive()||current!==version||!confirm.checked||!reason.value.trim())return;busy=true;for(const control of controls.querySelectorAll('button'))control.disabled=true;const payload=JSON.stringify({confirm:true,reason:reason.value.trim(),...(kind==='start'?{configuration_binding:model.configuration_binding}:{expected_revision:model.revision})});if(previous!==null&&previous!==payload)key=crypto.randomUUID();previous=payload;status.textContent='Mailtoegang verwerken…';try{const result=await request('/api/communication/mail-oauth/'+kind,{method:'POST',headers:{'idempotency-key':key},body:payload});if(!alive()||current!==version)return;if(kind==='start'){const target=new URL(result.authorization_url);if(target.origin!=='https://accounts.google.com'||target.pathname!=='/o/oauth2/v2/auth'||target.username||target.password||target.hash)throw Error('Het toestemmingsadres is niet verifieerbaar.');const link=node('a','primary-button','Doorgaan naar Google');link.href=target.href;link.rel='noreferrer';replaceChildren(controls,[link]);status.textContent='Verleen toestemming bij Google met deze Foundly-sessie actief. De algemene Google-koppeling blijft afzonderlijk.';}else{await onRefresh();if(alive()&&current===version)await load();}}catch(error){if(alive()&&current===version){status.textContent=friendlyError(error);const refresh=node('button','secondary-button','Mailtoegang opnieuw bekijken');refresh.type='button';refresh.addEventListener('click',()=>load());replaceChildren(controls,[refresh]);}}finally{busy=false;}});
      };action('start',model.grant_available?'Nieuwe mailtoestemming aanvragen':'Google-mailtoegang aanvragen');if(model.refresh_available)action('refresh','Mailtoegang vernieuwen');if(model.revision>0)action('disconnect','Mailtoegang lokaal ontkoppelen');
    }catch(error){if(alive()&&current===version)status.textContent=friendlyError(error);}};details.addEventListener('toggle',()=>{if(details.open&&alive()&&!busy)return load();});
  }

  async function renderCommunicationMailbox(panel,alive,onRefresh){
    const status=node('p'),controls=node('div');status.setAttribute('role','status');replaceChildren(panel,[node('h4','','Externe inbox ophalen'),status,controls]);
    const load=async()=>{
      status.textContent='Mailboxstatus laden…';replaceChildren(controls,[]);
      try{
        const model=await request('/api/communication/mailboxes');if(!alive())return;const current=model.current;
        status.textContent=!model.configured?'IMAP-ontvangst niet geconfigureerd. Stel de optionele IMAP-velden in bij Connectors.':!current?'Nog geen mailboxwaarneming beschikbaar.':current.status!=='OBSERVED'?'Mailboxwaarneming niet beschikbaar. Bewaarde berichten blijven afzonderlijk toegankelijk.':`${current.total_uids_observed} provideritems waargenomen op ${current.observed_at}; dit aantal omvat providerconcepten. ${current.coverage_complete?'Alle UID’s zijn tijdens deze leesscan waargenomen.':'De leesscan is onvolledig.'} ${current.observation_current?'':'Deze waarneming is verlopen of hoort bij een eerdere configuratie.'} Dit bewijst geen bezorging.`;
        if(!model.can_sync)return;
        const form=node('form'),label=node('label','','Reden voor ophalen'),reason=node('input'),confirmLabel=node('label',''),confirm=node('input'),button=node('button','secondary-button',current?.next_offset>0?'Volgende mailboxpagina ophalen':'Inbox alleen-lezen ophalen');reason.required=true;reason.maxLength=1000;confirm.type='checkbox';confirm.required=true;button.type='submit';label.append(reason);confirmLabel.append(confirm,node('span','','Ik bevestig het ophalen en lokaal bewaren; de providerinbox wordt niet gewijzigd.'));form.append(label,confirmLabel,button);controls.append(form);let busy=false,key=crypto.randomUUID(),previous=null;
        form.addEventListener('submit',async event=>{event.preventDefault();if(busy||!alive()||!confirm.checked||!reason.value.trim())return;busy=true;button.disabled=true;const payload=JSON.stringify({expected_revision:current?.revision||0,confirm:true,reason:reason.value.trim()});if(previous!==null&&previous!==payload)key=crypto.randomUUID();previous=payload;status.textContent='Mailboxpagina alleen-lezen ophalen…';try{await request('/api/communication/mailboxes/sync',{method:'POST',headers:{'idempotency-key':key},body:payload});if(!alive())return;await onRefresh();await load();}catch(error){if(alive()){status.textContent=friendlyError(error)+' Bekijk de actuele mailboxstatus voordat je opnieuw ophaalt.';const refresh=node('button','secondary-button','Mailboxstatus vernieuwen');refresh.type='button';refresh.addEventListener('click',()=>load());replaceChildren(controls,[refresh]);}}finally{busy=false;}});
      }catch(error){if(alive())status.textContent=friendlyError(error);}
    };await load();
  }
  function appendMailboxSourceDownload(record,body,status,alive){
    if(record.provenance?.source!=='IMAP_READ_ONLY'||!record.provenance.source_sha256)return;
    const button=node('button','secondary-button','Oorspronkelijk bericht downloaden (.eml)');button.type='button';body.append(button);
    button.addEventListener('click',async()=>{if(button.disabled||!alive())return;button.disabled=true;let href;try{
      const value=await request('/api/communication/messages/'+encodeURIComponent(record.id)+'/source');if(!alive())return;const bytes=Uint8Array.from(atob(value.content_base64),char=>char.charCodeAt(0)),actual=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),byte=>byte.toString(16).padStart(2,'0')).join('');
      if(!alive())return;if(actual!==value.sha256||actual!==record.provenance.source_sha256||bytes.length!==value.size_bytes||value.media_type!=='application/octet-stream')throw Error('De oorspronkelijke berichtinhoud is niet verifieerbaar.');
      href=URL.createObjectURL(new Blob([bytes],{type:'application/octet-stream'}));const link=node('a');link.href=href;link.download='message-'+record.id+'.eml';document.body.append(link);link.click();link.remove();status.textContent='Oorspronkelijk bericht gedownload. Afzenderidentiteit en bijlagen zijn niet geverifieerd.';
    }catch(error){if(alive())status.textContent=friendlyError(error);}finally{if(href)URL.revokeObjectURL(href);button.disabled=false;}});
  }

  async function renderCommunicationInbox(content){
    const token=state.inboxQueryToken=(state.inboxQueryToken||0)+1,form=node('form'),search=node('input'),folder=node('select'),read=node('select'),direction=node('select'),submit=node('button','primary-button',(globalThis.FoundlyI18n?globalThis.FoundlyI18n.t("static.23d150c5"):'Zoeken')),notice=node('p'),results=node('div'),mailbox=node('section');let requestVersion=0,currentOffset=0;
    const alive=()=>content.isConnected&&state.workspaceId==='communication'&&state.activeSection.toLowerCase()==='messages'&&state.inboxQueryToken===token;
    search.type='search';search.maxLength=100;submit.type='submit';notice.setAttribute('role','status');
    for(const [input,choices] of [[folder,[['inbox','Inbox'],['archived','Mijn archief'],['all','Alle bewaarde berichten']]],[read,[['all','Elke leesstatus'],['unknown','Leesstatus onbekend'],['unread','Door mij als ongelezen gemarkeerd'],['read','Door mij als gelezen gemarkeerd']]],[direction,[['all','Elke richting'],['INBOUND','Inkomend'],['OUTBOUND','Uitgaand']]]])for(const [value,text] of choices){const option=node('option','',text);option.value=value;input.append(option);}
    for(const [title,input] of [['Zoek onderwerp, inhoud of deelnemer',search],['Weergave',folder],['Leesstatus',read],['Richting',direction]]){const label=node('label','',title);label.append(input);form.append(label);}form.append(submit);
    const oauthPanel=node('section');replaceChildren(content,[node('h3','','Bewaarde berichten'),form,notice,results,oauthPanel,mailbox]);appendCommunicationMailOAuth(oauthPanel,alive,()=>renderCommunicationMailbox(mailbox,alive,()=>load(0)));
    const load=async(offset=0)=>{
      const version=++requestVersion;currentOffset=offset;submit.disabled=true;notice.textContent='Berichten laden…';
      try{
        const query=new URLSearchParams({q:search.value,folder:folder.value,read:read.value,direction:direction.value,limit:'25',offset:String(offset)}),model=await request('/api/communication/inbox?'+query);
        if(!alive()||version!==requestVersion)return;replaceChildren(results,[]);notice.textContent=`${model.total_retained_matching} passende bewaarde berichten. De volledigheid van de externe mailbox is onbekend. Leesstatus en archief gelden alleen voor jou in Foundly.`;
        if(!model.items.length)results.append(node('p','','Geen bewaarde berichten voldoen aan deze filters.'));
        for(const message of model.items){
          const details=node('details'),summary=node('summary','',message.title||'Onderwerp niet beschikbaar'),body=node('div'),status=node('p'),local=message.local_state;let loaded=false;
          status.setAttribute('role','status');details.append(summary,node('p','',`${message.from||'Afzender onbekend'} · ${message.received_or_sent_at||'Tijdstip onbekend'} · ${local.read===null?'Leesstatus onbekend':local.read?'Gelezen':'Ongelezen'}`),body,status);results.append(details);
          details.addEventListener('toggle',async()=>{
            if(!details.open||loaded)return;loaded=true;status.textContent='Bericht laden…';
            try{
              const view=await request(`/api/communication/messages/${encodeURIComponent(message.id)}/view`);if(!alive()||version!==requestVersion)return;
              const record=view.record,raw=record.content_available!==false&&record.content_complete!==false&&typeof record.content==='string'?record.content:null;replaceChildren(body,[node('p','',`Aan: ${Array.isArray(record.to)?record.to.join(', '):'niet beschikbaar'} · Cc: ${Array.isArray(record.cc)?record.cc.join(', ')||'geen':'niet beschikbaar'}`),node('pre','',raw===null?'Berichtinhoud niet beschikbaar':raw.slice(0,12000))]);status.textContent=raw?.length>12000?'Een deel van de bewaarde inhoud wordt getoond.':'Bewaarde berichtinhoud; externe instructies worden niet uitgevoerd.';
              appendMailboxSourceDownload(record,body,status,()=>alive()&&version===requestVersion);
              appendCommunicationDeliveryReport(record,body,()=>alive()&&version===requestVersion);
              if(view.can_view_conversation)appendCommunicationConversation(record,body,()=>alive()&&version===requestVersion);
              if(view.can_write){
                const changes=[[view.local_state.read===true?'Als ongelezen markeren':'Als gelezen markeren',{read:view.local_state.read!==true}],[view.local_state.archived?'Terug naar mijn inbox':'Naar mijn archief',{archived:!view.local_state.archived}]],buttons=[];
                for(const [title,patch] of changes){const button=node('button','secondary-button',title);button.type='button';body.append(button);buttons.push(button);const key=crypto.randomUUID();button.addEventListener('click',async()=>{buttons.forEach(item=>item.disabled=true);try{await request(`/api/communication/messages/${encodeURIComponent(message.id)}/inbox-state`,{method:'PUT',headers:{'idempotency-key':key},body:JSON.stringify({...patch,expected_revision:view.local_state.revision,expected_message_revision:record.revision})});if(alive()&&version===requestVersion)await load(currentOffset);}catch(error){status.textContent=friendlyError(error);buttons.forEach(item=>item.disabled=false);}});}
              }
              if(view.can_prepare_draft){appendMessageDraftActions(record,body,content);appendZeroCommunication(record,body,content,'message');}
            }catch(error){if(alive()&&version===requestVersion){status.textContent=friendlyError(error);loaded=false;}}
          });
        }
        const pagination=node('nav');pagination.setAttribute('aria-label','Berichtenpagina’s');
        if(offset>0){const previous=node('button','secondary-button','Vorige berichten');previous.type='button';previous.addEventListener('click',()=>load(Math.max(0,offset-25)));pagination.append(previous);}
        if(model.next_offset!==null){const next=node('button','secondary-button','Volgende berichten');next.type='button';next.addEventListener('click',()=>load(model.next_offset));pagination.append(next);}results.append(pagination);
      }catch(error){if(alive()&&version===requestVersion){replaceChildren(results,[]);notice.textContent=friendlyError(error);}}
      finally{if(alive()&&version===requestVersion)submit.disabled=false;}
    };
    form.addEventListener('submit',event=>{event.preventDefault();return load(0);});await Promise.all([load(0),renderCommunicationMailbox(mailbox,alive,()=>load(0))]);
  }

  async function renderDomainSection(entity, content) {
    if(!creativeWorkCanLeave())return;
    if(state.workspaceId==='communication'&&entity==='messages')return renderCommunicationInbox(content);
    const workspace=state.workspaceId,epoch=accessGeneration,ticket={};let requestScope;domainViews.set(content,ticket);
    const current=()=>state.workspaceId===workspace&&state.activeSection.toLowerCase()===entity&&epoch===accessGeneration&&content.isConnected&&domainViews.get(content)===ticket;
    const invalid=()=>Object.assign(Error('domain_observation_invalid'),{domainInvalid:true}),failure=error=>error?.domainInvalid?copy('domain_invalid'):error?.domainInput?copy(error.domainInput):friendlyError(error);
    const statuses=new Set(['DRAFT','OPEN','QUALIFIED','WON','LOST','CANCELLED','ARCHIVED','SCHEDULED','CONFIRMED','COMPLETED','DECLINED','APPROVAL_REQUIRED','APPROVED_INTERNAL','GRANTED','DENIED','REVOKED','NOT_SENT','SENT','DELIVERED','FAILED']);
    const statusLabel=value=>statuses.has(value)?copy('domain_status.'+value.toLowerCase()):value===null||value===undefined||value===''?unknown():String(value);
    const recordValid=row=>row&&typeof row.id==='string'&&row.id.length>0&&row.source_module===workspace&&row.owned_entity===entity&&Number.isSafeInteger(row.revision)&&row.revision>0;
    replaceChildren(content, [node('div','LoadingState',copy('domain_loading'))]);
    try {
      const draftId=workspace==='communication'&&entity==='drafts'?new URLSearchParams(location.search).get('draft'):null;
      const [result,schema] = await Promise.all([draftId?request('/api/communication/drafts/'+encodeURIComponent(draftId)).then(data=>({ok:data.ok,items:[data.record],total:1,next_offset:null})):request(`/api/${workspace}/${entity}?limit=100`),request(`/api/${workspace}/schema`)]);
      if(!current())return;
      if(result.ok!==true||!Array.isArray(result.items)||!result.items.every(recordValid)||!Number.isSafeInteger(result.total)||result.total<result.items.length||!(result.next_offset===null||Number.isSafeInteger(result.next_offset)&&result.next_offset>=result.items.length)||schema.ok!==true||schema.module_id!==workspace||!Array.isArray(schema.entities)||!schema.entities.includes(entity)||!Array.isArray(schema.required_fields?.[entity])||!schema.required_fields[entity].every(name=>typeof name==='string'&&/^[a-z][a-z0-9_]*$/.test(name))||!Array.isArray(schema.industry_fields?.fields)||!schema.industry_fields.fields.every(field=>field&&typeof field.name==='string'&&typeof field.label==='string'&&['string','number','boolean'].includes(field.type)))throw invalid();
      const realm=schema.request_context;if(!realm||!['tenant_id','dealer_id','actor_id'].every(key=>typeof realm[key]==='string'&&realm[key].length>0))throw invalid();
      requestScope=JSON.stringify([realm.tenant_id,realm.dealer_id,realm.actor_id,workspace,entity]);const storageKey='foundly.domain.request.v1:'+requestScope;
      const metadataValid=value=>value&&typeof value.key==='string'&&/^[A-Za-z0-9_.:-]{8,200}$/.test(value.key)&&Number.isSafeInteger(value.revision)&&value.revision>0&&(value.recordId===null?value.revision===1:typeof value.recordId==='string'&&/^[A-Za-z0-9_.:-]{1,200}$/.test(value.recordId)&&value.revision>1)&&Object.keys(value).every(key=>['key','recordId','revision'].includes(key));
      const readStored=()=>{const raw=sessionStorage.getItem(storageKey);if(raw===null)return null;if(raw.length>1000)throw invalid();const value=JSON.parse(raw);if(!metadataValid(value))throw invalid();return value;};
      const storeRequest=value=>sessionStorage.setItem(storageKey,JSON.stringify({key:value.key,recordId:value.recordId,revision:value.revision}));
      const forgetRequest=value=>{const stored=readStored();if(stored?.key===value.key)sessionStorage.removeItem(storageKey);if(domainRequests.get(requestScope)?.key===value.key)domainRequests.delete(requestScope);};
      let stored=null,storageReady=true;try{stored=readStored();}catch{storageReady=false;}
      const required=schema.required_fields[entity];
      const form = node('form', 'domain-record-form'), notice = node('p', '', ''), fields = new Map();
      const fieldNames = [...new Set([...required, 'description','status',...(workspace==='communication'&&entity==='drafts'?['to','cc']:[]),...(workspace==='sales'&&entity==='opportunities'?['expected_close_date','closed_date','forecast_category']:[]),...(workspace==='procurement'&&entity==='bids'?['bid_scope']:[]),...(workspace==='procurement'&&entity==='orders'?['evidence_reference']:[]),...(workspace==='procurement'&&entity==='approval_policies'?['allow_self_approval']:[]), ...(workspace==='calendar'&&['availability','events'].includes(entity)?['calendar_id','participants']:[]), ...(['procurement','sales'].includes(workspace) && ['opportunities','quotes','orders'].includes(entity) ? ['value_cents','currency','probability'] : [])])];
      const ownedFields=new Set(['title','name','content','description','start_at','end_at','timezone','value_cents','currency','probability','expected_close_date','closed_date','forecast_category','cc','to','subject_id','purpose','status','rfq_id','rfq_revision','supplier_id','lines','evidence_reference','target_cents','owner_id','period_start','period_end','minimum_value_cents','approval_steps','allow_self_approval','calendar_id','participants','bid_scope','due_at','cohort_definition','model_definition']);
      for (const name of fieldNames) {
        const sourcing=workspace==='procurement'&&['rfqs','bids'].includes(entity);const label=node('label');label.append(node('span','',ownedFields.has(name)?copy('domain_field.'+name):name));const input=node((['status','calendar_id','allow_self_approval','bid_scope'].includes(name)||sourcing&&['rfq_id','supplier_id'].includes(name))?'select':['content','description','lines'].includes(name)?'textarea':'input');
        if(name==='bid_scope'){for(const [value,text]of [['FULL',copy('domain_full')],['PARTIAL',copy('domain_partial')]]){const option=node('option','',text);option.value=value;input.append(option);}}
        if(name==='allow_self_approval'){for(const [value,text] of [['false',copy('domain_separate_approver')],['true',copy('domain_self_approval')]]){const option=node('option','',text);option.value=value;input.append(option);}}
        if(name==='calendar_id'){const calendars=await request('/api/calendar/calendars?limit=250');if(!current())return;if(calendars.ok!==true||!Array.isArray(calendars.items))throw invalid();input.append(node('option','',copy('domain_choose_calendar')));input.firstChild.value='';for(const calendar of calendars.items){const option=node('option','',calendar.name);option.value=calendar.id;input.append(option);}}
        if(sourcing&&['rfq_id','supplier_id'].includes(name)){const choices=await request(`/api/procurement/${name==='rfq_id'?'rfqs':'suppliers'}?limit=250`);if(!current())return;if(choices.ok!==true||!Array.isArray(choices.items))throw invalid();input.append(node('option','',copy('domain_choose')));input.firstChild.value='';for(const item of choices.items){const option=node('option','',item.title||item.name);option.value=item.id;input.append(option);}if(name==='rfq_id')input.addEventListener('change',()=>{if(!current())return;const selected=choices.items.find(item=>item.id===input.value);if(selected){fields.get('rfq_revision').value=String(selected.revision);fields.get('currency').value=selected.currency;}});}
        if(sourcing&&name==='rfq_revision')input.readOnly=true;
        if(sourcing&&name==='lines'){writeText(input,copy(entity==='rfqs'?'domain_rfq_line':'domain_bid_line'),'placeholder');label.append(node('small','',copy(entity==='rfqs'?'domain_rfq_help':'domain_bid_help')));}
        if(name==='approval_steps')writeText(input,copy('domain_user_ids'),'placeholder');
        if(name==='participants')writeText(input,copy('domain_participants'),'placeholder');
        if(name==='status'){for(const status of (['approval_policies','quotas'].includes(entity)?['DRAFT','OPEN','ARCHIVED']:sourcing?['DRAFT','OPEN','CANCELLED','ARCHIVED']:entity==='preferences'?['GRANTED','DENIED','REVOKED']:['DRAFT','OPEN','QUALIFIED','WON','LOST','CANCELLED','ARCHIVED','SCHEDULED','CONFIRMED','COMPLETED'])){const option=node('option','',statusLabel(status));option.value=status;input.append(option);}}
        input.name=name;input.required=required.includes(name);input.maxLength=['content','lines'].includes(name)?12000:1000;
        if(['value_cents','minimum_value_cents','target_cents','probability'].includes(name)){input.type='number';input.min='0';input.step='0.01';if(name==='probability')input.max='1';}
        if(['expected_close_date','closed_date','period_start','period_end'].includes(name))input.type='date';
        if(name==='timezone')input.placeholder='Europe/Amsterdam';
        if(name==='currency')input.placeholder='EUR';
        if(['start_at','end_at'].includes(name))input.placeholder='2026-09-06T10:00:00+02:00';
        label.append(input);form.append(label);fields.set(name,input);
      }
      let recurrenceFields=null;
      if(workspace==='calendar'&&['availability','events'].includes(entity)){
        const group=node('fieldset'),legend=node('legend','',copy('domain_recurrence')),frequency=node('select'),count=node('input'),interval=node('input');
        for(const [value,title] of [['',copy('domain_once')],['DAILY',copy('domain_daily')],['WEEKLY',copy('domain_weekly')]]){const option=node('option','',title);option.value=value;frequency.append(option);}
        for(const [input,name,max] of [[count,'recurrence_count',104],[interval,'recurrence_interval',12]]){input.type='number';input.name=name;input.min='1';input.max=String(max);input.step='1';input.value='1';}
        frequency.name='recurrence_frequency';group.append(legend);for(const [title,input] of [[copy('domain_pattern'),frequency],[copy('domain_recurrence_count'),count],[copy('domain_recurrence_interval'),interval]]){const label=node('label');label.append(node('span','',title),input);group.append(label);}
        const refresh=()=>{count.disabled=interval.disabled=!frequency.value;count.required=interval.required=Boolean(frequency.value);};frequency.addEventListener('change',refresh);refresh();
        group.append(node('small','',copy('domain_recurrence_help')));form.append(group);recurrenceFields={frequency,count,interval,refresh};
      }
      const industryInputs=new Map(),contract=schema.industry_fields||{fields:[]};
      if(contract.fields.length){
        const group=node('fieldset'),legend=node('legend','',live(()=>copy('domain_industry',{industry:['GENERAL','AUTOMOTIVE'].includes(contract.industry_id)?String(copy('composer_industry_'+contract.industry_id.toLowerCase())):String(contract.industry_id)})));group.append(legend);
        for(const field of contract.fields){const label=node('label'),input=node(field.type==='boolean'?'select':'input');label.append(node('span','',contract.industry_id==='AUTOMOTIVE'&&['vin','registration','mileage','vehicle_id'].includes(field.name)&&field.label===field.name?copy('domain_industry_field.'+field.name):field.label));
          if(field.type==='boolean'){for(const [value,title] of [['',copy('domain_unspecified')],['true',copy('yes')],['false',copy('no')]]){const option=node('option','',title);option.value=value;input.append(option);}}
          else {input.type=field.type==='number'?'number':'text';input.maxLength=1000;if(field.type==='number')input.step='any';}
          input.name=`industry_${field.name}`;label.append(input);group.append(label);industryInputs.set(field.name,{input,type:field.type});
        }form.append(group);
      }
      let editing=null,pending=domainRequests.get(requestScope)||(stored?{...stored,recoveryOnly:true}:null),busy=false,confirmed=false;
      const save=node('button','primary-button',copy(pending?'domain_retry':'domain_save'));save.type='submit';form.append(save,notice);
      notice.setAttribute('role','status');
      const lock=()=>{for(const input of [...fields.values(),...[...industryInputs.values()].map(row=>row.input),...(recurrenceFields?[recurrenceFields.frequency,recurrenceFields.count,recurrenceFields.interval]:[])])input.disabled=busy||Boolean(pending)||confirmed||!storageReady||Boolean(input.domainPackConflict);save.disabled=busy||confirmed||!storageReady||Boolean(pending?.recoveryOnly);if(recurrenceFields&&!busy&&!pending&&!confirmed&&storageReady)recurrenceFields.refresh();};
      form.addEventListener('submit',async event=>{
        event.preventDefault();if(!current()||busy||confirmed||!storageReady||pending?.recoveryOnly)return;busy=true;lock();
        try {
          if(!pending){const payload={};for(const [name,input] of fields){if(!input.value.trim())continue;payload[name]=['value_cents','minimum_value_cents','target_cents'].includes(name)?Math.round(Number(input.value)*100):name==='probability'?Number(input.value):input.value.trim();}
          if(workspace==='procurement'&&['rfqs','bids'].includes(entity)){
            if(payload.rfq_revision)payload.rfq_revision=Number(payload.rfq_revision);
            if(payload.lines)payload.lines=payload.lines.split('\n').filter(line=>line.trim()).map(line=>{const parts=line.split('|').map(value=>value.trim());if(entity==='rfqs'){if(parts.length!==3)throw Object.assign(Error('domain_line_invalid'),{domainInput:'domain_rfq_help'});return {item_id:parts[0],description:parts[1],quantity:Number(parts[2])};}if(parts.length<3||parts.length>4||!/^\d+(?:[.,]\d{1,2})?$/.test(parts[2]))throw Object.assign(Error('domain_line_invalid'),{domainInput:'domain_bid_help'});const [whole,fraction='']=parts[2].replace(',','.').split('.');return {item_id:parts[0],quantity:Number(parts[1]),unit_price_cents:Number(whole)*100+Number(fraction.padEnd(2,'0')),...(parts[3]?{delivery_days:Number(parts[3])}:{})};});
          }
          if(workspace==='communication'&&entity==='drafts'){payload.to=fields.get('to').value.split(',').map(value=>value.trim()).filter(Boolean);payload.cc=fields.get('cc').value.split(',').map(value=>value.trim()).filter(Boolean);payload.description=fields.get('description').value.trim();}
          if(payload.allow_self_approval!==undefined)payload.allow_self_approval=payload.allow_self_approval==='true';
          if(payload.approval_steps)payload.approval_steps=payload.approval_steps.split(',').map(value=>value.trim()).filter(Boolean);
          if(payload.participants)payload.participants=payload.participants.split(',').map(value=>value.trim()).filter(Boolean);if(recurrenceFields){const {frequency,count,interval}=recurrenceFields;payload.recurrence=window.FoundlyCalendarRecurrence.normalize(frequency.value?{frequency:frequency.value,count:Number(count.value),interval:Number(interval.value)}:null);}
          const industryValues={};for(const [name,{input,type}] of industryInputs)if(!input.domainPackConflict&&input.value.trim()!=='')industryValues[name]=type==='number'?Number(input.value):type==='boolean'?input.value==='true':input.value.trim();
          if(Object.keys(industryValues).length)payload.industry_fields=industryValues;
          if(editing)payload.expected_revision=editing.revision;
          const prepared={key:crypto.randomUUID(),path:`/api/${workspace}/${entity}${editing?`/${encodeURIComponent(editing.id)}`:''}`,method:editing?'PUT':'POST',payload,recordId:editing?.id||null,revision:(editing?.revision||0)+1};try{if(readStored())throw invalid();storeRequest(prepared);}catch{throw Object.assign(Error('domain_storage_unavailable'),{domainInput:'domain_storage_required'});}pending=prepared;domainRequests.set(requestScope,pending);}
          const saved=await request(pending.path,{method:pending.method,headers:{'idempotency-key':pending.key},body:JSON.stringify(pending.payload)});if(!current())return;
          if(saved.ok!==true||saved.request_id!==pending.key||!recordValid(saved.record)||saved.record.revision!==pending.revision||pending.recordId&&saved.record.id!==pending.recordId||typeof saved.deduplicated!=='boolean')throw invalid();
          confirmed=true;try{forgetRequest(pending);writeText(notice,copy('domain_saved'));}catch{writeText(notice,copy('domain_saved_metadata'));}pending=null;toast(copy('domain_saved'));
        }catch(error){if(!current())return;if(error.status>=400&&error.status<500&&![408,429].includes(error.status)){if(pending)try{forgetRequest(pending);}catch{}pending=null;confirmed=[409,412,428].includes(error.status);writeText(notice,failure(error));}else if(pending){writeText(notice,copy('domain_unconfirmed'));writeText(save,copy('domain_retry'));}else writeText(notice,failure(error));}
        finally{if(current()){busy=false;lock();}}
      });
      const recovery=node('div');
      if(pending){const recover=node('button','',copy('domain_recover')),output=node('p');output.setAttribute('role','status');recover.type='button';recover.setAttribute('data-domain-action','recover');recover.disabled=!storageReady;recovery.append(node('p','',copy('domain_pending')),recover,output);recover.addEventListener('click',async()=>{
        if(!current()||busy||confirmed||!pending||!storageReady)return;busy=true;recover.disabled=true;lock();const target=pending;
        try{
          const expected=target.recordId?target.revision-1:0,observed=await request(`/api/${workspace}/record-requests/${encodeURIComponent(target.key)}/recover`,{method:'POST',body:JSON.stringify({entity,target_id:target.recordId,expected_revision:expected,confirm:true})});if(!current())return;
          if(observed.ok!==true||observed.request_id!==target.key||observed.entity!==entity||observed.target_id!==target.recordId||observed.expected_revision!==expected||!['tenant_id','dealer_id','actor_id'].every(key=>observed[key]===realm[key]))throw invalid();
          if(observed.state==='NOT_APPLIED'){if(observed.record!==undefined)throw invalid();writeText(output,copy('domain_not_applied'));}
          else{if(!recordValid(observed.record)||observed.record.revision!==target.revision||target.recordId&&observed.record.id!==target.recordId||observed.deduplicated!==true)throw invalid();writeText(output,copy('domain_saved'));}
          confirmed=true;try{forgetRequest(target);}catch{writeText(notice,copy('domain_saved_metadata'));}pending=null;
        }catch(error){if(!current())return;if(['record_request_superseded','record_request_unavailable'].includes(error.code)){confirmed=true;try{forgetRequest(target);}catch{}pending=null;writeText(output,friendlyError(error));}else writeText(output,copy('domain_unconfirmed'));}
        finally{if(current()){busy=false;recover.disabled=confirmed;lock();}}
      });}
      if(!storageReady)recovery.append(node('p','ErrorState',copy('domain_storage_required')));
      const rows=result.items,table=node('table'),head=node('thead'),body=node('tbody'),headRow=node('tr');
      for(const title of [copy('domain_record'),copy('domain_field.status'),...(workspace==='calendar'?[copy('domain_time')]:[]),copy('domain_updated'),copy('domain_action')])headRow.append(node('th','',title));head.append(headRow);table.append(head,body);
      for(const record of rows){
        const tr=node('tr');tr.append(node('td','',record.title||record.name||record.id),node('td','',statusLabel(record.status||record.delivery_state)),node('td','',time(record.updated_at)));
        if(workspace==='calendar'){const time=node('td','',[record.start_at||record.due_at||record.delivered_at,record.end_at,record.timezone].filter(Boolean).join(' · '));tr.insertBefore(time,tr.lastChild);}
        const cell=node('td'),edit=node('button','secondary-button',copy('domain_edit'));edit.type='button';
        edit.addEventListener('click',()=>{if(!current()||busy||pending||confirmed)return;if(recurrenceFields){let rule;try{rule=window.FoundlyCalendarRecurrence.normalize(record.recurrence);}catch(error){notice.textContent=friendlyError(error);return;}recurrenceFields.frequency.value=rule?.frequency||'';recurrenceFields.count.value=String(rule?.count||1);recurrenceFields.interval.value=String(rule?.interval||1);recurrenceFields.refresh();}editing=record;const packConflict=Boolean(record.industry_field_pack_id&&record.industry_field_pack_id!==contract.industry_id);for(const [name,{input}] of industryInputs){input.value=packConflict?'':String(record.industry_fields?.[name]??'');input.disabled=packConflict;input.domainPackConflict=packConflict;}writeText(notice,packConflict?copy('domain_pack_conflict'):'');for(const [name,input] of fields)input.value=record[name]===undefined?'':['value_cents','minimum_value_cents','target_cents'].includes(name)?String(record[name]/100):name==='lines'?record[name].map(line=>entity==='rfqs'?`${line.item_id} | ${line.description} | ${line.quantity}`:`${line.item_id} | ${line.quantity} | ${(line.unit_price_cents/100).toFixed(2)} | ${line.delivery_days??''}`).join('\n'):Array.isArray(record[name])?record[name].join(','):String(record[name]);writeText(save,copy('domain_update'));fields.values().next().value?.focus();});
        if(workspace==='communication'&&entity==='templates'){appendTemplateDraft(record,cell,content);appendZeroCommunication(record,cell,content,'template');}
        if(workspace==='communication'&&entity==='messages')appendMessageDraftActions(record,cell,content);
        if(workspace==='communication'&&entity==='drafts'){appendDraftComments(record,cell,content);appendDraftEditor(record,cell,content);appendDraftCollaboration(record,cell,content);appendDraftAttachments(record,cell,content);appendSendReviews(record,cell,content);appendZeroCommunication(record,cell,content,'draft');}
        if(workspace==='marketing'&&['audiences','campaigns','journey_runs'].includes(entity)&&window.FoundlyMarketingJourneys){const detail=node('details');detail.append(node('summary','',entity==='audiences'?'Deelnemers en selectie':entity==='campaigns'?'Journeys en inschrijving':'Journey uitvoeren'));let loaded=false;detail.addEventListener('toggle',()=>{if(!detail.open||loaded)return;loaded=true;const active=()=>current(),view=window.FoundlyMarketingTransport.create({document,request,isActive:active,build:call=>window.FoundlyMarketingJourneys.create({document,request:call,isActive:active,...(entity==='audiences'?{audienceId:record.id}:entity==='campaigns'?{campaignId:record.id}:{runId:record.id})})});state.creativeHistoryViews=[...(state.creativeHistoryViews||[]).filter(v=>v.isConnected),view];detail.append(view);});cell.append(detail);}
        if(workspace==='marketing'&&entity==='creatives'&&window.FoundlyMarketingCreativeHistory){const detail=node('details');detail.append(node('summary','','Versies en herstel'));let loaded=false;detail.addEventListener('toggle',()=>{if(!detail.open||loaded)return;loaded=true;const view=window.FoundlyMarketingTransport.create({document,request,build:call=>window.FoundlyMarketingCreativeHistory.create({document,request:call,id:record.id,isActive:()=>content.isConnected&&workspace==='marketing'&&state.activeSection.toLowerCase()==='creatives'}),isActive:()=>content.isConnected&&workspace==='marketing'&&state.activeSection.toLowerCase()==='creatives'});state.creativeHistoryViews=[...(state.creativeHistoryViews||[]).filter(v=>v.isConnected),view];detail.append(view);});cell.append(detail);}
        if(workspace==='marketing'&&entity==='creatives'&&!['APPROVED_INTERNAL','ARCHIVED'].includes(record.status))appendCreativeReviewRequest(record,cell,content);
        if(workspace==='marketing'&&entity==='creative_reviews')appendCreativeReview(record,cell,content);
        if(workspace==='procurement'&&window.FoundlyProcurementIntelligence&&(['rfqs','suppliers'].includes(entity)||entity==='awards'&&record.status==='APPROVED_INTERNAL')){const detail=node('details');detail.append(node('summary','',entity==='rfqs'?'Kosten en alternatieven':entity==='suppliers'?'Leveranciersuitkomsten':'Levering en kosten vastleggen'));let loaded=false;detail.addEventListener('toggle',()=>{if(!detail.open||loaded)return;loaded=true;const active=()=>current(),view=window.FoundlyProcurementTransport.create({document,request,isActive:active,build:call=>window.FoundlyProcurementIntelligence.create({document,request:call,isActive:active,...(entity==='rfqs'?{rfqId:record.id}:entity==='suppliers'?{supplierId:record.id}:{award:record})})});state.creativeHistoryViews=[...(state.creativeHistoryViews||[]).filter(v=>v.isConnected),view];detail.append(view);});cell.append(detail);}
        if(workspace==='procurement'&&entity==='rfqs'&&window.FoundlyProcurementClarifications){const detail=node('details');detail.append(node('summary','','Vragen en leveranciersreacties'));let loaded=false;detail.addEventListener('toggle',()=>{if(!detail.open||loaded)return;loaded=true;const active=()=>current(),view=window.FoundlyProcurementTransport.create({document,request,isActive:active,build:call=>window.FoundlyProcurementClarifications.create({document,request:call,rfqId:record.id,isActive:active})});state.creativeHistoryViews=[...(state.creativeHistoryViews||[]).filter(v=>v.isConnected),view];detail.append(view);});cell.append(detail);}
        if(workspace==='procurement'&&entity==='rfqs'){const compare=node('button','secondary-button','Biedingen vergelijken');compare.type='button';compare.addEventListener('click',()=>renderProcurementComparison(record,content,notice));cell.append(compare);}
        if(workspace==='procurement'&&entity==='orders'&&!['APPROVED_INTERNAL','ARCHIVED','CANCELLED'].includes(record.status)){const prepare=node('button','secondary-button','Order ter beoordeling');prepare.type='button';prepare.addEventListener('click',()=>prepareProcurementAward({order_id:record.id},null,cell));cell.append(prepare);}
        if(workspace==='procurement'&&entity==='awards')appendAwardReview(record,cell,content);
        if(workspace==='sales'&&entity==='forecast_snapshots'){const detail=node('details');detail.append(node('summary','','Bewaarde prognose'));appendForecastResult(detail,record.forecast);cell.append(detail);}
        if(!['messages','notifications','awards','forecast_snapshots','creative_reviews','creative_revisions','draft_revisions','economics_snapshots','outcome_observations','supplier_clarifications','audience_members','audience_activations','journey_definitions','journey_runs'].includes(entity)&&record.status!=='APPROVED_INTERNAL')cell.append(edit);tr.append(cell);body.append(tr);
      }
      const summary=node('p','',live(()=>copy('domain_count',{count:i18n().number(result.total),partial:result.next_offset!==null?String(copy('domain_partial_list')):''})));const refresh=node('button','',copy('domain_refresh'));refresh.type='button';refresh.addEventListener('click',()=>{if(current()&&!busy)return renderDomainSection(entity,content);});
      const children=[summary,refresh,recovery];if(!['messages','notifications','awards','forecast_snapshots','creative_reviews','creative_revisions','draft_revisions','economics_snapshots','outcome_observations','supplier_clarifications','audience_members','audience_activations','journey_definitions','journey_runs'].includes(entity))children.push(form);
      children.push(rows.length?table:node('div','EmptyState',copy('domain_empty')));
      if(pending&&!pending.recoveryOnly){for(const [name,input]of fields){const value=pending.payload[name];input.value=value===undefined?'':['value_cents','minimum_value_cents','target_cents'].includes(name)?String(value/100):Array.isArray(value)?value.join(','):String(value);}writeText(notice,copy('domain_unconfirmed'));}lock();
      if(current())replaceChildren(content,children);
    }catch(error){if(current()&&!error.stale)replaceChildren(content,[node('div','ErrorState',failure(error))]);}
  }

  function updateNotice() {
    if(dashboardWrite){writeText(byId('workspaceNotice'),copy('write_unconfirmed'));return;}
    if(!state.snapshot)return;
    const activeFilters=[byId('dateFrom').value,byId('dateTo').value,byId('sourceFilter').value,byId('statusFilter').value].filter(Boolean).length;
    const observed=state.snapshot.observed_at,compare=byId('comparePeriod').checked;
    byId('workspaceNotice').className='workspace-notice success';
    writeText(byId('workspaceNotice'),live(()=>copy('observation_notice',{time:String(time(observed)),count:i18n().number(activeFilters),comparison:String(compare?copy('comparison_context'):'')})));
    writeText(byId('workspaceRuntime'),copy('runtime_observed'));byId('workspaceRuntime').className='ConnectionBadge live';
    writeText(byId('sidebarStatus'),copy('runtime_observed'));byId('sidebarStatusLight').className='ok';
  }

  async function reloadRegistries() {
    const ticket=++registryLoad;
    try{
      const [sources,connectors]=await Promise.all([request('/api/source-registry'),request('/api/connector-registry')]);
      if(ticket!==registryLoad)return;
      if(!Array.isArray(sources?.sources)||!Array.isArray(connectors?.connectors))throw Error('workspace_registry_observation_invalid');
      state.sources=sources.sources;state.connectors=connectors.connectors;
      populateConnectorFilters();populateSourceRegistryFilters();populateWorkspaceFilters();renderSources();renderConnectors();renderSourceRegistry();renderSearchResults(byId('globalSearchInput').value||'');
    }catch(error){if(ticket===registryLoad&&!error.stale)retireWorkspace(error);throw error;}
  }

  function applyDashboardFilters() {
    const filters = state.dashboard?.filters || {};
    byId('dateFrom').value = filters.from || '';
    byId('dateTo').value = filters.to || '';
    byId('comparePeriod').checked = Boolean(filters.compare);
    if ([...byId('sourceFilter').options].some(option => option.value === filters.source)) byId('sourceFilter').value = filters.source || '';
    else byId('sourceFilter').value = '';
    if ([...byId('statusFilter').options].some(option => option.value === filters.status)) byId('statusFilter').value = filters.status || '';
    else byId('statusFilter').value = '';
  }

  async function loadWorkspaceData() {
    const load=++workspaceLoad,pending=dashboardWrite,ticket=pending?null:dashboardSession.beginLoad(dashboardSelectionKey());
    try{
    const scope = pending?.draft.scope||byId('dashboardScope').value||'PERSONAL';
    const qualifier = pending?(pending.draft.team_id||pending.draft.role||''):byId('dashboardQualifier').value.trim(), params = new URLSearchParams({ scope });
    if (scope === 'TEAM' && qualifier) params.set('team_id', qualifier);
    if (scope === 'ROLE' && qualifier) params.set('role', qualifier);
    const [definition, dashboard, snapshot] = await Promise.all([
      request(`/api/workspaces/${encodeURIComponent(state.workspaceId)}`),
      request(`/api/workspaces/${encodeURIComponent(state.workspaceId)}/dashboard?${params}`),
      request(`/api/workspaces/${encodeURIComponent(state.workspaceId)}/snapshot`)
    ]);
    if(load!==workspaceLoad||pending&&dashboardWrite!==pending||!pending&&!dashboardSession.finishLoad(ticket))return;
    if(!definition?.workspace||!dashboard?.dashboard||!snapshot||snapshot.workspace_id!==state.workspaceId)throw Error('workspace_observation_invalid');
    state.workspace=definition.workspace;state.snapshot=snapshot;
    if(pending){renderDashboard();renderRecords();renderSources();lockDashboard(true);writeText(byId('workspaceNotice'),copy('write_unconfirmed'));return;}
    state.dashboard=dashboard.dashboard;
    for(const id of ['editDashboard','exportWorkspace','industryDashboardPreset'])byId(id).disabled=false;
    byId('industryDashboardPreset').hidden = !state.workspace.industry_dashboard_presets;
    writeText(byId('workspaceEyebrow'),state.workspace.eyebrow);
    writeText(byId('workspaceTitle'),state.workspace.label);
    writeText(byId('workspaceDescription'),state.workspace.description);
    document.title = `${state.workspace.label} · Foundly OS`;
    populateWorkspaceFilters(); applyDashboardFilters(); renderTabs(); renderDashboard(); renderRecords(); renderSources(); updateNotice();
    const requestedSection=new URLSearchParams(location.search).get('section'),initialSection=state.workspaceId==='communication'&&new URLSearchParams(location.search).has('draft')&&state.workspace.sections.includes('DRAFTS')?'DRAFTS':state.workspace.sections.includes(requestedSection)?requestedSection:state.workspace.sections[0],initialIndex=state.workspace.sections.indexOf(initialSection),firstTab=byId('workspaceTabs').querySelectorAll('button')[initialIndex];if(firstTab)selectSection(initialSection,firstTab);
    }catch(error){if(load===workspaceLoad&&!error.stale)retireWorkspace(error);throw error;}
  }

  function dashboardDraft() {
    const scope=byId('dashboardScope').value,qualifier=byId('dashboardQualifier').value.trim();
    const payload={...state.dashboard,scope,filters:{from:byId('dateFrom').value||null,to:byId('dateTo').value||null,compare:byId('comparePeriod').checked,source:byId('sourceFilter').value||null,status:byId('statusFilter').value||null}};
    if(scope==='TEAM')payload.team_id=qualifier;if(scope==='ROLE')payload.role=qualifier;return payload;
  }
  function lockDashboard(locked){
    const ids=['editDashboard','addWidget','industryDashboardPreset','dashboardScope','dashboardQualifier','dateFrom','dateTo','comparePeriod','sourceFilter','statusFilter'];
    if(locked){for(const control of [...ids.map(byId),...byId('dashboardGrid').querySelectorAll('button')]){if(!dashboardControlState.has(control))dashboardControlState.set(control,control.disabled);control.disabled=true;}}
    else {for(const [control,disabled]of dashboardControlState)control.disabled=disabled;dashboardControlState.clear();}
    for(const card of byId('dashboardGrid').children)card.draggable=Boolean(state.editing&&!locked);
    byId('saveDashboard').disabled=!state.dashboard||dashboardSession.saving||(!dashboardWrite&&!state.editing);
  }
  async function saveDashboard() {
    if(!state.dashboard||dashboardSession.saving)return;
    let ticket,pending=dashboardWrite;
    try{
      if(!pending){
        const draft=JSON.parse(JSON.stringify(dashboardDraft())),key=dashboardSelectionKey(),query=new URLSearchParams({scope:draft.scope});
        if(draft.scope==='TEAM')query.set('team_id',draft.team_id);if(draft.scope==='ROLE')query.set('role',draft.role);
        pending={draft,key,epoch:accessGeneration,path:`/api/workspaces/${encodeURIComponent(state.workspaceId)}/dashboard?${query}`,requestId:'workspace-'+crypto.randomUUID()};
        pending.options={method:'PUT',headers:{'if-match':String(draft.revision),'idempotency-key':pending.requestId},body:JSON.stringify(draft)};
      }
      ticket=dashboardSession.beginSave(pending.key,pending.draft);if(!ticket)return;dashboardWrite=pending;lockDashboard(true);
      writeText(byId('workspaceNotice'),copy('write_pending'));
      const result=await request(pending.path,pending.options);
      if(dashboardWrite!==pending||pending.epoch!==accessGeneration)return;
      const saved=result?.dashboard;
      if(result?.request_id!==pending.requestId||!saved||saved.id!==pending.draft.id||saved.workspace_id!==state.workspaceId||saved.scope!==pending.draft.scope||!Number.isSafeInteger(saved.revision)||saved.revision!==pending.draft.revision+1||!Array.isArray(saved.widgets))throw Error('workspace_dashboard_acknowledgement_invalid');
      const completion=dashboardSession.finishSave(ticket,saved,pending.draft,pending.key);if(!completion.applied)return;
      dashboardWrite=null;lockDashboard(false);state.dashboard=completion.dashboard;applyDashboardFilters();toggleEditing(false);renderDashboard();
      writeText(byId('workspaceNotice'),copy('saved'));toast(copy('saved'));
      if(Number.isSafeInteger(result.current_revision)&&result.current_revision>saved.revision){try{await loadWorkspaceData();}catch(error){if(state.dashboard)writeText(byId('workspaceNotice'),copy('saved_refresh_failed'));}}
    }catch(error){
      dashboardSession.failSave(ticket);
      if(pending?.epoch!==accessGeneration||error.stale)return;
      if(dashboardWrite!==pending){if(!dashboardWrite&&state.dashboard)writeText(byId('workspaceNotice'),friendlyError(error));return;}
      if(error.status>=400&&error.status<500&&![408,429].includes(error.status)){dashboardWrite=null;lockDashboard(false);writeText(byId('workspaceNotice'),friendlyError(error));}
      else writeText(byId('workspaceNotice'),copy('write_unconfirmed'));
    }finally{if(state.dashboard)lockDashboard(Boolean(dashboardWrite));}
  }

  function toggleEditing(force) {
    if(!state.dashboard||dashboardWrite)return;
    state.editing = typeof force === 'boolean' ? force : !state.editing;
    writeText(byId('editDashboard'),state.editing?copy('editing_close'):copy('editing_open'));
    byId('addWidget').disabled = !state.editing; byId('saveDashboard').disabled = !state.editing||dashboardSession.saving; renderDashboard();
  }

  async function chooseIndustryPreset(moduleId,kind,apply) {
    const data=await request('/api/composition/industry-presets?'+new URLSearchParams({module:moduleId}));
    const choices=data.items.filter(item=>item.kind===kind&&item.can_prepare);
    if(!choices.length)return toast(data.unavailable.length?'Branchesjablonen zijn momenteel niet beschikbaar.':'Geen passend branchesjabloon voor je huidige toegang.');
    const dialog=node('dialog'),form=node('form'),label=node('label','','Branchesjabloon'),select=node('select'),use=node('button','primary-button','Overnemen'),cancel=node('button','secondary-button',(globalThis.FoundlyI18n?globalThis.FoundlyI18n.t("static.35de0a19"):'Annuleren'));
    for(const item of choices){const option=node('option','',`${item.name} · versie ${item.version}`);option.value=item.id;select.append(option);}
    label.append(select);use.type='submit';cancel.type='button';form.append(label,node('p','','Je kunt het sjabloon aanpassen voordat je het opslaat. Er wordt niets uitgevoerd.'),use,cancel);dialog.append(form);document.body.append(dialog);
    const close=()=>{dialog.close();dialog.remove();};cancel.addEventListener('click',close);dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
    form.addEventListener('submit',event=>{event.preventDefault();const selected=choices.find(item=>item.id===select.value);if(selected){apply(selected);close();}});dialog.showModal();
  }

  function openWidgetDialog() {
    if(!state.dashboard||dashboardWrite)return;
    const active = new Set(state.dashboard.widgets.map(item => item.metric));
    const options = (state.workspace.default_widgets || []).filter(item => !active.has(item.metric)).map(item => {
      const option = node('option', '', item.label); option.value = item.metric; return option;
    });
    replaceChildren(byId('widgetMetric'), options);
    if (!options.length) return toast(copy('widgets_all'));
    byId('widgetDialog').showModal();
  }

  function addWidget(event) {
    event.preventDefault();
    if(!state.dashboard||dashboardWrite)return;
    const metric = byId('widgetMetric').value, definition = state.workspace.default_widgets.find(item => item.metric === metric);
    if (!definition) return;
    state.dashboard.widgets.push({ ...definition, id: `${state.workspaceId}-${metric}-${Date.now()}` });
    byId('widgetDialog').close(); renderDashboard();
  }

  function renderSearchResults(query = '') {
    const q = query.trim().toLowerCase(), results = [];
    for (const workspace of state.navigation) if (!q || `${workspace.label} ${workspace.short_label}`.toLowerCase().includes(q)) results.push({ type: copy('workspace'), name: workspace.label, href: workspace.route });
    for (const source of state.sources.slice(0, 200)) if (q && `${source.display_name} ${(source.categories || []).join(' ')}`.toLowerCase().includes(q)) results.push({ type: copy('source_kind'), name: source.display_name, href: `/connectors?q=${encodeURIComponent(source.source_id)}` });
    for (const connector of state.connectors.slice(0, 200)) if (q && `${connector.name} ${connector.provider} ${(connector.capabilities || []).join(' ')}`.toLowerCase().includes(q)) results.push({ type: copy('connector_kind'), name: connector.name, connectorId: connector.connector_id });
    const items = results.slice(0, 30).map(result => {
      if (result.connectorId) {
        const button = node('button'); button.type = 'button'; button.append(node('span', '', result.name), node('small', '', result.type)); button.addEventListener('click', () => { byId('searchDialog').close(); openConnector(result.connectorId); }); return button;
      }
      const link = node('a'); link.href = result.href; link.append(node('span', '', result.name), node('small', '', result.type)); return link;
    });
    replaceChildren(byId('globalSearchResults'), items.length ? items : [node('div', 'EmptyState NoDataState', copy('search_empty'))]);
  }

  async function exportRows() {
    try{
      const snapshot=await request(`/api/workspaces/${encodeURIComponent(state.workspaceId)}/snapshot`);
      if(snapshot?.workspace_id!==state.workspaceId||!Array.isArray(snapshot.rows))throw Error('workspace_observation_invalid');
      const rows=snapshot.rows;if(!rows.length)return toast(copy('export_empty'));
      const fields=recordDisplayFields(rows);if(!fields.length)return toast(copy('export_no_fields'),true);
      const quote=value=>{let text=String(value??'');if(typeof value==='string'&&/^[\s]*[=+@-]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""').replace(/[\r\n]+/g,' ')+'"';};
      const csv=[fields.map(quote).join(','),...rows.map(row=>fields.map(field=>quote(row[field])).join(','))].join('\r\n');
      const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),link=document.createElement('a');
      link.href=url;link.download=`foundly-${state.workspaceId}-${new Date().toISOString().slice(0,10)}.csv`;link.click();URL.revokeObjectURL(url);
    }catch(error){if(!error.stale)toast(friendlyError(error),true);}
  }

  async function askZero(event) {
    event.preventDefault();
    const input=byId('zeroInput'),message=input.value.trim();if(!message||input.disabled||!state.workspace)return;
    const ticket=++zeroTurn,epoch=accessGeneration,output=byId('zeroOutput');writeText(output,copy('zero_busy'));input.disabled=true;
    try{
      const result=await request('/api/zero/turn',{method:'POST',body:JSON.stringify({message,conversation_id:state.conversationId,preferred_module:state.workspace.module_id,client_context:{workspace_id:state.workspaceId,section:state.activeSection}})});
      if(ticket!==zeroTurn||epoch!==accessGeneration)return;
      state.conversationId=result.conversation_id||state.conversationId;writeText(output,result.display_text||result.text||result.answer||copy('zero_no_text'));
      if(input.value.trim()===message)input.value='';
    }catch(error){if(ticket===zeroTurn&&epoch===accessGeneration&&!error.stale)writeText(output,friendlyError(error));}
    finally{input.disabled=false;input.focus();}
  }

  async function submitProvisioner(event) {
    event.preventDefault();
    const form = event.currentTarget, payload = Object.fromEntries(new FormData(form));
    payload.channels = String(payload.channels || '').split(',').map(value => value.trim()).filter(Boolean);
    payload.existing_software = String(payload.existing_software || '').split(',').map(value => value.trim()).filter(Boolean);
    const output = byId('provisionerOutput'); output.textContent = 'Configuratie valideren…';
    try {
      const result = await request('/api/provisioner/resolve', { method: 'POST', body: JSON.stringify(payload) });
      output.className = 'workspace-notice success'; output.textContent = `Tenantconfiguratie gevalideerd: ${result.profile?.status || result.status || 'CONFIGURED'}. Geen businessdata aangemaakt.`;
      await loadWorkspaceData();
    } catch (error) { output.className = 'workspace-notice error'; output.textContent = friendlyError(error); }
  }

  function bindEvents() {
    byId('refreshWorkspace').addEventListener('click', async () => { try { await Promise.all([loadWorkspaceData(), reloadRegistries()]); toast(copy('refreshed')); } catch (error) { toast(friendlyError(error), true); } });
    byId('recordSearch').addEventListener('input', event => { state.recordQuery = event.target.value; renderRecords(); });
    byId('editDashboard').addEventListener('click', () => toggleEditing());
    byId('addWidget').addEventListener('click', openWidgetDialog);
    byId('saveDashboard').addEventListener('click', saveDashboard);
    byId('widgetForm').addEventListener('submit', addWidget);
    byId('exportWorkspace').addEventListener('click', exportRows);
    byId('zeroForm').addEventListener('submit', askZero);
    byId('provisionerForm').addEventListener('submit', submitProvisioner);
    byId('industryDashboardPreset').addEventListener('click',async()=>{const button=byId('industryDashboardPreset');button.disabled=true;try{await chooseIndustryPreset(state.workspaceId,'dashboard',selected=>{state.dashboard={...state.dashboard,name:selected.dashboard.name,widgets:selected.dashboard.widgets};toggleEditing(true);toast('Branchesjabloon overgenomen. Kies Opslaan om deze dashboardindeling te bewaren.');});}catch(error){toast(friendlyError(error),true);}finally{button.disabled=false;}});
    byId('dashboardScope').addEventListener('change', async event => {
      const qualified = ['TEAM', 'ROLE'].includes(event.target.value); byId('dashboardQualifierWrap').hidden = !qualified;
      try { await loadWorkspaceData(); } catch (error) { toast(friendlyError(error), true); }
    });
    byId('dashboardQualifier').addEventListener('change', async () => { try { await loadWorkspaceData(); } catch (error) { toast(friendlyError(error), true); } });
    for (const id of ['dateFrom', 'dateTo', 'comparePeriod', 'sourceFilter', 'statusFilter']) byId(id).addEventListener('change', () => { renderRecords(); renderSources(); updateNotice(); });
    byId('globalSearchButton').addEventListener('click', () => { renderSearchResults(); byId('searchDialog').showModal(); byId('globalSearchInput').focus(); });
    byId('globalSearchInput').addEventListener('input', event => renderSearchResults(event.target.value));
    document.addEventListener('keydown', event => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); byId('globalSearchButton').click(); }
    });
    for (const id of ['connectorCategory', 'connectorIndustry', 'connectorCapability', 'connectorAuth', 'connectorTenant', 'connectorState']) byId(id).addEventListener('change', renderConnectors);
    byId('sourceRegistrySearch').addEventListener('input', renderSourceRegistry);
    for (const id of ['sourceRegistryCategory', 'sourceRegistryCapability', 'sourceRegistryType', 'sourceRegistryStatus']) byId(id).addEventListener('change', renderSourceRegistry);
  }

  async function boot() {
    await globalThis.FoundlyI18n?.ready;
    bindEvents();
    try {
      const navigation = await request('/api/workspaces'); state.navigation = navigation.workspaces || []; renderNavigation();
      await Promise.all([loadWorkspaceData(), reloadRegistries()]);
      populateWorkspaceFilters();
      const query = new URLSearchParams(location.search);
      if (state.workspaceId === 'connectors' && query.get('q')) { byId('sourceRegistrySearch').value = query.get('q').slice(0, 120); renderSourceRegistry(); }
      applyDashboardFilters(); renderRecords(); renderSources(); updateNotice();
      if (query.get('connected')) toast('OAuth-callback is afgerond; de actuele probe bepaalt de uiteindelijke status.');
      if (query.get('error_code')) toast(query.get('error') || query.get('error_code'), true);
    } catch (error) {
      byId('workspaceNotice').className = 'workspace-notice error'; byId('workspaceNotice').textContent = friendlyError(error);
      byId('workspaceRuntime').textContent = 'RUNTIME ERROR'; byId('workspaceRuntime').className = 'ConnectionBadge error';
      byId('sidebarStatus').textContent = 'CHECK REQUIRED'; byId('sidebarStatusLight').className = 'error';
    }
  }

  document.addEventListener('foundly:locale',()=>{if(state.navigation?.length)renderNavigation();});
  boot();
})();
