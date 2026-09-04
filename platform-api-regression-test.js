'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 20800 + Math.floor(Math.random() * 150);
const base = `http://127.0.0.1:${PORT}`;
const dataDir = fs.mkdtempSync('/tmp/foundly-platform-api-');
const password = 'foundly-platform-api-password-2026';
const auth = `Basic ${Buffer.from(`foundly:${password}`).toString('base64')}`;
const env = {
  ...process.env,
  NODE_ENV: 'production',
  PORT: String(PORT),
  FOUNDLY_DATA_DIR: dataDir,
  FOUNDLY_PUBLIC_BASE_URL: 'https://foundly.example.test',
  FOUNDLY_ADMIN_USERNAME: 'foundly',
  FOUNDLY_ADMIN_PASSWORD: password,
  FOUNDLY_ENCRYPTION_KEY: 'foundly-platform-encryption-key-2026-secure',
  FOUNDLY_TENANT_ID: 'tenant-platform-api',
  FOUNDLY_DEALER_ID: 'business-platform-api',
  FOUNDLY_PLATFORM_USER_ID: 'admin-platform',
  FOUNDLY_PLATFORM_ROLES: 'ADMIN',
  FOUNDLY_CRM_USER_ID: 'admin-platform',
  FOUNDLY_CRM_ROLES: 'ADMIN',
  FOUNDLY_WORKER_INTERVAL_MS: '99999999',
  OPENAI_API_KEY: '',
  FOUNDLY_AI_API_KEY: '',
  META_APP_ID: '',
  META_APP_SECRET: '',
  META_PIXEL_ID: '',
  META_CAPI_ACCESS_TOKEN: '',
  GOOGLE_CLIENT_ID: '',
  GOOGLE_CLIENT_SECRET: '',
  GA4_MEASUREMENT_ID: '',
  GA4_API_SECRET: ''
};
let child;
let logs = '';
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function start() {
  child = spawn(process.execPath, ['server.js'], { cwd: __dirname, env, stdio: ['ignore', 'pipe', 'pipe'] });
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

async function call(route, options = {}, authenticated = true) {
  const headers = {
    ...(authenticated ? { authorization: auth } : {}),
    ...(options.body ? { 'content-type': 'application/json' } : {}),
    ...(options.headers || {})
  };
  const response = await fetch(base + route, { redirect: 'manual', ...options, headers });
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); }
  catch { body = text; }
  return { response, body, text };
}

function canonicalEvent(overrides = {}) {
  return {
    event_id: crypto.randomUUID(),
    event_name: 'session_started',
    occurred_at: new Date().toISOString(),
    source: 'platform_api_test',
    source_kind: 'browser',
    session_id: '1000001',
    anonymous_id: 'anonymous-platform-1',
    campaign_id: 'campaign-platform',
    utm_source: 'meta',
    utm_medium: 'paid_social',
    properties: { landing_page: 'https://example.test/landing', ga_client_id: '123.456', engagement_time_msec: 1200 },
    consent_context: { purpose: 'analytics', status: 'GRANTED', legal_basis: 'consent' },
    privacy_classification: 'PSEUDONYMOUS',
    ...overrides
  };
}

(async () => {
  try {
    await start();
    let result = await call('/api/platform/status', {}, false);
    assert.equal(result.response.status, 401);
    result = await call('/api/platform/status');
    assert.equal(result.response.status, 200);
    assert.equal(result.body.schema_version, 5);
    assert.equal(result.body.finance_schema_version, 2);
    assert.equal(result.body.persistence.encrypted_at_rest, true);
    assert.equal(result.body.persistence.durable, false);
    assert.equal(result.body.providers.meta.connected, false);
    assert.equal(result.body.providers.google.connected, false);
    assert.equal(result.body.no_fake_data, true);

    result = await call('/api/platform/migrations', { method: 'POST', body: '{}' });
    assert.equal(result.body.platform.current_version, 5);
    assert.equal(result.body.finance.current_version, 2);
    assert.equal(result.body.platform.applied.length, 0);

    result = await call('/api/platform/events/ingest', {
      method: 'POST',
      headers: { 'idempotency-key': 'platform-event-api-0001' },
      body: JSON.stringify(canonicalEvent({ event_id: 'platform-event-api-0001' }))
    });
    assert.equal(result.response.status, 202);
    assert.equal(result.body.deduplicated, false);
    result = await call('/api/platform/events/ingest', {
      method: 'POST',
      headers: { 'idempotency-key': 'platform-event-api-0001' },
      body: JSON.stringify(canonicalEvent({ event_id: 'platform-event-api-0001' }))
    });
    assert.equal(result.body.deduplicated, true);
    result = await call('/api/platform/events/ingest', {
      method: 'POST',
      body: JSON.stringify(canonicalEvent({ consent_context: { purpose: 'analytics', status: 'DENIED', legal_basis: 'consent' } }))
    });
    assert.equal(result.response.status, 422);
    assert.equal(result.body.code, 'event_consent_denied');

    result = await call('/api/crm/leads', {
      method: 'POST',
      headers: { 'idempotency-key': 'platform-crm-lead-0001' },
      body: JSON.stringify({ name: 'Verified platform lead', status: 'qualified', value: 25000, source: 'website' })
    });
    assert.equal(result.response.status, 201);
    const leadId = result.body.record.id;
    result = await call('/api/platform/events?event_name=lead_created');
    assert.equal(result.body.total, 1);
    assert.equal(result.body.items[0].lead_id, leadId);

    result = await call('/api/analysis/realtime?seconds=86400');
    assert(result.body.events >= 2);
    assert.equal(result.body.subscription, 'SSE');
    result = await call('/api/analysis/kpis/conversion_rate');
    assert.equal(result.body.available, true);
    assert(result.body.drilldown.source_count >= 2);
    result = await call('/api/analysis/kpis/gross_margin');
    assert.equal(result.body.available, false);
    assert.equal(result.body.value, null);
    assert.equal(result.body.unavailable_reason, 'NO_VERIFIED_SOURCE_DATA');
    result = await call('/api/analysis/dashboard');
    assert.equal(result.body.name, 'Foundly Analysis Command Dashboard');
    assert.equal(result.body.no_fake_data, true);

    const marketingEvent = canonicalEvent({ event_id: 'marketing-plan-event-0001', event_name: 'lead_created', consent_context: { purpose: 'marketing_measurement', status: 'GRANTED', marketing_status: 'GRANTED', legal_basis: 'consent' } });
    result = await call('/api/measurement/meta/plan', { method: 'POST', body: JSON.stringify({ event: marketingEvent, identity: { email: ' Person@example.test ' } }) });
    assert.equal(result.body.browser.status, 'NOT_CONFIGURED');
    assert.equal(result.body.server.status, 'NOT_CONFIGURED');
    assert.match(result.body.server.payload.data[0].user_data.em[0], /^[a-f0-9]{64}$/);
    assert(!result.text.includes('Person@example.test'));
    assert.equal(result.body.connected, false);
    result = await call('/api/measurement/google/ga4/plan', { method: 'POST', body: JSON.stringify({ event: marketingEvent }) });
    assert.equal(result.body.status, 'NOT_CONFIGURED');
    assert.equal(result.body.connected, false);
    result = await call('/api/measurement/google/enhanced-conversion/plan', { method: 'POST', body: JSON.stringify({ event: marketingEvent, identity: { email: ' Person+tag@example.test ', phone: '+31612345678' } }) });
    assert.equal(result.body.status, 'NOT_CONFIGURED');
    assert.equal(result.body.payload.conversionAdjustments[0].adjustmentType, 'ENHANCEMENT');
    assert.equal(result.body.payload.partialFailure, true);
    assert(!result.text.includes('Person+tag'));
    assert(!result.text.includes('+31612345678'));

    result = await call('/api/meta/capi/events', { method: 'POST', body: JSON.stringify({ event: { ...marketingEvent, event_id: 'client-secret-rejected-meta-0001' }, identity: { email: 'person@example.test' }, access_token: 'client-token-must-be-ignored', pixel_id: 'client-pixel-must-be-ignored' }) });
    assert.equal(result.response.status, 503);
    assert.equal(result.body.code, 'measurement_meta_not_configured');
    assert(!result.text.includes('client-token-must-be-ignored'));
    result = await call('/api/measurement/google/ga4/send', { method: 'POST', body: JSON.stringify({ event: { ...marketingEvent, event_id: 'client-secret-rejected-ga4-0001' }, api_secret: 'client-secret-must-be-ignored', measurement_id: 'G-CLIENT' }) });
    assert.equal(result.response.status, 503);
    assert.equal(result.body.code, 'measurement_ga4_not_configured');
    assert(!result.text.includes('client-secret-must-be-ignored'));

    const outcomeEvents = [
      { event_id: 'campaign-spend-api-0001', event_name: 'marketing_spend', properties: { spend_cents: 2500 } },
      { event_id: 'campaign-lead-api-0001', event_name: 'lead_created', lead_id: leadId, entity_type: 'lead', entity_id: leadId },
      { event_id: 'campaign-qualified-api-0001', event_name: 'lead_qualified', lead_id: leadId, entity_type: 'lead', entity_id: leadId },
      { event_id: 'campaign-deal-api-0001', event_name: 'deal_created', lead_id: leadId, customer_id: 'customer-platform-api', correlation_id: 'commercial-platform-api', entity_type: 'deal', entity_id: 'deal-platform-api' },
      { event_id: 'campaign-won-api-0001', event_name: 'deal_won', lead_id: leadId, customer_id: 'customer-platform-api', correlation_id: 'commercial-platform-api', entity_type: 'deal', entity_id: 'deal-platform-api', properties: { revenue_cents: 25000, gross_margin_cents: 9000 } },
      { event_id: 'campaign-paid-api-0001', event_name: 'invoice_paid', lead_id: leadId, customer_id: 'customer-platform-api', correlation_id: 'commercial-platform-api', entity_type: 'invoice', entity_id: 'invoice-platform-api', properties: { revenue_cents: 25000, gross_margin_cents: 9000 } }
    ];
    for (const fixture of outcomeEvents) {
      result = await call('/api/platform/events/ingest', { method: 'POST', headers: { 'idempotency-key': fixture.event_id }, body: JSON.stringify(canonicalEvent({ ...fixture, campaign_id: 'campaign-outcome-api' })) });
      assert.equal(result.response.status, 202);
      assert.equal(result.body.deduplicated, false);
    }
    result = await call('/api/analysis/campaigns/campaign-outcome-api/outcome');
    assert.equal(result.body.available, true);
    assert.equal(result.body.performance.spend_cents, 2500);
    assert.equal(result.body.performance.leads, 1);
    assert.equal(result.body.performance.qualified_leads, 1);
    assert.equal(result.body.performance.deals, 1);
    assert.equal(result.body.performance.won_deals, 1);
    assert.equal(result.body.performance.revenue_cents, 25000);
    assert.equal(result.body.performance.gross_margin_cents, 9000);
    assert.equal(result.body.performance.roas, 10);
    assert.equal(result.body.provenance.double_count_protection, true);
    result = await call('/api/analysis/historical?campaign_id=campaign-outcome-api&limit=2');
    assert.equal(result.body.pagination.server_side, true);
    assert.equal(result.body.rollups.length, 2);
    assert(result.body.total > result.body.rollups.length);
    assert.notEqual(result.body.next_cursor, null);

    result = await call('/api/tax/vat/calculate', { method: 'POST', body: JSON.stringify({ date: '2026-06-01', legal_form: 'BV', classification: 'STANDARD', net_cents: 10000 }) });
    assert.equal(result.body.vat_cents, 2100);
    assert.equal(result.body.rule.version, '2026.1');
    result = await call('/api/tax/vat/calculate', { method: 'POST', body: JSON.stringify({ date: '2027-06-01', legal_form: 'BV', classification: 'STANDARD', net_cents: 10000 }) });
    assert.equal(result.response.status, 422);
    assert.equal(result.body.code, 'tax_rule_unverified');
    result = await call('/api/tax/invoices/validate', { method: 'POST', body: JSON.stringify({ supplier_name: 'Verified Supplier BV', supplier_address: 'Stationsweg 1, Utrecht', customer_name: 'Verified Customer BV', customer_address: 'Markt 2, Utrecht', supplier_vat_id: 'NL000000000B01', supplier_kvk_number: '00000000', invoice_date: '2026-06-01', supply_date: '2026-06-01', invoice_number: 'INV-2026-0001', previous_invoice_number: 'INV-2026-0000', lines: [{ description: 'Verified service', quantity: 1, unit_price_cents: 10000, vat_rate: 21, vat_cents: 2100 }], net_cents: 10000, vat_cents: 2100 }) });
    assert.equal(result.body.valid, true);
    assert.equal(result.body.sequence_verified, true);
    assert.equal(result.body.rule_contract.official_source, 'Belastingdienst');
    result = await call('/api/tax/retention/policy', { method: 'POST', body: JSON.stringify({ category: 'REAL_ESTATE', created_at: '2026-06-01' }) });
    assert.equal(result.body.retention_years, 10);
    result = await call('/api/tax/retention/archive', { method: 'POST', body: JSON.stringify({ entity_type: 'invoice', record_id: 'invoice-retention-0001', reason: 'Verified legal archive fixture', category: 'BASIS_DATA', created_at: '2026-06-01' }) });
    assert.equal(result.body.status, 'LOGICALLY_ARCHIVED');
    assert.equal(result.body.physical_delete_performed, false);

    result = await call('/api/data-platform/records', { method: 'POST', body: JSON.stringify({ record_type: 'lead', internal_id: leadId, source: 'user_input', source_kind: 'USER_INPUT', sync_state: 'LOCAL', data: { status: 'qualified' } }) });
    assert.equal(result.response.status, 201);
    assert.equal(result.body.version, 1);
    result = await call('/api/data-platform/records?q=qualified&record_type=lead');
    assert.equal(result.body.total, 1);
    assert.equal(result.body.permission_filtered, true);
    result = await call('/api/data-platform/objects', { method: 'POST', body: JSON.stringify({ sha256: 'c'.repeat(64), object_reference: 'object://platform-api/c', size_bytes: 42, content_type: 'application/pdf', object_bytes_stored: true }) });
    assert.equal(result.response.status, 201);
    assert.equal(result.body.immutable_manifest, true);
    result = await call('/api/data-platform/outbox', { method: 'POST', body: JSON.stringify({ idempotency_key: 'platform-offline-api-0001', entity_type: 'lead', entity_id: leadId, operation: 'UPSERT', base_revision: 1, payload: { status: 'converted' }, risk: 'LOW' }) });
    const outboxId = result.body.id;
    assert.equal(result.body.status, 'PENDING');
    result = await call(`/api/data-platform/outbox/${outboxId}/apply`, { method: 'POST', body: '{}' });
    assert.equal(result.body.record.version, 2);
    assert.equal(result.body.record.data.status, 'converted');
    result = await call('/api/data-platform/status');
    assert.equal(result.body.roles.object_storage.manifests, 1);
    assert.equal(result.body.no_ephemeral_primary_claim, true);
    result = await call('/api/data-platform/recovery/status');
    assert.equal(result.body.application_snapshot.encrypted_at_rest, true);
    assert.equal(result.body.schema_migrations.versioned, true);
    assert.equal(result.body.production_backup.verified, false);
    assert.equal(result.body.production_backup.status, 'EXTERNAL_BACKUP_NOT_VERIFIED');
    assert.equal(result.body.readiness_gate.safe, false);

    result = await call('/api/knowledge/records', { method: 'POST', body: JSON.stringify({ subject: 'campaign-outcome-api', type: 'NORMALIZED_FACT', predicate: 'verified_revenue', value: { revenue_cents: 25000 }, sources: [{ source_id: 'foundly_events' }], evidence: ['campaign-paid-api-0001'], confidence: 1, permissions: { roles: ['ADMIN'] } }) });
    assert.equal(result.response.status, 201);
    result = await call('/api/knowledge/records?q=campaign-outcome-api');
    assert.equal(result.body.total, 1);
    assert.equal(result.body.permission_filtered, true);

    result = await call('/api/learning/insights', { method: 'POST', body: JSON.stringify({ type: 'conversion_pattern', model_version: 'deterministic-1', evidence_set: ['platform-event-api-0001'], sample_size: 2, confidence: 0.8, statement: 'Verified fixture observation' }) });
    assert.equal(result.response.status, 201);
    const insightId = result.body.insight_id;
    result = await call('/api/learning/feedback', { method: 'POST', body: JSON.stringify({ insight_id: insightId, prediction: 10, actual: 8 }) });
    assert.equal(result.body.base_model_retrained, false);
    assert.equal(result.body.insight.outcome_metrics.mae, 2);
    result = await call('/api/learning/insights');
    assert.equal(result.body.evaluated, 1);
    assert.equal(result.body.learning_claim, 'OUTCOME_EVIDENCE_REQUIRED');

    result = await call('/api/platform/connectors', { method: 'POST', body: JSON.stringify({ provider: 'api-test-provider', capabilities: ['read'], auth_type: 'OAUTH2', supported_entities: ['lead'] }) });
    assert.equal(result.response.status, 201);
    result = await call('/api/platform/connectors/api-test-provider/state', { method: 'POST', body: JSON.stringify({ state: 'CONNECTED', evidence: { authenticated: true, probe_ok: true } }) });
    assert.equal(result.response.status, 422);
    assert.equal(result.body.code, 'connector_connected_unproven');
    result = await call('/api/platform/connectors/api-test-provider/state', { method: 'POST', body: JSON.stringify({ state: 'CONNECTED', evidence: { authenticated: true, probe_ok: true, initial_sync_ok: true, last_probe_at: '2026-06-01', last_sync_at: '2026-06-01' } }) });
    assert.equal(result.body.state, 'CONNECTED');
    result = await call('/api/platform/connectors/checkpoints', { method: 'POST', body: JSON.stringify({ provider: 'api-test-provider', direction: 'INBOUND', mode: 'FULL_INITIAL', cursor: 'opaque-cursor', watermark: '2026-06-01', records_applied: 1 }) });
    assert.equal(result.body.records_applied, 1);
    result = await call('/api/platform/connectors/attempts', { method: 'POST', body: JSON.stringify({ provider: 'api-test-provider', operation: 'SYNC', idempotency_key: 'connector-api-attempt-0001', success: false, max_attempts: 2, error: 'fixture failure' }) });
    assert.equal(result.body.status, 'RETRY_SCHEDULED');
    result = await call('/api/platform/connectors/webhooks', { method: 'POST', body: JSON.stringify({ provider: 'api-test-provider', provider_event_id: 'connector-api-event-0001', signature_verified: true, payload: { id: 'connector-api-event-0001' } }) });
    assert.equal(result.body.raw_payload_stored, false);
    result = await call('/api/platform/connectors?provider=api-test-provider');
    assert.equal(result.body.items[0].connected, true);

    result = await call('/api/automation/workflows', { method: 'POST', body: JSON.stringify({ name: 'Payment gate', trigger: { type: 'invoice_overdue' }, actions: [{ type: 'payment' }] }) });
    const workflowId = result.body.id;
    result = await call(`/api/automation/workflows/${workflowId}/runs`, { method: 'POST', body: JSON.stringify({ event: { event_id: 'automation-platform-0001', type: 'invoice_overdue' } }) });
    assert.equal(result.body.status, 'AWAITING_APPROVAL');
    result = await call('/api/automation/workflows', { method: 'POST', body: JSON.stringify({ name: 'Verified internal task', version: 1, trigger: { type: 'custom_event' }, actions: [{ type: 'create_task', title: 'Inspect verified platform event' }, { type: 'run_analysis', metric: 'conversion_rate' }] }) });
    const safeWorkflowId = result.body.id;
    result = await call(`/api/automation/workflows/${safeWorkflowId}/runs`, { method: 'POST', body: JSON.stringify({ event: { event_id: 'automation-platform-safe-0001', type: 'custom_event', entity_type: 'lead', entity_id: leadId } }) });
    assert.equal(result.body.status, 'SUCCEEDED');
    assert(result.body.steps.every(step => step.status === 'SUCCEEDED'));
    assert(result.body.outputs.every(output => output.external_write === false));
    result = await call('/api/automation/status');
    assert.equal(result.body.execution_adapter, 'AVAILABLE');
    assert.equal(result.body.run_count, 2);

    result = await call('/api/provisioner/resolve', { method: 'POST', body: JSON.stringify({ business_name: 'Verified Platform BV', country: 'NL', market: 'NL', industry: 'automotive dealer', segment: 'SMB', business_model: 'vehicle sales', locations: ['Utrecht'], channels: ['web'], existing_software: [] }) });
    assert.equal(result.body.profile.pack, 'AUTOMOTIVE');
    assert.equal(result.body.business_records_created, 0);
    assert.equal(result.body.profile.customer_code_fork, false);

    result = await call('/api/finance/legal-entities', { method: 'POST', headers: { 'idempotency-key': 'finance-api-entity-0001' }, body: JSON.stringify({ name: 'Verified Finance BV', legal_form: 'BV', address: 'Stationsweg 1, Utrecht', vat_id: 'NL000000000B01', kvk_number: '00000000' }) });
    assert.equal(result.response.status, 201);
    const entityId = result.body.id;
    result = await call(`/api/finance/legal-entities/${entityId}/bootstrap-chart`, { method: 'POST', body: '{}' });
    assert.equal(result.body.accounts.length, 9);
    const financeAccounts = result.body.accounts;
    result = await call('/api/finance/periods', { method: 'POST', body: JSON.stringify({ legal_entity_id: entityId, name: 'FY 2026', start_date: '2026-01-01', end_date: '2026-12-31' }) });
    assert.equal(result.response.status, 201);
    result = await call('/api/finance/reports?legal_entity_id=' + entityId);
    assert.equal(result.body.trial_balance.balanced, true);
    assert.equal(result.body.source, 'posted_immutable_journal_entries');
    const purchaseInput = { legal_entity_id: entityId, kind: 'PURCHASE', invoice_number: 'SUP-API-2026-0001', supplier_name: 'Verified Supplier BV', supplier_address: 'Stationsweg 1, Utrecht', supplier_vat_id: 'NL000000000B01', supplier_kvk_number: '00000000', customer_name: 'Verified Finance BV', customer_address: 'Stationsweg 1, Utrecht', invoice_date: '2026-06-01', supply_date: '2026-06-01', due_date: '2026-07-01', lines: [{ description: 'Verified purchase', quantity: 1, unit_price_cents: 10000, vat_rate: 21 }] };
    result = await call('/api/finance/invoices', { method: 'POST', body: JSON.stringify(purchaseInput) });
    const purchaseInvoiceId = result.body.invoice.id;
    assert.equal(result.body.invoice.approval_status, 'PENDING');
    result = await call(`/api/finance/invoices/${purchaseInvoiceId}/post`, { method: 'POST', body: '{}' });
    assert.equal(result.response.status, 409);
    assert.equal(result.body.code, 'finance_purchase_approval_required');
    result = await call(`/api/finance/invoices/${purchaseInvoiceId}/approve`, { method: 'POST', body: JSON.stringify({ reason: 'Supplier and amounts verified in API test' }) });
    assert.equal(result.body.approval_status, 'APPROVED');
    result = await call(`/api/finance/invoices/${purchaseInvoiceId}/post`, { method: 'POST', body: '{}' });
    assert.equal(result.body.invoice.status, 'POSTED');
    assert.equal(result.body.journal.balanced, true);
    result = await call('/api/finance/budgets', { method: 'POST', body: JSON.stringify({ legal_entity_id: entityId, name: 'Verified API budget', start_date: '2026-01-01', end_date: '2026-12-31', reason: 'Approved test fixture', lines: [{ account_id: financeAccounts.find(account => account.system_role === 'EXPENSE').id, amount_cents: 12000 }] }) });
    assert.equal(result.body.status, 'APPROVED');
    result = await call('/api/finance/cash-forecasts', { method: 'POST', body: JSON.stringify({ legal_entity_id: entityId, as_of: '2026-06-01', opening_cash_cents: 5000, horizon_days: 30, entries: [{ date: '2026-06-15', amount_cents: 2500, category: 'receipts', source: 'posted_receivable', confidence: 1 }], assumptions: ['Verified API fixture'] }) });
    assert.equal(result.body.status, 'ACTIVE');
    result = await call(`/api/finance/reports?legal_entity_id=${entityId}&from=2026-01-01&to=2026-12-31`);
    assert.equal(result.body.budget_vs_actual.available, true);
    assert.equal(result.body.cash_forecast.available, true);
    result = await call('/api/finance/exports', { method: 'POST', body: JSON.stringify({ scope: 'journal_entries', format: 'CSV', filters: { legal_entity_id: entityId, from: '2026-01-01', to: '2026-12-31' } }) });
    assert.equal(result.response.status, 200);
    assert.equal(result.body.audited, true);
    assert.equal(result.body.permission_checked, 'finance:export');
    assert.equal(result.body.privacy_classification, 'FINANCIAL');
    assert.equal(result.body.legal_entity_id, entityId);
    assert(result.body.content.startsWith('"'));
    assert(!/(?:password|secret|token|authorization|cookie|private_key|api_key)/i.test(result.body.content.split('\n')[0]));

    result = await call('/api/zero/turn', { method: 'POST', body: JSON.stringify({ message: 'Wat is mijn Analysis conversieratio?', conversation_id: 'platform-zero-conversation-0001', turn_id: 'platform-zero-analysis-0001' }) });
    assert.equal(result.response.status, 200);
    assert(result.body.plan.tools.includes('analysis_kpi'));
    assert.equal(result.body.verification.canonical_events_only, true);
    assert.equal(result.body.verification.formula_version, 1);
    result = await call('/api/zero/turn', { method: 'POST', body: JSON.stringify({ message: 'Geef mijn finance balans en btw-positie', conversation_id: 'platform-zero-conversation-0001', turn_id: 'platform-zero-finance-0001' }) });
    assert.equal(result.response.status, 200);
    assert(result.body.plan.tools.includes('finance_report'));
    assert.equal(result.body.verification.posted_immutable_journal_entries, true);
    result = await call('/api/zero/turn', { method: 'POST', body: JSON.stringify({ message: 'Wat weten we over campaign-outcome-api?', conversation_id: 'platform-zero-conversation-0001', turn_id: 'platform-zero-knowledge-0001' }) });
    assert.equal(result.response.status, 200);
    assert(result.body.plan.tools.includes('knowledge_search'));
    assert.equal(result.body.verification.permission_filtered, true);
    result = await call('/api/zero/turn', { method: 'POST', body: JSON.stringify({ message: 'Big Boss, wat heeft campagne campaign-outcome-api werkelijk opgeleverd?', conversation_id: 'platform-zero-conversation-0001', turn_id: 'platform-zero-campaign-0001' }) });
    assert.equal(result.response.status, 200);
    assert(result.body.plan.tools.includes('analysis_campaign_outcome'));
    assert(result.body.plan.tools.includes('knowledge_search'));
    assert.equal(result.body.analysis_data.performance.revenue_cents, 25000);
    assert.equal(result.body.analysis_data.performance.gross_margin_cents, 9000);
    assert.equal(result.body.verification.double_count_protection, true);
    result = await call('/api/zero/turn', { method: 'POST', body: JSON.stringify({ message: 'Wat is de automation status?', conversation_id: 'platform-zero-conversation-0001', turn_id: 'platform-zero-automation-0001' }) });
    assert.equal(result.response.status, 200);
    assert(result.body.plan.tools.includes('automation_status'));
    assert.equal(result.body.verification.read_only, true);
    result = await call('/api/zero/status');
    for (const toolId of ['analysis_kpi', 'analysis_funnel', 'analysis_campaign_outcome', 'finance_report', 'knowledge_search', 'automation_status', 'automation_run']) assert(result.body.tools.some(tool => tool.tool_id === toolId), `ZERO tool ontbreekt: ${toolId}`);

    result = await call('/api/platform/status');
    assert(result.body.observability.http.requests > 0);
    assert.equal(result.body.observability.http.contains_pii, false);
    assert.notEqual(result.body.observability.http.p95_latency_ms, null);

    const streamController = new AbortController();
    const streamResponse = await fetch(`${base}/api/platform/events/stream`, { headers: { authorization: auth }, signal: streamController.signal });
    assert.equal(streamResponse.status, 200);
    assert.match(streamResponse.headers.get('content-type'), /text\/event-stream/);
    const firstChunk = await streamResponse.body.getReader().read();
    assert(Buffer.from(firstChunk.value).toString('utf8').includes('event: ready'));
    streamController.abort();

    const stateFile = path.join(dataDir, 'foundly-core-state.json');
    const stateRaw = fs.readFileSync(stateFile, 'utf8');
    assert.equal(JSON.parse(stateRaw).records.__foundly_core_encrypted, true);
    for (const sensitive of ['Verified platform lead', 'Verified Platform BV', 'Verified Finance BV']) assert(!stateRaw.includes(sensitive));

    await stop();
    await start();
    result = await call('/api/platform/events?limit=200');
    assert(result.body.total >= 2);
    assert(result.body.items.some(event => event.event_id === 'platform-event-api-0001'));
    result = await call('/api/knowledge/records?q=campaign-outcome-api');
    assert.equal(result.body.total, 1);
    result = await call('/api/finance/records/legal_entities');
    assert.equal(result.body.total, 1);

    console.log(JSON.stringify({
      ok: true,
      platform_api: 'pass',
      authentication: 'pass',
      migrations: 'pass',
      canonical_event_ingest: 'pass',
      deduplication: 'pass',
      crm_event_bridge: 'pass',
      realtime_analytics: 'pass',
      historical_pagination: 'pass',
      campaign_outcome_api: 'pass',
      kpi_empty_state: 'pass',
      provider_status_truthfulness: 'pass',
      tax_historical_gate: 'pass',
      dutch_invoice_and_retention: 'pass',
      data_platform_online_offline: 'pass',
      recovery_status: 'pass',
      knowledge: 'pass',
      learning_feedback: 'pass',
      connector_lifecycle: 'pass',
      automation_execution_and_approval: 'pass',
      provisioner: 'pass',
      finance_api: 'pass',
      finance_approval_budget_forecast: 'pass',
      finance_export_api: 'pass',
      zero_cross_platform_tools: 'pass',
      zero_campaign_outcome: 'pass',
      observability_http_metrics: 'pass',
      sse: 'pass',
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
