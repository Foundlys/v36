'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{fixture}=require('../zero-evaluation/fixture');
test('native CRM HTTP profile receipt survives encrypted restart and denies a newly revoked principal',async()=>{
 const f=await fixture();try{
  assert.equal((await f.request('/api/composition','PUT',{entitlements:['crm'],expected_revision:0})).status,200);const account=await f.enroll('crm-profile-manager',['MANAGER']),body={business_name:'Literal private HTTP business',country:'NL',industry:'automotive',segment:'dealer',defaults_locale:'de-DE'},headers={'idempotency-key':'crm-profile-http-atomic'};let cookie=account.cookie;
  const first=await f.request('/api/crm/provision','POST',body,cookie,headers);assert.equal(first.status,201);assert.equal(first.body.configuration_status,'RECORDED_ATOMIC');assert.equal(first.body.stages.length,6);
  await f.stop();await f.start();const replay=await f.request('/api/crm/provision','POST',body,cookie,headers);assert.equal(replay.status,201);assert.equal(replay.body.configuration_status,'RECORDED_ATOMIC');assert.equal(replay.body.pipeline.id,first.body.pipeline.id);assert.equal(replay.body.idempotent_replay,true);assert.equal((await f.request('/api/crm/stages?limit=200','GET',undefined,cookie)).body.total,6);
  assert.equal((await f.request('/api/identity/users/'+account.member.id,'PUT',{roles:['VIEWER'],expected_revision:account.member.revision,confirm:true,reason:'Native profile current-access acceptance'})).status,200);cookie=await f.login(account);
  for(const restart of [false,true]){if(restart){await f.stop();await f.start();}const denied=await f.request('/api/crm/provision','POST',body,cookie,headers);assert.equal(denied.status,403);assert.ok(!JSON.stringify(denied.body).includes('Literal private'));}
 }finally{await f.close();}
});
