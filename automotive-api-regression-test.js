'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 21600 + Math.floor(Math.random() * 150);
const base = `http://127.0.0.1:${PORT}`;
const dataDir = fs.mkdtempSync('/tmp/foundly-automotive-api-');
const failureFile = path.join(dataDir, 'controlled-provider-outage');
const password = 'foundly-automotive-api-password-2026';
const auth = `Basic ${Buffer.from(`foundly:${password}`).toString('base64')}`;
const preload = path.join(__dirname, 'test-automotive-fetch-mock.js');
const serverEnv = {
  ...process.env,
  NODE_ENV: 'production',
  NODE_OPTIONS: `--require=${preload}`,
  PORT: String(PORT),
  FOUNDLY_DATA_DIR: dataDir,
  FOUNDLY_PUBLIC_BASE_URL: 'https://foundly.example.test',
  FOUNDLY_ADMIN_USERNAME: 'foundly',
  FOUNDLY_ADMIN_PASSWORD: password,
  FOUNDLY_ENCRYPTION_KEY: 'foundly-automotive-regression-encryption-key-2026',
  FOUNDLY_TENANT_ID: 'house-of-cars-integration',
  FOUNDLY_DEALER_ID: 'house-of-cars-dealer',
  FOUNDLY_PLATFORM_ROLES: 'ADMIN',
  FOUNDLY_CRM_ROLES: 'ADMIN',
  FOUNDLY_WORKER_INTERVAL_MS: '99999999',
  MOBILE_DE_USERNAME: 'integration-fixture-user',
  MOBILE_DE_PASSWORD: 'integration-fixture-password',
  MARKTPLAATS_CLIENT_ID: 'integration-fixture-client',
  MARKTPLAATS_ACCESS_TOKEN: 'integration-fixture-access-token',
  AUTOMOTIVE_TEST_FAIL_FILE: failureFile,
  OPENAI_API_KEY: '',
  FOUNDLY_AI_API_KEY: ''
};

let child = null, logs = '';
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

function post(route, payload, headers = {}) {
  return call(route, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(payload) });
}

function turn(conversationId, turnId, message) {
  return post('/api/zero/turn', { conversation_id: conversationId, turn_id: turnId, message });
}

(async () => {
  try {
    await start();

    const workspaceHtml = fs.readFileSync(path.join(__dirname, 'automotive.html'), 'utf8');
    const workspaceJs = fs.readFileSync(path.join(__dirname, 'automotive-script.js'), 'utf8');
    const workspaceCss = fs.readFileSync(path.join(__dirname, 'automotive.css'), 'utf8');
    for (const token of ['Foundly Automotive Intelligence', 'House of Cars', 'Development Partner Preview', 'Zoekresultaten', 'Vandaag inkopen', 'Why buy', 'Market', 'Economics', 'Comparables', 'Risks', 'Source & provenance', '/automotive-script.js', '/automotive.css']) assert(workspaceHtml.includes(token), `Automotive workspace mist ${token}`);
    for (const token of ['/api/automotive/status', '/api/automotive/search', '/api/automotive/opportunities/today', '/api/automotive/vehicles/', '/api/zero/turn', 'escapeHtml', 'provider_executions', 'freshness']) assert(workspaceJs.includes(token), `Automotive client mist ${token}`);
    for (const token of [':root', '.provider-grid', '.vehicle-grid', '.detail-panel', '.zero-dock', '@media (max-width: 680px)', '@media (prefers-reduced-motion: reduce)']) assert(workspaceCss.includes(token), `Automotive styling mist ${token}`);
    assert(!/style\s*=/.test(workspaceHtml + workspaceJs), 'Automotive workspace mag geen inline styles gebruiken');
    assert(!/\bprompt\s*\(/.test(workspaceJs), 'Automotive workspace mag geen native prompt-dialog gebruiken');
    assert(!/Demo Revenue|Fake KPI|Example Customer/i.test(workspaceHtml + workspaceJs + workspaceCss), 'Automotive workspace mag geen fictieve bedrijfsdata bevatten');

    let workspace = await call('/automotive', {}, false);
    assert.equal(workspace.response.status, 401);
    for (const route of ['/automotive', '/automotive-script.js', '/automotive.css']) {
      workspace = await call(route);
      assert.equal(workspace.response.status, 200, `${route} niet bereikbaar`);
      assert.match(workspace.response.headers.get('content-security-policy'), /script-src 'self'/);
      assert.equal(workspace.response.headers.get('x-frame-options'), 'DENY');
    }

    let result = await call('/api/automotive/status', {}, false);
    assert.equal(result.response.status, 401);
    assert(result.response.headers.get('www-authenticate'));

    result = await call('/api/automotive/status');
    assert.equal(result.response.status, 200);
    assert.equal(result.body.capability_pack, 'AUTOMOTIVE');
    assert.equal(result.body.contracts.real_data_only, true);
    assert.equal(result.body.persistence.separate_database, false);
    assert.equal(result.body.providers.find(row => row.provider === 'rdw').authenticated, true);
    assert.equal(result.body.providers.find(row => row.provider === 'mobile_de').authenticated, true);
    assert.equal(result.body.providers.find(row => row.provider === 'marktplaats').authenticated, true);
    assert.equal(result.body.providers.find(row => row.provider === 'autoscout24').adapter_available, false);
    assert(!result.text.includes(serverEnv.MOBILE_DE_PASSWORD));
    assert(!result.text.includes(serverEnv.MARKTPLAATS_ACCESS_TOKEN));

    result = await post('/api/automotive/dealer-profile', {
      display_name: 'House of Cars — Development Partner Preview',
      pilot_configuration: true,
      preferences: {
        preferred_makes: ['BMW', 'Porsche', 'Mercedes-Benz', 'Audi', 'Land Rover'],
        purchase_price_min_eur: 30000,
        purchase_price_max_eur: 80000,
        mileage_max_km: 90000,
        year_min: 2020,
        powertrains: ['PLUGIN_HYBRID'],
        preferred_options: ['Panoramadak'],
        sourcing_countries: ['DE', 'NL'],
        target_margin_eur: 10000,
        risk_tolerance: 'MEDIUM'
      },
      cost_assumptions: { transport_eur: 1200, registration_eur: 350, inspection_eur: 150, handling_eur: 500, other_eur: 0, source: 'Explicit integration-test fixture assumption' },
      history: { available: false }
    });
    assert.equal(result.response.status, 200);
    assert.equal(result.body.profile.configuration_status, 'CONFIGURED');
    assert.equal(result.body.profile.history.available, false);

    const query = 'Zero, zoek een BMW X5 45e M Sport vanaf 2022, maximaal 70.000 kilometer en €50.000 inkoop.';
    result = await post('/api/automotive/search', { query }, { 'x-correlation-id': 'automotive-correlation-0001' });
    assert.equal(result.response.status, 200);
    assert.equal(result.body.status, 'completed');
    assert.equal(result.body.correlation_id, 'automotive-correlation-0001');
    assert.deepEqual({ make: result.body.criteria.make, model: result.body.criteria.model, variant: result.body.criteria.variant, trim: result.body.criteria.trim }, { make: 'BMW', model: 'X5', variant: '45e', trim: 'M Sport' });
    assert.equal(result.body.criteria.purchase_price_max_eur, 50000);
    assert.equal(result.body.results.length, 3);
    assert.equal(result.body.vehicle_truth.length, 1);
    assert(result.body.provider_executions.every(row => row.state === 'LIVE'));
    assert(result.body.results.every(row => row.provenance.provider_verified && row.identity.source_url));
    assert.equal(result.body.real_data_only, true);
    assert.equal(result.body.synthetic_records, 0);
    assert(!result.text.includes(serverEnv.MOBILE_DE_PASSWORD));
    assert(!result.text.includes(serverEnv.MARKTPLAATS_ACCESS_TOKEN));
    const searchId = result.body.search_id, candidateId = result.body.results[0].canonical_listing_id;

    result = await call(`/api/automotive/searches/${searchId}`);
    assert.equal(result.response.status, 200);
    assert.equal(result.body.search.results.length, 3);
    result = await call(`/api/automotive/vehicles/${candidateId}`);
    assert.equal(result.response.status, 200);
    assert.equal(result.body.vehicle.listings.length, 1);
    result = await call(`/api/automotive/images/${candidateId}/0`);
    assert.equal(result.response.status, 200);
    assert.equal(result.response.headers.get('content-type'), 'image/png');
    assert.equal(result.response.headers.get('x-content-type-options'), 'nosniff');
    result = await call(`/api/automotive/vehicles/${candidateId}/comparables`);
    assert.equal(result.response.status, 200);
    assert(result.body.comparable_count >= 7);
    assert(result.body.listings.every(row => row.source_url && row.evidence.length));
    result = await post(`/api/automotive/vehicles/${candidateId}/economics`, { transport_eur: 1200, registration_eur: 350, inspection_eur: 150, handling_eur: 500, other_eur: 0 });
    assert.equal(result.body.status, 'estimated');
    assert(result.body.expected_gross_margin_range.expected_eur > 0);
    assert(result.body.breakdown.some(item => item.type === 'FACT'));
    assert(result.body.breakdown.some(item => item.type === 'ESTIMATE'));
    result = await call(`/api/automotive/vehicles/${candidateId}/analysis`);
    assert.equal(result.body.analysis.buy_score.available, true);
    assert.equal(result.body.analysis.buy_score.opaque_model, false);
    assert(result.body.analysis.buy_score.components.every(component => component.evidence && component.provenance));

    const conversationId = 'automotive-conversation-0001';
    result = await turn(conversationId, 'automotive-turn-0001', query);
    assert.equal(result.response.status, 200);
    assert.equal(result.body.automotive_data.operation, 'search');
    assert.equal(result.body.automotive_data.context.criteria.make, 'BMW');
    assert.equal(result.body.automotive_data.context.ranked.length, 3);
    assert(result.body.plan.tools.includes('automotive_search'));
    assert(result.body.ui_commands.some(command => command.type === 'SHOW_VEHICLE'));
    result = await turn(conversationId, 'automotive-turn-0002', 'Welke drie zou jij inkopen?');
    assert.equal(result.body.automotive_data.operation, 'rank');
    assert.equal(result.body.verification.previous_context_used, true);
    assert.match(result.body.answer, /1\./);
    result = await turn(conversationId, 'automotive-turn-0003', 'Waarom nummer één?');
    assert.equal(result.body.automotive_data.operation, 'explain');
    assert.equal(result.body.verification.opaque_score, false);
    result = await turn(conversationId, 'automotive-turn-0004', 'Vergelijk hem met Nederland.');
    assert.equal(result.body.automotive_data.operation, 'comparables');
    assert(result.body.automotive_data.comparables.comparable_count >= 7);
    result = await turn(conversationId, 'automotive-turn-0005', "Wat zijn de risico's?");
    assert.equal(result.body.automotive_data.operation, 'risks');
    result = await turn(conversationId, 'automotive-turn-0006', 'Wat hou ik ongeveer over?');
    assert.equal(result.body.automotive_data.operation, 'economics');
    assert.equal(result.body.status, 'completed');
    result = await turn(conversationId, 'automotive-turn-0007', 'Laat de aanbieder zien.');
    assert.equal(result.body.automotive_data.operation, 'seller');
    assert.equal(result.body.verification.secret_exposure, false);
    result = await turn(conversationId, 'automotive-turn-0008', 'En als ik maximaal €55.000 wil uitgeven?');
    assert.equal(result.body.automotive_data.operation, 'search_update');
    assert.equal(result.body.automotive_data.context.criteria.make, 'BMW');
    assert.equal(result.body.automotive_data.context.criteria.purchase_price_max_eur, 55000);

    result = await turn('automotive-flagship-0001', 'automotive-flagship-turn-0001', 'Zero, wat moet House of Cars vandaag inkopen?');
    assert.equal(result.response.status, 200);
    assert.equal(result.body.automotive_data.operation, 'today');
    assert(result.body.automotive_data.context.ranked.length > 0 && result.body.automotive_data.context.ranked.length <= 3);
    assert.equal(result.body.verification.real_marketplace_records_only, true);

    fs.writeFileSync(failureFile, 'controlled test outage');
    result = await post('/api/automotive/search', { query });
    assert.equal(result.response.status, 200);
    assert.equal(result.body.status, 'partial');
    assert.equal(result.body.provider_executions.find(row => row.provider === 'rdw').state, 'LIVE');
    assert.equal(result.body.provider_executions.find(row => row.provider === 'mobile_de').state, 'CACHED');
    assert.equal(result.body.provider_executions.find(row => row.provider === 'marktplaats').state, 'UNAVAILABLE');
    assert.equal(result.body.results.length, 3);
    assert(result.body.results.every(row => row.listing.freshness.classification === 'CACHED'));
    fs.unlinkSync(failureFile);

    result = await call('/api/automotive/diagnostics');
    assert.equal(result.body.no_fake_data, true);
    assert(result.body.telemetry.some(row => row.cache === 'HIT'));
    assert(result.body.telemetry.every(row => row.contains_secrets === false));
    assert(!result.text.includes(serverEnv.MOBILE_DE_PASSWORD));
    assert(!result.text.includes(serverEnv.MARKTPLAATS_ACCESS_TOKEN));

    await stop();
    await start();
    result = await call('/api/automotive/status');
    assert(result.body.records.listings >= 10, 'normalized provider records must persist across restart');
    assert.equal(result.body.dealer_profile.configuration_status, 'CONFIGURED');
    result = await call(`/api/automotive/searches/${searchId}`);
    assert.equal(result.response.status, 200);
    assert.equal(result.body.search.criteria.make, 'BMW');

    const stateRaw = fs.readFileSync(path.join(dataDir, 'foundly-core-state.json'), 'utf8');
    assert(!stateRaw.includes(serverEnv.MOBILE_DE_PASSWORD));
    assert(!stateRaw.includes(serverEnv.MARKTPLAATS_ACCESS_TOKEN));
    assert(!stateRaw.includes('Integration Fixture Düsseldorf'), 'encrypted production snapshot must not expose provider payload fields at rest');

    console.log(JSON.stringify({
      ok: true,
      automotive_api: 'pass',
      automotive_workspace: 'pass',
      authenticated_routes: 'pass',
      provider_contracts: 'pass',
      normalization_persistence: 'pass',
      comparables_economics_score: 'pass',
      zero_initial_query: 'pass',
      zero_multi_turn_context: 'pass',
      zero_budget_update: 'pass',
      zero_flagship_query: 'pass',
      provider_outage_cache_fallback: 'pass',
      restart_persistence: 'pass',
      secret_exposure: 'pass',
      fixture_classification: 'SYNTHETIC_AUTOMOTIVE_INTEGRATION_FIXTURE_NOT_PROVIDER_PROOF'
    }, null, 2));
  } catch (error) {
    console.error(logs);
    console.error(error);
    process.exitCode = 1;
  } finally {
    if (fs.existsSync(failureFile)) fs.unlinkSync(failureFile);
    await stop();
  }
})();
