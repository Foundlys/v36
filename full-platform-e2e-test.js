'use strict';

const assert = require('assert');
const fs = require('fs');
const { spawn } = require('child_process');

const PORT = 21100 + Math.floor(Math.random() * 150);
const base = `http://127.0.0.1:${PORT}`;
const dataDir = fs.mkdtempSync('/tmp/foundly-full-e2e-');
const password = 'foundly-full-e2e-password-2026';
const auth = `Basic ${Buffer.from(`foundly:${password}`).toString('base64')}`;
const serverEnv = {
  ...process.env,
  NODE_ENV: 'production',
  PORT: String(PORT),
  FOUNDLY_DATA_DIR: dataDir,
  FOUNDLY_PUBLIC_BASE_URL: 'https://foundly.example.test',
  FOUNDLY_ADMIN_USERNAME: 'foundly',
  FOUNDLY_ADMIN_PASSWORD: password,
  FOUNDLY_ENCRYPTION_KEY: 'foundly-full-e2e-encryption-key-2026-secure',
  FOUNDLY_TENANT_ID: 'tenant-full-e2e',
  FOUNDLY_DEALER_ID: 'business-full-e2e',
  FOUNDLY_CRM_USER_ID: 'admin-full-e2e',
  FOUNDLY_CRM_ROLES: 'ADMIN',
  FOUNDLY_PLATFORM_USER_ID: 'admin-full-e2e',
  FOUNDLY_PLATFORM_ROLES: 'ADMIN',
  FOUNDLY_WORKER_INTERVAL_MS: '99999999',
  META_PIXEL_ID: '123456789012345',
  META_CAPI_ACCESS_TOKEN: '',
  META_APP_ID: '',
  META_APP_SECRET: '',
  GOOGLE_CLIENT_ID: '',
  GOOGLE_CLIENT_SECRET: '',
  OPENAI_API_KEY: '',
  FOUNDLY_AI_API_KEY: ''
};

let child;
let logs = '';
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function start() {
  child = spawn(process.execPath, ['server.js'], { cwd: __dirname, env: serverEnv, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', chunk => { logs += chunk; });
  child.stderr.on('data', chunk => { logs += chunk; });
  for (let attempt = 0; attempt < 80; attempt++) {
    try { if ((await fetch(`${base}/api/health`)).ok) return; }
    catch {}
    await wait(75);
  }
  throw new Error(`server start timeout\n${logs}`);
}

async function stop() {
  if (!child) return;
  child.kill('SIGTERM');
  for (let attempt = 0; attempt < 50 && child.exitCode === null; attempt++) await wait(40);
  child = null;
}

async function call(route, options = {}) {
  const headers = { authorization: auth, ...(options.body ? { 'content-type': 'application/json' } : {}), ...(options.headers || {}) };
  const response = await fetch(base + route, { redirect: 'manual', ...options, headers });
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); }
  catch { body = text; }
  return { response, body, text };
}

async function createCrm(entity, payload, idempotencyKey) {
  const result = await call(`/api/crm/${entity}`, { method: 'POST', headers: { 'idempotency-key': idempotencyKey }, body: JSON.stringify(payload) });
  assert.equal(result.response.status, 201, `${entity} creation failed: ${result.text}`);
  return result.body.record;
}

function event(eventId, eventName, campaignId, overrides = {}) {
  return {
    event_id: eventId,
    event_name: eventName,
    occurred_at: new Date().toISOString(),
    source: 'meta_fixture',
    source_kind: 'browser',
    provider: 'meta',
    provider_verified: false,
    session_id: '1000000001',
    anonymous_id: 'anonymous-full-e2e',
    campaign_id: campaignId,
    utm_source: 'meta',
    utm_medium: 'paid_social',
    properties: { landing_page: 'https://example.test/e2e', event_source_url: 'https://example.test/e2e' },
    consent_context: { purpose: 'marketing_measurement', status: 'GRANTED', marketing_status: 'GRANTED', legal_basis: 'consent' },
    privacy_classification: 'PSEUDONYMOUS',
    ...overrides
  };
}

async function ingest(payload) {
  return call('/api/platform/events/ingest', { method: 'POST', headers: { 'idempotency-key': payload.event_id }, body: JSON.stringify(payload) });
}

(async () => {
  const campaignId = 'campaign-full-e2e';
  try {
    await start();

    for (const [id, name, properties] of [
      ['e2e-ad-impression-0001', 'ad_impression', { impressions: 1 }],
      ['e2e-ad-click-0001', 'ad_click', { clicks: 1 }],
      ['e2e-session-0001', 'session_started', { landing_page: 'https://example.test/e2e' }],
      ['e2e-form-0001', 'form_submitted', { form_id: 'lead-form-e2e' }],
      ['e2e-spend-0001', 'marketing_spend', { spend_cents: 2500 }]
    ]) {
      const result = await ingest(event(id, name, campaignId, { properties }));
      assert.equal(result.response.status, 202);
      assert.equal(result.body.deduplicated, false);
    }

    let result = await call('/api/crm/provision', { method: 'POST', headers: { 'idempotency-key': 'full-e2e-provision-0001' }, body: JSON.stringify({ business_name: 'Full E2E Business', country: 'NL', industry: 'professional services', segment: 'SMB', dashboard_preset: 'SALES' }) });
    assert.equal(result.response.status, 201);
    const pipeline = result.body.pipeline;
    const stages = result.body.stages;
    const company = await createCrm('companies', { name: 'Full E2E Customer BV' }, 'full-e2e-company-0001');
    const contact = await createCrm('contacts', { name: 'Full E2E Contact', email: 'full-e2e@example.test', company_id: company.id }, 'full-e2e-contact-0001');
    const lead = await createCrm('leads', { name: 'Full E2E Contact', email: 'full-e2e@example.test', contact_id: contact.id, company_id: company.id, campaign_id: campaignId, status: 'new', source_id: 'meta', score: 72 }, 'full-e2e-lead-0001');

    const metaLeadEvent = event('e2e-meta-lead-0001', 'lead_created', campaignId, { lead_id: lead.id, customer_id: contact.id, entity_type: 'lead', entity_id: lead.id, properties: { landing_page: 'https://example.test/e2e', event_source_url: 'https://example.test/e2e', value_cents: 0 } });
    result = await call('/api/measurement/meta/plan', { method: 'POST', body: JSON.stringify({ event: metaLeadEvent, identity: { email: 'full-e2e@example.test', external_id: contact.id } }) });
    assert.equal(result.body.canonical_event_id, metaLeadEvent.event_id);
    assert.equal(result.body.browser.status, 'CONFIGURED_UNVERIFIED');
    assert.equal(result.body.server.status, 'NOT_CONFIGURED');
    assert.equal(result.body.dedup.shared_event_id, metaLeadEvent.event_id);
    assert.equal(result.body.dedup.browser_and_server_same_identity, true);
    assert.equal(result.body.connected, false);
    result = await ingest(metaLeadEvent);
    assert.equal(result.body.deduplicated, false);
    result = await ingest(metaLeadEvent);
    assert.equal(result.body.deduplicated, true);

    result = await call(`/api/crm/leads/${lead.id}`, { method: 'PATCH', headers: { 'idempotency-key': 'full-e2e-lead-qualified-0001' }, body: JSON.stringify({ status: 'qualified', qualified_at: new Date().toISOString() }) });
    assert.equal(result.body.record.status, 'qualified');
    const activity = await createCrm('activities', { type: 'call', contact_id: contact.id, lead_id: lead.id, summary: 'Verified first contact' }, 'full-e2e-activity-0001');
    await createCrm('tasks', { title: 'Prepare verified proposal', contact_id: contact.id, lead_id: lead.id, status: 'OPEN' }, 'full-e2e-task-0001');
    await createCrm('appointments', { title: 'Verified sales appointment', contact_id: contact.id, lead_id: lead.id, scheduled_at: new Date(Date.now() + 86400000).toISOString(), status: 'SCHEDULED' }, 'full-e2e-appointment-0001');
    await createCrm('calls', { direction: 'OUTBOUND', contact_id: contact.id, lead_id: lead.id, occurred_at: new Date().toISOString(), summary: 'Verified contact attempt' }, 'full-e2e-call-0001');

    const deal = await createCrm('deals', { title: 'Full E2E verified deal', contact_id: contact.id, lead_id: lead.id, company_id: company.id, campaign_id: campaignId, pipeline_id: pipeline.id, stage_id: stages[0].id, status: 'OPEN', probability: 10, value: 250, margin: 90 }, 'full-e2e-deal-0001');
    result = await call(`/api/crm/deals/${deal.id}/stage`, { method: 'PATCH', headers: { 'x-foundly-event-id': 'full-e2e-stage-proposal-0001' }, body: JSON.stringify({ stage_id: stages[2].id }) });
    assert.equal(result.body.deal.stage_id, stages[2].id);
    result = await call(`/api/crm/deals/${deal.id}/stage`, { method: 'PATCH', headers: { 'x-foundly-event-id': 'full-e2e-stage-won-0001' }, body: JSON.stringify({ stage_id: stages[4].id }) });
    assert.equal(result.body.deal.status, 'WON');

    result = await call(`/api/crm/customers/${contact.id}/360`);
    assert.equal(result.body.customer.deals.length, 1);
    assert(result.body.customer.timeline.some(row => row.id === activity.id));
    assert(result.body.customer.timeline.length >= 4);
    result = await call(`/api/crm/pipelines/${pipeline.id}/board`);
    assert(result.body.board.stages.find(stage => stage.id === stages[4].id).deals.some(row => row.id === deal.id));

    result = await call('/api/analysis/realtime?seconds=86400');
    assert(result.body.by_event.lead_qualified >= 1);
    assert(result.body.by_event.deal_won >= 1);
    result = await call(`/api/analysis/attribution/${contact.id}`);
    assert.equal(result.body.available, true);
    assert(result.body.touches.some(touch => touch.campaign_id === campaignId));

    result = await call('/api/finance/legal-entities', { method: 'POST', headers: { 'idempotency-key': 'full-e2e-entity-0001' }, body: JSON.stringify({ name: 'Full E2E Business BV', legal_form: 'BV', address: 'Stationsweg 1, Utrecht', vat_id: 'NL000000000B01', kvk_number: '00000000' }) });
    const legalEntityId = result.body.id;
    result = await call(`/api/finance/legal-entities/${legalEntityId}/bootstrap-chart`, { method: 'POST', body: '{}' });
    assert.equal(result.body.accounts.length, 9);
    result = await call('/api/finance/periods', { method: 'POST', body: JSON.stringify({ legal_entity_id: legalEntityId, name: 'FY 2026', start_date: '2026-01-01', end_date: '2026-12-31' }) });
    assert.equal(result.response.status, 201);
    result = await call('/api/finance/invoices', { method: 'POST', headers: { 'idempotency-key': 'full-e2e-invoice-0001' }, body: JSON.stringify({ legal_entity_id: legalEntityId, kind: 'SALES', invoice_number: 'INV-E2E-2026-0001', supplier_name: 'Full E2E Business BV', supplier_address: 'Stationsweg 1, Utrecht', customer_name: 'Full E2E Customer BV', customer_address: 'Markt 2, Utrecht', supplier_vat_id: 'NL000000000B01', supplier_kvk_number: '00000000', invoice_date: '2026-09-04', supply_date: '2026-09-04', due_date: '2026-10-04', lines: [{ description: 'Verified campaign outcome', quantity: 1, unit_price_cents: 25000, vat_rate: 21 }] }) });
    const invoice = result.body.invoice;
    assert.equal(invoice.gross_cents, 30250);
    result = await call(`/api/finance/invoices/${invoice.id}/post`, { method: 'POST', headers: { 'idempotency-key': 'full-e2e-invoice-post-0001' }, body: '{}' });
    assert.equal(result.body.journal.balanced, true);
    result = await call('/api/finance/bank-transactions', { method: 'POST', headers: { 'idempotency-key': 'full-e2e-bank-0001' }, body: JSON.stringify({ legal_entity_id: legalEntityId, external_id: 'BANK-E2E-0001', date: '2026-09-04', amount_cents: 30250, reference: 'INV-E2E-2026-0001', source: 'CAMT_TEST_FIXTURE' }) });
    const bankTransaction = result.body;
    result = await call(`/api/finance/bank-transactions/${bankTransaction.id}/reconciliation-proposals`);
    assert.equal(result.body.proposals[0].match_type, 'EXACT_REFERENCE');
    result = await call('/api/finance/reconciliations', { method: 'POST', body: JSON.stringify({ bank_transaction_id: bankTransaction.id, invoice_id: invoice.id, match_type: 'EXACT_REFERENCE', confidence: 0.995, reason: 'Deterministic full-product E2E match' }) });
    assert.equal(result.body.payment.invoice.status, 'PAID');
    assert.equal(result.body.reconciliation.status, 'CONFIRMED');
    result = await call(`/api/finance/reports?legal_entity_id=${legalEntityId}`);
    assert.equal(result.body.trial_balance.balanced, true);
    assert.equal(result.body.profit_and_loss.revenue_cents, 25000);

    const paidEvent = event('e2e-invoice-paid-0001', 'invoice_paid', campaignId, { source: 'foundly_finance', source_kind: 'internal_service', provider: null, provider_verified: true, lead_id: lead.id, customer_id: contact.id, entity_type: 'invoice', entity_id: invoice.id, properties: { revenue_cents: 25000, gross_margin_cents: 9000, invoice_id: invoice.id }, privacy_classification: 'INTERNAL', consent_context: { purpose: 'business_operations', status: 'GRANTED', legal_basis: 'contract' } });
    result = await ingest(paidEvent);
    assert.equal(result.response.status, 202);

    result = await call('/api/knowledge/records', { method: 'POST', body: JSON.stringify({ subject: campaignId, type: 'NORMALIZED_FACT', predicate: 'verified_commercial_outcome', value: { spend_cents: 2500, revenue_cents: 25000, gross_margin_cents: 9000 }, sources: [{ source_id: 'foundly_finance', invoice_id: invoice.id }], evidence: [deal.id, invoice.id, paidEvent.event_id], confidence: 1, permissions: { roles: ['ADMIN'] } }) });
    assert.equal(result.response.status, 201);
    const knowledgeId = result.body.knowledge_id;
    result = await call('/api/learning/insights', { method: 'POST', body: JSON.stringify({ type: 'campaign_revenue_prediction', model_version: 'deterministic-e2e-1', rule_version: '1.0', evidence_set: [knowledgeId, paidEvent.event_id], sample_size: 1, confidence: 0.75, statement: 'Deterministic fixture prediction', structured_value: { predicted_revenue_cents: 24000 } }) });
    const insightId = result.body.insight_id;
    result = await call('/api/learning/feedback', { method: 'POST', body: JSON.stringify({ insight_id: insightId, prediction: 24000, actual: 25000, timestamp: new Date().toISOString() }) });
    assert.equal(result.body.insight.outcome_metrics.mae, 1000);
    assert.equal(result.body.base_model_retrained, false);

    result = await call(`/api/analysis/campaigns/${campaignId}/outcome`);
    assert.equal(result.body.performance.spend_cents, 2500);
    assert.equal(result.body.performance.leads, 1);
    assert.equal(result.body.performance.qualified_leads, 1);
    assert.equal(result.body.performance.deals, 1);
    assert.equal(result.body.performance.won_deals, 1);
    assert.equal(result.body.performance.revenue_cents, 25000);
    assert.equal(result.body.performance.gross_margin_cents, 9000);
    assert.equal(result.body.performance.roas, 10);
    assert.equal(result.body.provenance.double_count_protection, true);

    result = await call('/api/zero/turn', { method: 'POST', body: JSON.stringify({ message: `Big Boss, wat heeft campagne ${campaignId} werkelijk opgeleverd?`, conversation_id: 'full-e2e-zero-conversation-0001', turn_id: 'full-e2e-zero-campaign-0001' }) });
    assert.equal(result.response.status, 200);
    assert(result.body.plan.tools.includes('analysis_campaign_outcome'));
    assert(result.body.plan.tools.includes('knowledge_search'));
    assert.equal(result.body.analysis_data.performance.revenue_cents, 25000);
    assert.equal(result.body.analysis_data.performance.gross_margin_cents, 9000);
    assert.equal(result.body.knowledge_data.total, 1);
    assert.equal(result.body.verification.double_count_protection, true);

    const stateRaw = fs.readFileSync(`${dataDir}/foundly-core-state.json`, 'utf8');
    assert.equal(JSON.parse(stateRaw).records.__foundly_core_encrypted, true);
    for (const sensitive of ['Full E2E Contact', 'full-e2e@example.test', 'Full E2E Customer BV']) assert(!stateRaw.includes(sensitive));

    await stop();
    await start();
    result = await call(`/api/analysis/campaigns/${campaignId}/outcome`);
    assert.equal(result.body.performance.revenue_cents, 25000);
    result = await call(`/api/crm/customers/${contact.id}/360`);
    assert.equal(result.body.customer.deals[0].status, 'WON');
    result = await call('/api/finance/records/invoices');
    assert(result.body.items.some(row => row.id === invoice.id && row.status === 'PAID'));
    result = await call(`/api/knowledge/records?q=${campaignId}`);
    assert.equal(result.body.total, 1);

    console.log(JSON.stringify({
      ok: true,
      deterministic_fixture_only: true,
      external_provider_delivery: 'not_executed',
      meta_identity_and_internal_dedup: 'pass',
      consented_event_journey: 'pass',
      crm_lead_to_won_deal: 'pass',
      customer_360_timeline: 'pass',
      finance_invoice_payment_reconciliation: 'pass',
      balanced_ledger: 'pass',
      campaign_revenue_margin_dedup: 'pass',
      knowledge_outcome: 'pass',
      learning_evaluation: 'pass',
      zero_campaign_answer: 'pass',
      encrypted_restart_persistence: 'pass'
    }, null, 2));
  } catch (error) {
    console.error(logs);
    console.error(error);
    process.exitCode = 1;
  } finally {
    await stop();
  }
})();
