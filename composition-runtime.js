'use strict';

const { MODULES, TOOL_MODULES, moduleId, routeModule } = require('./module-catalog');
const READ_METHODS = new Set(['schema', 'status', 'diagnostics', 'list', 'get', 'search', 'query', 'reports', 'analytics', 'customer360', 'priorityLeads', 'inventoryMatches', 'dashboard', 'dashboardView', 'dashboardViews', 'pipelineSummary', 'providerStatuses', 'todayOpportunities', 'comparables', 'candidateAnalysis', 'economics', 'legalEntities', 'chartOfAccounts', 'generalLedger', 'trialBalance', 'bankReconciliationProposals']);
const PLATFORM_METHODS = {
  calculateKpi: 'analysis', realtime: 'analysis', historical: 'analysis', attribution: 'analysis', commercialFunnel: 'analysis', campaignOutcome: 'analysis', dashboard: 'analysis',
  defineAutomation: 'automation', runAutomation: 'automation', automationStatus: 'automation',
  metaPlan: 'marketing', ga4Plan: 'marketing', enhancedConversionPlan: 'marketing', queueDelivery: 'marketing'
};
const PLATFORM_READ = new Set(['calculateKpi', 'realtime', 'historical', 'attribution', 'commercialFunnel', 'campaignOutcome', 'dashboard', 'automationStatus', 'metaPlan', 'ga4Plan', 'enhancedConversionPlan']);

// The wrapper gates public server calls, while existing domain-internal calls
// remain bound to the original instance. It does not replace domain RBAC.
function guardDomain(service, owner, resolverProvider) {
  const methods = new Map();
  return new Proxy(service, {
    get(target, property) {
      const value = Reflect.get(target, property);
      if (typeof value !== 'function') return value;
      if (!methods.has(property)) methods.set(property, function (...args) {
        const ctx = args[0], actor = args[1];
        const id = owner === 'platform' ? PLATFORM_METHODS[property] : owner;
        if (id && ctx?.tenant_id && ctx?.dealer_id && actor && resolverProvider().profile(ctx)) {
          const operation = property === 'export' ? 'export' : (READ_METHODS.has(property) || PLATFORM_READ.has(property)) ? 'read' : 'write';
          resolverProvider().assertModule(ctx, actor, id, operation);
          if (owner === 'procurement' && resolverProvider().resolve(ctx, actor).industry_id !== 'AUTOMOTIVE') {
            throw Object.assign(new Error('Automotive is niet actief voor deze tenant'), { statusCode: 403, code: 'industry_disabled' });
          }
        }
        return Reflect.apply(value, target, args);
      });
      return methods.get(property);
    }
  });
}

function filterTools(tools, resolver, ctx, actor) {
  if (!resolver.profile(ctx)) return tools;
  const state = resolver.resolve(ctx, actor);
  return tools.filter(tool => !TOOL_MODULES[tool.tool_id] || state.tools.includes(tool.tool_id));
}
function filterWorkspaces(workspaces, resolver, ctx, actor) {
  if (!resolver.profile(ctx)) return workspaces;
  const state = resolver.resolve(ctx, actor);
  return workspaces.filter(w => w.id === 'automotive' ? state.industry_id === 'AUTOMOTIVE' && state.visible_modules.includes('procurement') : !MODULES[w.id] || state.visible_modules.includes(w.id));
}
function assertRoute(pathname, resolver, ctx, actor) {
  if (!resolver.profile(ctx)) return;
  const normalized = pathname.replace(/\.html$/, '');
  const id = routeModule(normalized);
  if (id) resolver.assertModule(ctx, actor, id, /\/export(?:\/|$)/.test(normalized) ? 'export' : 'read');
  if (/^\/(?:api\/)?automotive(?:\/|$)/.test(normalized)) {
    resolver.assertModule(ctx, actor, 'procurement');
    if (resolver.resolve(ctx, actor).industry_id !== 'AUTOMOTIVE') throw Object.assign(new Error('Automotive is niet actief'), { statusCode: 403, code: 'industry_disabled' });
  }
}
function moduleVisible(value, resolver, ctx, actor) {
  const id = moduleId(value);
  return !id || !resolver.profile(ctx) || resolver.resolve(ctx, actor).visible_modules.includes(id);
}
module.exports = { guardDomain, filterTools, filterWorkspaces, assertRoute, moduleVisible };
