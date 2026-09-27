'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {fixture}=require('../zero-evaluation/fixture');
test('real specialist API uses native composition, owned plans, revalidation and encrypted replay',async()=>{
 const f=await fixture();try{
  assert.equal((await f.request('/api/composition','PUT',{entitlements:['sales','automation'],expected_revision:0})).status,200);
  const alice=await f.enroll('agent.alice'),bob=await f.enroll('agent.bob');
  const request=(url,method,body)=>f.request(url,method,body,alice.cookie);
  const catalog=await request('/api/zero/agents');assert.equal(catalog.status,200);assert.ok(!catalog.body.tools.some(t=>t.module==='finance'));
  const tools=catalog.body.tools.map(t=>t.id);assert.ok(tools.includes('sales_pipeline'));assert.ok(tools.includes('automation_status'));
  const created=await request('/api/zero/plans','POST',{objective:'Inspect Sales and Workflow',request_id:crypto.randomUUID(),steps:[{id:'sales',tool_id:'sales_pipeline'},{id:'workflow',tool_id:'automation_status',depends_on:['sales']}]});
  assert.equal(created.status,201,JSON.stringify(created.body));const url='/api/zero/plans/'+created.body.plan.id;
  assert.equal((await f.request(url,'GET',undefined,bob.cookie)).status,404);
  const ran=await request(url+'/run','POST',{});assert.equal(ran.status,200,JSON.stringify(ran.body));assert.equal(ran.body.plan.state,'VERIFIED');assert.equal(ran.body.evidence.length,2);
  assert.equal((await request('/api/automation/tasks')).body.total,0);
  await f.stop();await f.start();alice.cookie=await f.login(alice);
  const replay=await request(url+'/run','POST',{});assert.equal(replay.body.replayed,true);assert.deepEqual(replay.body.evidence,[]);
  const fresh=await request('/api/zero/plans','POST',{objective:'Recheck Sales',request_id:crypto.randomUUID(),steps:[{id:'sales',tool_id:'sales_pipeline'}]});
  assert.equal((await f.request('/api/composition','PUT',{entitlements:['automation'],expected_revision:1})).status,200);
  assert.equal((await request('/api/zero/plans/'+fresh.body.plan.id+'/run','POST',{})).status,403);
 }finally{await f.close();}
});
