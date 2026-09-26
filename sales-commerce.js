'use strict';

// Production Sales inventory and order ledger. Public catalog observations do
// not create stock, invoices, payments or carrier confirmations here.
const crypto = require('node:crypto');
const {scopedMutation} = require('./scoped-mutation');
const ENTITIES = ['commerce_products', 'commerce_inventory', 'commerce_orders', 'commerce_movements'];
const OPERATIONS = 'sales:commerce_operations';
const ACTIONS = ['PRODUCT_SAVE', 'STOCK_RECEIVE', 'ORDER_RESERVE', 'ORDER_CANCEL', 'ORDER_FULFILL', 'ORDER_RETURN'];
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const keys = (v, allowed) => object(v) && Object.keys(v).every(k => allowed.includes(k));
const id = v => typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,99}$/.test(v);
const text = (v, max) => typeof v === 'string' && v.trim().length > 0 && v.length <= max && !/[\u0000-\u001f\u007f]/.test(v);
const integer = v => Number.isSafeInteger(v) && v >= 0;
const clone = v => JSON.parse(JSON.stringify(v));
const canonical = v => Array.isArray(v) ? v.map(canonical) : object(v) ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canonical(v[k])])) : v;
const hash = v => crypto.createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex');
const fail = (code, message, statusCode = 422) => { throw Object.assign(Error(message), {code, statusCode}); };
const safe = v => { if (v < 0n || v > BigInt(Number.MAX_SAFE_INTEGER)) fail('commerce_amount_overflow', 'Het bedrag of aantal is te groot'); return Number(v); };
const add = (a, b) => safe(BigInt(a) + BigInt(b));
const tax = (net, bps) => safe((BigInt(net) * BigInt(bps) + 5000n) / 10000n);
const at = domain => (domain.adapter.now?.() || new Date()).toISOString();

function scope(domain, ctx, actor, operation = 'read') {
  if (domain.id !== 'sales') throw TypeError('Commerce belongs to Sales');
  domain.scope(ctx, actor, operation);
  domain.resolver.assertCapability(ctx, actor, 'sales:quotes', operation);
}
function raw(domain, ctx, actor, entity, recordId) {
  if (!ENTITIES.includes(entity) || !id(recordId)) fail('commerce_source_invalid', 'Kies een geldig handelsrecord');
  const row = domain.bucket(ctx, entity).find(r => r.id === recordId && !r.deleted_at && r.status !== 'ARCHIVED');
  if (!row || !domain.visible(row, actor)) fail('commerce_record_not_found', 'Handelsrecord niet gevonden', 404);
  return row;
}
function readable(domain, ctx, actor, row) {
  if (!ENTITIES.includes(row.owned_entity)) return true;
  try {
    scope(domain, ctx, actor);
    if (row.product_id) raw(domain, ctx, actor, 'commerce_products', row.product_id);
    if (row.order_id) raw(domain, ctx, actor, 'commerce_orders', row.order_id);
    for (const line of row.lines || []) raw(domain, ctx, actor, 'commerce_products', line.product_id);
    return true;
  } catch (error) { if ([401, 403, 404].includes(error.statusCode)) return false; throw error; }
}
function read(domain, ctx, actor, entity, recordId) {
  scope(domain, ctx, actor);
  const row = raw(domain, ctx, actor, entity, recordId);
  if (!readable(domain, ctx, actor, row)) fail('commerce_record_not_found', 'Handelsrecord niet gevonden', 404);
  return clone(row);
}
function list(domain, ctx, actor, entity, query = {}) {
  scope(domain, ctx, actor);
  if (!ENTITIES.includes(entity) || !keys(query, ['limit', 'offset', 'q', 'status'])) fail('commerce_query_invalid', 'Kies een geldige lijst');
  const parse = (v, fallback) => v === undefined ? fallback : typeof v === 'number' ? v : /^\d+$/.test(v) ? Number(v) : NaN;
  const limit = parse(query.limit, 50), offset = parse(query.offset, 0);
  if (!integer(limit) || limit < 1 || limit > 100 || !integer(offset) || query.q !== undefined && (typeof query.q !== 'string' || query.q.length > 100) || query.status !== undefined && !text(query.status, 40)) fail('commerce_query_invalid', 'Gebruik een pagina van maximaal honderd records');
  const q = (query.q || '').toLowerCase();
  const rows = domain.bucket(ctx, entity).filter(r => !r.deleted_at && r.status !== 'ARCHIVED' && domain.visible(r, actor) && readable(domain, ctx, actor, r) && (!query.status || r.status === query.status) && (!q || [r.name, r.sku, r.id].some(v => String(v || '').toLowerCase().includes(q))));
  return {items: clone(rows.slice(offset, offset + limit)), total: rows.length, limit, offset, next_offset: offset + limit < rows.length ? offset + limit : null, external_stock_verified: false};
}
function validate(operation, input) {
  const common = ['confirm', 'reason', 'expected_revision'];
  const fields = {
    PRODUCT_SAVE: ['product_id', 'sku', 'name', 'group_id', 'attributes', 'gtin', 'currency', 'unit_price_minor', 'tax_rate_bps'],
    STOCK_RECEIVE: ['product_id', 'expected_product_revision', 'quantity', 'evidence_reference'],
    ORDER_RESERVE: ['order_id', 'currency', 'customer_reference', 'lines'],
    ORDER_CANCEL: ['order_id'], ORDER_FULFILL: ['order_id', 'evidence_reference'],
    ORDER_RETURN: ['order_id', 'lines', 'evidence_reference']
  };
  if (!ACTIONS.includes(operation) || !keys(input, [...common, ...fields[operation]]) || input.confirm !== true || !text(input.reason, 500) || !integer(input.expected_revision)) fail('commerce_confirmation_required', 'Bevestig de exacte handelsactie met revisie en reden');
  if (JSON.stringify(input).length > 64000) fail('commerce_input_limit', 'De handelsactie is te groot');
  if (operation === 'PRODUCT_SAVE') {
    if (!id(input.product_id) || !text(input.sku, 100) || !text(input.name, 200) || !/^[A-Z]{3}$/.test(input.currency) || !integer(input.unit_price_minor) || !integer(input.tax_rate_bps) || input.tax_rate_bps > 10000 || input.group_id !== undefined && !id(input.group_id) || input.gtin !== undefined && !/^\d{8,14}$/.test(input.gtin)) fail('commerce_product_invalid', 'Controleer artikel, valuta, netto prijs en expliciet belastingtarief');
    if (input.attributes !== undefined && (!object(input.attributes) || Object.keys(input.attributes).length > 20 || Object.entries(input.attributes).some(([k, v]) => !text(k, 60) || ['__proto__', 'prototype', 'constructor'].includes(k) || !text(v, 160)))) fail('commerce_variant_invalid', 'Gebruik maximaal twintig expliciete variantkenmerken');
  } else if (operation === 'STOCK_RECEIVE') {
    if (!id(input.product_id) || !integer(input.expected_product_revision) || input.expected_product_revision < 1 || !integer(input.quantity) || input.quantity < 1 || input.quantity > 1000000 || !text(input.evidence_reference, 500)) fail('commerce_receipt_invalid', 'Controleer artikel, aantal en ontvangstbewijs');
  } else {
    if (!id(input.order_id)) fail('commerce_order_invalid', 'Kies een geldig ordernummer');
    if (operation === 'ORDER_RESERVE' && (input.expected_revision !== 0 || !/^[A-Z]{3}$/.test(input.currency) || !text(input.customer_reference, 160))) fail('commerce_order_invalid', 'Gebruik een nieuwe order met valuta en interne klantreferentie');
    if (['ORDER_FULFILL', 'ORDER_RETURN'].includes(operation) && !text(input.evidence_reference, 500)) fail('commerce_evidence_required', 'Leg de herkomst van de aflever- of retourregistratie vast');
    if (['ORDER_RESERVE', 'ORDER_RETURN'].includes(operation)) {
      const fields = operation === 'ORDER_RESERVE' ? ['product_id', 'quantity', 'expected_product_revision', 'expected_inventory_revision'] : ['product_id', 'quantity', 'disposition'];
      if (!Array.isArray(input.lines) || input.lines.length < 1 || input.lines.length > 50 || new Set(input.lines.map(l => l?.product_id)).size !== input.lines.length || input.lines.some(l => !keys(l, fields) || !id(l.product_id) || !integer(l.quantity) || l.quantity < 1 || l.quantity > 1000000 || (operation === 'ORDER_RESERVE' ? !integer(l.expected_product_revision) || l.expected_product_revision < 1 || !integer(l.expected_inventory_revision) || l.expected_inventory_revision < 1 : !['RESTOCK', 'QUARANTINE'].includes(l.disposition)))) fail('commerce_lines_invalid', 'Gebruik maximaal vijftig unieke orderregels met geldige aantallen en revisies');
    }
  }
  return input;
}
function mutate(domain, ctx, fn) { return scopedMutation(domain.adapter, ctx, [...ENTITIES.map(e => 'sales:' + e), OPERATIONS, 'sales:outbox', 'platform:audit'], fn); }
function revise(domain, ctx, actor, entity, recordId, changes, effects) {
  const rows = domain.bucket(ctx, entity), previous = rows.find(r => r.id === recordId), time = at(domain);
  if (!previous && rows.length >= (entity === 'commerce_movements' ? 100000 : 25000)) fail('commerce_capacity', 'De bewaarlimiet voor handelsrecords is bereikt', 507);
  const row = {...previous, ...changes, id: recordId, tenant_id: ctx.tenant_id, dealer_id: ctx.dealer_id, owner_id: previous?.owner_id || actor.id, source_module: 'sales', owned_entity: entity, revision: (previous?.revision || 0) + 1, created_at: previous?.created_at || time, updated_at: time, status: changes.status || previous?.status || 'ACTIVE', provenance: {source_id: 'authorized_user_input', actor_id: actor.id, observed_at: time, classification: 'USER_ATTESTED', provider_verified: false}};
  if (previous) rows[rows.indexOf(previous)] = row; else rows.push(row);
  domain.recordEvent(ctx, actor, entity, row, previous ? 'updated' : 'created');
  effects.push({entity, id: row.id, owner_id: row.owner_id, revision: row.revision, snapshot: clone(row), sha256: hash(row)});
  return row;
}
function revision(row, expected) { if (!row || row.revision !== expected) fail('commerce_revision_conflict', 'De bron is gewijzigd; controleer de actuele revisie', 409); }
function inventory(domain, ctx, actor, productId) {
  const stock = raw(domain, ctx, actor, 'commerce_inventory', productId);
  if (![stock.on_hand, stock.reserved, stock.quarantined].every(integer) || stock.reserved > stock.on_hand) fail('commerce_inventory_integrity', 'De voorraadregistratie kan niet worden geverifieerd', 409);
  return stock;
}
function move(domain, ctx, actor, productId, deltas, operation, evidence, orderId, effects) {
  const prior = inventory(domain, ctx, actor, productId);
  const values = Object.fromEntries(['on_hand', 'reserved', 'quarantined'].map(k => [k, safe(BigInt(prior[k]) + BigInt(deltas[k] || 0))]));
  if (values.reserved > values.on_hand) fail('commerce_stock_insufficient', 'Er is onvoldoende beschikbare voorraad', 409);
  const stock = revise(domain, ctx, actor, 'commerce_inventory', productId, {...values, available: values.on_hand - values.reserved}, effects);
  revise(domain, ctx, actor, 'commerce_movements', crypto.randomUUID(), {product_id: productId, ...(orderId ? {order_id: orderId} : {}), operation, deltas, inventory_revision_before: prior.revision, inventory_revision_after: stock.revision, evidence_reference: evidence, physical_verification: 'USER_ATTESTED', external_dispatch: false}, effects);
  return stock;
}
function totals(lines, quantityField = 'quantity') {
  let net = 0, taxes = 0;
  for (const line of lines) { const amount = safe(BigInt(line.unit_price_minor) * BigInt(line[quantityField])); net = add(net, amount); taxes = add(taxes, tax(amount, line.tax_rate_bps)); }
  return {net_minor: net, tax_minor: taxes, gross_minor: add(net, taxes)};
}
function apply(domain, ctx, actor, operation, input, effects) {
  const products = domain.bucket(ctx, 'commerce_products');
  if (operation === 'PRODUCT_SAVE') {
    const exists = products.some(r => r.id === input.product_id), old = exists ? raw(domain, ctx, actor, 'commerce_products', input.product_id) : null;
    if (old) revision(old, input.expected_revision); else if (input.expected_revision !== 0) fail('commerce_revision_conflict', 'Het artikel bestaat nog niet', 409);
    if (products.some(r => r.id !== input.product_id && r.sku.toLowerCase() === input.sku.toLowerCase())) fail('commerce_sku_conflict', 'Deze artikelcode is al in gebruik', 409);
    const value = Object.fromEntries(['sku', 'name', 'group_id', 'attributes', 'gtin', 'currency', 'unit_price_minor', 'tax_rate_bps'].filter(k => Object.hasOwn(input, k)).map(k => [k, clone(input[k])]));
    const row = revise(domain, ctx, actor, 'commerce_products', input.product_id, {...value, price_basis: 'EXCLUDING_TAX', attributes: input.attributes || {}}, effects);
    if (!old) revise(domain, ctx, actor, 'commerce_inventory', input.product_id, {product_id: input.product_id, on_hand: 0, reserved: 0, quarantined: 0, available: 0}, effects);
    return row;
  }
  if (operation === 'STOCK_RECEIVE') {
    const product = raw(domain, ctx, actor, 'commerce_products', input.product_id), stock = inventory(domain, ctx, actor, product.id);
    revision(product, input.expected_product_revision); revision(stock, input.expected_revision);
    return move(domain, ctx, actor, product.id, {on_hand: input.quantity}, operation, input.evidence_reference, null, effects);
  }
  if (operation === 'ORDER_RESERVE') {
    if (domain.bucket(ctx, 'commerce_orders').some(r => r.id === input.order_id)) fail('commerce_order_exists', 'Dit ordernummer is al in gebruik', 409);
    const lines = input.lines.map(line => {
      const product = raw(domain, ctx, actor, 'commerce_products', line.product_id), stock = inventory(domain, ctx, actor, product.id);
      revision(product, line.expected_product_revision); revision(stock, line.expected_inventory_revision);
      if (product.currency !== input.currency) fail('commerce_currency_conflict', 'Alle orderregels moeten dezelfde valuta hebben');
      if (stock.on_hand - stock.reserved < line.quantity) fail('commerce_stock_insufficient', 'Er is onvoldoende beschikbare voorraad', 409);
      return {product_id: product.id, product_revision: product.revision, sku: product.sku, name: product.name, attributes: clone(product.attributes), quantity: line.quantity, returned_quantity: 0, unit_price_minor: product.unit_price_minor, tax_rate_bps: product.tax_rate_bps};
    });
    const amount = totals(lines);
    for (const line of lines) move(domain, ctx, actor, line.product_id, {reserved: line.quantity}, operation, input.reason, input.order_id, effects);
    return revise(domain, ctx, actor, 'commerce_orders', input.order_id, {lines, totals: amount, currency: input.currency, customer_reference: input.customer_reference, customer_reference_authority: 'USER_SUPPLIED_NOT_CRM_VERIFIED', status: 'RESERVED', financial_status: 'UNPOSTED', external_dispatch: false, payment_verified: false, returned_totals: totals(lines, 'returned_quantity'), history: [{operation, actor_id: actor.id, at: at(domain), reason: input.reason}]}, effects);
  }
  const order = read(domain, ctx, actor, 'commerce_orders', input.order_id);
  revision(order, input.expected_revision);
  if (operation === 'ORDER_CANCEL' && order.invoice_id) fail('commerce_linked_invoice_requires_correction', 'Controleer eerst de gekoppelde factuur voordat deze order wordt geannuleerd', 409);
  if (['ORDER_CANCEL', 'ORDER_FULFILL'].includes(operation) && order.status !== 'RESERVED' || operation === 'ORDER_RETURN' && !['FULFILLED', 'PARTIALLY_RETURNED'].includes(order.status)) fail('commerce_transition_invalid', 'Deze orderstatus staat de actie niet toe', 409);
  let status, returned = order.returned_totals;
  if (operation === 'ORDER_RETURN') {
    for (const incoming of input.lines) {
      const line = order.lines.find(l => l.product_id === incoming.product_id);
      if (!line || incoming.quantity > line.quantity - line.returned_quantity) fail('commerce_return_exceeds_fulfilled', 'Het retouraantal overschrijdt de resterende geleverde hoeveelheid', 409);
      line.returned_quantity += incoming.quantity;
      move(domain, ctx, actor, line.product_id, {[incoming.disposition === 'RESTOCK' ? 'on_hand' : 'quarantined']: incoming.quantity}, operation, input.evidence_reference, order.id, effects);
    }
    returned = totals(order.lines, 'returned_quantity');
    status = order.lines.every(l => l.returned_quantity === l.quantity) ? 'RETURNED' : 'PARTIALLY_RETURNED';
  } else {
    for (const line of order.lines) move(domain, ctx, actor, line.product_id, {reserved: -line.quantity, ...(operation === 'ORDER_FULFILL' ? {on_hand: -line.quantity} : {})}, operation, input.evidence_reference || input.reason, order.id, effects);
    status = operation === 'ORDER_CANCEL' ? 'CANCELLED' : 'FULFILLED';
  }
  return revise(domain, ctx, actor, 'commerce_orders', order.id, {lines: order.lines, status, returned_totals: returned, ...(operation === 'ORDER_RETURN' && order.invoice_id ? {financial_followup: 'RETURN_REVIEW_REQUIRED'} : {}), history: [...order.history, {operation, actor_id: actor.id, at: at(domain), reason: input.reason, ...(input.evidence_reference ? {evidence_reference: input.evidence_reference} : {}), ...(operation === 'ORDER_RETURN' ? {lines: clone(input.lines)} : {})}]}, effects);
}
function capacity(rows, entry) {
  if (rows.length >= 100000 || rows.reduce((n, r) => n + Buffer.byteLength(JSON.stringify(r)), Buffer.byteLength(JSON.stringify(entry))) > 64 * 1024 * 1024) fail('commerce_operation_capacity', 'De bewaarlimiet voor handelsaanvragen is bereikt', 507);
}
function receipt(domain, ctx, actor, entry) {
  if (entry.tenant_id !== ctx.tenant_id || entry.dealer_id !== ctx.dealer_id || entry.actor_id !== actor.id || entry.version !== 1) fail('commerce_receipt_invalid', 'De eerdere aanvraag kan niet worden geverifieerd', 409);
  if (entry.state === 'ABANDONED') return {state: 'NOT_APPLIED', request_id: entry.key, request_fingerprint: entry.fingerprint, result_snapshot: null, record: null};
  if (entry.state !== 'APPLIED' || !Array.isArray(entry.effects) || !entry.effects.length || entry.effects.length > 102) fail('commerce_receipt_invalid', 'De eerdere aanvraag kan niet worden geverifieerd', 409);
  const effects = entry.effects.map(effect => {
    if (!ENTITIES.includes(effect.entity) || hash(effect.snapshot) !== effect.sha256 || effect.snapshot.id !== effect.id || effect.snapshot.revision !== effect.revision || effect.snapshot.owner_id !== effect.owner_id || effect.snapshot.owned_entity !== effect.entity) fail('commerce_receipt_invalid', 'Het eerdere resultaat kan niet worden geverifieerd', 409);
    const current = read(domain, ctx, actor, effect.entity, effect.id);
    if (current.owner_id !== effect.owner_id || current.revision < effect.revision || current.revision === effect.revision && hash(current) !== effect.sha256) fail('commerce_receipt_invalid', 'Het oorspronkelijke eigenaarschap of resultaat is gewijzigd', 409);
    return {...clone(effect), current, is_current: current.revision === effect.revision};
  });
  const result = effects.find(e => e.entity === entry.result_entity && e.id === entry.result_id);
  if (!result) fail('commerce_receipt_invalid', 'De resultaatverwijzing ontbreekt', 409);
  return {state: 'APPLIED', request_id: entry.key, request_fingerprint: entry.fingerprint, result_snapshot: result.snapshot, record: result.current, result_is_current: effects.every(e => e.is_current), effects, external_dispatch: false, payment_verified: false};
}
function execute(domain, ctx, actor, operation, input, {idempotency_key: key} = {}) {
  scope(domain, ctx, actor, 'write'); validate(operation, input);
  if (!text(key, 200)) fail('commerce_request_required', 'Gebruik een unieke aanvraag-ID');
  const rows = domain.adapter.bucket(ctx, OPERATIONS), fingerprint = hash({operation, input}), prior = rows.find(r => r.actor_id === actor.id && r.key === key);
  if (prior) {
    if (prior.fingerprint !== fingerprint) fail('commerce_request_conflict', 'Deze aanvraag-ID hoort bij andere invoer', 409);
    if (prior.state === 'ABANDONED') fail('commerce_request_abandoned', 'De eerdere aanvraag is afgesloten zonder uitvoering', 409);
    return {...receipt(domain, ctx, actor, prior), deduplicated: true};
  }
  const result = mutate(domain, ctx, () => {
    const effects = [], record = apply(domain, ctx, actor, operation, input, effects);
    const entry = {version: 1, state: 'APPLIED', tenant_id: ctx.tenant_id, dealer_id: ctx.dealer_id, actor_id: actor.id, key, fingerprint, operation, result_entity: record.owned_entity, result_id: record.id, effects};
    capacity(rows, entry); rows.push(entry);
    return {...receipt(domain, ctx, actor, entry), deduplicated: false};
  });
  try { domain.flush(ctx, actor); } catch { result.event_delivery = 'QUEUED_RETRY'; }
  return result;
}
function recover(domain, ctx, actor, input) {
  scope(domain, ctx, actor, 'write');
  if (!keys(input, ['operation', 'input', 'request_id', 'confirm']) || input.confirm !== true || !text(input.request_id, 200)) fail('commerce_recovery_invalid', 'Bevestig de exacte eerdere handelsaanvraag');
  validate(input.operation, input.input);
  const rows = domain.adapter.bucket(ctx, OPERATIONS), fingerprint = hash({operation: input.operation, input: input.input}), prior = rows.find(r => r.actor_id === actor.id && r.key === input.request_id);
  if (prior) { if (prior.fingerprint !== fingerprint) fail('commerce_request_conflict', 'Deze aanvraag-ID hoort bij andere invoer', 409); return receipt(domain, ctx, actor, prior); }
  if (rows.some(r => r.key === input.request_id && r.fingerprint === fingerprint)) fail('commerce_recovery_invalid', 'De eerdere aanvraag kan niet worden geverifieerd', 409);
  const entry = {version: 1, state: 'ABANDONED', tenant_id: ctx.tenant_id, dealer_id: ctx.dealer_id, actor_id: actor.id, key: input.request_id, fingerprint, operation: input.operation};
  capacity(rows, entry);
  return mutate(domain, ctx, () => { rows.push(entry); domain.adapter.audit(ctx, actor, 'COMMERCE_REQUEST_ABANDONED', 'sales', null, {request_id: input.request_id}); return receipt(domain, ctx, actor, entry); });
}
module.exports = {ENTITIES, OPERATIONS, ACTIONS, scope, read, list, readable, validate, execute, recover, hash};
