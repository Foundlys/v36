'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), crypto = require('node:crypto'), fs = require('node:fs'), path = require('node:path');
const {fixture} = require('../zero-evaluation/fixture'), {input} = require('../zero-evaluation/finance-mutation-fixture');
for (const industry of ['AUTOMOTIVE', 'ECOMMERCE']) test(industry + ' ZERO allocates and records an internal credit refund through lost replies and encrypted restarts', async () => {
  const s = await fixture({NODE_OPTIONS: '--require ' + require.resolve('../zero-evaluation/finance-http-faults')});
  try {
    assert.equal((await s.request('/api/composition', 'PUT', {industry_id: industry, entitlements: ['finance'], expected_revision: 0})).status, 200);
    const member = await s.enroll('settlement.demo.' + industry.toLowerCase(), ['FINANCE_ADMIN']);
    const call = (route, method = 'GET', body, headers = {}) => s.request(route, method, body, member.cookie, headers);
    const entity = (await call('/api/finance/legal-entities', 'POST', {name: '[SYNTHETIC DEMO] Settlement source', legal_form: 'BV'})).body;
    assert.equal((await call('/api/finance/periods', 'POST', {legal_entity_id: entity.id, start_date: '2026-01-01', end_date: '2026-12-31'})).status, 201);
    assert.equal((await call('/api/finance/legal-entities/' + entity.id + '/bootstrap-chart', 'POST', {})).status, 201);
    const tools = (await call('/api/zero/status')).body.tools.map(t => t.tool_id);
    assert.ok(tools.includes('finance_credit_allocate_execute')); assert.ok(tools.includes('finance_credit_refund_record_recover'));
    const turn = (operation, value) => ({message: 'Voer alleen deze afzonderlijk bevestigde interne demohandeling uit', conversation_id: crypto.randomUUID(), turn_id: crypto.randomUUID(), client_context: {finance_action: {operation, input: value}}});
    async function prepare(operation, value) {
      const r = await call('/api/zero/turn', 'POST', turn(operation + '_PREVIEW', value));
      assert.equal(r.status, 200, JSON.stringify(r.body)); assert.equal(r.body.finance_data.ready, true, JSON.stringify(r.body.finance_data));
      return {input: value, request_id: crypto.randomUUID(), expected_source_hash: r.body.finance_data.source_hash, confirm: true, reason: '[SYNTHETIC DEMO] Exact source and amount approved'};
    }
    async function execute(operation, value) {
      const r = await call('/api/zero/turn', 'POST', turn(operation + '_EXECUTE', await prepare(operation, value)));
      assert.equal(r.status, 200, JSON.stringify(r.body)); return r.body.finance_data;
    }
    async function lostThenRecover(operation, value) {
      const command = await prepare(operation, value), body = turn(operation + '_EXECUTE', command);
      await assert.rejects(call('/api/zero/turn', 'POST', body, {'x-fixture-finance-drop': 'committed-reply'}));
      await s.stop(); await s.start(); member.cookie = await s.login(member);
      const r = await call('/api/zero/turn', 'POST', body); assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.equal(r.body.finance_data.deduplicated, true); assert.equal(r.body.actions[0].performed_now, false);
      assert.equal(r.body.finance_data.original_result_is_current, true); assert.equal(r.body.verification.external_payment_performed, false); assert.equal(r.body.verification.bank_settlement_verified, false);
      assert.ok(!JSON.stringify((await call('/api/zero/conversation/' + body.conversation_id)).body).includes('PRIVATE_SETTLEMENT_CUSTOMER'));
      return {command, response: r.body};
    }
    const sale = (await execute('INVOICE_CREATE', {...input({entity}), customer_name: 'PRIVATE_SETTLEMENT_CUSTOMER'})).current_invoice;
    await execute('INVOICE_POST', {invoice_id: sale.id});
    await execute('PAYMENT_RECORD', {invoice_id: sale.id, amount_cents: 6000, currency: 'EUR', date: '2026-09-10'});
    const credit = (await execute('CREDIT_NOTE_CREATE', {invoice_id: sale.id, invoice_number: 'ZERO-SETTLEMENT-001', invoice_date: '2026-09-20', supply_date: '2026-09-01', due_date: '2026-09-20'})).current_invoice;
    await execute('INVOICE_POST', {invoice_id: credit.id});
    const allocation = await lostThenRecover('CREDIT_ALLOCATE', {credit_note_id: credit.id, invoice_id: sale.id, amount_cents: 6100, currency: 'EUR', date: '2026-09-20', reference: 'Explicit credit allocation'});
    assert.equal(allocation.response.finance_data.financial_posting_performed, false); assert.equal(allocation.response.finance_data.current_invoice.status, 'PARTIALLY_SETTLED'); assert.equal(allocation.response.finance_data.current_result.related_invoice.status, 'SETTLED');
    assert.equal((await call('/api/finance/records/journal_entries?limit=100')).body.total, 3);
    const refund = await lostThenRecover('CREDIT_REFUND_RECORD', {credit_note_id: credit.id, amount_cents: 6000, currency: 'EUR', date: '2026-09-20', reference: 'Explicit internal outgoing refund; no transfer'});
    assert.equal(refund.response.finance_data.current_invoice.status, 'SETTLED'); assert.equal(refund.response.finance_data.financial_posting_performed, true);
    assert.equal(refund.response.verification.financial_posting_performed, false); assert.equal(refund.response.verification.original_financial_posting_performed, true);
    const prior = await call('/api/zero/turn', 'POST', turn('CREDIT_ALLOCATE_RECOVER', allocation.command)); assert.equal(prior.status, 200, JSON.stringify(prior.body));
    assert.equal(prior.body.finance_data.original_result.invoice.status, 'PARTIALLY_SETTLED'); assert.equal(prior.body.finance_data.current_invoice.status, 'SETTLED'); assert.equal(prior.body.finance_data.original_result_is_current, false);
    const settlements = (await call('/api/finance/records/credit_settlements?limit=100')).body; assert.equal(settlements.total, 2);
    assert.deepEqual(settlements.items.map(r => r.kind).sort(), ['ALLOCATION', 'INTERNAL_REFUND']); assert.ok(settlements.items.every(r => r.external_payment_performed === false && r.bank_settlement_verified === false));
    const journals = (await call('/api/finance/records/journal_entries?limit=100')).body; assert.equal(journals.total, 4); assert.ok(journals.items.every(j => j.debit_cents === j.credit_cents));
    assert.equal((await call('/api/finance/records/invoices?limit=100')).body.total, 2); assert.equal((await call('/api/finance/records/payments')).body.total, 1); assert.equal((await call('/api/finance/records/bank_transactions')).body.total, 0);
    assert.equal((await call('/api/finance/counterparty-balances')).body.items.length, 0);
    assert.ok(!fs.readFileSync(path.join(s.dir, 'foundly-core-state.json'), 'utf8').includes('PRIVATE_SETTLEMENT_CUSTOMER'));
    assert.equal((await s.request('/api/composition', 'PUT', {industry_id: industry, entitlements: ['finance'], capability_flags: {'finance:payments': false}, expected_revision: 1})).status, 200);
    for (const [operation, command] of [['CREDIT_ALLOCATE', allocation.command], ['CREDIT_REFUND_RECORD', refund.command]]) {
      assert.equal((await call('/api/zero/turn', 'POST', turn(operation + '_RECOVER', command))).status, 403);
    }
    assert.equal((await call('/api/finance/records/credit_settlements')).status, 403);
    assert.ok(!(await call('/api/zero/status')).body.tools.some(t => t.tool_id.startsWith('finance_credit_allocate') || t.tool_id.startsWith('finance_credit_refund_record')));
  } finally {await s.close();}
});
