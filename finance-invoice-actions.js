'use strict';

const crypto = require('node:crypto');
const durability = require('./finance-request-durability');
const native = require('./finance-operation-transactions').operations;
const SCOPE = 'finance:action_requests';
const CONTRACTS = Object.freeze({
  COMMERCE_INVOICE_CREATE: {method: 'createInvoice', permission: 'finance:write', capabilities: ['finance:invoices', 'finance:ledger', 'sales:quotes', 'crm:contacts'], capability_modes: {'finance:ledger': 'read', 'crm:contacts': 'read'}, commerce: true, entity: 'invoice'},
  INVOICE_CREATE: {method: 'createInvoice', permission: 'finance:write', capabilities: ['finance:invoices'], entity: 'invoice'},
  CREDIT_NOTE_CREATE: {method: 'createCreditNote', permission: 'finance:write', capabilities: ['finance:invoices', 'finance:ledger'], entity: 'invoice'},
  INVOICE_POST: {method: 'postInvoice', permission: 'finance:post', capabilities: ['finance:invoices', 'finance:ledger'], entity: 'invoice'},
  PAYMENT_RECORD: {method: 'recordPayment', permission: 'finance:post', capabilities: ['finance:invoices', 'finance:ledger', 'finance:payments'], entity: 'payment'}
});
const fail = (code, message, statusCode = 409) => {throw Object.assign(Error(message), {code, statusCode});};
const clone = value => JSON.parse(JSON.stringify(value));
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
const hash = value => crypto.createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
function contract(operation) {
  if (!Object.hasOwn(CONTRACTS, operation)) fail('finance_action_invalid', 'Kies een ondersteunde financiële actie', 422);
  return CONTRACTS[operation];
}
function authority(core, context, actor, operation, mode) {
  const {ctx, principal} = core.scope(context, actor), spec = contract(operation), required = mode === 'preview' ? 'finance:read' : spec.permission;
  if (!principal.permissions.has('*') && !principal.permissions.has(required)) fail('finance_forbidden', 'Onvoldoende actuele Finance-rechten', 403);
  if (spec.commerce) require('./commerce-finance-source').scope(core, ctx, actor, mode === 'preview' ? 'read' : 'write');
  return {ctx, principal, spec};
}
function request(value, complete) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || JSON.stringify(value).length > 128000) fail('finance_action_invalid', 'Kies een begrensde financiële actie', 422);
  const allowed = complete ? ['operation', 'input', 'request_id', 'expected_source_hash', 'confirm', 'reason'] : ['operation', 'input'];
  if (Object.keys(value).some(key => !allowed.includes(key)) || !value.input || typeof value.input !== 'object' || Array.isArray(value.input)) fail('finance_action_invalid', 'Kies de exacte invoer voor deze actie', 422);
  contract(value.operation);
  if (complete && (value.confirm !== true || typeof value.reason !== 'string' || !value.reason.trim() || value.reason.length > 500 || typeof value.request_id !== 'string' || !/^[A-Za-z0-9_.:-]{8,200}$/.test(value.request_id) || !/^[a-f0-9]{64}$/.test(value.expected_source_hash || ''))) fail('finance_action_confirmation_required', 'Bevestig de actuele voorbereiding met reden en aanvraag-ID', 422);
  return clone(value);
}
function selected(core, ctx, entity, id) {
  if (typeof id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/.test(id)) fail('finance_action_source_invalid', 'Kies een exacte financiële bron-ID', 422);
  const rows = core.collection(ctx, entity).filter(row => row.id === id && !row.archived_at);
  if (rows.length !== 1) fail('finance_action_source_missing', 'De exacte actuele financiële bron ontbreekt', 404);
  return rows[0];
}
function source(core, ctx, action, actor) {
  const {operation, input} = action; let invoice, entity, summary, blockers = [];
  if (operation === 'COMMERCE_INVOICE_CREATE') return require('./commerce-finance-source').inspect(core, ctx, actor, input);
  if (operation === 'CREDIT_NOTE_CREATE') {
    const {invoice_id, ...credit} = input;
    return require('./finance-credit-notes').inspect(core, ctx, invoice_id, credit, true);
  }
  if (operation === 'INVOICE_CREATE') {
    if (String(input.kind || '').toUpperCase() === 'CREDIT_NOTE') fail('finance_credit_action_required', 'Bereid een creditnota voor via de expliciete oorspronkelijke factuur', 422);
    const validated = core.validateInvoice(ctx, input);
    entity = selected(core, ctx, 'legal_entities', input.legal_entity_id);
    const currency = input.currency === undefined ? entity.currency : String(input.currency).trim().toUpperCase();
    if (currency !== entity.currency) blockers.push('CURRENCY_MISMATCH');
    const series = String(input.series || validated.kind).trim().slice(0, 20), number = String(input.invoice_number).trim().slice(0, 60);
    const duplicates = core.collection(ctx, 'invoices').filter(row => row.legal_entity_id === entity.id && row.series === series && row.invoice_number === number).map(row => row.id);
    if (duplicates.length) blockers.push('INVOICE_NUMBER_EXISTS');
    summary = {invoice_number: number, amount_cents: validated.gross_cents, currency, next_status: 'DRAFT'};
    return {basis: {entity, duplicates}, summary, blockers};
  }
  if (operation === 'INVOICE_POST' && Object.keys(input).some(key => key !== 'invoice_id')) fail('finance_action_invalid', 'Boek uitsluitend de gekozen factuur', 422);
  invoice = selected(core, ctx, 'invoices', input.invoice_id);
  entity = selected(core, ctx, 'legal_entities', invoice.legal_entity_id);
  const accounts = core.collection(ctx, 'accounts').filter(row => row.legal_entity_id === entity.id);
  const periods = core.collection(ctx, 'fiscal_periods').filter(row => row.legal_entity_id === entity.id);
  if (accounts.length > 1000 || periods.length > 1000) fail('finance_action_capacity', 'De broncontrole overschrijdt de veilige limiet', 413);
  const date = operation === 'INVOICE_POST' ? invoice.invoice_date : input.date;
  if (typeof date !== 'string' || !Number.isFinite(Date.parse(date))) fail('finance_action_date_required', 'Kies de expliciete boekingsdatum', 422);
  const at = new Date(date).toISOString(), period = periods.find(row => row.start_date <= at && row.end_date >= at);
  if (!period || period.status !== 'OPEN') blockers.push('PERIOD_NOT_OPEN');
  if (periods.filter(row => row.start_date <= at && row.end_date >= at).length > 1) blockers.push('AMBIGUOUS_PERIOD');
  if (invoice.currency !== entity.currency) blockers.push('CURRENCY_MISMATCH');
  const roles = operation === 'PAYMENT_RECORD' ? ['BANK', invoice.kind === 'PURCHASE' ? 'AP' : 'AR'] : invoice.kind === 'PURCHASE' ? ['EXPENSE', 'VAT_RECEIVABLE', 'AP'] : ['AR', 'REVENUE', 'VAT_PAYABLE'];
  if (roles.some(role => accounts.filter(row => row.system_role === role && row.active !== false && row.currency === invoice.currency).length !== 1)) blockers.push('ACCOUNT_MAPPING_INVALID');
  const basis = {entity, invoice, accounts, periods};
  if (invoice.kind === 'CREDIT_NOTE') basis.credit_source = require('./finance-credit-notes').assertDraft(core, ctx, {...invoice, lines: core.collection(ctx, 'invoice_lines').filter(line => line.invoice_id === invoice.id)}, invoice.id).basis;
  if (operation === 'INVOICE_POST') {
    basis.lines = core.collection(ctx, 'invoice_lines').filter(row => row.invoice_id === invoice.id);
    if (!basis.lines.length || basis.lines.length > 500 || ['net_cents', 'vat_cents', 'gross_cents'].some(field => !Number.isSafeInteger(invoice[field]) || invoice[field] < 0 || basis.lines.some(row => !Number.isSafeInteger(row[field]) || row[field] < 0) || basis.lines.reduce((total, row) => total + BigInt(row[field]), 0n) !== BigInt(invoice[field]))) blockers.push('INVOICE_TOTALS_INVALID');
    if (invoice.status !== 'DRAFT') blockers.push('INVOICE_NOT_DRAFT');
    if (!(invoice.gross_cents > 0)) blockers.push('INVOICE_AMOUNT_NOT_POSITIVE');
    if (invoice.kind === 'PURCHASE' && invoice.approval_status !== 'APPROVED') blockers.push('PURCHASE_NOT_APPROVED');
  } else {
    if (!['POSTED', 'PARTIALLY_PAID', 'OVERDUE'].includes(invoice.status)) blockers.push('INVOICE_NOT_OPEN');
    if (invoice.kind === 'CREDIT_NOTE') blockers.push('CREDIT_NOTE_REQUIRES_REFUND');
    if (!Number.isSafeInteger(input.amount_cents) || input.amount_cents <= 0 || input.amount_cents > invoice.outstanding_cents) blockers.push('INVALID_PAYMENT_AMOUNT');
    if (input.currency !== undefined && String(input.currency).trim().toUpperCase() !== invoice.currency) blockers.push('CURRENCY_MISMATCH');
    if (input.bank_transaction_id) {
      basis.bank_transaction = selected(core, ctx, 'bank_transactions', input.bank_transaction_id);
      basis.bank_uses = core.collection(ctx, 'payments').filter(row => row.bank_transaction_id === input.bank_transaction_id).map(row => row.id);
      if (basis.bank_transaction.status !== 'UNRECONCILED' || basis.bank_uses.length) blockers.push('BANK_SOURCE_ALREADY_USED');
      if (basis.bank_transaction.currency !== invoice.currency || basis.bank_transaction.legal_entity_id !== entity.id || Math.abs(basis.bank_transaction.amount_cents) !== input.amount_cents || (invoice.kind === 'PURCHASE' ? basis.bank_transaction.amount_cents >= 0 : basis.bank_transaction.amount_cents <= 0)) blockers.push('BANK_SOURCE_MISMATCH');
    }
  }
  summary = {invoice_id: invoice.id, invoice_number: invoice.invoice_number, current_status: invoice.status, amount_cents: operation === 'INVOICE_POST' ? invoice.gross_cents : input.amount_cents, outstanding_cents: invoice.outstanding_cents, currency: invoice.currency, date: at};
  return {basis, summary, blockers};
}
function preview(core, context, actor, value) {
  const action = request(value, false), {ctx} = authority(core, context, actor, action.operation, 'preview'), current = source(core, ctx, action, actor);
  return {ok: true, operation: action.operation, source_hash: hash({operation: action.operation, input: action.input, basis: current.basis}), ready: current.blockers.length === 0, blockers: current.blockers, summary: current.summary, ...(current.effective_input ? {prepared_invoice: current.effective_input} : {}), requires_confirmation: true, financial_posting_performed: false, external_payment_performed: false};
}
function identity(principal, action) {return {digest: hash([principal.id, action.request_id]), request_hash: hash(action)};}
function capacity(rows, next) {
  if (rows.length >= 100000 || rows.reduce((n, row) => n + Buffer.byteLength(JSON.stringify(row)), next ? Buffer.byteLength(JSON.stringify(next)) : 0) > 64 * 1024 * 1024) fail('finance_action_capacity', 'De bewaarlimiet is bereikt; eerdere financiële bewijzen blijven behouden', 507);
}
function receipt(core, ctx, principal, action) {
  const id = identity(principal, action), row = core.adapter.bucket(ctx, SCOPE).find(row => row.digest === id.digest);
  if (!row) return null;
  if (row.request_hash !== id.request_hash || row.operation !== action.operation || row.actor_id !== principal.id) fail('finance_action_request_conflict', 'Deze aanvraag-ID hoort bij andere bevestigde invoer');
  if (!['COMMITTED', 'ABANDONED'].includes(row.status) || row.receipt_version !== 1 || row.proof_hash !== hash({status: row.status, request_hash: row.request_hash, result: row.result})) fail('finance_action_receipt_invalid', 'Het bewaarde financiële resultaat kan niet worden geverifieerd');
  return row;
}
function output(core, ctx, row, deduplicated, actor) {
  if (row.status === 'ABANDONED') return {ok: true, state: 'NOT_APPLIED', operation: row.operation, request_id: row.request_id, deduplicated, financial_posting_performed: false, external_payment_performed: false};
  const invoice = selected(core, ctx, 'invoices', row.result.invoice.id);
  const originalEffects = {invoice: row.result.invoice}, current = {invoice};
  if (row.result.lines) {
    originalEffects.lines = row.result.lines;
    current.lines = core.collection(ctx, 'invoice_lines').filter(line => line.invoice_id === invoice.id);
  }
  if (row.result.journal) {
    originalEffects.journal = {entry: row.result.journal.entry, lines: row.result.journal.lines};
    const entry = selected(core, ctx, 'journal_entries', row.result.journal.entry.id);
    current.journal = {entry, lines: core.collection(ctx, 'journal_lines').filter(line => line.journal_entry_id === entry.id)};
  }
  if (row.result.payment) {
    originalEffects.payment = row.result.payment;
    current.payment = selected(core, ctx, 'payments', row.result.payment.id);
  }
  if (row.result.commerce_link) {
    originalEffects.commerce_link = row.result.commerce_link;
    current.commerce_link = require('./commerce-finance-source').current(core, ctx, actor, row.result);
  }
  return {ok: true, state: 'COMMITTED', operation: row.operation, request_id: row.request_id, deduplicated, original_result: clone(row.result), original_result_hash: hash(row.result), current_invoice: clone(invoice), current_result: clone(current), original_result_is_current: hash(originalEffects) === hash(current), financial_posting_performed: ['INVOICE_POST', 'PAYMENT_RECORD'].includes(row.operation), external_payment_performed: false, bank_settlement_verified: false, payment_evidence_kind: row.operation === 'PAYMENT_RECORD' ? 'USER_RECORDED_INTERNAL_BOOKING' : null};
}
function save(core, ctx, principal, action, status, result) {
  const row = {...identity(principal, action), operation: action.operation, request_id: action.request_id, actor_id: principal.id, status, result, receipt_version: 1, created_at: core.now()};
  row.proof_hash = hash({status, request_hash: row.request_hash, result});
  const rows = core.adapter.bucket(ctx, SCOPE); capacity(rows, row); rows.push(row);
  core.audit(ctx, principal, status === 'COMMITTED' ? 'CONFIRMED_ACTION' : 'ABANDONED_ACTION', 'action_request', row.digest, action.reason, {operation: action.operation, status});
  return row;
}
function execute(core, context, actor, value) {
  const action = request(value, true), {ctx, principal, spec} = authority(core, context, actor, action.operation, 'execute');
  const prior = receipt(core, ctx, principal, action);
  if (prior) {
    if (prior.status === 'ABANDONED') fail('finance_action_abandoned', 'Deze aanvraag is definitief zonder uitvoering afgesloten');
    const result = output(core, ctx, prior, true, actor); return {...result, event_delivery: durability.flush(core, ctx), ...(spec.commerce ? {sales_event_delivery: require('./commerce-finance-source').flush(core, ctx, actor)} : {})};
  }
  capacity(core.adapter.bucket(ctx, SCOPE));
  const current = preview(core, ctx, actor, {operation: action.operation, input: action.input});
  if (current.source_hash !== action.expected_source_hash) fail('finance_action_source_changed', 'De bron is gewijzigd; bereid de actie opnieuw voor');
  if (!current.ready) fail('finance_action_not_ready', 'De financiële bron bevat blokkades', 422);
  const committed = durability.transaction(core, ctx, principal, [...native[spec.method].entities, 'action_requests'], () => {
    let result;
    if (action.operation === 'INVOICE_POST') result = core.postInvoice(ctx, actor, action.input.invoice_id);
    else if (action.operation === 'CREDIT_NOTE_CREATE') {const {invoice_id, ...input} = action.input;result = core.createCreditNote(ctx, actor, invoice_id, input);}
    else result = core[spec.method](ctx, actor, current.prepared_invoice || action.input);
    if (spec.commerce) result.commerce_link = require('./commerce-finance-source').link(core, ctx, actor, action.input, result.invoice, action.reason);
    const row = save(core, ctx, principal, action, 'COMMITTED', result);
    return output(core, ctx, row, false, actor);
  }, spec.commerce ? require('./commerce-finance-source').EXTRA_SCOPES : []);
  return {...committed, ...(spec.commerce ? {sales_event_delivery: require('./commerce-finance-source').flush(core, ctx, actor)} : {})};
}
function recover(core, context, actor, value) {
  const action = request(value, true), {ctx, principal, spec} = authority(core, context, actor, action.operation, 'recover');
  const prior = receipt(core, ctx, principal, action);
  if (prior) {const result = output(core, ctx, prior, true, actor); return {...result, event_delivery: durability.flush(core, ctx), ...(spec.commerce ? {sales_event_delivery: require('./commerce-finance-source').flush(core, ctx, actor)} : {})};}
  // An unseen request is durably retired before a delayed original body can
  // execute. It does not execute the command to discover its outcome.
  capacity(core.adapter.bucket(ctx, SCOPE));
  return durability.transaction(core, ctx, principal, ['action_requests'], () => output(core, ctx, save(core, ctx, principal, action, 'ABANDONED', null), false, actor));
}
module.exports = {SCOPE, CONTRACTS, contract, preview, execute, recover};
