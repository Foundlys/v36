'use strict';
const fs = require('node:fs'), path = require('node:path'), zlib = require('node:zlib'), crypto = require('node:crypto');
const clone = value => JSON.parse(JSON.stringify(value));
const token = value => String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
function fail(code, statusCode = 400) { throw Object.assign(Error(code), { code, statusCode }); }
const digest = data => crypto.createHash('sha256').update(data).digest('hex');
const countryNames = { NL: 'netherlands', BE: 'belgium', DE: 'germany', FR: 'france', GB: 'united kingdom', US: 'united states' };
class PublicProductCatalog {
  #manifest; #products; #prices; #byCode; #pricesByCode;
  constructor(directory = path.join(__dirname, 'public-data/ecommerce/2026-09-26')) { this.directory = directory; }
  manifest() {
    if (!this.#manifest) {
      try {
        const m = JSON.parse(fs.readFileSync(path.join(this.directory, 'catalog-manifest.json'), 'utf8'));
        if (m.schema_version !== 'foundly-public-product-catalog/1' || !Array.isArray(m.sources) || m.sources.length > 20) fail('product_reference_snapshot_invalid', 503);
        for (const s of m.sources) if (!/^[a-z0-9-]+$/.test(s.source_id) || !/^(?:[a-z0-9-]+\/)?[a-z0-9.-]+$/.test(s.file) || s.file.includes('..') || s.license !== 'ODbL-1.0' || !/^[a-f0-9]{64}$/.test(s.sha256)) fail('product_reference_snapshot_invalid', 503);
        this.#manifest = m;
      } catch { fail('product_reference_snapshot_unavailable', 503); }
    }
    return this.#manifest;
  }
  read(source) {
    try {
      const packed = fs.readFileSync(path.join(this.directory, source.file));
      if (packed.length > 32 * 1024 * 1024 || digest(packed) !== source.sha256) fail('product_reference_snapshot_integrity', 503);
      const raw = source.format === 'jsonl.gz' ? zlib.gunzipSync(packed, { maxOutputLength: 200 * 1024 * 1024 }).toString('utf8') : packed.toString('utf8');
      const rows = source.format === 'jsonl.gz' ? raw.trim().split('\n').filter(Boolean).map(s => JSON.parse(s)) : JSON.parse(raw).products;
      if (!Array.isArray(rows) || rows.length !== source.records || rows.length > 250000) fail('product_reference_snapshot_invalid', 503);
      return rows;
    } catch (error) { fail(error.code?.startsWith('product_reference_') ? error.code : 'product_reference_snapshot_unavailable', 503); }
  }
  provenance(source) {
    return { source_class: 'EXTERNAL_REFERENCE', classification: 'PUBLIC_VERIFIED', authority: 'PUBLIC_CONTRIBUTOR_CLAIM', source_id: source.source_id,
      source_url: source.source_url, observed_at: source.observed_at, snapshot_sha256: source.sha256, license: source.license, license_url: source.license_url,
      attribution: source.attribution, customer_truth: false, live_stock_verified: false, provider_api_connected: false };
  }
  products() {
    if (this.#products) return this.#products;
    const products = [], byCode = new Map(), ids = new Set();
    for (const source of this.manifest().sources.filter(s => s.kind === 'PUBLIC_PRODUCT_REFERENCE')) {
      for (const value of this.read(source)) {
        if (typeof value.code !== 'string' || !/^[0-9]{1,30}$/.test(value.code)) continue;
        const id = source.source_id + ':' + value.code;
        if (ids.has(id)) fail('product_reference_snapshot_duplicate', 503); ids.add(id);
        const entry = { id, record_kind: source.kind, product: value, provenance: this.provenance(source),
          interpretation: 'Public product reference; contributor claims may be incomplete or stale. No merchant SKU, current selling price or available stock is implied.' };
        products.push(entry); const list = byCode.get(value.code) || []; list.push(entry); byCode.set(value.code, list);
      }
    }
    this.#byCode = byCode; this.#products = products;
    return products;
  }
  priceRows() {
    if (this.#prices) return this.#prices;
    const prices = [], byCode = new Map(), ids = new Set();
    for (const source of this.manifest().sources.filter(s => s.kind === 'PUBLIC_PRICE_OBSERVATION')) for (const value of this.read(source)) {
      if (value.id === undefined || ids.has(String(value.id))) fail('product_reference_snapshot_duplicate', 503); ids.add(String(value.id));
      const entry = { id: source.source_id + ':' + value.id, record_kind: source.kind, observation: value, provenance: this.provenance(source),
        interpretation: 'Dated contributed price observation. Not a live offer, stock level, confirmed sale, cost price or currency-converted comparison.' };
      prices.push(entry); const key = String(value.product_code || ''), list = byCode.get(key) || []; list.push(entry); byCode.set(key, list);
    }
    this.#pricesByCode = byCode; this.#prices = prices; return prices;
  }
  page(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) fail('product_reference_filter_invalid');
    const limit = input.limit === undefined ? 25 : Number(input.limit), offset = input.offset === undefined ? 0 : Number(input.offset);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100 || !Number.isSafeInteger(offset) || offset < 0 || offset > 250000) fail('product_reference_page_invalid');
    for (const k of ['code', 'q', 'brand', 'country', 'category', 'currency', 'from', 'to']) if (input[k] !== undefined && (typeof input[k] !== 'string' || input[k].length > 160)) fail('product_reference_filter_invalid');
    return { limit, offset };
  }
  result(rows, page) {
    return { ok: true, snapshot_id: this.manifest().snapshot_id, source_scope: 'PUBLIC_REFERENCE_NOT_CUSTOMER_TRUTH', total: rows.length, ...page,
      results: clone(rows.slice(page.offset, page.offset + page.limit)), next_offset: page.offset + page.limit < rows.length ? page.offset + page.limit : null,
      coverage_complete: false, live_inventory_verified: false };
  }
  search(input = {}) {
    const page = this.page(input); this.products();
    const candidates = input.code ? this.#byCode.get(input.code) || [] : this.#products, q = token(input.q), brand = token(input.brand), category = token(input.category);
    const country = countryNames[String(input.country || '').toUpperCase()] || token(input.country);
    const rows = candidates.filter(({ product: p }) => (!q || token([p.product_name, p.product_name_en, p.product_name_nl, p.product_name_de, p.product_name_fr, p.brands, p.code].join(' ')).includes(q)) &&
      (!brand || token(p.brands).includes(brand)) && (!category || token(p.categories_tags || p.categories).includes(category)) &&
      (!country || token(p.countries_tags || p.countries).includes(country)));
    return this.result(rows, page);
  }
  prices(input = {}) {
    const page = this.page(input);
    if (!/^[0-9]{1,30}$/.test(input.code || '')) fail('product_reference_code_required');
    if (input.currency !== undefined && !/^[A-Z]{3}$/.test(input.currency)) fail('product_reference_currency_invalid');
    for (const key of ['from', 'to']) if (input[key] && (!/^\d{4}-\d\d-\d\d$/.test(input[key]) || !Number.isFinite(Date.parse(input[key])) || new Date(input[key]).toISOString().slice(0, 10) !== input[key])) fail('product_reference_date_invalid');
    if (input.from && input.to && input.from > input.to) fail('product_reference_date_invalid');
    this.priceRows();
    const rows = (this.#pricesByCode.get(input.code) || []).filter(({ observation: p }) => (!input.currency || p.currency === input.currency) &&
      (!input.from || typeof p.date === 'string' && p.date >= input.from) && (!input.to || typeof p.date === 'string' && p.date <= input.to))
      .sort((a,b) => String(b.observation.date || '').localeCompare(String(a.observation.date || '')) || a.id.localeCompare(b.id));
    return this.result(rows, page);
  }
  coverage() { return clone(this.manifest()); }
}
let shared;
module.exports = { PublicProductCatalog, defaultCatalog: () => shared || (shared = new PublicProductCatalog()) };
