'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const {fixture, posted} = require('../zero-evaluation/finance-mutation-fixture');
function setup(paid = 0) {
  const f = fixture(), sale = posted(f).invoice;
  if (paid) f.core.recordPayment(f.ctx, f.actor, {invoice_id: sale.id, amount_cents: paid, date: '2026-09-10', reference: 'Explicit internal receipt'});
  const draft = f.core.createCreditNote(f.ctx, f.actor, sale.id, {invoice_number: 'CREDIT-SETTLE-001', invoice_date: '2026-09-20', supply_date: '2026-09-01', due_date: '2026-09-20'}).invoice;
  const credit = f.core.postInvoice(f.ctx, f.actor, draft.id).invoice;
  return Object.assign(f, {sale, credit});
}
function payload(f, refund = false, amount = f.sale.gross_cents) {
  return {credit_note_id: f.credit.id, ...(!refund ? {invoice_id: f.sale.id} : {}), amount_cents: amount, currency: 'EUR', date: '2026-09-20', reference: 'Explicit internal ' + (refund ? 'refund booking' : 'credit allocation')};
}
function command(f, operation, input, request_id = 'confirmed-credit-settlement') {
  const value = {operation, input}, preview = f.core.previewInvoiceAction(f.ctx, f.actor, value);
  assert.equal(preview.ready, true, JSON.stringify(preview));
  return {...value, expected_source_hash: preview.source_hash, request_id, confirm: true, reason: 'Confirm exact source and amount'};
}
const invoice = (f, id) => f.rows('invoices').find(row => row.id === id);
const balance = (f, role) => {const account = f.rows('accounts').find(row => row.system_role === role); return f.rows('journal_lines').filter(row => row.account_id === account.id).reduce((sum, row) => sum + row.debit_cents - row.credit_cents, 0);};

test('full allocation closes the original receivable and credit without a payment or extra journal; receipt survives restart', () => {
  const f = setup(), request = command(f, 'CREDIT_ALLOCATE', payload(f)), before = f.rows('journal_entries').map(row => row.id);
  const first = f.core.executeInvoiceAction(f.ctx, f.actor, request);
  assert.equal(first.state, 'COMMITTED'); assert.equal(first.original_result_is_current, true); assert.equal(first.financial_posting_performed, false);
  assert.equal(first.current_invoice.status, 'SETTLED'); assert.equal(first.current_invoice.allocated_cents, 12100); assert.equal(first.current_invoice.refunded_cents, 0);
  assert.equal(first.current_result.related_invoice.status, 'SETTLED'); assert.equal(first.current_result.related_invoice.credited_cents, 12100); assert.equal(first.current_result.related_invoice.paid_cents, 0);
  assert.equal(first.current_invoice.outstanding_cents, 0); assert.equal(first.current_result.related_invoice.outstanding_cents, 0);
  assert.equal(first.current_result.settlement.kind, 'ALLOCATION'); assert.equal(first.current_result.settlement.journal_entry_id, null);
  assert.deepEqual(f.rows('journal_entries').map(row => row.id), before); assert.equal(f.rows('payments').length, 0); assert.equal(balance(f, 'AR'), 0);
  f.restart(); const replay = f.core.executeInvoiceAction(f.ctx, f.actor, request);
  assert.equal(replay.deduplicated, true); assert.equal(replay.current_result.settlement.id, first.current_result.settlement.id); assert.equal(f.rows('credit_settlements').length, 1);
  assert.throws(() => f.core.recoverInvoiceAction(f.ctx, {...f.actor, roles: ['VIEWER']}, request), {code: 'finance_forbidden'});
});
test('partial receipt is settled by allocation plus a separate outgoing refund journal, retaining actual incoming payment history', () => {
  const f = setup(6000);
  const allocated = f.core.allocateCredit(f.ctx, f.actor, payload(f, false, 6100));
  assert.equal(allocated.invoice.status, 'PARTIALLY_SETTLED'); assert.equal(allocated.invoice.outstanding_cents, 6000); assert.equal(allocated.related_invoice.status, 'SETTLED');
  const request = command(f, 'CREDIT_REFUND_RECORD', payload(f, true, 6000));
  const result = f.core.executeInvoiceAction(f.ctx, f.actor, request);
  assert.equal(result.current_invoice.status, 'SETTLED'); assert.equal(result.current_invoice.allocated_cents, 6100); assert.equal(result.current_invoice.refunded_cents, 6000);
  assert.equal(result.current_result.related_invoice.paid_cents, 6000); assert.equal(result.current_result.related_invoice.credited_cents, 6100);
  assert.equal(result.current_result.settlement.kind, 'INTERNAL_REFUND'); assert.equal(result.financial_posting_performed, true); assert.equal(result.external_payment_performed, false); assert.equal(result.bank_settlement_verified, false);
  assert.equal(f.rows('payments').length, 1); assert.equal(f.rows('credit_settlements').length, 2); assert.equal(f.rows('journal_entries').length, 4);
  assert.equal(balance(f, 'BANK'), 0); assert.equal(balance(f, 'AR'), 0); assert.equal(balance(f, 'REVENUE'), 0); assert.equal(balance(f, 'VAT_PAYABLE'), 0);
  const reports = f.core.reports(f.ctx, f.actor, {legal_entity_id: f.entity.id});
  assert.equal(reports.cash_flow.cash_balance_cents, 0); assert.equal(reports.cash_flow.credit_refunds.length, 1); assert.equal(reports.ar_aging.total_cents, 0);
  f.restart(); const replay = f.core.recoverInvoiceAction(f.ctx, f.actor, request);
  assert.equal(replay.original_result_is_current, true); assert.equal(f.rows('journal_entries').length, 4); assert.equal(f.rows('credit_settlements').length, 2);
});
test('partial allocation preserves collection and subsequent payment semantics, without rewriting legacy balances', () => {
  const f = setup(); delete invoice(f, f.sale.id).credited_cents; delete invoice(f, f.credit.id).allocated_cents; delete invoice(f, f.credit.id).refunded_cents;
  const result = f.core.allocateCredit(f.ctx, f.actor, payload(f, false, 6000));
  assert.equal(result.related_invoice.status, 'PARTIALLY_SETTLED'); assert.equal(result.related_invoice.outstanding_cents, 6100);
  const reminder = f.core.createCollectionAction(f.ctx, f.actor, {invoice_id: f.sale.id, reason: 'Remaining open balance'}); assert.equal(reminder.status, 'RECORDED_NOT_SENT');
  const value = {invoice_id: f.sale.id, amount_cents: 6100, currency: 'EUR', date: '2026-09-21'};
  assert.equal(f.core.previewInvoiceAction(f.ctx, f.actor, {operation: 'PAYMENT_RECORD', input: value}).ready, true);
  const paid = f.core.recordPayment(f.ctx, f.actor, value).invoice;
  assert.equal(paid.status, 'SETTLED'); assert.equal(paid.paid_cents, 6100); assert.equal(paid.credited_cents, 6000); assert.equal(paid.outstanding_cents, 0);
  const outstanding = f.core.counterpartyBalances(f.ctx, f.actor, {legal_entity_id: f.entity.id}); assert.equal(outstanding.items.length, 1); assert.equal(outstanding.items[0].direction, 'PAYABLE'); assert.equal(outstanding.items[0].outstanding_cents, 6100);
});
test('refunds require real recorded receipts on the chosen date and cannot consume the same amount twice', () => {
  for (const paid of [0, 6000]) {
    const f = setup(paid), before = f.snapshot();
    const p = f.core.previewInvoiceAction(f.ctx, f.actor, {operation: 'CREDIT_REFUND_RECORD', input: payload(f, true, 6001)});
    assert.equal(p.ready, false); assert.ok(p.blockers.includes('REFUND_EXCEEDS_RECORDED_RECEIPTS'));
    assert.throws(() => f.core.recordCreditRefund(f.ctx, f.actor, payload(f, true, 6001)), {code: 'finance_credit_settlement_not_ready'}); assert.equal(f.snapshot(), before);
  }
  const f = setup(6000); f.core.recordCreditRefund(f.ctx, f.actor, payload(f, true, 6000));
  const second = f.core.previewInvoiceAction(f.ctx, f.actor, {operation: 'CREDIT_REFUND_RECORD', input: payload(f, true, 1)}); assert.ok(second.blockers.includes('REFUND_EXCEEDS_RECORDED_RECEIPTS'));
  const late = setup(); late.core.recordPayment(late.ctx, late.actor, {invoice_id: late.sale.id, amount_cents: 12100, date: '2026-09-21'});
  const early = late.core.previewInvoiceAction(late.ctx, late.actor, {operation: 'CREDIT_REFUND_RECORD', input: payload(late, true)}); assert.ok(early.blockers.includes('REFUND_EXCEEDS_RECORDED_RECEIPTS'));
});
test('settlement rejects stale, reversed, corrupted, closed and mismatched sources before any effect', () => {
  for (const change of ['reversal', 'receipt-reversal', 'line', 'balance', 'currency', 'period', 'account']) {
    const f = setup(6000), value = payload(f, true, 1000), request = command(f, 'CREDIT_REFUND_RECORD', value);
    if (change === 'reversal') f.core.reverseJournal(f.ctx, f.actor, f.credit.journal_entry_id, 'Reverse credit source');
    if (change === 'receipt-reversal') f.core.reverseJournal(f.ctx, f.actor, f.rows('payments')[0].journal_entry_id, 'Reverse incoming receipt');
    if (change === 'line') f.rows('journal_lines').find(row => row.journal_entry_id === f.credit.journal_entry_id).debit_cents++;
    if (change === 'balance') invoice(f, f.sale.id).paid_cents++;
    if (change === 'currency') value.currency = 'USD';
    if (change === 'period') f.rows('fiscal_periods')[0].status = 'CLOSED';
    if (change === 'account') f.rows('accounts').find(row => row.system_role === 'BANK').active = false;
    const before = f.snapshot(); assert.equal(f.core.previewInvoiceAction(f.ctx, f.actor, {operation: request.operation, input: value}).ready, false, change);
    assert.throws(() => f.core.executeInvoiceAction(f.ctx, f.actor, {...request, input: value}), {code: 'finance_action_source_changed'}); assert.equal(f.snapshot(), before, change);
  }
  const f = setup(); assert.throws(() => f.core.allocateCredit(f.ctx, f.actor, {...payload(f), invoice_id: 'unrelated-invoice'}), {code: 'finance_credit_settlement_source_missing'});
  for (const change of [{amount_cents: 0.1}, {date: '2026-02-31'}, {date: '2026-09-20T00:00:00Z'}, {external_transfer: true}]) assert.throws(() => f.core.allocateCredit(f.ctx, f.actor, {...payload(f), ...change}), {code: 'finance_credit_settlement_input_invalid'});
});
for (const refund of [false, true]) test((refund ? 'refund' : 'allocation') + ' persistence failure rolls back both document balances, all events, receipts and ledger effects', () => {
  const f = setup(refund ? 12100 : 0), request = command(f, refund ? 'CREDIT_REFUND_RECORD' : 'CREDIT_ALLOCATE', payload(f, refund));
  const before = f.snapshot(), emitted = f.emitted.length; f.failNext();
  assert.throws(() => f.core.executeInvoiceAction(f.ctx, f.actor, request), /injected durable persistence failure/);
  assert.equal(f.snapshot(), before); assert.equal(f.emitted.length, emitted); f.restart();
  const result = f.core.executeInvoiceAction(f.ctx, f.actor, request); assert.equal(result.original_result_is_current, true);
  assert.equal(f.rows('credit_settlements').length, 1); assert.equal(f.rows('journal_entries').length, refund ? 4 : 2);
});
test('post-execution inspection is read only, retains unknown request identity and compares every original settlement effect', () => {
  const f = setup(), request = command(f, 'CREDIT_ALLOCATE', payload(f)), before = f.snapshot(), count = f.count(), emitted = f.emitted.length;
  const unknown = f.core.inspectInvoiceAction(f.ctx, f.actor, request); assert.equal(unknown.state, 'UNKNOWN'); assert.equal(unknown.read_only, true);
  assert.equal(f.count(), count); assert.equal(f.emitted.length, emitted); assert.equal(f.snapshot(), before);
  f.core.executeInvoiceAction(f.ctx, f.actor, request); const committed = f.snapshot(), saved = f.count();
  assert.equal(f.core.inspectInvoiceAction(f.ctx, f.actor, request).original_result_is_current, true); assert.equal(f.count(), saved); assert.equal(f.snapshot(), committed);
  for (const [entity, id, field] of [['invoices', f.sale.id, 'customer_address'], ['invoices', f.credit.id, 'customer_address'], ['credit_settlements', f.rows('credit_settlements')[0].id, 'reference']]) {
    const row = f.rows(entity).find(row => row.id === id), value = row[field]; row[field] += ' later change';
    assert.equal(f.core.inspectInvoiceAction(f.ctx, f.actor, request).original_result_is_current, false, entity + field); row[field] = value;
  }
  assert.throws(() => f.core.inspectInvoiceAction(f.ctx, {...f.actor, roles: ['VIEWER']}, request), {code: 'finance_forbidden'});
  assert.throws(() => f.core.inspectInvoiceAction(f.ctx, f.actor, {...request, input: {...request.input, amount_cents: 1}}), {code: 'finance_action_request_conflict'});
});
