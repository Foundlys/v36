'use strict';

const clone = value => JSON.parse(JSON.stringify(value));
const OPEN = ['POSTED', 'PARTIALLY_PAID', 'OVERDUE', 'PARTIALLY_SETTLED'];
const POSTED = [...OPEN, 'PAID', 'SETTLED'];
const fail = (code, message, statusCode = 422) => {throw Object.assign(Error(message), {code, statusCode});};
const money = value => Number.isSafeInteger(value) && value >= 0;
const total = rows => rows.reduce((amount, row) => amount + BigInt(row.amount_cents), 0n);
function salesBalance(invoice) {
  return [invoice.gross_cents, invoice.paid_cents, invoice.credited_cents ?? 0, invoice.outstanding_cents].every(money)
    && BigInt(invoice.paid_cents) + BigInt(invoice.credited_cents ?? 0) + BigInt(invoice.outstanding_cents) === BigInt(invoice.gross_cents);
}
function creditBalance(credit) {
  return [credit.gross_cents, credit.allocated_cents ?? 0, credit.refunded_cents ?? 0, credit.outstanding_cents].every(money)
    && credit.paid_cents === 0 && BigInt(credit.allocated_cents ?? 0) + BigInt(credit.refunded_cents ?? 0) + BigInt(credit.outstanding_cents) === BigInt(credit.gross_cents);
}
function saleStatus(invoice) {
  return invoice.credited_cents > 0 ? (invoice.outstanding_cents === 0 ? 'SETTLED' : 'PARTIALLY_SETTLED') : (invoice.outstanding_cents === 0 ? 'PAID' : 'PARTIALLY_PAID');
}
function inspect(core, ctx, operation, input) {
  if (!['CREDIT_ALLOCATE', 'CREDIT_REFUND_RECORD'].includes(operation)) fail('finance_credit_settlement_input_invalid', 'Kies verrekening of interne terugbetalingsregistratie');
  const refund = operation === 'CREDIT_REFUND_RECORD';
  const allowed = ['credit_note_id', 'amount_cents', 'currency', 'date', 'reference', ...(refund ? [] : ['invoice_id'])];
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !allowed.includes(key))
    || !Number.isSafeInteger(input.amount_cents) || input.amount_cents <= 0 || typeof input.date !== 'string'
    || !/^\d{4}-\d\d-\d\d$/.test(input.date) || !Number.isFinite(Date.parse(input.date)) || new Date(input.date).toISOString().slice(0, 10) !== input.date
    || typeof input.reference !== 'string' || !input.reference.trim() || input.reference.length > 240) {
    fail('finance_credit_settlement_input_invalid', 'Kies het exacte creditdocument, gehele bedrag, datum en omschrijving');
  }
  const date = new Date(input.date).toISOString(), invoices = core.collection(ctx, 'invoices');
  const credit = invoices.find(row => row.id === input.credit_note_id && !row.archived_at);
  const invoice = credit && invoices.find(row => row.id === credit.credits_invoice_id && !row.archived_at);
  if (!credit || credit.kind !== 'CREDIT_NOTE' || !invoice || invoice.kind !== 'SALES' || (!refund && input.invoice_id !== invoice.id)) {
    fail('finance_credit_settlement_source_missing', 'Kies de creditnota en haar oorspronkelijke verkoopfactuur', 404);
  }
  const entity = core.collection(ctx, 'legal_entities').find(row => row.id === credit.legal_entity_id && !row.archived_at);
  const accounts = core.collection(ctx, 'accounts').filter(row => row.legal_entity_id === credit.legal_entity_id);
  const periods = core.collection(ctx, 'fiscal_periods').filter(row => row.legal_entity_id === credit.legal_entity_id);
  const settlements = core.collection(ctx, 'credit_settlements').filter(row => row.invoice_id === invoice.id);
  const payments = core.collection(ctx, 'payments').filter(row => row.invoice_id === invoice.id);
  if (accounts.length > 1000 || periods.length > 1000 || settlements.length > 10000 || payments.length > 10000) fail('finance_credit_settlement_capacity', 'De financiële broncontrole overschrijdt de limiet', 413);
  const journalIds = new Set([invoice.journal_entry_id, credit.journal_entry_id, ...payments.map(row => row.journal_entry_id), ...settlements.filter(row => row.kind === 'INTERNAL_REFUND').map(row => row.journal_entry_id)]);
  const journals = core.collection(ctx, 'journal_entries').filter(row => journalIds.has(row.id) || journalIds.has(row.reverses_entry_id));
  const journalLines = core.collection(ctx, 'journal_lines').filter(row => journalIds.has(row.journal_entry_id));
  const blockers = [], own = settlements.filter(row => row.credit_note_id === credit.id);
  const allocations = settlements.filter(row => row.kind === 'ALLOCATION'), refunds = settlements.filter(row => row.kind === 'INTERNAL_REFUND');
  if (!entity || credit.legal_entity_id !== invoice.legal_entity_id || entity.currency !== credit.currency || credit.currency !== invoice.currency || input.currency !== credit.currency) blockers.push('CURRENCY_OR_ENTITY_MISMATCH');
  if (!POSTED.includes(invoice.status) || !OPEN.includes(credit.status) || !credit.immutable || !invoice.immutable
    || [invoice, credit].some(row => !Number.isSafeInteger(row.revision) || row.revision < 1 || row.revision >= Number.MAX_SAFE_INTEGER)) blockers.push('SOURCE_NOT_OPEN');
  function validJournal(id, source, sourceId, amount, at) {
    const journal = journals.find(row => row.id === id), lines = journalLines.filter(row => row.journal_entry_id === id);
    return journal && journal.source === source && journal.source_id === sourceId && journal.legal_entity_id === credit.legal_entity_id
      && journal.currency === credit.currency && journal.debit_cents === amount && journal.credit_cents === amount && journal.date === at
      && !journals.some(row => row.reverses_entry_id === id) && lines.length >= 2 && lines.length <= 500
      && lines.every(row => money(row.debit_cents) && money(row.credit_cents) && (row.debit_cents === 0) !== (row.credit_cents === 0))
      && lines.reduce((n, row) => n + BigInt(row.debit_cents), 0n) === BigInt(amount)
      && lines.reduce((n, row) => n + BigInt(row.credit_cents), 0n) === BigInt(amount);
  }
  if ([invoice, credit].some(row => !money(row.gross_cents) || !validJournal(row.journal_entry_id, 'invoice', row.id, row.gross_cents, row.invoice_date))) blockers.push('SOURCE_JOURNAL_INVALID');
  const validRows = settlements.every(row => ['ALLOCATION', 'INTERNAL_REFUND'].includes(row.kind) && money(row.amount_cents) && row.amount_cents > 0
    && row.currency === credit.currency && row.legal_entity_id === credit.legal_entity_id && Number.isFinite(Date.parse(row.date))
    && (row.kind === 'ALLOCATION' ? row.journal_entry_id === null : validJournal(row.journal_entry_id, 'credit_refund', row.id, row.amount_cents, row.date)));
  const validPayments = payments.every(row => money(row.amount_cents) && row.amount_cents > 0 && row.currency === invoice.currency
    && row.legal_entity_id === invoice.legal_entity_id && Number.isFinite(Date.parse(row.date))
    && validJournal(row.journal_entry_id, 'payment', invoice.id, row.amount_cents, row.date));
  const balancesValid = salesBalance(invoice) && creditBalance(credit);
  if (!balancesValid || !validRows || !validPayments || balancesValid && validRows && validPayments
    && (total(allocations) !== BigInt(invoice.credited_cents ?? 0) || total(own.filter(row => row.kind === 'ALLOCATION')) !== BigInt(credit.allocated_cents ?? 0)
      || total(own.filter(row => row.kind === 'INTERNAL_REFUND')) !== BigInt(credit.refunded_cents ?? 0) || total(payments) !== BigInt(invoice.paid_cents))) blockers.push('BALANCE_SOURCE_INVALID');
  if (input.amount_cents > credit.outstanding_cents || !refund && input.amount_cents > invoice.outstanding_cents) blockers.push('AMOUNT_EXCEEDS_OPEN_BALANCE');
  if (refund && validRows && validPayments && BigInt(input.amount_cents) > total(payments.filter(row => row.date <= date)) - total(refunds)) blockers.push('REFUND_EXCEEDS_RECORDED_RECEIPTS');
  if (date < credit.invoice_date || date < invoice.invoice_date || date > core.now()) blockers.push('DATE_OUTSIDE_RECORDED_HISTORY');
  const matching = periods.filter(row => row.start_date <= date && row.end_date >= date);
  if (matching.length !== 1 || matching[0].status !== 'OPEN') blockers.push('PERIOD_NOT_OPEN');
  for (const role of refund ? ['AR', 'BANK'] : ['AR']) if (accounts.filter(row => row.system_role === role && row.active !== false && row.currency === credit.currency).length !== 1) blockers.push('ACCOUNT_MAPPING_INVALID');
  return {basis: {entity: entity || null, credit, invoice, accounts, periods, settlements, payments, journals, journalLines}, blockers: [...new Set(blockers)],
    summary: {credit_note_id: credit.id, invoice_id: invoice.id, amount_cents: input.amount_cents, currency: credit.currency, date,
      credit_outstanding_cents: credit.outstanding_cents, invoice_outstanding_cents: invoice.outstanding_cents, kind: refund ? 'INTERNAL_REFUND' : 'ALLOCATION', external_payment_performed: false, bank_settlement_verified: false}};
}
function apply(core, context, actor, operation, input) {
  const {ctx, principal} = core.scope(context, actor);
  if (!principal.permissions.has('*') && !principal.permissions.has('finance:post')) fail('finance_forbidden', 'Deze financiële afhandeling vereist actuele boekingsrechten', 403);
  const current = inspect(core, ctx, operation, input);
  if (current.blockers.length) fail('finance_credit_settlement_not_ready', 'De actuele creditbron bevat blokkades: ' + current.blockers.join(', '), 409);
  const {credit, invoice, accounts} = current.basis, refund = operation === 'CREDIT_REFUND_RECORD', id = core.adapter.id();
  const now = core.now(), amount = input.amount_cents, date = new Date(input.date).toISOString(); let journal;
  if (refund) {
    const account = role => accounts.find(row => row.system_role === role && row.active !== false && row.currency === credit.currency);
    journal = core.postJournal(ctx, actor, {legal_entity_id: credit.legal_entity_id, currency: credit.currency, date,
      description: 'Internal credit refund ' + credit.invoice_number, source: 'credit_refund', source_id: id,
      lines: [{account_id: account('AR').id, debit_cents: amount, credit_cents: 0}, {account_id: account('BANK').id, debit_cents: 0, credit_cents: amount}]}, {idempotencyKey: 'credit-refund:' + id});
    credit.refunded_cents = (credit.refunded_cents ?? 0) + amount;
  } else {
    credit.allocated_cents = (credit.allocated_cents ?? 0) + amount;
    invoice.credited_cents = (invoice.credited_cents ?? 0) + amount;
    invoice.outstanding_cents -= amount;
    invoice.status = saleStatus(invoice); invoice.revision++;
  }
  credit.outstanding_cents -= amount;
  credit.status = credit.outstanding_cents === 0 ? 'SETTLED' : 'PARTIALLY_SETTLED'; credit.revision++;
  const settlement = {id, tenant_id: ctx.tenant_id, dealer_id: ctx.dealer_id, legal_entity_id: credit.legal_entity_id, credit_note_id: credit.id,
    invoice_id: invoice.id, kind: refund ? 'INTERNAL_REFUND' : 'ALLOCATION', amount_cents: amount, currency: credit.currency, date, reference: input.reference,
    journal_entry_id: journal?.entry.id || null, created_at: now, created_by: principal.id, immutable: true, retention_lock: true, external_payment_performed: false, bank_settlement_verified: false};
  core.collection(ctx, 'credit_settlements').push(settlement);
  core.audit(ctx, principal, refund ? 'RECORD_REFUND' : 'ALLOCATE_CREDIT', 'credit_settlement', id, input.reference, {credit_note_id: credit.id, invoice_id: invoice.id, amount_cents: amount, external_payment_performed: false});
  core.emit(ctx, refund ? 'credit.refund_recorded' : 'credit.allocated', 'credit_settlement', id, {credit_note_id: credit.id, invoice_id: invoice.id, amount_cents: amount, external_payment_performed: false});
  core.commit();
  return {invoice: clone(credit), related_invoice: clone(invoice), settlement: clone(settlement), ...(journal ? {journal} : {}), financial_posting_performed: refund, external_payment_performed: false, bank_settlement_verified: false};
}
module.exports = {inspect, apply, salesBalance, creditBalance, saleStatus, OPEN, POSTED};
