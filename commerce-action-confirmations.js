'use strict';

// Retain an owned, explicitly confirmed command before a browser can lose its
// connection. This store changes no stock, order, invoice or dispatch state.
const commerce = require('./sales-commerce');
const {scopedMutation} = require('./scoped-mutation');
const SCOPE = 'sales:commerce_confirmations';
const clone = value => JSON.parse(JSON.stringify(value));
const fail = (code, message, statusCode = 409) => {throw Object.assign(Error(message), {code, statusCode});};
function command(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !['operation', 'input', 'request_id', 'confirm'].includes(key)) || value.confirm !== true || typeof value.request_id !== 'string' || !/^[A-Za-z0-9_.:-]{8,200}$/.test(value.request_id) || JSON.stringify(value).length > 66000) fail('commerce_confirmation_invalid', 'Kies de exacte bevestigde handelsaanvraag', 422);
  commerce.validate(value.operation, value.input);
  return clone(value);
}
function sources(domain, ctx, actor, action) {
  const input = action.input, product = id => commerce.read(domain, ctx, actor, 'commerce_products', id);
  if (action.operation === 'PRODUCT_SAVE') {
    if (input.expected_revision !== 0 || domain.bucket(ctx, 'commerce_products').some(row => row.id === input.product_id)) product(input.product_id);
  } else if (action.operation === 'STOCK_RECEIVE') {
    product(input.product_id); commerce.read(domain, ctx, actor, 'commerce_inventory', input.product_id);
  } else if (action.operation === 'ORDER_RESERVE') {
    for (const line of input.lines) {product(line.product_id); commerce.read(domain, ctx, actor, 'commerce_inventory', line.product_id);}
    if (domain.bucket(ctx, 'commerce_orders').some(row => row.id === input.order_id)) commerce.read(domain, ctx, actor, 'commerce_orders', input.order_id);
  } else commerce.read(domain, ctx, actor, 'commerce_orders', input.order_id);
}
const proof = row => commerce.hash({tenant_id: row.tenant_id, dealer_id: row.dealer_id, actor_id: row.actor_id, command: row.command, status: row.status, created_at: row.created_at});
function verify(row, ctx, actor) {
  if (row.version !== 1 || row.tenant_id !== ctx.tenant_id || row.dealer_id !== ctx.dealer_id || row.actor_id !== actor.id || row.request_id !== row.command?.request_id || row.operation !== row.command?.operation || row.command_hash !== commerce.hash(row.command) || !['PENDING', 'ACKNOWLEDGED'].includes(row.status) || row.proof_hash !== proof(row)) fail('commerce_confirmation_invalid', 'De bewaarde bevestiging kan niet worden geverifieerd');
  command(row.command);
}
const output = row => ({operation: row.operation, request_id: row.request_id, status: row.status, created_at: row.created_at, command: clone(row.command), source_records_modified: false, external_dispatch: false, payment_verified: false});
function find(domain, ctx, actor, action) {
  const rows = domain.adapter.bucket(ctx, SCOPE).filter(row => row.actor_id === actor.id && row.request_id === action.request_id);
  if (rows.length > 1) fail('commerce_confirmation_invalid', 'De bevestigingsidentiteit is niet uniek');
  const row = rows[0];if (!row) return null;
  verify(row, ctx, actor);
  if (row.command_hash !== commerce.hash(action)) fail('commerce_request_conflict', 'Deze aanvraag-ID hoort bij andere invoer');
  return row;
}
function remember(domain, ctx, actor, value) {
  commerce.scope(domain, ctx, actor, 'write');const action = command(value);sources(domain, ctx, actor, action);
  const existing = find(domain, ctx, actor, action);
  if (existing) return {ok: true, ...output(existing), deduplicated: true};
  const prior = commerce.inspect(domain, ctx, actor, action);
  if (['APPLIED', 'NOT_APPLIED'].includes(prior.state)) return {ok: true, operation: action.operation, request_id: action.request_id, status: 'ACKNOWLEDGED', command: action, deduplicated: true, source_records_modified: false, external_dispatch: false, payment_verified: false};
  const row = {version: 1, tenant_id: ctx.tenant_id, dealer_id: ctx.dealer_id, actor_id: actor.id, operation: action.operation, request_id: action.request_id, command: action, command_hash: commerce.hash(action), status: 'PENDING', created_at: (domain.adapter.now?.() || new Date()).toISOString()};row.proof_hash = proof(row);
  const rows = domain.adapter.bucket(ctx, SCOPE);
  if (rows.length >= 100000 || rows.reduce((n, item) => n + Buffer.byteLength(JSON.stringify(item)), Buffer.byteLength(JSON.stringify(row))) > 64 * 1024 * 1024) fail('commerce_confirmation_capacity', 'De bewaarlimiet voor bevestigingen is bereikt', 507);
  return scopedMutation(domain.adapter, ctx, [SCOPE, 'platform:audit'], () => {
    rows.push(row);domain.adapter.audit(ctx, actor, 'COMMERCE_RETAIN_CONFIRMATION', 'sales', action.request_id, {operation: action.operation});
    return {ok: true, ...output(row), deduplicated: false};
  });
}
function list(domain, ctx, actor, query = {}) {
  commerce.scope(domain, ctx, actor, 'write');
  if (!query || typeof query !== 'object' || Array.isArray(query) || Object.keys(query).some(key => !['operation', 'cursor', 'limit'].includes(key)) || query.operation !== undefined && !commerce.ACTIONS.includes(query.operation)) fail('commerce_confirmation_invalid', 'Kies een begrensde bevestigingslijst', 422);
  const parse = (v, fallback) => v === undefined ? fallback : typeof v === 'number' ? v : /^\d+$/.test(v) ? Number(v) : NaN, cursor = parse(query.cursor, 0), limit = parse(query.limit, 10);
  if (!Number.isSafeInteger(cursor) || cursor < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 50) fail('commerce_confirmation_invalid', 'Kies een geldige bevestigingspagina', 422);
  const rows = domain.adapter.bucket(ctx, SCOPE).filter(row => row.actor_id === actor.id && (query.operation === undefined || row.operation === query.operation));
  for (const row of rows) verify(row, ctx, actor);
  const pending = rows.filter(row => row.status === 'PENDING'), page = pending.slice(cursor, cursor + limit);
  for (const row of page) sources(domain, ctx, actor, row.command);
  return {ok: true, items: page.map(output), total: pending.length, cursor, next_cursor: cursor + page.length < pending.length ? cursor + page.length : null, read_only: true, source_records_modified: false};
}
function acknowledge(domain, ctx, actor, value) {
  commerce.scope(domain, ctx, actor, 'write');const action = command(value), row = find(domain, ctx, actor, action), result = commerce.inspect(domain, ctx, actor, action);
  if (!['APPLIED', 'NOT_APPLIED'].includes(result.state)) fail('commerce_confirmation_unresolved', 'Controleer eerst de oorspronkelijke aanvraag');
  if (row && row.status !== 'ACKNOWLEDGED') scopedMutation(domain.adapter, ctx, [SCOPE, 'platform:audit'], () => {row.status = 'ACKNOWLEDGED';row.proof_hash = proof(row);domain.adapter.audit(ctx, actor, 'COMMERCE_ACKNOWLEDGE_RESULT', 'sales', action.request_id, {operation: action.operation, state: result.state});});
  return {ok: true, operation: action.operation, request_id: action.request_id, status: 'ACKNOWLEDGED', state: result.state, source_records_modified: false, external_dispatch: false, payment_verified: false};
}
module.exports = {SCOPE, remember, list, acknowledge};
