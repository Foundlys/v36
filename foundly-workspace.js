'use strict';

(() => {
  const byId = id => document.getElementById(id);
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
      const button = node('button', index === 0 ? 'active' : '', section);
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
    const metrics = Object.values(state.snapshot?.metrics || {}).slice(0, 6);
    for (const metric of metrics) {
      const definition = state.workspace?.default_widgets?.find(item => item.metric === metric.id);
      const item = node('div', 'context-item'); item.append(node('strong', '', definition?.label || metric.id.replaceAll('_', ' ')), node('span', '', `${formatMetric(metric)} · ${metric.source || 'SOURCE UNKNOWN'}`)); items.push(item);
    }
    if (!items.length) items.push(node('div', 'EmptyState NoDataState', 'Geen werkelijke records of metrics voor dit onderdeel beschikbaar.'));
    replaceChildren(content, items);
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
    const scope = byId('dashboardScope').value || 'PERSONAL';
    const qualifier = byId('dashboardQualifier').value.trim(), params = new URLSearchParams({ scope });
    if (scope === 'TEAM' && qualifier) params.set('team_id', qualifier);
    if (scope === 'ROLE' && qualifier) params.set('role', qualifier);
    const [definition, dashboard, snapshot] = await Promise.all([
      request(`/api/workspaces/${encodeURIComponent(state.workspaceId)}`),
      request(`/api/workspaces/${encodeURIComponent(state.workspaceId)}/dashboard?${params}`),
      request(`/api/workspaces/${encodeURIComponent(state.workspaceId)}/snapshot`)
    ]);
    state.workspace = definition.workspace; state.dashboard = dashboard.dashboard; state.snapshot = snapshot;
    byId('workspaceEyebrow').textContent = state.workspace.eyebrow;
    byId('workspaceTitle').textContent = state.workspace.label;
    byId('workspaceDescription').textContent = state.workspace.description;
    document.title = `${state.workspace.label} · Foundly OS`;
    populateWorkspaceFilters(); applyDashboardFilters(); renderTabs(); renderDashboard(); renderRecords(); renderSources(); updateNotice();
    const firstTab = byId('workspaceTabs').querySelector('button'); if (firstTab) selectSection(state.workspace.sections[0], firstTab);
  }

  async function saveDashboard() {
    const scope = byId('dashboardScope').value, qualifier = byId('dashboardQualifier').value.trim();
    const payload = { ...state.dashboard, scope, filters: { from: byId('dateFrom').value || null, to: byId('dateTo').value || null, compare: byId('comparePeriod').checked, source: byId('sourceFilter').value || null, status: byId('statusFilter').value || null } };
    if (scope === 'TEAM') payload.team_id = qualifier;
    if (scope === 'ROLE') payload.role = qualifier;
    const query = new URLSearchParams({ scope }); if (qualifier) query.set(scope === 'TEAM' ? 'team_id' : 'role', qualifier);
    try {
      const result = await request(`/api/workspaces/${encodeURIComponent(state.workspaceId)}/dashboard?${query}`, { method: 'PUT', headers: state.dashboard.revision ? { 'if-match': String(state.dashboard.revision) } : {}, body: JSON.stringify(payload) });
      state.dashboard = result.dashboard; toggleEditing(false); renderDashboard(); toast('Dashboard tenant- en gebruikersgebonden opgeslagen.');
    } catch (error) { toast(friendlyError(error), true); }
  }

  function toggleEditing(force) {
    state.editing = typeof force === 'boolean' ? force : !state.editing;
    byId('editDashboard').textContent = state.editing ? 'Bewerken sluiten' : 'Dashboard aanpassen';
    byId('addWidget').disabled = !state.editing; byId('saveDashboard').disabled = !state.editing; renderDashboard();
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
