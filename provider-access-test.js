'use strict';
const assert=require('node:assert/strict');
const {CapabilityResolver}=require('./capability-resolver');
const {BusinessDomain}=require('./business-domains');
const {assertRoute}=require('./composition-runtime');
const {cacheProviderReport}=require('./provider-report-cache');
const state=new Map(),ctx={tenant_id:'provider-boundary-fixture',dealer_id:'default'},other={tenant_id:'other-fixture',dealer_id:'default'};
const admin={id:'admin',roles:['SUPER_ADMIN']},reader={id:'reader',roles:['VIEWER']};let failure=false;
const adapter={bucket(c,s){const key=JSON.stringify([c,s]);if(!state.has(key))state.set(key,[]);return state.get(key);},persist(){if(failure)throw new Error('fixture persistence failure');},audit(){},publish(){}};
const resolver=new CapabilityResolver(adapter),core=new BusinessDomain('analysis',adapter,resolver);
function configure(capability){resolver.configure(ctx,admin,{entitlements:['analysis','calendar','marketing','communication','finance','crm','automation'],capability_flags:capability?{[capability]:false}:{},expected_revision:resolver.profile(ctx)?.revision||0});}
for(const [route,method,capability] of [
 ['/api/google/ga4/report','POST','analysis:reports'],['/api/google/ga4/realtime','POST','analysis:events'],
 ['/api/google/calendar/events','GET','calendar:events'],['/api/google/ads/query','POST','marketing:attribution'],
 ['/api/google/ads/keyword-ideas','POST','marketing:campaigns'],['/api/meta/insights','POST','marketing:attribution'],
 ['/api/measurement/google/ga4/send','POST','marketing:attribution'],['/api/whatsapp/messages','POST','communication:threads'],
 ['/api/tax/vat/calculate','POST','finance:ledger'],['/api/tax/invoices/validate','POST','finance:invoices']
]){configure(capability);assert.throws(()=>assertRoute(route,resolver,ctx,admin,method),{code:'capability_disabled'},route);}
configure();assert.doesNotThrow(()=>assertRoute('/api/google/ga4/report',resolver,ctx,reader,'POST'));
assert.throws(()=>assertRoute('/api/whatsapp/messages',resolver,ctx,reader,'POST'),{code:'composition_forbidden'});
for(const [capability,tool] of [['crm:contacts','crm_customer_360'],['crm:leads','crm_inventory_customer_matches'],['crm:leads','crm_pipeline_summary'],['automation:workflows','automation_status']]){
 configure(capability);assert.ok(!resolver.resolve(ctx,admin).tools.includes(tool));assert.throws(()=>resolver.assertTool(ctx,admin,tool),{code:'capability_disabled'});
}
resolver.configure(ctx,admin,{entitlements:['analysis'],expected_revision:resolver.profile(ctx).revision});
const route='/api/google/ga4/report',data={fixture:'SYNTHETIC_PROVIDER_CONTRACT_NOT_LIVE',rowCount:1,rows:[{metricValues:[{value:'7'}]}]},at='2026-09-09T00:00:00.000Z';
const one=cacheProviderReport(core,ctx,reader,route,'ga4_data_api',{property_id:'12345',limit:10},data,at);
const two=cacheProviderReport(core,ctx,reader,route,'ga4_data_api',{limit:10,property_id:'12345'},data,at);
assert.equal(one.record_id,two.record_id);assert.equal(core.list(ctx,reader,'provider_reports').total,1);
assert.deepEqual(core.get(ctx,reader,'provider_reports',one.record_id).data,data);
assert.equal(core.list(ctx,{id:'someone-else',roles:['VIEWER']},'provider_reports').total,0);
assert.equal(adapter.bucket(ctx,'social_media').length,0);assert.equal(adapter.bucket(ctx,'google_ads').length,0);
assert.throws(()=>core.save(ctx,admin,'provider_reports',{title:'forged'}),{code:'provider_ingest_required'});
failure=true;assert.throws(()=>cacheProviderReport(core,ctx,reader,route,'ga4_data_api',{property_id:'99999'},data,at),/persistence failure/);failure=false;
assert.equal(core.list(ctx,reader,'provider_reports').total,1);
resolver.configure(other,admin,{entitlements:['analysis'],expected_revision:0});assert.equal(core.list(other,reader,'provider_reports').total,0);
resolver.configure(ctx,admin,{entitlements:[],expected_revision:resolver.profile(ctx).revision});
assert.throws(()=>core.list(ctx,reader,'provider_reports'),{code:'module_disabled'});
assert.equal(core.export(ctx,admin).collections.provider_reports.length,1);
console.log('PASS provider alias capabilities, dependent ZERO tools, Analytics-only private cache, stable query keys, retention, isolation and persistence rollback');
