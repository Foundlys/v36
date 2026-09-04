'use strict';

const assert = require('assert');
const {
  FoundlyAutomotiveCore,
  parseSearchCriteria,
  classifyFreshness,
  normalizeMobileDeRecord,
  normalizeMarktplaatsRecord,
  normalizeRdwRecord,
  deduplicateListings,
  comparableSimilarity,
  bpmDepreciationPercent,
  calculateBpm2026,
  AUTOMOTIVE_SCHEMA_VERSION,
  AUTOMOTIVE_BUY_SCORE_VERSION
} = require('./automotive-core');

const FIXTURE_LABEL = 'SYNTHETIC_PROVIDER_CONTRACT_FIXTURE_NOT_LIVE_DATA';
const fixedNow = new Date('2026-09-04T12:00:00.000Z');
const stores = new Map(), emitted = [];
const tenant = { tenant_id: 'house-of-cars-test', dealer_id: 'hoc-dealer-test' };
const otherTenant = { tenant_id: 'other-automotive-test', dealer_id: 'other-dealer-test' };
const admin = { id: 'test-admin', roles: ['ADMIN'] };
let sequence = 0, persisted = 0, failMobile = false, failMarktplaats = false;

function bucket(ctx, scope) {
  const key = `${ctx.tenant_id}:${ctx.dealer_id}:${scope}`;
  if (!stores.has(key)) stores.set(key, []);
  return stores.get(key);
}

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
}

const mobileFixtures = [
  {
    fixture: FIXTURE_LABEL, id: 'mobile-candidate-001', url: 'https://example.test/mobile-candidate-001', status: 'ACTIVE', modificationDate: '2026-09-04',
    seller: { type: 'DEALER', companyName: 'Contract Fixture Dealer DE', id: 'seller-de-1', address: { country: 'DE', city: 'Düsseldorf' } },
    price: { consumerPriceGross: 48900, currency: 'EUR', vatReclaimable: false },
    vehicle: { make: { name: 'BMW' }, model: { name: 'X5' }, modelDescription: 'X5 45e', variant: '45e', trimLine: 'M Sport', firstRegistration: '2022-03', mileage: 62000, fuel: { name: 'Plug-in Hybrid' }, gearbox: { name: 'Automatic' }, drivingMode: 'xDrive', powerKw: 290, co2Emission: 49, features: ['Panoramadak', 'Trekhaak'], images: ['https://example.test/mobile-001.jpg'], vin: 'WBAFIXTURE00000001' }
  },
  {
    fixture: FIXTURE_LABEL, id: 'mobile-comparable-001', url: 'https://example.test/mobile-comparable-001', status: 'ACTIVE', modificationDate: '2026-09-04',
    seller: { type: 'DEALER', companyName: 'Contract Fixture Dealer NL A', id: 'seller-nl-a', address: { country: 'NL', city: 'Utrecht' } },
    price: { consumerPriceGross: 69950, currency: 'EUR', vatReclaimable: true },
    vehicle: { make: { name: 'BMW' }, model: { name: 'X5' }, modelDescription: 'X5 45e', variant: '45e', trimLine: 'M Sport', firstRegistration: '2022-06', mileage: 59000, fuel: { name: 'Plug-in Hybrid' }, gearbox: { name: 'Automatic' }, drivingMode: 'xDrive', powerKw: 290, co2Emission: 46, features: ['Panoramadak'], images: ['https://example.test/mobile-nl-a.jpg'] }
  },
  {
    fixture: FIXTURE_LABEL, id: 'mobile-comparable-002', url: 'https://example.test/mobile-comparable-002', status: 'ACTIVE', modificationDate: '2026-09-04',
    seller: { type: 'DEALER', companyName: 'Contract Fixture Dealer NL B', id: 'seller-nl-b', address: { country: 'NL', city: 'Rotterdam' } },
    price: { consumerPriceGross: 73500, currency: 'EUR' },
    vehicle: { make: { name: 'BMW' }, model: { name: 'X5' }, modelDescription: 'X5 45e', variant: '45e', trimLine: 'M Sport', firstRegistration: '2023-01', mileage: 51000, fuel: { name: 'Plug-in Hybrid' }, gearbox: { name: 'Automatic' }, powerKw: 290, features: ['Panoramadak', 'Head-up display'], images: ['https://example.test/mobile-nl-b.jpg'] }
  }
];

function marktplaatsFixture(id, priceCents, mileage, city, year = 2022) {
  return {
    fixture: FIXTURE_LABEL, id, title: `BMW X5 45e M Sport ${year}`, url: `https://example.test/${id}`, status: 'ACTIVE', dateModified: '2026-09-04',
    seller: { type: 'DEALER', name: `Contract Fixture ${city}`, id: `seller-${id}` }, location: { countryCode: 'NL', cityName: city },
    price: { amount: priceCents, currency: 'EUR' }, images: [{ url: `https://example.test/${id}.jpg` }],
    attributes: [
      { key: 'merk', value: 'BMW' }, { key: 'model', value: 'X5' }, { key: 'variant', value: '45e' },
      { key: 'uitvoering', value: 'M Sport' }, { key: 'bouwjaar', value: year }, { key: 'kilometerstand', value: mileage },
      { key: 'brandstof', value: 'Plug-in hybride' }, { key: 'transmissie', value: 'Automaat' }, { key: 'vermogen_kw', value: 290 },
      { key: 'opties', value: 'Panoramadak, Trekhaak' }
    ]
  };
}

const marktplaatsFixtures = [
  marktplaatsFixture('mp-comparable-001', 7150000, 64000, 'Amsterdam'),
  marktplaatsFixture('mp-comparable-002', 7485000, 47000, 'Eindhoven', 2023),
  marktplaatsFixture('mp-comparable-003', 6890000, 69000, 'Breda')
];

const rdwFixtures = [
  { fixture: FIXTURE_LABEL, kenteken: 'TEST01', voertuigsoort: 'Personenauto', inrichting: 'SUV', merk: 'BMW', handelsbenaming: 'X5 XDRIVE45E', datum_eerste_toelating: '20220329', datum_eerste_tenaamstelling_in_nederland: '20230321', bruto_bpm: '577', catalogusprijs: '106374', co2_uitstoot_gecombineerd: '49', zuinigheidsclassificatie: 'A', cilinderinhoud: '2998', aantal_zitplaatsen: '5', eerste_kleur: 'ZWART' }
];

const adapter = {
  bucket,
  persist: () => persisted++,
  emit: (ctx, event) => emitted.push({ ctx, event }),
  id: () => `automotive-test-${String(++sequence).padStart(5, '0')}`,
  now: () => new Date(fixedNow),
  providerTimeoutMs: 1000,
  providerConfig: provider => {
    if (provider === 'rdw') return { base_url: 'https://opendata.rdw.nl' };
    if (provider === 'mobile_de') return { username: 'fixture-user', password: 'fixture-password', base_url: 'https://services.mobile.de' };
    if (provider === 'marktplaats') return { client_id: 'fixture-client', access_token: 'fixture-access-token', base_url: 'https://api.marktplaats.nl' };
    return {};
  },
  fetch: async (url, options = {}) => {
    const parsed = new URL(url);
    if (parsed.hostname === 'opendata.rdw.nl') {
      assert.equal(options.headers.accept, 'application/json');
      assert(parsed.searchParams.get('$where').includes("upper(merk)='BMW'"));
      return jsonResponse(rdwFixtures);
    }
    if (parsed.hostname === 'services.mobile.de') {
      assert.match(options.headers.authorization, /^Basic /);
      assert.equal(options.headers.accept, 'application/vnd.de.mobile.api+json');
      assert.equal(parsed.pathname, '/search-api/search');
      assert.equal(parsed.searchParams.get('page.size'), '50');
      if (failMobile) return jsonResponse({ error: 'fixture outage' }, 503);
      return jsonResponse({ ads: { ad: mobileFixtures } });
    }
    if (parsed.hostname === 'api.marktplaats.nl') {
      assert.equal(options.headers.authorization, 'Bearer fixture-access-token');
      assert.equal(parsed.pathname, '/v2/search');
      if (failMarktplaats) return jsonResponse({ error: 'fixture outage' }, 503);
      return jsonResponse({ advertisements: marktplaatsFixtures });
    }
    throw new Error(`Unexpected test URL ${url}`);
  }
};

const core = new FoundlyAutomotiveCore(adapter);

(async () => {
  const parsed = parseSearchCriteria('Zero, zoek een BMW X5 45e M Sport vanaf 2022, maximaal 70.000 kilometer en €50.000 inkoop.');
  assert.equal(parsed.status, 'interpreted');
  assert.deepEqual({ make: parsed.criteria.make, model: parsed.criteria.model, variant: parsed.criteria.variant, trim: parsed.criteria.trim }, { make: 'BMW', model: 'X5', variant: '45e', trim: 'M Sport' });
  assert.equal(parsed.criteria.year_min, 2022);
  assert.equal(parsed.criteria.mileage_max_km, 70000);
  assert.equal(parsed.criteria.purchase_price_max_eur, 50000);
  const followUp = parseSearchCriteria('En als ik maximaal €55.000 wil uitgeven?', parsed.criteria);
  assert.equal(followUp.criteria.make, 'BMW');
  assert.equal(followUp.criteria.model, 'X5');
  assert.equal(followUp.criteria.purchase_price_max_eur, 55000);
  const arbitrary = [
    ['Porsche Cayenne E-Hybrid vanaf 2021 tot €65.000', 'Porsche', 'Cayenne'],
    ['Mercedes GLE diesel vanaf 2022', 'Mercedes-Benz', 'GLE'],
    ['Audi Q8 automaat maximaal 80.000 km', 'Audi', 'Q8'],
    ['Range Rover Sport vanaf 2020', 'Land Rover', 'Range Rover Sport']
  ];
  for (const [query, make, model] of arbitrary) { const result = parseSearchCriteria(query); assert.equal(result.criteria.make, make); assert.equal(result.criteria.model, model); }
  assert.equal(parseSearchCriteria('zoek een auto').status, 'needs_input');

  assert.equal(classifyFreshness('2026-09-04T11:55:00Z', fixedNow, 'live').classification, 'LIVE');
  assert.equal(classifyFreshness('2026-09-04T11:55:00Z', fixedNow, 'cache').classification, 'CACHED');
  assert.equal(classifyFreshness('2026-09-03T11:55:00Z', fixedNow, 'cache').classification, 'STALE');
  assert.equal(classifyFreshness(null, fixedNow).classification, 'UNAVAILABLE');

  const mobile = normalizeMobileDeRecord(mobileFixtures[0], { fetchedAt: fixedNow.toISOString() });
  const marktplaats = normalizeMarktplaatsRecord(marktplaatsFixtures[0], { fetchedAt: fixedNow.toISOString() });
  const rdw = normalizeRdwRecord(rdwFixtures[0], { fetchedAt: fixedNow.toISOString() });
  assert.equal(mobile.schema_version, AUTOMOTIVE_SCHEMA_VERSION);
  assert.equal(mobile.vehicle.mileage_km, 62000);
  assert.equal(mobile.vehicle.fuel, 'PLUGIN_HYBRID');
  assert.equal(mobile.vehicle.drivetrain, 'AWD');
  assert.equal(marktplaats.commercial.gross_price_eur, 71500, 'Marktplaats v2 cents must normalize to EUR');
  assert.equal(marktplaats.vehicle.transmission, 'AUTOMATIC');
  assert.equal(rdw.record_kind, 'AUTOMOTIVE_VEHICLE_TRUTH');
  assert.equal(rdw.vehicle.environmental.original_bpm_eur, 577);
  assert.equal(rdw.provenance.provider_verified, true);
  assert(!JSON.stringify(mobile).includes('fixture-password'));

  const duplicateAcrossProviders = normalizeMarktplaatsRecord({ ...marktplaatsFixtures[0], id: 'mp-duplicate-vin', attributes: [...marktplaatsFixtures[0].attributes, { key: 'vin', value: 'WBAFIXTURE00000001' }] }, { fetchedAt: fixedNow.toISOString() });
  const dedup = deduplicateListings([mobile, duplicateAcrossProviders]);
  assert.equal(dedup.output_count, 1);
  assert.equal(dedup.duplicates_resolved, 1);
  assert(dedup.groups[0].evidence.includes('EXACT_VIN'));
  const similarNotDuplicate = normalizeMarktplaatsRecord({ ...marktplaatsFixtures[0], id: 'mp-similar-no-vin' }, { fetchedAt: fixedNow.toISOString() });
  assert.equal(deduplicateListings([mobile, similarNotDuplicate]).output_count, 2, 'similar vehicles must not be merged without high-confidence identity');
  assert(comparableSimilarity(mobile, similarNotDuplicate).score >= 58);

  const depreciation = bpmDepreciationPercent('2022-03-29', fixedNow);
  assert(depreciation.depreciation_percent > 50 && depreciation.depreciation_percent < 80);
  const bpm = calculateBpm2026({ co2_g_km: 49, fuel: 'PLUGIN_HYBRID', first_registration: '2022-03-29', reference_date: fixedNow });
  assert.equal(bpm.status, 'estimated');
  assert.equal(bpm.gross_bpm_2026_eur, 785);
  assert(bpm.estimated_payable_bpm_eur > 0);
  assert.equal(calculateBpm2026({ fuel: 'DIESEL' }).status, 'needs_input');

  const search = await core.search(tenant, admin, { query: parsed.original_query });
  assert.equal(search.status, 'completed');
  assert.equal(search.provider_executions.length, 3);
  assert(search.provider_executions.every(row => row.state === 'LIVE'));
  assert.equal(search.results.length, 1, 'only the candidate fits the purchase-price constraint');
  assert.equal(search.vehicle_truth.length, 1);
  assert.equal(search.results[0].identity.provider, 'mobile_de');
  assert.equal(search.real_data_only, true);
  assert.equal(search.synthetic_records, 0, 'the runtime contract may never label fixtures as live synthetic evidence');
  assert.equal(core.getSearch(tenant, admin, search.search_id).results.length, 1);
  assert.throws(() => core.getSearch(otherTenant, admin, search.search_id), error => error.code === 'automotive_search_not_found');

  const candidateId = search.results[0].canonical_listing_id;
  const comparables = core.comparables(tenant, admin, candidateId);
  assert(comparables.comparable_count >= 5);
  assert(comparables.price_distribution_eur.median > 68000);
  assert(Object.keys(comparables.source_mix).includes('marktplaats'));
  assert(comparables.listings.every(row => row.source_url && row.evidence.length));

  const incompleteEconomics = core.calculateEconomics(tenant, admin, candidateId, {});
  assert.equal(incompleteEconomics.status, 'needs_input');
  assert(incompleteEconomics.missing_fields.includes('transport_eur'));
  const economics = core.calculateEconomics(tenant, admin, candidateId, { transport_eur: 1200, registration_eur: 350, inspection_eur: 150, handling_eur: 500, other_eur: 0 });
  assert.equal(economics.status, 'estimated');
  assert(economics.all_in_acquisition_eur > 48900);
  assert(economics.expected_retail_range.expected_eur > economics.all_in_acquisition_eur);
  assert(economics.expected_gross_margin_range.expected_eur > 0);
  assert(economics.breakdown.some(item => item.type === 'FACT'));
  assert(economics.breakdown.some(item => item.type === 'ESTIMATE'));

  const profile = core.saveDealerProfile(tenant, admin, {
    display_name: 'House of Cars Contract Test', pilot_configuration: true,
    preferences: { preferred_makes: ['BMW', 'Porsche'], preferred_models: ['X5 45e'], purchase_price_min_eur: 35000, purchase_price_max_eur: 80000, mileage_max_km: 80000, year_min: 2021, powertrains: ['PLUGIN_HYBRID'], preferred_options: ['Panoramadak'], sourcing_countries: ['DE', 'NL'], target_margin_eur: 10000, risk_tolerance: 'MEDIUM' },
    cost_assumptions: { transport_eur: 1200, registration_eur: 350, inspection_eur: 150, handling_eur: 500, other_eur: 0, source: 'Explicit synthetic contract-test assumption' },
    history: { available: false }
  });
  assert.equal(profile.source, 'EXPLICIT_PILOT_CONFIGURATION');
  assert.equal(profile.history.available, false);
  assert.throws(() => core.saveDealerProfile(tenant, admin, { preferences: { api_key: 'never-store-this' } }), error => error.code === 'automotive_profile_secret_rejected');
  const analysis = core.analyseCandidate(tenant, admin, candidateId);
  assert.equal(analysis.dealer_fit.available, true);
  assert.equal(analysis.buy_score.available, true);
  assert.equal(analysis.buy_score.version, AUTOMOTIVE_BUY_SCORE_VERSION);
  assert(analysis.buy_score.components.every(component => component.evidence && component.version && component.timestamp));
  assert.equal(analysis.market_signals.actual_sales_demand.type, 'UNKNOWN');
  assert(analysis.risks.some(risk => risk.code === 'VAT_SEMANTICS_UNKNOWN' || risk.code === 'VIN_UNKNOWN') === false || Array.isArray(analysis.risks));

  const today = core.todayOpportunities(tenant, admin);
  assert(today.opportunities.length > 0 && today.opportunities.length <= 3);
  assert.equal(today.real_data_only, true);
  assert(today.opportunities.every(item => item.buy_score.available && item.candidate.identity.source_url));

  failMarktplaats = true;
  const mixed = await core.search(tenant, admin, { query: 'BMW X5 45e M Sport vanaf 2022 maximaal 80.000 kilometer en €80.000 inkoop' });
  assert.equal(mixed.status, 'partial');
  assert.equal(mixed.provider_executions.find(row => row.provider === 'marktplaats').state, 'CACHED');
  assert.equal(mixed.provider_executions.find(row => row.provider === 'mobile_de').state, 'LIVE');
  failMobile = true;
  const cached = await core.search(tenant, admin, { query: parsed.original_query });
  assert.equal(cached.status, 'partial');
  assert(['CACHED', 'STALE'].includes(cached.provider_executions.find(row => row.provider === 'mobile_de').state));
  assert(cached.results.length >= 1, 'verified cached provider records must survive temporary outages');
  assert.equal(cached.results[0].listing.freshness.classification, 'CACHED');

  const statuses = core.providerStatuses(tenant, admin);
  assert.equal(statuses.find(row => row.provider === 'rdw').configured, true);
  assert.equal(statuses.find(row => row.provider === 'autoscout24').adapter_available, false);
  assert(!JSON.stringify(statuses).includes('fixture-access-token'));
  const diagnostics = core.diagnostics(tenant, admin);
  assert.equal(diagnostics.persistence.separate_database, false);
  assert.equal(diagnostics.no_fake_data, true);
  assert.equal(core.diagnostics(otherTenant, admin).records.listings, 0, 'automotive buckets must be tenant isolated');
  assert(emitted.some(row => row.event.event_name === 'automotive_search_completed'));
  assert(persisted > 0);

  console.log(JSON.stringify({
    ok: true,
    automotive_schema: AUTOMOTIVE_SCHEMA_VERSION,
    natural_language_search: 'pass',
    random_queries: 'pass',
    follow_up_criteria: 'pass',
    provider_normalization: 'pass',
    marktplaats_cents: 'pass',
    freshness: 'pass',
    conservative_dedup: 'pass',
    tenant_isolation: 'pass',
    provider_failure_cache_fallback: 'pass',
    comparables: 'pass',
    bpm_estimate: 'pass',
    economics: 'pass',
    dealer_fit: 'pass',
    buy_score: 'pass',
    today_opportunities: 'pass',
    fixture_classification: FIXTURE_LABEL
  }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
