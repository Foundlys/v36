'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), zlib = require('node:zlib'), crypto = require('node:crypto');
const { PublicAutomotiveCatalog } = require('../automotive-public-reference');
const { FoundlyAutomotiveCore } = require('../automotive-core');
const { CapabilityResolver } = require('../capability-resolver');
const { guardDomain } = require('../composition-runtime');
const { referenceRows } = require('./automotive-reference-context');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function catalog(t, mutate = () => {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'foundly-reference-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const records = [
    { id: 'bmw-1', record_kind: 'TECHNICAL_REPRESENTATIVE', make: 'BMW', model: '320', country: 'DE', source_id: 'public-source', engine_power_kw: 135 },
    { id: 'bmw-2', record_kind: 'TECHNICAL_REPRESENTATIVE', make: 'BMW', model: '320', country: 'NL', source_id: 'public-source', engine_power_kw: 140 },
    { id: 'vw-1', record_kind: 'TYPE_VARIANT', make: 'VOLKSWAGEN', model: 'GOLF', source_id: 'public-source' },
    { id: 'byd-1', record_kind: 'TECHNICAL_REPRESENTATIVE', make: 'BYD', model: 'SEAL', source_id: 'public-source' },
    { id: 'bmw-reg', record_kind: 'REGISTRATION_AGGREGATE', make: 'BMW', country: 'NL', registrations: 22, source_id: 'public-source' },
    { id: 'bmw-offer', record_kind: 'PUBLIC_LISTING_OBSERVATION', vehicle: { make: 'BMW', model: '320' }, price: { amount: '19999.00', type: 'ASKING', currency: 'EUR' }, provenance: { authority: 'PUBLIC_ADVERTISER_CLAIM', observed_at: '2026-09-26T10:00:00.000Z', sale_confirmed: false } }
  ];
  const data = { records, sources: { 'public-source': { url: 'https://example.test/fixture', license: 'FIXTURE_NOT_REAL_EVIDENCE' } } };
  mutate(data);
  const raw = Buffer.from(JSON.stringify(data)), packed = zlib.gzipSync(raw);
  fs.writeFileSync(path.join(dir, 'catalog.json.gz'), packed);
  fs.writeFileSync(path.join(dir, 'catalog-manifest.json'), JSON.stringify({ schema_version: 'foundly-public-automotive-catalog/1', catalog_file: 'catalog.json.gz', catalog_sha256: sha(packed), uncompressed_sha256: sha(raw), records: data.records.length, make_labels: ['BMW', 'VOLKSWAGEN', 'BYD'], snapshot_id: 'fixture' }));
  return new PublicAutomotiveCatalog(dir);
}
function services(publicCatalog) {
  const buckets = new Map(), ctx = { tenant_id: 'references', dealer_id: 'default' }, owner = { id: 'owner', roles: ['ADMIN', 'SUPER_ADMIN'] }, reader = { id: 'reader', roles: ['VIEWER'] };
  const adapter = { publicCatalog, bucket(c, scope) { const key = JSON.stringify([c, scope]); if (!buckets.has(key)) buckets.set(key, []); return buckets.get(key); }, persist() {}, audit() {}, emit() {}, fetch() { throw Error('Unexpected network'); } };
  const composition = new CapabilityResolver(adapter);
  const configure = overrides => composition.configure(ctx, owner, { industry_id: 'AUTOMOTIVE', entitlements: ['procurement'], expected_revision: composition.profile(ctx)?.revision || 0, ...overrides });
  configure({});
  return { ctx, owner, reader, composition, configure, automotive: guardDomain(new FoundlyAutomotiveCore(adapter), 'procurement', () => composition) };
}

test('reference pages preserve exact prices and provenance, filter before paging and cannot mutate the shared snapshot', t => {
  const c = catalog(t), page = c.search({ kind: 'TECHNICAL_REPRESENTATIVE', make: 'bmw', model: '320', limit: 1 });
  assert.equal(page.total, 2); assert.equal(page.next_offset, 1); assert.equal(page.live_inventory_verified, false);
  assert.equal(c.search({ make: 'BMW', kind: 'TECHNICAL_REPRESENTATIVE', offset: 1 }).results[0].id, 'bmw-2');
  assert.equal(c.search({ make: 'BMW', country: 'DE' }).total, 1);
  assert.equal(c.search({ make: 'VW' }).results[0].make, 'VOLKSWAGEN');
  page.results[0].engine_power_kw = 999; page.results[0].provenance.url = 'changed';
  const again = c.search({ make: 'BMW', kind: 'TECHNICAL_REPRESENTATIVE' }).results[0];
  assert.equal(again.engine_power_kw, 135); assert.equal(again.provenance.customer_truth, false); assert.equal(again.provenance.url, 'https://example.test/fixture');
  const offer = c.search({ kind: 'PUBLIC_LISTING_OBSERVATION' }).results[0];
  assert.equal(offer.price.amount, '19999.00'); assert.equal(offer.provenance.authority, 'PUBLIC_ADVERTISER_CLAIM'); assert.equal(offer.provenance.sale_confirmed, false);
  for (const input of [null, [], { limit: 101 }, { offset: -1 }, { make: {} }, { q: 'a'.repeat(161) }, { kind: 'NOT_A_KIND' }]) assert.throws(() => c.search(input), { statusCode: 400 });
});

test('corrupt bytes, duplicate identities and dangling source references fail closed without caching partial data', t => {
  const c = catalog(t), file = path.join(c.directory, 'catalog.json.gz'), original = fs.readFileSync(file);
  fs.writeFileSync(file, Buffer.concat([original, Buffer.from('corrupt')]));
  assert.throws(() => c.search(), { code: 'reference_snapshot_integrity', statusCode: 503 });
  fs.writeFileSync(file, original); assert.equal(c.search().total, 6);
  assert.throws(() => catalog(t, d => d.records.push(d.records[0])).search(), { code: 'reference_snapshot_invalid' });
  assert.throws(() => catalog(t, d => d.records[0].source_id = '__proto__').search(), { code: 'reference_snapshot_invalid' });
});

test('current native industry, module and sourcing rights guard both public reference reads', t => {
  const c = catalog(t), s = services(c);
  assert.equal(s.automotive.getPublicReferences(s.ctx, s.reader, { make: 'BYD' }).total, 1);
  assert.equal(s.automotive.getPublicReferenceCoverage(s.ctx, s.reader).records, 6);
  for (const [config, code] of [[{ capability_flags: { 'procurement:sourcing': false } }, 'capability_disabled'], [{ industry_id: 'GENERAL' }, 'industry_disabled'], [{ entitlements: [] }, 'module_disabled']]) {
    s.configure(config);
    for (const method of ['getPublicReferences', 'getPublicReferenceCoverage']) assert.throws(() => s.automotive[method](s.ctx, s.reader), { code });
  }
});

test('ZERO receives bounded external references for catalog makes, retains meaning, and handles source failure without invented facts', t => {
  const c = catalog(t), s = services(c), read = query => referenceRows({ context: s.ctx, actor: s.reader, query, ...s, catalog: c });
  assert.deepEqual(c.resolveMakes('specificaties BYD Seal, BMW 320 en VW Golf'), ['volkswagen', 'bmw', 'byd']);
  const rows = read('Welke specificaties heeft de BYD Seal?');
  assert.equal(rows[0].id, 'byd-1'); assert.equal(rows[0].provenance.source_class, 'EXTERNAL_REFERENCE'); assert.equal(rows[0].provenance.executable, false);
  const bmw = read('Geef de BMW 320 referenties');
  assert.match(bmw.find(r => r.record_kind === 'PUBLIC_LISTING_OBSERVATION').interpretation, /not a verified current offer/);
  assert.match(bmw.find(r => r.record_kind === 'REGISTRATION_AGGREGATE').interpretation, /not used-car sales/);
  assert.deepEqual(read('Vat mijn afspraken samen'), []);
  s.configure({ capability_flags: { 'procurement:sourcing': false } }); assert.deepEqual(read('BMW 320'), []);
  s.configure({});
  const unavailable = new PublicAutomotiveCatalog(path.join(c.directory, 'missing'));
  const missing = referenceRows({ context: s.ctx, actor: s.reader, query: 'BMW 320', ...s, catalog: unavailable });
  assert.equal(missing[0].status, 'UNAVAILABLE'); assert.equal(missing[0].provenance.customer_truth, false);
  assert.ok(!JSON.stringify(missing).includes(c.directory));
});

test('ZERO drops the whole read when authority is revoked during source retrieval', t => {
  const c = catalog(t), s = services(c), real = s.automotive.getPublicReferences;
  const automotive = { getPublicReferences(...args) { const result = real(...args); s.configure({ capability_flags: { 'procurement:sourcing': false } }); return result; } };
  assert.throws(() => referenceRows({ context: s.ctx, actor: s.reader, query: 'BMW 320', ...s, automotive, catalog: c }), { code: 'capability_disabled' });
});
