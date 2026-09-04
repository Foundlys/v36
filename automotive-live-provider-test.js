'use strict';

const crypto = require('crypto');
const { FoundlyAutomotiveCore } = require('./automotive-core');

const store = new Map();
const tenant = { tenant_id: 'live-provider-verification', dealer_id: 'live-provider-verification' };
const principal = { id: 'live-provider-verifier', roles: ['ADMIN'] };
const clean = name => String(process.env[name] || '').trim();
const bucket = (ctx, scope) => {
  const key = `${ctx.tenant_id}:${ctx.dealer_id}:${scope}`;
  if (!store.has(key)) store.set(key, []);
  return store.get(key);
};

const core = new FoundlyAutomotiveCore({
  bucket,
  persist: () => {},
  emit: () => {},
  id: () => crypto.randomUUID(),
  now: () => new Date(),
  providerTimeoutMs: 30000,
  fetch,
  providerConfig: provider => {
    if (provider === 'rdw') return { base_url: clean('RDW_BASE_URL') || 'https://opendata.rdw.nl' };
    if (provider === 'mobile_de') return { username: clean('MOBILE_DE_USERNAME'), password: clean('MOBILE_DE_PASSWORD'), base_url: clean('MOBILE_DE_BASE_URL') || 'https://services.mobile.de' };
    if (provider === 'marktplaats') return { client_id: clean('MARKTPLAATS_CLIENT_ID'), access_token: clean('MARKTPLAATS_ACCESS_TOKEN'), base_url: clean('MARKTPLAATS_BASE_URL') || 'https://api.marktplaats.nl' };
    return {};
  }
});

async function verify(provider) {
  const result = await core.search(tenant, principal, {
    query: 'BMW X5 vanaf 2022 maximaal 100.000 kilometer en €80.000 inkoop',
    providers: [provider]
  });
  const execution = result.provider_executions[0];
  return {
    provider,
    configured: core.providerStatuses(tenant, principal).find(row => row.provider === provider)?.configured === true,
    authenticated: core.providerStatuses(tenant, principal).find(row => row.provider === provider)?.authenticated === true,
    probe: execution?.success ? 'PASS' : 'FAIL',
    provider_http_status: execution?.success ? 200 : execution?.error?.provider_http_status || null,
    records_received: execution?.records_received || 0,
    records_normalized: execution?.records_normalized || 0,
    marketplace_records_returned: result.results.length,
    vehicle_truth_records_returned: result.vehicle_truth.length,
    state: execution?.state || 'UNAVAILABLE',
    error_code: execution?.error?.code || null,
    secret_values_reported: false
  };
}

(async () => {
  const results = [];
  results.push(await verify('rdw'));
  if (clean('MOBILE_DE_USERNAME') && clean('MOBILE_DE_PASSWORD')) results.push(await verify('mobile_de'));
  else results.push({ provider: 'mobile_de', configured: false, authenticated: false, probe: 'NOT_RUN', state: 'BLOCKED', blocker: 'MOBILE_DE_USERNAME/MOBILE_DE_PASSWORD missing', secret_values_reported: false });
  if (clean('MARKTPLAATS_ACCESS_TOKEN')) results.push(await verify('marktplaats'));
  else results.push({ provider: 'marktplaats', configured: Boolean(clean('MARKTPLAATS_CLIENT_ID')), authenticated: false, probe: 'NOT_RUN', state: 'BLOCKED', blocker: 'MARKTPLAATS_ACCESS_TOKEN missing', secret_values_reported: false });
  results.push({ provider: 'autoscout24', configured: Boolean(clean('AUTOSCOUT24_API_KEY') || clean('AUTOSCOUT24_ACCESS_TOKEN')), authenticated: false, probe: 'NOT_RUN', state: 'BLOCKED', blocker: 'Official adapter/access not verified for P1', secret_values_reported: false });
  const rdw = results.find(row => row.provider === 'rdw'), marketplacePass = results.some(row => ['mobile_de', 'marktplaats'].includes(row.provider) && row.probe === 'PASS' && row.records_normalized > 0);
  if (rdw.probe !== 'PASS' || rdw.vehicle_truth_records_returned < 1) process.exitCode = 1;
  if (clean('LIVE_AUTOMOTIVE_REQUIRE_MARKETPLACE') === '1' && !marketplacePass) process.exitCode = 2;
  console.log(JSON.stringify({ ok: process.exitCode === undefined, observed_at: new Date().toISOString(), query: { make: 'BMW', model: 'X5', year_min: 2022, mileage_max_km: 100000, purchase_price_max_eur: 80000 }, providers: results, marketplace_acceptance_gate: marketplacePass ? 'PASS' : 'BLOCKED', no_fake_data: true }, null, 2));
})().catch(error => {
  console.error(JSON.stringify({ ok: false, code: error.code || 'live_provider_test_failed', error: String(error.message || error).slice(0, 300), secret_values_reported: false }));
  process.exitCode = 1;
});
