'use strict';
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');

function error(code, message) { return Object.assign(new Error(message), { code, statusCode: 400 }); }
function unavailable(code = 'reference_snapshot_unavailable') { return Object.assign(new Error('Openbare referentiecatalogus is niet beschikbaar'), { code, statusCode: 503 }); }
function token(value) { return String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
const makeKey = value => ({ vw: 'volkswagen', mercedes: 'mercedes benz' })[token(value)] || token(value);
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const clone = value => JSON.parse(JSON.stringify(value));
const makeOf = row => row.vehicle?.make || row.make;
const modelOf = row => row.vehicle?.model || row.model;

class PublicAutomotiveCatalog {
  #records; #sources; #manifest; #byKind; #byMake;
  constructor(directory = path.join(__dirname, 'public-data/snapshots/2026-09-26')) {
    this.directory = directory;
  }
  readManifest() {
    try {
      const manifest = JSON.parse(fs.readFileSync(path.join(this.directory, 'catalog-manifest.json'), 'utf8'));
      if (manifest.schema_version !== 'foundly-public-automotive-catalog/1' || manifest.catalog_file !== 'catalog.json.gz' || !Array.isArray(manifest.make_labels)) throw unavailable('reference_snapshot_invalid');
      return manifest;
    } catch (cause) { throw unavailable(cause.code?.startsWith('reference_snapshot_') ? cause.code : undefined); }
  }
  load() {
    if (this.#records) return;
    try {
    const manifest = this.readManifest();
    const packed = fs.readFileSync(path.join(this.directory, manifest.catalog_file));
    if (packed.length > 32 * 1024 * 1024 || sha256(packed) !== manifest.catalog_sha256) throw error('reference_snapshot_integrity', 'Referentiebron komt niet overeen met de vastgelegde checksum');
    const raw = zlib.gunzipSync(packed, { maxOutputLength: 256 * 1024 * 1024 });
    if (sha256(raw) !== manifest.uncompressed_sha256) throw error('reference_snapshot_integrity', 'Referentiegegevens zijn gewijzigd');
    const data = JSON.parse(raw);
    if (!Array.isArray(data.records) || data.records.length !== manifest.records || data.records.length > 500000 || !data.sources || typeof data.sources !== 'object' || Array.isArray(data.sources)) throw error('reference_snapshot_invalid', 'Referentiebron is onvolledig');
    const byKind = new Map(), byMake = new Map(), ids = new Set();
    for (const row of data.records) {
      if (!row?.id || ids.has(row.id) || !row.record_kind || row.source_id && !Object.hasOwn(data.sources, row.source_id)) throw error('reference_snapshot_invalid', 'Referentie-ID of bron ontbreekt');
      ids.add(row.id);
      for (const [map, key] of [[byKind, row.record_kind], [byMake, makeKey(makeOf(row))]]) {
        const list = map.get(key) || []; list.push(row); map.set(key, list);
      }
    }
    // Install only a completely checked snapshot, never a partial failed load.
    this.#sources = data.sources; this.#manifest = manifest; this.#byKind = byKind; this.#byMake = byMake; this.#records = data.records;
    } catch (cause) { throw unavailable(cause.code?.startsWith('reference_snapshot_') ? cause.code : undefined); }
  }
  coverage() { this.load(); return clone(this.#manifest); }
  resolveMakes(query) {
    if (typeof query !== 'string' || query.length > 4000) return [];
    // The small manifest allows intent selection without loading all records.
    const manifest = this.#manifest || this.readManifest();
    const hay = ' ' + token(query) + ' ', matches = new Set();
    for (const make of manifest.make_labels || []) {
      const key = makeKey(make);
      if ((key.length >= 3 || ['mg', 'ds'].includes(key)) && hay.includes(' ' + key + ' ')) matches.add(key);
    }
    if (hay.includes(' vw ')) matches.add('volkswagen');
    if (hay.includes(' mercedes ') && !hay.includes(' mercedes benz ')) matches.add('mercedes benz');
    return [...matches].sort((a, b) => b.length - a.length || a.localeCompare(b)).filter((make, i, all) => !all.slice(0, i).some(longer => longer.includes(make))).slice(0, 3);
  }
  resolveModel(query, make) {
    this.load();
    const hay = ' ' + token(query) + ' ', key = makeKey(make);
    const models = [...new Set((this.#byMake.get(key) || []).map(row => token(modelOf(row))).filter(Boolean))];
    const exact = models.filter(model => model !== key && hay.includes(' ' + model + ' ')).sort((a, b) => b.length - a.length || a.localeCompare(b));
    if (exact.length) return exact[0];
    // Numeric family names such as 320 may prefix 320d/320i. Never consume
    // trailing natural-language instructions as part of a vehicle model.
    for (const part of token(query).split(' ')) if (/\d/.test(part) && !key.split(' ').includes(part) && models.some(model => model.startsWith(part))) return part;
    return undefined;
  }
  search(input = {}) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw error('reference_filter_invalid', 'Ongeldige referentiefilters');
    const limit = input.limit === undefined ? 25 : Number(input.limit);
    const offset = input.offset === undefined ? 0 : Number(input.offset);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100 || !Number.isSafeInteger(offset) || offset < 0 || offset > 500000) throw error('reference_page_invalid', 'Gebruik een limiet van 1 tot 100 en een geldige offset');
    for (const key of ['make', 'model', 'q', 'kind', 'country']) if (input[key] !== undefined && (typeof input[key] !== 'string' || input[key].length > 160)) throw error('reference_filter_invalid', 'Ongeldig referentiefilter');
    this.load();
    const kind = input.kind || null, make = makeKey(input.make), model = token(input.model), query = token(input.q), country = input.country?.toUpperCase();
    if (kind && !this.#byKind.has(kind)) throw error('reference_kind_invalid', 'Onbekende soort referentiegegevens');
    const byMake = make ? this.#byMake.get(make) || [] : null, byKind = kind ? this.#byKind.get(kind) : null;
    const candidates = byMake && byKind ? byMake.length < byKind.length ? byMake : byKind : byMake || byKind || this.#records;
    const filtered = !kind && !make && !model && !query && !country ? candidates : candidates.filter(row =>
      (!kind || row.record_kind === kind) && (!make || makeKey(makeOf(row)) === make) && (!model || token(modelOf(row)).includes(model)) &&
      (!country || (row.seller?.country || row.country) === country) && (!query || token([makeOf(row), modelOf(row), row.variant, row.vehicle?.variant, row.vehicle?.title].filter(Boolean).join(' ')).includes(query)));
    const results = filtered.slice(offset, offset + limit).map(row => {
      const value = clone(row);
      if (row.source_id) value.provenance = { classification: 'PUBLIC_VERIFIED', authority: 'PUBLIC_REFERENCE', ...clone(this.#sources[row.source_id]), specifications_complete: false, customer_truth: false };
      return value;
    });
    return { ok: true, snapshot_id: this.#manifest.snapshot_id, snapshot_created_at: this.#manifest.created_at, total: filtered.length, offset, limit,
      next_offset: offset + results.length < filtered.length ? offset + results.length : null, results,
      coverage_complete: false, live_inventory_verified: false, source_scope: 'PUBLIC_REFERENCE_NOT_CUSTOMER_TRUTH' };
  }
}

let shared;
function defaultCatalog() { return shared || (shared = new PublicAutomotiveCatalog()); }
module.exports = { PublicAutomotiveCatalog, defaultCatalog, token, makeKey };
