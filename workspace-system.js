'use strict';
const { MODULES: COMMERCIAL_MODULES } = require('./module-catalog');
const { DEFINITIONS: BUSINESS_DOMAINS } = require('./business-domains');

const DASHBOARD_SCHEMA_VERSION = 'foundly-workspace-dashboard/1.0.0';
const WIDGET_TYPES = Object.freeze(['KPI', 'METRIC', 'TREND', 'CHART', 'TABLE', 'FUNNEL', 'ACTIVITY', 'STATUS', 'SOURCE', 'CONNECTOR']);
const DASHBOARD_SCOPES = Object.freeze(['PERSONAL', 'TEAM', 'ROLE', 'PRESET']);

function widget(id, label, type = 'KPI', width = 4, height = 3, description = '') {
  return { id, metric: id, label, type, x: 0, y: 0, w: width, h: height, description, filters: {} };
}

const WORKSPACE_DEFINITIONS = Object.freeze({
  ...Object.fromEntries(['procurement','sales','calendar'].map(id => [id, {
    id, route: COMMERCIAL_MODULES[id].route, label: COMMERCIAL_MODULES[id].display_name,
    short_label: COMMERCIAL_MODULES[id].display_name, capability: id, module_id: COMMERCIAL_MODULES[id].legacy_engine,
    eyebrow: 'FOUNDLY BUSINESS OPERATIONS', description: `${COMMERCIAL_MODULES[id].display_name}: eigen werkstromen, brongegevens en audit.`,
    sections: ['OVERVIEW',...BUSINESS_DOMAINS[id].entities.map(entity=>entity.toUpperCase())],
    domain_entities: BUSINESS_DOMAINS[id].entities, domain_required_fields: BUSINESS_DOMAINS[id].required,
    default_widgets: BUSINESS_DOMAINS[id].entities.map(entity=>widget(entity,entity.replaceAll('_',' ')))
  }])),
  home: {
    id: 'home', route: '/', label: 'Neural Command Center', short_label: 'Home', capability: 'core', module_id: 'data',
    eyebrow: 'FOUNDLY CORE', description: 'De centrale Neural-interface voor alle Foundly-capabilities.',
    sections: ['DOMAINS', 'SIGNALS', 'COMMAND', 'ZERO'],
    default_widgets: [widget('system_health', 'System health', 'STATUS'), widget('source_coverage', 'Source coverage', 'SOURCE'), widget('active_connectors', 'Active connectors', 'CONNECTOR')]
  },
  automotive: {
    id: 'automotive', route: '/automotive', label: 'Automotive OS', short_label: 'Automotive', capability: 'automotive', module_id: 'inkoop',
    eyebrow: 'AUTOMOTIVE CAPABILITY PACK', description: 'Provider-onafhankelijke inkoop-, markt- en voertuigintelligentie.',
    sections: ['OVERVIEW', 'TODAY', 'SEARCH', 'PROCUREMENT', 'VEHICLES', 'MARKET', 'COMPARABLES', 'VALUATION', 'ECONOMICS', 'BPM', 'BUY SCORE', 'INVENTORY', 'SALES', 'CUSTOMER MATCHING', 'ANALYTICS', 'SOURCES', 'CONNECTORS', 'ZERO'],
    default_widgets: [widget('provider_health', 'Provider health', 'STATUS', 6), widget('today_opportunities', "Today's opportunities", 'TABLE', 6), widget('top_buy_scores', 'Top Buy Scores', 'TABLE', 6), widget('recent_searches', 'Recent searches', 'ACTIVITY', 6), widget('market_movement', 'Market movement', 'TREND', 6), widget('inventory_risk', 'Inventory risk'), widget('stale_stock', 'Stale stock'), widget('recent_zero_recommendations', 'Recent ZERO recommendations', 'ACTIVITY', 6), widget('data_freshness', 'Data freshness', 'SOURCE', 6), widget('source_coverage', 'Source coverage', 'SOURCE', 6)]
  },
  crm: {
    id: 'crm', route: '/crm', label: 'CRM', short_label: 'CRM', capability: 'crm', module_id: 'crm',
    eyebrow: 'CUSTOMER INTELLIGENCE', description: 'Tenant-scoped customer, pipeline and relationship operations.',
    sections: ['OVERVIEW', 'CUSTOMERS', 'COMPANIES', 'CONTACTS', 'LEADS', 'DEALS', 'PIPELINES', 'TASKS', 'ACTIVITY', 'COMMUNICATION', 'SEGMENTS', 'FORECAST', 'AUTOMATIONS', 'ANALYTICS', 'DASHBOARDS', 'SETTINGS'],
    default_widgets: [widget('total_pipeline', 'Total pipeline'), widget('weighted_pipeline', 'Weighted pipeline'), widget('new_leads', 'New leads'), widget('qualified_leads', 'Qualified leads'), widget('conversion_rate', 'Conversion rate'), widget('won_revenue', 'Won revenue'), widget('average_deal', 'Average deal'), widget('sales_velocity', 'Sales velocity'), widget('stalled_deals', 'Stalled deals', 'TABLE', 6), widget('overdue_tasks', 'Overdue tasks'), widget('source_performance', 'Source performance', 'CHART', 6), widget('campaign_attribution', 'Campaign attribution', 'TABLE', 6), widget('forecast', 'Forecast', 'TREND', 6), widget('recent_activity', 'Recent activity', 'ACTIVITY', 6)]
  },
  analysis: {
    id: 'analysis', route: '/analysis', label: 'Analysis', short_label: 'Analysis', capability: 'analysis', module_id: 'analysis',
    eyebrow: 'CANONICAL BUSINESS INTELLIGENCE', description: 'Realtime, historical and attributable intelligence from canonical events.',
    sections: ['OVERVIEW', 'REALTIME', 'HISTORICAL', 'KPIs', 'FUNNELS', 'ATTRIBUTION', 'CAMPAIGNS', 'SALES', 'LEADS', 'CUSTOMERS', 'SOURCES', 'COHORTS', 'DATA QUALITY', 'ALERTS', 'DASHBOARDS'],
    default_widgets: [widget('revenue', 'Revenue'), widget('gross_margin', 'Gross margin'), widget('leads', 'Leads'), widget('qualified_leads', 'Qualified leads'), widget('conversion_rate', 'Conversion rate'), widget('roas', 'ROAS'), widget('funnel', 'Commercial funnel', 'FUNNEL', 6, 5), widget('realtime_events', 'Realtime events', 'ACTIVITY', 6, 5), widget('historical_rollups', 'Historical rollups', 'TABLE', 12, 5), widget('source_freshness', 'Source freshness', 'SOURCE', 6), widget('data_quality', 'Data quality', 'STATUS', 6)]
  },
  finance: {
    id: 'finance', route: '/finance', label: 'Finance', short_label: 'Finance', capability: 'finance', module_id: 'finance',
    eyebrow: 'POSTED IMMUTABLE JOURNALS', description: 'Auditable accounting, cash, working capital and reporting.',
    sections: ['OVERVIEW', 'LEDGER', 'SALES INVOICES', 'PURCHASE INVOICES', 'PAYMENTS', 'BANK', 'RECONCILIATION', 'RECEIVABLES', 'PAYABLES', 'VAT', 'ASSETS', 'MARGINS', 'BUDGETS', 'FORECASTS', 'REPORTS', 'CLOSE', 'EXPORTS', 'AUDIT'],
    default_widgets: [widget('cash', 'Cash'), widget('bank', 'Bank'), widget('revenue', 'Revenue'), widget('gross_margin', 'Gross margin'), widget('expenses', 'Expenses'), widget('receivables', 'Receivables'), widget('payables', 'Payables'), widget('overdue', 'Overdue'), widget('vat_position', 'VAT position'), widget('cash_flow_forecast', 'Cash-flow forecast', 'TREND', 8, 4)]
  },
  data: {
    id: 'data', route: '/data', label: 'Data Platform', short_label: 'Data', capability: 'data', module_id: 'data',
    eyebrow: 'CANONICAL DATA FABRIC', description: 'Lineage, ingestion, quality, storage and retention control plane.',
    sections: ['OVERVIEW', 'DATASETS', 'SOURCES', 'INGESTION', 'SCHEMAS', 'LINEAGE', 'QUALITY', 'FRESHNESS', 'CONFLICTS', 'SYNC', 'RETENTION', 'OFFLINE', 'EXPORTS'],
    default_widgets: [widget('records', 'Records'), widget('ingestion_rate', 'Ingestion rate'), widget('sources', 'Sources'), widget('freshness', 'Freshness', 'SOURCE'), widget('stale_sources', 'Stale sources'), widget('rejected_records', 'Rejected records'), widget('duplicates', 'Duplicates'), widget('conflicts', 'Conflicts'), widget('schema_versions', 'Schema versions', 'STATUS'), widget('storage_health', 'Storage health', 'STATUS'), widget('event_throughput', 'Event throughput', 'TREND', 8, 4)]
  },
  knowledge: {
    id: 'knowledge', route: '/knowledge', label: 'Knowledge', short_label: 'Knowledge', capability: 'knowledge', module_id: 'data',
    eyebrow: 'EVIDENCE GRAPH', description: 'Permission-filtered knowledge with evidence, confidence and supersession.',
    sections: ['OVERVIEW', 'EVIDENCE', 'INSIGHTS', 'DOCUMENTS', 'MEMORY', 'SOURCES', 'CONFIDENCE', 'VALIDITY', 'SUPERSESSION', 'SEARCH', 'AUDIT'],
    default_widgets: [widget('knowledge_records', 'Knowledge records'), widget('evidence_coverage', 'Evidence coverage'), widget('average_confidence', 'Average confidence'), widget('current_records', 'Current records'), widget('stale_records', 'Stale records'), widget('superseded_records', 'Superseded records'), widget('knowledge_sources', 'Knowledge sources', 'SOURCE', 6), widget('recent_knowledge', 'Recent knowledge', 'TABLE', 6, 5)]
  },
  learning: {
    id: 'learning', route: '/learning', label: 'Learning', short_label: 'Learning', capability: 'learning', module_id: 'analysis',
    eyebrow: 'OUTCOME CALIBRATION', description: 'Evidence-backed recommendation, outcome, feedback and rule calibration.',
    sections: ['OVERVIEW', 'RECOMMENDATIONS', 'OUTCOMES', 'FEEDBACK', 'SUCCESS', 'FAILURES', 'CALIBRATION', 'RULE VERSIONS', 'MODEL VERSIONS', 'LESSONS', 'AUDIT'],
    default_widgets: [widget('recommendations', 'Recommendations'), widget('evaluated', 'Evaluated'), widget('unevaluated', 'Awaiting outcome'), widget('feedback_records', 'Feedback records'), widget('success', 'Confirmed success'), widget('failures', 'Confirmed failures'), widget('calibration', 'Calibration', 'TREND', 6), widget('rule_versions', 'Rule versions', 'TABLE', 6), widget('model_versions', 'Model versions', 'TABLE', 6), widget('recent_lessons', 'Recent lessons', 'TABLE', 6, 5)]
  },
  automation: {
    id: 'automation', route: '/automation', label: 'Automation', short_label: 'Automation', capability: 'automation', module_id: 'automatisering',
    eyebrow: 'AUDITED EXECUTION', description: 'Versioned workflows with approvals, idempotency and failure isolation.',
    sections: ['OVERVIEW', 'WORKFLOWS', 'TRIGGERS', 'ACTIONS', 'RUNS', 'APPROVALS', 'RETRIES', 'FAILURES', 'DEPENDENCIES', 'AUDIT'],
    default_widgets: [widget('workflows', 'Workflows'), widget('runs', 'Runs'), widget('awaiting_approval', 'Awaiting approval'), widget('retries', 'Retries'), widget('failures', 'Failures'), widget('execution_adapter', 'Execution adapter', 'STATUS'), widget('dependencies', 'Dependencies', 'CONNECTOR', 6), widget('recent_runs', 'Recent runs', 'TABLE', 6, 5)]
  },
  connectors: {
    id: 'connectors', route: '/connectors', label: 'Connector Control Center', short_label: 'Connectors', capability: 'connectors', module_id: 'integraties',
    eyebrow: 'INTEGRATION CONTROL PLANE', description: 'Truthful setup, authorization, probes, sync, freshness and audit.',
    sections: ['ALL', 'CONNECTED', 'AWAITING ACCESS', 'UNCONFIGURED', 'DEGRADED', 'ERROR'],
    detail_sections: ['OVERVIEW', 'CAPABILITIES', 'SETUP', 'AUTHENTICATION', 'DATA', 'SYNC', 'EVENTS', 'ERRORS', 'AUDIT'],
    default_widgets: [widget('connector_total', 'All connectors'), widget('connector_connected', 'Connected'), widget('connector_awaiting_access', 'Awaiting access'), widget('connector_unconfigured', 'Unconfigured'), widget('connector_degraded', 'Degraded'), widget('connector_errors', 'Errors'), widget('connector_catalog', 'Connector catalog', 'CONNECTOR', 12, 8)]
  },
  communication: {
    id: 'communication', route: '/communication', label: 'Communication', short_label: 'Communication', capability: 'communication', module_id: 'communicatie',
    eyebrow: 'OMNICHANNEL OPERATIONS', description: 'Audited inbox, calendar, voice and notification surfaces.',
    sections: ['OVERVIEW', 'DRAFTS', 'MESSAGES', 'THREADS', 'TEMPLATES', 'PREFERENCES', 'INBOX', 'EMAIL', 'WHATSAPP', 'CALENDAR', 'VOICE', 'NOTIFICATIONS', 'AUTOMATIONS', 'AUDIT'],
    domain_entities: BUSINESS_DOMAINS.communication.entities, domain_required_fields: BUSINESS_DOMAINS.communication.required,
    default_widgets: [widget('messages', 'Messages'), widget('inbound', 'Inbound'), widget('outbound', 'Outbound'), widget('unread', 'Unread'), widget('appointments', 'Calendar events'), widget('communication_channels', 'Channel availability', 'CONNECTOR', 6), widget('recent_communication', 'Recent communication', 'TABLE', 6, 5), widget('voice_status', 'Voice status', 'STATUS')]
  },
  marketing: {
    id: 'marketing', route: '/marketing', label: 'Marketing', short_label: 'Marketing', capability: 'marketing', module_id: 'social_media',
    eyebrow: 'ACQUISITION INTELLIGENCE', description: 'Meta, Google and canonical measurement performance without synthetic metrics.',
    sections: ['OVERVIEW', 'CAMPAIGNS', 'META', 'GOOGLE ADS', 'SOCIAL', 'LEADS', 'ATTRIBUTION', 'CONVERSIONS', 'AUDIENCES', 'CREATIVES', 'EXPERIMENTS', 'MEASUREMENT', 'CONNECTORS'],
    domain_entities: BUSINESS_DOMAINS.marketing.entities, domain_required_fields: BUSINESS_DOMAINS.marketing.required,
    default_widgets: [widget('spend', 'Spend'), widget('impressions', 'Impressions'), widget('clicks', 'Clicks'), widget('ctr', 'CTR'), widget('cpc', 'CPC'), widget('leads', 'Leads'), widget('cpl', 'CPL'), widget('conversions', 'Conversions'), widget('cpa', 'CPA'), widget('revenue', 'Revenue'), widget('roas', 'ROAS'), widget('attribution', 'Attribution', 'CHART', 6), widget('source_freshness', 'Source freshness', 'SOURCE', 6)]
  },
  settings: {
    id: 'settings', route: '/settings', label: 'Settings', short_label: 'Settings', capability: 'settings', module_id: 'integraties',
    eyebrow: 'TENANT CONTROL', description: 'Foundly, tenant, user, provisioner and runtime configuration.',
    sections: ['OVERVIEW', 'TENANT', 'USERS', 'ROLES', 'CAPABILITIES', 'PROVISIONER', 'ZERO', 'SECURITY', 'PERSISTENCE', 'AUDIT'],
    default_widgets: [widget('tenant_identity', 'Tenant identity', 'STATUS'), widget('enabled_capabilities', 'Enabled capabilities', 'STATUS'), widget('role_model', 'Role model', 'STATUS'), widget('runtime_readiness', 'Runtime readiness', 'STATUS'), widget('persistence', 'Persistence', 'STATUS'), widget('zero_preferences', 'ZERO preferences', 'STATUS')]
  }
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function packWidgets(input) {
  let x = 0, y = 0, rowHeight = 0;
  return input.map(item => {
    const next = { ...item, w: Math.max(2, Math.min(12, Number(item.w) || 4)), h: Math.max(2, Math.min(12, Number(item.h) || 3)) };
    if (x + next.w > 12) { x = 0; y += rowHeight || 3; rowHeight = 0; }
    next.x = x; next.y = y; x += next.w; rowHeight = Math.max(rowHeight, next.h);
    if (x >= 12) { x = 0; y += rowHeight; rowHeight = 0; }
    return next;
  });
}

function dashboardTemplate(workspaceId, principalId = 'foundly-user') {
  const workspace = WORKSPACE_DEFINITIONS[workspaceId];
  if (!workspace) return null;
  return {
    schema_version: DASHBOARD_SCHEMA_VERSION,
    id: `preset-${workspaceId}-command-dashboard`,
    workspace_id: workspaceId,
    name: `${workspace.label} Command Dashboard`,
    scope: 'PRESET',
    owner_id: principalId,
    team_id: null,
    role: null,
    is_default: true,
    preset: true,
    widgets: packWidgets(clone(workspace.default_widgets)),
    filters: { from: null, to: null, compare: false, source: null, status: null },
    revision: 1,
    no_fake_data: true
  };
}

function cleanText(value, max = 160) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
}

function normalizeDashboard(workspaceId, input = {}, principalId = 'foundly-user') {
  const workspace = WORKSPACE_DEFINITIONS[workspaceId];
  if (!workspace) throw Object.assign(new Error('Onbekende workspace'), { statusCode: 404, code: 'workspace_not_found' });
  const defaults = dashboardTemplate(workspaceId, principalId), allowedMetrics = new Map(workspace.default_widgets.map(item => [item.metric, item]));
  const scope = DASHBOARD_SCOPES.includes(String(input.scope || '').toUpperCase()) ? String(input.scope).toUpperCase() : 'PERSONAL';
  const widgets = (Array.isArray(input.widgets) ? input.widgets : defaults.widgets).slice(0, 40).map((item, index) => {
    const metric = cleanText(item.metric || item.id, 100), definition = allowedMetrics.get(metric);
    if (!definition) throw Object.assign(new Error(`Widgetmetric niet toegestaan voor ${workspaceId}: ${metric}`), { statusCode: 422, code: 'dashboard_widget_invalid' });
    const type = WIDGET_TYPES.includes(String(item.type || definition.type).toUpperCase()) ? String(item.type || definition.type).toUpperCase() : definition.type;
    return {
      id: cleanText(item.id || `${workspaceId}-${metric}-${index}`, 120), metric, label: cleanText(item.label || definition.label, 120), type,
      x: Math.max(0, Math.min(11, Number(item.x) || 0)), y: Math.max(0, Math.min(500, Number(item.y) || 0)),
      w: Math.max(2, Math.min(12, Number(item.w) || definition.w || 4)), h: Math.max(2, Math.min(12, Number(item.h) || definition.h || 3)),
      description: cleanText(definition.description || '', 300), filters: typeof item.filters === 'object' && item.filters ? clone(item.filters) : {}
    };
  });
  const filters = typeof input.filters === 'object' && input.filters ? input.filters : {};
  return {
    schema_version: DASHBOARD_SCHEMA_VERSION,
    id: cleanText(input.id || `dashboard-${workspaceId}`, 160), workspace_id: workspaceId,
    name: cleanText(input.name || `${workspace.label} Dashboard`, 160), scope, owner_id: principalId,
    team_id: scope === 'TEAM' ? cleanText(input.team_id, 160) || null : null,
    role: scope === 'ROLE' ? cleanText(input.role, 80).toUpperCase() || null : null,
    is_default: input.is_default !== false, preset: false, widgets: packWidgets(widgets),
    filters: {
      from: cleanText(filters.from, 40) || null, to: cleanText(filters.to, 40) || null,
      compare: Boolean(filters.compare), source: cleanText(filters.source, 120) || null,
      status: cleanText(filters.status, 120) || null
    },
    no_fake_data: true
  };
}

function publicWorkspace(workspace) {
  return { ...clone(workspace), default_dashboard: dashboardTemplate(workspace.id), zero_available: true, tenant_scoped: true, rbac_enforced: true, sources_available: true, connectors_available: true };
}

function navigationFor(principal = {}, enabledCapabilities = []) {
  const roles = (principal.roles || []).map(role => String(role).toUpperCase());
  const inspectAll = roles.some(role => ['ADMIN', 'SUPER_ADMIN', 'FOUNDER'].includes(role));
  const enabled = new Set((enabledCapabilities || []).map(value => String(value).toLowerCase()));
  return Object.values(WORKSPACE_DEFINITIONS).filter(workspace => inspectAll || workspace.id === 'home' || enabled.has(workspace.capability) || enabled.has(workspace.id)).map(publicWorkspace);
}

module.exports = {
  DASHBOARD_SCHEMA_VERSION,
  DASHBOARD_SCOPES,
  WIDGET_TYPES,
  WORKSPACE_DEFINITIONS,
  dashboardTemplate,
  normalizeDashboard,
  navigationFor,
  publicWorkspace
};
