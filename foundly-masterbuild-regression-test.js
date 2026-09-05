'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync, spawn } = require('child_process');
const {
  CONNECTOR_LIFECYCLE, SOURCE_SCHEMA_FIELDS, augmentConnectorRegistry,
  buildConnectorRegistry, buildSourceRegistry, filterRegistry, validateSourceSchema
} = require('./foundly-registry');
const {
  WORKSPACE_DEFINITIONS, dashboardTemplate, normalizeDashboard, navigationFor
} = require('./workspace-system');

const PORT = 21800 + Math.floor(Math.random() * 120);
const base = `http://127.0.0.1:${PORT}`;
const dataDir = fs.mkdtempSync('/tmp/foundly-masterbuild-');
const password = 'masterbuild-authentication-password-2026-secure';
const auth = `Basic ${Buffer.from(`foundly:${password}`).toString('base64')}`;
const preload = path.join(__dirname, 'test-masterbuild-fetch-mock.js');
const providerPrefixes = /^(?:OPENAI|FOUNDLY_AI|META|FACEBOOK|INSTAGRAM|GOOGLE|LINKEDIN|TIKTOK|WIX|MOBILE_DE|MARKTPLAATS|AUTOSCOUT24|VWE|AUTOTELEX|RDC|ECBS?|WHATSAPP|SMTP|DMS)_/;
const isolatedEnv = { ...process.env };
for (const name of Object.keys(isolatedEnv)) if (providerPrefixes.test(name)) delete isolatedEnv[name];
const serverEnv = {
  ...isolatedEnv,
  NODE_ENV: 'production', NODE_OPTIONS: `--require=${preload}`, PORT: String(PORT),
  FOUNDLY_DATA_DIR: dataDir, FOUNDLY_PUBLIC_BASE_URL: 'https://foundly.example.test',
  FOUNDLY_ADMIN_USERNAME: 'foundly', FOUNDLY_ADMIN_PASSWORD: password,
  FOUNDLY_ENCRYPTION_KEY: 'masterbuild-encryption-key-2026-secure-value',
  FOUNDLY_TENANT_ID: 'masterbuild-tenant', FOUNDLY_DEALER_ID: 'masterbuild-dealer',
  FOUNDLY_PLATFORM_USER_ID: 'masterbuild-admin', FOUNDLY_PLATFORM_ROLES: 'ADMIN',
  FOUNDLY_CRM_USER_ID: 'masterbuild-admin', FOUNDLY_CRM_ROLES: 'ADMIN',
  FOUNDLY_WORKER_INTERVAL_MS: '99999999', FOUNDLY_RATE_LIMIT_PER_MINUTE: '1000',
  FOUNDLY_REQUEST_TIMEOUT_MS: '2500', OPENAI_API_KEY: '', FOUNDLY_AI_API_KEY: ''
};

let child = null;
let logs = '';
const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function start() {
  logs = '';
  child = spawn(process.execPath, ['server.js'], { cwd: __dirname, env: serverEnv, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', chunk => { logs += chunk; });
  child.stderr.on('data', chunk => { logs += chunk; });
  for (let attempt = 0; attempt < 100; attempt++) {
    try { if ((await fetch(`${base}/api/health`)).ok) return; } catch {}
    await wait(75);
  }
  throw new Error(`server start timeout\n${logs}`);
}

async function stop() {
  if (!child) return;
  child.kill('SIGTERM');
  for (let attempt = 0; attempt < 60 && child.exitCode === null; attempt++) await wait(40);
  child = null;
}

async function call(route, options = {}, authenticated = true) {
  const headers = { ...(authenticated ? { authorization: auth } : {}), ...(options.headers || {}) };
  const response = await fetch(base + route, { redirect: 'manual', ...options, headers });
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { response, body, text };
}

function put(route, payload, headers = {}) {
  return call(route, { method: 'PUT', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(payload) });
}

function unitContracts() {
  assert.equal(SOURCE_SCHEMA_FIELDS.length, 47);
  assert.deepEqual(CONNECTOR_LIFECYCLE, ['UNCONFIGURED', 'AWAITING_ACCESS', 'CONFIGURED', 'AUTHORIZING', 'AUTHENTICATED', 'PROBING', 'SYNCING', 'CONNECTED', 'DEGRADED', 'ERROR', 'EXPIRED', 'DISCONNECTED']);

  const registry = {
    openai: { naam: 'OpenAI', categorie: 'ai_search', auth: 'api_key', env: ['OPENAI_API_KEY'], modules: ['data'], capabilities: ['reasoning'] },
    mobile_de: { naam: 'mobile.de', categorie: 'automotive_marktplaats', auth: 'oauth_or_partner', env: ['MOBILE_DE_CLIENT_ID', 'MOBILE_DE_CLIENT_SECRET'], modules: ['inkoop'], capabilities: ['search'] },
    rdw: { naam: 'RDW', categorie: 'voertuigdata', auth: 'public', env: [], modules: ['data', 'inkoop'], capabilities: ['vehicle_truth'] }
  };
  augmentConnectorRegistry(registry);
  for (const id of ['autotelex', 'rdc', 'google', 'facebook', 'openai_realtime', 'google_measurement_protocol', 'google_enhanced_conversions']) assert(registry[id], `connector slot ontbreekt: ${id}`);
  const connectors = buildConnectorRegistry({
    registry,
    variablePresent: name => name === 'OPENAI_API_KEY',
    statuses: [
      { id: 'openai', configured: true, connected: false, error: null },
      { id: 'mobile_de', configured: false, connected: false, error: null },
      { id: 'rdw', configured: true, connected: true, probe_ok: true, last_probe_at: '2026-09-05T00:00:00.000Z' }
    ]
  });
  assert.equal(connectors.find(row => row.connector_id === 'openai').connection_state, 'CONFIGURED', 'configured is not connected');
  assert.equal(connectors.find(row => row.connector_id === 'mobile_de').connection_state, 'AWAITING_ACCESS');
  assert.equal(connectors.find(row => row.connector_id === 'rdw').connection_state, 'CONNECTED');
  assert(connectors.every(row => row.available && row.secret_values_exposed === false));
  assert.deepEqual(connectors.find(row => row.connector_id === 'openai').credential_contract.environment_variable_status, [{ name: 'OPENAI_API_KEY', present: true, runtime_visible: true, value_exposed: false }]);
  const sources = buildSourceRegistry({ connectors });
  assert(sources.every(validateSourceSchema));
  const openai = sources.find(row => row.source_id === 'openai');
  assert(openai && openai.categories.length > 1 && openai.supports_reasoning);
  assert(filterRegistry(sources, { category: 'AI_INTELLIGENCE' }).some(row => row.source_id === 'openai'));
  assert(filterRegistry(sources, { capability: 'vehicle_truth' }).some(row => row.source_id === 'rdw'));

  const expectedRoutes = ['/', '/automotive', '/crm', '/analysis', '/finance', '/data', '/knowledge', '/learning', '/automation', '/connectors', '/communication', '/marketing', '/settings'];
  assert.deepEqual(Object.values(WORKSPACE_DEFINITIONS).map(row => row.route), expectedRoutes);
  assert.equal(navigationFor({ roles: ['ADMIN'] }).length, 13);
  assert.deepEqual(navigationFor({ roles: ['USER'] }, ['crm']).map(row => row.id), ['home', 'crm']);
  for (const workspaceId of Object.keys(WORKSPACE_DEFINITIONS)) {
    const dashboard = dashboardTemplate(workspaceId, 'test-user');
    assert(dashboard.no_fake_data && dashboard.widgets.length > 0);
    assert.equal(dashboard.workspace_id, workspaceId);
  }
  assert.throws(() => normalizeDashboard('crm', { widgets: [{ metric: 'invented_revenue' }] }), error => error.code === 'dashboard_widget_invalid');
}

function staticContracts() {
  const requiredShellFiles = ['index.html', 'automotive.html', 'crm.html', 'analysis.html', 'finance.html'];
  for (const file of requiredShellFiles) {
    const content = fs.readFileSync(path.join(__dirname, file), 'utf8');
    assert(content.includes('/foundly-shell.css') && content.includes('/foundly-shell.js'), `${file} mist de gedeelde navigatieshell`);
  }
  const workspaceHtml = fs.readFileSync(path.join(__dirname, 'foundly-workspace.html'), 'utf8');
  const workspaceCss = fs.readFileSync(path.join(__dirname, 'foundly-workspace.css'), 'utf8');
  const workspaceJs = fs.readFileSync(path.join(__dirname, 'foundly-workspace.js'), 'utf8');
  for (const token of ['WorkspaceSidebar', 'GlobalSearch', 'WorkspaceHeader', 'WorkspaceTabs', 'KPIGrid', 'ChartPanel', 'DataGrid', 'SourceBadge', 'ConnectionBadge', 'EmptyState', 'ZEROCommandDock']) assert((workspaceHtml + workspaceCss).includes(token), `design primitive ontbreekt: ${token}`);
  for (const token of ['connectorIndustry', 'connectorTenant', 'sourceRegistryGrid', 'sourceRegistryCategory', 'metricDialog']) assert(workspaceHtml.includes(token), `operationele workspace-control ontbreekt: ${token}`);
  for (const token of ['/api/source-registry', '/api/connector-registry', '/api/workspaces/', '/api/zero/turn', '/api/provisioner/resolve']) assert(workspaceJs.includes(token), `workspace-integratie ontbreekt: ${token}`);
  assert(!/\b(?:Demo Revenue|Fake KPI|Example Customer)\b/i.test(workspaceHtml + workspaceCss + workspaceJs));
  assert(workspaceCss.includes('#020407') || workspaceCss.includes('#030609'), 'achtergrond moet deep-space near-black blijven');

  const automotiveHtml = fs.readFileSync(path.join(__dirname, 'automotive.html'), 'utf8');
  const automotiveJs = fs.readFileSync(path.join(__dirname, 'automotive-script.js'), 'utf8');
  for (const section of WORKSPACE_DEFINITIONS.automotive.sections) assert(automotiveHtml.toUpperCase().includes(section), `Automotive-sectie ontbreekt: ${section}`);
  for (const provider of ['rdw', 'mobile_de', 'marktplaats', 'autoscout24', 'vwe', 'autotelex', 'rdc', 'ecb_fx', 'openai']) assert(automotiveJs.includes(provider), `Automotive-bron ontbreekt: ${provider}`);
  const neuralClient = fs.readFileSync(path.join(__dirname, 'index-script.js'), 'utf8');
  for (const token of ['AUTOMOTIVE SOURCE REGISTRY', 'ACTIVE SOURCES', 'MARKETPLACE SOURCES', 'VEHICLE / VALUATION SOURCES', 'INTERNAL SOURCES', 'OPEN AUTOMOTIVE WORKSPACE']) assert(neuralClient.includes(token), `Inkoop-bronweergave mist ${token}`);
  const acceptedRenderer = execFileSync('git', ['show', 'HEAD:neural-runtime.js'], { cwd: __dirname });
  assert(Buffer.from(fs.readFileSync(path.join(__dirname, 'neural-runtime.js'))).equals(acceptedRenderer), 'geaccepteerde Neural-renderer mag niet wijzigen');
}

async function runtimeContracts() {
  await start();
  let result = await call('/data', {}, false);
  assert.equal(result.response.status, 401);
  assert(result.response.headers.get('www-authenticate'));

  const allRoutes = ['/', '/automotive', '/crm', '/analysis', '/finance', '/data', '/knowledge', '/learning', '/automation', '/connectors', '/communication', '/marketing', '/settings'];
  for (const route of allRoutes) {
    result = await call(route);
    assert.equal(result.response.status, 200, `${route} niet bereikbaar`);
    assert.match(result.response.headers.get('content-security-policy') || '', /script-src 'self'/);
    assert.equal(result.response.headers.get('x-frame-options'), 'DENY');
    assert(result.text.length > 1000, `${route} leverde een onbruikbaar leeg document`);
  }
  for (const route of ['/foundly-workspace.js', '/foundly-workspace.css', '/foundly-shell.js', '/foundly-shell.css']) {
    result = await call(route); assert.equal(result.response.status, 200, `${route} niet bereikbaar`);
  }

  result = await call('/api/workspaces');
  assert.equal(result.response.status, 200);
  assert.equal(result.body.total, 13);
  assert.equal(result.body.capability_aware, true);
  assert.equal(result.body.tenant.tenant_id, serverEnv.FOUNDLY_TENANT_ID);
  result = await call('/api/workspaces', { headers: { 'x-foundly-tenant-id': 'spoofed-tenant', 'x-foundly-dealer-id': 'spoofed-dealer' } });
  assert.equal(result.body.tenant.tenant_id, serverEnv.FOUNDLY_TENANT_ID, 'clientheaders mogen tenantcontext niet overschrijven');

  result = await call('/api/connector-registry');
  assert.equal(result.response.status, 200);
  assert.equal(result.body.all_total, 100);
  assert.equal(result.body.secret_values_exposed, false);
  const connectors = result.body.connectors;
  for (const id of ['rdw', 'mobile_de', 'marktplaats', 'autoscout24', 'vwe', 'autotelex', 'rdc', 'ecb_fx', 'openai', 'openai_realtime', 'meta', 'facebook', 'instagram', 'google', 'google_ads', 'ga4', 'linkedin', 'tiktok', 'wix']) assert(connectors.some(row => row.connector_id === id), `connector ontbreekt: ${id}`);
  for (const id of ['mobile_de', 'marktplaats', 'autoscout24', 'vwe', 'autotelex', 'rdc']) {
    const connector = connectors.find(row => row.connector_id === id);
    assert.equal(connector.connection_state, 'AWAITING_ACCESS', `${id} moet zonder credentials AWAITING_ACCESS zijn`);
    assert.equal(connector.records, 0);
  }
  assert.equal(connectors.find(row => row.connector_id === 'rdw').connection_state, 'CONNECTED');
  assert.equal(connectors.find(row => row.connector_id === 'ecb_fx').connection_state, 'CONNECTED');
  assert.equal(connectors.find(row => row.connector_id === 'openai').connection_state, 'UNCONFIGURED');
  assert(connectors.every(row => (row.credential_contract.environment_variable_status || []).every(variable => typeof variable.name === 'string' && typeof variable.runtime_visible === 'boolean' && variable.value_exposed === false && !Object.prototype.hasOwnProperty.call(variable, 'value'))));
  assert(!result.text.includes(password));

  result = await call('/api/source-registry');
  assert.equal(result.response.status, 200);
  assert.equal(result.body.schema_fields.length, 47);
  assert.equal(result.body.all_total, 104);
  assert.equal(result.body.openai_present, true);
  assert(result.body.sources.every(validateSourceSchema));
  assert(!result.text.includes(password));
  const openai = result.body.sources.find(row => row.source_id === 'openai');
  assert(openai.categories.includes('AI_INTELLIGENCE') && openai.supports_reasoning);

  result = await call('/api/source-registry?category=AI_INTELLIGENCE');
  assert(result.body.sources.some(row => row.source_id === 'openai'));
  result = await call('/api/source-registry?capability=valuation');
  assert(result.body.sources.some(row => row.source_id === 'autotelex'));
  result = await call('/api/source-registry?status=AWAITING_ACCESS');
  assert(result.body.sources.some(row => row.source_id === 'mobile_de'));
  result = await call('/api/source-registry?module=automotive');
  for (const id of ['rdw', 'mobile_de', 'marktplaats', 'autoscout24', 'vwe', 'autotelex', 'rdc', 'ecb_fx', 'openai', 'foundly_automotive_history', 'foundly_crm', 'foundly_inventory', 'foundly_knowledge']) assert(result.body.sources.some(row => row.source_id === id), `Automotive-source ontbreekt: ${id}`);

  result = await call('/api/automotive/overview');
  assert.equal(result.response.status, 200);
  assert.equal(result.body.no_fake_data, true);
  assert.equal(result.body.today_opportunities.length, 0);
  assert.equal(result.body.top_buy_scores.length, 0);
  assert.deepEqual(new Set(result.body.provider_health.map(row => row.connector_id)), new Set(['rdw', 'mobile_de', 'marktplaats', 'autoscout24', 'vwe', 'autotelex', 'rdc', 'ecb_fx', 'openai']));

  result = await call('/api/analysis/status');
  assert.equal(result.response.status, 200);
  assert.equal(result.body.product, 'Foundly Analysis');
  assert.equal(result.body.version, '6.0.0');
  assert.equal(result.body.no_fake_data, true);

  for (const workspaceId of Object.keys(WORKSPACE_DEFINITIONS)) {
    result = await call(`/api/workspaces/${workspaceId}/snapshot`);
    assert.equal(result.response.status, 200, `${workspaceId} snapshot faalt`);
    assert.equal(result.body.no_fake_data, true);
    assert.equal(result.body.tenant.tenant_id, serverEnv.FOUNDLY_TENANT_ID);
    assert(Object.keys(result.body.metrics).length > 0, `${workspaceId} heeft geen bruikbaar defaultdashboard`);
  }

  result = await call('/api/workspaces/marketing/dashboard?scope=PERSONAL');
  assert.equal(result.response.status, 200);
  assert.equal(result.body.persisted, false);
  const custom = { ...result.body.dashboard, name: 'Masterbuild marketing dashboard', scope: 'PERSONAL', widgets: result.body.dashboard.widgets.slice(0, 4) };
  result = await put('/api/workspaces/marketing/dashboard?scope=PERSONAL', custom);
  assert.equal(result.response.status, 201);
  assert.equal(result.body.dashboard.widgets.length, 4);
  const revision = result.body.dashboard.revision;
  result = await call('/api/workspaces/marketing/dashboard?scope=PERSONAL');
  assert.equal(result.body.persisted, true);
  assert.equal(result.body.dashboard.name, custom.name);
  result = await put('/api/workspaces/marketing/dashboard?scope=PERSONAL', { ...custom, widgets: [{ metric: 'invented_metric' }] });
  assert.equal(result.response.status, 422);
  result = await put('/api/workspaces/marketing/dashboard?scope=PERSONAL', custom, { 'if-match': String(revision + 100) });
  assert.equal(result.response.status, 409);

  await call('/api/system/persist', { method: 'POST' });
  await stop();
  await start();
  result = await call('/api/workspaces/marketing/dashboard?scope=PERSONAL');
  assert.equal(result.body.persisted, true);
  assert.equal(result.body.dashboard.name, custom.name, 'dashboard moet restart overleven');
  assert.equal(result.body.dashboard.widgets.length, 4);
  assert(!logs.includes(password));
}

(async () => {
  try {
    unitContracts();
    staticContracts();
    await runtimeContracts();
    console.log(JSON.stringify({
      ok: true,
      source_registry: 'pass', connector_registry: 'pass', source_filtering: 'pass', openai_source: 'pass',
      truthful_lifecycle: 'pass', connector_visibility: 'pass', navigation: 'pass', workspace_routes: 13,
      workspace_auth: 'pass', tenant_header_isolation: 'pass', dashboard_defaults: 'pass',
      dashboard_customization: 'pass', dashboard_restart_persistence: 'pass', automotive_sources: 'pass',
      inkoop_source_display: 'pass', neural_renderer_frozen: 'pass', no_secret_leakage: 'pass',
      no_fake_live_data: 'pass', public_provider_transport: 'DETERMINISTIC_TEST_FIXTURE_NOT_LIVE_PROVIDER_PROOF'
    }, null, 2));
  } catch (error) {
    console.error(logs);
    console.error(error);
    process.exitCode = 1;
  } finally {
    await stop();
  }
})();
