'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const {fixture, input, posted} = require('../zero-evaluation/finance-mutation-fixture');
const {OUTBOX} = require('../finance-request-durability');
const key = idempotencyKey => ({idempotencyKey});

test('invoice request survives random line IDs, reordered JSON and restart without a second invoice or event', () => {
  const f = fixture(), payload = input(f), options = key('invoice-durable-once');
  const first = f.core.createInvoice(f.ctx, f.actor, payload, options), events = f.events.size;
  f.restart();
  const reordered = Object.fromEntries(Object.entries(payload).reverse());
  const result = f.core.createInvoice(f.ctx, f.actor, reordered, options);
  assert.equal(result.invoice.id, first.invoice.id); assert.deepEqual(result.lines, first.lines);
  assert.equal(result.idempotent_replay, true); assert.equal(result.replay_semantics, 'ORIGINAL_COMMITTED_RESULT_NOT_CURRENT_STATE');
  assert.equal(f.rows('invoices').length, 1); assert.equal(f.rows('invoice_lines').length, 1); assert.equal(f.events.size, events);
  assert.throws(() => f.core.createInvoice(f.ctx, f.actor, {...payload, customer_name: 'Changed customer'}, options), {code: 'finance_idempotency_conflict'});
  assert.throws(() => f.core.createInvoice(f.ctx, f.actor, payload, key('different-invoice-request')), {code: 'finance_invoice_number_duplicate'});
});

test('invoice creation, posting, payment, reconciliation, chart and reversal roll back all native effects before any event escapes', () => {
  for (const operation of ['create', 'post', 'payment', 'reconcile', 'chart', 'reverse']) {
    const f = fixture(); f.acknowledge('unavailable');
    const draft = f.core.createInvoice(f.ctx, f.actor, input(f));
    let invoice = draft.invoice, journal;
    if (['payment', 'reconcile', 'reverse'].includes(operation)) {const result = f.core.postInvoice(f.ctx, f.actor, invoice.id); invoice = result.invoice; journal = result.journal;}
    let transaction, entity;
    if (operation === 'reconcile') transaction = f.core.importBankTransaction(f.ctx, f.actor, {legal_entity_id: f.entity.id, external_id: 'fixture-bank-row', date: '2026-09-26', amount_cents: 12100});
    if (operation === 'chart') entity = f.core.createLegalEntity(f.ctx, f.actor, {name: 'New chart fixture', legal_form: 'BV'});
    const run = () => {
      switch (operation) {
        case 'create': return f.core.createInvoice(f.ctx, f.actor, input(f, 'FIXTURE-NEW'), key('atomic-create-invoice'));
        case 'post': return f.core.postInvoice(f.ctx, f.actor, invoice.id, key('atomic-post-invoice'));
        case 'payment': return f.core.recordPayment(f.ctx, f.actor, {invoice_id: invoice.id, amount_cents: 12100, date: '2026-09-26'}, key('atomic-payment'));
        case 'reconcile': return f.core.confirmReconciliation(f.ctx, f.actor, {bank_transaction_id: transaction.id, invoice_id: invoice.id}, key('atomic-reconcile'));
        case 'chart': return f.core.bootstrapDutchChart(f.ctx, f.actor, entity.id, key('atomic-chart'));
        case 'reverse': return f.core.reverseJournal(f.ctx, f.actor, journal.entry.id, 'Explicit correction', {date: '2026-09-26', ...key('atomic-reverse')});
      }
    };
    const before = f.snapshot(), events = f.emitted.length; f.failNext();
    assert.throws(run, /injected durable persistence failure/, operation);
    assert.equal(f.snapshot(), before, operation); assert.equal(f.emitted.length, events, operation);
    const commits = f.count(), result = run();
    assert.equal(f.count(), commits + 1, 'One atomic native commit with events queued: ' + operation);
    if (operation === 'chart') assert.equal(Array.isArray(result) && result.length, 9);
    const after = f.snapshot(); f.restart(); const replay = run(); assert.equal(f.snapshot(), after, 'Replay does not reapply ' + operation);
    if (operation === 'chart') assert.equal(Array.isArray(replay) && replay.length, 9, 'The native chart contract remains an array on replay');
  }
});

test('lost acknowledgement of a full payment replays after PAID and period close, with current role checked first', () => {
  const f = fixture(), invoice = posted(f).invoice;
  const payload = {invoice_id: invoice.id, amount_cents: 12100, date: '2026-09-26', reference: 'USER-RECORDED'}, options = key('paid-invoice-once');
  const first = f.core.recordPayment(f.ctx, f.actor, payload, options);
  assert.equal(first.invoice.status, 'PAID'); f.rows('fiscal_periods')[0].status = 'CLOSED'; f.adapter.persist(); f.restart();
  const snapshot = f.snapshot();
  assert.equal(f.core.recordPayment(f.ctx, f.actor, payload, options).payment.id, first.payment.id);
  assert.equal(f.snapshot(), snapshot); assert.equal(f.rows('payments').length, 1); assert.equal(f.rows('journal_entries').length, 2);
  assert.throws(() => f.core.recordPayment(f.ctx, f.actor, {...payload, reference: 'Different reference'}, options), {code: 'finance_idempotency_conflict'});
  const originalPost = f.core.postInvoice(f.ctx, f.actor, invoice.id);
  assert.equal(originalPost.invoice.status, 'POSTED'); assert.equal(originalPost.replay_semantics, 'ORIGINAL_COMMITTED_RESULT_NOT_CURRENT_STATE');
  assert.equal(f.rows('invoices')[0].status, 'PAID');
  f.actor.roles = ['VIEWER'];
  assert.throws(() => f.core.recordPayment(f.ctx, f.actor, payload, options), {statusCode: 403}); assert.equal(f.snapshot(), snapshot);
});

test('same unkeyed partial payment creates separate matching journals, and one bank observation cannot fund two invoices', () => {
  const f = fixture(), one = posted(f, 'ONE').invoice, two = posted(f, 'TWO').invoice;
  const partial = {invoice_id: one.id, amount_cents: 100, date: '2026-09-26', reference: 'Two explicit manual records'};
  const a = f.core.recordPayment(f.ctx, f.actor, partial), b = f.core.recordPayment(f.ctx, f.actor, partial);
  assert.notEqual(a.journal.entry.id, b.journal.entry.id); assert.notEqual(a.payment.id, b.payment.id);
  const tx = f.core.importBankTransaction(f.ctx, f.actor, {legal_entity_id: f.entity.id, external_id: 'bank-once', date: '2026-09-26', amount_cents: 100});
  f.core.recordPayment(f.ctx, f.actor, {...partial, bank_transaction_id: tx.id}, key('payment-bank-first'));
  const before = f.snapshot();
  assert.throws(() => f.core.recordPayment(f.ctx, f.actor, {...partial, invoice_id: two.id, bank_transaction_id: tx.id}, key('payment-bank-second')), {code: 'finance_bank_transaction_used'});
  assert.equal(f.snapshot(), before);
});

test('native event acknowledgement loss keeps the original event ID and actor through retry and restart', () => {
  for (const failure of ['transport', 'ack-persist']) {
    const f = fixture();
    if (failure === 'transport') f.acknowledge(false); else f.failOffset(2);
    const payload = input(f), options = key('invoice-event-once'), first = f.core.createInvoice(f.ctx, f.actor, payload, options);
    assert.equal(first.event_delivery, 'QUEUED_RETRY'); assert.equal(f.events.size, 1);
    const event = [...f.events.values()][0]; assert.equal(event.actor_id, f.actor.id);
    f.restart(); f.acknowledge(true);
    const replay = f.core.createInvoice(f.ctx, f.actor, payload, options);
    assert.equal(replay.event_delivery, 'DELIVERED'); assert.equal(f.events.size, 1);
    assert.equal(f.adapter.bucket(f.ctx, OUTBOX)[0].event.event_id, event.event_id);
    assert.equal(f.rows('invoices').length, 1);
  }
});

test('receipt retention crosses the old 10,000 boundary and fails closed at capacity without evicting original proof', () => {
  const f = fixture(), payload = input(f), options = key('retained-invoice-request');
  const original = f.core.createInvoice(f.ctx, f.actor, payload, options), rows = f.rows('idempotency'), receipt = rows[0];
  while (rows.length < 10001) rows.push({digest: 'historical-' + rows.length, signature: 'historical', result: {historical: true}});
  assert.equal(f.core.createInvoice(f.ctx, f.actor, payload, options).invoice.id, original.invoice.id);
  const created = f.core.createInvoice(f.ctx, f.actor, input(f, 'AFTER-OLD-LIMIT'), key('past-old-finance-limit'));
  assert.ok(created.invoice.id); assert.equal(rows[0], receipt);
  while (rows.length < 100000) rows.push({digest: 'historical-' + rows.length, signature: 'historical', result: {historical: true}});
  const count = f.rows('invoices').length, emitted = f.emitted.length, writes = f.count();
  assert.throws(() => f.core.createInvoice(f.ctx, f.actor, input(f, 'OVER-CAPACITY'), key('over-finance-capacity')), {code: 'finance_idempotency_capacity', statusCode: 507});
  assert.equal(f.rows('invoices').length, count); assert.equal(f.emitted.length, emitted); assert.equal(f.count(), writes); assert.equal(rows[0], receipt);
  assert.equal(f.core.createInvoice(f.ctx, f.actor, payload, options).invoice.id, original.invoice.id);
});

test('corrupt or incompatible historical receipts remain present and cannot invent a successful mutation', () => {
  for (const change of ['result', 'version', 'legacy-signature']) {
    const f = fixture(), payload = input(f), options = key('receipt-integrity-fixture');
    f.core.createInvoice(f.ctx, f.actor, payload, options); const receipt = f.rows('idempotency')[0];
    if (change === 'result') receipt.result.invoice.gross_cents++;
    else if (change === 'version') receipt.receipt_version = 27;
    else {delete receipt.receipt_version; receipt.signature = 'old-random-line-signature';}
    const before = f.snapshot();
    assert.throws(() => f.core.createInvoice(f.ctx, f.actor, payload, options), error => ['finance_idempotency_integrity', 'finance_idempotency_conflict'].includes(error.code));
    assert.equal(f.snapshot(), before);
  }
});

test('invoice decimal half-up arithmetic preserves 0.29 × 50 and rejects overflow before any durable write', () => {
  const f = fixture(), payload = input(f); payload.lines = [{description: 'Exact decimal line', quantity: 0.29, unit_price_cents: 50, vat_rate: 0}];
  const result = f.core.createInvoice(f.ctx, f.actor, payload, key('decimal-invoice-exact'));
  assert.equal(result.invoice.net_cents, 15); assert.equal(result.invoice.gross_cents, 15);
  const before = f.snapshot();
  const tooLarge = {...input(f, 'OVERFLOW'), lines: [{description: 'Too large', quantity: 1, unit_price_cents: Number.MAX_SAFE_INTEGER, vat_rate: 21}]};
  assert.throws(() => f.core.createInvoice(f.ctx, f.actor, tooLarge, key('decimal-invoice-overflow')), {code: 'finance_amount_invalid'});
  const imprecise = {...input(f, 'PRECISION'), lines: [{description: 'Cannot retain this quantity', quantity: '1.00000000000000000001', unit_price_cents: 100, vat_rate: 0}]};
  assert.throws(() => f.core.createInvoice(f.ctx, f.actor, imprecise, key('decimal-quantity-precision')), {code: 'finance_amount_invalid'});
  assert.equal(f.snapshot(), before);
});

test('credit notes cannot be silently booked as incoming sales payments', () => {
  const f = fixture(), sale = posted(f).invoice;
  const note = f.core.createCreditNote(f.ctx, f.actor, sale.id, {invoice_number: 'CREDIT-FIXTURE', invoice_date: '2026-09-26', supply_date: '2026-09-26', due_date: '2026-09-26'});
  f.core.postInvoice(f.ctx, f.actor, note.invoice.id); const before = f.snapshot();
  assert.throws(() => f.core.recordPayment(f.ctx, f.actor, {invoice_id: note.invoice.id, amount_cents: 12100, date: '2026-09-26'}, key('credit-note-payment')), {code: 'finance_credit_payment_requires_refund'});
  assert.equal(f.snapshot(), before);
});
