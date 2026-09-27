'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto');
const {MarketReferenceCatalog} = require('../market-reference');
const {fixture} = require('../zero-evaluation/fixture');
test('natural context keeps general non-retail revenue separate and selects announced models for a model query', () => {
  const {marketReferenceRows} = require('./market-reference-context');
  let industry = 'GENERAL', allowed = true, calls = 0;
  const composition = {resolve: () => ({industry_id: industry}), assertCapability() { calls++; if (!allowed) throw Object.assign(Error('denied'), {statusCode: 403}); }};
  const domains = {sales: {id: 'sales', scope() {}, resolver: composition}, procurement: {id: 'procurement', scope() {}, resolver: composition}};
  const options = {context: {}, actor: {}, composition, domains};
  assert.deepEqual(marketReferenceRows({...options, query: 'Wat is onze omzetprognose?'}), []);
  assert.equal(marketReferenceRows({...options, query: 'Wat zijn de trends voor e-commerce?'}).length, 3);
  industry = 'AUTOMOTIVE'; const rows = marketReferenceRows({...options, query: 'Wat zijn de nieuwste modellen?'});
  assert.equal(rows.length, 4); assert.ok(rows.every(r => r.kind === 'MODEL_ANNOUNCEMENT')); assert.ok(rows.some(r => r.make === 'BMW'));
  allowed = false; assert.deepEqual(marketReferenceRows({...options, query: 'Wat zijn de nieuwste modellen?'}), []);
  allowed = true; calls = 0; composition.assertCapability = () => { if (++calls === 4) throw Object.assign(Error('revoked after retrieval'), {statusCode: 403}); };
  assert.throws(() => marketReferenceRows({...options, query: 'Wat zijn de nieuwste modellen?'}), {statusCode: 403});
});
test('dated primary facts distinguish period, capture age, generation, provisional claims and from-price scope', () => {
  const c = new MarketReferenceCatalog(undefined, () => new Date('2026-09-27T12:00:00Z'));
  const auto = c.search({industry: 'AUTOMOTIVE'}), commerce = c.search({industry: 'ECOMMERCE'});
  assert.equal(auto.total, 9); assert.equal(commerce.total, 3); assert.equal(auto.latest_market_completeness_verified, false);
  const bev = auto.results.find(r => r.id === 'eu-2026-08-bev-share'); assert.equal(bev.value, '21.7'); assert.equal(bev.period.to, '2026-08-31'); assert.equal(bev.forecast, false);
  const i3 = auto.results.find(r => r.make === 'BMW'); assert.match(i3.evidence_status, /PROVISIONAL/); assert.match(i3.generation, /NOT_PRIOR_I3/); assert.equal(i3.deliveries_started_verified, false);
  const price = auto.results.find(r => r.price); assert.equal(price.market, 'DE'); assert.equal(price.price.amount, '24995.00'); assert.match(price.variant_scope, /NOT_EVERY_CONFIGURATION/);
  assert.equal(c.search({q: 'BMW'}).total, 1); assert.equal(i3.freshness.newer_publications_verified, false);
  c.now = () => new Date('2026-12-01T00:00:00Z'); assert.equal(c.search().results[0].freshness.capture_status, 'REFRESH_REQUIRED');
  for (const invalid of [{limit: 51}, {industry: 'GENERAL'}, {limit: []}, {q: null}]) assert.throws(() => c.search(invalid), {code: 'market_reference_query_invalid'});
  assert.throws(() => c.select(['missing']), {code: 'market_reference_missing'});
});
test('source snapshot tampering fails closed with a safe source error', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'foundly-market-'));
  t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
  const original = path.join(__dirname, '../public-data/market/2026-09-26');
  for (const file of ['facts.json', 'manifest.json']) fs.copyFileSync(path.join(original, file), path.join(dir, file));
  fs.appendFileSync(path.join(dir, 'facts.json'), 'modified');
  assert.throws(() => new MarketReferenceCatalog(dir).search(), {code: 'market_reference_integrity', statusCode: 503});
});
test('native and ZERO forecasts carry selected external context without applying market growth to company opportunities', async () => {
  const s = await fixture();
  try {
    assert.equal((await s.request('/api/composition', 'PUT', {industry_id: 'GENERAL', entitlements: ['sales'], expected_revision: 0})).status, 200);
    const seller = await s.enroll('market.seller', ['SALES']);
    const source = await s.request('/api/sales/opportunities', 'POST', {title: 'Fixture forecast', value_cents: 10000, currency: 'EUR', probability: 0.5, expected_close_date: '2026-10-15'}, seller.cookie); assert.equal(source.status, 201, JSON.stringify(source.body));
    const input = {filters: {from: '2026-10-01', to: '2026-10-31', currency: 'EUR'}, scenario: {title: 'Explicit assumption', reason: 'Reviewed assumption independent of aggregate market growth', adjustments: [{opportunity_id: source.body.record.id, expected_revision: 1, probability_bps: 7500}]}, benchmark_ids: ['nl-2026-07-online-total']};
    const turn = operation => ({message: 'Bereken het expliciete omzetkansscenario', conversation_id: crypto.randomUUID(), turn_id: crypto.randomUUID(), client_context: {sales_action: {operation, input}}});
    const native = await s.request('/api/sales/forecast/scenarios/query', 'POST', input, seller.cookie); assert.equal(native.status, 200, JSON.stringify(native.body));
    assert.equal(native.body.scenario.groups[0].scenario_projected_cents, 7500); assert.equal(native.body.external_benchmarks[0].value, '3.8'); assert.equal(native.body.benchmark_effect, 'CONTEXT_ONLY_NO_AUTOMATIC_UPLIFT');
    const result = await s.request('/api/zero/turn', 'POST', turn('FORECAST_SCENARIO'), seller.cookie); assert.equal(result.status, 200, JSON.stringify(result.body)); assert.equal(result.body.sales_data.scenario.groups[0].scenario_projected_cents, 7500);
    assert.equal((await s.request('/api/sales/opportunities/' + source.body.record.id, 'GET', undefined, seller.cookie)).body.record.revision, 1);
    assert.equal((await s.request('/api/sales/forecast/scenarios/query', 'POST', {...input, benchmark_ids: ['unknown']}, seller.cookie)).status, 409);
    const marketTurn = {message: 'Toon markttrends', conversation_id: crypto.randomUUID(), turn_id: crypto.randomUUID(), client_context: {sales_action: {operation: 'MARKET_REFERENCES', input: {industry: 'ECOMMERCE'}}}};
    assert.equal((await s.request('/api/composition', 'PUT', {entitlements: ['sales'], capability_flags: {'sales:opportunities': false}, expected_revision: 1})).status, 200);
    assert.equal((await s.request('/api/zero/turn', 'POST', marketTurn, seller.cookie)).status, 200, 'Public reference reads do not require private pipeline capability');
    assert.equal((await s.request('/api/zero/turn', 'POST', turn('FORECAST_SCENARIO'), seller.cookie)).status, 403);
    assert.equal((await s.request('/api/composition', 'PUT', {entitlements: ['sales'], capability_flags: {'sales:forecast': false}, expected_revision: 2})).status, 200);
    assert.equal((await s.request('/api/sales/market-reference?industry=ECOMMERCE', 'GET', undefined, seller.cookie)).status, 403);
    assert.equal((await s.request('/api/zero/turn', 'POST', marketTurn, seller.cookie)).status, 403);
  } finally { await s.close(); }
});
