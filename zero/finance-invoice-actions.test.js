'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const {fixture, input, posted} = require('../zero-evaluation/finance-mutation-fixture');
const {SCOPE} = require('../finance-invoice-actions');
const {fixture: server} = require('../zero-evaluation/fixture');
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
function command(f, operation, payload, request_id = crypto.randomUUID()) {
  const result = f.core.previewInvoiceAction(f.ctx, f.actor, {operation, input: payload});
  assert.equal(result.ready, true, JSON.stringify(result));
  return {operation, input: payload, request_id, expected_source_hash: result.source_hash, confirm: true, reason: 'Explicit internal fixture action'};
}

test('native confirmed Finance actions bind current source, preserve original/current state and never claim an external bank transfer', () => {
  const f = fixture(), writes = f.count(), create = command(f, 'INVOICE_CREATE', input(f));
  assert.equal(f.count(), writes, 'Preparation does not write');
  const first = f.core.executeInvoiceAction(f.ctx, f.actor, create);
  assert.equal(first.current_invoice.status, 'DRAFT'); assert.equal(first.original_result_is_current, true);
  assert.equal(first.financial_posting_performed, false);
  const post = command(f, 'INVOICE_POST', {invoice_id: first.current_invoice.id});
  f.core.executeInvoiceAction(f.ctx, f.actor, post);
  const payment = command(f, 'PAYMENT_RECORD', {invoice_id: first.current_invoice.id, amount_cents: 12100, date: '2026-09-26'});
  const paid = f.core.executeInvoiceAction(f.ctx, f.actor, payment);
  assert.equal(paid.current_invoice.status, 'PAID'); assert.equal(paid.financial_posting_performed, true);
  assert.equal(paid.external_payment_performed, false); assert.equal(paid.bank_settlement_verified, false);
  f.restart(); const before = f.snapshot();
  const old = f.core.recoverInvoiceAction(f.ctx, f.actor, create);
  assert.equal(old.original_result.invoice.status, 'DRAFT'); assert.equal(old.current_invoice.status, 'PAID'); assert.equal(old.original_result_is_current, false);
  assert.equal(f.core.executeInvoiceAction(f.ctx, f.actor, payment).deduplicated, true); assert.equal(f.snapshot(), before);
  assert.throws(() => f.core.executeInvoiceAction(f.ctx, f.actor, {...payment, input: {...payment.input, amount_cents: 1}}), {code: 'finance_action_request_conflict'});
});

test('stale prepared payments and a failed atomic confirmed posting cannot partially change the ledger or receipts', () => {
  const f = fixture(), invoice = posted(f).invoice;
  const action = command(f, 'PAYMENT_RECORD', {invoice_id: invoice.id, amount_cents: 100, date: '2026-09-26'});
  f.core.recordPayment(f.ctx, f.actor, {invoice_id: invoice.id, amount_cents: 200, date: '2026-09-26'});
  const before = f.snapshot();
  assert.throws(() => f.core.executeInvoiceAction(f.ctx, f.actor, action), {code: 'finance_action_source_changed'}); assert.equal(f.snapshot(), before);
  const current = command(f, 'PAYMENT_RECORD', action.input); f.failNext(); const emitted = f.emitted.length;
  assert.throws(() => f.core.executeInvoiceAction(f.ctx, f.actor, current), /injected durable persistence failure/);
  assert.equal(f.snapshot(), before); assert.equal(f.emitted.length, emitted);
  assert.equal(f.core.executeInvoiceAction(f.ctx, f.actor, current).current_invoice.paid_cents, 300);
  assert.equal(f.rows('payments').length, 2); assert.equal(f.rows('journal_entries').length, 3);
});

test('unseen confirmed request recovery is durable non-execution and blocks a delayed original even after restart', () => {
  const f = fixture(), action = command(f, 'INVOICE_CREATE', input(f));
  const closed = f.core.recoverInvoiceAction(f.ctx, f.actor, action);
  assert.equal(closed.state, 'NOT_APPLIED'); assert.equal(closed.financial_posting_performed, false); assert.equal(f.rows('invoices').length, 0);
  f.restart(); const before = f.snapshot();
  assert.throws(() => f.core.executeInvoiceAction(f.ctx, f.actor, action), {code: 'finance_action_abandoned'});
  assert.equal(f.core.recoverInvoiceAction(f.ctx, f.actor, action).state, 'NOT_APPLIED'); assert.equal(f.snapshot(), before);
  f.actor.roles = ['VIEWER']; assert.throws(() => f.core.recoverInvoiceAction(f.ctx, f.actor, action), {statusCode: 403});
});

test('confirmed request hashes reject altered proof and readiness exposes missing account mappings without writing', () => {
  const f = fixture(), create = command(f, 'INVOICE_CREATE', input(f));
  const result = f.core.executeInvoiceAction(f.ctx, f.actor, create);
  f.rows('accounts').find(row => row.system_role === 'AR').active = false;
  const writes = f.count(), review = f.core.previewInvoiceAction(f.ctx, f.actor, {operation: 'INVOICE_POST', input: {invoice_id: result.current_invoice.id}});
  assert.equal(review.ready, false); assert.ok(review.blockers.includes('ACCOUNT_MAPPING_INVALID')); assert.equal(f.count(), writes);
  f.adapter.bucket(f.ctx, SCOPE)[0].result.invoice.gross_cents++;
  const before = f.snapshot(); assert.throws(() => f.core.recoverInvoiceAction(f.ctx, f.actor, create), {code: 'finance_action_receipt_invalid'}); assert.equal(f.snapshot(), before);
});

test('real HTTP and ZERO use the same confirmed invoice/payment contract through reply loss, restart, recovery and capability revocation', async () => {
  const s = await server({NODE_OPTIONS: '--require ' + JSON.stringify(require.resolve('../zero-evaluation/finance-http-faults'))});
  try {
    assert.equal((await s.request('/api/composition', 'PUT', {entitlements: ['finance'], expected_revision: 0})).status, 200);
    const member = await s.enroll('finance.zero.actions', ['FINANCE_ADMIN']);
    const call = (route, method = 'GET', body, headers = {}) => s.request(route, method, body, member.cookie, headers);
    const made = await call('/api/finance/legal-entities', 'POST', {name: 'Native ZERO finance fixture', legal_form: 'BV'}); assert.equal(made.status, 201, JSON.stringify(made.body));
    const entity = made.body;
    assert.equal((await call('/api/finance/periods', 'POST', {legal_entity_id: entity.id, start_date: '2026-01-01', end_date: '2026-12-31'})).status, 201);
    assert.equal((await call('/api/finance/legal-entities/' + entity.id + '/bootstrap-chart', 'POST', {})).status, 201);
    async function prepare(operation, payload) {
      const response = await call('/api/finance/invoice-actions/preview', 'POST', {operation, input: payload});
      assert.equal(response.status, 200, JSON.stringify(response.body)); assert.equal(response.body.ready, true, JSON.stringify(response.body));
      return {input: payload, request_id: crypto.randomUUID(), expected_source_hash: response.body.source_hash, confirm: true, reason: 'Explicit confirmed native ZERO test action'};
    }
    const turn = (operation, value) => ({message: 'Voer de expliciet bevestigde Finance-actie uit', conversation_id: crypto.randomUUID(), turn_id: crypto.randomUUID(), client_context: {finance_action: {operation, input: value}}});
    const invoiceInput = input({entity}); invoiceInput.customer_name = 'PRIVATE_ZERO_INVOICE';
    const command = await prepare('INVOICE_CREATE', invoiceInput), createTurn = turn('INVOICE_CREATE_EXECUTE', command);
    await assert.rejects(call('/api/zero/turn', 'POST', createTurn, {'x-fixture-finance-drop': 'committed-reply'}));
    await s.stop(); await s.start(); member.cookie = await s.login(member);
    const recovered = await call('/api/zero/turn', 'POST', createTurn);
    assert.equal(recovered.status, 200, JSON.stringify(recovered.body)); assert.equal(recovered.body.finance_data.deduplicated, true);
    assert.equal(recovered.body.actions[0].performed_now, false); const id = recovered.body.finance_data.current_invoice.id;
    const posting = await prepare('INVOICE_POST', {invoice_id: id});
    const post = await call('/api/zero/turn', 'POST', turn('INVOICE_POST_EXECUTE', posting));
    assert.equal(post.status, 200, JSON.stringify(post.body)); assert.equal(post.body.verification.financial_posting_performed, true);
    const payment = await prepare('PAYMENT_RECORD', {invoice_id: id, amount_cents: 12100, date: '2026-09-26'}), paymentTurn = turn('PAYMENT_RECORD_EXECUTE', payment);
    const paid = await call('/api/zero/turn', 'POST', paymentTurn);
    assert.equal(paid.status, 200, JSON.stringify(paid.body)); assert.equal(paid.body.finance_data.current_invoice.status, 'PAID'); assert.equal(paid.body.verification.external_payment_performed, false);
    const again = await call('/api/zero/turn', 'POST', paymentTurn);
    assert.equal(again.body.finance_data.deduplicated, true); assert.equal(again.body.verification.financial_posting_performed, false);
    const original = await call('/api/finance/invoice-actions/recover', 'POST', {...command, operation: 'INVOICE_CREATE'});
    assert.equal(original.body.original_result.invoice.status, 'DRAFT'); assert.equal(original.body.current_invoice.status, 'PAID'); assert.equal(original.body.original_result_is_current, false);
    assert.equal((await call('/api/finance/records/invoices')).body.total, 1); assert.equal((await call('/api/finance/records/payments')).body.total, 1); assert.equal((await call('/api/finance/records/journal_entries')).body.total, 2);
    const events = await s.request('/api/platform/events?limit=100&entity_id=' + id); assert.equal(events.status, 200); assert.equal(events.body.items.length, 2, JSON.stringify(events.body)); assert.ok(events.body.items.every(row => row.actor_id === member.member.id));
    assert.ok(!JSON.stringify((await call('/api/zero/conversation/' + createTurn.conversation_id)).body).includes('PRIVATE_ZERO_INVOICE'));
    assert.equal((await call('/api/finance/records/action_requests')).status, 404);
    const absent = await prepare('INVOICE_CREATE', {...invoiceInput, invoice_number: 'NEVER-EXECUTED'});
    const delayedBody = JSON.stringify({...absent, operation: 'INVOICE_CREATE'}), marker = path.join(s.dir, 'finance-body-boundary'); let pending;
    try {
      const response = new Promise((resolve, reject) => {
        pending = http.request(s.base + '/api/finance/invoice-actions/execute', {method: 'POST', headers: {cookie: member.cookie, origin: 'https://foundly.example.test', 'content-type': 'application/json', 'content-length': Buffer.byteLength(delayedBody), 'x-fixture-finance-barrier': 'body'}}, res => {
          let body = ''; res.on('data', bytes => body += bytes); res.on('end', () => resolve({status: res.statusCode, body: JSON.parse(body)}));
        }); pending.on('error', reject); pending.write(delayedBody.slice(0, 5));
      });
      for (let n = 0; n < 100 && !fs.existsSync(marker); n++) await new Promise(resolve => setTimeout(resolve, 10));
      assert.ok(fs.existsSync(marker), 'Original authorized action is waiting for its body');
      const absentTurn = turn('INVOICE_CREATE_RECOVER', absent), absentResult = await call('/api/zero/turn', 'POST', absentTurn);
      assert.equal(absentResult.status, 200, JSON.stringify(absentResult.body)); assert.equal(absentResult.body.finance_data.state, 'NOT_APPLIED'); assert.deepEqual(absentResult.body.actions, []);
      pending.end(delayedBody.slice(5)); const late = await response;
      assert.equal(late.status, 409); assert.equal(late.body.code, 'finance_action_abandoned');
    } finally {pending?.destroy();}
    assert.equal((await call('/api/zero/turn', 'POST', turn('INVOICE_CREATE_EXECUTE', absent))).status, 409);
    assert.equal((await s.request('/api/composition', 'PUT', {entitlements: ['finance'], capability_flags: {'finance:payments': false}, expected_revision: 1})).status, 200);
    assert.equal((await call('/api/zero/turn', 'POST', paymentTurn)).status, 403);
    const tools = (await call('/api/zero/status')).body.tools;
    assert.ok(!tools.some(row => row.tool_id.startsWith('finance_payment_record'))); assert.ok(tools.some(row => row.tool_id === 'finance_invoice_create_execute'));
  } finally {await s.close();}
});
