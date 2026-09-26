'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {fixture}=require('../zero-evaluation/fixture'),{MODULES}=require('../module-catalog');
test('actual encrypted seed commit failure rolls back native effects and cursor together; explicit retry and restart retain one prefix',async()=>{
 const f=await fixture({FOUNDLY_TENANT_ID:'demo-atomic-fixture',FOUNDLY_DEMO_TENANT_ID:'demo-atomic-fixture',FOUNDLY_DEMO_UNIVERSE_ENABLED:'true',NODE_OPTIONS:'--require='+require.resolve('../zero-evaluation/demo-persist-failure')});
 try{
  await f.request('/api/composition','PUT',{industry_id:'ECOMMERCE',entitlements:Object.keys(MODULES),expected_revision:0});const owner=await f.enroll('demo.atomic.owner',['SUPER_ADMIN']);
  const call=(route,method,body,headers)=>f.request(route,method,body,owner.cookie,headers),options={seed:'atomic-commerce',as_of:'2026-09-26T00:00:00.000Z',product_count:12,order_count:12,customer_count:12};
  const preview=(await call('/api/demo-universe/preview','POST',options)).body;
  const started=await call('/api/demo-universe/runs','POST',{...options,plan_fingerprint:preview.plan_fingerprint,expected_profile_revision:1,confirm:true,reason:'Isolated atomic seed proof'},{'idempotency-key':'atomic-seed-proof'});assert.equal(started.status,201,JSON.stringify(started.body));
  const route='/api/demo-universe/runs/'+started.body.universe.id,input={expected_cursor:0,expected_profile_revision:1,limit:100,confirm:true,reason:'Explicit isolated first prefix'};
  const failed=await call(route+'/advance','POST',input,{'x-demo-fail-persist':'isolated-demo-fixture'});assert.equal(failed.status,507,JSON.stringify(failed.body));
  assert.equal((await call(route)).body.universe.applied_nodes,0);assert.equal((await call('/api/crm/companies')).body.total,0);assert.equal((await call('/api/sales/commerce/commerce_products')).body.total,0);
  await f.stop();await f.start();owner.cookie=await f.login(owner);assert.equal((await call(route)).body.universe.applied_nodes,0);
  const resumed=await call(route+'/advance','POST',input);assert.equal(resumed.status,200,JSON.stringify(resumed.body));assert.equal(resumed.body.universe.batch.atomic_durable_commit,true);
  let cursor=resumed.body.universe.applied_nodes;const companies=(await call('/api/crm/companies?limit=100')).body.items.map(x=>x.id);assert.ok(cursor>0&&cursor<=100);
  // Warm the actual incremental fact cache immediately before the first lead.
  const graph=require('../ecommerce-demo-universe').build(options),leadIndex=graph.nodes.findIndex(n=>n.kind==='lead');
  while(cursor<leadIndex){const next=await call(route+'/advance','POST',{...input,expected_cursor:cursor,limit:Math.min(100,leadIndex-cursor)});assert.equal(next.status,200);cursor=next.body.universe.applied_nodes;}
  const beforeFunnel=(await call('/api/analysis/funnel')).body,leadsBefore=(await call('/api/crm/leads?limit=100')).body.total;assert.ok(Array.isArray(beforeFunnel.stages));assert.ok(Number.isInteger(beforeFunnel.events));
  const stop=new AbortController(),stream=await fetch(f.base+'/api/platform/events/stream',{headers:{cookie:owner.cookie,origin:f.env.FOUNDLY_PUBLIC_BASE_URL},signal:stop.signal});assert.equal(stream.status,200);
  let transcript='';const reading=(async()=>{try{for await(const chunk of stream.body)transcript+=Buffer.from(chunk).toString('utf8');}catch(error){if(!stop.signal.aborted)throw error;}})();
  try{
   for(let n=0;n<100&&!transcript.includes('event: ready');n++)await new Promise(r=>setTimeout(r,10));assert.ok(transcript.includes('event: ready'));
   const failure=await call(route+'/advance','POST',{...input,expected_cursor:cursor,limit:1},{'x-demo-fail-persist':'isolated-demo-fixture'});assert.equal(failure.status,507,JSON.stringify(failure.body));
   await new Promise(r=>setTimeout(r,100));assert.ok(!transcript.includes('event: foundly'),'Uncommitted native events must not reach a subscriber');
   assert.equal((await call(route)).body.universe.applied_nodes,cursor);assert.equal((await call('/api/crm/leads?limit=100')).body.total,leadsBefore);
   const afterFunnel=(await call('/api/analysis/funnel')).body;assert.deepEqual(afterFunnel.stages,beforeFunnel.stages,'Rolled-back events cannot survive in the warmed fact cache');assert.equal(afterFunnel.events,beforeFunnel.events);
   const success=await call(route+'/advance','POST',{...input,expected_cursor:cursor,limit:1});assert.equal(success.status,200);cursor=success.body.universe.applied_nodes;
   for(let n=0;n<100&&!transcript.includes('event: foundly');n++)await new Promise(r=>setTimeout(r,10));assert.ok(transcript.includes('event: foundly'),'The same subscriber receives the committed event');
   assert.equal((await call('/api/crm/leads?limit=100')).body.total,leadsBefore+1);
   assert.ok((await call('/api/analysis/funnel')).body.events>beforeFunnel.events,'The committed event is visible through the same warmed-query path');
  }finally{stop.abort();await reading;}
  await f.stop();await f.start();owner.cookie=await f.login(owner);
  assert.equal((await call(route)).body.universe.applied_nodes,cursor);assert.deepEqual((await call('/api/crm/companies?limit=100')).body.items.map(x=>x.id),companies);
  assert.equal((await call(route+'/advance','POST',input)).status,409);assert.equal((await call('/api/communication/messages')).body.total,0);
  const disk=JSON.parse(fs.readFileSync(path.join(f.dir,'foundly-core-state.json'),'utf8'));assert.equal(disk.records.__foundly_core_encrypted,true);assert.equal(disk.memory.__foundly_core_encrypted,true);assert.ok(!JSON.stringify(disk).includes('[SYNTHETIC DEMO]'));
 }finally{await f.close();}
});
