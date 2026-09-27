'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {fixture}=require('../zero-evaluation/fixture');
test('real discovery API gates configured schema reads and keeps private source proof through encrypted restart',async()=>{
 const f=await fixture({FOUNDLY_ZERO_DISCOVERY_TARGETS:JSON.stringify([{id:'custom-crm',module:'crm',schema_url:'https://discovery.fixture.invalid/openapi.json'}]),NODE_OPTIONS:'--require='+path.resolve(__dirname,'../zero-evaluation/discovery-provider-fixture.js')});
 try{
  await f.request('/api/composition','PUT',{entitlements:['crm'],expected_revision:0});const alice=await f.enroll('discovery.alice'),bob=await f.enroll('discovery.bob'),viewer=await f.enroll('discovery.viewer',['VIEWER']);
  const a=(route,method,body)=>f.request(route,method,body,alice.cookie),input={target_id:'custom-crm'};
  assert.equal((await f.request('/api/zero/stack/discover','POST',input,viewer.cookie)).status,403);
  let r=await a('/api/zero/stack/discover','POST',input);assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.body.proof_scope,'SCHEMA_DOCUMENT_ONLY');
  const hasSchema=r=>r.body.facts.some(x=>x.subject==='custom-crm:PrivateCustomer');assert.equal(hasSchema(await a('/api/zero/stack')),true);
  assert.equal(hasSchema(await f.request('/api/zero/stack','GET',undefined,bob.cookie)),false);
  await f.stop();await f.start();assert.equal(hasSchema(await a('/api/zero/stack')),true);
  await f.request('/api/composition','PUT',{entitlements:['sales'],expected_revision:1});assert.equal((await a('/api/zero/stack/discover','POST',input)).status,403);assert.equal(hasSchema(await a('/api/zero/stack')),false);
  await f.request('/api/composition','PUT',{entitlements:['crm'],expected_revision:2});await f.stop();f.env.ZERO_EVALUATION_DISCOVERY_STATUS='401';await f.start();
  r=await a('/api/zero/stack/discover','POST',input);assert.equal(r.status,503);assert.equal(r.body.state,'BLOCKED');assert.equal(r.body.code,'zero_discovery_provider_401');assert.equal(hasSchema(await a('/api/zero/stack')),false);
 }finally{await f.close();}
});
