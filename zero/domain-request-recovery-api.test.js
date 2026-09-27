'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{fixture}=require('../zero-evaluation/fixture');
test('native generic domain update retries recover the committed revision across encrypted restart and superseded receipts never report a newer record as their own result',async()=>{
 const f=await fixture();try{
  assert.equal((await f.request('/api/composition','PUT',{entitlements:['sales','marketing'],expected_revision:0})).status,200);
  for(const [module,entity]of [['sales','opportunities'],['marketing','campaigns']]){
   const path='/api/'+module+'/'+entity,input={title:'Literal '+module+' request recovery',status:'DRAFT'},key='domain-create-'+module,headers={'idempotency-key':key};
   const first=await f.request(path,'POST',input,null,headers);assert.equal(first.status,201);const route=path+'/'+first.body.record.id,updatedInput={title:'Literal updated '+module,expected_revision:1},updateHeaders={'idempotency-key':'domain-update-'+module};
   const updated=await f.request(route,'PUT',updatedInput,null,updateHeaders);assert.equal(updated.status,200);assert.equal(updated.body.record.revision,2);const replay=await f.request(route,'PUT',updatedInput,null,updateHeaders);assert.equal(replay.status,200);assert.equal(replay.body.deduplicated,true);assert.deepEqual(replay.body.record,updated.body.record);
   const staleCreate=await f.request(path,'POST',input,null,headers);assert.equal(staleCreate.status,409);assert.equal(staleCreate.body.code,'record_request_superseded');
   assert.equal((await f.request(route,'PUT',{...updatedInput,expected_revision:2},null,updateHeaders)).status,409);
   await f.stop();await f.start();assert.deepEqual((await f.request(route,'PUT',updatedInput,null,updateHeaders)).body.record,updated.body.record);
   const newer=await f.request(route,'PUT',{title:'Newer authorised edit',expected_revision:2},null,{'idempotency-key':'domain-newer-'+module});assert.equal(newer.status,200);const superseded=await f.request(route,'PUT',updatedInput,null,updateHeaders);assert.equal(superseded.status,409);assert.equal(superseded.body.code,'record_request_superseded');assert.equal((await f.request(route)).body.record.title,'Newer authorised edit');
  }
 }finally{await f.close();}
});
test('native create replay does not claim success for a superseding edit',async()=>{
 const f=await fixture();try{assert.equal((await f.request('/api/composition','PUT',{entitlements:['sales'],expected_revision:0})).status,200);const path='/api/sales/opportunities',input={title:'Literal isolated creation'},headers={'idempotency-key':'domain-superseded-create'},first=await f.request(path,'POST',input,null,headers);assert.equal(first.status,201);assert.equal((await f.request(path+'/'+first.body.record.id,'PUT',{title:'A later separate change',expected_revision:1})).status,200);const replay=await f.request(path,'POST',input,null,headers);assert.equal(replay.status,409);assert.equal(replay.body.code,'record_request_superseded');}finally{await f.close();}
});
test('a real lost domain update response recovers its receipt after encrypted restart without another record or revision',async()=>{
 const f=await fixture({NODE_OPTIONS:'--require '+require.resolve('../zero-evaluation/domain-ack-drop')});try{assert.equal((await f.request('/api/composition','PUT',{entitlements:['sales'],expected_revision:0})).status,200);const first=await f.request('/api/sales/opportunities','POST',{title:'Original HTTP record'}),route='/api/sales/opportunities/'+first.body.record.id,input={title:'Durable HTTP update',expected_revision:1},headers={'idempotency-key':'domain-lost-update-request'};
  await assert.rejects(f.request(route,'PUT',input,null,{...headers,'x-zero-domain-drop-reply':'isolated-http-fixture'}));assert.equal((await f.request(route)).body.record.revision,2);await f.stop();await f.start();const result=await f.request(route,'PUT',input,null,headers);assert.equal(result.status,200);assert.equal(result.body.deduplicated,true);assert.equal(result.body.request_id,headers['idempotency-key']);assert.equal(result.body.record.revision,2);assert.equal(result.body.record.title,'Durable HTTP update');assert.equal((await f.request('/api/sales/opportunities')).body.total,1);
 }finally{await f.close();}
});
