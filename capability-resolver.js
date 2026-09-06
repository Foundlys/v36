'use strict';

const { MODULES, CORE_SERVICES, TOOL_MODULES, TOOL_CAPABILITIES, WRITE_TOOLS, BUNDLES, INDUSTRIES, moduleId } = require('./module-catalog');
const crypto = require('crypto');
const {scopedMutation}=require('./scoped-mutation');
const clone = value => JSON.parse(JSON.stringify(value));
function fail(code, message, statusCode = 403) { throw Object.assign(new Error(message), { code, statusCode }); }
function identity(ctx) {
  if (!ctx || !/^[A-Za-z0-9_.:-]{1,200}$/.test(ctx.tenant_id || '') || !/^[A-Za-z0-9_.:-]{1,200}$/.test(ctx.dealer_id || '')) fail('composition_context_invalid', 'Tenantcontext ontbreekt', 400);
  return ctx;
}
function permissions(actor = {}) {
  const roles = (actor.roles || []).map(x => String(x).toUpperCase());
  return new Set([...(actor.permissions || []), ...(roles.some(r => ['ADMIN', 'FOUNDER', 'SUPER_ADMIN'].includes(r)) ? ['*'] : []),
    ...roles.flatMap(role => role === 'MANAGER' ? Object.keys(MODULES).filter(id=>id!=='finance').flatMap(id => [`${id}:read`, `${id}:write`, `${id}:export`]) : role === 'FINANCE_ADMIN' ? ['finance:read','finance:write','finance:approve','finance:export'] : role === 'APPROVER' ? ['finance:read','finance:approve'] : role === 'ANALYST' ? ['analysis:read','finance:read'] : role === 'VIEWER' ? Object.keys(MODULES).map(id => `${id}:read`) : role === 'SALES' ? ['crm:read','crm:write','sales:read','sales:write','calendar:read','calendar:write','communication:read','communication:write'] : role === 'ACCOUNTANT' ? ['finance:read','finance:write','finance:export'] : role === 'MARKETING' ? ['crm:read','crm:write','marketing:read','marketing:write','analysis:read'] : [])]);
}
function allowed(actor, permission) { const p = permissions(actor); return p.has('*') || p.has(permission); }
function requirePermission(actor, permission) { if (!allowed(actor, permission)) fail('composition_forbidden', 'Deze capability is niet toegestaan'); }
function canManage(actor={}) { return (actor.roles||[]).some(role=>['FOUNDER','SUPER_ADMIN'].includes(String(role).toUpperCase()))||(actor.permissions||[]).includes('composition:manage'); }

function resolve(ctx, actor, profile = null, options = {}) {
  identity(ctx);
  if (profile && (profile.tenant_id !== ctx.tenant_id || profile.dealer_id !== ctx.dealer_id)) fail('composition_tenant_mismatch', 'Configuratie behoort tot een andere tenant');
  // Legacy tenant behavior is preserved until an explicit composition is saved.
  const legacy = !profile;
  const industry = profile?.industry_id || 'AUTOMOTIVE';
  const registry = options.industries || INDUSTRIES;
  const pack = registry[industry];
  if (!pack || (!pack.production && !options.allowTestIndustries)) fail('industry_unavailable', 'Industrie is niet beschikbaar', 422);
  const entitled = new Set(legacy ? Object.keys(MODULES) : profile.entitlements);
  const enabled = (legacy ? Object.keys(MODULES) : profile.enabled_modules).filter(id => entitled.has(id));
  const visible = enabled.filter(id => allowed(actor, `${id}:read`));
  return {
    schema_version: 'foundly-capability-resolution/1.0.0', tenant_id: ctx.tenant_id, dealer_id: ctx.dealer_id,
    revision: profile?.revision || 0, legacy_compatibility: legacy, industry_id: industry,
    core_services: [...CORE_SERVICES], entitlements: [...entitled], enabled_modules: enabled, visible_modules: visible,
    capabilities: visible.flatMap(id => MODULES[id].provided_capabilities.filter(cap => profile?.capability_flags?.[cap] !== false)),
    routes: visible.map(id => MODULES[id].route),
    tools: Object.entries(TOOL_MODULES).filter(([tool, id]) => visible.includes(id) && allowed(actor,`${id}:${WRITE_TOOLS.includes(tool)?'write':'read'}`) && profile?.capability_flags?.[TOOL_CAPABILITIES[tool]] !== false && (!tool.startsWith('automotive_') || industry === 'AUTOMOTIVE')).map(([tool]) => tool),
    industry_extensions: Object.fromEntries(Object.entries(pack.extensions).filter(([id]) => visible.includes(id))),
    data_policy: 'HIDDEN_RETAINED_EXPORTABLE', no_customer_fork: true
  };
}

class CapabilityResolver {
  constructor(adapter) { this.adapter = adapter; }
  profile(ctx) { identity(ctx); return this.adapter.bucket(ctx, 'composition:profiles').at(-1) || null; }
  resolve(ctx, actor) { return resolve(ctx, actor, this.profile(ctx)); }
  configure(ctx, actor, input) {
    identity(ctx);
    if (!canManage(actor)) fail('composition_forbidden', 'Alleen de bevoegde platformbeheerder mag pakketrechten wijzigen');
    if (input.tenant_id && input.tenant_id !== ctx.tenant_id || input.dealer_id && input.dealer_id !== ctx.dealer_id) fail('composition_tenant_mismatch', 'Cross-tenant configuratie geweigerd');
    const bundle = input.bundle ? BUNDLES[input.bundle] : null;
    if (input.bundle && !bundle) fail('bundle_invalid', 'Onbekend pakket', 422);
    const normalize = values => {
      if (!Array.isArray(values) || values.length > 50) fail('modules_invalid', 'Expliciete modulelijst vereist', 422);
      const ids = values.map(moduleId);
      if (ids.some(id => !id)) fail('module_unknown', 'Onbekende module', 422);
      return [...new Set(ids)].sort();
    };
    const entitlements = normalize(input.entitlements || bundle);
    const enabled = normalize(input.enabled_modules || entitlements);
    if (enabled.some(id => !entitlements.includes(id))) fail('module_not_entitled', 'Module valt buiten het pakket');
    const industry_id = String(input.industry_id || 'GENERAL').toUpperCase();
    if (!INDUSTRIES[industry_id]?.production) fail('industry_unavailable', 'Onbekende productie-industrie', 422);
    const capability_flags = {};
    for (const [cap, value] of Object.entries(input.capability_flags || {})) {
      if (!Object.values(MODULES).some(m => m.provided_capabilities.includes(cap)) || typeof value !== 'boolean') fail('capability_flag_invalid', 'Ongeldige capabilityflag', 422);
      capability_flags[cap] = value;
    }
    const body = { industry_id, entitlements, enabled_modules: enabled, capability_flags };
    const signature = crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex');
    const previous = this.profile(ctx);
    if (previous?.signature === signature) return { ok: true, created: false, profile: clone(previous) };
    if (input.expected_revision !== (previous?.revision || 0)) fail('composition_revision_conflict', 'Configuratie is intussen gewijzigd', 409);
    const row = { ...body, tenant_id: ctx.tenant_id, dealer_id: ctx.dealer_id, signature, revision: (previous?.revision || 0) + 1, created_at: new Date().toISOString(), created_by: actor.id };
    return scopedMutation(this.adapter,ctx,['composition:profiles','platform:audit'],()=>{
    this.adapter.bucket(ctx, 'composition:profiles').push(row);
    this.adapter.audit(ctx, actor, 'COMPOSITION_CHANGED', 'tenant_composition', String(row.revision), { previous_revision: previous?.revision || 0, enabled_modules: enabled, data_deleted: false });
    return { ok: true, created: true, profile: clone(row), data_deleted: false };
    });
  }
  assertModule(ctx, actor, id, operation = 'read') {
    if (!MODULES[id]) fail('module_unknown', 'Onbekende module', 404);
    const state = this.resolve(ctx, actor);
    // Export survives disablement/revocation but still requires current export permission.
    if (operation !== 'export' && !state.enabled_modules.includes(id)) fail('module_disabled', `${MODULES[id].display_name} is niet actief`);
    if (!state.legacy_compatibility || operation === 'export') requirePermission(actor, `${id}:${operation}`);
    return state;
  }
  preview(ctx,actor,input) {
    const current=this.resolve(ctx,actor),snapshots=clone(this.adapter.bucket(ctx,'composition:profiles'));
    const isolated=new CapabilityResolver({bucket:(ctx,scope)=>scope==='composition:profiles'?snapshots:[],audit:()=>{},persist:()=>{}});
    const result=isolated.configure(ctx,actor,input),next=isolated.resolve(ctx,actor);
    return {ok:true,profile:result.profile,resolution:next,diff:{enabled:next.enabled_modules.filter(id=>!current.enabled_modules.includes(id)),disabled:current.enabled_modules.filter(id=>!next.enabled_modules.includes(id)),industry_changed:next.industry_id!==current.industry_id},persistent_changes:false,data_deleted:false,expected_revision:current.revision};
  }
  assertTool(ctx, actor, tool) {
    const id = TOOL_MODULES[tool];
    if (id) this.assertModule(ctx, actor, id, WRITE_TOOLS.includes(tool) ? 'write' : 'read');
    if (this.profile(ctx)?.capability_flags?.[TOOL_CAPABILITIES[tool]] === false) fail('capability_disabled', 'Deze capability is niet actief');
    if (tool.startsWith('automotive_') && this.resolve(ctx, actor).industry_id !== 'AUTOMOTIVE') fail('industry_tool_disabled', 'Automotive is niet actief');
  }
  assertCapability(ctx, actor, capability, operation='read') {
    const id=String(capability).split(':')[0];
    this.assertModule(ctx,actor,id,operation);
    if(!MODULES[id].provided_capabilities.includes(capability))fail('capability_unknown','Onbekende capability',404);
    if(this.profile(ctx)?.capability_flags?.[capability]===false)fail('capability_disabled','Deze capability is niet actief');
  }
}
module.exports = { CapabilityResolver, resolve, permissions, allowed, requirePermission, canManage };
