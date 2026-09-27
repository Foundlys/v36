'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const clone = v => JSON.parse(JSON.stringify(v));
const fail = (code, message, statusCode = 422) => { throw Object.assign(Error(message), {code, statusCode}); };
const industryIds = ['AUTOMOTIVE', 'ECOMMERCE'], kinds = ['MARKET_STATISTIC', 'MODEL_ANNOUNCEMENT'];
class MarketReferenceCatalog {
  constructor(directory = path.join(__dirname, 'public-data/market/2026-09-26'), now = () => new Date()) { this.directory = directory; this.now = now; this.snapshot = null; }
  load() {
    if (this.snapshot) return this.snapshot;
    try {
      const manifest = JSON.parse(fs.readFileSync(path.join(this.directory, 'manifest.json'), 'utf8'));
      if (manifest.file !== 'facts.json') throw Error('path');
      const bytes = fs.readFileSync(path.join(this.directory, manifest.file));
      if (bytes.length > 1024 * 1024 || crypto.createHash('sha256').update(bytes).digest('hex') !== manifest.sha256) throw Error('hash');
      const value = JSON.parse(bytes);
      if (value.schema_version !== 'foundly-market-reference/1' || value.snapshot_id !== manifest.snapshot_id || !Array.isArray(value.sources) || !Array.isArray(value.records) || value.records.length !== manifest.records || value.sources.length !== manifest.source_count || new Set(value.records.map(r => r.id)).size !== value.records.length || new Set(value.sources.map(r => r.id)).size !== value.sources.length) throw Error('shape');
      const sourceIds = new Set(value.sources.map(s => s.id));
      for (const source of value.sources) if (typeof source.url !== 'string' || new URL(source.url).protocol !== 'https:' || !Number.isFinite(Date.parse(source.observed_at)) || !/^\d{4}-\d{2}-\d{2}$/.test(source.published_on)) throw Error('source');
      for (const row of value.records) if (typeof row.id !== 'string' || !industryIds.includes(row.industry) || !kinds.includes(row.kind) || !sourceIds.has(row.source_id) || row.supporting_source_ids?.some(id => !sourceIds.has(id)) || row.customer_truth !== false) throw Error('record');
      this.snapshot = value; return value;
    } catch { fail('market_reference_integrity', 'De marktbronnen kunnen niet worden geverifieerd', 503); }
  }
  present(row) {
    const snapshot = this.load(), source = snapshot.sources.find(s => s.id === row.source_id), now = this.now().getTime();
    const days = value => Math.floor((now - Date.parse(value)) / 86400000);
    const age = days(source.observed_at), sourceAge = days(source.published_on);
    return {...clone(row), source: clone(source), supporting_sources: (row.supporting_source_ids || []).map(id => clone(snapshot.sources.find(s => s.id === id))), freshness: {capture_age_days: age, publication_age_days: sourceAge, capture_status: age < 0 || sourceAge < 0 ? 'SOURCE_TIME_INVALID' : age > 45 ? 'REFRESH_REQUIRED' : 'RECENT_CAPTURE', newer_publications_verified: false}, provenance: {source_class: 'EXTERNAL_REFERENCE', customer_truth: false, executable: false, snapshot_id: snapshot.snapshot_id}, interpretation: row.kind === 'MARKET_STATISTIC' ? 'Observed aggregate for the stated period and population; not a company forecast, realised used-car sale or causal effect.' : 'Dated manufacturer claim for the named generation/configuration; targets, from-prices and announced dates do not prove current stock, final homologation or deliveries.'};
  }
  search(query = {}) {
    if (!query || typeof query !== 'object' || Array.isArray(query) || Object.keys(query).some(k => !['industry', 'kind', 'q', 'limit'].includes(k)) || query.industry !== undefined && !industryIds.includes(query.industry) || query.kind !== undefined && !kinds.includes(query.kind) || query.q !== undefined && (typeof query.q !== 'string' || query.q.length > 100)) fail('market_reference_query_invalid', 'Kies een geldige marktbronquery');
    const limit = query.limit === undefined ? 12 : typeof query.limit === 'number' ? query.limit : typeof query.limit === 'string' && /^\d+$/.test(query.limit) ? Number(query.limit) : NaN;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50) fail('market_reference_query_invalid', 'Vraag maximaal vijftig marktbronnen op');
    const s = this.load(), q = (query.q || '').toLowerCase(), rows = s.records.filter(r => (!query.industry || r.industry === query.industry) && (!query.kind || r.kind === query.kind) && (!q || JSON.stringify(r).toLowerCase().includes(q)));
    return {snapshot_id: s.snapshot_id, coverage: s.coverage, total: rows.length, results: rows.slice(0, limit).map(r => this.present(r)), latest_market_completeness_verified: false};
  }
  select(ids) {
    if (!Array.isArray(ids) || ids.length > 8 || new Set(ids).size !== ids.length || ids.some(id => typeof id !== 'string' || id.length > 100)) fail('market_reference_selection_invalid', 'Kies maximaal acht unieke bronverwijzingen');
    return ids.map(id => { const row = this.load().records.find(r => r.id === id); if (!row) fail('market_reference_missing', 'Een gekozen bronverwijzing ontbreekt', 409); return this.present(row); });
  }
}
const catalog = new MarketReferenceCatalog();
function scope(domain, ctx, actor) {
  domain.scope(ctx, actor);
  domain.resolver.assertCapability(ctx, actor, domain.id === 'sales' ? 'sales:forecast' : 'procurement:sourcing', 'read');
}
function query(domain, ctx, actor, input = {}) { scope(domain, ctx, actor); const result = catalog.search(input); scope(domain, ctx, actor); return result; }
function scenario(domain, ctx, actor, input) {
  scope(domain, ctx, actor);
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(k => !['filters', 'scenario', 'benchmark_ids'].includes(k))) fail('scenario_query_invalid', 'Kies expliciete filters, aannames en bronverwijzingen');
  const sources = catalog.select(input.benchmark_ids || []);
  const result = require('./sales-scenarios').scenarioForecast(domain, ctx, actor, input.filters || {}, input.scenario);
  scope(domain, ctx, actor);
  return {...result, external_benchmarks: sources, benchmark_effect: 'CONTEXT_ONLY_NO_AUTOMATIC_UPLIFT', forecast_classification: 'CONDITIONAL_OPPORTUNITY_SCENARIO_NOT_RECOGNISED_REVENUE', future_accuracy_verified: false};
}
module.exports = {MarketReferenceCatalog, catalog, query, scenario};
