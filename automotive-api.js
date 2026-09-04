'use strict';

const AUTOMOTIVE_PREFIX = '/api/automotive';

function createAutomotiveApi(options = {}) {
  const {
    automotive,
    readBody,
    sendJson,
    context,
    principal,
    version = 'unknown',
    persistenceStatus = () => ({}),
    redact = value => value
  } = options;
  if (!automotive || !readBody || !sendJson || !context || !principal) throw new TypeError('Automotive API requires core, HTTP and security adapters');

  function applies(pathname) {
    return pathname === AUTOMOTIVE_PREFIX || pathname.startsWith(`${AUTOMOTIVE_PREFIX}/`);
  }

  function errorResponse(res, error) {
    const statusCode = Number(error.statusCode) || 500;
    return sendJson(res, statusCode, {
      ok: false,
      code: error.code || 'automotive_internal_error',
      error: statusCode >= 500 && !error.code ? 'Automotive servicefout' : String(error.message || 'Automotive servicefout').slice(0, 500),
      ...(error.details === undefined ? {} : { details: redact(error.details) })
    });
  }

  async function handle(req, res, url) {
    if (!applies(url.pathname)) return false;
    const ctx = context(req), actor = principal(req);
    try {
      if ((url.pathname === AUTOMOTIVE_PREFIX || url.pathname === `${AUTOMOTIVE_PREFIX}/status`) && req.method === 'GET') {
        const diagnostics = automotive.diagnostics(ctx, actor), profile = automotive.dealerProfile(ctx, actor);
        sendJson(res, 200, {
          ok: true,
          version,
          capability_pack: 'AUTOMOTIVE',
          schema_version: diagnostics.schema_version,
          tenant: { tenant_id: ctx.tenant_id, dealer_id: ctx.dealer_id },
          providers: diagnostics.providers,
          records: diagnostics.records,
          dealer_profile: { configuration_status: profile.configuration_status, display_name: profile.display_name, pilot_configuration: profile.pilot_configuration, history_available: profile.history?.available === true },
          persistence: { ...persistenceStatus(), data_model: 'FOUNDLY_EXISTING_TENANT_BUCKET', separate_database: false },
          contracts: { real_data_only: true, synthetic_runtime_records: false, server_side_secrets: true, provider_status_truthful: true }
        });
        return true;
      }
      if (url.pathname === `${AUTOMOTIVE_PREFIX}/search` && req.method === 'POST') {
        const body = await readBody(req);
        sendJson(res, 200, await automotive.search(ctx, actor, body, { correlation_id: req.headers['x-correlation-id'] || body.correlation_id, previous_criteria: body.previous_criteria }));
        return true;
      }
      const searchMatch = url.pathname.match(/^\/api\/automotive\/searches\/([A-Za-z0-9_.:-]{1,200})$/);
      if (searchMatch && req.method === 'GET') {
        sendJson(res, 200, { ok: true, search: automotive.getSearch(ctx, actor, searchMatch[1]) });
        return true;
      }
      if (url.pathname === `${AUTOMOTIVE_PREFIX}/dealer-profile` && req.method === 'GET') {
        sendJson(res, 200, { ok: true, profile: automotive.dealerProfile(ctx, actor) });
        return true;
      }
      if (url.pathname === `${AUTOMOTIVE_PREFIX}/dealer-profile` && ['POST', 'PUT'].includes(req.method)) {
        sendJson(res, 200, { ok: true, profile: automotive.saveDealerProfile(ctx, actor, await readBody(req)) });
        return true;
      }
      if (url.pathname === `${AUTOMOTIVE_PREFIX}/opportunities/today` && req.method === 'GET') {
        const input = { limit: url.searchParams.get('limit') || 3 };
        sendJson(res, 200, automotive.todayOpportunities(ctx, actor, input));
        return true;
      }
      if (url.pathname === `${AUTOMOTIVE_PREFIX}/diagnostics` && req.method === 'GET') {
        sendJson(res, 200, automotive.diagnostics(ctx, actor));
        return true;
      }
      const comparableMatch = url.pathname.match(/^\/api\/automotive\/vehicles\/([A-Za-z0-9_.:-]{1,200})\/comparables$/);
      if (comparableMatch && req.method === 'GET') {
        sendJson(res, 200, automotive.comparables(ctx, actor, comparableMatch[1], { country: url.searchParams.get('country') || 'NL', limit: url.searchParams.get('limit') || 30 }));
        return true;
      }
      const economicsMatch = url.pathname.match(/^\/api\/automotive\/vehicles\/([A-Za-z0-9_.:-]{1,200})\/economics$/);
      if (economicsMatch && req.method === 'POST') {
        sendJson(res, 200, automotive.calculateEconomics(ctx, actor, economicsMatch[1], await readBody(req)));
        return true;
      }
      const analysisMatch = url.pathname.match(/^\/api\/automotive\/vehicles\/([A-Za-z0-9_.:-]{1,200})\/analysis$/);
      if (analysisMatch && ['GET', 'POST'].includes(req.method)) {
        const body = req.method === 'POST' ? await readBody(req) : {};
        sendJson(res, 200, { ok: true, analysis: automotive.analyseCandidate(ctx, actor, analysisMatch[1], body) });
        return true;
      }
      const vehicleMatch = url.pathname.match(/^\/api\/automotive\/vehicles\/([A-Za-z0-9_.:-]{1,200})$/);
      if (vehicleMatch && req.method === 'GET') {
        sendJson(res, 200, { ok: true, vehicle: automotive.getVehicle(ctx, actor, vehicleMatch[1]) });
        return true;
      }
      throw Object.assign(new Error('Automotive route niet gevonden'), { statusCode: 404, code: 'automotive_route_not_found' });
    } catch (error) {
      errorResponse(res, error);
      return true;
    }
  }

  return { handle, applies };
}

module.exports = { createAutomotiveApi, AUTOMOTIVE_PREFIX };
