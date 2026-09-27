'use strict';
const crypto = require('node:crypto');
const {FoundlyFinanceCore} = require('../finance-core');
const ctx = {tenant_id: 'finance-durable-fixture', dealer_id: 'default'};
const actor = {id: 'fixture-accountant', roles: ['FINANCE_ADMIN']};
function fixture() {
  let state = new Map(), saved = '[]', attempts = 0, failAt = null, acknowledge = true, core;
  const events = new Map(), emitted = [];
  const adapter = {
    bucket(c, scope) { const key = JSON.stringify([c.tenant_id, c.dealer_id, scope]); if (!state.has(key)) state.set(key, []); return state.get(key); },
    id: () => crypto.randomUUID(), now: () => new Date('2026-09-26T20:00:00Z'),
    persist() { if (++attempts === failAt) throw Error('injected durable persistence failure'); saved = JSON.stringify([...state]); },
    emit(c, event) { emitted.push(event); if (acknowledge === 'unavailable') return null; events.set(event.event_id, event); return acknowledge ? {event_id: event.event_id} : null; }
  };
  core = new FoundlyFinanceCore(adapter);
  const f = {ctx, actor: {...actor, roles: [...actor.roles]}, adapter, events, emitted, get core() {return core;},
    count: () => attempts, failNext: () => {failAt = attempts + 1;}, failOffset: n => {failAt = attempts + n;},
    acknowledge: value => {acknowledge = value;},
    snapshot: () => JSON.stringify([...state].filter(([, rows]) => rows.length).sort(([a], [b]) => a.localeCompare(b))),
    restart() {state = new Map(JSON.parse(saved)); core = new FoundlyFinanceCore(adapter);},
    rows: name => core.collection(ctx, name)
  };
  f.entity = core.createLegalEntity(ctx, f.actor, {name: 'Explicit test business', legal_form: 'BV', currency: 'EUR'});
  f.period = core.createPeriod(ctx, f.actor, {legal_entity_id: f.entity.id, start_date: '2026-01-01', end_date: '2026-12-31'});
  f.accounts = core.bootstrapDutchChart(ctx, f.actor, f.entity.id);
  return f;
}
function input(f, invoice_number = 'FIXTURE-001', amount = 10000) {
  return {legal_entity_id: f.entity.id, invoice_number, kind: 'SALES', supplier_name: 'Fixture supplier', supplier_address: 'Fixture source address', supplier_vat_id: 'FIXTURE-NOT-REAL', supplier_kvk_number: 'FIXTURE-NOT-REAL', customer_name: 'Fixture customer', customer_address: 'Fixture customer address', invoice_date: '2026-09-01', supply_date: '2026-09-01', due_date: '2026-09-30', currency: 'EUR', lines: [{description: 'Explicit test line', quantity: 1, unit_price_cents: amount, vat_rate: 21}]};
}
function posted(f, number) { const draft = f.core.createInvoice(f.ctx, f.actor, input(f, number)); return f.core.postInvoice(f.ctx, f.actor, draft.invoice.id); }
module.exports = {fixture, input, posted};
