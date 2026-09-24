'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {StackDiscovery,nativeFacts}=require('./stack');
const ctx={tenant_id:'one',dealer_id:'d'},actor={id:'alice',roles:['MANAGER']};
function setup(){const all=new Map();let now=Date.parse('2026-09-24T10:00:00Z');const adapter={bucket(c,k){const key=c.tenant_id+':'+k;if(!all.has(key))all.set(key,[]);return all.get(key);},persist(){}};
return{discovery:new StackDiscovery({adapter,now:()=>new Date(now),observe:(c,a)=>nativeFacts(c,a,{resolution:{revision:2,visible_modules:['crm'],capabilities:['crm:leads']},connectors:[{id:'legacy-crm',expired:true},{id:'custom-crm',expired:false}],now:new Date(now).toISOString()})}),advance:n=>now+=n};}
const declaration=(value,extra={})=>({kind:'SOURCE_OF_TRUTH',subject:'customer',predicate:'authoritative_system',value,source_reference:'customer mapping review',confirm:true,reason:'Customer confirmed mapping',...extra});
test('heterogeneous systems expose known, blocked and unknown facts without live claims',()=>{
 const {discovery}=setup(),r=discovery.snapshot(ctx,actor);assert.equal(r.read_only,true);
 assert.ok(r.facts.some(x=>x.subject==='legacy-crm'&&x.reason==='EXPIRED_AUTHORIZATION'));
 assert.ok(r.uncertainties.some(x=>x.subject==='custom-crm'));assert.equal(r.completeness,'PARTIAL_AUTHORIZED_OBSERVATIONS');
 assert.ok(!r.facts.some(x=>x.predicate==='connection_verified'&&x.value===true));
});
test('competing CRM authority and schema declarations require human resolution',()=>{
 const {discovery}=setup();discovery.declare(ctx,actor,declaration('crm-one'));discovery.declare(ctx,actor,declaration('crm-two'));
 discovery.declare(ctx,actor,declaration({id:'number'},{kind:'SCHEMA',subject:'custom-api',predicate:'customer_id'}));
 discovery.declare(ctx,actor,declaration({id:'string'},{kind:'SCHEMA',subject:'custom-api',predicate:'customer_id'}));
 const r=discovery.snapshot(ctx,actor);assert.equal(r.conflicts.length,2);assert.equal(r.human_required,true);
 assert.ok(r.conflicts.every(x=>x.automatic_resolution===false));assert.equal(r.can_resolve_automatically.length,0);
});
test('customer input cannot manufacture provider verification, permissions or proof',()=>{
 const {discovery}=setup();assert.throws(()=>discovery.declare(ctx,actor,{...declaration('crm'),evidence_state:'PROVEN'}),{code:'zero_unknown_field'});
 const row=discovery.declare(ctx,actor,declaration('crm'));assert.equal(row.evidence_state,'CUSTOMER_CONFIRMED');assert.equal(row.provider_verified,false);
 assert.throws(()=>discovery.declare(ctx,{id:'reader',roles:['VIEWER']},declaration('crm')),{code:'zero_permission_denied'});
 assert.throws(()=>discovery.declare(ctx,actor,declaration('password=not-allowed')),{code:'zero_stack_secret_forbidden'});
});
test('private declarations respect tenant/current-role isolation and freshness',()=>{
 const s=setup();s.discovery.declare(ctx,actor,declaration('crm',{expires_at:'2026-09-24T10:01:00Z'}));
 assert.ok(!s.discovery.snapshot(ctx,{id:'admin',roles:['ADMIN']}).facts.some(x=>x.evidence_state==='CUSTOMER_CONFIRMED'));
 assert.ok(!s.discovery.snapshot({...ctx,tenant_id:'two'},actor).facts.some(x=>x.evidence_state==='CUSTOMER_CONFIRMED'));
 s.advance(61000);const r=s.discovery.snapshot(ctx,actor);assert.ok(r.uncertainties.some(x=>x.reason==='STALE_METADATA'));assert.ok(!r.facts.some(x=>x.evidence_state==='CUSTOMER_CONFIRMED'));
});
