'use strict';

const { MODULES, TOOL_MODULES, moduleId, routeModule } = require('./module-catalog');
const {ENTITY_CAPABILITIES,METHOD_CAPABILITIES,methodOperation}=require('./module-access-contracts');
const PLATFORM_METHODS = {
  calculateKpi: 'analysis', realtime: 'analysis', historical: 'analysis', attribution: 'analysis', commercialFunnel: 'analysis', campaignOutcome: 'analysis', dashboard: 'analysis',
  defineAutomation: 'automation', runAutomation: 'automation', tickAutomations:'automation', automationStatus: 'automation', automationRecords: 'automation', createAutomationRecord: 'automation', exportAutomation:'automation',
  taxRules:'finance',calculateVat:'finance',validateDutchInvoice:'finance',retentionPolicy:'finance',archiveLegalRecord:'finance',taxCapabilities:'finance',
  metaPlan: 'marketing', ga4Plan: 'marketing', enhancedConversionPlan: 'marketing', queueDelivery: 'marketing'
};
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
          const operation = methodOperation(property);
          resolverProvider().assertModule(ctx, actor, id, operation);
          const entity=typeof args[2]==='string'?args[2]:null;
          const entityCapability=entity?routeCapability(`/api/${id}/${entity}`,id):null;
          if(entityCapability&&operation!=='export')resolverProvider().assertCapability(ctx,actor,entityCapability,operation);
          for(const capability of METHOD_CAPABILITIES[id]?.[property]||[])resolverProvider().assertCapability(ctx,actor,capability,operation);
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
  const parts=pathname.split('/').filter(Boolean),entity=(parts[2]==='records'?parts[3]:parts[2])?.replaceAll('-','_');
  return ENTITY_CAPABILITIES[id]?.[entity]||null;
}
function assertRoute(pathname, resolver, ctx, actor, method='GET') {
  if (!resolver.profile(ctx)) return;
  const normalized = pathname.replace(/\.html$/, '');
  const id = routeModule(normalized);
  const operation=/\/approve$/.test(normalized)?'approve':/\/(?:owned-)?exports?(?:\/|$)/.test(normalized)?'export':['GET','HEAD','OPTIONS'].includes(method)||/\/(?:query|insights|report|realtime|keyword-ideas|conflicts|ask)$/.test(normalized)?'read':'write';
  if (id) resolver.assertModule(ctx, actor, id, operation);
  if(id&&/^\/api\/(?:module|engine)\//.test(normalized)){for(const capability of MODULES[id].provided_capabilities)resolver.assertCapability(ctx,actor,capability,operation);}
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
