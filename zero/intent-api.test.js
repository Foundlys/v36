'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {fixture}=require('../zero-evaluation/fixture');
test('real ZERO discussions leave native task state unchanged; an explicit native request creates one task',async()=>{
 const f=await fixture();try{
  assert.equal((await f.request('/api/composition','PUT',{entitlements:['automation'],expected_revision:0})).status,200);
  const alice=await f.enroll('intent.alice'),request=(route,method,body)=>f.request(route,method,body,alice.cookie);
  const turn=message=>request('/api/zero/turn','POST',{message,conversation_id:crypto.randomUUID(),turn_id:crypto.randomUUID(),preferred_module:'automation'});
  for(const message of ['Hoe maak ik een taak om Alice terug te bellen?','Leg uit waarom ik een factuur moet betalen','Maak nog niet een taak om Alice terug te bellen']){
   const r=await turn(message);assert.equal(r.status,200,JSON.stringify(r.body));assert.notEqual(r.body.status,'confirmation_required');assert.ok(!r.body.actions?.some(a=>a.status==='executed'),message);
  }
  assert.equal((await request('/api/automation/tasks')).body.total,0);
  const created=await turn('Maak een taak om Alice terug te bellen');assert.equal(created.status,200,JSON.stringify(created.body));
  assert.equal((await request('/api/automation/tasks')).body.total,1);assert.ok(created.body.actions.some(a=>a.tool_id==='create_task'&&a.verified));
 }finally{await f.close();}
});
