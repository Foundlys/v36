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

  const SECTION_COPY = Object.freeze({
    EVENT_PREPARATION:['Afspraak voorbereiden','Van beschrijving naar gecontroleerde afspraakvelden en afzonderlijke bevestiging.'],
    OVERVIEW: ['Command dashboard', 'Werkelijke tenantdata, actuele bronstatus en operationele signalen voor deze workspace.'],
    DATASETS: ['Datasets', 'Canonical tenantdatasets met schema-, lineage-, freshness- en retentiecontracten.'],
    SOURCES: ['Sources', 'Bronbeschikbaarheid, provenance, laatste succesvolle observatie en recorddekking.'],
    INGESTION: ['Ingestion', 'Provider- en interne ingestie wordt alleen getoond wanneer een echte poging of record bestaat.'],
    SCHEMAS: ['Schemas', 'Versies en contracten van de canonical data layer; geen afgeleide schijnstatus.'],
    LINEAGE: ['Lineage', 'Herkomst en transformatieketen van persistente records.'],
    QUALITY: ['Data quality', 'Gevalideerde issues, afwijzingen en ontbrekende bewijsvelden.'],
    FRESHNESS: ['Freshness', 'Werkelijk gemeten bron- en recordactualiteit.'],
    CONFLICTS: ['Conflicts', 'Persistente synchronisatieconflicten die menselijke of deterministische oplossing vragen.'],
    SYNC: ['Sync', 'Connectorcheckpoints, pogingen en geïsoleerde fouten.'],
    RETENTION: ['Retention', 'Tenant- en bronspecifieke bewaarbeleidcontracten.'],
    OFFLINE: ['Offline', 'Durable outbox- en herstelstatus zonder lokale schijnsuccessen.'],
    EXPORTS: ['Exports', 'Permission-gated exports van uitsluitend zichtbare werkelijke records.'],
    EVIDENCE: ['Evidence', 'Ondersteunende bronnen en bewijsrelaties voor kennisobjecten.'],
    INSIGHTS: ['Insights', 'Gevalideerde inzichten met confidence en geldigheid.'],
    DOCUMENTS: ['Documents', 'Tenantdocumenten die door rechten en provenance worden begrensd.'],
    MEMORY: ['Memory', 'Begrensd en verwijderbaar tenantgeheugen.'],
    CONFIDENCE: ['Confidence', 'Vastgelegde confidence; niet beschikbare scores blijven onbekend.'],
    VALIDITY: ['Validity', 'Geldigheidsvensters en freshness van kennis.'],
    SUPERSESSION: ['Supersession', 'Versies en expliciete vervanging van achterhaalde kennis.'],
    SEARCH: ['Search', 'Zoeken binnen de werkelijke records en bronnen van deze workspace.'],
    AUDIT: ['Audit', 'Tenant-scoped acties en beslissingen met redacted metadata.'],
    RECOMMENDATIONS: ['Recommendations', 'Persistente aanbevelingen; modeloutput is geen bewezen resultaat.'],
    OUTCOMES: ['Outcomes', 'Werkelijk vastgelegde uitkomsten gekoppeld aan aanbevelingen.'],
    FEEDBACK: ['Feedback', 'Expliciete gebruikers- en systeemfeedback.'],
    SUCCESS: ['Confirmed success', 'Alleen geëvalueerde, bevestigde succesvolle uitkomsten.'],
    FAILURES: ['Failures', 'Geïsoleerde fouten en bevestigde negatieve uitkomsten.'],
    CALIBRATION: ['Calibration', 'Regelkalibratie op geëvalueerde uitkomsten; geen claim van automatische modeltraining.'],
    'RULE VERSIONS': ['Rule versions', 'Versiebeheer voor deterministische regels en besliscontracten.'],
    'MODEL VERSIONS': ['Model versions', 'Vastgelegde modelversies zonder onbewezen retrainingclaim.'],
    LESSONS: ['Lessons', 'Evidence-backed lessen uit feedback en uitkomsten.'],
    WORKFLOWS: ['Workflows', 'Versiebeheerde workflows binnen de bestaande Foundly Automation-engine.'],
    TRIGGERS: ['Triggers', 'Audited triggers met tenant- en idempotencygrenzen.'],
    ACTIONS: ['Actions', 'Geregistreerde acties; risicovolle uitvoer vereist expliciete bevestiging.'],
    RUNS: ['Runs', 'Werkelijke workflow-uitvoeringen met status en poging.'],
    APPROVALS: ['Approvals', 'Openstaande menselijke goedkeuringen voor high-risk acties.'],
    RETRIES: ['Retries', 'Begrensde retries met back-off en foutisolatie.'],
    DEPENDENCIES: ['Dependencies', 'Connector- en capability-afhankelijkheden per workflow.'],
    CONNECTED: ['Connected', 'Alleen connectors met autorisatie, geslaagde probe en vereiste bootstrap of sync.'],
    'AWAITING ACCESS': ['Awaiting access', 'Adapters die gereed zijn maar legitieme provider- of partnergoedkeuring vereisen.'],
    UNCONFIGURED: ['Unconfigured', 'Beschikbare connectorcontracten waarvoor nog configuratie nodig is.'],
    DEGRADED: ['Degraded', 'Gekoppelde providers met een aantoonbaar gedeeltelijk probleem.'],
    ERROR: ['Error', 'Connectorpogingen met een veilige foutcode; geheimen worden nooit weergegeven.'],
    ALL: ['Connector catalog', 'Het volledige centrale connectorregister met één truthful lifecycle.'],
    INBOX: ['Inbox', 'Tenantcommunicatie over werkelijk gekoppelde kanalen.'],
    EMAIL: ['Email', 'E-mailcapaciteit en records, alleen wanneer de provider werkelijk is gekoppeld.'],
    WHATSAPP: ['WhatsApp', 'WhatsApp Business-status en gesigneerde webhookrecords.'],
    CALENDAR: ['Calendar', 'Agenda-items uit interne of werkelijk gekoppelde agenda’s.'],
    VOICE: ['Voice', 'ZERO Realtime-capability zonder claim van voice cloning.'],
    NOTIFICATIONS: ['Notifications', 'Werkelijke tenantnotificaties en afleverstatus.'],
    TEMPLATES: ['Templates', 'Beheerde communicatieformats zonder automatische verzending.'],
    AUTOMATIONS: ['Automations', 'Veilige koppeling met de bestaande audited Automation-engine.'],
    CAMPAIGNS: ['Campaigns', 'Campagnegegevens uit canonical events en gekoppelde providers.'],
    META: ['Meta', 'Meta, Facebook en Instagram-capabilities met gescheiden configuratie en runtimebewijs.'],
    'GOOGLE ADS': ['Google Ads', 'Google Ads-data en measurementstatus zonder fictieve performance.'],
    SOCIAL: ['Social', 'Sociale kanalen en werkelijk beschikbare content- of leadrecords.'],
    LEADS: ['Leads', 'Canonical en CRM-gekoppelde leads met bronprovenance.'],
    ATTRIBUTION: ['Attribution', 'Versiebeheerde attributie zonder omzet- of margedubbeltelling.'],
    CONVERSIONS: ['Conversions', 'Provider- en canonical conversies met aparte ontvangst- en processingstatus.'],
    CREATIVE_REVIEWS: ['Creatieve beoordelingen', 'Exacte inhoud, aangewezen beoordelaars en vastgelegde besluiten. Goedkeuring publiceert niets.'],
    AUDIENCES: ['Audiences', 'Alleen providerbevestigde of persistente audience-objecten.'],
    CREATIVES: ['Creatives', 'Werkelijke creative records; niets wordt als live gepubliceerd zonder providerreceipt.'],
    MEASUREMENT: ['Measurement', 'Meta CAPI, GA4 Measurement Protocol en enhanced-conversion contracten.'],
    PROVISIONER: ['Auto-Provisioner', 'Configureert één tenant op de gedeelde Foundly Core; maakt geen klantfork of demo-businessdata.'],
    SECURITY: ['Security', 'Authenticatie, encryptie, toestemming en permission boundaries.'],
    PERSISTENCE: ['Persistence', 'Werkelijke storage- en mountstatus van de runtime.'],
    TENANT: ['Tenant', 'Actieve tenantidentiteit en capability-profiel.'],
    USERS: ['Users', 'Gebruikersbeheer blijft permission-gated.'],
    ROLES: ['Roles', 'Actieve rol- en permissioncontext.'],
    CAPABILITIES: ['Capabilities', 'Capability-aware toegang tot één gedeeld Foundly-systeem.'],
    ZERO: ['ZERO', 'De ene Foundly-assistent met gedeelde context, tools, geheugen en provenance.']
  });

  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined && text !== null) element.textContent = String(text);
    return element;
  }

  function replaceChildren(target, children = []) {
    target.replaceChildren(...children.filter(Boolean));
    return target;
  }

  function badge(value, extra = 'ConnectionBadge') {
    const normalized = String(value || 'UNKNOWN').toLowerCase().replace(/[^a-z0-9_-]+/g, '_');
    return node('span', `${extra} ${normalized}`, value || 'UNKNOWN');
  }

  async function request(path, options = {}) {
    const headers = { accept: 'application/json', ...(options.headers || {}) };
    if (options.body && !headers['content-type']) headers['content-type'] = 'application/json';
    const response = await fetch(path, { credentials: 'same-origin', ...options, headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.error || data.code || `HTTP ${response.status}`);
      error.status = response.status;
      error.code = data.code || 'request_failed';
      error.data = data;
      throw error;
    }
    return data;
  }

  function toast(message, isError = false) {
    const element = node('div', `toast${isError ? ' error' : ''}`, message);
    byId('toastRegion').append(element);
    window.setTimeout(() => element.remove(), 5000);
  }

  function friendlyError(error) {
    if (error?.status === 403) return 'Je hebt geen toestemming voor deze actie.';
    if (error?.status === 401) return 'De sessie is niet geautoriseerd.';
    return String(error?.message || 'De actie kon niet worden voltooid.').slice(0, 280);
  }

  function formatMetric(metric) {
    if (!metric || metric.available === false || metric.value === null || metric.value === undefined) return 'Geen data';
    const value = metric.value;
    if (metric.unit === 'CURRENCY_CENTS' && Number.isFinite(Number(value))) {
      return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: metric.currency||'EUR', maximumFractionDigits: 0 }).format(Number(value) / 100);
    }
    if (metric.unit === 'PERCENT' && Number.isFinite(Number(value))) return `${new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 2 }).format(Number(value))}%`;
    if (metric.unit === 'RATIO' && Number.isFinite(Number(value))) return `${new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 2 }).format(Number(value))}×`;
    if (typeof value === 'number') return new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 2 }).format(value);
    return String(value);
  }

  function renderNavigation() {
    const links = state.navigation.map(item => {
      const link = node('a', '', item.short_label || item.label);
      link.href = item.route;
      if (item.id === state.workspaceId) link.setAttribute('aria-current', 'page');
      return link;
    });
    replaceChildren(byId('globalNav'), links);
  }

  function renderTabs() {
    const tabs = (state.workspace?.sections || []).map((section, index) => {
      const button = node('button', index === 0 ? 'active' : '', section === 'FORECAST_HIERARCHIES' ? 'Prognosehiërarchie' : section === 'FORECAST_SNAPSHOTS' ? 'Bewaarde prognoses' : section === 'AWARDS' ? 'Voorstellen en beoordelingen' : section);
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
    state.activeSection = section;state.communicationZeroToken=(state.communicationZeroToken||0)+1;const zeroActions=byId('zeroActions');if(zeroActions)replaceChildren(zeroActions,[]);
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
    byId('metricDialogTitle').textContent = widget.label;
    const list = node('dl');
    const facts = [
      ['Waarde', formatMetric(metric)],
      ['Beschikbaar', metric?.available === false ? 'Nee' : 'Ja'],
      ['Eenheid', metric?.unit || 'VALUE'],
      ['Bron', metric?.source || 'SOURCE UNKNOWN'],
      ['Freshness', metric?.freshness || 'UNKNOWN'],
      ['Geobserveerd', state.snapshot?.observed_at ? new Date(state.snapshot.observed_at).toLocaleString('nl-NL') : 'Onbekend'],
      ['Workspace', state.workspace?.label || state.workspaceId]
    ];
    for (const [label, value] of facts) list.append(node('dt', '', label), node('dd', '', value));
    const note = node('p', 'panel-copy', metric?.detail ? String(metric.detail) : 'Deze drilldown toont uitsluitend de actuele server-side metric, bron en freshness. Er worden geen afgeleide of synthetische waarden toegevoegd.');
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
      card.draggable = state.editing;
      card.dataset.widgetId = widget.id;
      card.tabIndex = state.editing ? -1 : 0;
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', `${widget.label} drilldown openen`);
      card.append(node('h3', '', widget.label));
      card.append(node('strong', metric.available === false ? 'metric-value metric-unavailable' : 'metric-value', formatMetric(metric)));
      const meta = node('span', 'metric-meta', metric.available === false ? 'Geen werkelijke waarde beschikbaar' : `${metric.unit || 'VALUE'} · ${metric.freshness || 'UNKNOWN'}`);
      card.append(meta, node('span', 'widget-source', metric.source || 'SOURCE UNKNOWN'));
      const tools = node('div', 'widget-tools');
      const up = node('button', '', '↑'); up.type = 'button'; up.title = 'Naar voren';
      const down = node('button', '', '↓'); down.type = 'button'; down.title = 'Naar achteren';
      const size = node('button', '', widget.w >= 8 ? '−' : '+'); size.type = 'button'; size.title = 'Formaat wijzigen';
      const remove = node('button', '', '×'); remove.type = 'button'; remove.title = 'Widget verwijderen';
      up.addEventListener('click', () => moveWidget(index, -1));
      down.addEventListener('click', () => moveWidget(index, 1));
      size.addEventListener('click', () => resizeWidget(index));
      remove.addEventListener('click', () => removeWidget(index));
      tools.append(up, down, size, remove); card.append(tools);
      card.addEventListener('dragstart', () => { state.draggedWidget = widget.id; });
      card.addEventListener('dragover', event => { if (state.editing) event.preventDefault(); });
      card.addEventListener('drop', event => { event.preventDefault(); reorderWidget(state.draggedWidget, widget.id); });
      card.addEventListener('click', event => { if (!event.target.closest('.widget-tools')) openMetricDrilldown(widget, metric); });
      card.addEventListener('keydown', event => { if ((event.key === 'Enter' || event.key === ' ') && !state.editing) { event.preventDefault(); openMetricDrilldown(widget, metric); } });
      return card;
    });
    replaceChildren(grid, cards.length ? cards : [node('div', 'EmptyState NoDataState', 'Dit dashboard bevat nog geen widgets.')]);
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
    for (const field of fields) header.append(node('th', '', field.replaceAll('_', ' ')));
    replaceChildren(byId('recordHead'), fields.length ? [header] : []);
    const rows = safeRows.map(row => {
      const tr = node('tr');
      for (const field of fields) {
        let value = row[field];
        if (field.endsWith('_cents') && Number.isFinite(Number(value))) value = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(Number(value) / 100);
        tr.append(node('td', '', value === null || value === undefined || value === '' ? '—' : String(value).slice(0, 300)));
      }
      return tr;
    });
    replaceChildren(byId('recordRows'), rows);
    byId('recordEmpty').hidden = rows.length > 0;
    byId('recordCount').textContent = `${rows.length} / ${raw.length} RECORDS`;
    byId('recordsTitle').textContent = `${state.workspace?.short_label || 'Workspace'} records`;
  }

  function renderSources() {
    const sourceFilter = byId('sourceFilter').value, statusFilter = byId('statusFilter').value;
    const available = (state.snapshot?.sources?.length ? state.snapshot.sources : state.sources).filter(source => {
      if (sourceFilter && source.source_id !== sourceFilter) return false;
      if (statusFilter && ![source.connection_status, source.freshness_status].includes(statusFilter)) return false;
      return true;
    }).slice(0, 24);
    const rows = available.map(source => {
      const row = node('article', 'source-row');
      row.append(node('strong', '', source.display_name || source.name || source.source_id));
      row.append(badge(source.connection_status || source.freshness_status, 'FreshnessBadge'));
      const categories = (source.categories || []).slice(0, 3).join(' · ') || 'UNCATEGORIZED';
      row.append(node('p', '', `${categories} · ${Number(source.records_available || 0)} records · ${source.provenance_supported === false ? 'geen provenancecontract' : 'provenance actief'}`));
      return row;
    });
    replaceChildren(byId('sourceMatrix'), rows.length ? rows : [node('div', 'EmptyState NoDataState', 'Geen bronnen voor deze workspace beschikbaar.')]);
  }

  function fillSelect(select, values, current = '') {
    const first = select.firstElementChild?.cloneNode(true) || node('option', '', 'Alle');
    replaceChildren(select, [first, ...[...new Set(values.filter(Boolean))].sort().map(value => {
      const option = node('option', '', String(value).replaceAll('_', ' ')); option.value = value; return option;
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
    byId('connectorCount').textContent = `${connectors.length} / ${state.connectors.length} CONNECTORS`;
    const cards = connectors.map(connector => {
      const card = node('article', `ConnectorCard ${connector.connection_state === 'AWAITING_ACCESS' ? 'AwaitingAccessState' : ['DEGRADED', 'ERROR'].includes(connector.connection_state) ? 'DegradedState' : ''}`);
      const head = node('div', 'connector-card-head'), title = node('div');
      title.append(node('h3', '', connector.name), node('span', 'connector-provider', connector.provider));
      head.append(title, badge(connector.connection_state)); card.append(head);
      const categories = node('div', 'connector-categories');
      for (const category of (connector.category || []).slice(0, 4)) categories.append(node('span', '', category.replaceAll('_', ' ')));
      card.append(categories);
      const facts = node('div', 'connector-facts');
      for (const [label, value] of [['Config', connector.configuration_state], ['Authentication', connector.authentication_state], ['Probe', connector.probe_state], ['Last probe', connector.last_probe ? new Date(connector.last_probe).toLocaleString('nl-NL') : 'NOT RUN'], ['Latency', Number.isFinite(connector.latency) ? `${connector.latency} ms` : '—'], ['Sync', connector.sync_state], ['Freshness', connector.freshness], ['Records', connector.records]]) {
        const fact = node('div'); fact.append(node('span', '', label), node('strong', '', value ?? '—')); facts.append(fact);
      }
      card.append(facts);
      if (connector.requires_partner_approval && connector.connection_state !== 'CONNECTED') card.append(node('p', 'connector-warning', 'Legitieme provider- of partnergoedkeuring is vereist. Foundly fabriceert geen toegang.'));
      if (connector.safe_error) card.append(node('p', 'connector-safe-error', `Veilige foutcode: ${connector.safe_error}`));
      const actions = node('div', 'connector-card-actions'), inspect = node('button', '', connector.setup_action === 'INSPECT' ? 'Inspecteren' : 'Instellen');
      inspect.type = 'button'; inspect.addEventListener('click', () => openConnector(connector.connector_id)); actions.append(inspect); card.append(actions);
      return card;
    });
    replaceChildren(byId('connectorGrid'), cards.length ? cards : [node('div', 'EmptyState NoDataState', 'Geen connectors voldoen aan deze filters.')]);
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
    byId('sourceRegistryCount').textContent = `${sources.length} / ${state.sources.length} SOURCES`;
    const cards = sources.map(source => {
      const card = node('article', 'SourceRegistryCard'), header = node('header'), title = node('div');
      title.append(node('h3', '', source.display_name), node('span', '', `${source.source_id} · ${source.provider_id}`));
      header.append(title, badge(source.connection_status));
      const facts = node('div', 'source-registry-facts');
      facts.append(node('span', '', `Probe ${source.probe_status}`), node('span', '', `Sync ${source.sync_status}`), node('span', '', `Freshness ${source.freshness_status}`), node('span', '', `${Number(source.records_available || 0)} records`));
      const categories = node('div', 'connector-categories');
      for (const category of (source.categories || []).slice(0, 4)) categories.append(node('span', '', category.replaceAll('_', ' ')));
      card.append(header, node('p', '', source.description), categories, facts, node('p', '', source.provenance_supported ? 'Provenancecontract actief · tenant-scoped' : 'Geen provenancecontract'));
      return card;
    });
    replaceChildren(byId('sourceRegistryGrid'), cards.length ? cards : [node('div', 'EmptyState NoDataState', 'Geen bronnen voldoen aan deze filters.')]);
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

  async function openConnector(connectorId) {
    try {
      const [{ connector }, config] = await Promise.all([
        request(`/api/connector-registry/${encodeURIComponent(connectorId)}`),
        request(`/api/connector-runtime/config/${encodeURIComponent(connectorId)}`).catch(error => error.status === 404 ? null : Promise.reject(error))
      ]);
      byId('connectorDialogTitle').textContent = connector.name;
      const root = byId('connectorDetail'), summary = node('div', 'connector-detail-summary');
      summary.append(
        detailFact('Lifecycle', connector.connection_state), detailFact('Configuration', connector.configuration_state),
        detailFact('Authentication', connector.authentication_state), detailFact('Probe', connector.probe_state),
        detailFact('Sync', connector.sync_state), detailFact('Records', connector.records),
        detailFact('Last probe', connector.last_probe ? new Date(connector.last_probe).toLocaleString('nl-NL') : 'NOT RUN'),
        detailFact('Latency', Number.isFinite(connector.latency) ? `${connector.latency} ms` : '—'), detailFact('Freshness', connector.freshness)
      );
      const labels = ['OVERVIEW', 'CAPABILITIES', 'SETUP', 'AUTHENTICATION', 'DATA', 'SYNC', 'EVENTS', 'ERRORS', 'AUDIT'];
      const initialTab = connector.setup_action === 'INSPECT' ? 'OVERVIEW' : 'SETUP', tabs = node('div', 'connector-tabs');
      tabs.setAttribute('role', 'tablist');
      const panels = new Map();
      const panel = (label, children) => {
        const element = node('section', 'connector-tab-panel');
        element.id = `connector-panel-${label.toLowerCase()}`; element.setAttribute('role', 'tabpanel'); element.hidden = label !== initialTab;
        replaceChildren(element, children); panels.set(label, element); return element;
      };

      const overview = panel('OVERVIEW', [
        node('p', 'panel-copy', `${connector.name} is AVAILABLE in de canonieke registry. CONNECTED wordt uitsluitend gebruikt na geldige configuratie, autorisatie, providerprobe en vereiste bootstrap of sync.`),
        detailFact('Provider', connector.provider), detailFact('Documentatiecontract', connector.documentation_reference)
      ]);
      const capabilityList = node('div', 'capability-list');
      for (const capability of connector.capabilities || []) capabilityList.append(node('span', '', capability));
      const capabilities = panel('CAPABILITIES', [capabilityList, node('p', 'panel-copy', `Industrieën: ${(connector.industries || []).join(', ') || 'ALL'} · Tenant: ${connector.tenant_scope || 'CURRENT_TENANT_AND_DEALER'}.`)]);

      const setupChildren = [];
      setupChildren.push(node('p', 'connector-warning', connector.requires_partner_approval && connector.connection_state !== 'CONNECTED' ? 'Deze connector wacht op legitieme externe toegang. Configureer uitsluitend credentials die aan deze tenant zijn verstrekt.' : 'Geheimen worden encrypted opgeslagen en nooit teruggetoond. Reeds opgeslagen waarden blijven behouden wanneer een veld leeg blijft.'));
      const variableStatuses = connector.credential_contract?.environment_variable_status || (connector.credential_contract?.environment_variables || []).map(name => ({ name, present: false, runtime_visible: false }));
      if (variableStatuses.length) {
        setupChildren.push(node('p', 'panel-copy', 'Ondersteunde Railway-runtimevariabelen (alleen naam en runtimezichtbaarheid):'));
        const list = node('ul', 'runtime-variable-list');
        for (const variable of variableStatuses) {
          const item = node('li'), status = node('strong', variable.runtime_visible ? 'present' : 'absent', variable.runtime_visible ? 'RUNTIME VISIBLE' : 'ABSENT');
          item.append(node('span', '', variable.name), status); list.append(item);
        }
        setupChildren.push(list);
      }
      const form = node('form', 'connector-setup-form'); form.dataset.connectorId = connector.connector_id;
      const configuredFields = connector.credential_contract?.accepts_tenant_encrypted_configuration ? (connector.credential_contract?.fields || config?.credential_fields || []) : [];
      const fieldKeys = new Set();
      for (const field of configuredFields) {
        if (!field?.key || fieldKeys.has(field.key)) continue;
        fieldKeys.add(field.key);
        const label = node('label', '', field.label || field.key), input = node('input');
        input.name = field.key; input.type = field.secret === false ? 'text' : 'password'; input.autocomplete = 'new-password'; input.placeholder = config?.configured ? 'Opgeslagen — leeg laten om te behouden' : 'Voer tenantcredential in';
        label.append(input); form.append(label);
      }
      if (!form.children.length) form.append(node('p', 'panel-copy', connector.auth_type.includes('PUBLIC') ? 'Deze bron gebruikt publieke toegang en vereist geen credentials.' : 'Deze connector gebruikt centrale Railway- of OAuth-configuratie; er zijn geen losse tenantcredentialvelden nodig.'));
      setupChildren.push(form);
      const actions = node('div', 'connector-actions');
      if (form.querySelector('input')) { const save = node('button', 'primary-button', 'Encrypted opslaan'); save.type = 'submit'; actions.append(save); form.addEventListener('submit', saveConnector); }
      if (connector.callback_contract?.required) { const authorize = node('a', 'primary-button', 'Autoriseren'); authorize.href = oauthPath(connector); actions.append(authorize); }
      const test = node('button', 'secondary-button', 'Verbinding testen'); test.type = 'button'; test.addEventListener('click', () => testConnector(connector.connector_id)); actions.append(test);
      if (connector.connection_state === 'CONNECTED') { const sync = node('button', 'secondary-button', 'Synchroniseren'); sync.type = 'button'; sync.addEventListener('click', () => syncConnector(connector.connector_id)); actions.append(sync); }
      setupChildren.push(actions);
      const setup = panel('SETUP', setupChildren);
      const authentication = panel('AUTHENTICATION', [
        detailFact('Auth type', connector.auth_type), detailFact('State', connector.authentication_state),
        detailFact('Callback', connector.callback_contract?.required ? connector.callback_contract.route : 'NOT APPLICABLE'),
        node('p', 'panel-copy', `Required scopes: ${(connector.required_scopes || []).join(', ') || 'Geen expliciete scopes in het huidige contract.'}`)
      ]);
      const data = panel('DATA', [detailFact('Records', connector.records), detailFact('Freshness', connector.freshness), detailFact('Tenant scope', connector.tenant_scope), node('p', 'panel-copy', 'Records worden alleen geteld vanuit de bestaande tenant-scoped persistence- en provenanceketen.')]);
      const syncPanel = panel('SYNC', [detailFact('Sync state', connector.sync_state), detailFact('Last sync', connector.last_sync ? new Date(connector.last_sync).toLocaleString('nl-NL') : 'NOT RUN'), node('p', 'panel-copy', connector.connection_state === 'CONNECTED' ? 'Een handmatige sync is beschikbaar via SETUP.' : 'Sync blijft uitgeschakeld totdat de connector werkelijk CONNECTED is.')]);
      const eventsPanel = panel('EVENTS', [node('div', 'EmptyState NoDataState', 'Geen afzonderlijke connector-events zijn in dit registryantwoord opgenomen. Providerpogingen blijven in de bestaande audit- en attempt stores.')]);
      const errors = panel('ERRORS', [connector.safe_error ? node('p', 'connector-safe-error', connector.safe_error) : node('div', 'EmptyState NoDataState', 'Geen veilige providerfout geregistreerd.')]);
      const audit = panel('AUDIT', [detailFact('Contract', connector.documentation_reference), node('p', 'panel-copy', 'Configureer-, test- en syncacties lopen via de bestaande tenant-scoped runtime- en auditpaden; geheimwaarden worden niet gelogd of teruggestuurd.')]);
      for (const label of labels) {
        const button = node('button', label === initialTab ? 'active' : '', label); button.type = 'button'; button.setAttribute('role', 'tab'); button.setAttribute('aria-selected', String(label === initialTab)); button.setAttribute('aria-controls', panels.get(label).id);
        button.addEventListener('click', () => { for (const candidate of tabs.querySelectorAll('button')) { const active = candidate === button; candidate.classList.toggle('active', active); candidate.setAttribute('aria-selected', String(active)); } for (const [name, candidate] of panels) candidate.hidden = name !== label; });
        tabs.append(button);
      }
      replaceChildren(root, [summary, tabs, overview, capabilities, setup, authentication, data, syncPanel, eventsPanel, errors, audit]);
      byId('connectorDialog').showModal();
    } catch (error) { toast(friendlyError(error), true); }
  }

  async function saveConnector(event) {
    event.preventDefault();
    const form = event.currentTarget, credentials = {};
    for (const input of form.querySelectorAll('input')) if (input.value) credentials[input.name] = input.value;
    if (!Object.keys(credentials).length) return toast('Geen nieuwe credentialwaarden ingevuld.', true);
    try {
      await request(`/api/connector-runtime/config/${encodeURIComponent(form.dataset.connectorId)}`, { method: 'PUT', body: JSON.stringify({ credentials }) });
      for (const input of form.querySelectorAll('input')) input.value = '';
      toast('Connectorconfiguratie encrypted opgeslagen. Status wordt pas CONNECTED na verificatie.');
      await reloadRegistries();
    } catch (error) { toast(friendlyError(error), true); }
  }

  async function testConnector(connectorId) {
    try {
      const result = await request(`/api/connector-runtime/test/${encodeURIComponent(connectorId)}`, { method: 'POST', body: '{}' });
      const connected = Boolean(result.connector?.connected);
      toast(connected ? 'Providerprobe geslaagd.' : `Probe niet geslaagd: ${result.connector?.error || 'geen geverifieerde verbinding'}`, !connected);
      await reloadRegistries();
    } catch (error) { toast(friendlyError(error), true); }
  }

  async function syncConnector(connectorId) {
    try {
      const result = await request(`/api/connector-runtime/sync/${encodeURIComponent(connectorId)}`, { method: 'POST', body: '{}' });
      toast(`Sync afgerond: ${Number(result.ingested || 0)} records verwerkt.`);
      await loadWorkspaceData();
    } catch (error) { toast(friendlyError(error), true); }
  }

  function renderContext(section) {
    const [title, description] = SECTION_COPY[section] || [section.replaceAll('_', ' '), `Dit onderdeel gebruikt uitsluitend de bestaande ${state.workspace?.label || 'Foundly'}-contracten en werkelijke tenantdata.`];
    byId('contextEyebrow').textContent = `${state.workspace?.short_label || 'WORKSPACE'} · ${section}`;
    byId('contextTitle').textContent = title;
    byId('contextDescription').textContent = description;
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
    replaceChildren(content,[node('p','LoadingState','Gegevens voor dit onderdeel laden…')]);
    try{
      const result=await request(`/api/workspaces/${state.workspaceId}/sections/${encodeURIComponent(section)}`);if(state.activeSection!==section)return;
      const items=[];
      if(result.status==='NOT_IMPLEMENTED')items.push(node('p','EmptyState',result.reason));
      else if(result.status==='MODULE_UNAVAILABLE')items.push(node('p','EmptyState','Deze aanvullende module is niet actief.'));
      else if(result.status==='USE_WORKSPACE_EXPORT')items.push(node('p','','Gebruik de exportknop om de toegankelijke workspacegegevens te downloaden.'));
      else if(result.status==='OPEN_MODULE'){
        const target=state.navigation.find(item=>item.route===result.route);if(target){const link=node('a','primary-button',`Open ${target.label}`);link.href=target.route;items.push(link);}else items.push(node('p','EmptyState','Deze aanvullende module is niet actief.'));
      }
      for(const row of result.items||[]){
        const card=node('article','context-item'),heading=row.title||row.name||row.event_name||row.subject||row.source_name||row.connector_id||row.internal_id||row.id||section;
        card.append(node('h3','',typeof heading==='string'?heading:section));const list=node('dl');
        for(const [key,value] of Object.entries(row).filter(([,value])=>value!==undefined&&value!==null).slice(0,18)){
          const label=node('dt','',key.replaceAll('_',' ')),detail=node('dd','',typeof value==='object'?JSON.stringify(value):String(value));list.append(label,detail);
        }
        card.append(list);items.push(card);
      }
      if(!items.length)items.push(node('p','EmptyState','Geen toegankelijke gegevens voor dit onderdeel.'));
      replaceChildren(content,items);
    }catch(error){replaceChildren(content,[node('p','ErrorState',friendlyError(error))]);}
  }

  async function renderComposer(content) {
    replaceChildren(content,[node('p','LoadingState','Pakketconfiguratie laden…')]);
    try {
      const [catalog,current]=await Promise.all([request('/api/composition/catalog'),request('/api/composition')]);
      if(state.activeSection!=='CAPABILITIES')return;
      const form=node('form','domain-record-form'),industryLabel=node('label','','Branche'),industry=node('select'),bundleLabel=node('label','','Pakket'),bundle=node('select'),groups=node('div','composition-modules');
      for(const pack of Object.values(catalog.industries))if(pack.production){const option=node('option','',pack.industry_id==='GENERAL'?'Algemeen':pack.industry_id);option.value=pack.industry_id;industry.append(option);}
      industry.value=current.resolution.industry_id;industryLabel.append(industry);
      const custom=node('option','','Eigen samenstelling');custom.value='';bundle.append(custom);
      for(const name of Object.keys(catalog.bundles)){const option=node('option','',name);option.value=name;bundle.append(option);}bundleLabel.append(bundle);
      const choices=[];
      for(const module of catalog.modules){
        const group=node('fieldset'),legend=node('legend','',module.display_name),entitled=node('input'),enabled=node('input');
        entitled.type=enabled.type='checkbox';entitled.checked=current.resolution.entitlements.includes(module.module_id);enabled.checked=current.resolution.enabled_modules.includes(module.module_id);
        const accessLabel=node('label','','Pakketrecht'),activeLabel=node('label','','Actief');accessLabel.prepend(entitled);activeLabel.prepend(enabled);group.append(legend,accessLabel,activeLabel);
        const flags=[];for(const capability of module.provided_capabilities){const label=node('label','',capability.split(':')[1].replaceAll('_',' ')),input=node('input');input.type='checkbox';input.checked=current.profile?.capability_flags?.[capability]!==false;label.prepend(input);group.append(label);flags.push({capability,input});}
        entitled.addEventListener('change',()=>{if(!entitled.checked)enabled.checked=false;});enabled.addEventListener('change',()=>{if(enabled.checked)entitled.checked=true;});
        groups.append(group);choices.push({id:module.module_id,entitled,enabled,flags});
      }
      bundle.addEventListener('change',()=>{if(!bundle.value)return;for(const choice of choices)choice.entitled.checked=choice.enabled.checked=catalog.bundles[bundle.value].includes(choice.id);});
      const notice=node('p','','Uitgeschakelde modules verdwijnen uit navigatie en uitvoering. Bestaande gegevens blijven bewaard.'),preview=node('button','primary-button','Wijzigingen bekijken'),apply=node('button','','Samenstelling toepassen'),output=node('output','workspace-notice');
      output.setAttribute('aria-live','polite');preview.type='submit';apply.type='button';apply.hidden=true;
      form.append(industryLabel,bundleLabel,groups,notice,preview,apply,output);
      if(!current.can_manage){for(const input of form.querySelectorAll('input,select,button'))input.disabled=true;notice.textContent='Alleen de bevoegde platformbeheerder kan pakketrechten aanpassen.';}
      let prepared=null;
      form.addEventListener('change',()=>{prepared=null;apply.hidden=true;});
      form.addEventListener('submit',async event=>{event.preventDefault();preview.disabled=true;try{
        const payload={industry_id:industry.value,entitlements:choices.filter(c=>c.entitled.checked).map(c=>c.id),enabled_modules:choices.filter(c=>c.enabled.checked).map(c=>c.id),capability_flags:Object.fromEntries(choices.flatMap(c=>c.flags.map(f=>[f.capability,f.input.checked]))),expected_revision:current.resolution.revision};
        const result=await request('/api/composition/preview',{method:'POST',body:JSON.stringify(payload)});prepared=payload;apply.hidden=false;
        output.textContent=`Activeren: ${result.diff.enabled.join(', ')||'geen'}. Uitschakelen: ${result.diff.disabled.join(', ')||'geen'}. ${result.diff.industry_changed?'Branche wordt gewijzigd. ':''}Gegevens worden niet verwijderd.`;
      }catch(error){output.textContent=friendlyError(error);}finally{preview.disabled=false;}});
      apply.addEventListener('click',async()=>{if(!prepared)return;apply.disabled=true;try{await request('/api/composition',{method:'PUT',body:JSON.stringify(prepared)});const nav=await request('/api/workspaces');state.navigation=nav.workspaces;renderNavigation();await renderComposer(content);toast('Samenstelling opgeslagen.');}catch(error){output.textContent=friendlyError(error);apply.disabled=false;}});
      replaceChildren(content,[form]);
    }catch(error){replaceChildren(content,[node('p','ErrorState',friendlyError(error))]);}
  }

  async function renderIdentityUsers(section,content){
    replaceChildren(content,[node('p','LoadingState','Gebruikerscontext laden…')]);
    try{
      const session=await request('/api/identity/session'),items=[];
      if(!session.authenticated){const link=node('a','','Persoonlijk aanmelden');link.href='/login';replaceChildren(content,[link]);return;}
      const self=node('article','context-item');self.append(node('h3','','Huidige gebruiker'),node('p','',session.principal.id),node('p','',`Rollen: ${session.principal.roles.join(', ')}`));
      if(session.principal.permissions.length)self.append(node('p','',`Extra modulerechten: ${session.principal.permissions.join(', ')}`));
      if(session.authentication_method==='MEMBER_SESSION'){const logout=node('button','','Uitloggen');logout.type='button';logout.addEventListener('click',async()=>{logout.disabled=true;try{await request('/api/identity/logout',{method:'POST',body:'{}'});location.assign('/login');}catch(error){toast(friendlyError(error),true);logout.disabled=false;}});self.append(logout);}
      items.push(self);
      if(section==='ROLES'||!session.can_manage){if(!session.can_manage)items.push(node('p','','Gebruikersbeheer vereist Founder- of Super Admin-rechten.'));replaceChildren(content,items);return;}
      const data=await request('/api/identity/users');if(state.activeSection!==section)return;
      const invitation=node('div');invitation.setAttribute('role','status');
      const showInvitation=result=>{const label=node('label','','Persoonlijke uitnodigingslink'),link=node('textarea');link.value=result.enrollment_url;link.readOnly=true;label.append(link);replaceChildren(invitation,[node('p','',`Uitnodiging aangemaakt, nog niet verstuurd. Geldig tot ${new Date(result.expires_at).toLocaleString('nl-NL')}. Deel deze link persoonlijk; de ontvanger kiest een eigen wachtwoord.`),label]);};
      function memberForm(member){
        const form=node('form','domain-record-form'),notice=node('output');notice.setAttribute('role','status');const fields={};
        if(!member)for(const [name,label]of [['username','Gebruikersnaam'],['display_name','Naam']]){const wrap=node('label','',label),input=node('input');input.required=true;input.maxLength=200;wrap.append(input);form.append(wrap);fields[name]=input;}
        const roles=node('fieldset'),permissions=node('details'),roleInputs=[],permissionInputs=[];roles.append(node('legend','','Rollen'));permissions.append(node('summary','','Extra modulerechten'));
        for(const [values,container,controls,selected]of [[data.roles,roles,roleInputs,member?.roles||['VIEWER']],[data.permissions,permissions,permissionInputs,member?.permissions||[]]])for(const value of values){const label=node('label','',value),input=node('input');input.type='checkbox';input.value=value;input.defaultChecked=selected.includes(value);input.checked=input.defaultChecked;label.append(input);container.append(label);controls.push(input);}
        form.append(roles,permissions);let status;
        if(member){const wrap=node('label','','Accountstatus');status=node('select');for(const value of !member.enrolled?['SUSPENDED']:['ACTIVE','SUSPENDED']){const option=node('option','',value==='ACTIVE'?'Actief':'Geblokkeerd');option.value=value;status.append(option);}status.value=member.status==='INVITED'?'SUSPENDED':member.status;wrap.append(status);form.append(wrap);}
        const reasonLabel=node('label','','Reden voor deze toegang'),reason=node('input'),confirmLabel=node('label','','Ik heb de gebruiker, rollen en gevolgen gecontroleerd'),confirm=node('input'),save=node('button','primary-button',member?'Toegang wijzigen en oude sessies intrekken':'Uitnodiging aanmaken');reason.required=true;reason.maxLength=500;reasonLabel.append(reason);confirm.type='checkbox';confirm.required=true;confirmLabel.append(confirm);save.type='submit';form.append(reasonLabel,confirmLabel,save,notice);
        form.addEventListener('submit',async event=>{event.preventDefault();save.disabled=true;try{const payload={roles:roleInputs.filter(input=>input.checked).map(input=>input.value),permissions:permissionInputs.filter(input=>input.checked).map(input=>input.value),reason:reason.value.trim(),confirm:confirm.checked,...(member?{status:status.value,expected_revision:member.revision}:{username:fields.username.value.trim(),display_name:fields.display_name.value.trim()})};const result=await request('/api/identity/users'+(member?'/'+encodeURIComponent(member.id):''),{method:member?'PUT':'POST',body:JSON.stringify(payload)});if(member)await renderIdentityUsers(section,content);else{showInvitation(result);form.reset();notice.textContent='De uitnodiging staat hieronder. Vernieuw de gebruikerslijst na het delen.';}}catch(error){notice.textContent=friendlyError(error);}finally{save.disabled=false;}});
        if(member&&!member.enrolled){const renew=node('button','','Nieuwe uitnodigingslink maken');renew.type='button';form.append(renew);renew.addEventListener('click',async()=>{if(!reason.reportValidity()||!confirm.reportValidity())return;renew.disabled=true;try{const result=await request(`/api/identity/users/${encodeURIComponent(member.id)}/reissue`,{method:'POST',body:JSON.stringify({expected_revision:member.revision,confirm:confirm.checked,reason:reason.value.trim()})});showInvitation(result);notice.textContent='De eerdere uitnodigingslink is nu ongeldig. Vernieuw de lijst vóór een volgende wijziging.';}catch(error){notice.textContent=friendlyError(error);renew.disabled=false;}});}
        return form;
      }
      items.push(node('h3','','Nieuwe gebruiker'),memberForm(null),invitation);
      const refresh=node('button','','Gebruikerslijst vernieuwen');refresh.type='button';refresh.addEventListener('click',()=>renderIdentityUsers(section,content));items.push(refresh);
      for(const member of data.items){const card=node('details','context-item');card.append(node('summary','',`${member.display_name} · ${member.username} · ${member.status}`),node('p','',`Gebruikers-ID: ${member.id}`),node('p','',`Revisie ${member.revision} · ${member.roles.join(', ')}`),memberForm(member));items.push(card);}
      replaceChildren(content,items);
    }catch(error){replaceChildren(content,[node('p','ErrorState',friendlyError(error))]);}
  }

  async function renderAutomationSection(section,content,query={}) {
    const token=state.automationQueryToken=(state.automationQueryToken||0)+1;
    replaceChildren(content,[node('p','LoadingState','Workflowgegevens laden…')]);
    try {
      const workflowSections=['WORKFLOWS','TRIGGERS','ACTIONS','DEPENDENCIES'],data=workflowSections.includes(section)?await request('/api/automation/workflows'):{};if(state.activeSection!==section||token!==state.automationQueryToken)return;
      const result=[];let page;
      if(!workflowSections.includes(section)){
        const defaults=section==='APPROVALS'?{status:'AWAITING_APPROVAL'}:section==='FAILURES'?{status:'ERROR,BLOCKED,DEAD_LETTER,RECOVERY_READY,RUNNING'}:section==='RETRIES'?{retried:'true'}:{},filters={...defaults,...query,limit:'50'};
        page=await request('/api/automation/runs?'+new URLSearchParams(filters));if(token!==state.automationQueryToken)return;data.runs=page.items;const composition=await request('/api/composition');if(token!==state.automationQueryToken)return;data.can_manage=page.can_manage&&composition.resolution.capabilities.includes('automation:workflows');data.retryable_actions=page.retryable_actions;data.can_approve=data.can_manage&&composition.resolution.capabilities.includes('automation:approvals');
        const form=node('form','domain-record-form'),search=node('input'),label=node('label','','Zoek op run, workflow, event, stap of foutmelding'),status=node('select'),statusLabel=node('label','','Uitvoerstatus'),find=node('button','secondary-button','Zoeken');search.value=query.q||'';search.maxLength=200;label.append(search);
        for(const value of ['', 'RUNNING','PLANNED','SUCCEEDED','ERROR','BLOCKED','AWAITING_APPROVAL','WAITING_TIME','WAITING_RETRY','DEAD_LETTER','RECOVERY_READY']){const option=node('option','',value||'Alle statussen');option.value=value;status.append(option);}status.value=query.status||'';statusLabel.append(status);find.type='submit';form.append(label,statusLabel,find);form.addEventListener('submit',event=>{event.preventDefault();renderAutomationSection(section,content,{q:search.value.trim(),...(status.value?{status:status.value}:{}),offset:'0'});});result.push(form,node('p','',`${page.total} toegankelijke uitvoeringen · vanaf ${page.offset+1}`));
        const navigation=node('div');for(const [title,offset]of [['Vorige',page.offset>=50?page.offset-50:null],['Volgende',page.next_offset]]){const button=node('button','secondary-button',title);button.type='button';button.disabled=offset===null;button.addEventListener('click',()=>renderAutomationSection(section,content,{...query,offset:String(offset)}));navigation.append(button);}result.push(navigation);
      }
      if(section==='WORKFLOWS'&&data.can_manage){
        const drafts=await request('/api/automation/drafts'),editorBox=node('div'),chooser=node('select'),label=node('label','','Bewaard concept'),open=node('button','secondary-button','Concept openen'),message=node('output');
        chooser.append(node('option','','Nieuw concept'));chooser.firstChild.value='';for(const draft of drafts.items){const option=node('option','',`${draft.draft.name||'Naamloos concept'} · revisie ${draft.revision}`);option.value=draft.id;chooser.append(option);}label.append(chooser);open.type='button';
        const show=draft=>{const editor=window.FoundlyWorkflowEditor.create({document,spec:data.editor_contract,request,draft,zeroRequest:async(action,turnId)=>{if(!editor.isConnected||!content.isConnected||state.workspaceId!=='automation'||state.activeSection!==section)throw Error('De workflowweergave is niet meer actief.');const response=await request('/api/zero/turn',{method:'POST',body:JSON.stringify({message:action.operation==='SAVE'?'Bewaar het expliciet bevestigde workflowconcept':'Bereid het gekozen workflowconcept voor',conversation_id:state.conversationId,turn_id:turnId,preferred_module:'automation',client_context:{automation_action:action}})});if(!editor.isConnected||!content.isConnected||state.workspaceId!=='automation'||state.activeSection!==section)throw Error('De workflowweergave is niet meer actief.');state.conversationId=response.conversation_id||state.conversationId;return response.automation_data;},onSaved:()=>renderAutomationSection(section,content)});editorBox.replaceChildren(editor);};show();
        open.addEventListener('click',()=>{if(editorBox.querySelector('form')?.dataset.unsaved==='true'){message.textContent='Bewaar eerst je huidige invoer, of bewaar deze als nieuw concept.';return;}try{show(drafts.items.find(row=>row.id===chooser.value)||null);message.textContent='';}catch(error){message.textContent=error.message;}});
        const template=node('button','secondary-button','Branchesjabloon kiezen');template.type='button';
        template.addEventListener('click',async()=>{if(editorBox.querySelector('form')?.dataset.unsaved==='true'){message.textContent='Bewaar eerst je huidige invoer, of bewaar deze als nieuw concept.';return;}template.disabled=true;try{await chooseIndustryPreset('automation','workflow',selected=>{show({draft:selected.draft});message.textContent='Sjabloon geopend als nieuw concept. Bewaar het concept of controleer de workflowversie voordat je deze opslaat.';});}catch(error){message.textContent=friendlyError(error);}finally{template.disabled=false;}});
        const language=window.FoundlyWorkflowGenerator.create({document,spec:data.editor_contract,zeroRequest:async(action,turnId)=>{
          const active=()=>language.isConnected&&content.isConnected&&state.workspaceId==='automation'&&state.activeSection===section;if(!active())throw Error('De workflowweergave is niet meer actief.');
          const response=await request('/api/zero/turn',{method:'POST',body:JSON.stringify({message:action.operation==='GENERATE'?'Bereid een workflow uit mijn beschrijving voor':'Bewaar het gecontroleerde workflowvoorstel',conversation_id:state.conversationId,turn_id:turnId,preferred_module:'automation',client_context:{automation_action:action}})});
          if(!active())throw Error('De workflowweergave is niet meer actief.');state.conversationId=response.conversation_id||state.conversationId;return response.automation_data;
        },onSaved:record=>{const index=drafts.items.findIndex(row=>row.id===record.id);if(index>=0)drafts.items[index]=record;else{drafts.items.push(record);const option=node('option','',`${record.draft.name} · revisie ${record.revision}`);option.value=record.id;chooser.append(option);}chooser.value=record.id;}});
        result.push(language,label,open,template,message,editorBox);
      }
      const rows=workflowSections.includes(section)?data.workflows:data.runs;
      for(const row of rows||[]){
        const card=node('article','context-item');card.append(node('h3','',row.name||row.run_id),node('p','',workflowSections.includes(section)?`Versie ${row.version} · ${row.effective_enabled?'Actief':'Gepauzeerd of uitgeschakeld'}`:row.status));
        if(['TRIGGERS','WORKFLOWS'].includes(section))card.append(node('p','',`Trigger: ${row.trigger?.type||'—'}`));
        if(['ACTIONS','WORKFLOWS'].includes(section))for(const action of row.actions||[])card.append(node('p','',`${action.type} · ${action.title||action.message||''}`));
        if(section==='DEPENDENCIES')card.append(node('p','',`Acties: ${(row.actions||[]).map(a=>a.type).join(', ')}. Rechten worden opnieuw gecontroleerd bij uitvoering.`));
        if(row.run_id)card.append(window.FoundlyWorkflowInspector.create({document,run:row,request,isActive:()=>content.isConnected&&state.workspaceId==='automation'&&state.activeSection===section}));
        if(row.steps)for(const step of row.steps)card.append(node('p','',`${step.index+1}. ${step.type}: ${step.status}${step.attempts?` · ${step.attempts} poging(en)`:''}${step.error?` (${step.error})`:''}`));
        if(['WAITING_RETRY','WAITING_TIME'].includes(row.status)){
          card.append(node('p','',`Volgende poging vanaf ${new Date(row.next_wakeup_at).toLocaleString('nl-NL')}. Eerdere resultaten blijven behouden.`));
          if(data.can_manage){const resume=node('button','','Hervatten zodra wachttijd verstreken is'),notice=node('output');resume.type='button';notice.setAttribute('role','status');card.append(resume,notice);resume.addEventListener('click',async()=>{resume.disabled=true;try{const result=await request(`/api/automation/workflows/${row.automation_id}/runs`,{method:'POST',body:JSON.stringify({event:row.trigger,options:{inputs:row.inputs}})});notice.textContent=['WAITING_RETRY','WAITING_TIME'].includes(result.status)?'De wachttijd is nog niet verstreken.':`Uitkomst: ${result.status}`;}catch(error){notice.textContent=friendlyError(error);}finally{resume.disabled=false;}});}
        }
        if(data.can_manage&&row.can_recover&&row.steps?.some(step=>['RUNNING','FAILED','DEAD_LETTER','BLOCKED'].includes(step.status)&&(data.retryable_actions||[]).includes(step.type))){
          const inspect=node('button','','Controleer opgeslagen resultaat'),notice=node('output');inspect.type='button';notice.setAttribute('role','status');card.append(inspect,notice);
          inspect.addEventListener('click',async()=>{inspect.disabled=true;try{const preview=await request(`/api/automation/runs/${row.run_id}/recovery`),absent=preview.action==='PREPARE_VERIFIED_ABSENT_INTERNAL_RETRY',form=node('form'),label=node('label','','Reden voor herstel'),reason=node('input'),confirmLabel=node('label','',absent?'Ik heb de bewezen afwezigheid en deze afzonderlijke voorbereiding van een nieuwe poging gecontroleerd':'Ik heb deze interne record en revisie gecontroleerd'),confirm=node('input'),save=node('button','',absent?'Nieuwe poging afzonderlijk voorbereiden':'Bewezen stap als voltooid vastleggen');reason.required=true;reason.maxLength=500;label.append(reason);confirm.type='checkbox';confirm.required=true;confirmLabel.append(confirm);save.type='submit';form.append(node('p','',absent?`Geen interne ${preview.evidence.entity}-record met deze uitvoersleutel gevonden. Dit is geen voltooiing. Bevestigen bereidt alleen een nieuwe poging voor; hervatten is een afzonderlijke stap.`:`Gevonden: ${preview.evidence.entity} · ${preview.evidence.record_id} · revisie ${preview.evidence.record_revision}. Volgende stappen worden nog niet uitgevoerd.`),label,confirmLabel,save);card.append(form);
            form.addEventListener('submit',async event=>{event.preventDefault();save.disabled=true;try{await request(`/api/automation/runs/${row.run_id}/recovery`,{method:'POST',body:JSON.stringify({preview_fingerprint:preview.preview_fingerprint,reason:reason.value.trim(),confirm:confirm.checked})});await renderAutomationSection(section,content);}catch(error){notice.textContent=friendlyError(error);save.disabled=false;}});
          }catch(error){notice.textContent=friendlyError(error);inspect.disabled=false;}});
        }
        if(row.status==='RECOVERY_READY'&&data.can_manage&&row.can_recover){
          const resume=node('button','','Gecontroleerde run verder uitvoeren'),notice=node('output');resume.type='button';notice.setAttribute('role','status');card.append(resume,notice);resume.addEventListener('click',async()=>{resume.disabled=true;try{await request(`/api/automation/workflows/${row.automation_id}/runs`,{method:'POST',body:JSON.stringify({event:row.trigger,options:{inputs:row.inputs}})});await renderAutomationSection(section,content);}catch(error){notice.textContent=friendlyError(error);resume.disabled=false;}});
        }
        if(row.status==='DEAD_LETTER')card.append(node('p','','Het maximumaantal pogingen is bereikt. Deze run blijft bewaard voor beoordeling en wordt niet automatisch herhaald.'));
        if(section==='WORKFLOWS'&&data.can_manage&&row.can_activate){
          const controls=node('form'),label=node('label','','Reden voor versieactivatie of pauze'),reason=node('input'),confirmationLabel=node('label','','Ik heb de versie en gevolgen voor nieuwe en wachtende runs gecontroleerd'),confirmation=node('input'),activate=node('button','','Alleen deze versie activeren'),pause=node('button','','Alle versies van deze workflow pauzeren'),notice=node('output');reason.required=true;reason.maxLength=500;label.append(reason);confirmation.type='checkbox';confirmation.required=true;confirmationLabel.append(confirmation);activate.type=pause.type='submit';activate.value='activate';pause.value='pause';pause.disabled=row.activation_mode==='PAUSED';notice.setAttribute('role','status');controls.append(label,confirmationLabel,activate,pause,notice);card.append(controls);
          controls.addEventListener('submit',async event=>{event.preventDefault();const active=event.submitter?.value==='activate';activate.disabled=pause.disabled=true;try{await request(`/api/automation/workflows/${row.id}/activation`,{method:'PUT',body:JSON.stringify({active,confirm:confirmation.checked,expected_revision:row.activation_revision,reason:reason.value.trim()})});await renderAutomationSection(section,content);}catch(error){notice.textContent=friendlyError(error);activate.disabled=false;pause.disabled=row.activation_mode==='PAUSED';}});
        }
        if(section==='WORKFLOWS'&&data.can_manage)appendManualWorkflowRun(row,card,content);
        if(section==='APPROVALS'&&data.can_approve){
          const form=node('form'),label=node('label','','Reden voor goedkeuring van deze run'),input=node('input'),button=node('button','','Exacte run goedkeuren'),notice=node('output');input.required=true;input.maxLength=500;label.append(input);button.type='submit';form.append(label,button,notice);
          form.addEventListener('submit',async event=>{event.preventDefault();button.disabled=true;try{await request(`/api/automation/workflows/${row.automation_id}/runs`,{method:'POST',body:JSON.stringify({event:row.trigger,options:{inputs:row.inputs,approval:{run_id:row.run_id,request_signature:row.request_signature,reference:crypto.randomUUID(),reason:input.value.trim()}}})});await renderAutomationSection(section,content);}catch(error){notice.textContent=friendlyError(error);button.disabled=false;}});card.append(form);
        }
        result.push(card);
      }
      if(!rows?.length)result.push(node('p','EmptyState','Geen workflows of runs voor dit onderdeel.'));
      if(section==='RETRIES')result.push(node('p','','Alleen ondersteunde acties met een vastgelegd retrybeleid worden na tijdelijke fouten herhaald. Een onderbroken stap met onbekende uitkomst vereist afzonderlijke beoordeling.'));
      replaceChildren(content,result);
    }catch(error){replaceChildren(content,[node('p','ErrorState',friendlyError(error))]);}
  }

  function appendManualWorkflowRun(workflow,card,content){
    const contract=window.FoundlyWorkflowAuthoring,form=node('form','domain-record-form'),referenceLabel=node('label','','Unieke referentie voor deze handmatige uitvoering'),reference=node('input'),button=node('button','','Workflow uitvoeren'),notice=node('output'),fields={};
    reference.required=true;reference.maxLength=200;reference.value=crypto.randomUUID();referenceLabel.append(reference);form.append(referenceLabel);notice.setAttribute('role','status');
    try{
      for(const field of contract.runFields(workflow)){
        if(field.fixed){form.append(node('p','',field.path+' volgt de uitvoerreferentie en de huidige workflowcontext.'));continue;}
        const holder=node('fieldset'),legend=node('legend','',field.path),typeLabel=node('label','','Invoertype'),type=node('select'),valueLabel=node('label','','Waarde'),value=node('input');value.maxLength=12000;
        for(const [id,label]of [['absent','Niet meegeven'],['text','Tekst'],['number','Getal'],['boolean','Boolean (true / false)'],['null','Leeg (null)']]){const option=node('option','',label);option.value=id;type.append(option);}type.value='absent';typeLabel.append(type);valueLabel.append(value);holder.append(legend,typeLabel,valueLabel);form.append(holder);
        const sync=()=>{valueLabel.hidden=['absent','null'].includes(type.value);value.disabled=valueLabel.hidden;value.required=['number','boolean'].includes(type.value);};type.addEventListener('change',sync);sync();fields[field.path]={type,value};
      }
    }catch(error){card.append(node('p','ErrorState',friendlyError(error)));return;}
    form.append(node('p','','Deze invoer hoort bij een handmatige uitvoering. Dezelfde referentie met dezelfde invoer herhaalt geen voltooide stappen. Een andere invoer vereist een nieuwe referentie.'),button,notice);button.type='submit';button.disabled=!workflow.effective_enabled;card.append(form);let pending=false;
    if(window.FoundlyWorkflowRunZero){const zero=window.FoundlyWorkflowRunZero.create({document,workflow,inputHost:form,getInput:()=>contract.manualRunInput(workflow,reference.value.trim(),Object.fromEntries(Object.entries(fields).map(([path,field])=>[path,{type:field.type.value,value:field.value.value}]))),canRequest:()=>!pending&&workflow.effective_enabled&&form.isConnected&&content.isConnected,onBusy:value=>{pending=value;form.inert=value;button.disabled=value||!workflow.effective_enabled;},zeroRequest:async(action,turnId)=>{if(!form.isConnected||!content.isConnected)throw Error('De workflowweergave is niet meer actief.');const response=await request('/api/zero/turn',{method:'POST',body:JSON.stringify({message:action.operation==='RUN_PREVIEW'?'Controleer deze workflowuitvoering':'Start de afzonderlijk bevestigde workflowuitvoering',conversation_id:state.conversationId,turn_id:turnId,preferred_module:'automation',client_context:{automation_action:action}})});if(!form.isConnected||!content.isConnected)throw Error('De workflowweergave is niet meer actief.');state.conversationId=response.conversation_id||state.conversationId;return response.automation_data;}});card.append(zero);}
    form.addEventListener('submit',async event=>{
      event.preventDefault();if(pending||!workflow.effective_enabled||!form.isConnected||!content.isConnected)return;
      try{
        const payload=contract.manualRunInput(workflow,reference.value.trim(),Object.fromEntries(Object.entries(fields).map(([path,field])=>[path,{type:field.type.value,value:field.value.value}])));
        pending=true;button.disabled=true;form.inert=true;
        const run=await request(`/api/automation/workflows/${workflow.id}/runs`,{method:'POST',body:JSON.stringify(payload)});
        if(!form.isConnected||!content.isConnected)return;notice.textContent=`Uitkomst: ${run.status}${run.replayed?' · bestaande uitvoering opnieuw opgehaald':''}`;
      }catch(error){if(form.isConnected&&content.isConnected)notice.textContent=friendlyError(error);}finally{pending=false;form.inert=false;button.disabled=!workflow.effective_enabled;}
    });
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
        const card=node('article','context-item'),at=new Intl.DateTimeFormat('nl-NL',{timeZone:slot.timezone,dateStyle:'medium',timeStyle:'short'}).format(new Date(slot.start_at)),button=node('button','secondary-button',`Bevestig ${at}`);button.type='button';card.append(node('p','',`${at} · ${slot.timezone}`),button);
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

    parent.append(node('p','',`${result.filters.from} t/m ${result.filters.to} · vastgelegd ${new Date(result.observed_at).toLocaleString('nl-NL')}. Gewogen kansen zijn geen geboekte omzet.`));
    if(!result.available)parent.append(node('p','','Geen bruikbare kansen binnen deze periode.'));
    for(const group of result.groups){const money=value=>value===null?'Niet beschikbaar':new Intl.NumberFormat('nl-NL',{style:'currency',currency:group.currency}).format(value/100);parent.append(node('p','',`${group.currency}: open ${money(group.open_cents)} · gewogen ${money(group.weighted_cents)} · gewonnen ${money(group.won_cents)} · ${group.probability_missing_count} open kansen zonder kanspercentage`));}
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
        const item=node('div');item.append(node('p','',`${bid.title} · ${bid.comparable?new Intl.NumberFormat('nl-NL',{style:'currency',currency:comparison.currency}).format(bid.total_cents/100):'Niet vergelijkbaar: '+bid.reasons.join(', ')} · Levertijd: ${bid.delivery_days===null?'niet vastgelegd':bid.delivery_days+' dagen'} · Herkomst: ${bid.evidence_reference}`));
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
        const allocationTransport=node('select'),transportLabel=node('label','','Bediening');for(const [value,title]of [['native','Native Procurement'],['zero','ZERO']]){const option=node('option','',title);option.value=value;allocationTransport.append(option);}allocationTransport.value='native';transportLabel.append(allocationTransport);allocationForm.append(transportLabel);
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
      box.prepend(node('p','',`Totaal: ${new Intl.NumberFormat('nl-NL',{style:'currency',currency:preview.currency}).format(preview.value_cents/100)}`));for(const line of preview.allocation_lines||[])box.append(node('p','',`${line.item_id}: ${line.quantity} × ${(line.unit_price_cents/100).toFixed(2)} ${preview.currency} · ${line.supplier_id} · ${line.evidence_reference}`));
      if(preview.allocation_kind==='ITEM_INCREMENTAL'){box.append(node('p','',`Eerder goedgekeurd: ${(preview.previously_approved_cents/100).toFixed(2)} ${preview.currency} · cumulatieve beoordelingsgrondslag: ${(preview.approval_basis_cents/100).toFixed(2)} ${preview.currency}`));for(const line of preview.remaining_lines)box.append(node('p','',`${line.item_id}: eerder ${line.previously_approved_quantity}, nu ${line.selected_quantity}, hierna resterend ${line.remaining_quantity}`));}
      box.prepend(node('p','',`Verplichte beoordelingsvolgorde: ${preview.approval_steps.join(' → ')}. Dit legt een intern voorstel vast.`));form.append(label,submit);box.append(form);const key=crypto.randomUUID();
      form.addEventListener('submit',async event=>{event.preventDefault();submit.disabled=true;try{await call(basePath+(order?'/approvals':'/awards'),{method:'POST',headers:{'idempotency-key':key},body:JSON.stringify({...(!order?(allocations?{allocations,...(allocationMode==='INCREMENTAL'?{allocation_mode:'INCREMENTAL'}:{})}:{bid_id:bid.id}):{}),preview_fingerprint:preview.preview_fingerprint,reason:reason.value,confirm:true})});form.remove();notice.textContent='Voorstel vastgelegd. Open Voorstellen en beoordelingen om verder te gaan.';}catch(error){notice.textContent=friendlyError(error);submit.disabled=false;}});
    }catch(error){notice.textContent=friendlyError(error);}
  }
  function appendAwardReview(record,cell,content) {
    const details=node('details'),summary=node('summary','','Voorstel en beoordelingen');details.append(summary,node('p','',`${new Intl.NumberFormat('nl-NL',{style:'currency',currency:record.currency}).format(record.value_cents/100)} · ${record.reason} · Herkomst: ${record.evidence_reference||(['ITEM_SPLIT','ITEM_INCREMENTAL'].includes(record.allocation_kind)?'Per artikel vastgelegd':'—')}`));
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
    function draw(){if(!model)return;status.textContent=model.active?`${model.holder_name} bewerkt dit concept · sessie geldig tot ${new Date(model.expires_at).toLocaleTimeString('nl-NL')}`:'Er is geen actieve bewerkingssessie.';
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
      const selected=new Map(model.collaborators.map(member=>[member.id,member.display_name])),chosen=node('div'),search=node('input'),label=node('label','','Medebewerker zoeken'),searchButton=node('button','secondary-button','Zoeken'),results=node('div');
      search.type='search';search.maxLength=100;searchButton.type='button';label.append(search);
      const redraw=()=>{
        replaceChildren(chosen,[]);
        for(const [id,name] of selected){const row=node('p','',name+' '),remove=node('button','secondary-button','Verwijderen');remove.type='button';remove.setAttribute('aria-label',`${name} verwijderen`);remove.addEventListener('click',()=>{selected.delete(id);redraw();});row.append(remove);chosen.append(row);}
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
    const token=state.inboxQueryToken=(state.inboxQueryToken||0)+1,form=node('form'),search=node('input'),folder=node('select'),read=node('select'),direction=node('select'),submit=node('button','primary-button','Zoeken'),notice=node('p'),results=node('div'),mailbox=node('section');let requestVersion=0,currentOffset=0;
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
    replaceChildren(content, [node('div', 'LoadingState', 'Records laden…')]);
    try {
      const draftId=state.workspaceId==='communication'&&entity==='drafts'?new URLSearchParams(location.search).get('draft'):null;
      const [result,schema] = await Promise.all([draftId?request('/api/communication/drafts/'+encodeURIComponent(draftId)).then(data=>({items:[data.record],total:1,next_offset:null})):request(`/api/${state.workspaceId}/${entity}?limit=100`),request(`/api/${state.workspaceId}/schema`)]);
      if (state.activeSection.toLowerCase() !== entity) return;
      const required = state.workspace.domain_required_fields?.[entity] || [];
      const form = node('form', 'domain-record-form'), notice = node('p', '', ''), fields = new Map();
      const fieldNames = [...new Set([...required, 'description','status',...(state.workspaceId==='communication'&&entity==='drafts'?['to','cc']:[]),...(state.workspaceId==='sales'&&entity==='opportunities'?['expected_close_date','closed_date','forecast_category']:[]),...(state.workspaceId==='procurement'&&entity==='bids'?['bid_scope']:[]),...(state.workspaceId==='procurement'&&entity==='orders'?['evidence_reference']:[]),...(state.workspaceId==='procurement'&&entity==='approval_policies'?['allow_self_approval']:[]), ...(state.workspaceId==='calendar'&&['availability','events'].includes(entity)?['calendar_id','participants']:[]), ...(['procurement','sales'].includes(state.workspaceId) && ['opportunities','quotes','orders'].includes(entity) ? ['value_cents','currency','probability'] : [])])];
      const labels = { title:'Titel', name:'Naam', content:'Inhoud', description:'Omschrijving', start_at:'Start met tijdzone-offset', end_at:'Einde met tijdzone-offset', timezone:'Tijdzone', value_cents:'Bedrag', currency:'Valuta', probability:'Kans (0–1)',expected_close_date:'Verwachte sluitdatum',closed_date:'Werkelijke sluitdatum',forecast_category:'Prognosecategorie', cc:'Cc (e-mailadressen, gescheiden door komma’s)', to:'Aan (e-mailadressen, gescheiden door komma’s)',subject_id:'Onderwerp-ID', purpose:'Doel', status:'Status' };
      for (const name of fieldNames) {
        const sourcing=state.workspaceId==='procurement'&&['rfqs','bids'].includes(entity);const sourcingLabels={rfq_id:'Offerteaanvraag',rfq_revision:'Revisie aanvraag',supplier_id:'Leverancier',lines:'Artikelen',evidence_reference:'Herkomst bieding (bijv. offertekenmerk en datum)',target_cents:'Doelbedrag',owner_id:'Gebruikers-ID eigenaar',period_start:'Begin doelperiode',period_end:'Einde doelperiode',minimum_value_cents:'Vanaf bedrag',approval_steps:'Beoordelaars (gebruikers-ID’s, in volgorde)',allow_self_approval:'Aanvrager mag ook beoordelen'};const label=node('label','',sourcingLabels[name]||labels[name] || name), input=node((['status','calendar_id','allow_self_approval','bid_scope'].includes(name)||sourcing&&['rfq_id','supplier_id'].includes(name))?'select':['content','description','lines'].includes(name)?'textarea':'input');
        if(name==='bid_scope'){for(const [value,text]of [['FULL','Volledige gevraagde aantallen'],['PARTIAL','Gedeeltelijke aantallen']]){const option=node('option','',text);option.value=value;input.append(option);}}
        if(name==='allow_self_approval'){for(const [value,text] of [['false','Nee, afzonderlijke beoordelaar verplicht'],['true','Ja, expliciet toegestaan']]){const option=node('option','',text);option.value=value;input.append(option);}}
        if(name==='calendar_id'){const calendars=await request('/api/calendar/calendars?limit=250');input.append(node('option','','Kies een agenda'));input.firstChild.value='';for(const calendar of calendars.items){const option=node('option','',calendar.name);option.value=calendar.id;input.append(option);}}
        if(sourcing&&['rfq_id','supplier_id'].includes(name)){const choices=await request(`/api/procurement/${name==='rfq_id'?'rfqs':'suppliers'}?limit=250`);input.append(node('option','','Maak een keuze'));input.firstChild.value='';for(const item of choices.items){const option=node('option','',item.title||item.name);option.value=item.id;input.append(option);}if(name==='rfq_id')input.addEventListener('change',()=>{const selected=choices.items.find(item=>item.id===input.value);if(selected){fields.get('rfq_revision').value=String(selected.revision);fields.get('currency').value=selected.currency;}});}
        if(sourcing&&name==='rfq_revision')input.readOnly=true;
        if(sourcing&&name==='lines'){input.placeholder=entity==='rfqs'?'ARTIKEL | Omschrijving | Aantal':'ARTIKEL | Aantal | Stukprijs | Levertijd in dagen (optioneel)';label.append(node('small','',entity==='rfqs'?'Eén artikel per regel: artikelcode | omschrijving | aantal':'Eén artikel per regel: artikelcode | aantal | stukprijs | levertijd. Gebruik de codes en volledige aantallen uit de aanvraag.'));}
        if(name==='approval_steps')input.placeholder='Gebruikers-ID’s, gescheiden door komma’s';
        if(name==='participants')input.placeholder='Deelnemers, gescheiden door komma’s';
        if(name==='status'){for(const status of (['approval_policies','quotas'].includes(entity)?['DRAFT','OPEN','ARCHIVED']:sourcing?['DRAFT','OPEN','CANCELLED','ARCHIVED']:entity==='preferences'?['GRANTED','DENIED','REVOKED']:['DRAFT','OPEN','QUALIFIED','WON','LOST','CANCELLED','ARCHIVED','SCHEDULED','CONFIRMED','COMPLETED'])){const option=node('option','',status);option.value=status;input.append(option);}}
        input.name=name;input.required=required.includes(name);input.maxLength=['content','lines'].includes(name)?12000:1000;
        if(['value_cents','minimum_value_cents','target_cents','probability'].includes(name)){input.type='number';input.min='0';input.step='0.01';if(name==='probability')input.max='1';}
        if(['expected_close_date','closed_date','period_start','period_end'].includes(name))input.type='date';
        if(name==='timezone')input.placeholder='Europe/Amsterdam';
        if(name==='currency')input.placeholder='EUR';
        if(['start_at','end_at'].includes(name))input.placeholder='2026-09-06T10:00:00+02:00';
        label.append(input);form.append(label);fields.set(name,input);
      }
      let recurrenceFields=null;
      if(state.workspaceId==='calendar'&&['availability','events'].includes(entity)){
        const group=node('fieldset'),legend=node('legend','','Herhaling'),frequency=node('select'),count=node('input'),interval=node('input');
        for(const [value,title] of [['','Eenmalig'],['DAILY','Dagelijks'],['WEEKLY','Wekelijks']]){const option=node('option','',title);option.value=value;frequency.append(option);}
        for(const [input,name,max] of [[count,'recurrence_count',104],[interval,'recurrence_interval',12]]){input.type='number';input.name=name;input.min='1';input.max=String(max);input.step='1';input.value='1';}
        frequency.name='recurrence_frequency';group.append(legend);for(const [title,input] of [['Patroon',frequency],['Aantal afspraken, inclusief de eerste',count],['Elke hoeveel dagen of weken',interval]]){const label=node('label','',title);label.append(input);group.append(label);}
        const refresh=()=>{count.disabled=interval.disabled=!frequency.value;count.required=interval.required=Boolean(frequency.value);};frequency.addEventListener('change',refresh);refresh();
        group.append(node('small','','Herhaling behoudt de lokale starttijd en afspraakduur. Bij een dubbel of niet-bestaand tijdstip is een afzonderlijke afspraak met expliciete offset nodig. Eenmalig verwijdert de herhaling bij opslaan.'));form.append(group);recurrenceFields={frequency,count,interval,refresh};
      }
      const industryInputs=new Map(),contract=schema.industry_fields||{fields:[]};
      if(contract.fields.length){
        const group=node('fieldset'),legend=node('legend','',`Branchevelden · ${contract.industry_id}`);group.append(legend);
        for(const field of contract.fields){const label=node('label','',field.label),input=node(field.type==='boolean'?'select':'input');
          if(field.type==='boolean'){for(const [value,title] of [['','Niet opgegeven'],['true','Ja'],['false','Nee']]){const option=node('option','',title);option.value=value;input.append(option);}}
          else {input.type=field.type==='number'?'number':'text';input.maxLength=1000;if(field.type==='number')input.step='any';}
          input.name=`industry_${field.name}`;label.append(input);group.append(label);industryInputs.set(field.name,{input,type:field.type});
        }form.append(group);
      }
      let editing=null;
      const save=node('button','primary-button','Opslaan');save.type='submit';form.append(save,notice);
      notice.setAttribute('role','status');
      form.addEventListener('submit',async event=>{
        event.preventDefault();save.disabled=true;
        try {
          const payload={};for(const [name,input] of fields){if(!input.value.trim())continue;payload[name]=['value_cents','minimum_value_cents','target_cents'].includes(name)?Math.round(Number(input.value)*100):name==='probability'?Number(input.value):input.value.trim();}
          if(state.workspaceId==='procurement'&&['rfqs','bids'].includes(entity)){
            if(payload.rfq_revision)payload.rfq_revision=Number(payload.rfq_revision);
            if(payload.lines)payload.lines=payload.lines.split('\n').filter(line=>line.trim()).map(line=>{const parts=line.split('|').map(value=>value.trim());if(entity==='rfqs'){if(parts.length!==3)throw new Error('Gebruik artikelcode | omschrijving | aantal');return {item_id:parts[0],description:parts[1],quantity:Number(parts[2])};}if(parts.length<3||parts.length>4||!/^\d+(?:[.,]\d{1,2})?$/.test(parts[2]))throw new Error('Gebruik artikelcode | aantal | stukprijs | levertijd');const [whole,fraction='']=parts[2].replace(',','.').split('.');return {item_id:parts[0],quantity:Number(parts[1]),unit_price_cents:Number(whole)*100+Number(fraction.padEnd(2,'0')),...(parts[3]?{delivery_days:Number(parts[3])}:{})};});
          }
          if(state.workspaceId==='communication'&&entity==='drafts'){payload.to=fields.get('to').value.split(',').map(value=>value.trim()).filter(Boolean);payload.cc=fields.get('cc').value.split(',').map(value=>value.trim()).filter(Boolean);payload.description=fields.get('description').value.trim();}
          if(payload.allow_self_approval!==undefined)payload.allow_self_approval=payload.allow_self_approval==='true';
          if(payload.approval_steps)payload.approval_steps=payload.approval_steps.split(',').map(value=>value.trim()).filter(Boolean);
          if(payload.participants)payload.participants=payload.participants.split(',').map(value=>value.trim()).filter(Boolean);if(recurrenceFields){const {frequency,count,interval}=recurrenceFields;payload.recurrence=window.FoundlyCalendarRecurrence.normalize(frequency.value?{frequency:frequency.value,count:Number(count.value),interval:Number(interval.value)}:null);}
          const industryValues={};for(const [name,{input,type}] of industryInputs)if(!input.disabled&&input.value.trim()!=='')industryValues[name]=type==='number'?Number(input.value):type==='boolean'?input.value==='true':input.value.trim();
          if(Object.keys(industryValues).length)payload.industry_fields=industryValues;
          if(editing)payload.expected_revision=editing.revision;
          await request(`/api/${state.workspaceId}/${entity}${editing?`/${encodeURIComponent(editing.id)}`:''}`,{method:editing?'PUT':'POST',headers:{'idempotency-key':crypto.randomUUID()},body:JSON.stringify(payload)});
          await renderDomainSection(entity,content);toast('Record opgeslagen.');
        } catch(error){notice.textContent=friendlyError(error);} finally {save.disabled=false;}
      });
      const rows=result.items||[],table=node('table'),head=node('thead'),body=node('tbody'),headRow=node('tr');
      for(const title of ['Record','Status',...(state.workspaceId==='calendar'?['Tijdstip']:[]),'Bijgewerkt','Actie'])headRow.append(node('th','',title));head.append(headRow);table.append(head,body);
      for(const record of rows){
        const tr=node('tr');tr.append(node('td','',record.title||record.name||record.id),node('td','',record.status||record.delivery_state||'—'),node('td','',record.updated_at?new Date(record.updated_at).toLocaleString('nl-NL'):'—'));
        if(state.workspaceId==='calendar'){const time=node('td','',[record.start_at||record.due_at||record.delivered_at,record.end_at,record.timezone].filter(Boolean).join(' · '));tr.insertBefore(time,tr.lastChild);}
        const cell=node('td'),edit=node('button','secondary-button','Bewerken');edit.type='button';
        edit.addEventListener('click',()=>{if(recurrenceFields){let rule;try{rule=window.FoundlyCalendarRecurrence.normalize(record.recurrence);}catch(error){notice.textContent=friendlyError(error);return;}recurrenceFields.frequency.value=rule?.frequency||'';recurrenceFields.count.value=String(rule?.count||1);recurrenceFields.interval.value=String(rule?.interval||1);recurrenceFields.refresh();}editing=record;const packConflict=Boolean(record.industry_field_pack_id&&record.industry_field_pack_id!==contract.industry_id);for(const [name,{input}] of industryInputs){input.value=packConflict?'':String(record.industry_fields?.[name]??'');input.disabled=packConflict;}notice.textContent=packConflict?'Bewaarde branchevelden blijven behouden. Herstel het oorspronkelijke pakket om ze te bewerken.':'';for(const [name,input] of fields)input.value=record[name]===undefined?'':['value_cents','minimum_value_cents','target_cents'].includes(name)?String(record[name]/100):name==='lines'?record[name].map(line=>entity==='rfqs'?`${line.item_id} | ${line.description} | ${line.quantity}`:`${line.item_id} | ${line.quantity} | ${(line.unit_price_cents/100).toFixed(2)} | ${line.delivery_days??''}`).join('\n'):Array.isArray(record[name])?record[name].join(','):String(record[name]);save.textContent='Wijziging opslaan';fields.values().next().value?.focus();});
        if(state.workspaceId==='communication'&&entity==='templates'){appendTemplateDraft(record,cell,content);appendZeroCommunication(record,cell,content,'template');}
        if(state.workspaceId==='communication'&&entity==='messages')appendMessageDraftActions(record,cell,content);
        if(state.workspaceId==='communication'&&entity==='drafts'){appendDraftComments(record,cell,content);appendDraftEditor(record,cell,content);appendDraftCollaboration(record,cell,content);appendDraftAttachments(record,cell,content);appendSendReviews(record,cell,content);appendZeroCommunication(record,cell,content,'draft');}
        if(state.workspaceId==='marketing'&&['audiences','campaigns','journey_runs'].includes(entity)&&window.FoundlyMarketingJourneys){const detail=node('details');detail.append(node('summary','',entity==='audiences'?'Deelnemers en selectie':entity==='campaigns'?'Journeys en inschrijving':'Journey uitvoeren'));let loaded=false;detail.addEventListener('toggle',()=>{if(!detail.open||loaded)return;loaded=true;const active=()=>content.isConnected&&state.workspaceId==='marketing',view=window.FoundlyMarketingTransport.create({document,request,isActive:active,build:call=>window.FoundlyMarketingJourneys.create({document,request:call,isActive:active,...(entity==='audiences'?{audienceId:record.id}:entity==='campaigns'?{campaignId:record.id}:{runId:record.id})})});state.creativeHistoryViews=[...(state.creativeHistoryViews||[]).filter(v=>v.isConnected),view];detail.append(view);});cell.append(detail);}
        if(state.workspaceId==='marketing'&&entity==='creatives'&&window.FoundlyMarketingCreativeHistory){const detail=node('details');detail.append(node('summary','','Versies en herstel'));let loaded=false;detail.addEventListener('toggle',()=>{if(!detail.open||loaded)return;loaded=true;const view=window.FoundlyMarketingTransport.create({document,request,build:call=>window.FoundlyMarketingCreativeHistory.create({document,request:call,id:record.id,isActive:()=>content.isConnected&&state.workspaceId==='marketing'&&state.activeSection.toLowerCase()==='creatives'}),isActive:()=>content.isConnected&&state.workspaceId==='marketing'&&state.activeSection.toLowerCase()==='creatives'});state.creativeHistoryViews=[...(state.creativeHistoryViews||[]).filter(v=>v.isConnected),view];detail.append(view);});cell.append(detail);}
        if(state.workspaceId==='marketing'&&entity==='creatives'&&!['APPROVED_INTERNAL','ARCHIVED'].includes(record.status))appendCreativeReviewRequest(record,cell,content);
        if(state.workspaceId==='marketing'&&entity==='creative_reviews')appendCreativeReview(record,cell,content);
        if(state.workspaceId==='procurement'&&window.FoundlyProcurementIntelligence&&(['rfqs','suppliers'].includes(entity)||entity==='awards'&&record.status==='APPROVED_INTERNAL')){const detail=node('details');detail.append(node('summary','',entity==='rfqs'?'Kosten en alternatieven':entity==='suppliers'?'Leveranciersuitkomsten':'Levering en kosten vastleggen'));let loaded=false;detail.addEventListener('toggle',()=>{if(!detail.open||loaded)return;loaded=true;const active=()=>content.isConnected&&state.workspaceId==='procurement',view=window.FoundlyProcurementTransport.create({document,request,isActive:active,build:call=>window.FoundlyProcurementIntelligence.create({document,request:call,isActive:active,...(entity==='rfqs'?{rfqId:record.id}:entity==='suppliers'?{supplierId:record.id}:{award:record})})});state.creativeHistoryViews=[...(state.creativeHistoryViews||[]).filter(v=>v.isConnected),view];detail.append(view);});cell.append(detail);}
        if(state.workspaceId==='procurement'&&entity==='rfqs'&&window.FoundlyProcurementClarifications){const detail=node('details');detail.append(node('summary','','Vragen en leveranciersreacties'));let loaded=false;detail.addEventListener('toggle',()=>{if(!detail.open||loaded)return;loaded=true;const active=()=>content.isConnected&&state.workspaceId==='procurement',view=window.FoundlyProcurementTransport.create({document,request,isActive:active,build:call=>window.FoundlyProcurementClarifications.create({document,request:call,rfqId:record.id,isActive:active})});state.creativeHistoryViews=[...(state.creativeHistoryViews||[]).filter(v=>v.isConnected),view];detail.append(view);});cell.append(detail);}
        if(state.workspaceId==='procurement'&&entity==='rfqs'){const compare=node('button','secondary-button','Biedingen vergelijken');compare.type='button';compare.addEventListener('click',()=>renderProcurementComparison(record,content,notice));cell.append(compare);}
        if(state.workspaceId==='procurement'&&entity==='orders'&&!['APPROVED_INTERNAL','ARCHIVED','CANCELLED'].includes(record.status)){const prepare=node('button','secondary-button','Order ter beoordeling');prepare.type='button';prepare.addEventListener('click',()=>prepareProcurementAward({order_id:record.id},null,cell));cell.append(prepare);}
        if(state.workspaceId==='procurement'&&entity==='awards')appendAwardReview(record,cell,content);
        if(state.workspaceId==='sales'&&entity==='forecast_snapshots'){const detail=node('details');detail.append(node('summary','','Bewaarde prognose'));appendForecastResult(detail,record.forecast);cell.append(detail);}
        if(!['messages','notifications','awards','forecast_snapshots','creative_reviews','creative_revisions','draft_revisions','economics_snapshots','outcome_observations','supplier_clarifications','audience_members','audience_activations','journey_definitions','journey_runs'].includes(entity)&&record.status!=='APPROVED_INTERNAL')cell.append(edit);tr.append(cell);body.append(tr);
      }
      const summary=node('p','',`${result.total} records${result.next_offset!==null?' · eerste 100 getoond':''}`);
      const children=[summary];if(!['messages','notifications','awards','forecast_snapshots','creative_reviews','creative_revisions','draft_revisions','economics_snapshots','outcome_observations','supplier_clarifications','audience_members','audience_activations','journey_definitions','journey_runs'].includes(entity))children.push(form);
      children.push(rows.length?table:node('div','EmptyState','Nog geen records in dit onderdeel.'));
      replaceChildren(content,children);
    } catch(error){replaceChildren(content,[node('div','ErrorState',friendlyError(error))]);}
  }

  function updateNotice() {
    const observed = state.snapshot?.observed_at ? new Date(state.snapshot.observed_at).toLocaleString('nl-NL') : 'onbekend';
    const activeFilters = [byId('dateFrom').value, byId('dateTo').value, byId('sourceFilter').value, byId('statusFilter').value].filter(Boolean).length;
    const compare = byId('comparePeriod').checked ? ' · periodevergelijking opgeslagen in dashboardcontext' : '';
    byId('workspaceNotice').className = 'workspace-notice success';
    byId('workspaceNotice').textContent = `Tenant-scoped runtime geladen · geobserveerd ${observed} · ${activeFilters ? `${activeFilters} actieve record-/bronfilters` : 'geen actieve filters'}${compare} · waarden zijn persisted, provider-verified of expliciet niet beschikbaar.`;
    byId('workspaceRuntime').textContent = 'RUNTIME LIVE'; byId('workspaceRuntime').className = 'ConnectionBadge live';
    byId('sidebarStatus').textContent = 'RUNTIME LIVE'; byId('sidebarStatusLight').className = 'ok';
  }

  async function reloadRegistries() {
    const [sources, connectors] = await Promise.all([request('/api/source-registry'), request('/api/connector-registry')]);
    state.sources = sources.sources || []; state.connectors = connectors.connectors || [];
    populateConnectorFilters(); populateSourceRegistryFilters(); populateWorkspaceFilters(); renderSources(); renderConnectors(); renderSourceRegistry(); renderSearchResults(byId('globalSearchInput').value || '');
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
    const ticket=dashboardSession.beginLoad(dashboardSelectionKey());
    const scope = byId('dashboardScope').value || 'PERSONAL';
    const qualifier = byId('dashboardQualifier').value.trim(), params = new URLSearchParams({ scope });
    if (scope === 'TEAM' && qualifier) params.set('team_id', qualifier);
    if (scope === 'ROLE' && qualifier) params.set('role', qualifier);
    const [definition, dashboard, snapshot] = await Promise.all([
      request(`/api/workspaces/${encodeURIComponent(state.workspaceId)}`),
      request(`/api/workspaces/${encodeURIComponent(state.workspaceId)}/dashboard?${params}`),
      request(`/api/workspaces/${encodeURIComponent(state.workspaceId)}/snapshot`)
    ]);
    if(!dashboardSession.finishLoad(ticket))return;
    state.workspace = definition.workspace; state.dashboard = dashboard.dashboard; state.snapshot = snapshot;
    byId('industryDashboardPreset').hidden = !state.workspace.industry_dashboard_presets;
    byId('workspaceEyebrow').textContent = state.workspace.eyebrow;
    byId('workspaceTitle').textContent = state.workspace.label;
    byId('workspaceDescription').textContent = state.workspace.description;
    document.title = `${state.workspace.label} · Foundly OS`;
    populateWorkspaceFilters(); applyDashboardFilters(); renderTabs(); renderDashboard(); renderRecords(); renderSources(); updateNotice();
    const requestedSection=new URLSearchParams(location.search).get('section'),initialSection=state.workspaceId==='communication'&&new URLSearchParams(location.search).has('draft')&&state.workspace.sections.includes('DRAFTS')?'DRAFTS':state.workspace.sections.includes(requestedSection)?requestedSection:state.workspace.sections[0],initialIndex=state.workspace.sections.indexOf(initialSection),firstTab=byId('workspaceTabs').querySelectorAll('button')[initialIndex];if(firstTab)selectSection(initialSection,firstTab);
  }

  function dashboardDraft() {
    const scope=byId('dashboardScope').value,qualifier=byId('dashboardQualifier').value.trim();
    const payload={...state.dashboard,scope,filters:{from:byId('dateFrom').value||null,to:byId('dateTo').value||null,compare:byId('comparePeriod').checked,source:byId('sourceFilter').value||null,status:byId('statusFilter').value||null}};
    if(scope==='TEAM')payload.team_id=qualifier;if(scope==='ROLE')payload.role=qualifier;return payload;
  }
  async function saveDashboard() {
    let ticket;
    try {
      const payload=dashboardDraft();ticket=dashboardSession.beginSave(dashboardSelectionKey(),payload);if(!ticket)return;
      byId('saveDashboard').disabled=true;const query=new URLSearchParams({scope:payload.scope});if(payload.scope==='TEAM')query.set('team_id',payload.team_id);if(payload.scope==='ROLE')query.set('role',payload.role);
      const result=await request(`/api/workspaces/${encodeURIComponent(state.workspaceId)}/dashboard?${query}`,{method:'PUT',headers:{'if-match':String(ticket.draft.revision)},body:JSON.stringify(ticket.draft)});
      const completion=dashboardSession.finishSave(ticket,result.dashboard,dashboardDraft(),dashboardSelectionKey());if(!completion.applied)return;
      state.dashboard=completion.dashboard;toggleEditing(completion.dirty);renderDashboard();toast(completion.dirty?'Opgeslagen. Je latere bewerkingen staan nog lokaal; kies opnieuw Opslaan.':'Dashboard tenant- en gebruikersgebonden opgeslagen.');
    }catch(error){dashboardSession.failSave(ticket);toast(friendlyError(error),true);}
    finally{byId('saveDashboard').disabled=!state.editing||dashboardSession.saving;}
  }

  function toggleEditing(force) {
    state.editing = typeof force === 'boolean' ? force : !state.editing;
    byId('editDashboard').textContent = state.editing ? 'Bewerken sluiten' : 'Dashboard aanpassen';
    byId('addWidget').disabled = !state.editing; byId('saveDashboard').disabled = !state.editing||dashboardSession.saving; renderDashboard();
  }

  async function chooseIndustryPreset(moduleId,kind,apply) {
    const data=await request('/api/composition/industry-presets?'+new URLSearchParams({module:moduleId}));
    const choices=data.items.filter(item=>item.kind===kind&&item.can_prepare);
    if(!choices.length)return toast(data.unavailable.length?'Branchesjablonen zijn momenteel niet beschikbaar.':'Geen passend branchesjabloon voor je huidige toegang.');
    const dialog=node('dialog'),form=node('form'),label=node('label','','Branchesjabloon'),select=node('select'),use=node('button','primary-button','Overnemen'),cancel=node('button','secondary-button','Annuleren');
    for(const item of choices){const option=node('option','',`${item.name} · versie ${item.version}`);option.value=item.id;select.append(option);}
    label.append(select);use.type='submit';cancel.type='button';form.append(label,node('p','','Je kunt het sjabloon aanpassen voordat je het opslaat. Er wordt niets uitgevoerd.'),use,cancel);dialog.append(form);document.body.append(dialog);
    const close=()=>{dialog.close();dialog.remove();};cancel.addEventListener('click',close);dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
    form.addEventListener('submit',event=>{event.preventDefault();const selected=choices.find(item=>item.id===select.value);if(selected){apply(selected);close();}});dialog.showModal();
  }

  function openWidgetDialog() {
    const active = new Set(state.dashboard.widgets.map(item => item.metric));
    const options = (state.workspace.default_widgets || []).filter(item => !active.has(item.metric)).map(item => {
      const option = node('option', '', item.label); option.value = item.metric; return option;
    });
    replaceChildren(byId('widgetMetric'), options);
    if (!options.length) return toast('Alle beschikbare widgets staan al op dit dashboard.');
    byId('widgetDialog').showModal();
  }

  function addWidget(event) {
    event.preventDefault();
    const metric = byId('widgetMetric').value, definition = state.workspace.default_widgets.find(item => item.metric === metric);
    if (!definition) return;
    state.dashboard.widgets.push({ ...definition, id: `${state.workspaceId}-${metric}-${Date.now()}` });
    byId('widgetDialog').close(); renderDashboard();
  }

  function renderSearchResults(query = '') {
    const q = query.trim().toLowerCase(), results = [];
    for (const workspace of state.navigation) if (!q || `${workspace.label} ${workspace.short_label}`.toLowerCase().includes(q)) results.push({ type: 'Workspace', name: workspace.label, href: workspace.route });
    for (const source of state.sources.slice(0, 200)) if (q && `${source.display_name} ${(source.categories || []).join(' ')}`.toLowerCase().includes(q)) results.push({ type: 'Source', name: source.display_name, href: `/connectors?q=${encodeURIComponent(source.source_id)}` });
    for (const connector of state.connectors.slice(0, 200)) if (q && `${connector.name} ${connector.provider} ${(connector.capabilities || []).join(' ')}`.toLowerCase().includes(q)) results.push({ type: 'Connector', name: connector.name, connectorId: connector.connector_id });
    const items = results.slice(0, 30).map(result => {
      if (result.connectorId) {
        const button = node('button'); button.type = 'button'; button.append(node('span', '', result.name), node('small', '', result.type)); button.addEventListener('click', () => { byId('searchDialog').close(); openConnector(result.connectorId); }); return button;
      }
      const link = node('a'); link.href = result.href; link.append(node('span', '', result.name), node('small', '', result.type)); return link;
    });
    replaceChildren(byId('globalSearchResults'), items.length ? items : [node('div', 'EmptyState NoDataState', 'Geen workspace, bron of connector gevonden.')]);
  }

  function exportRows() {
    const rows = Array.isArray(state.snapshot?.rows) ? state.snapshot.rows : [];
    if (!rows.length) return toast('Er zijn geen werkelijke records om te exporteren.', true);
    const fields = recordDisplayFields(rows); if (!fields.length) return toast('Geen veilige exportvelden beschikbaar.', true);
    const quote = value => `"${String(value ?? '').replaceAll('"', '""').replace(/[\r\n]+/g, ' ')}"`;
    const csv = [fields.map(quote).join(','), ...rows.map(row => fields.map(field => quote(row[field])).join(','))].join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })), link = document.createElement('a');
    link.href = url; link.download = `foundly-${state.workspaceId}-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url);
  }

  async function askZero(event) {
    event.preventDefault();
    const input = byId('zeroInput'), message = input.value.trim(); if (!message) return;
    const output = byId('zeroOutput'); output.textContent = 'ZERO analyseert de gedeelde tenantcontext…'; input.disabled = true;
    try {
      const result = await request('/api/zero/turn', { method: 'POST', body: JSON.stringify({ message, conversation_id: state.conversationId, preferred_module: state.workspace.module_id, client_context: { workspace_id: state.workspaceId, section: state.activeSection } }) });
      state.conversationId = result.conversation_id || state.conversationId;
      output.textContent = result.display_text || result.text || result.answer || 'ZERO heeft de opdracht verwerkt; er is geen tekstresultaat beschikbaar.';
      input.value = '';
    } catch (error) { output.textContent = friendlyError(error); }
    finally { input.disabled = false; input.focus(); }
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
    byId('refreshWorkspace').addEventListener('click', async () => { try { await Promise.all([loadWorkspaceData(), reloadRegistries()]); toast('Workspace vernieuwd.'); } catch (error) { toast(friendlyError(error), true); } });
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

  boot();
})();
