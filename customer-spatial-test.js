'use strict';
const assert=require('node:assert/strict');
const {resolve}=require('./capability-resolver');
const {MODULES:catalog}=require('./module-catalog');
const {WORKSPACE_DEFINITIONS}=require('./workspace-system');
const M=require('./customer-spatial-model');
const ctx={tenant_id:'spatial-fixture',dealer_id:'fixture-business'};
const moduleIds=Object.keys(catalog);
const nav={tenant:ctx,workspaces:Object.values(WORKSPACE_DEFINITIONS)};
function graph(ids=moduleIds,role='ADMIN',flags={}){
 const profile={...ctx,industry_id:'GENERAL',revision:1,entitlements:ids,enabled_modules:ids,capability_flags:flags};
 const resolution=resolve(ctx,{roles:[role]},profile);
 return {resolution,result:M.buildGraph({resolution,navigation:nav,catalog:Object.values(catalog)})};
}
const all=graph().result;
assert.deepEqual(all.nodes.filter(n=>n.kind==='module').map(n=>n.label),['INKOOP','VERKOOP','FINANCE','CRM','AGENDA','MAIL','SOCIAL MEDIA','MARKETING','ANALYTICS']);
// Every possible entitlement subset, exercised against the real resolver.
let profiles=0;
for(let bits=0;bits<2**moduleIds.length;bits++)for(const role of ['ADMIN','VIEWER','SALES','MARKETING','ACCOUNTANT']){
 const ids=moduleIds.filter((_,i)=>bits&(1<<i)),{resolution,result}=graph(ids,role);profiles++;
 for(const node of result.nodes){assert.ok(resolution.visible_modules.includes(node.owner));if(node.capability)assert.ok(resolution.capabilities.includes(node.capability));}
 const expected=M.MODULES.filter(n=>resolution.visible_modules.includes(n.owner)).map(n=>n.id);
 assert.deepEqual(result.nodes.filter(n=>n.kind==='module').map(n=>n.id),expected);
}
for(const cap of Object.values(catalog).flatMap(m=>m.provided_capabilities)){
 const result=graph(moduleIds,'ADMIN',{[cap]:false}).result;
 assert.ok(!result.nodes.some(n=>n.capability===cap),cap);
 if(cap==='marketing:campaigns')assert.ok(!result.nodes.some(n=>n.id==='social'));
}
const {resolution}=graph();
const inputs={resolution,navigation:nav,catalog:Object.values(catalog)};
assert.equal(M.buildGraph({...inputs,navigation:{...nav,tenant:{...ctx,tenant_id:'other'}}}).nodes.length,0);
assert.equal(M.buildGraph({...inputs,navigation:{...nav,workspaces:[]}}).nodes.length,0);
assert.equal(M.buildGraph({...inputs,resolution:null}).nodes.length,0);
const social=sources=>M.buildGraph({...inputs,sources}).nodes.filter(n=>n.parent==='social');
assert.equal(social([{source_id:'meta',connection_status:'CONNECTED'}]).length,0,'Meta connection is not evidence for separate social services');
assert.equal(social([{source_id:'instagram',connection_status:'CONFIGURED'}]).length,0);
assert.equal(social([{source_id:'tiktok',connection_status:'CONNECTED',runtime_enabled:false}]).length,0);
assert.deepEqual(social(['facebook','instagram','tiktok'].map(source_id=>({source_id,connection_status:'CONNECTED',runtime_enabled:true}))).map(n=>n.label),['Facebook','Instagram','TikTok']);
for(const node of all.nodes.filter(n=>n.kind==='subnode')){
 const url=new URL(node.href,'https://example.test');
 if(url.searchParams.has('section'))assert.ok(WORKSPACE_DEFINITIONS[node.owner].sections.includes(url.searchParams.get('section')),node.href);
 assert.ok(all.edges.some(e=>e.from===node.parent&&e.to===node.id));
}
const main=M.MODULES.map(n=>n.position),dist=main.map(p=>Math.hypot(...p));
assert.ok(Math.max(...dist)/Math.min(...dist)>2.7,'unequal core distances');
assert.ok(Math.max(...main.map(p=>p[2]))-Math.min(...main.map(p=>p[2]))>700,'substantial Z depth');
assert.equal(new Set(main.map(p=>p[1])).size,9,'distinct heights');
const scales=main.map(p=>1500/(1500-p[2]));assert.ok(Math.max(...scales)/Math.min(...scales)>1.6);
for(const p of main){const q=M.rotated(p,Math.PI*2,0);q.forEach((v,i)=>assert.ok(Math.abs(v-p[i])<1e-9));assert.notDeepEqual(M.rotated(p,Math.PI,0),p);}
for(const edge of all.edges){const from=edge.from==='core'?[0,0,0]:all.nodes.find(n=>n.id===edge.from).position,to=all.nodes.find(n=>n.id===edge.to).position,s=M.segment(from,to);const result=[Math.cos(s.roll)*Math.cos(s.yaw),Math.sin(s.roll)*Math.cos(s.yaw),-Math.sin(s.yaw)].map((v,i)=>from[i]+v*s.length);result.forEach((v,i)=>assert.ok(Math.abs(v-to[i])<1e-8));}
const r=new M.Rotation();for(let i=0;i<600;i++)r.step(1/60);assert.ok(r.yaw>0);r.pause();const frozen=JSON.stringify(r);for(let i=0;i<10000;i++)r.step(1/60);assert.equal(JSON.stringify(r),frozen);r.manual(.4,.2);const manual=r.yaw;r.resume();assert.equal(r.yaw,manual);r.step(.05);assert.ok(r.yaw>manual);
console.log(`PASS spatial model: ${profiles} real-resolver profiles, capability flags, tenant mismatch, provider state, existing destinations, 3D geometry, rotation and exact pause/resume. Visual/browser acceptance not claimed.`);
