'use strict';

const { MODULES, TOOL_MODULES, moduleId, routeModule } = require('./module-catalog');
const READ_METHODS = new Set(['schema', 'status', 'diagnostics', 'list', 'get', 'search', 'query', 'reports', 'analytics', 'customer360', 'priorityLeads', 'inventoryMatches', 'inventoryCustomerMatches', 'dashboard', 'dashboardView', 'dashboardViews', 'pipelineSummary', 'providerStatuses', 'todayOpportunities', 'comparables', 'candidateAnalysis', 'analyseCandidate', 'getVehicle', 'economics', 'legalEntities', 'chartOfAccounts', 'generalLedger', 'trialBalance', 'bankReconciliationProposals']);
const PLATFORM_METHODS = {
  calculateKpi: 'analysis', realtime: 'analysis', historical: 'analysis', attribution: 'analysis', commercialFunnel: 'analysis', campaignOutcome: 'analysis', dashboard: 'analysis',
  defineAutomation: 'automation', runAutomation: 'automation', tickAutomations:'automation', automationStatus: 'automation', automationRecords: 'automation', createAutomationRecord: 'automation', exportAutomation:'automation',
  metaPlan: 'marketing', ga4Plan: 'marketing', enhancedConversionPlan: 'marketing', queueDelivery: 'marketing'
};
const PLATFORM_READ = new Set(['calculateKpi', 'realtime', 'historical', 'attribution', 'commercialFunnel', 'campaignOutcome', 'dashboard', 'automationStatus', 'automationRecords', 'metaPlan', 'ga4Plan', 'enhancedConversionPlan']);

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
          const operation = String(property).startsWith('export') ? 'export' : (READ_METHODS.has(property) || PLATFORM_READ.has(property)) ? 'read' : 'write';
          resolverProvider().assertModule(ctx, actor, id, operation);
          const entity=typeof args[2]==='string'?args[2]:null;
          const entityCapability=entity?routeCapability(`/api/${id}/${entity}`,id):null;
          if(entityCapability&&operation!=='export')resolverProvider().assertCapability(ctx,actor,entityCapability,operation);
          const methodCapabilities={priorityLeads:['crm:leads'],customer360:['crm:relationships','crm:contacts'],analytics:['crm:relationships','crm:leads'],pipelineSummary:['crm:relationships'],calculateKpi:['analysis:kpis'],commercialFunnel:['analysis:funnel'],campaignOutcome:['analysis:reports'],defineAutomation:['automation:workflows'],runAutomation:['automation:workflows'],tickAutomations:['automation:workflows'],automationStatus:['automation:runs'],createAutomationRecord:['automation:workflows']};
          for(const capability of methodCapabilities[property]||[])resolverProvider().assertCapability(ctx,actor,capability,operation);
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
function routeCapability(pathname, id) {
  const entity=pathname.split('/').filter(Boolean)[2];
  const groups={crm:{contacts:'contacts',companies:'companies',leads:'leads',deals:'relationships',pipelines:'relationships',customer360:'relationships'},finance:{invoices:'invoices',payments:'payments',ledger:'ledger',journals:'ledger',reports:'reports'},analysis:{kpis:'kpis',events:'events',funnel:'funnel',reports:'reports'},marketing:{campaigns:'campaigns',audiences:'audiences',attribution:'attribution',creatives:'campaigns',experiments:'campaigns'},procurement:{suppliers:'suppliers',opportunities:'opportunities',quotes:'approvals',orders:'approvals',documents:'approvals',tasks:'opportunities'},sales:{opportunities:'opportunities',pipelines:'pipeline',quotes:'quotes',orders:'quotes',tasks:'opportunities',activities:'pipeline'},calendar:{events:'events',availability:'availability',conflicts:'conflicts',calendars:'availability',reminders:'events',notifications:'events',scheduling:'availability'},communication:{drafts:'drafts',threads:'threads',messages:'inbox',templates:'drafts',preferences:'threads'},automation:{workflows:'workflows',tasks:'workflows',documents:'workflows',runs:'runs'}};
  return groups[id]?.[entity]?`${id}:${groups[id][entity]}`:null;
}
function assertRoute(pathname, resolver, ctx, actor, method='GET') {
  if (!resolver.profile(ctx)) return;
  const normalized = pathname.replace(/\.html$/, '');
  const id = routeModule(normalized);
  const operation=/\/exports?(?:\/|$)/.test(normalized)?'export':['GET','HEAD','OPTIONS'].includes(method)||/\/(?:query|insights|report|realtime|keyword-ideas|conflicts)$/.test(normalized)?'read':'write';
  if (id) resolver.assertModule(ctx, actor, id, operation);
  const cap=routeCapability(normalized,id);if(cap&&operation!=='export')resolver.assertCapability(ctx,actor,cap,operation);
  if (/^\/(?:api\/)?automotive(?:\/|$)/.test(normalized)) {
    resolver.assertModule(ctx, actor, 'procurement');
    if (resolver.resolve(ctx, actor).industry_id !== 'AUTOMOTIVE') throw Object.assign(new Error('Automotive is niet actief'), { statusCode: 403, code: 'industry_disabled' });
  }
}
function moduleVisible(value, resolver, ctx, actor) {
  const id = moduleId(value);
  return !id || !resolver.profile(ctx) || resolver.resolve(ctx, actor).visible_modules.includes(id);
}
function scopeVisible(scope,resolver,ctx,actor) {
  if(!resolver.profile(ctx))return true;
  const prefix=scope.split(':')[0],owner=prefix==='automotive'||prefix==='voorraad'?'procurement':moduleId(prefix);
  if(owner&&!moduleVisible(owner,resolver,ctx,actor))return false;
  return prefix!=='automotive'||resolver.resolve(ctx,actor).industry_id==='AUTOMOTIVE';
}
function connectorVisible(spec,resolver,ctx,actor) {
  if(!resolver.profile(ctx))return true;
  const category=String(spec?.categorie||spec?.category||'').toLowerCase();
  if(category.startsWith('automotive')&&resolver.resolve(ctx,actor).industry_id!=='AUTOMOTIVE')return false;
  const owners=[...new Set([...(spec?.modules||[]).map(moduleId).filter(Boolean),...(/boekhoud|payment|bank|finance|tax/.test(category)?['finance']:[])])];
  return !owners.length||owners.some(owner=>moduleVisible(owner,resolver,ctx,actor));
}
module.exports = { guardDomain, filterTools, filterWorkspaces, assertRoute, moduleVisible, routeCapability, scopeVisible, connectorVisible };
