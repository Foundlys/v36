'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{fixture}=require('../zero-evaluation/fixture');

test('native CRM HTTP stage retries and observed automation receipts survive encrypted restart and current permission revocation',async()=>{
 const f=await fixture();try{
  assert.equal((await f.request('/api/composition','PUT',{entitlements:['crm'],expected_revision:0})).status,200);
  const account=await f.enroll('crm-stage-operator');let cookie=account.cookie;
  async function create(entity,input){const result=await f.request('/api/crm/'+entity,'POST',input,cookie);assert.equal(result.status,201,JSON.stringify(result.body));return result.body.record;}
  const pipeline=await create('pipelines',{name:'Literal HTTP pipeline'}),first=await create('stages',{name:'Literal first stage',pipeline_id:pipeline.id}),next=await create('stages',{name:'Literal next stage',pipeline_id:pipeline.id}),deal=await create('deals',{title:'Literal private HTTP deal',pipeline_id:pipeline.id,stage_id:first.id});
  await create('automations',{name:'Literal HTTP automation',enabled:true,trigger:{type:'stage_change'},actions:[{type:'task',title:'Literal HTTP follow-up'}]});
  const route='/api/crm/deals/'+deal.id+'/stage',payload={stage_id:next.id},headers={'idempotency-key':'crm-http-stage-original','if-match':'"'+deal.revision+'"'};
  let result=await f.request(route,'PATCH',payload,cookie,headers);assert.equal(result.status,200,JSON.stringify(result.body));assert.equal(result.body.deal.automation_status,'RECORDED');assert.equal(result.body.deal.stage_history.length,1);const revision=result.body.deal.revision;
  const empty={id:'crm-http-empty-event',type:'no_contact',entity:'deals',record_id:deal.id};result=await f.request('/api/crm/automation-events','POST',empty,cookie);assert.equal(result.status,202);assert.equal(result.body.executions.length,0);
  await create('automations',{name:'Literal later definition',enabled:true,trigger:{type:'no_contact'},actions:[{type:'task',title:'Must not execute on replay'}]});
  const audit=(await f.request('/api/crm/audit_events?limit=200',undefined,undefined,cookie)).body;
  for(const restart of [false,true]){
   if(restart){await f.stop();await f.start();}
   result=await f.request(route,'PATCH',payload,cookie,headers);assert.equal(result.status,200,JSON.stringify(result.body));assert.equal(result.body.deal.idempotent_replay,true);assert.equal(result.body.deal.revision,revision);assert.equal(result.body.deal.stage_history.length,1);
   result=await f.request('/api/crm/automation-events','POST',empty,cookie);assert.equal(result.status,202);assert.equal(result.body.replayed,true);assert.equal(result.body.executions.length,0);
   result=await f.request('/api/crm/automation-events','POST',{...empty,record_id:'different-source'},cookie);assert.equal(result.status,409);assert.equal(result.body.code,'crm_event_replay_conflict');
   assert.equal((await f.request('/api/crm/tasks',undefined,undefined,cookie)).body.total,1);assert.deepEqual((await f.request('/api/crm/audit_events?limit=200',undefined,undefined,cookie)).body,audit);
  }
  result=await f.request('/api/identity/users/'+account.member.id,'PUT',{roles:['SALES'],expected_revision:account.member.revision,confirm:true,reason:'Isolated CRM stage permission acceptance'});assert.equal(result.status,200);cookie=await f.login(account);
  for(const request of [[payload,headers],[{stage_id:first.id},{'idempotency-key':'crm-http-stage-denied','if-match':'"'+revision+'"'}]]){result=await f.request(route,'PATCH',request[0],cookie,request[1]);assert.equal(result.status,403);assert.ok(!JSON.stringify(result.body).includes(deal.title));}
  result=await f.request('/api/crm/deals/'+deal.id);assert.equal(result.body.record.stage_id,next.id);assert.equal(result.body.record.revision,revision);assert.deepEqual((await f.request('/api/crm/audit_events?limit=200')).body,audit);
 }finally{await f.close();}
});
