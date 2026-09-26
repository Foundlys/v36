'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const {fixture} = require('../zero-evaluation/commerce-finance-fixture');
const commerce = require('../sales-commerce');

test('native order billing uses locked order cents, actual CRM identity and supplier source, then links one invoice atomically', () => {
  const f = fixture();
  f.run('PRODUCT_SAVE', {product_id: 'fixture-product', sku: 'FIXTURE', name: 'Later catalog price', currency: 'EUR', unit_price_minor: 900, tax_rate_bps: 900, expected_revision: 1}, 'change-catalog');
  const action = f.command(), preview = f.finance.previewInvoiceAction(f.ctx, f.actor, {operation: action.operation, input: action.input});
  assert.equal(preview.ready, true); assert.equal(preview.summary.amount_cents, 367);
  assert.equal(preview.prepared_invoice.customer_name, f.contact.name); assert.equal(preview.prepared_invoice.customer_address, f.contact.billing_address);
  assert.equal(preview.prepared_invoice.lines[0].unit_price_cents, 101); assert.equal(preview.prepared_invoice.lines[0].vat_rate, 21);
  const result = f.finance.executeInvoiceAction(f.ctx, f.actor, action);
  assert.equal(result.current_invoice.gross_cents, 367); assert.equal(result.current_invoice.status, 'DRAFT'); assert.equal(result.financial_posting_performed, false);
  assert.equal(f.order().invoice_id, result.current_invoice.id); assert.equal(f.order().financial_status, 'INVOICE_LINKED'); assert.equal(f.order().revision, 2);
  assert.equal(f.order().customer_snapshot, undefined, 'Sales does not receive an unnecessary private CRM snapshot');
  assert.equal(f.rows('journal_entries').length, 0);
  f.restart(); const before = f.snapshot();
  const replay = f.finance.executeInvoiceAction(f.ctx, f.actor, action);
  assert.equal(replay.deduplicated, true); assert.equal(f.rows('invoices').length, 1); assert.equal(f.snapshot(), before);
});

test('an injected commit failure restores invoice, lines, Sales link, both outboxes, audit and confirmed receipt together', () => {
  const f = fixture(), action = f.command(), before = f.snapshot(), events = f.emitted.length;
  f.fail(true); assert.throws(() => f.finance.executeInvoiceAction(f.ctx, f.actor, action), /cross-module persistence failure/); f.fail(false);
  assert.equal(f.snapshot(), before); assert.equal(f.emitted.length, events); assert.equal(f.order().financial_status, 'UNPOSTED'); assert.equal(f.rows('invoices').length, 0);
  const count = f.persisted.length, result = f.finance.executeInvoiceAction(f.ctx, f.actor, action);
  const first = new Map(JSON.parse(f.persisted[count])), bucket = name => first.get(JSON.stringify([f.ctx.tenant_id, f.ctx.dealer_id, name]));
  assert.equal(bucket('finance:invoices')[0].id, result.current_invoice.id);
  assert.equal(bucket('sales:commerce_orders')[0].invoice_id, result.current_invoice.id);
  assert.equal(bucket('finance:action_requests')[0].status, 'COMMITTED');
  assert.ok(bucket('finance:mutation_event_outbox').some(row => row.status === 'PENDING'));
  assert.ok(bucket('sales:outbox').some(row => row.status === 'PENDING'));
});

test('changed CRM source, forged price inputs, current owner loss and revoked module capabilities cannot release or create billing results', () => {
  const f = fixture(), action = f.command();
  f.crm.update(f.ctx, f.actor, 'contacts', f.contact.id, {billing_address: 'New native billing address'});
  const before = f.snapshot(); assert.throws(() => f.finance.executeInvoiceAction(f.ctx, f.actor, action), {code: 'finance_action_source_changed'}); assert.equal(f.snapshot(), before);
  assert.throws(() => f.finance.previewInvoiceAction(f.ctx, f.actor, {operation: action.operation, input: {...action.input, unit_price_cents: 1}}), {code: 'finance_commerce_input_invalid'});
  const current = f.command(); f.finance.executeInvoiceAction(f.ctx, f.actor, current);
  f.crm.update(f.ctx, f.admin, 'contacts', f.contact.id, {owner_id: 'other-owner'});
  assert.throws(() => f.finance.recoverInvoiceAction(f.ctx, f.actor, current), {statusCode: 404});
  f.resolver.configure(f.ctx, f.admin, {entitlements: ['finance', 'sales', 'crm'], capability_flags: {'sales:quotes': false}, expected_revision: 1});
  assert.throws(() => f.finance.recoverInvoiceAction(f.ctx, f.actor, current), {code: 'capability_disabled'});
  assert.ok(!f.resolver.resolve(f.ctx, f.actor).tools.includes('finance_commerce_invoice_create_execute'));
});

test('linked orders require financial review for cancellation/returns and retained invoice results reflect later native posting and fulfilment', () => {
  const f = fixture(), action = f.command(), created = f.finance.executeInvoiceAction(f.ctx, f.actor, action), id = created.current_invoice.id;
  const before = f.snapshot(); assert.throws(() => f.run('ORDER_CANCEL', {order_id: 'fixture-order', expected_revision: 2}, 'cancel-linked'), {code: 'commerce_linked_invoice_requires_correction'}); assert.equal(f.snapshot(), before);
  f.finance.postInvoice(f.ctx, f.actor, id);
  f.run('ORDER_FULFILL', {order_id: 'fixture-order', expected_revision: 2, evidence_reference: 'User-attested receipt'}, 'fulfil-linked');
  f.run('ORDER_RETURN', {order_id: 'fixture-order', expected_revision: 3, evidence_reference: 'User-attested return', lines: [{product_id: 'fixture-product', quantity: 1, disposition: 'RESTOCK'}]}, 'return-linked');
  const r = f.finance.recoverInvoiceAction(f.ctx, f.actor, action);
  assert.equal(r.original_result.invoice.status, 'DRAFT'); assert.equal(r.current_invoice.status, 'POSTED'); assert.equal(r.original_result_is_current, false);
  assert.equal(r.current_result.commerce_link.order.financial_followup, 'RETURN_REVIEW_REQUIRED');
  assert.equal(r.current_result.commerce_link.order.financial_status, 'INVOICE_LINKED');
  assert.equal(f.rows('payments').length, 0); assert.equal(f.rows('invoices').length, 1);
});

test('absent billing recovery blocks late execution and a mismatched adapter cannot claim an atomic cross-module invoice', () => {
  const f = fixture(), action = f.command();
  assert.equal(f.finance.recoverInvoiceAction(f.ctx, f.actor, action).state, 'NOT_APPLIED'); f.restart();
  assert.throws(() => f.finance.executeInvoiceAction(f.ctx, f.actor, action), {code: 'finance_action_abandoned'});
  assert.equal(f.order().invoice_id, undefined); assert.equal(f.rows('invoices').length, 0);
  const old = f.sales.adapter.bucket; f.sales.adapter.bucket = (ctx, scope) => scope === 'finance:invoices' ? [] : old(ctx, scope);
  assert.throws(() => f.finance.previewInvoiceAction(f.ctx, f.actor, {operation: action.operation, input: action.input}), {code: 'finance_commerce_transaction_unavailable'});
});

test('cross-module billing requires CRM read authority without silently requiring or granting CRM writes', () => {
  const f = fixture(); f.actor.roles = ['ACCOUNTANT']; f.actor.permissions = ['sales:read', 'sales:write', 'crm:read', 'crm:read_assigned'];
  assert.ok(f.resolver.resolve(f.ctx, f.actor).tools.includes('finance_commerce_invoice_create_execute'));
  f.resolver.assertTool(f.ctx, f.actor, 'finance_commerce_invoice_create_execute');
  const action = f.command(); assert.equal(f.finance.executeInvoiceAction(f.ctx, f.actor, action).current_invoice.gross_cents, 367);
  assert.throws(() => f.crm.update(f.ctx, f.actor, 'contacts', f.contact.id, {name: 'Not authorized'}), {statusCode: 403});
});
