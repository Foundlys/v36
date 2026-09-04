'use strict';

const PLATFORM_PREFIXES = [
  '/api/platform',
  '/api/analysis',
  '/api/measurement',
  '/api/finance',
  '/api/tax',
  '/api/knowledge',
  '/api/learning',
  '/api/automation',
  '/api/provisioner',
  '/api/data-platform'
];

function boundedNumber(value, fallback, min, max) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function queryObject(url) {
  const filters = {};
  for (const field of ['event_name', 'campaign_id', 'source', 'provider', 'entity_type', 'entity_id', 'correlation_id']) {
    if (url.searchParams.has(field)) filters[field] = url.searchParams.get(field);
  }
  return {
    from: url.searchParams.get('from') || undefined,
    to: url.searchParams.get('to') || undefined,
    filters,
    campaign_id: url.searchParams.get('campaign_id') || undefined,
    event_name: url.searchParams.get('event_name') || undefined,
    source: url.searchParams.get('source') || undefined,
    provider: url.searchParams.get('provider') || undefined,
    entity_type: url.searchParams.get('entity_type') || undefined,
    entity_id: url.searchParams.get('entity_id') || undefined,
    correlation_id: url.searchParams.get('correlation_id') || undefined,
    limit: boundedNumber(url.searchParams.get('limit'), 100, 1, 500),
    cursor: boundedNumber(url.searchParams.get('cursor'), 0, 0, 1_000_000)
  };
}

function createPlatformApi(options = {}) {
  const {
    platform,
    finance,
    readBody,
    sendJson,
    context,
    principal,
    responseHeaders = extra => extra,
    providerConfig = () => ({}),
    providerTransport = null,
    persistenceStatus = () => ({}),
    version = 'unknown',
    redact = value => value
  } = options;
  if (!platform || !finance || !readBody || !sendJson || !context || !principal) {
    throw new TypeError('Platform API requires platform, finance, HTTP and security adapters');
  }

  const subscribers = new Set();

  function applies(pathname) {
    return PLATFORM_PREFIXES.some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`));
  }

  function publish(ctx, event) {
    const payload = JSON.stringify({ ...event, tenant_id: ctx.tenant_id, dealer_id: ctx.dealer_id });
    for (const subscription of subscribers) {
      if (subscription.tenant_id !== ctx.tenant_id || subscription.dealer_id !== ctx.dealer_id) continue;
      try { subscription.response.write(`event: foundly\ndata: ${payload}\n\n`); }
      catch { subscribers.delete(subscription); }
    }
  }

  function openStream(req, res, ctx) {
    res.writeHead(200, responseHeaders({
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no'
    }));
    res.write(`event: ready\ndata: ${JSON.stringify({ ok: true, subscription: 'SSE', observed_at: new Date().toISOString() })}\n\n`);
    const subscription = { tenant_id: ctx.tenant_id, dealer_id: ctx.dealer_id, response: res };
    subscribers.add(subscription);
    const heartbeat = setInterval(() => {
      try { res.write(': heartbeat\n\n'); }
      catch { clearInterval(heartbeat); subscribers.delete(subscription); }
    }, 25_000);
    heartbeat.unref();
    const close = () => { clearInterval(heartbeat); subscribers.delete(subscription); };
    req.once('close', close);
    req.once('error', close);
  }

  function safeProviderStatus(ctx) {
    const meta = providerConfig('meta', ctx) || {};
    const google = providerConfig('google', ctx) || {};
    const shape = config => ({
      configured: Boolean(config.configured),
      authenticated: Boolean(config.authenticated),
      probe_ok: Boolean(config.probe_ok),
      initial_sync_ok: Boolean(config.initial_sync_ok),
      connected: Boolean(config.authenticated && config.probe_ok && config.initial_sync_ok),
      last_probe_at: config.last_probe_at || null,
      last_sync_at: config.last_sync_at || null,
      capabilities: config.capabilities || {}
    });
    return { meta: shape(meta), google: shape(google) };
  }

  function apiError(res, error) {
    const status = Number(error.statusCode) || 500;
    return sendJson(res, status, {
      ok: false,
      code: error.code || 'platform_internal_error',
      error: status < 500 ? redact(error.message) : 'Interne platformfout',
      details: status < 500 ? redact(error.details || null) : null
    });
  }

  async function handle(req, res, url) {
    if (!applies(url.pathname)) return false;
    const ctx = context(req);
    const actor = principal(req);
    const query = queryObject(url);
    try {
      if (url.pathname === '/api/platform/status' && req.method === 'GET') {
        return sendJson(res, 200, {
          ok: true,
          product: 'Foundly Platform',
          version,
          tenant_id: ctx.tenant_id,
          schema_version: platform.schema().version,
          finance_schema_version: finance.schema().version,
          persistence: persistenceStatus(),
          providers: safeProviderStatus(ctx),
          observability: platform.observability(ctx, actor),
          no_fake_data: true,
          observed_at: new Date().toISOString()
        });
      }
      if (url.pathname === '/api/platform/schema' && req.method === 'GET') {
        return sendJson(res, 200, { ok: true, platform: platform.schema(), finance: finance.schema() });
      }
      if (url.pathname === '/api/platform/migrations' && req.method === 'POST') {
        return sendJson(res, 200, { ok: true, platform: platform.migrate(ctx, actor), finance: finance.migrate(ctx, actor) });
      }
      if (url.pathname === '/api/platform/events/stream' && req.method === 'GET') {
        openStream(req, res, ctx);
        return true;
      }
      if (url.pathname === '/api/platform/events' && req.method === 'GET') {
        return sendJson(res, 200, { ok: true, ...platform.events(ctx, actor, query) });
      }
      if (url.pathname === '/api/platform/events/ingest' && req.method === 'POST') {
        const payload = await readBody(req);
        const idempotencyKey = req.headers['idempotency-key'] || payload.idempotency_key;
        const result = platform.ingestEvent(ctx, actor, payload.event || payload, { idempotencyKey });
        return sendJson(res, result.deduplicated ? 200 : 202, { ok: true, ...result });
      }

      if (url.pathname === '/api/analysis/realtime' && req.method === 'GET') {
        return sendJson(res, 200, platform.realtime(ctx, actor, { seconds: boundedNumber(url.searchParams.get('seconds'), 900, 60, 86_400) }));
      }
      if (url.pathname === '/api/analysis/historical' && req.method === 'GET') {
        return sendJson(res, 200, platform.historical(ctx, actor, query));
      }
      if (url.pathname === '/api/analysis/dashboard' && req.method === 'GET') {
        return sendJson(res, 200, platform.dashboard(ctx, actor, { ...query, seconds: boundedNumber(url.searchParams.get('seconds'), 900, 60, 86_400) }));
      }
      if (url.pathname === '/api/analysis/funnel' && req.method === 'GET') {
        return sendJson(res, 200, platform.commercialFunnel(ctx, actor, query));
      }
      if (url.pathname === '/api/analysis/kpis' && req.method === 'GET') {
        const schema = platform.schema();
        return sendJson(res, 200, { ok: true, registry: schema.kpis, count: Object.keys(schema.kpis).length });
      }
      const kpi = url.pathname.match(/^\/api\/analysis\/kpis\/([a-z0-9_:-]+)$/);
      if (kpi && req.method === 'GET') return sendJson(res, 200, platform.calculateKpi(ctx, actor, kpi[1], query));
      const attribution = url.pathname.match(/^\/api\/analysis\/attribution\/([A-Za-z0-9_.:-]{1,200})$/);
      if (attribution && req.method === 'GET') {
        return sendJson(res, 200, platform.attribution(ctx, actor, attribution[1], url.searchParams.get('model') || 'LAST_NON_DIRECT'));
      }
      const campaignOutcome = url.pathname.match(/^\/api\/analysis\/campaigns\/([A-Za-z0-9_.:-]{1,200})\/outcome$/);
      if (campaignOutcome && req.method === 'GET') return sendJson(res, 200, platform.campaignOutcome(ctx, actor, campaignOutcome[1], query));

      if (url.pathname === '/api/measurement/meta/plan' && req.method === 'POST') {
        const payload = await readBody(req);
        return sendJson(res, 200, platform.metaPlan(ctx, actor, payload.event || payload, providerConfig('meta', ctx), payload.identity || {}));
      }
      if (url.pathname === '/api/measurement/google/ga4/plan' && req.method === 'POST') {
        const payload = await readBody(req);
        return sendJson(res, 200, platform.ga4Plan(ctx, actor, payload.event || payload, providerConfig('google', ctx)));
      }
      if (url.pathname === '/api/measurement/google/enhanced-conversion/plan' && req.method === 'POST') {
        const payload = await readBody(req);
        return sendJson(res, 200, platform.enhancedConversionPlan(ctx, actor, payload.event, payload.identity || {}, providerConfig('google', ctx)));
      }
      const delivery = url.pathname.match(/^\/api\/measurement\/deliveries\/(meta|ga4)$/);
      if (delivery && req.method === 'POST') {
        const payload = await readBody(req);
        const config = providerConfig(delivery[1] === 'ga4' ? 'google' : 'meta', ctx);
        return sendJson(res, 202, platform.queueDelivery(ctx, actor, delivery[1], payload.event || payload, config, payload.identity || {}));
      }
      const transport = url.pathname.match(/^\/api\/measurement\/(meta\/send|google\/ga4\/(?:send|validate)|google\/enhanced-conversion\/send)$/);
      if (transport && req.method === 'POST') {
        if (typeof providerTransport !== 'function') {
          const unavailable = new Error('Providertransport is niet beschikbaar');
          unavailable.statusCode = 503;
          unavailable.code = 'measurement_transport_unavailable';
          throw unavailable;
        }
        const payload = await readBody(req);
        const result = await providerTransport(transport[1], { ctx, actor, payload, req });
        return sendJson(res, Number(result?.statusCode) || 200, result?.body === undefined ? result : result.body);
      }

      if (url.pathname === '/api/tax/status' && req.method === 'GET') return sendJson(res, 200, platform.taxCapabilities(ctx, actor));
      if (url.pathname === '/api/tax/rules' && req.method === 'GET') return sendJson(res, 200, platform.taxRules(ctx, actor, query));
      if (url.pathname === '/api/tax/vat/calculate' && req.method === 'POST') return sendJson(res, 200, platform.calculateVat(ctx, actor, await readBody(req)));
      if (url.pathname === '/api/tax/invoices/validate' && req.method === 'POST') return sendJson(res, 200, platform.validateDutchInvoice(ctx, actor, await readBody(req)));
      if (url.pathname === '/api/tax/retention/policy' && req.method === 'POST') return sendJson(res, 200, platform.retentionPolicy(ctx, actor, await readBody(req)));
      if (url.pathname === '/api/tax/retention/archive' && req.method === 'POST') return sendJson(res, 201, platform.archiveLegalRecord(ctx, actor, await readBody(req)));

      if (url.pathname === '/api/data-platform/status' && req.method === 'GET') return sendJson(res, 200, platform.dataPlatformStatus(ctx, actor));
      if (url.pathname === '/api/data-platform/recovery/status' && req.method === 'GET') return sendJson(res, 200, platform.recoveryStatus(ctx, actor));
      if (url.pathname === '/api/data-platform/records' && req.method === 'GET') {
        return sendJson(res, 200, platform.searchCanonicalRecords(ctx, actor, {
          q: url.searchParams.get('q') || '',
          record_type: url.searchParams.get('record_type') || undefined,
          source: url.searchParams.get('source') || undefined,
          sync_state: url.searchParams.get('sync_state') || undefined,
          limit: query.limit
        }));
      }
      if (url.pathname === '/api/data-platform/records' && req.method === 'POST') {
        const payload = await readBody(req);
        return sendJson(res, 201, platform.upsertCanonicalRecord(ctx, actor, payload, { expected_version: payload.expected_version }));
      }
      if (url.pathname === '/api/data-platform/objects' && req.method === 'POST') return sendJson(res, 201, platform.registerObject(ctx, actor, await readBody(req)));

      if (url.pathname === '/api/knowledge/records' && req.method === 'GET') {
        return sendJson(res, 200, platform.searchKnowledge(ctx, actor, {
          q: url.searchParams.get('q') || '',
          type: url.searchParams.get('type') || undefined,
          source: url.searchParams.get('source') || undefined,
          freshness: url.searchParams.get('freshness') || undefined,
          at: url.searchParams.get('at') || undefined,
          current: url.searchParams.get('current') !== 'false',
          limit: query.limit
        }));
      }
      if (url.pathname === '/api/knowledge/records' && req.method === 'POST') return sendJson(res, 201, platform.createKnowledge(ctx, actor, await readBody(req)));
      if (url.pathname === '/api/learning/insights' && req.method === 'POST') return sendJson(res, 201, platform.deriveInsight(ctx, actor, await readBody(req)));
      if (url.pathname === '/api/learning/insights' && req.method === 'GET') return sendJson(res, 200, platform.learningStatus(ctx, actor));
      if (url.pathname === '/api/learning/feedback' && req.method === 'POST') return sendJson(res, 201, platform.recordFeedback(ctx, actor, await readBody(req)));

      if (url.pathname === '/api/platform/connectors' && req.method === 'GET') return sendJson(res, 200, platform.connectorStatus(ctx, actor, url.searchParams.get('provider') || null));
      if (url.pathname === '/api/platform/connectors' && req.method === 'POST') return sendJson(res, 201, platform.declareConnector(ctx, actor, await readBody(req)));
      const transition = url.pathname.match(/^\/api\/platform\/connectors\/([A-Za-z0-9_.:-]{1,80})\/state$/);
      if (transition && req.method === 'POST') {
        const payload = await readBody(req);
        return sendJson(res, 200, platform.connectorTransition(ctx, actor, transition[1], payload.state, payload.evidence || {}));
      }
      if (url.pathname === '/api/platform/connectors/checkpoints' && req.method === 'POST') return sendJson(res, 201, platform.connectorCheckpoint(ctx, actor, await readBody(req)));
      if (url.pathname === '/api/platform/connectors/attempts' && req.method === 'POST') return sendJson(res, 201, platform.recordConnectorAttempt(ctx, actor, await readBody(req)));
      if (url.pathname === '/api/platform/connectors/webhooks' && req.method === 'POST') return sendJson(res, 202, platform.recordConnectorWebhook(ctx, actor, await readBody(req)));
      if (url.pathname === '/api/data-platform/outbox' && req.method === 'POST') return sendJson(res, 202, platform.enqueueOutbox(ctx, actor, await readBody(req)));
      const applyOutbox = url.pathname.match(/^\/api\/data-platform\/outbox\/([A-Za-z0-9_.:-]{1,200})\/apply$/);
      if (applyOutbox && req.method === 'POST') return sendJson(res, 200, platform.applyOutbox(ctx, actor, applyOutbox[1], await readBody(req)));

      if (url.pathname === '/api/automation/status' && req.method === 'GET') return sendJson(res, 200, platform.automationStatus(ctx, actor));
      if (url.pathname === '/api/automation/workflows' && req.method === 'POST') return sendJson(res, 201, platform.defineAutomation(ctx, actor, await readBody(req)));
      const run = url.pathname.match(/^\/api\/automation\/workflows\/([A-Za-z0-9_.:-]{1,200})\/runs$/);
      if (run && req.method === 'POST') {
        const payload = await readBody(req);
        return sendJson(res, 202, platform.runAutomation(ctx, actor, run[1], payload.event || {}, payload.options || {}));
      }
      if (url.pathname === '/api/provisioner/resolve' && req.method === 'POST') return sendJson(res, 201, platform.provision(ctx, actor, await readBody(req)));

      if (url.pathname === '/api/platform/exports' && req.method === 'POST') {
        const payload = await readBody(req);
        return sendJson(res, 200, platform.export(ctx, actor, payload.scope, payload.format));
      }

      if (url.pathname === '/api/finance/status' && req.method === 'GET') {
        return sendJson(res, 200, { ok: true, product: 'Foundly Finance', version, schema: finance.schema(), persistence: persistenceStatus(), no_fake_data: true });
      }
      if (url.pathname === '/api/finance/dashboard' && req.method === 'GET') return sendJson(res, 200, finance.dashboard(ctx, actor, { legal_entity_id: url.searchParams.get('legal_entity_id') || undefined, from: url.searchParams.get('from') || undefined, to: url.searchParams.get('to') || undefined }));
      if (url.pathname === '/api/finance/reports' && req.method === 'GET') return sendJson(res, 200, finance.reports(ctx, actor, { legal_entity_id: url.searchParams.get('legal_entity_id') || undefined, from: url.searchParams.get('from') || undefined, to: url.searchParams.get('to') || undefined }));
      if (url.pathname === '/api/finance/legal-entities' && req.method === 'POST') return sendJson(res, 201, finance.createLegalEntity(ctx, actor, await readBody(req), { idempotencyKey: req.headers['idempotency-key'] }));
      if (url.pathname === '/api/finance/periods' && req.method === 'POST') return sendJson(res, 201, finance.createPeriod(ctx, actor, await readBody(req)));
      if (url.pathname === '/api/finance/accounts' && req.method === 'POST') return sendJson(res, 201, finance.createAccount(ctx, actor, await readBody(req)));
      const chart = url.pathname.match(/^\/api\/finance\/legal-entities\/([A-Za-z0-9_.:-]{1,200})\/bootstrap-chart$/);
      if (chart && req.method === 'POST') return sendJson(res, 201, { ok: true, accounts: finance.bootstrapDutchChart(ctx, actor, chart[1]) });
      if (url.pathname === '/api/finance/journals' && req.method === 'POST') return sendJson(res, 201, finance.postJournal(ctx, actor, await readBody(req), { idempotencyKey: req.headers['idempotency-key'] }));
      const reverse = url.pathname.match(/^\/api\/finance\/journals\/([A-Za-z0-9_.:-]{1,200})\/reverse$/);
      if (reverse && req.method === 'POST') {
        const payload = await readBody(req);
        return sendJson(res, 201, finance.reverseJournal(ctx, actor, reverse[1], payload.reason, { date: payload.date, idempotencyKey: req.headers['idempotency-key'] }));
      }
      if (url.pathname === '/api/finance/invoices' && req.method === 'POST') return sendJson(res, 201, finance.createInvoice(ctx, actor, await readBody(req), { idempotencyKey: req.headers['idempotency-key'] }));
      const invoicePost = url.pathname.match(/^\/api\/finance\/invoices\/([A-Za-z0-9_.:-]{1,200})\/post$/);
      if (invoicePost && req.method === 'POST') return sendJson(res, 200, finance.postInvoice(ctx, actor, invoicePost[1], { idempotencyKey: req.headers['idempotency-key'] }));
      const invoiceApprove = url.pathname.match(/^\/api\/finance\/invoices\/([A-Za-z0-9_.:-]{1,200})\/approve$/);
      if (invoiceApprove && req.method === 'POST') return sendJson(res, 200, finance.approveInvoice(ctx, actor, invoiceApprove[1], await readBody(req)));
      const credit = url.pathname.match(/^\/api\/finance\/invoices\/([A-Za-z0-9_.:-]{1,200})\/credit-notes$/);
      if (credit && req.method === 'POST') return sendJson(res, 201, finance.createCreditNote(ctx, actor, credit[1], await readBody(req)));
      if (url.pathname === '/api/finance/payments' && req.method === 'POST') return sendJson(res, 201, finance.recordPayment(ctx, actor, await readBody(req), { idempotencyKey: req.headers['idempotency-key'] }));
      if (url.pathname === '/api/finance/collection-actions' && req.method === 'POST') return sendJson(res, 201, finance.createCollectionAction(ctx, actor, await readBody(req)));
      if (url.pathname === '/api/finance/counterparty-balances' && req.method === 'GET') return sendJson(res, 200, finance.counterpartyBalances(ctx, actor, { legal_entity_id: url.searchParams.get('legal_entity_id') || undefined }));
      if (url.pathname === '/api/finance/bank-transactions' && req.method === 'POST') return sendJson(res, 201, finance.importBankTransaction(ctx, actor, await readBody(req), { idempotencyKey: req.headers['idempotency-key'] }));
      const proposals = url.pathname.match(/^\/api\/finance\/bank-transactions\/([A-Za-z0-9_.:-]{1,200})\/reconciliation-proposals$/);
      if (proposals && req.method === 'GET') return sendJson(res, 200, finance.reconciliationProposals(ctx, actor, proposals[1]));
      if (url.pathname === '/api/finance/reconciliations' && req.method === 'POST') return sendJson(res, 201, finance.confirmReconciliation(ctx, actor, await readBody(req)));
      if (url.pathname === '/api/finance/document-proposals' && req.method === 'POST') return sendJson(res, 201, finance.ingestDocumentProposal(ctx, actor, await readBody(req)));
      if (url.pathname === '/api/finance/assets' && req.method === 'POST') return sendJson(res, 201, finance.createAsset(ctx, actor, await readBody(req)));
      const schedule = url.pathname.match(/^\/api\/finance\/assets\/([A-Za-z0-9_.:-]{1,200})\/depreciation$/);
      if (schedule && req.method === 'GET') return sendJson(res, 200, finance.depreciationSchedule(ctx, actor, schedule[1]));
      const disposal = url.pathname.match(/^\/api\/finance\/assets\/([A-Za-z0-9_.:-]{1,200})\/dispose$/);
      if (disposal && req.method === 'POST') return sendJson(res, 201, finance.disposeAsset(ctx, actor, disposal[1], await readBody(req)));
      if (url.pathname === '/api/finance/budgets' && req.method === 'POST') return sendJson(res, 201, finance.createBudget(ctx, actor, await readBody(req)));
      if (url.pathname === '/api/finance/cash-forecasts' && req.method === 'POST') return sendJson(res, 201, finance.createCashForecast(ctx, actor, await readBody(req)));
      if (url.pathname === '/api/finance/exports' && req.method === 'POST') {
        const payload = await readBody(req);
        return sendJson(res, 200, finance.export(ctx, actor, payload.scope, payload.format, payload.filters || {}));
      }
      const close = url.pathname.match(/^\/api\/finance\/periods\/([A-Za-z0-9_.:-]{1,200})\/close$/);
      if (close && req.method === 'POST') {
        const payload = await readBody(req);
        return sendJson(res, 200, finance.closePeriod(ctx, actor, close[1], payload.reason));
      }
      const records = url.pathname.match(/^\/api\/finance\/records\/([a-z_]+)$/);
      if (records && req.method === 'GET') return sendJson(res, 200, finance.list(ctx, actor, records[1], query));

      const notFound = new Error('Platformroute niet gevonden');
      notFound.statusCode = 404;
      notFound.code = 'platform_route_not_found';
      throw notFound;
    } catch (error) {
      apiError(res, error);
      return true;
    }
  }

  return { handle, publish, subscribers };
}

module.exports = { createPlatformApi };
