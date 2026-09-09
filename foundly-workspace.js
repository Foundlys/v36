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
      return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(value) / 100);
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
      const button = node('button', index === 0 ? 'active' : '', section === 'FORECAST_SNAPSHOTS' ? 'Bewaarde prognoses' : section === 'AWARDS' ? 'Voorstellen en beoordelingen' : section);
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

  function selectSection(section, button) {
    state.activeSection = section;
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
    if(state.workspaceId==='sales'&&section==='FORECAST'){renderSalesForecast(content);return;}
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
        for(const value of ['', 'RUNNING','SUCCEEDED','ERROR','BLOCKED','AWAITING_APPROVAL','WAITING_TIME','WAITING_RETRY','DEAD_LETTER','RECOVERY_READY']){const option=node('option','',value||'Alle statussen');option.value=value;status.append(option);}status.value=query.status||'';statusLabel.append(status);find.type='submit';form.append(label,statusLabel,find);form.addEventListener('submit',event=>{event.preventDefault();renderAutomationSection(section,content,{q:search.value.trim(),...(status.value?{status:status.value}:{}),offset:'0'});});result.push(form,node('p','',`${page.total} toegankelijke uitvoeringen · vanaf ${page.offset+1}`));
        const navigation=node('div');for(const [title,offset]of [['Vorige',page.offset>=50?page.offset-50:null],['Volgende',page.next_offset]]){const button=node('button','secondary-button',title);button.type='button';button.disabled=offset===null;button.addEventListener('click',()=>renderAutomationSection(section,content,{...query,offset:String(offset)}));navigation.append(button);}result.push(navigation);
      }
      if(section==='WORKFLOWS'&&data.can_manage){
        const drafts=await request('/api/automation/drafts'),editorBox=node('div'),chooser=node('select'),label=node('label','','Bewaard concept'),open=node('button','secondary-button','Concept openen'),message=node('output');
        chooser.append(node('option','','Nieuw concept'));chooser.firstChild.value='';for(const draft of drafts.items){const option=node('option','',`${draft.draft.name||'Naamloos concept'} · revisie ${draft.revision}`);option.value=draft.id;chooser.append(option);}label.append(chooser);open.type='button';
        const show=draft=>{const editor=window.FoundlyWorkflowEditor.create({document,spec:data.editor_contract,request,draft,onSaved:()=>renderAutomationSection(section,content)});editorBox.replaceChildren(editor);};show();
        open.addEventListener('click',()=>{if(editorBox.querySelector('form')?.dataset.unsaved==='true'){message.textContent='Bewaar eerst je huidige invoer, of bewaar deze als nieuw concept.';return;}try{show(drafts.items.find(row=>row.id===chooser.value)||null);message.textContent='';}catch(error){message.textContent=error.message;}});
        const template=node('button','secondary-button','Branchesjabloon kiezen');template.type='button';
        template.addEventListener('click',async()=>{if(editorBox.querySelector('form')?.dataset.unsaved==='true'){message.textContent='Bewaar eerst je huidige invoer, of bewaar deze als nieuw concept.';return;}template.disabled=true;try{await chooseIndustryPreset('automation','workflow',selected=>{show({draft:selected.draft});message.textContent='Sjabloon geopend als nieuw concept. Bewaar het concept of controleer de workflowversie voordat je deze opslaat.';});}catch(error){message.textContent=friendlyError(error);}finally{template.disabled=false;}});
        result.push(label,open,template,message,editorBox);
      }
      const rows=workflowSections.includes(section)?data.workflows:data.runs;
      for(const row of rows||[]){
        const card=node('article','context-item');card.append(node('h3','',row.name||row.run_id),node('p','',workflowSections.includes(section)?`Versie ${row.version} · ${row.effective_enabled?'Actief':'Gepauzeerd of uitgeschakeld'}`:row.status));
        if(['TRIGGERS','WORKFLOWS'].includes(section))card.append(node('p','',`Trigger: ${row.trigger?.type||'—'}`));
        if(['ACTIONS','WORKFLOWS'].includes(section))for(const action of row.actions||[])card.append(node('p','',`${action.type} · ${action.title||action.message||''}`));
        if(section==='DEPENDENCIES')card.append(node('p','',`Acties: ${(row.actions||[]).map(a=>a.type).join(', ')}. Rechten worden opnieuw gecontroleerd bij uitvoering.`));
        if(row.steps)for(const step of row.steps)card.append(node('p','',`${step.index+1}. ${step.type}: ${step.status}${step.attempts?` · ${step.attempts} poging(en)`:''}${step.error?` (${step.error})`:''}`));
        if(['WAITING_RETRY','WAITING_TIME'].includes(row.status)){
          card.append(node('p','',`Volgende poging vanaf ${new Date(row.next_wakeup_at).toLocaleString('nl-NL')}. Eerdere resultaten blijven behouden.`));
          if(data.can_manage){const resume=node('button','','Hervatten zodra wachttijd verstreken is'),notice=node('output');resume.type='button';notice.setAttribute('role','status');card.append(resume,notice);resume.addEventListener('click',async()=>{resume.disabled=true;try{const result=await request(`/api/automation/workflows/${row.automation_id}/runs`,{method:'POST',body:JSON.stringify({event:row.trigger,options:{inputs:row.inputs}})});notice.textContent=['WAITING_RETRY','WAITING_TIME'].includes(result.status)?'De wachttijd is nog niet verstreken.':`Uitkomst: ${result.status}`;}catch(error){notice.textContent=friendlyError(error);}finally{resume.disabled=false;}});}
        }
        if(data.can_manage&&row.can_recover&&row.steps?.some(step=>['RUNNING','FAILED','DEAD_LETTER','BLOCKED'].includes(step.status)&&(data.retryable_actions||[]).includes(step.type))){
          const inspect=node('button','','Controleer opgeslagen resultaat'),notice=node('output');inspect.type='button';notice.setAttribute('role','status');card.append(inspect,notice);
          inspect.addEventListener('click',async()=>{inspect.disabled=true;try{const preview=await request(`/api/automation/runs/${row.run_id}/recovery`),form=node('form'),label=node('label','','Reden voor herstel'),reason=node('input'),confirmLabel=node('label','','Ik heb deze interne record en revisie gecontroleerd'),confirm=node('input'),save=node('button','','Bewezen stap als voltooid vastleggen');reason.required=true;reason.maxLength=500;label.append(reason);confirm.type='checkbox';confirm.required=true;confirmLabel.append(confirm);save.type='submit';form.append(node('p','',`Gevonden: ${preview.evidence.entity} · ${preview.evidence.record_id} · revisie ${preview.evidence.record_revision}. Volgende stappen worden nog niet uitgevoerd.`),label,confirmLabel,save);card.append(form);
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
        if(section==='WORKFLOWS'&&data.can_manage){
          const form=node('form'),label=node('label','','Bestaande eventreferentie'),input=node('input'),button=node('button','','Workflow uitvoeren'),notice=node('output');input.required=true;input.maxLength=200;label.append(input);button.type='submit';button.disabled=!row.effective_enabled;form.append(label,button,notice);form.addEventListener('submit',async event=>{event.preventDefault();button.disabled=true;try{const run=await request(`/api/automation/workflows/${row.id}/runs`,{method:'POST',body:JSON.stringify({event:{event_id:input.value.trim(),type:row.trigger?.type,source:'authorized_manual_run'}})});notice.textContent=`Uitkomst: ${run.status}`;}catch(error){notice.textContent=friendlyError(error);}finally{button.disabled=false;}});card.append(form);
        }
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
      const details=node('details');details.append(node('summary','','Expliciete kansaanpassingen'));for(const row of scenario.items.filter(item=>item.assumption_applied))details.append(node('p','',`${row.title} · revisie ${row.revision} · aangenomen ${(row.scenario_probability_bps/100).toFixed(2)}% · oorspronkelijk ${row.probability===null?'niet vastgelegd':(row.probability*100)+'%'}`));panel.append(details);parent.append(panel,node('h3','','Vastgelegde uitgangssituatie (zonder scenario)'));
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
  function appendForecastSnapshotForm(parent,result,filters,scenario=null) {
    const form=node('form'),label=node('label','','Naam voor bewaarde prognose'),title=node('input'),save=node('button','secondary-button',scenario?'Scenario bewaren':'Berekening bewaren'),notice=node('output');
    title.required=true;title.maxLength=240;label.append(title);save.type='submit';notice.setAttribute('role','status');form.append(label,save,notice);parent.append(form);const key=crypto.randomUUID();
    form.addEventListener('submit',async event=>{event.preventDefault();save.disabled=true;try{await request('/api/sales/forecast/snapshots',{method:'POST',headers:{'idempotency-key':key},body:JSON.stringify({title:title.value,filters,...(scenario?{scenario}:{}),basis_fingerprint:result.basis_fingerprint,confirm:true})});notice.textContent='Opgeslagen onder Bewaarde prognoses; verkoopkansen zijn niet aangepast.';}catch(error){notice.textContent=friendlyError(error);save.disabled=false;}});
  }
  function appendForecastScenario(parent,baseline,filters) {
    const candidates=baseline.items.filter(row=>row.status!=='WON');if(!candidates.length)return;
    const form=node('form','domain-record-form'),titleLabel=node('label','','Scenarionaam'),title=node('input'),reasonLabel=node('label','','Onderbouwing'),reason=node('textarea'),choices=[],output=node('div'),notice=node('output');
    title.required=reason.required=true;title.maxLength=160;reason.maxLength=1000;titleLabel.append(title);reasonLabel.append(reason);form.append(node('h3','','Scenario vergelijken'),node('p','','Pas uitsluitend veronderstelde winkansen aan. Vastgelegde bedragen, statussen en kansen blijven behouden.'),titleLabel,reasonLabel);
    for(const row of candidates.slice(0,200)){const group=node('fieldset'),chooseLabel=node('label','','Kans aanpassen'),choose=node('input'),valueLabel=node('label','','Veronderstelde winkans (%)'),value=node('input');choose.type='checkbox';value.type='number';value.min='0';value.max='100';value.step='0.01';value.disabled=true;value.required=true;chooseLabel.prepend(choose);valueLabel.append(value);group.append(node('legend','',row.title+' · '+row.currency+' '+(row.value_cents/100).toFixed(2)),chooseLabel,valueLabel);choose.addEventListener('change',()=>{value.disabled=!choose.checked;});choices.push({row,choose,value});form.append(group);}
    if(candidates.length>200)form.append(node('p','','De eerste 200 open kansen zijn selecteerbaar. Beperk de prognoseperiode voor een kleinere selectie.'));
    const calculate=node('button','secondary-button','Scenario berekenen');calculate.type='submit';notice.setAttribute('role','status');form.append(calculate,notice);parent.append(form,output);let generation=0;
    form.addEventListener('input',()=>{generation++;output.replaceChildren();});
    form.addEventListener('submit',async event=>{event.preventDefault();const token=++generation;calculate.disabled=true;const scenario={title:title.value,reason:reason.value,adjustments:choices.filter(x=>x.choose.checked).map(x=>({opportunity_id:x.row.id,expected_revision:x.row.revision,probability_bps:Math.round(Number(x.value.value)*100)}))};
      try{const result=await request('/api/sales/forecast/scenarios/query',{method:'POST',body:JSON.stringify({filters,scenario})});if(token!==generation||!form.isConnected)return;output.replaceChildren();appendForecastResult(output,result);appendForecastSnapshotForm(output,result,filters,scenario);notice.textContent='Scenario berekend met expliciete aannames; er is niets aan de verkoopkansen gewijzigd.';}catch(error){if(token===generation)notice.textContent=friendlyError(error);}finally{calculate.disabled=false;}});
  }
  function renderSalesForecast(content) {
    const form=node('form','domain-record-form'),fields={},resultBox=node('div'),notice=node('output'),now=new Date(),first=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1)).toISOString().slice(0,10),last=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+1,0)).toISOString().slice(0,10);let generation=0;
    for(const [name,text,value] of [['from','Van',first],['to','Tot en met',last],['currency','Valuta (leeg voor alle)','']]){const label=node('label','',text),input=node('input');input.name=name;input.type=name==='currency'?'text':'date';input.value=value;input.required=name!=='currency';if(name==='currency'){input.maxLength=3;input.placeholder='EUR';}label.append(input);form.append(label);fields[name]=input;}
    const calculate=node('button','primary-button','Prognose berekenen');calculate.type='submit';notice.setAttribute('role','status');form.append(calculate,notice);replaceChildren(content,[form,resultBox]);form.addEventListener('input',()=>{generation++;resultBox.replaceChildren();});
    form.addEventListener('submit',async event=>{event.preventDefault();const token=++generation;calculate.disabled=true;try{const filters={from:fields.from.value,to:fields.to.value,...(fields.currency.value.trim()?{currency:fields.currency.value.trim().toUpperCase()}:{})},result=await request(`/api/sales/forecast?${new URLSearchParams(filters)}`);if(token!==generation||!form.isConnected)return;resultBox.replaceChildren();appendForecastResult(resultBox,result);appendForecastSnapshotForm(resultBox,result,filters);appendForecastScenario(resultBox,result,filters);notice.textContent='Prognose berekend uit vastgelegde verkoopkansen.';}catch(error){if(token===generation)notice.textContent=friendlyError(error);}finally{calculate.disabled=false;}});
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
        allocationForm.append(node('h4','','Artikelen verdelen'),node('p','','Verdeel ieder gevraagd aantal volledig. Het gezamenlijke bedrag bepaalt de verplichte beoordeling.'));
        for(const line of comparison.requested_lines||[]){const group=node('fieldset');group.append(node('legend','',`${line.item_id} · ${line.description} · gevraagd: ${line.quantity}`));
          for(const bid of comparison.items.filter(row=>row.reasons.every(reason=>reason==='INCOMPLETE_SCOPE'))){const offered=bid.lines.find(item=>item.item_id===line.item_id);if(!offered)continue;const label=node('label','',`${bid.title} · ${(offered.unit_price_cents/100).toFixed(2)} ${comparison.currency} per stuk`),input=node('input');input.type='number';input.min='0';input.max=String(offered.quantity);input.step='1';input.value='0';input.name=`allocation_${line.item_id}_${bid.id}`;label.append(input);group.append(label);choices.push({input,bid_id:bid.id,item_id:line.item_id});}allocationForm.append(group);
        }
        const prepare=node('button','secondary-button','Verdeling controleren');prepare.type='submit';allocationForm.append(prepare);allocationForm.addEventListener('input',()=>replaceChildren(allocationResult,[]));
        allocationForm.addEventListener('submit',event=>{event.preventDefault();const allocations=choices.filter(row=>Number(row.input.value)>0).map(({input,bid_id,item_id})=>({bid_id,item_id,quantity:Number(input.value)}));prepareProcurementAward(comparison,null,allocationResult,allocations);});panel.append(allocationForm,allocationResult);
      }
      content.querySelector('.bid-comparison')?.remove();content.append(panel);
    }catch(error){notice.textContent=friendlyError(error);}
  }
  async function prepareProcurementAward(comparison,bid,parent,allocations) {
    parent.querySelector('.award-proposal')?.remove();const box=node('div','award-proposal'),notice=node('output');notice.setAttribute('role','status');box.append(notice);parent.append(box);
    try{
      const order=Boolean(comparison.order_id),basePath=order?`/api/procurement/orders/${encodeURIComponent(comparison.order_id)}`:`/api/procurement/rfqs/${encodeURIComponent(comparison.rfq_id)}`,preview=allocations?await request(basePath+'/allocation-preview',{method:'POST',body:JSON.stringify({allocations})}):await request(basePath+(order?'/approval-preview':`/award-preview?bid_id=${encodeURIComponent(bid.id)}`)),form=node('form'),label=node('label','',order?'Waarom deze order?':allocations?'Waarom deze artikelverdeling?':'Waarom deze bieding?'),reason=node('textarea'),submit=node('button','primary-button','Ter goedkeuring vastleggen');reason.required=true;reason.maxLength=1000;label.append(reason);submit.type='submit';
      box.prepend(node('p','',`Totaal: ${new Intl.NumberFormat('nl-NL',{style:'currency',currency:preview.currency}).format(preview.value_cents/100)}`));for(const line of preview.allocation_lines||[])box.append(node('p','',`${line.item_id}: ${line.quantity} × ${(line.unit_price_cents/100).toFixed(2)} ${preview.currency} · ${line.supplier_id} · ${line.evidence_reference}`));
      box.prepend(node('p','',`Verplichte beoordelingsvolgorde: ${preview.approval_steps.join(' → ')}. Dit legt een intern voorstel vast.`));form.append(label,submit);box.append(form);const key=crypto.randomUUID();
      form.addEventListener('submit',async event=>{event.preventDefault();submit.disabled=true;try{await request(basePath+(order?'/approvals':'/awards'),{method:'POST',headers:{'idempotency-key':key},body:JSON.stringify({...(!order?(allocations?{allocations}:{bid_id:bid.id}):{}),preview_fingerprint:preview.preview_fingerprint,reason:reason.value,confirm:true})});form.remove();notice.textContent='Voorstel vastgelegd. Open Voorstellen en beoordelingen om verder te gaan.';}catch(error){notice.textContent=friendlyError(error);submit.disabled=false;}});
    }catch(error){notice.textContent=friendlyError(error);}
  }
  function appendAwardReview(record,cell,content) {
    const details=node('details'),summary=node('summary','','Voorstel en beoordelingen');details.append(summary,node('p','',`${new Intl.NumberFormat('nl-NL',{style:'currency',currency:record.currency}).format(record.value_cents/100)} · ${record.reason} · Herkomst: ${record.evidence_reference||(record.allocation_kind==='ITEM_SPLIT'?'Per artikel vastgelegd':'—')}`));
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

  async function renderDomainSection(entity, content) {
    replaceChildren(content, [node('div', 'LoadingState', 'Records laden…')]);
    try {
      const [result,schema] = await Promise.all([request(`/api/${state.workspaceId}/${entity}?limit=100`),request(`/api/${state.workspaceId}/schema`)]);
      if (state.activeSection.toLowerCase() !== entity) return;
      const required = state.workspace.domain_required_fields?.[entity] || [];
      const form = node('form', 'domain-record-form'), notice = node('p', '', ''), fields = new Map();
      const fieldNames = [...new Set([...required, 'description','status',...(state.workspaceId==='sales'&&entity==='opportunities'?['expected_close_date','closed_date','forecast_category']:[]),...(state.workspaceId==='procurement'&&entity==='orders'?['evidence_reference']:[]),...(state.workspaceId==='procurement'&&entity==='approval_policies'?['allow_self_approval']:[]), ...(state.workspaceId==='calendar'&&['availability','events'].includes(entity)?['calendar_id','participants']:[]), ...(['procurement','sales'].includes(state.workspaceId) && ['opportunities','quotes','orders'].includes(entity) ? ['value_cents','currency','probability'] : [])])];
      const labels = { title:'Titel', name:'Naam', content:'Inhoud', description:'Omschrijving', start_at:'Start met tijdzone-offset', end_at:'Einde met tijdzone-offset', timezone:'Tijdzone', value_cents:'Bedrag', currency:'Valuta', probability:'Kans (0–1)',expected_close_date:'Verwachte sluitdatum',closed_date:'Werkelijke sluitdatum',forecast_category:'Prognosecategorie', subject_id:'Onderwerp-ID', purpose:'Doel', status:'Status' };
      for (const name of fieldNames) {
        const sourcing=state.workspaceId==='procurement'&&['rfqs','bids'].includes(entity);const sourcingLabels={rfq_id:'Offerteaanvraag',rfq_revision:'Revisie aanvraag',supplier_id:'Leverancier',lines:'Artikelen',evidence_reference:'Herkomst bieding (bijv. offertekenmerk en datum)',target_cents:'Doelbedrag',owner_id:'Gebruikers-ID eigenaar',period_start:'Begin doelperiode',period_end:'Einde doelperiode',minimum_value_cents:'Vanaf bedrag',approval_steps:'Beoordelaars (gebruikers-ID’s, in volgorde)',allow_self_approval:'Aanvrager mag ook beoordelen'};const label=node('label','',sourcingLabels[name]||labels[name] || name), input=node((['status','calendar_id','allow_self_approval'].includes(name)||sourcing&&['rfq_id','supplier_id'].includes(name))?'select':['content','description','lines'].includes(name)?'textarea':'input');
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
        if(state.workspaceId==='marketing'&&entity==='creatives'&&!['APPROVED_INTERNAL','ARCHIVED'].includes(record.status))appendCreativeReviewRequest(record,cell,content);
        if(state.workspaceId==='marketing'&&entity==='creative_reviews')appendCreativeReview(record,cell,content);
        if(state.workspaceId==='procurement'&&entity==='rfqs'){const compare=node('button','secondary-button','Biedingen vergelijken');compare.type='button';compare.addEventListener('click',()=>renderProcurementComparison(record,content,notice));cell.append(compare);}
        if(state.workspaceId==='procurement'&&entity==='orders'&&!['APPROVED_INTERNAL','ARCHIVED','CANCELLED'].includes(record.status)){const prepare=node('button','secondary-button','Order ter beoordeling');prepare.type='button';prepare.addEventListener('click',()=>prepareProcurementAward({order_id:record.id},null,cell));cell.append(prepare);}
        if(state.workspaceId==='procurement'&&entity==='awards')appendAwardReview(record,cell,content);
        if(state.workspaceId==='sales'&&entity==='forecast_snapshots'){const detail=node('details');detail.append(node('summary','','Bewaarde prognose'));appendForecastResult(detail,record.forecast);cell.append(detail);}
        if(!['messages','notifications','awards','forecast_snapshots','creative_reviews'].includes(entity)&&record.status!=='APPROVED_INTERNAL')cell.append(edit);tr.append(cell);body.append(tr);
      }
      const summary=node('p','',`${result.total} records${result.next_offset!==null?' · eerste 100 getoond':''}`);
      const children=[summary];if(!['messages','notifications','awards','forecast_snapshots','creative_reviews'].includes(entity))children.push(form);
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
    const firstTab = byId('workspaceTabs').querySelector('button'); if (firstTab) selectSection(state.workspace.sections[0], firstTab);
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
