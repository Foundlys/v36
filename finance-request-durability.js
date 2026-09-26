'use strict';
// A Finance result, its request receipt and its native event outbox share one
// durable commit. Nested journal writes participate in the same transaction.
const crypto = require('node:crypto');
const {scopedMutation} = require('./scoped-mutation');
const OUTBOX = 'finance:mutation_event_outbox';
const active = new WeakMap();
const clone = v => JSON.parse(JSON.stringify(v));
const hash = v => crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
const fail = (code, message, statusCode = 409) => { throw Object.assign(Error(message), {code, statusCode}); };
function scopes(entities) { return [...new Set([...entities.map(n => 'finance:' + n), 'finance:idempotency', 'finance:audit_events', OUTBOX])]; }
function flush(core, ctx) {
  const pending = core.adapter.bucket(ctx, OUTBOX).filter(r => r.status === 'PENDING').slice(0, 50);
  for (const row of pending) {
    try {
      // The adapter must acknowledge an idempotent event ID. No acknowledgement
      // leaves the original event queued, never a fabricated delivered result.
      const acknowledged = core.adapter.emit(ctx, clone(row.event));
      if (acknowledged && typeof acknowledged.then === 'function') {
        // Async transports are not an acknowledged native transaction here.
        Promise.resolve(acknowledged).catch(() => {});
        continue;
      }
      if (!acknowledged) continue;
      scopedMutation(core.adapter, ctx, [OUTBOX], () => {
        const current = core.adapter.bucket(ctx, OUTBOX).find(r => r.id === row.id);
        current.status = 'DELIVERED'; current.delivered_at = core.now();
      });
    } catch { /* Original durable event remains available for a later retry. */ }
  }
  return core.adapter.bucket(ctx, OUTBOX).some(r => r.status === 'PENDING') ? 'QUEUED_RETRY' : 'DELIVERED';
}
function transaction(core, ctx, principal, entities, fn, extraScopes = []) {
  const declared = [...new Set([...scopes(entities), ...extraScopes])], prior = active.get(core);
  if (prior) {
    if (prior.tenant_id !== ctx.tenant_id || prior.dealer_id !== ctx.dealer_id || declared.some(s => !prior.scopes.includes(s))) fail('finance_transaction_scope', 'De geneste financiële mutatie valt buiten de bevestigde transactie');
    return fn();
  }
  const adapter = core.adapter;
  active.set(core, {...ctx, scopes: declared});
  core.adapter = {...adapter, bucket: (...args) => adapter.bucket(...args), id: () => adapter.id(), now: () => adapter.now(), persist() {}, emit(c, event) {
    if (c.tenant_id !== ctx.tenant_id || c.dealer_id !== ctx.dealer_id) fail('finance_transaction_scope', 'Financiële gebeurtenis valt buiten deze bedrijfscontext');
    const id = adapter.id();
    adapter.bucket(ctx, OUTBOX).push({id, status: 'PENDING', event: {...clone(event), event_id: id, actor_id: principal.id, occurred_at: adapter.now().toISOString()}, created_at: adapter.now().toISOString()});
  }};
  let result;
  try { result = scopedMutation(adapter, ctx, declared, fn); }
  finally { core.adapter = adapter; active.delete(core); }
  const delivery = flush(core, ctx);
  // Chart bootstrap is an existing array contract, not an object response.
  return Array.isArray(result) ? result : {...result, event_delivery: delivery};
}
function capacity(rows, next) {
  if (rows.length >= 100000 || rows.reduce((n, r) => n + Buffer.byteLength(JSON.stringify(r)), next ? Buffer.byteLength(JSON.stringify(next)) : 0) > 64 * 1024 * 1024) fail('finance_idempotency_capacity', 'De bewaarlimiet voor financiële aanvragen is bereikt; oudere bewijzen blijven behouden', 507);
}
function idempotent(core, ctx, principal, key, signature, fn, legacy = null, entities) {
  const owned = entities || require('./finance-core').FINANCE_ENTITIES;
  // A native outer operation owns the receipt. Its subordinate writes are not
  // separate requests and may not commit or replay a partial journal alone.
  if (active.has(core)) return transaction(core, ctx, principal, owned, fn);
  if (key === undefined || key === null || key === '') return transaction(core, ctx, principal, owned, fn);
  if (typeof key !== 'string' || !/^[A-Za-z0-9_.:-]{8,200}$/.test(key)) fail('finance_idempotency_invalid', 'Ongeldige Idempotency-Key', 400);
  const digest = crypto.createHash('sha256').update(principal.id + ':' + key).digest('hex');
  const rows = core.collection(ctx, 'idempotency'), existing = rows.find(r => r.digest === digest);
  if (existing) {
    if (existing.signature !== signature && !(legacy && [legacy.signature, ...(legacy.signatures || [])].includes(existing.signature) && legacy.accept(existing.result))) fail('finance_idempotency_conflict', 'Idempotency-Key is al voor een andere mutatie gebruikt');
    if (!existing.result || typeof existing.result !== 'object' || (existing.receipt_version !== undefined && existing.receipt_version !== 1)) fail('finance_idempotency_integrity', 'Het formaat van het bewaarde financiële bewijs is ongeldig');
    if (existing.receipt_version === 1 && hash(existing.result) !== existing.result_sha256) fail('finance_idempotency_integrity', 'Het bewaarde financiële resultaat kan niet worden geverifieerd');
    const result = Object.assign(clone(existing.result), {idempotent_replay: true, replay_semantics: 'ORIGINAL_COMMITTED_RESULT_NOT_CURRENT_STATE', ...(existing.receipt_version === 1 ? {result_snapshot_sha256: existing.result_sha256} : {legacy_result_unverified: true})});
    if (!active.has(core)) result.event_delivery = flush(core, ctx);
    return result;
  }
  capacity(rows);
  return transaction(core, ctx, principal, owned, () => {
    const result = fn();
    if (result && typeof result.then === 'function') fail('finance_transaction_async', 'Financiële mutaties moeten synchroon worden vastgelegd');
    const entry = {digest, signature, result: clone(result), created_at: core.now(), receipt_version: 1, result_sha256: hash(result)};
    capacity(rows, entry); rows.push(entry);
    return result;
  });
}
module.exports = {OUTBOX, idempotent, transaction, flush};
