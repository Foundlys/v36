'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{fixture}=require('../zero-evaluation/fixture'),state=require('../demo-universe-client-state');
test('owned demo discovery recovers a lost durable reservation after encrypted restart without exposing it to another manager',async()=>{
 const tenant='demo-controls-'+crypto.randomUUID(),f=await fixture({FOUNDLY_TENANT_ID:tenant,FOUNDLY_DEMO_TENANT_ID:tenant,FOUNDLY_DEMO_UNIVERSE_ENABLED:'true',NODE_OPTIONS:'--require='+require.resolve('../zero-evaluation/demo-universe-ack-drop')});
 try{
  await f.request('/api/composition','PUT',{industry_id:'ECOMMERCE',entitlements:['crm','sales','procurement','marketing','calendar','communication'],expected_revision:0});const owner=await f.enroll('demo.controls.owner',['SUPER_ADMIN']),other=await f.enroll('demo.controls.other',['SUPER_ADMIN']),viewer=await f.enroll('demo.controls.viewer',['VIEWER']);
  const session=await f.request('/api/demo-universe/session','GET',undefined,owner.cookie);assert.equal(session.status,200);state.session(session.body);assert.equal(session.body.can_start,true);
  const p=await f.request('/api/demo-universe/preview','POST',session.body.defaults,owner.cookie);state.preview(p.body,session.body,session.body.defaults);
  await assert.rejects(f.request('/api/demo-universe/runs','POST',{...session.body.defaults,plan_fingerprint:p.body.plan_fingerprint,expected_profile_revision:p.body.profile_revision,confirm:true,reason:'Keep this owned reservation'},owner.cookie,{'idempotency-key':'demo-lost-reservation','x-demo-drop-reply':'isolated-demo-fixture'}));
  await f.stop();await f.start();owner.cookie=await f.login(owner);other.cookie=await f.login(other);viewer.cookie=await f.login(viewer);
  const saved=await f.request('/api/demo-universe/session','GET',undefined,owner.cookie);state.session(saved.body,session.body.request_context);assert.equal(saved.body.can_start,false);assert.equal(saved.body.universe.request_id,'demo-lost-reservation');assert.equal(saved.body.universe.plan_fingerprint,p.body.plan_fingerprint);assert.equal(saved.body.universe.applied_nodes,0);
  const hidden=await f.request('/api/demo-universe/session','GET',undefined,other.cookie);assert.equal(hidden.status,200);assert.equal(hidden.body.universe,null);assert.equal(hidden.body.can_start,false);assert.equal(hidden.body.blocked_reason,'RESERVATION_UNAVAILABLE');assert.ok(!JSON.stringify(hidden.body).includes(saved.body.universe.id));assert.ok(!JSON.stringify(hidden.body).includes('demo-lost-reservation'));
  const noRights=await f.request('/api/demo-universe/session','GET',undefined,viewer.cookie);assert.equal(noRights.status,200);assert.equal(noRights.body.available,false);assert.equal(noRights.body.universe,undefined);
  assert.equal((await f.request('/api/demo-universe/runs/'+saved.body.universe.id,'GET',undefined,other.cookie)).status,404);
 }finally{await f.close();}
});
test('ordinary runtimes disclose no demo state and existing business data blocks a new isolated demo',async()=>{
 const f=await fixture();try{const data=await f.request('/api/demo-universe/session');assert.equal(data.status,200);assert.equal(data.body.available,false);assert.equal(data.body.universe,undefined);}finally{await f.close();}
 const {fixture:local}=require('../zero-evaluation/demo-universe-fixture'),g=local();assert.equal(g.engine.session(g.ctx,g.actor).can_start,true);g.crm.create(g.ctx,g.actor,'companies',{name:'Existing customer record'});const status=g.engine.session(g.ctx,g.actor);assert.equal(status.can_start,false);assert.equal(status.blocked_reason,'EXISTING_DATA');
});
