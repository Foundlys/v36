'use strict';

const assert = require('assert');
const {
  FoundlyAutomotiveCore,
  PROVIDER_FRESHNESS_POLICIES,
  classifyFreshness,
  normalizeMobileDeRecord,
  normalizeMarktplaatsRecord
} = require('./automotive-core');

// Reduced contract shapes from the official provider documentation:
// https://services.mobile.de/docs/search-api.html
// https://api.marktplaats.nl/docs/v2/search-advertisements.html
// https://api.marktplaats.nl/docs/v2/advertisement.html
const FIXTURE_LABEL = 'OFFICIAL_DOCUMENTATION_SHAPE_CONTRACT_FIXTURE_NOT_LIVE_PROVIDER_DATA';
const fixedNow = new Date('2026-09-04T12:00:00.000Z');

function mobileAd(id, mileage) {
  return {
    fixture: FIXTURE_LABEL,
    mobileAdId: id,
    mobileSellerId: '11',
    creationDate: '2026-09-04T10:00:00+02:00',
    modificationDate: '2026-09-04T11:00:00+02:00',
    vehicleClass: 'Car',
    category: 'OffRoad',
    make: 'BMW',
    model: 'X5',
    modelDescription: 'X5 45e M Sport',
    condition: 'USED',
    firstRegistration: '202203',
    mileage,
    fuel: 'HYBRID',
    gearbox: 'AUTOMATIC_GEAR',
    power: 290,
    features: ['HYBRID_PLUGIN', 'PANORAMIC_GLASS_ROOF'],
    detailPageUrl: `https://suchen.mobile.de/auto-inserat/${id}.html?source=api`,
    images: [{ icon: `https://img.classistatic.de/${id}-80.jpg`, xl: `https://img.classistatic.de/${id}-640.jpg`, xxxl: `https://img.classistatic.de/${id}-1600.jpg` }],
    seller: {
      mobileSellerId: 'seller-11',
      companyName: 'Official Shape Dealer',
      type: 'DEALER',
      address: { city: 'Düsseldorf', country: 'DE' },
      phones: [{ internationalPrefix: '49', nationalPrefix: '211', number: '123456' }]
    },
    price: { consumerPriceGross: '71500.00', currency: 'EUR', vatRate: '19.00' }
  };
}

function marktplaatsResult(id, mileage) {
  return {
    fixture: FIXTURE_LABEL,
    itemId: id,
    title: `BMW X5 45e M Sport 2022 ${String(mileage).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} km plug-in hybride automaat`,
    description: 'Provider search-result contract shape',
    categoryId: 157,
    priceModel: { modelType: 'fixed', askingPrice: 7150000 },
    seller: { sellerId: 231, sellerName: 'Official Shape Seller' },
    _links: {
      'mp:advertisement': { href: `/v2/advertisements/${id}` },
      'mp:advertisement-website-link': { href: `http://link.marktplaats.nl/${id}`, type: 'text/html' }
    },
    _embedded: {
      'mp:advertisement-image': {
        imageId: 19,
        mediaId: 'documentation-image-id',
        status: 'available',
        _links: { 'mp:image-blob': { href: '/v2/images/documentation-image-id/{size}/blob', templated: true } }
      }
    }
  };
}

const mobileOne = mobileAd('mobile-official-1', 62000);
const mobileTwo = mobileAd('mobile-official-2', 58000);
const marktplaatsOne = marktplaatsResult('m459', 64000);
const marktplaatsTwo = marktplaatsResult('m460', 59000);

const normalizedMobile = normalizeMobileDeRecord(mobileOne, { fetchedAt: fixedNow.toISOString() });
assert(normalizedMobile, 'official mobile.de New JSON record must normalize');
assert.equal(normalizedMobile.identity.provider_listing_id, 'mobile-official-1');
assert.equal(normalizedMobile.identity.source_url, 'https://suchen.mobile.de/auto-inserat/mobile-official-1.html?source=api');
assert.equal(normalizedMobile.seller.company_id, 'seller-11');
assert.equal(normalizedMobile.seller.country, 'DE');
assert.equal(normalizedMobile.vehicle.make, 'BMW');
assert.equal(normalizedMobile.vehicle.model, 'X5');
assert.equal(normalizedMobile.vehicle.build_year, 2022);
assert.equal(normalizedMobile.vehicle.mileage_km, 62000);
assert.equal(normalizedMobile.vehicle.fuel, 'PLUGIN_HYBRID');
assert.equal(normalizedMobile.vehicle.transmission, 'AUTOMATIC');
assert.equal(normalizedMobile.vehicle.images[0], 'https://img.classistatic.de/mobile-official-1-1600.jpg');
assert.equal(normalizedMobile.commercial.gross_price_eur, 71500);

const normalizedMarktplaats = normalizeMarktplaatsRecord(marktplaatsOne, { fetchedAt: fixedNow.toISOString() });
assert(normalizedMarktplaats, 'official Marktplaats SearchResult must normalize');
assert.equal(normalizedMarktplaats.identity.provider_listing_id, 'm459');
assert.equal(normalizedMarktplaats.identity.source_url, 'http://link.marktplaats.nl/m459');
assert.equal(normalizedMarktplaats.seller.company_id, '231');
assert.equal(normalizedMarktplaats.seller.name, 'Official Shape Seller');
assert.equal(normalizedMarktplaats.vehicle.make, 'BMW');
assert.equal(normalizedMarktplaats.vehicle.build_year, 2022);
assert.equal(normalizedMarktplaats.vehicle.mileage_km, 64000);
assert.equal(normalizedMarktplaats.vehicle.fuel, 'PLUGIN_HYBRID');
assert.equal(normalizedMarktplaats.vehicle.transmission, 'AUTOMATIC');
assert.equal(normalizedMarktplaats.vehicle.images.length, 0, 'relative templated image links must remain an honest no-image state');
assert.equal(normalizedMarktplaats.commercial.gross_price_eur, 71500, 'askingPrice is expressed in euro cents');

const normalizedMarktplaatsDetail = normalizeMarktplaatsRecord({
  fixture: FIXTURE_LABEL,
  itemId: 'm461',
  status: 'online',
  startDate: '2026-09-03T08:00:00Z',
  translations: [{ locale: 'nl-NL', title: 'BMW X5 45e M Sport', description: 'Dealeradvertentie' }],
  priceModel: { modelType: 'fixed', askingPrice: 6995000 },
  seller: { sellerId: 232, sellerName: 'Detail Shape Seller', phoneNumber: '0612345678' },
  location: { cityName: 'Utrecht', countryCode: 'NL' },
  makeDescription: 'BMW', model: 'X5', modelDescription: '45e', buildYear: 2022, mileage: 61000,
  fuelType: 'Plug-in hybride', transmission: 'Automaat', licensePlate: 'AA11BB',
  images: [{ xxl: 'https://images.example.test/m461-1024.jpg' }]
}, { fetchedAt: fixedNow.toISOString() });
assert.equal(normalizedMarktplaatsDetail.listing.status, 'ACTIVE');
assert.equal(normalizedMarktplaatsDetail.vehicle.model, 'X5');
assert.equal(normalizedMarktplaatsDetail.vehicle.images[0], 'https://images.example.test/m461-1024.jpg');

assert.notDeepEqual(PROVIDER_FRESHNESS_POLICIES.mobile_de, PROVIDER_FRESHNESS_POLICIES.marktplaats);
assert.equal(classifyFreshness('2026-09-04T07:00:00Z', fixedNow, 'cache', 'mobile_de').classification, 'CACHED');
assert.equal(classifyFreshness('2026-09-04T07:00:00Z', fixedNow, 'cache', 'marktplaats').classification, 'STALE');

const stores = new Map(), requests = [];
const bucket = (ctx, scope) => {
  const key = `${ctx.tenant_id}:${ctx.dealer_id}:${scope}`;
  if (!stores.has(key)) stores.set(key, []);
  return stores.get(key);
};
const response = value => new Response(JSON.stringify(value), { status: 200, headers: { 'content-type': 'application/json' } });
const core = new FoundlyAutomotiveCore({
  bucket,
  persist: () => {},
  emit: () => {},
  id: () => `contract-${requests.length}-${stores.size}`,
  now: () => new Date(fixedNow),
  providerTimeoutMs: 1000,
  providerConfig: provider => provider === 'mobile_de'
    ? { username: 'contract-user', password: 'contract-password', base_url: 'https://services.mobile.de' }
    : { client_id: 'contract-client', access_token: 'contract-token', base_url: 'https://api.marktplaats.nl' },
  fetch: async (url, options = {}) => {
    const parsed = new URL(url), headers = new Headers(options.headers || {});
    requests.push({ host: parsed.hostname, page: parsed.searchParams.get('page.number'), offset: parsed.searchParams.get('offset') });
    if (parsed.hostname === 'services.mobile.de') {
      assert.equal(headers.get('accept'), 'application/vnd.de.mobile.api+json');
      assert.match(headers.get('authorization'), /^Basic /);
      assert.equal(parsed.searchParams.get('fuel'), 'HYBRID');
      assert(parsed.searchParams.getAll('feature').includes('HYBRID_PLUGIN'));
      const page = Number(parsed.searchParams.get('page.number'));
      return response({ total: 2, currentPage: page, maxPages: 2, pageSize: 1, ads: [page === 1 ? mobileOne : mobileTwo] });
    }
    if (parsed.hostname === 'api.marktplaats.nl') {
      assert.equal(headers.get('authorization'), 'Bearer contract-token');
      assert.equal(parsed.pathname, '/v2/search');
      const offset = Number(parsed.searchParams.get('offset'));
      if (offset === 0) return response({
        _links: { next: { href: `/v2/search?query=BMW%20X5%2045e&offset=1&limit=1&withImages=true` } },
        _embedded: { 'mp:search-result': [marktplaatsOne] }, query: 'BMW X5 45e', offset: 0, limit: 1, totalCount: 2
      });
      return response({ _embedded: { 'mp:search-result': [marktplaatsTwo] }, query: 'BMW X5 45e', offset: 1, limit: 1, totalCount: 2 });
    }
    throw new Error(`Unexpected provider host ${parsed.hostname}`);
  }
});

(async () => {
  const context = { tenant_id: 'provider-contract', dealer_id: 'provider-contract' };
  const principal = { id: 'provider-contract-admin', roles: ['ADMIN'] };
  const searchInput = {
    query: 'BMW X5 45e plug-in hybride vanaf 2022 maximaal 100.000 kilometer en €80.000 inkoop',
    criteria: { limit: 2, page_size: 1, max_pages: 2 }
  };
  const mobileSearch = await core.search(context, principal, { ...searchInput, providers: ['mobile_de'] });
  assert.equal(mobileSearch.status, 'completed');
  assert.equal(mobileSearch.results.length, 2);
  assert.equal(mobileSearch.provider_executions[0].pagination.pages_received, 2);
  assert.equal(mobileSearch.provider_executions[0].records_normalized, 2);
  assert(Number.isFinite(mobileSearch.provider_executions[0].normalization_ms));
  assert(Number.isFinite(mobileSearch.provider_executions[0].persistence_ms));

  const marktplaatsSearch = await core.search(context, principal, { ...searchInput, providers: ['marktplaats'] });
  assert.equal(marktplaatsSearch.status, 'completed');
  assert.equal(marktplaatsSearch.results.length, 2);
  assert.equal(marktplaatsSearch.provider_executions[0].pagination.pages_received, 2);
  assert.equal(marktplaatsSearch.provider_executions[0].pagination.next_links_followed, 1);
  assert.equal(marktplaatsSearch.provider_executions[0].records_normalized, 2);
  assert(!JSON.stringify(core.diagnostics(context, principal)).includes('contract-token'));

  console.log(JSON.stringify({
    ok: true,
    fixture_classification: FIXTURE_LABEL,
    mobile_de_new_json: 'pass',
    marktplaats_hal_search_result: 'pass',
    marktplaats_detail_shape: 'pass',
    official_price_cents: 'pass',
    safe_image_semantics: 'pass',
    provider_specific_freshness: 'pass',
    mobile_de_pagination: 'pass',
    marktplaats_hal_pagination: 'pass',
    timing_telemetry: 'pass',
    live_provider_proof: false
  }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
