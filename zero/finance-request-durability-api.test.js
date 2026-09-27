'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const {fixture} = require('../zero-evaluation/fixture'), {input} = require('../zero-evaluation/finance-mutation-fixture');
const overrides = {NODE_OPTIONS: '--require ' + require.resolve('../zero-evaluation/finance-http-faults')};
async function setup(s, name) {
  assert.equal((await s.request('/api/composition', 'PUT', {entitlements: ['finance'], expected_revision: 0})).status, 200);
  const member = await s.enroll(name, ['FINANCE_ADMIN']);
  const call = (route, method = 'GET', body, headers = {}) => s.request('/api/finance/' + route, method, body, member.cookie, headers);
  const made = await call('legal-entities', 'POST', {name: 'Private financial test business', legal_form: 'BV', currency: 'EUR'}, {'idempotency-key': 'native-finance-entity'});
  assert.equal(made.status, 201, JSON.stringify(made.body)); const entity = made.body;
  assert.equal((await call('periods', 'POST', {legal_entity_id: entity.id, start_date: '2026-01-01', end_date: '2026-12-31'}, {'idempotency-key': 'native-finance-period'})).status, 201);
  const chart = await call('legal-entities/' + entity.id + '/bootstrap-chart', 'POST', {}, {'idempotency-key': 'native-finance-chart'});
  assert.equal(chart.status, 201, JSON.stringify(chart.body)); assert.equal(chart.body.accounts.length, 9);
  return {member, call, entity};
}
test('real native invoice and payment recover actually dropped replies after encrypted restart and retain exactly one ledger effect', async () => {
  const s = await fixture(overrides);
  try {
    const f = await setup(s, 'finance.dropped.reply'), payload = input(f), headers = {'idempotency-key': 'native-invoice-lost-reply'};
    payload.customer_name = 'PRIVATE-CUSTOMER-DURABLE-FIXTURE';
    await assert.rejects(f.call('invoices', 'POST', payload, {...headers, 'x-fixture-finance-drop': 'committed-reply'}));
    let rows = await f.call('records/invoices'); assert.equal(rows.body.total, 1, JSON.stringify(rows.body));
    const id = rows.body.items[0].id;
    await s.stop(); await s.start(); f.member.cookie = await s.login(f.member);
    const replay = await f.call('invoices', 'POST', payload, headers);
    assert.equal(replay.status, 201, JSON.stringify(replay.body)); assert.equal(replay.body.invoice.id, id); assert.equal(replay.body.idempotent_replay, true);
    const posted = await f.call('invoices/' + id + '/post', 'POST'); assert.equal(posted.status, 200, JSON.stringify(posted.body));
    const payment = {invoice_id: id, amount_cents: 12100, date: '2026-09-26', reference: 'Explicit native manual observation'}, payHeaders = {'idempotency-key': 'native-payment-lost-reply'};
    await assert.rejects(f.call('payments', 'POST', payment, {...payHeaders, 'x-fixture-finance-drop': 'committed-reply'}));
    await s.stop(); await s.start(); f.member.cookie = await s.login(f.member);
    const paid = await f.call('payments', 'POST', payment, payHeaders);
    assert.equal(paid.status, 201, JSON.stringify(paid.body)); assert.equal(paid.body.idempotent_replay, true); assert.equal(paid.body.invoice.status, 'PAID');
    assert.equal((await f.call('records/payments')).body.total, 1); assert.equal((await f.call('records/journal_entries')).body.total, 2);
    const original = await f.call('invoices/' + id + '/post', 'POST');
    assert.equal(original.body.invoice.status, 'POSTED'); assert.equal(original.body.replay_semantics, 'ORIGINAL_COMMITTED_RESULT_NOT_CURRENT_STATE');
    assert.equal((await f.call('records/invoices')).body.items[0].status, 'PAID');
    assert.equal((await f.call('records/idempotency')).status, 404); assert.equal((await f.call('records/mutation_event_outbox')).status, 404);
    for (const filename of fs.readdirSync(s.dir)) {
      const file = path.join(s.dir, filename);
      if (fs.statSync(file).isFile()) assert.ok(!fs.readFileSync(file, 'utf8').includes(payload.customer_name), 'Customer and receipt contents stay encrypted on disk');
    }
    assert.equal((await s.request('/api/composition', 'PUT', {entitlements: ['finance'], capability_flags: {'finance:ledger': false}, expected_revision: 1})).status, 200);
    assert.equal((await f.call('payments', 'POST', payment, payHeaders)).status, 403);
    const reports = await f.call('reports'); assert.equal(reports.status, 200); assert.equal(reports.body.profit_and_loss.revenue_cents, 10000);
  } finally {await s.close();}
});

test('native Finance rechecks a real current session after a delayed request body before creating an invoice', async () => {
  const s = await fixture(overrides); let pending;
  try {
    const f = await setup(s, 'finance.body.revocation'), payload = JSON.stringify(input(f)), marker = path.join(s.dir, 'finance-body-boundary');
    const response = new Promise((resolve, reject) => {
      pending = http.request(s.base + '/api/finance/invoices', {method: 'POST', headers: {cookie: f.member.cookie, origin: 'https://foundly.example.test', 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload), 'x-fixture-finance-barrier': 'body', 'idempotency-key': 'revoked-finance-request'}}, res => {
        let body = ''; res.on('data', bytes => body += bytes); res.on('end', () => resolve({status: res.statusCode, body}));
      }); pending.on('error', reject); pending.write(payload.slice(0, 5));
    });
    for (let n = 0; n < 100 && !fs.existsSync(marker); n++) await new Promise(resolve => setTimeout(resolve, 10));
    assert.ok(fs.existsSync(marker), 'Authenticated handler is awaiting this incomplete body');
    const changed = await s.request('/api/identity/users/' + f.member.member.id, 'PUT', {roles: ['VIEWER'], expected_revision: f.member.member.revision, confirm: true, reason: 'Explicitly revoke authority at the body boundary'});
    assert.equal(changed.status, 200, JSON.stringify(changed.body)); pending.end(payload.slice(5));
    assert.equal((await response).status, 401);
    assert.equal((await s.request('/api/finance/records/invoices')).body.total, 0);
    await s.stop(); await s.start(); assert.equal((await s.request('/api/finance/records/invoices')).body.total, 0);
  } finally {pending?.destroy(); await s.close();}
});
