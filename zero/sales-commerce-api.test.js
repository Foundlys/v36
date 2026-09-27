'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const {fixture} = require('../zero-evaluation/fixture');
test('actual commerce HTTP and structured ZERO share current permissions, encrypted persistence and one native order', async () => {
  const s = await fixture();
  try {
    assert.equal((await s.request('/api/composition', 'PUT', {industry_id: 'GENERAL', entitlements: ['sales'], expected_revision: 0})).status, 200);
    const seller = await s.enroll('commerce.seller', ['SALES']), other = await s.enroll('commerce.other', ['SALES']);
    const input = {product_id: 'blue-m', sku: 'BLUE-M', name: 'PRIVATE fixture variant', attributes: {size: 'M'}, currency: 'EUR', unit_price_minor: 1299, tax_rate_bps: 2100, confirm: true, reason: 'Explicit fixture product', expected_revision: 0};
    const action = (operation, value, key) => s.request('/api/sales/commerce/actions/' + operation, 'POST', value, seller.cookie, {'idempotency-key': key});
    let result = await action('PRODUCT_SAVE', input, 'product'); assert.equal(result.status, 200, JSON.stringify(result.body));
    result = await action('STOCK_RECEIVE', {product_id: 'blue-m', expected_product_revision: 1, expected_revision: 1, quantity: 4, evidence_reference: 'Fixture goods receipt', confirm: true, reason: 'Confirm receipt'}, 'receipt'); assert.equal(result.status, 200, JSON.stringify(result.body));
    const order = {order_id: 'order-http', expected_revision: 0, currency: 'EUR', customer_reference: 'Fixture sales customer', lines: [{product_id: 'blue-m', quantity: 2, expected_product_revision: 1, expected_inventory_revision: 2}], confirm: true, reason: 'Confirm current stock and price'};
    const turn = {message: 'Reserveer de bevestigde order', conversation_id: crypto.randomUUID(), turn_id: crypto.randomUUID(), client_context: {sales_action: {operation: 'COMMERCE_ORDER_RESERVE', input: order, request_id: 'order-once'}}};
    result = await s.request('/api/zero/turn', 'POST', turn, seller.cookie); assert.equal(result.status, 200, JSON.stringify(result.body)); assert.equal(result.body.sales_data.record.status, 'RESERVED');
    assert.equal((await s.request('/api/zero/turn', 'POST', turn, seller.cookie)).body.sales_data.deduplicated, true);
    assert.equal((await s.request('/api/sales/commerce/commerce_inventory/blue-m', 'GET', undefined, seller.cookie)).body.record.reserved, 2);
    assert.equal((await s.request('/api/sales/commerce/commerce_orders/order-http', 'GET', undefined, other.cookie)).status, 404);
    assert.equal((await s.request('/api/sales/commerce_inventory/blue-m', 'PUT', {title: 'bypass', expected_revision: 3}, seller.cookie)).status, 422);
    assert.ok(!JSON.stringify((await s.request('/api/zero/conversation/' + turn.conversation_id, 'GET', undefined, seller.cookie)).body).includes('PRIVATE'));
    await s.stop(); await s.start(); seller.cookie = await s.login(seller);
    assert.equal((await s.request('/api/zero/turn', 'POST', turn, seller.cookie)).body.sales_data.deduplicated, true);
    assert.equal((await s.request('/api/sales/commerce/commerce_orders', 'GET', undefined, seller.cookie)).body.total, 1);
    const absent = {...order, order_id: 'order-never-applied'};
    const recovery = {message: 'Controleer de eerdere aanvraag', conversation_id: crypto.randomUUID(), turn_id: crypto.randomUUID(), client_context: {sales_action: {operation: 'COMMERCE_RECOVER', input: {operation: 'ORDER_RESERVE', input: absent, request_id: 'close-missing', confirm: true}}}};
    const recovered = await s.request('/api/zero/turn', 'POST', recovery, seller.cookie);
    assert.equal(recovered.status, 200, JSON.stringify(recovered.body)); assert.equal(recovered.body.sales_data.state, 'NOT_APPLIED'); assert.deepEqual(recovered.body.actions, [], 'Closing an unseen request is not a completed commerce operation');
    assert.equal((await action('ORDER_RESERVE', absent, 'close-missing')).status, 409);
    assert.equal((await s.request('/api/sales/commerce/commerce_inventory/blue-m', 'GET', undefined, seller.cookie)).body.record.reserved, 2);
    assert.equal((await s.request('/api/composition', 'PUT', {entitlements: ['sales'], capability_flags: {'sales:quotes': false}, expected_revision: 1})).status, 200);
    assert.equal((await s.request('/api/zero/turn', 'POST', turn, seller.cookie)).status, 403);
    assert.equal((await s.request('/api/sales/commerce/commerce_inventory', 'GET', undefined, seller.cookie)).status, 403);
    assert.ok(!(await s.request('/api/zero/status', 'GET', undefined, seller.cookie)).body.tools.some(t => t.tool_id.startsWith('sales_commerce_')));
  } finally { await s.close(); }
});
