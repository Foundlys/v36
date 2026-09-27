'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{CapabilityResolver}=require('../capability-resolver');
test('each capability resolution rereads live authority and configuration without retaining an earlier role grant',()=>{
 const ctx={tenant_id:'scope-demo',dealer_id:'default'},buckets=new Map(),adapter={bucket(c,s){const key=JSON.stringify([c,s]);if(!buckets.has(key))buckets.set(key,[]);return buckets.get(key);},persist(){},audit(){}},resolver=new CapabilityResolver(adapter),admin={id:'owner',roles:['SUPER_ADMIN']};
 resolver.configure(ctx,admin,{industry_id:'ECOMMERCE',entitlements:['sales','automation'],expected_revision:0});
 let roles=['SUPER_ADMIN'],extra=[],active=true;const current=()=>{if(!active)throw Object.assign(Error('Current membership revoked'),{statusCode:401});};
 const actor={id:'live-owner',get roles(){current();return roles;},get permissions(){current();return extra;}};
 const initial=resolver.resolve(ctx,actor);assert.ok(initial.tools.includes('sales_pipeline'));assert.ok(initial.tools.includes('automation_status'));resolver.assertModule(ctx,actor,'sales','write');
 roles=['VIEWER'];const reader=resolver.resolve(ctx,actor);assert.ok(reader.tools.includes('sales_pipeline'));assert.throws(()=>resolver.assertModule(ctx,actor,'sales','write'),{code:'composition_forbidden'});assert.throws(()=>resolver.assertModule(ctx,actor,'sales','export'),{code:'composition_forbidden'});
 extra=['sales:write'];resolver.assertModule(ctx,actor,'sales','write');extra=[];assert.throws(()=>resolver.assertModule(ctx,actor,'sales','write'),{code:'composition_forbidden'});
 resolver.configure(ctx,admin,{industry_id:'ECOMMERCE',entitlements:['automation'],expected_revision:1});assert.ok(!resolver.resolve(ctx,actor).tools.includes('sales_pipeline'));assert.throws(()=>resolver.assertTool(ctx,actor,'sales_pipeline'),{code:'module_disabled'});
 active=false;assert.throws(()=>resolver.resolve(ctx,actor),{statusCode:401});assert.throws(()=>resolver.assertTool(ctx,actor,'automation_status'),{statusCode:401});
 assert.ok(initial.tools.includes('sales_pipeline'),'Earlier plain observations cannot authorize current requests');
});
