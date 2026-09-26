'use strict';

// Resolve an actual owned Sales order and an actual readable CRM contact. The
// caller selects identifiers and dates; prices, tax and billing identities
// come from the confirmed native source snapshot, never a public catalog.
const commerce = require('./sales-commerce');
const EXTRA_SCOPES = ['sales:commerce_orders', 'sales:outbox', 'platform:audit'];
const clone = value => JSON.parse(JSON.stringify(value));
const fail = (code, message, statusCode = 422) => {throw Object.assign(Error(message), {code, statusCode});};
function dependencies(core) {
  const sales = core.adapter.sales?.(), crm = core.adapter.crm?.();
  if (!sales || !crm) fail('finance_commerce_unavailable', 'De native CRM- en Sales-koppeling is niet beschikbaar', 503);
  return {sales, crm};
}
function scope(core, ctx, actor, operation) {
  const {sales, crm} = dependencies(core);
  commerce.scope(sales, ctx, actor, operation);
  sales.resolver.assertCapability(ctx, actor, 'finance:ledger', 'read');
  sales.resolver.assertCapability(ctx, actor, 'crm:contacts', 'read');
  for (const name of ['finance:invoices', ...EXTRA_SCOPES]) if (sales.adapter.bucket(ctx, name) !== core.adapter.bucket(ctx, name)) fail('finance_commerce_transaction_unavailable', 'De order en Finance vereisen dezelfde atomaire opslag', 503);
  return {sales, crm};
}
function text(value, max, field) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) fail('finance_commerce_source_incomplete', 'De bron mist geldige factuurgegevens: ' + field);
  return value;
}
function validate(input) {
  const keys = ['order_id', 'contact_id', 'legal_entity_id', 'invoice_number', 'invoice_date', 'supply_date', 'due_date', 'series'];
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !keys.includes(key))) fail('finance_commerce_input_invalid', 'Kies alleen de native order, klant, entiteit en factuurdatums');
  for (const field of ['order_id', 'contact_id', 'legal_entity_id']) if (typeof input[field] !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/.test(input[field])) fail('finance_commerce_input_invalid', 'Kies de exacte native bron-ID');
  text(input.invoice_number, 60, 'invoice_number');
  if (input.series !== undefined) text(input.series, 20, 'series');
  for (const field of ['invoice_date', 'supply_date', 'due_date']) {
    if (typeof input[field] !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input[field]) || !Number.isFinite(Date.parse(input[field])) || new Date(input[field]).toISOString().slice(0, 10) !== input[field]) fail('finance_commerce_date_invalid', 'Kies expliciete geldige factuurdatums');
  }
}
function contactSnapshot(row) {return {id: row.id, revision: row.revision, name: text(row.name, 200, 'customer_name'), address: text(row.billing_address || row.address, 500, 'customer_address')};}
function inspect(core, ctx, actor, input) {
  validate(input);
  const {sales, crm} = scope(core, ctx, actor, 'read');
  const order = commerce.read(sales, ctx, actor, 'commerce_orders', input.order_id);
  const customer = contactSnapshot(crm.get(ctx, actor, 'contacts', input.contact_id));
  const entities = core.collection(ctx, 'legal_entities').filter(row => row.id === input.legal_entity_id && !row.archived_at);
  if (entities.length !== 1) fail('finance_legal_entity_missing', 'Kies de exacte financiële entiteit', 404);
  const entity = entities[0], blockers = [];
  if (!['RESERVED', 'FULFILLED'].includes(order.status)) blockers.push('ORDER_NOT_INVOICEABLE');
  if (order.invoice_id || order.financial_status !== 'UNPOSTED') blockers.push('ORDER_ALREADY_LINKED');
  if (order.currency !== entity.currency) blockers.push('CURRENCY_MISMATCH');
  if (!Array.isArray(order.lines) || order.lines.length < 1 || order.lines.length > 50) fail('finance_commerce_order_invalid', 'De native orderregels zijn onvolledig', 409);
  if (order.lines.some(line => !Number.isSafeInteger(line.quantity) || line.quantity < 1 || !Number.isSafeInteger(line.unit_price_minor) || line.unit_price_minor < 0 || !Number.isSafeInteger(line.tax_rate_bps) || line.tax_rate_bps < 0 || line.tax_rate_bps > 10000 || line.returned_quantity !== 0)) blockers.push('ORDER_LINES_REQUIRE_REVIEW');
  const invoice = {
    legal_entity_id: entity.id, kind: 'SALES', series: input.series || 'SALES', invoice_number: input.invoice_number,
    invoice_date: input.invoice_date, supply_date: input.supply_date, due_date: input.due_date, currency: order.currency,
    supplier_name: text(entity.name, 200, 'supplier_name'), supplier_address: text(entity.address, 500, 'supplier_address'),
    supplier_vat_id: text(entity.vat_id, 40, 'supplier_vat_id'), supplier_kvk_number: text(entity.kvk_number, 20, 'supplier_kvk_number'),
    customer_name: customer.name, customer_address: customer.address,
    lines: order.lines.map(line => ({description: text(line.name, 200, 'line description'), quantity: line.quantity, unit_price_cents: line.unit_price_minor, vat_rate: line.tax_rate_bps / 100, product_id: line.product_id})),
    commerce_source: {authority: 'NATIVE_CONFIRMED_ORDER_AND_CRM_CONTACT', order_id: order.id, order_revision: order.revision, contact_id: customer.id, contact_revision: customer.revision}
  };
  const calculated = core.validateInvoice(ctx, invoice);
  if (!order.totals || [['net_minor', 'net_cents'], ['tax_minor', 'vat_cents'], ['gross_minor', 'gross_cents']].some(([a, b]) => !Number.isSafeInteger(order.totals[a]) || order.totals[a] !== calculated[b])) blockers.push('ORDER_INVOICE_AMOUNT_MISMATCH');
  const duplicates = core.collection(ctx, 'invoices').filter(row => row.legal_entity_id === entity.id && row.series === invoice.series && row.invoice_number === invoice.invoice_number).map(row => row.id);
  if (duplicates.length) blockers.push('INVOICE_NUMBER_EXISTS');
  return {basis: {entity, order, customer, duplicates}, effective_input: invoice, blockers,
    summary: {order_id: order.id, order_revision: order.revision, contact_id: customer.id, contact_revision: customer.revision, customer_name: customer.name, invoice_number: invoice.invoice_number, currency: invoice.currency, amount_cents: calculated.gross_cents, next_status: 'DRAFT'}};
}
function link(core, ctx, actor, input, invoice, reason) {
  const {sales, crm} = scope(core, ctx, actor, 'write');
  const old = commerce.read(sales, ctx, actor, 'commerce_orders', input.order_id), customer = contactSnapshot(crm.get(ctx, actor, 'contacts', input.contact_id));
  if (old.invoice_id || old.financial_status !== 'UNPOSTED' || invoice.commerce_source?.order_revision !== old.revision || invoice.commerce_source?.contact_revision !== customer.revision) fail('finance_commerce_source_changed', 'De native koppeling is gewijzigd', 409);
  const now = (sales.adapter.now?.() || new Date()).toISOString();
  const row = {...old, invoice_id: invoice.id, financial_status: 'INVOICE_LINKED', crm_contact_id: customer.id, crm_contact_revision: customer.revision,
    customer_reference_authority: 'USER_REFERENCE_WITH_CONFIRMED_CRM_LINK',
    revision: old.revision + 1, updated_at: now, history: [...old.history, {operation: 'INVOICE_LINK', invoice_id: invoice.id, actor_id: actor.id, at: now, reason}]};
  const rows = sales.bucket(ctx, 'commerce_orders'); rows[rows.findIndex(record => record.id === row.id)] = row;
  sales.recordEvent(ctx, actor, 'commerce_orders', row, 'updated');
  return {order: clone(row), customer};
}
function current(core, ctx, actor, result) {
  const {sales, crm} = scope(core, ctx, actor, 'read');
  const original = result.commerce_link, order = commerce.read(sales, ctx, actor, 'commerce_orders', original.order.id);
  const customer = contactSnapshot(crm.get(ctx, actor, 'contacts', original.customer.id));
  if (order.invoice_id !== result.invoice.id || order.owner_id !== original.order.owner_id) fail('finance_commerce_link_changed', 'De oorspronkelijke orderkoppeling kan niet worden geverifieerd', 409);
  return {order, customer};
}
function flush(core, ctx, actor) {
  const {sales} = dependencies(core);
  try {sales.flush(ctx, actor);} catch {}
  return sales.adapter.bucket(ctx, 'sales:outbox').some(row => row.status === 'PENDING') ? 'QUEUED_RETRY' : 'DELIVERED';
}
module.exports = {EXTRA_SCOPES, scope, inspect, link, current, flush};
