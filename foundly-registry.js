'use strict';

const CONNECTOR_LIFECYCLE = Object.freeze([
  'UNCONFIGURED', 'AWAITING_ACCESS', 'CONFIGURED', 'AUTHORIZING', 'AUTHENTICATED',
  'PROBING', 'SYNCING', 'CONNECTED', 'DEGRADED', 'ERROR', 'EXPIRED', 'DISCONNECTED'
]);

const SOURCE_SCHEMA_FIELDS = Object.freeze([
  'source_id', 'provider_id', 'connector_id', 'display_name', 'description', 'categories',
  'capabilities', 'industries', 'regions', 'source_type', 'data_type', 'runtime_role',
  'supports_read', 'supports_write', 'supports_search', 'supports_realtime',
  'supports_webhook', 'supports_images', 'supports_vehicle_truth', 'supports_listings',
  'supports_valuation', 'supports_fx', 'supports_reasoning', 'supports_measurement',
  'supports_communication', 'requires_credentials', 'requires_oauth',
  'requires_partner_access', 'configured', 'authenticated', 'probe_status', 'sync_status',
  'connection_status', 'freshness_status', 'last_probe_at', 'last_probe_latency_ms',
  'last_sync_at', 'last_success_at', 'last_failure_at', 'safe_error_code',
  'records_available', 'tenant_scope', 'permission_scope', 'provenance_supported',
  'retention_policy', 'configuration_source', 'runtime_enabled'
]);

// These are contract slots missing from the historical registry. They contain only
// public metadata and variable names; never credentials or secret defaults.
const REQUIRED_CONNECTOR_ADDITIONS = Object.freeze({
  autotelex: {
    naam: 'Autotelex', categorie: 'waardering', auth: 'partner',
    env: ['AUTOTELEX_API_KEY'], modules: ['data', 'inkoop', 'verkoop', 'rapportages'],
    capabilities: ['connect', 'test', 'sync', 'valuation', 'vehicle_data', 'bpm', 'economics', 'tenant_credentials', 'data_ingest'],
    access_state: 'AWAITING_ACCESS'
  },
  rdc: {
    naam: 'RDC / VTS-XML', categorie: 'voertuigdata', auth: 'partner_credentials',
    env: ['RDC_USERNAME', 'RDC_PASSWORD'], modules: ['data', 'inkoop', 'verkoop', 'voorraad'],
    capabilities: ['connect', 'test', 'sync', 'vehicle_truth', 'vehicle_enrichment', 'tenant_credentials', 'data_ingest'],
    access_state: 'AWAITING_ACCESS'
  },
  google: {
    naam: 'Google', categorie: 'google_platform', auth: 'oauth2',
    env: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'], modules: ['google', 'data', 'crm', 'rapportages', 'agenda'],
    capabilities: ['connect', 'oauth', 'test', 'search', 'analytics', 'measurement', 'calendar', 'tenant_credentials', 'data_ingest']
  },
  facebook: {
    naam: 'Facebook', categorie: 'social', auth: 'oauth2',
    env: ['META_APP_ID', 'META_APP_SECRET'], modules: ['social', 'data', 'crm', 'rapportages'],
    capabilities: ['connect', 'oauth', 'test', 'sync', 'pages', 'leads', 'measurement', 'webhook', 'tenant_credentials', 'data_ingest']
  },
  openai_realtime: {
    naam: 'OpenAI Realtime', categorie: 'spraak_ai', auth: 'api_key',
    env: ['OPENAI_API_KEY'], modules: ['communicatie', 'crm', 'agenda', 'inkoop', 'verkoop'],
    capabilities: ['connect', 'test', 'realtime', 'speech', 'conversation', 'barge_in', 'tenant_credentials']
  },
  google_measurement_protocol: {
    naam: 'Google Measurement Protocol', categorie: 'tracking', auth: 'api_secret',
    env: ['GA4_MEASUREMENT_ID', 'GA4_API_SECRET'], modules: ['google', 'data', 'rapportages'],
    capabilities: ['connect', 'test', 'measurement', 'events_write', 'tenant_credentials']
  },
  google_enhanced_conversions: {
    naam: 'Google Ads Enhanced Conversions', categorie: 'tracking', auth: 'oauth2_and_token',
    env: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_ADS_DEVELOPER_TOKEN', 'GOOGLE_ADS_CUSTOMER_ID'],
    modules: ['google', 'data', 'crm', 'rapportages'],
    capabilities: ['connect', 'oauth', 'test', 'measurement', 'conversion_write', 'tenant_credentials']
  }
});

const PARTNER_ACCESS = new Set([
  'marktplaats', 'mobile_de', 'autoscout24', 'vwe', 'autotelex', 'rdc', 'auto1', 'bca',
  'autorola', 'caronsale', 'ecarstrade', 'openlane', 'cars_on_the_web', 'heycar',
  'gaspedaal', 'autotrack', 'autoweek', 'finnik', 'carvertical', 'carfax', 'autobiz',
  'autouncle', 'indicata', 'jato', 'cap_hpi', 'autoflex', 'carsys', 'wheelerdelta'
]);

const SOURCE_OVERRIDES = Object.freeze({
  openai: {
    provider_id: 'openai', display_name: 'OpenAI',
    description: 'Reasoning, structured extraction, tool planning, synthesis and knowledge analysis.',
    categories: ['AI_INTELLIGENCE', 'KNOWLEDGE_SYNTHESIS', 'REASONING', 'CONVERSATION'],
    capabilities: ['reasoning', 'structured_extraction', 'tool_planning', 'synthesis', 'conversation', 'knowledge_analysis'],
    source_type: ['AI_PROVIDER'], data_type: ['DERIVED_INTELLIGENCE', 'KNOWLEDGE'], runtime_role: ['REASONING', 'SYNTHESIS']
  },
  voice: {
    source_id: 'openai_realtime', provider_id: 'openai', display_name: 'OpenAI Realtime',
    description: 'Realtime speech interaction, barge-in and voice response for ZERO.',
    categories: ['REALTIME_AI', 'VOICE', 'CONVERSATION'],
    capabilities: ['realtime_session', 'speech_interaction', 'barge_in', 'voice_response'],
    source_type: ['AI_PROVIDER'], data_type: ['AUDIO', 'CONVERSATION'], runtime_role: ['REALTIME', 'VOICE']
  },
  openai_realtime: {
    provider_id: 'openai', display_name: 'OpenAI Realtime',
    description: 'Realtime speech interaction, barge-in and voice response for ZERO.',
    categories: ['REALTIME_AI', 'VOICE', 'CONVERSATION'],
    capabilities: ['realtime_session', 'speech_interaction', 'barge_in', 'voice_response'],
    source_type: ['AI_PROVIDER'], data_type: ['AUDIO', 'CONVERSATION'], runtime_role: ['REALTIME', 'VOICE']
  },
  rdw: {
    display_name: 'RDW Open Data', categories: ['AUTOMOTIVE_VEHICLE_TRUTH', 'PUBLIC_DATA'],
    capabilities: ['vehicle_truth', 'registration_lookup', 'public_search'], source_type: ['PUBLIC_API'],
    data_type: ['VEHICLE_TRUTH'], runtime_role: ['ENRICHMENT', 'VERIFICATION']
  },
  mobile_de: {
    display_name: 'mobile.de', categories: ['AUTOMOTIVE_MARKETPLACE', 'PROCUREMENT'],
    capabilities: ['listings', 'search', 'images', 'seller_data'], source_type: ['EXTERNAL_API', 'MARKETPLACE'],
    data_type: ['VEHICLE_LISTINGS'], runtime_role: ['SEARCH', 'PROCUREMENT']
  },
  marktplaats: {
    display_name: 'Marktplaats', categories: ['AUTOMOTIVE_MARKETPLACE', 'PROCUREMENT'],
    capabilities: ['listings', 'search', 'images', 'seller_data'], source_type: ['EXTERNAL_API', 'MARKETPLACE'],
    data_type: ['VEHICLE_LISTINGS'], runtime_role: ['SEARCH', 'PROCUREMENT']
  },
  autoscout24: {
    display_name: 'AutoScout24', categories: ['AUTOMOTIVE_MARKETPLACE', 'PROCUREMENT'],
    capabilities: ['listings', 'search', 'images', 'seller_data'], source_type: ['EXTERNAL_API', 'MARKETPLACE'],
    data_type: ['VEHICLE_LISTINGS'], runtime_role: ['SEARCH', 'PROCUREMENT']
  },
  vwe: {
    display_name: 'VWE Automotive', categories: ['AUTOMOTIVE_DATA', 'VEHICLE_ENRICHMENT', 'DEALER_SERVICES'],
    capabilities: ['vehicle_data', 'vehicle_enrichment', 'dealer_services'], source_type: ['EXTERNAL_API'],
    data_type: ['VEHICLE_DATA'], runtime_role: ['ENRICHMENT']
  },
  autotelex: {
    display_name: 'Autotelex', categories: ['AUTOMOTIVE_VALUATION', 'VEHICLE_DATA', 'BPM', 'ECONOMICS'],
    capabilities: ['valuation', 'vehicle_data', 'bpm', 'economics'], source_type: ['EXTERNAL_API'],
    data_type: ['VALUATION', 'VEHICLE_DATA'], runtime_role: ['VALUATION', 'ECONOMICS']
  },
  rdc: {
    display_name: 'RDC / VTS-XML', categories: ['AUTOMOTIVE_VEHICLE_DATA', 'VEHICLE_ENRICHMENT'],
    capabilities: ['vehicle_data', 'vehicle_enrichment'], source_type: ['EXTERNAL_API'],
    data_type: ['VEHICLE_DATA'], runtime_role: ['ENRICHMENT', 'VERIFICATION']
  },
  ecb_fx: {
    provider_id: 'ecb', display_name: 'ECB wisselkoersen', categories: ['FINANCIAL_REFERENCE', 'FX', 'PUBLIC_DATA'],
    capabilities: ['fx', 'reference_rates'], source_type: ['PUBLIC_API', 'FINANCIAL_REFERENCE'],
    data_type: ['FX_RATES'], runtime_role: ['REFERENCE', 'CALCULATION']
  },
  meta: {
    display_name: 'Meta', categories: ['MARKETING', 'SOCIAL', 'MEASUREMENT', 'LEADS'],
    capabilities: ['campaigns', 'social', 'measurement', 'leads', 'webhook'], source_type: ['EXTERNAL_API'],
    data_type: ['MARKETING', 'LEADS', 'MEASUREMENT'], runtime_role: ['INGESTION', 'ACTIVATION']
  },
  facebook_pages: { source_id: 'facebook', provider_id: 'meta', display_name: 'Facebook', categories: ['SOCIAL', 'MARKETING', 'LEADS'] },
  facebook: { provider_id: 'meta', display_name: 'Facebook', categories: ['SOCIAL', 'MARKETING', 'LEADS'] },
  instagram: { provider_id: 'meta', display_name: 'Instagram', categories: ['SOCIAL', 'MARKETING', 'LEADS'] },
  google: {
    display_name: 'Google', categories: ['SEARCH', 'MARKETING', 'MEASUREMENT', 'ANALYTICS'],
    capabilities: ['search', 'marketing', 'measurement', 'analytics', 'calendar'], source_type: ['EXTERNAL_API'],
    data_type: ['SEARCH', 'MARKETING', 'ANALYTICS'], runtime_role: ['INGESTION', 'ACTIVATION']
  },
  google_ads: { provider_id: 'google', display_name: 'Google Ads', categories: ['SEARCH', 'MARKETING', 'MEASUREMENT'] },
  ga4: { provider_id: 'google', display_name: 'Google Analytics 4', categories: ['ANALYTICS', 'MEASUREMENT'] },
  google_measurement_protocol: { provider_id: 'google', display_name: 'Google Measurement Protocol', categories: ['MEASUREMENT', 'ANALYTICS'] },
  google_enhanced_conversions: { provider_id: 'google', display_name: 'Google Ads Enhanced Conversions', categories: ['MEASUREMENT', 'MARKETING'] },
  meta_pixel: { provider_id: 'meta', display_name: 'Meta Pixel', categories: ['MEASUREMENT', 'MARKETING'] },
  meta_capi: { provider_id: 'meta', display_name: 'Meta Conversions API', categories: ['MEASUREMENT', 'MARKETING'] },
  email: { categories: ['COMMUNICATION'], capabilities: ['email', 'send', 'receive'], data_type: ['MESSAGES'] },
  google_calendar: { provider_id: 'google', categories: ['COMMUNICATION', 'CALENDAR'], capabilities: ['calendar', 'events'] },
  whatsapp: { provider_id: 'meta', categories: ['COMMUNICATION'], capabilities: ['messaging', 'webhook'] }
});

const INTERNAL_SOURCES = Object.freeze([
  {
    source_id: 'foundly_core', provider_id: 'foundly', connector_id: null, display_name: 'Foundly Core',
    description: 'Tenant-scoped operational records and audited internal actions.',
    categories: ['INTERNAL_DATA'], capabilities: ['read', 'write', 'audit'], industries: ['ALL'], regions: ['TENANT'],
    source_type: ['INTERNAL_DATA'], data_type: ['OPERATIONAL_RECORDS'], runtime_role: ['SYSTEM_OF_RECORD'],
    supports_read: true, supports_write: true, supports_search: true, supports_realtime: false,
    supports_webhook: false, supports_images: false, supports_vehicle_truth: false, supports_listings: false,
    supports_valuation: false, supports_fx: false, supports_reasoning: false, supports_measurement: false,
    supports_communication: false, requires_credentials: false, requires_oauth: false, requires_partner_access: false,
    configured: true, authenticated: true, probe_status: 'INTERNAL', sync_status: 'NOT_APPLICABLE',
    connection_status: 'CONNECTED', freshness_status: 'LIVE', last_probe_at: null, last_probe_latency_ms: null,
    last_sync_at: null, last_success_at: null, last_failure_at: null, safe_error_code: null, records_available: 0,
    tenant_scope: 'CURRENT_TENANT_AND_DEALER', permission_scope: ['tenant:read', 'tenant:write'],
    provenance_supported: true, retention_policy: 'TENANT_POLICY', configuration_source: 'FOUNDLY_RUNTIME', runtime_enabled: true
  },
  {
    source_id: 'canonical_events', provider_id: 'foundly', connector_id: null, display_name: 'Foundly Canonical Events',
    description: 'Append-only tenant event layer used by Analysis and measurement orchestration.',
    categories: ['INTERNAL_DATA', 'ANALYTICS', 'MEASUREMENT'], capabilities: ['events', 'realtime', 'lineage'],
    industries: ['ALL'], regions: ['TENANT'], source_type: ['INTERNAL_DATA'], data_type: ['CANONICAL_EVENTS'],
    runtime_role: ['EVENT_STORE', 'ANALYTICS'], supports_read: true, supports_write: true, supports_search: true,
    supports_realtime: true, supports_webhook: true, supports_images: false, supports_vehicle_truth: false,
    supports_listings: false, supports_valuation: false, supports_fx: false, supports_reasoning: false,
    supports_measurement: true, supports_communication: false, requires_credentials: false, requires_oauth: false,
    requires_partner_access: false, configured: true, authenticated: true, probe_status: 'INTERNAL',
    sync_status: 'NOT_APPLICABLE', connection_status: 'CONNECTED', freshness_status: 'UNKNOWN', last_probe_at: null,
    last_probe_latency_ms: null, last_sync_at: null, last_success_at: null, last_failure_at: null, safe_error_code: null,
    records_available: 0, tenant_scope: 'CURRENT_TENANT_AND_DEALER', permission_scope: ['analysis:read', 'events:read'],
    provenance_supported: true, retention_policy: 'TENANT_EVENT_POLICY', configuration_source: 'FOUNDLY_RUNTIME', runtime_enabled: true
  },
  {
    source_id: 'foundly_knowledge', provider_id: 'foundly', connector_id: null, display_name: 'Foundly Knowledge',
    description: 'Permission-filtered, evidence-backed and versioned tenant knowledge.',
    categories: ['KNOWLEDGE'], capabilities: ['search', 'evidence', 'supersession', 'confidence'], industries: ['ALL'],
    regions: ['TENANT'], source_type: ['INTERNAL_DATA', 'KNOWLEDGE_SOURCE'], data_type: ['KNOWLEDGE_OBJECTS'],
    runtime_role: ['RETRIEVAL'], supports_read: true, supports_write: true, supports_search: true, supports_realtime: false,
    supports_webhook: false, supports_images: false, supports_vehicle_truth: false, supports_listings: false,
    supports_valuation: false, supports_fx: false, supports_reasoning: false, supports_measurement: false,
    supports_communication: false, requires_credentials: false, requires_oauth: false, requires_partner_access: false,
    configured: true, authenticated: true, probe_status: 'INTERNAL', sync_status: 'NOT_APPLICABLE',
    connection_status: 'CONNECTED', freshness_status: 'UNKNOWN', last_probe_at: null, last_probe_latency_ms: null,
    last_sync_at: null, last_success_at: null, last_failure_at: null, safe_error_code: null, records_available: 0,
    tenant_scope: 'CURRENT_TENANT_AND_DEALER', permission_scope: ['knowledge:read', 'knowledge:write'],
    provenance_supported: true, retention_policy: 'KNOWLEDGE_LIFECYCLE', configuration_source: 'FOUNDLY_RUNTIME', runtime_enabled: true
  }
]);

function domainInternalSource({ source_id, display_name, description, categories, capabilities, data_type, runtime_role, permission_scope, retention_policy }) {
  return {
    source_id, provider_id: 'foundly', connector_id: null, display_name, description,
    categories, capabilities, industries: ['ALL'], regions: ['TENANT'], source_type: ['INTERNAL_DATA'], data_type, runtime_role,
    supports_read: true, supports_write: true, supports_search: true, supports_realtime: false,
    supports_webhook: false, supports_images: false, supports_vehicle_truth: false, supports_listings: false,
    supports_valuation: false, supports_fx: false, supports_reasoning: false, supports_measurement: false,
    supports_communication: false, requires_credentials: false, requires_oauth: false, requires_partner_access: false,
    configured: true, authenticated: true, probe_status: 'INTERNAL', sync_status: 'NOT_APPLICABLE',
    connection_status: 'CONNECTED', freshness_status: 'UNKNOWN', last_probe_at: null, last_probe_latency_ms: null,
    last_sync_at: null, last_success_at: null, last_failure_at: null, safe_error_code: null, records_available: 0,
    tenant_scope: 'CURRENT_TENANT_AND_DEALER', permission_scope, provenance_supported: true, retention_policy,
    configuration_source: 'FOUNDLY_RUNTIME', runtime_enabled: true
  };
}

const DOMAIN_INTERNAL_SOURCES = Object.freeze([
  domainInternalSource({
    source_id: 'foundly_automotive_history', display_name: 'Foundly Automotive history',
    description: 'Tenant-scoped provider-verified listing, vehicle-truth, search and listing-history records.',
    categories: ['INTERNAL_DATA', 'AUTOMOTIVE_HISTORY'], capabilities: ['search_history', 'listing_history', 'vehicle_history'],
    data_type: ['AUTOMOTIVE_RECORDS'], runtime_role: ['HISTORY', 'CACHE'], permission_scope: ['tenant:read'],
    retention_policy: 'AUTOMOTIVE_SOURCE_AND_TENANT_POLICY'
  }),
  domainInternalSource({
    source_id: 'foundly_crm', display_name: 'Foundly CRM',
    description: 'Tenant-scoped customer, lead, deal, task and relationship records from the existing CRM Core.',
    categories: ['INTERNAL_DATA', 'CRM'], capabilities: ['customers', 'leads', 'deals', 'relationships'],
    data_type: ['CRM_RECORDS'], runtime_role: ['SYSTEM_OF_RECORD'], permission_scope: ['crm:read_assigned'],
    retention_policy: 'CRM_TENANT_POLICY'
  }),
  domainInternalSource({
    source_id: 'foundly_inventory', display_name: 'Foundly inventory',
    description: 'Tenant-scoped persisted inventory used by Automotive, CRM and operational analysis.',
    categories: ['INTERNAL_DATA', 'AUTOMOTIVE_INVENTORY'], capabilities: ['inventory', 'stock_age', 'customer_matching'],
    data_type: ['INVENTORY_RECORDS'], runtime_role: ['SYSTEM_OF_RECORD'], permission_scope: ['tenant:read'],
    retention_policy: 'INVENTORY_TENANT_POLICY'
  })
]);

function augmentConnectorRegistry(registry) {
  for (const [connectorId, contract] of Object.entries(REQUIRED_CONNECTOR_ADDITIONS)) {
    if (!registry[connectorId]) registry[connectorId] = { ...contract };
  }
  return registry;
}

function values(input) {
  return [...new Set((Array.isArray(input) ? input : input ? [input] : []).map(value => String(value).trim()).filter(Boolean))];
}

function tokens(input) {
  return values(input).map(value => value.toLowerCase().replace(/[^a-z0-9]+/g, '_'));
}

function inferredCategories(category) {
  const value = String(category || 'OTHER').toUpperCase();
  const map = {
    AUTOMOTIVE_MARKTPLAATS: ['AUTOMOTIVE_MARKETPLACE', 'PROCUREMENT'], AUTOMOTIVE_B2B: ['AUTOMOTIVE_MARKETPLACE', 'PROCUREMENT'],
    AUTOMOTIVE_MARKET_INTEL: ['AUTOMOTIVE_MARKET_INTELLIGENCE'], VOERTUIGDATA: ['AUTOMOTIVE_VEHICLE_DATA'],
    VOERTUIGHISTORIE: ['AUTOMOTIVE_VEHICLE_HISTORY'], WAARDERING: ['AUTOMOTIVE_VALUATION'],
    FINANCIEEL_DATA: ['FINANCIAL_REFERENCE'], AI_SEARCH: ['AI_INTELLIGENCE'], SPRAAK_AI: ['VOICE', 'REALTIME_AI'],
    SOCIAL_ADS: ['MARKETING', 'SOCIAL'], SOCIAL: ['SOCIAL'], GOOGLE_MARKETING: ['MARKETING', 'SEARCH'],
    ANALYTICS: ['ANALYTICS', 'MEASUREMENT'], TRACKING: ['MEASUREMENT'], COMMUNICATIE: ['COMMUNICATION'],
    AGENDA: ['CALENDAR', 'COMMUNICATION'], WEBSITE_CMS: ['WEBSITE'], AUTOMATION: ['AUTOMATION'],
    BOEKHOUDING: ['FINANCE'], BOEKHOUDING_ERP: ['FINANCE'], PAYMENTS: ['FINANCE', 'PAYMENTS'],
    DOCUMENTEN: ['KNOWLEDGE', 'DOCUMENTS'], OBJECT_STORAGE: ['DATA_PLATFORM'], INTEGRATIE: ['INTEGRATION']
  };
  return map[value] || [value];
}

function providerId(connectorId) {
  if (/^(meta|facebook|instagram)/.test(connectorId)) return 'meta';
  if (/^(google|ga4|search_console|youtube)/.test(connectorId)) return 'google';
  if (/^(openai|voice)/.test(connectorId)) return 'openai';
  return connectorId === 'ecb_fx' ? 'ecb' : connectorId;
}

function normalizeAuth(contract = {}, profile = {}) {
  return String(profile.auth_strategy || contract.auth || 'configurable').toUpperCase();
}

function normalizeState(connectorId, row = {}, contract = {}, recordCount = 0) {
  const partner = PARTNER_ACCESS.has(connectorId) || contract.access_state === 'AWAITING_ACCESS' || /PARTNER|AUTHORIZED_FEED/.test(String(contract.auth || '').toUpperCase());
  const publicAuth = /PUBLIC/.test(String(row.auth || contract.auth || '').toUpperCase());
  const configured = publicAuth || Boolean(row.configured);
  const authenticated = publicAuth || Boolean(row.connected || row.authenticated || row.token_stored || row.auth_state === 'CONNECTED');
  const probePass = Boolean(row.connected && (row.probe_ok !== false));
  const hasBootstrap = publicAuth || ['openai', 'voice', 'openai_realtime'].includes(connectorId) || recordCount > 0 || Boolean(row.initial_sync_ok);
  if (probePass && authenticated && hasBootstrap) return 'CONNECTED';
  if (row.error && configured) return probePass ? 'DEGRADED' : 'ERROR';
  if (authenticated) return 'AUTHENTICATED';
  if (configured) return 'CONFIGURED';
  if (partner) return 'AWAITING_ACCESS';
  return 'UNCONFIGURED';
}

function safeErrorCode(row = {}) {
  if (!row.error) return null;
  if (typeof row.error === 'object' && row.error.code) return String(row.error.code).slice(0, 120);
  const raw = String(row.error).toUpperCase();
  if (/HTTP\s+\d{3}/.test(raw)) return raw.match(/HTTP\s+\d{3}/)[0].replace(/\s+/g, '_');
  if (/TIMEOUT|ABORT/.test(raw)) return 'PROVIDER_TIMEOUT';
  if (/CREDENTIAL|AUTH|401|403/.test(raw)) return 'PROVIDER_AUTH_FAILED';
  if (/ENDPOINT|BASE URL/.test(raw)) return 'PROVIDER_ENDPOINT_MISSING';
  return 'PROVIDER_PROBE_FAILED';
}

function credentialContract(contract = {}, profile = {}, variablePresent = () => false) {
  const fields = values((profile.credential_fields || []).map(field => field && field.key)).map(key => {
    const field = (profile.credential_fields || []).find(candidate => candidate && candidate.key === key) || {};
    return { key, label: String(field.label || key), secret: Boolean(field.secret), required: field.required !== false, value_exposed: false };
  });
  const environmentVariables = values(contract.env);
  return {
    fields,
    environment_variables: environmentVariables,
    environment_variable_status: environmentVariables.map(name => {
      let present = false;
      try { present = Boolean(variablePresent(name)); } catch {}
      return { name, present, runtime_visible: present, value_exposed: false };
    }),
    accepts_tenant_encrypted_configuration: (profile.capabilities || contract.capabilities || []).includes('tenant_credentials'),
    secret_values_exposed: false
  };
}

function callbackContract(connectorId, authType) {
  if (!/OAUTH|WIX_APP_INSTALL/.test(authType)) return { required: false, route: null, derives_from_public_base_url: false };
  const route = connectorId === 'google' || ['google_ads', 'ga4', 'search_console', 'google_calendar'].includes(connectorId)
    ? '/api/google/oauth/callback'
    : connectorId === 'wix' ? '/api/connect/wix/callback'
      : ['meta', 'facebook', 'instagram', 'facebook_pages'].includes(connectorId) ? '/api/connect/meta/callback'
        : ['linkedin', 'tiktok'].includes(connectorId) ? `/api/connect/${connectorId}/callback`
          : `/api/connector-runtime/oauth/${connectorId}/callback`;
  return { required: true, route, derives_from_public_base_url: true };
}

function buildConnectorRegistry({ registry, profiles = {}, statuses = [], recordsBySource = {}, redact = value => value, variablePresent = () => false }) {
  const byId = new Map(statuses.map(row => [row.id || row.provider, row]));
  return Object.entries(registry).map(([connectorId, contract]) => {
    const profile = profiles[connectorId] || {}, row = byId.get(connectorId) || {}, authType = normalizeAuth(contract, profile);
    const recordCount = Number(recordsBySource[connectorId] || 0), state = normalizeState(connectorId, row, contract, recordCount);
    const capabilities = values([...(contract.capabilities || []), ...(profile.capabilities || [])]);
    const categories = values(SOURCE_OVERRIDES[connectorId]?.categories || inferredCategories(contract.categorie || profile.categorie));
    const industries = values(SOURCE_OVERRIDES[connectorId]?.industries || (categories.some(category => category.startsWith('AUTOMOTIVE')) ? ['AUTOMOTIVE'] : ['ALL']));
    const probeState = row.connected ? 'PASS' : row.error && row.configured ? 'FAIL' : 'NOT_RUN';
    const syncState = recordCount > 0 || row.initial_sync_ok ? 'PASS' : 'NOT_RUN';
    const errorCode = safeErrorCode(row);
    return {
      connector_id: connectorId,
      provider: providerId(connectorId),
      name: contract.naam || profile.naam || connectorId,
      category: categories,
      industries,
      tenant_scope: 'CURRENT_TENANT_AND_DEALER',
      capabilities,
      auth_type: authType,
      credential_contract: credentialContract(contract, profile, variablePresent),
      callback_contract: callbackContract(connectorId, authType),
      configuration_state: row.configured || /PUBLIC/.test(authType) ? 'CONFIGURED' : 'UNCONFIGURED',
      authentication_state: /PUBLIC/.test(authType) ? 'AUTHENTICATED_PUBLIC' : row.connected || row.authenticated || row.token_stored ? 'AUTHENTICATED' : row.configured ? 'NOT_VERIFIED' : 'NOT_CONFIGURED',
      probe_state: probeState,
      sync_state: syncState,
      connection_state: state,
      last_probe: probeState === 'NOT_RUN' ? null : row.last_probe_at || row.last_attempt_at || null,
      last_sync: row.last_sync_at || null,
      latency: Number.isFinite(Number(row.latency_ms)) ? Number(row.latency_ms) : null,
      freshness: recordCount > 0 ? 'AVAILABLE' : state === 'CONNECTED' && /PUBLIC/.test(authType) ? 'LIVE_REFERENCE' : 'UNKNOWN',
      records: recordCount,
      safe_error: errorCode ? redact(errorCode) : null,
      tenant_permissions: ['connectors:manage'],
      required_scopes: values(profile.oauth?.scope || profile.required_scopes),
      requires_partner_approval: PARTNER_ACCESS.has(connectorId) || contract.access_state === 'AWAITING_ACCESS',
      setup_action: state === 'CONNECTED' ? 'INSPECT' : /OAUTH|WIX_APP_INSTALL/.test(authType) ? 'AUTHORIZE' : /PUBLIC/.test(authType) ? 'TEST_CONNECTION' : 'CONFIGURE_SECURELY',
      documentation_reference: `FOUNDLY_CONNECTOR_CONTRACT:${connectorId}`,
      available: true,
      runtime_activatable: true,
      secret_values_exposed: false
    };
  }).sort((a, b) => a.name.localeCompare(b.name, 'en'));
}

function supportFlags(capabilities, categories) {
  const all = new Set([...tokens(capabilities), ...tokens(categories)]);
  const has = (...needles) => needles.some(needle => [...all].some(value => value.includes(needle)));
  return {
    supports_read: true,
    supports_write: has('send', 'write', 'activation', 'conversion', 'events_write'),
    supports_search: has('search', 'listings', 'knowledge', 'marketplace'),
    supports_realtime: has('realtime', 'voice'),
    supports_webhook: has('webhook'),
    supports_images: has('images', 'listings'),
    supports_vehicle_truth: has('vehicle_truth', 'vehicle_data'),
    supports_listings: has('listings', 'marketplace'),
    supports_valuation: has('valuation'),
    supports_fx: has('fx'),
    supports_reasoning: has('reasoning', 'ai_intelligence'),
    supports_measurement: has('measurement'),
    supports_communication: has('communication', 'messaging', 'email', 'voice', 'calendar')
  };
}

function buildSourceRegistry({ connectors = [], recordsBySource = {}, internalCounts = {} }) {
  const sources = connectors.map(connector => {
    const override = SOURCE_OVERRIDES[connector.connector_id] || {}, sourceId = override.source_id || connector.connector_id;
    const categories = values(override.categories || connector.category), capabilities = values(override.capabilities || connector.capabilities);
    const authType = connector.auth_type, flags = supportFlags(capabilities, categories), recordsAvailable = Number(recordsBySource[sourceId] || recordsBySource[connector.connector_id] || connector.records || 0);
    return {
      source_id: sourceId,
      provider_id: override.provider_id || connector.provider,
      connector_id: connector.connector_id,
      display_name: override.display_name || connector.name,
      description: override.description || `${connector.name} data source through the canonical Foundly connector runtime.`,
      categories,
      capabilities,
      industries: values(override.industries || (categories.some(category => category.startsWith('AUTOMOTIVE')) ? ['AUTOMOTIVE'] : ['ALL'])),
      regions: values(override.regions || ['CONFIGURATION_DEPENDENT']),
      source_type: values(override.source_type || ['EXTERNAL_API']),
      data_type: values(override.data_type || categories),
      runtime_role: values(override.runtime_role || ['INGESTION']),
      ...flags,
      requires_credentials: !/PUBLIC/.test(authType),
      requires_oauth: /OAUTH|WIX_APP_INSTALL/.test(authType),
      requires_partner_access: connector.requires_partner_approval,
      configured: connector.configuration_state === 'CONFIGURED',
      authenticated: /^AUTHENTICATED/.test(connector.authentication_state),
      probe_status: connector.probe_state,
      sync_status: connector.sync_state,
      connection_status: connector.connection_state,
      freshness_status: connector.freshness,
      last_probe_at: connector.last_probe,
      last_probe_latency_ms: connector.latency,
      last_sync_at: connector.last_sync,
      last_success_at: connector.probe_state === 'PASS' ? connector.last_probe : null,
      last_failure_at: connector.probe_state === 'FAIL' ? connector.last_probe : null,
      safe_error_code: connector.safe_error,
      records_available: recordsAvailable,
      tenant_scope: 'CURRENT_TENANT_AND_DEALER',
      permission_scope: ['tenant:read'],
      provenance_supported: true,
      retention_policy: 'SOURCE_AND_TENANT_POLICY',
      configuration_source: connector.credential_contract.accepts_tenant_encrypted_configuration ? 'RAILWAY_OR_TENANT_ENCRYPTED_RUNTIME' : 'RAILWAY_RUNTIME',
      runtime_enabled: true
    };
  });
  const deduplicated = new Map();
  for (const source of sources) {
    const existing = deduplicated.get(source.source_id);
    if (!existing || (existing.connection_status !== 'CONNECTED' && source.connection_status === 'CONNECTED')) deduplicated.set(source.source_id, source);
  }
  for (const internal of [...INTERNAL_SOURCES, ...DOMAIN_INTERNAL_SOURCES]) {
    deduplicated.set(internal.source_id, { ...internal, records_available: Number(internalCounts[internal.source_id] || 0), freshness_status: Number(internalCounts[internal.source_id] || 0) > 0 ? 'AVAILABLE' : internal.freshness_status });
  }
  return [...deduplicated.values()].sort((a, b) => a.display_name.localeCompare(b.display_name, 'en'));
}

function filterRegistry(rows, query = {}) {
  const category = String(query.category || '').toUpperCase(), capability = String(query.capability || '').toLowerCase(), status = String(query.status || '').toUpperCase(), provider = String(query.provider || '').toLowerCase(), q = String(query.q || '').toLowerCase();
  return rows.filter(row => {
    const categories = row.categories || row.category || [], capabilities = row.capabilities || [];
    if (category && !categories.some(value => String(value).toUpperCase() === category)) return false;
    if (capability && !capabilities.some(value => String(value).toLowerCase() === capability)) return false;
    if (status && String(row.connection_status || row.connection_state).toUpperCase() !== status) return false;
    if (provider && String(row.provider_id || row.provider).toLowerCase() !== provider) return false;
    if (q && !JSON.stringify([row.source_id, row.connector_id, row.display_name, row.name, categories, capabilities]).toLowerCase().includes(q)) return false;
    return true;
  });
}

function validateSourceSchema(source) {
  return SOURCE_SCHEMA_FIELDS.every(field => Object.prototype.hasOwnProperty.call(source, field));
}

module.exports = {
  CONNECTOR_LIFECYCLE,
  SOURCE_SCHEMA_FIELDS,
  REQUIRED_CONNECTOR_ADDITIONS,
  PARTNER_ACCESS,
  SOURCE_OVERRIDES,
  augmentConnectorRegistry,
  buildConnectorRegistry,
  buildSourceRegistry,
  filterRegistry,
  validateSourceSchema
};
