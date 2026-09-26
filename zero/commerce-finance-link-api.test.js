'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), crypto = require('node:crypto'), fs = require('node:fs'), path = require('node:path');
const {fixture} = require('../zero-evaluation/fixture');
test('actual CRM, Sales, Finance and ZERO bind one native order invoice through source changes, reply loss, restart, payment and revoked source access', async () => {
  const s = await fixture({NODE_OPTIONS: '--require ' + require.resolve('../zero-evaluation/finance-http-faults')});
  try {
    assert.equal((await s.request('/api/composition', 'PUT', {entitlements: ['crm', 'sales', 'finance'], expected_revision: 0})).status, 200);
    const member = await s.enroll('native.commerce.accountant', ['SALES', 'ACCOUNTANT']);
    const call = (route, method = 'GET', body, headers = {}) => s.request(route, method, body, member.cookie, headers);
    const contact = await call('/api/crm/contacts', 'POST', {name: 'PRIVATE REAL CRM FIXTURE', billing_address: 'PRIVATE CRM BILLING FIXTURE'});
    assert.equal(contact.status, 201, JSON.stringify(contact.body)); const customer = contact.body.record;
    const entity = await call('/api/finance/legal-entities', 'POST', {name: 'Native supplier fixture', address: 'Native supplier address', vat_id: 'FIXTURE-VAT', kvk_number: 'FIXTURE-KVK', legal_form: 'BV', currency: 'EUR'});
    assert.equal(entity.status, 201, JSON.stringify(entity.body));
    assert.equal((await call('/api/finance/periods', 'POST', {legal_entity_id: entity.body.id, start_date: '2026-01-01', end_date: '2026-12-31'})).status, 201);
    assert.equal((await call('/api/finance/legal-entities/' + entity.body.id + '/bootstrap-chart', 'POST', {})).status, 201);
    const commerce = (operation, input) => call('/api/sales/commerce/actions/' + operation, 'POST', {...input, confirm: true, reason: 'Native integration fixture'}, {'idempotency-key': crypto.randomUUID()});
    assert.equal((await commerce('PRODUCT_SAVE', {product_id: 'http-product', sku: 'HTTP-REAL-NATIVE', name: 'Actual native product fixture', unit_price_minor: 101, tax_rate_bps: 2100, currency: 'EUR', expected_revision: 0})).status, 200);
    assert.equal((await commerce('STOCK_RECEIVE', {product_id: 'http-product', quantity: 3, expected_revision: 1, expected_product_revision: 1, evidence_reference: 'Explicit fixture stock receipt'})).status, 200);
    assert.equal((await commerce('ORDER_RESERVE', {order_id: 'http-order', currency: 'EUR', customer_reference: 'Original unverified reference', expected_revision: 0, lines: [{product_id: 'http-product', quantity: 3, expected_product_revision: 1, expected_inventory_revision: 2}]})).status, 200);
    const input = {order_id: 'http-order', contact_id: customer.id, legal_entity_id: entity.body.id, invoice_number: 'HTTP-COMMERCE-001', invoice_date: '2026-09-26', supply_date: '2026-09-26', due_date: '2026-10-26'};
    const turn = (operation, value) => ({message: 'Verwerk de expliciet gekozen native orderfactuur', conversation_id: crypto.randomUUID(), turn_id: crypto.randomUUID(), client_context: {finance_action: {operation, input: value}}});
    const preview = await call('/api/zero/turn', 'POST', turn('COMMERCE_INVOICE_CREATE_PREVIEW', input));
    assert.equal(preview.status, 200, JSON.stringify(preview.body)); assert.equal(preview.body.finance_data.ready, true); assert.equal(preview.body.finance_data.prepared_invoice.customer_name, customer.name);
    const changed = await call('/api/crm/contacts/' + customer.id, 'PATCH', {billing_address: 'PRIVATE CURRENT CRM BILLING'}, {'if-match': '"1"', 'idempotency-key': 'native-billing-source-change'});
    assert.equal(changed.status, 200, JSON.stringify(changed.body));
    const stale = {input, request_id: 'native-commerce-invoice-once', expected_source_hash: preview.body.finance_data.source_hash, confirm: true, reason: 'Confirm current real native sources'};
    assert.equal((await call('/api/zero/turn', 'POST', turn('COMMERCE_INVOICE_CREATE_EXECUTE', stale))).status, 409);
    assert.equal((await call('/api/finance/records/invoices')).body.total, 0);
    const current = await call('/api/finance/invoice-actions/preview', 'POST', {operation: 'COMMERCE_INVOICE_CREATE', input});
    assert.equal(current.status, 200); assert.equal(current.body.ready, true);
    const confirmed = {...stale, expected_source_hash: current.body.source_hash}, createTurn = turn('COMMERCE_INVOICE_CREATE_EXECUTE', confirmed);
    await assert.rejects(call('/api/zero/turn', 'POST', createTurn, {'x-fixture-finance-drop': 'committed-reply'}));
    await s.stop(); await s.start(); member.cookie = await s.login(member);
    const replay = await call('/api/zero/turn', 'POST', createTurn);
    assert.equal(replay.status, 200, JSON.stringify(replay.body)); assert.equal(replay.body.finance_data.deduplicated, true); assert.equal(replay.body.verification.financial_posting_performed, false);
    const invoice = replay.body.finance_data.current_invoice; assert.equal(invoice.gross_cents, 367); assert.equal(invoice.customer_address, 'PRIVATE CURRENT CRM BILLING');
    const order = await call('/api/sales/commerce/commerce_orders/http-order'); assert.equal(order.status, 200); assert.equal(order.body.record.invoice_id, invoice.id); assert.equal(order.body.record.financial_status, 'INVOICE_LINKED');
    assert.equal((await call('/api/finance/records/invoices')).body.total, 1);
    async function action(operation, value) {
      const prepared = await call('/api/finance/invoice-actions/preview', 'POST', {operation, input: value}); assert.equal(prepared.status, 200); assert.equal(prepared.body.ready, true, JSON.stringify(prepared.body));
      const result = await call('/api/zero/turn', 'POST', turn(operation + '_EXECUTE', {input: value, expected_source_hash: prepared.body.source_hash, confirm: true, reason: 'Explicit internal native booking', request_id: crypto.randomUUID()}));
      assert.equal(result.status, 200, JSON.stringify(result.body)); return result.body;
    }
    await action('INVOICE_POST', {invoice_id: invoice.id}); const paid = await action('PAYMENT_RECORD', {invoice_id: invoice.id, amount_cents: 367, date: '2026-09-26'});
    assert.equal(paid.finance_data.current_invoice.status, 'PAID'); assert.equal(paid.verification.external_payment_performed, false);
    const recovered = await call('/api/zero/turn', 'POST', turn('COMMERCE_INVOICE_CREATE_RECOVER', confirmed));
    assert.equal(recovered.body.finance_data.original_result.invoice.status, 'DRAFT'); assert.equal(recovered.body.finance_data.current_invoice.status, 'PAID'); assert.equal(recovered.body.finance_data.original_result_is_current, false);
    assert.equal((await call('/api/finance/records/payments')).body.total, 1); assert.equal((await call('/api/finance/records/journal_entries')).body.total, 2);
    const reports = await call('/api/finance/reports'); assert.equal(reports.body.profit_and_loss.revenue_cents, 303); assert.equal(reports.body.vat_summary.position_cents, 64);
    assert.ok(!JSON.stringify((await call('/api/zero/conversation/' + createTurn.conversation_id)).body).includes('PRIVATE CURRENT CRM BILLING'));
    assert.ok(!fs.readFileSync(path.join(s.dir, 'foundly-core-state.json'), 'utf8').includes('PRIVATE CURRENT CRM BILLING'));
    assert.equal((await s.request('/api/composition', 'PUT', {entitlements: ['crm', 'sales', 'finance'], capability_flags: {'crm:contacts': false}, expected_revision: 1})).status, 200);
    assert.equal((await call('/api/zero/turn', 'POST', createTurn)).status, 403);
    assert.ok(!(await call('/api/zero/status')).body.tools.some(tool => tool.tool_id.startsWith('finance_commerce_invoice_create')));
    const salesOnly = await call('/api/sales/commerce/commerce_orders/http-order'); assert.equal(salesOnly.status, 200); assert.ok(!JSON.stringify(salesOnly.body).includes('PRIVATE CURRENT CRM BILLING'));
  } finally {await s.close();}
});
