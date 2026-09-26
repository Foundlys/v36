'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {fixture}=require('../zero-evaluation/fixture');
test('actual ZERO retrieval uses private memory, purges replay content and honors deletion',async()=>{
  const f=await fixture({OPENAI_API_KEY:'contract-fixture-only',NODE_OPTIONS:'--require='+path.resolve(__dirname,'../zero-evaluation/context-provider-fixture.js')});
  try{
    await f.request('/api/composition','PUT',{entitlements:['communication'],expected_revision:0});
    const alice=await f.enroll('memory.alice'),bob=await f.enroll('memory.bob');
    const a=(route,method,body)=>f.request(route,method,body,alice.cookie);
    const created=await a('/api/zero/memories','POST',{layer:'USER',key:'strategy',text:'Strategy preference ZERO_PRIVATE_ALPHA'});
    assert.equal(created.status,201);
    const command={message:'Explain my strategy preference',conversation_id:'context-memory-one',turn_id:'context-memory-turn-one'};
    const answer=await a('/api/zero/turn','POST',command);assert.equal(answer.status,200,JSON.stringify(answer.body));assert.ok(answer.body.answer.includes('ZERO_PRIVATE_ALPHA'));
    assert.equal(answer.body.verification.memory_references.length,1);
    const other=await f.request('/api/zero/turn','POST',{...command,conversation_id:'context-memory-bob',turn_id:'context-memory-bob-turn'},bob.cookie);
    assert.ok(!JSON.stringify(other.body).includes('ZERO_PRIVATE_ALPHA'));
    let history=await a('/api/zero/conversation/'+command.conversation_id);assert.ok(!JSON.stringify(history.body).includes('ZERO_PRIVATE_ALPHA'));
    assert.equal((await a('/api/zero/memories/'+created.body.memory.id,'DELETE',{expected_revision:1})).status,200);
    const replay=await a('/api/zero/turn','POST',command);assert.equal(replay.status,200);assert.ok(!JSON.stringify(replay.body).includes('ZERO_PRIVATE_ALPHA'));
    await f.stop();await f.start();history=await a('/api/zero/conversation/'+command.conversation_id);assert.ok(!JSON.stringify(history.body).includes('ZERO_PRIVATE_ALPHA'));
  }finally{await f.close();}
});
test('role revocation during model inference prevents release of the model answer',async()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'zero-revocation-')),barrier=path.join(temp,'provider');
  const f=await fixture({OPENAI_API_KEY:'contract-fixture-only',NODE_OPTIONS:'--require='+path.resolve(__dirname,'../zero-evaluation/context-provider-fixture.js'),ZERO_EVALUATION_PROVIDER_BARRIER:barrier});
  try{
    await f.request('/api/composition','PUT',{entitlements:['communication'],expected_revision:0});const alice=await f.enroll('revocation.alice');
    await f.request('/api/zero/memories','POST',{layer:'USER',key:'strategy',text:'Strategy preference ZERO_PRIVATE_ALPHA'},alice.cookie);
    const pending=f.request('/api/zero/turn','POST',{message:'Explain my strategy preference PAUSE_FOR_REVOCATION',conversation_id:'revoke-memory-one',turn_id:'revoke-memory-turn'},alice.cookie);
    for(let n=0;n<200&&!fs.existsSync(barrier+'.started');n++)await new Promise(r=>setTimeout(r,10));assert.ok(fs.existsSync(barrier+'.started'));
    assert.equal((await f.request('/api/identity/users/'+alice.member.id,'PUT',{roles:['VIEWER'],expected_revision:alice.member.revision,confirm:true,reason:'Revoke during inference'})).status,200);
    fs.writeFileSync(barrier+'.release','release');const result=await pending;assert.equal(result.status,401);assert.ok(!JSON.stringify(result.body).includes('ZERO_PRIVATE_ALPHA'));
  }finally{await f.close();fs.rmSync(temp,{recursive:true,force:true});}
});
