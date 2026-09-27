'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{fixture}=require('../zero-evaluation/fixture');
test('native CRM commits one canonical event per mutation through HTTP replay and encrypted restart',async()=>{
 const f=await fixture();try{
  const input={title:'Literal HTTP deal',value:12.34,currency:'USD'},headers={'idempotency-key':'crm-canonical-http-create'};
  const created=await f.request('/api/crm/deals','POST',input,null,headers);assert.equal(created.status,201,JSON.stringify(created.body));const id=created.body.record.id;
  const events=async()=>{const result=await f.request('/api/platform/events?limit=100&entity_id='+id);assert.equal(result.status,200);return result.body.items;};
  let rows=await events();assert.equal(rows.length,1);const eventId=rows[0].event_id;assert.equal(rows[0].source,'foundly_crm');assert.equal(rows[0].properties.value_cents,1234);assert.equal(rows[0].properties.currency,'USD');assert.equal(rows[0].properties.weighted_value_cents,null);
  for(const restart of [false,true]){if(restart){await f.stop();await f.start();}const replay=await f.request('/api/crm/deals','POST',input,null,headers);assert.equal(replay.status,201);assert.equal(replay.body.record.idempotent_replay,true);rows=await events();assert.equal(rows.length,1);assert.equal(rows[0].event_id,eventId);}
  const changed=await f.request('/api/crm/deals/'+id,'PATCH',{value:20,currency:'GBP'},null,{'if-match':'"1"','idempotency-key':'crm-canonical-http-update'});assert.equal(changed.status,200);rows=await events();assert.equal(rows.length,2);assert.equal(rows.find(row=>row.event_id===eventId).properties.value_cents,1234);assert.equal(rows.find(row=>row.properties.revision===2).properties.currency,'GBP');
  const retry=await f.request('/api/crm/event-delivery/retry','POST');assert.equal(retry.status,200);assert.equal(retry.body.pending,0);assert.equal(retry.body.attempted,0);assert.ok(!JSON.stringify(retry.body).includes(id));
  assert.equal((await f.request('/api/composition','PUT',{entitlements:['crm'],expected_revision:0})).status,200);const viewer=await f.enroll('crm-event-viewer',['VIEWER']);const denied=await f.request('/api/crm/event-delivery/retry','POST',undefined,viewer.cookie);assert.equal(denied.status,403);assert.ok(!JSON.stringify(denied.body).includes(id));
  assert.equal((await f.request('/api/composition','PUT',{entitlements:['crm'],capability_flags:{'crm:relationships':false},expected_revision:1})).status,200);assert.equal((await f.request('/api/crm/event-delivery/retry','POST')).status,403);
 }finally{await f.close();}
});
