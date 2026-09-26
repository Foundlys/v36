'use strict';
const crypto = require('node:crypto');
const {FoundlyFinanceCore} = require('../finance-core'), {FoundlyCrmCore} = require('../crm-core');
const {CapabilityResolver} = require('../capability-resolver'), {BusinessDomain} = require('../business-domains'), {guardDomain} = require('../composition-runtime');
const commerce = require('../sales-commerce');
function fixture() {
  let state = new Map(), disk = '[]', broken = false;
  const emitted = [], persisted = [], ctx = {tenant_id: 'commerce-finance-fixture', dealer_id: 'default'};
  const admin = {id: 'fixture-admin', roles: ['ADMIN', 'SUPER_ADMIN']}, actor = {id: 'fixture-seller-accountant', roles: ['SALES', 'ACCOUNTANT']};
  const shared = {
    bucket(c, name) {const key = JSON.stringify([c.tenant_id, c.dealer_id, name]); if (!state.has(key)) state.set(key, []); return state.get(key);},
    persist() {if (broken) throw Error('injected cross-module persistence failure'); disk = JSON.stringify([...state]); persisted.push(disk);},
    audit(c, a, action, entity, id, details) {this.bucket(c, 'platform:audit').push({actor_id: a.id, action, entity, id, details});},
    now: () => new Date('2026-09-26T21:00:00Z'), id: () => crypto.randomUUID()
  };
  const resolver = new CapabilityResolver(shared); resolver.configure(ctx, admin, {industry_id: 'GENERAL', entitlements: ['finance', 'sales', 'crm'], expected_revision: 0});
  const sales = new BusinessDomain('sales', {...shared, audit(c, a, action, entity, id, details) {shared.bucket(c, 'platform:audit').push({actor_id: a.id, action, entity, id, details});}, publish(c, a, event) {emitted.push(event); return {event_id: event.event_id};}}, resolver);
  const crmRaw = new FoundlyCrmCore({...shared, publish(c, event) {emitted.push(event); return {event_id: event.event_id};}}), crm = guardDomain(crmRaw, 'crm', () => resolver);
  const raw = new FoundlyFinanceCore({...shared, sales: () => sales, crm: () => crm, emit(c, event) {emitted.push(event); return {event_id: event.event_id};}}), finance = guardDomain(raw, 'finance', () => resolver);
  const entity = finance.createLegalEntity(ctx, actor, {name: 'Fixture supplier', legal_form: 'BV', address: 'Fixture supplier address', vat_id: 'FIXTURE-VAT', kvk_number: 'FIXTURE-KVK', currency: 'EUR'});
  finance.createPeriod(ctx, actor, {legal_entity_id: entity.id, start_date: '2026-01-01', end_date: '2026-12-31'}); finance.bootstrapDutchChart(ctx, actor, entity.id);
  const contact = crm.create(ctx, actor, 'contacts', {name: 'PRIVATE actual CRM fixture', billing_address: 'PRIVATE actual billing address'});
  const run = (operation, input, id) => commerce.execute(sales, ctx, actor, operation, {confirm: true, reason: 'Explicit fixture source', ...input}, {idempotency_key: id});
  run('PRODUCT_SAVE', {product_id: 'fixture-product', sku: 'FIXTURE', name: 'Locked fixture price', currency: 'EUR', unit_price_minor: 101, tax_rate_bps: 2100, expected_revision: 0}, 'define-product');
  run('STOCK_RECEIVE', {product_id: 'fixture-product', quantity: 5, expected_revision: 1, expected_product_revision: 1, evidence_reference: 'Fixture receipt'}, 'receive-product');
  run('ORDER_RESERVE', {order_id: 'fixture-order', currency: 'EUR', customer_reference: 'Unverified original user reference', expected_revision: 0, lines: [{product_id: 'fixture-product', quantity: 3, expected_product_revision: 1, expected_inventory_revision: 2}]}, 'reserve-order');
  const invoiceInput = {order_id: 'fixture-order', contact_id: contact.id, legal_entity_id: entity.id, invoice_number: 'COMMERCE-001', invoice_date: '2026-09-26', supply_date: '2026-09-26', due_date: '2026-10-26'};
  const command = () => {const p = finance.previewInvoiceAction(ctx, actor, {operation: 'COMMERCE_INVOICE_CREATE', input: invoiceInput}); return {operation: 'COMMERCE_INVOICE_CREATE', input: invoiceInput, expected_source_hash: p.source_hash, request_id: 'commerce-native-invoice', confirm: true, reason: 'Explicitly bind the reviewed order and CRM contact'};};
  return {ctx, admin, actor, resolver, shared, finance, raw, sales, crm, crmRaw, entity, contact, run, invoiceInput, command, emitted, persisted,
    rows: name => raw.collection(ctx, name), order: () => commerce.read(sales, ctx, actor, 'commerce_orders', 'fixture-order'),
    snapshot: () => JSON.stringify([...state].filter(([, rows]) => rows.length).sort(([a], [b]) => a.localeCompare(b))),
    fail: value => {broken = value;}, restart: () => {state = new Map(JSON.parse(disk));}}
}
module.exports = {fixture};
