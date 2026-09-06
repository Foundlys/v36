'use strict';
const assert=require('node:assert/strict');
const {MODULES,WRITE_TOOLS}=require('./module-catalog');
const {ENTITY_CAPABILITIES,METHOD_CAPABILITIES}=require('./module-access-contracts');
const {CapabilityResolver}=require('./capability-resolver');
const {guardDomain,assertRoute,routeCapability}=require('./composition-runtime');
const {FoundlyCrmCore,ENTITY_DEFINITIONS}=require('./crm-core');
const {FoundlyFinanceCore}=require('./finance-core');
const {DEFINITIONS}=require('./business-domains');
const state=new Map(),ctx={tenant_id:'access-contract-fixture',dealer_id:'default'},admin={id:'owner',roles:['ADMIN','SUPER_ADMIN']},viewer={id:'viewer',roles:['VIEWER']};
const adapter={bucket(c,scope){const key=JSON.stringify([c.tenant_id,c.dealer_id,scope]);if(!state.has(key))state.set(key,[]);return state.get(key);},persist(){},audit(){},emit(){}};
const resolver=new CapabilityResolver(adapter);
for(const id of Object.keys(MODULES)){
  const entities=id==='crm'?Object.keys(ENTITY_DEFINITIONS):id==='finance'?new FoundlyFinanceCore(adapter).schema().entities:DEFINITIONS[id]?.entities||[];
  for(const entity of entities){assert.ok(ENTITY_CAPABILITIES[id][entity],`${id}.${entity} must declare a capability`);assert.ok(MODULES[id].provided_capabilities.includes(ENTITY_CAPABILITIES[id][entity]));}
  resolver.configure(ctx,admin,{entitlements:[id],industry_id:'AUTOMOTIVE',expected_revision:resolver.profile(ctx)?.revision||0});
  for(const capability of MODULES[id].provided_capabilities){
    resolver.configure(ctx,admin,{entitlements:[id],industry_id:'AUTOMOTIVE',capability_flags:{[capability]:false},expected_revision:resolver.profile(ctx).revision});
    for(const [entity,ownedCapability] of Object.entries(ENTITY_CAPABILITIES[id]||{}).filter(([,cap])=>cap===capability)){
      assert.equal(routeCapability(`/api/${id}/${entity}`,id),capability);
      assert.throws(()=>assertRoute(`/api/${id}/${entity}`,resolver,ctx,admin),{code:'capability_disabled'});
      if(id==='finance')assert.throws(()=>assertRoute(`/api/finance/records/${entity}`,resolver,ctx,admin),{code:'capability_disabled'});
    }
    for(const [method,consumed] of Object.entries(METHOD_CAPABILITIES[id]||{}).filter(([,caps])=>caps.includes(capability))){
      let called=false;const service=guardDomain({[method](){called=true;}},['analysis','automation','marketing'].includes(id)?'platform':id,()=>resolver);
      assert.throws(()=>service[method](ctx,admin),{code:'capability_disabled'});assert.equal(called,false,`${id}.${method} ran while disabled`);
    }
  }
}
resolver.configure(ctx,admin,{entitlements:['crm','finance'],expected_revision:resolver.profile(ctx).revision});
assert.ok(resolver.resolve(ctx,viewer).tools.every(tool=>!WRITE_TOOLS.includes(tool)),'Read-only role must not advertise write tools');
const crm=guardDomain(new FoundlyCrmCore(adapter),'crm',()=>resolver);assert.doesNotThrow(()=>crm.activityVersion(ctx,viewer));assert.doesNotThrow(()=>crm.analyticsWithComparison(ctx,viewer));
const finance=guardDomain(new FoundlyFinanceCore(adapter),'finance',()=>resolver),approver={id:'approver',roles:['APPROVER']},financeAdmin={id:'finance-admin',roles:['FINANCE_ADMIN']};
assert.doesNotThrow(()=>finance.list(ctx,financeAdmin,'invoices'));
assert.doesNotThrow(()=>assertRoute('/api/finance/invoices/fixture/approve',resolver,ctx,approver,'POST'));
assert.throws(()=>assertRoute('/api/finance/invoices',resolver,ctx,approver,'POST'),{code:'composition_forbidden'});
resolver.configure(ctx,admin,{entitlements:['crm'],expected_revision:resolver.profile(ctx).revision});
assert.throws(()=>assertRoute('/api/tax/capabilities',resolver,ctx,admin),{code:'module_disabled'});
console.log('PASS all owned entities and declared engine operations enforce capability revocation, including read-only and approval roles');
