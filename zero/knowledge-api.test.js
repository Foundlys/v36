'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {fixture}=require('../zero-evaluation/fixture');
test('real ZERO uses only explicitly activated own references and rechecks retirement on replay',async()=>{
 const f=await fixture({OPENAI_API_KEY:'contract-fixture-only',NODE_OPTIONS:'--require='+path.resolve(__dirname,'../zero-evaluation/context-provider-fixture.js')});
 try{
  await f.request('/api/composition','PUT',{entitlements:['communication'],expected_revision:0});const alice=await f.enroll('knowledge.alice'),bob=await f.enroll('knowledge.bob'),reader=await f.enroll('knowledge.reader',['VIEWER']);
  const a=(route,method,body)=>f.request(route,method,body,alice.cookie);
  const input={topic:'strategy',category:'DOCUMENTATION',text:'Strategy preference ZERO_PRIVATE_ALPHA',sources:[{url:'https://example.com/reference',title:'Explicitly supplied isolated test reference',source_type:'CUSTOMER_PROVIDED',retrieved_at:new Date(Date.now()-1000).toISOString()}],expires_at:new Date(Date.now()+86400000).toISOString()};
  assert.equal((await f.request('/api/zero/knowledge','POST',input,reader.cookie)).status,403);
  let r=await a('/api/zero/knowledge','POST',input);assert.equal(r.status,201,JSON.stringify(r.body));let row=r.body.record;
  const command={message:'Explain my strategy preference',conversation_id:'reference-context-one',turn_id:'reference-context-turn'};
  r=await a('/api/zero/turn','POST',command);assert.ok(!JSON.stringify(r.body).includes('ZERO_PRIVATE_ALPHA'));
  for(const operation of ['EVALUATE','VERIFY','ACTIVATE']){r=await a('/api/zero/knowledge/'+row.id+'/transition','POST',{operation,expected_revision:row.revision,content_hash:row.content_hash,confirm:true,reason:'Inspect exact isolated source'});assert.equal(r.status,200,JSON.stringify(r.body));row=r.body.record;}
  assert.equal((await f.request('/api/zero/knowledge','GET',undefined,bob.cookie)).body.total,0);
  const active={...command,turn_id:'reference-context-active'};r=await a('/api/zero/turn','POST',active);assert.ok(r.body.answer.includes('ZERO_PRIVATE_ALPHA'),JSON.stringify(r.body));
  assert.ok(!JSON.stringify((await a('/api/zero/conversation/'+command.conversation_id)).body).includes('ZERO_PRIVATE_ALPHA'));
  r=await a('/api/zero/knowledge/'+row.id+'/transition','POST',{operation:'RETIRE',expected_revision:row.revision,content_hash:row.content_hash,confirm:true,reason:'Retire obsolete reference'});assert.equal(r.status,200);
  r=await a('/api/zero/turn','POST',active);assert.ok(!JSON.stringify(r.body).includes('ZERO_PRIVATE_ALPHA'));
  await f.stop();await f.start();assert.equal((await a('/api/zero/knowledge?active=true')).body.total,0);
 }finally{await f.close();}
});
