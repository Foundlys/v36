'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const {BusinessDomain} = require('../business-domains');
const {CapabilityResolver} = require('../capability-resolver');
const commerce = require('../sales-commerce');
function fixture() {
  let rows = new Map(), disk, broken = false;
  const ctx = {tenant_id: 'commerce-fixture', dealer_id: 'default'}, admin = {id: 'admin', roles: ['ADMIN', 'SUPER_ADMIN']}, seller = {id: 'seller', roles: ['SALES']};
  const adapter = {bucket(c, s) { const key = JSON.stringify([c, s]); if (!rows.has(key)) rows.set(key, []); return rows.get(key); }, persist() { if (broken) throw Error('Fixture atomic persistence failure'); disk = JSON.stringify([...rows]); }, now: () => new Date('2026-09-26T21:00:00Z'), audit(c, a, action, entity, id, details) { this.bucket(c, 'platform:audit').push({action, entity, id, details}); }, publish() {}};
  const resolver = new CapabilityResolver(adapter); resolver.configure(ctx, admin, {industry_id: 'GENERAL', entitlements: ['sales'], expected_revision: 0});
  const domain = new BusinessDomain('sales', adapter, resolver);
  const run = (op, input, key, actor = seller) => commerce.execute(domain, ctx, actor, op, input, {idempotency_key: key});
  const read = (entity, id, actor = seller) => commerce.read(domain, ctx, actor, entity, id);
  return {domain, ctx, admin, seller, adapter, resolver, run, read, state: () => commerce.hash([...rows].filter(([, r]) => r.length)), fail: v => broken = v, restart: () => { rows = new Map(JSON.parse(disk)); }};
}
const confirmed = {confirm: true, reason: 'Explicit isolated fixture registration'};
const product = (id = 'shirt-blue-m', extra = {}) => ({...confirmed, product_id: id, sku: id, name: 'PRIVATE test shirt', group_id: 'shirt', attributes: {colour: 'blue', size: 'M'}, currency: 'EUR', unit_price_minor: 101, tax_rate_bps: 2100, expected_revision: 0, ...extra});
function seed(s, id = 'shirt-blue-m', extra = {}) {
  const p = product(id, extra); s.run('PRODUCT_SAVE', p, 'define-' + id);
  s.run('STOCK_RECEIVE', {...confirmed, product_id: id, expected_product_revision: 1, expected_revision: 1, quantity: 5, evidence_reference: 'Isolated fixture goods receipt'}, 'receive-' + id);
  return p;
}
const reserve = (order = 'order-one', extra = {}) => ({...confirmed, order_id: order, currency: 'EUR', customer_reference: 'PRIVATE standalone sales customer', expected_revision: 0, lines: [{product_id: 'shirt-blue-m', quantity: 3, expected_product_revision: 1, expected_inventory_revision: 2}], ...extra});

test('native reservation, fulfilment and partial returns preserve exact money, locked prices and conserved inventory', () => {
  const s = fixture(); seed(s);
  const input = reserve(); let result = s.run('ORDER_RESERVE', input, 'reserve');
  assert.deepEqual(result.record.totals, {net_minor: 303, tax_minor: 64, gross_minor: 367});
  assert.equal(s.read('commerce_inventory', 'shirt-blue-m').available, 2);
  assert.equal(result.record.financial_status, 'UNPOSTED'); assert.equal(result.payment_verified, false);
  const before = s.state(); assert.equal(s.run('ORDER_RESERVE', input, 'reserve').deduplicated, true); assert.equal(s.state(), before);
  s.run('PRODUCT_SAVE', product('shirt-blue-m', {expected_revision: 1, unit_price_minor: 500}), 'price-change');
  assert.equal(s.read('commerce_orders', 'order-one').lines[0].unit_price_minor, 101);
  result = s.run('ORDER_FULFILL', {...confirmed, order_id: 'order-one', expected_revision: 1, evidence_reference: 'User-attested fixture dispatch'}, 'ship');
  assert.equal(result.record.status, 'FULFILLED'); assert.equal(result.external_dispatch, false);
  assert.equal(s.read('commerce_inventory', 'shirt-blue-m').on_hand, 2); assert.equal(s.read('commerce_inventory', 'shirt-blue-m').reserved, 0);
  const returned = {...confirmed, order_id: 'order-one', expected_revision: 2, evidence_reference: 'Fixture returned unit', lines: [{product_id: 'shirt-blue-m', quantity: 1, disposition: 'RESTOCK'}]};
  result = s.run('ORDER_RETURN', returned, 'return-one'); assert.deepEqual(result.record.returned_totals, {net_minor: 101, tax_minor: 21, gross_minor: 122});
  result = s.run('ORDER_RETURN', {...returned, expected_revision: 3, lines: [{product_id: 'shirt-blue-m', quantity: 2, disposition: 'QUARANTINE'}]}, 'return-rest');
  assert.equal(result.record.status, 'RETURNED'); assert.deepEqual(result.record.returned_totals, result.record.totals);
  const stock = s.read('commerce_inventory', 'shirt-blue-m'); assert.equal(stock.on_hand, 3); assert.equal(stock.quarantined, 2); assert.equal(stock.available, 3);
  assert.throws(() => s.run('ORDER_RETURN', {...returned, expected_revision: 4}, 'over-return'), {code: 'commerce_transition_invalid'});
  const proof = commerce.recover(s.domain, s.ctx, s.seller, {operation: 'ORDER_RESERVE', input, request_id: 'reserve', confirm: true});
  assert.equal(proof.result_snapshot.status, 'RESERVED'); assert.equal(proof.record.status, 'RETURNED'); assert.equal(proof.result_is_current, false);
  s.restart(); assert.equal(s.run('ORDER_RESERVE', input, 'reserve').deduplicated, true); assert.equal(s.read('commerce_inventory', 'shirt-blue-m').on_hand, 3);
});

test('overselling, stale prices, mixed currencies and later failing order lines have no partial effects', () => {
  const s = fixture(); seed(s); seed(s, 'other', {currency: 'USD'});
  const baseline = s.state();
  for (const input of [reserve('oversell', {lines: [{product_id: 'shirt-blue-m', quantity: 6, expected_product_revision: 1, expected_inventory_revision: 2}]}), reserve('stale', {lines: [{product_id: 'shirt-blue-m', quantity: 1, expected_product_revision: 9, expected_inventory_revision: 2}]}), reserve('mixed', {lines: [...reserve().lines, {product_id: 'other', quantity: 1, expected_product_revision: 1, expected_inventory_revision: 2}]})]) {
    assert.throws(() => s.run('ORDER_RESERVE', input, input.order_id)); assert.equal(s.state(), baseline);
  }
  s.run('ORDER_RESERVE', reserve(), 'reserve');
  const reserved = s.state(); s.fail(true); assert.throws(() => s.run('ORDER_FULFILL', {...confirmed, order_id: 'order-one', expected_revision: 1, evidence_reference: 'Fixture'}, 'ship-failed'), /atomic persistence/); s.fail(false); assert.equal(s.state(), reserved);
  assert.equal(s.read('commerce_orders', 'order-one').status, 'RESERVED'); assert.equal(s.read('commerce_inventory', 'shirt-blue-m').reserved, 3);
  s.run('ORDER_CANCEL', {...confirmed, order_id: 'order-one', expected_revision: 1}, 'cancel');
  assert.equal(s.read('commerce_inventory', 'shirt-blue-m').available, 5);
});

test('unseen recovery closes the exact request and retained receipts cannot be tampered or reused with different input', () => {
  const s = fixture(); const input = seed(s);
  const pending = reserve(); assert.equal(commerce.recover(s.domain, s.ctx, s.seller, {operation: 'ORDER_RESERVE', input: pending, request_id: 'closed', confirm: true}).state, 'NOT_APPLIED');
  assert.throws(() => s.run('ORDER_RESERVE', pending, 'closed'), {code: 'commerce_request_abandoned'});
  assert.throws(() => s.run('PRODUCT_SAVE', {...input, name: 'changed'}, 'define-shirt-blue-m'), {code: 'commerce_request_conflict'});
  const receipt = s.adapter.bucket(s.ctx, commerce.OPERATIONS).find(r => r.key === 'define-shirt-blue-m'); receipt.effects[0].snapshot.name = 'Injected';
  assert.throws(() => s.run('PRODUCT_SAVE', input, 'define-shirt-blue-m'), {code: 'commerce_receipt_invalid'});
});

test('normal module, record, export and replay access apply and generic writes cannot bypass the commerce ledger', () => {
  const s = fixture(); seed(s); s.run('ORDER_RESERVE', reserve(), 'reserve');
  const stranger = {id: 'other', roles: ['SALES']}; assert.throws(() => s.read('commerce_orders', 'order-one', stranger), {statusCode: 404});
  assert.equal(s.domain.list(s.ctx, stranger, 'commerce_orders').total, 0);
  assert.throws(() => s.domain.save(s.ctx, s.seller, 'commerce_inventory', {title: 'Bypass'}), {code: 'commerce_action_required'});
  assert.throws(() => s.run('ORDER_CANCEL', {...confirmed, order_id: 'order-one', expected_revision: 1}, 'viewer', {id: 'seller', roles: ['VIEWER']}), {statusCode: 403});
  s.domain.bucket(s.ctx, 'commerce_products')[0].owner_id = stranger.id;
  assert.equal(s.domain.list(s.ctx, s.seller, 'commerce_orders').total, 0);
  assert.equal(s.domain.export(s.ctx, {...s.seller, permissions: ['sales:export']}).collections.commerce_orders.length, 0);
  assert.throws(() => s.run('ORDER_RESERVE', reserve(), 'reserve'), {statusCode: 404});
  s.resolver.configure(s.ctx, s.admin, {entitlements: ['sales'], capability_flags: {'sales:quotes': false}, expected_revision: s.resolver.profile(s.ctx).revision});
  assert.throws(() => commerce.list(s.domain, s.ctx, s.admin, 'commerce_inventory'), {code: 'capability_disabled'});
});

test('large exact amounts never round through floating point and overflow rejects before stock effects', () => {
  const s = fixture(); seed(s, 'shirt-blue-m', {unit_price_minor: Number.MAX_SAFE_INTEGER, tax_rate_bps: 0});
  const before = s.state(); assert.throws(() => s.run('ORDER_RESERVE', reserve(), 'overflow'), {code: 'commerce_amount_overflow'}); assert.equal(s.state(), before);
  assert.equal(s.run('ORDER_RESERVE', reserve('one', {lines: [{product_id: 'shirt-blue-m', quantity: 1, expected_product_revision: 1, expected_inventory_revision: 2}]}), 'exact').record.totals.gross_minor, Number.MAX_SAFE_INTEGER);
});
