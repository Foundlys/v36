'use strict';
const assert=require('node:assert/strict');
const {CapabilityResolver,resolve}=require('./capability-resolver');
const {INDUSTRIES}=require('./module-catalog');
const {BusinessDomain}=require('./business-domains');
const ctx={tenant_id:'second-industry-fixture',dealer_id:'default'},actor={id:'owner',roles:['ADMIN','SUPER_ADMIN']},store=new Map();
const adapter={bucket(c,name){const key=JSON.stringify([c,name]);if(!store.has(key))store.set(key,[]);return store.get(key);},persist(){},audit(){},publish(){}};
const production=new CapabilityResolver(adapter);production.configure(ctx,actor,{entitlements:['procurement','sales','analysis','crm'],industry_id:'GENERAL',expected_revision:0});
const demo={industry_id:'REAL_ESTATE_DEMO',production:false,extensions:{procurement:{fields:['property_reference','floor_area'],field_schema:{property_reference:{type:'string'},floor_area:{type:'number'}},objects:['acquisition_opportunity']},sales:{fields:['property_reference'],field_schema:{property_reference:{type:'string'}},objects:['property_listing']},crm:{fields:['property_reference'],objects:['property_customer_relationship']},analysis:{kpis:['property_yield']}}};
assert.throws(()=>production.configure(ctx,actor,{entitlements:['sales'],industry_id:'REAL_ESTATE_DEMO',expected_revision:1}),{code:'industry_unavailable'});
// Explicit test injection only, with no demo manifest in the production catalog.
const testResolver=Object.create(production);testResolver.resolve=(c,a)=>resolve(c,a,{...production.profile(c),industry_id:'REAL_ESTATE_DEMO'},{industries:{...INDUSTRIES,REAL_ESTATE_DEMO:demo},allowTestIndustries:true});
for(const module of ['procurement','sales']){
  const service=new BusinessDomain(module,adapter,testResolver);
  const record=service.save(ctx,actor,'opportunities',{title:'Explicit property fixture',industry_fields:{property_reference:'fixture-property-1'}}).record;
  assert.equal(record.industry_fields.property_reference,'fixture-property-1');
  assert.equal(record.industry_field_pack_id,'REAL_ESTATE_DEMO');
  const general=new BusinessDomain(module,adapter,production);
  const retained=general.save(ctx,actor,'opportunities',{title:'Retained after pack switch'},{id:record.id,expected_revision:record.revision}).record;
  assert.equal(retained.industry_fields.property_reference,'fixture-property-1');
  assert.throws(()=>general.save(ctx,actor,'opportunities',{industry_fields:{}},{id:record.id,expected_revision:retained.revision}),{code:'industry_pack_conflict'});
  assert.throws(()=>service.save(ctx,actor,'opportunities',{title:'Null field',industry_fields:null}),{code:'industry_field_invalid'});
  assert.throws(()=>service.save(ctx,actor,'opportunities',{title:'Wrong type',industry_fields:{property_reference:20}}),{code:'industry_field_invalid'});
  const revised=service.save(ctx,actor,'opportunities',{industry_fields:{property_reference:'fixture-property-2'}},{id:record.id,expected_revision:retained.revision}).record;
  assert.equal(revised.industry_field_pack_id,'REAL_ESTATE_DEMO');
  assert.equal(revised.industry_fields.property_reference,'fixture-property-2');
  assert.throws(()=>service.save(ctx,actor,'opportunities',{title:'Wrong pack field',industry_fields:{vin:'not-allowed'}}),{code:'industry_field_unavailable'});
  assert.throws(()=>new BusinessDomain(module,adapter,production).save(ctx,actor,'opportunities',{title:'Production should reject demo',industry_fields:{property_reference:'fixture-property-1'}}),{code:'industry_field_unavailable'});
}
assert.ok(!testResolver.resolve(ctx,actor).tools.some(tool=>tool.startsWith('automotive_')));assert.ok(!INDUSTRIES.REAL_ESTATE_DEMO);
console.log('PASS test-only second industry extends owned business records without production registration or universal engine changes');
