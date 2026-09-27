'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {fixture}=require('../zero-evaluation/fixture');
test('one ZERO question spans real native Sales and Workflow evidence and preserves truthful model absence',async()=>{
 const f=await fixture();try{
  await f.request('/api/composition','PUT',{entitlements:['sales','automation'],expected_revision:0});const alice=await f.enroll('cross.alice');
  const a=(route,method,body)=>f.request(route,method,body,alice.cookie),body={message:'Compare Sales and Automation bottlenecks',conversation_id:crypto.randomUUID(),turn_id:crypto.randomUUID()};
  let r=await a('/api/zero/turn','POST',body);assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.body.status,'partial');assert.equal(r.body.verification.model_available,false);assert.deepEqual(r.body.verification.specialists,['Sales','Workflow']);assert.equal(r.body.plan.tools.length,2);assert.equal(r.body.verification.source_reverified,true);assert.equal((await a('/api/automation/tasks')).body.total,0);
  const receipt=r.body.plan.agent_plan_id;r=await a('/api/zero/turn','POST',body);assert.equal(r.status,200);assert.notEqual(r.body.plan.agent_plan_id,receipt,'Read-only repeats collect current evidence');
  await f.request('/api/composition','PUT',{entitlements:['automation'],expected_revision:1});r=await a('/api/zero/turn','POST',body);assert.equal(r.status,403);assert.equal(r.body.code,'zero_cross_module_capability_unavailable');
 }finally{await f.close();}
});
