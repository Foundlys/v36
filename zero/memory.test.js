'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {ZeroMemory}=require('./memory');
const {assembleContext}=require('./context');
const ctx={tenant_id:'alpha',dealer_id:'dealer'},other={tenant_id:'beta',dealer_id:'dealer'};
const alice={id:'alice',roles:['MANAGER']},bob={id:'bob',roles:['MANAGER']},admin={id:'admin',roles:['ADMIN']};
function setup(){
  const store=new Map();let instant=Date.parse('2026-09-24T10:00:00Z'),broken=false,allowed=true;
  const adapter={bucket(c,key){const k=c.tenant_id+':'+c.dealer_id+':'+key;if(!store.has(k))store.set(k,[]);return store.get(k);},persist(){if(broken)throw Error('disk full');},now:()=>new Date(instant),authorizeCapabilities:()=>allowed};
  return{memory:new ZeroMemory(adapter),store,breakStorage:()=>broken=true,revoke:()=>allowed=false,advance:ms=>instant+=ms};
}
test('all eight layers use explicit identity, provenance, limits and required references',()=>{
  const {memory}=setup();
  for(const layer of require('./contracts').LAYERS){
    const row=memory.create(ctx,alice,{layer,key:'fact_'+layer,text:'An explicit assertion',session_id:'session1',task_id:'task1',workflow_id:'workflow1'});
    assert.equal(row.layer,layer);assert.equal(row.provenance.verified,false);assert.equal(row.tenant_id,'alpha');
    assert.ok(row.expires_at);assert.equal(row.revision,1);
  }
  assert.equal(memory.search(ctx,alice,{session_id:'session1',task_id:'task1',workflow_id:'workflow1'}).items.length,8);
  assert.throws(()=>memory.create(ctx,alice,{layer:'SESSION',key:'test',text:'missing reference'}),{code:'zero_memory_reference_required'});
  assert.throws(()=>memory.create(ctx,alice,{layer:'USER',key:'test',text:'test',tenant_id:'beta'}),{code:'zero_unknown_field'});
  assert.throws(()=>memory.create(ctx,alice,{layer:'USER',key:'test',text:'test',provenance:{verified:true}}),{code:'zero_unknown_field'});
});
test('private memory is invisible to other users including administrators and tenants',()=>{
  const {memory}=setup();memory.create(ctx,alice,{layer:'USER',key:'private',text:'Alice private fact'});
  for(const actor of [bob,admin])assert.equal(memory.search(ctx,actor).total,0);
  assert.equal(memory.search(other,alice).total,0);
  assert.equal(memory.search(ctx,alice).total,1);
});
test('current roles, capabilities and session boundaries precede matching and counts',()=>{
  const s=setup(),{memory}=s;
  memory.create(ctx,alice,{layer:'ORGANIZATION',key:'risk',text:'Restricted policy',roles:['MANAGER'],capabilities:['crm:leads']});
  assert.equal(memory.search(ctx,bob).total,1);
  bob.roles=['VIEWER'];assert.equal(memory.search(ctx,bob).total,0);bob.roles=['MANAGER'];
  s.revoke();assert.equal(memory.search(ctx,alice).total,0);
  assert.throws(()=>memory.create(ctx,{id:'viewer',roles:['VIEWER']},{layer:'ORGANIZATION',key:'x',text:'Forbidden'}),{code:'zero_permission_denied'});
  memory.create(ctx,alice,{layer:'SESSION',key:'local',text:'Session-specific',session_id:'one'});
  assert.equal(memory.search(ctx,alice,{session_id:'two'}).total,0);
});
test('future, expired, superseded and deleted assertions cannot become current facts',()=>{
  const s=setup(),{memory}=s;
  const one=memory.create(ctx,alice,{layer:'USER',key:'target',text:'old target'});
  const two=memory.create(ctx,alice,{layer:'USER',key:'target',text:'new target',supersedes:one.id,expected_revision:1});
  assert.equal(two.revision,2);assert.equal(memory.search(ctx,alice).items[0].text,'new target');
  assert.throws(()=>memory.create(ctx,alice,{layer:'USER',key:'target',text:'racing update',supersedes:one.id,expected_revision:1}),{code:'zero_memory_revision_conflict'});
  memory.remove(ctx,alice,two.id,{expected_revision:2});
  assert.equal(memory.search(ctx,alice).total,0);
  assert.ok(!JSON.stringify([...s.store]).includes('old target'));assert.ok(!JSON.stringify([...s.store]).includes('new target'));
  memory.create(ctx,alice,{layer:'USER',key:'expiry',text:'soon stale',expires_at:'2026-09-24T10:01:00Z'});
  memory.create(ctx,alice,{layer:'USER',key:'future',text:'not yet effective',effective_from:'2026-09-25T10:00:00Z'});
  s.advance(61000);assert.equal(memory.search(ctx,alice).total,0);
  assert.equal(memory.search(ctx,alice,{include_stale:true}).items[0].freshness,'STALE');
});
test('conflicts remain explicit and do not leak hidden competing assertions',()=>{
  const {memory}=setup();memory.create(ctx,alice,{layer:'ORGANIZATION',key:'margin',text:'Target 15 percent'});
  memory.create(ctx,bob,{layer:'ORGANIZATION',key:'margin',text:'Target 18 percent'});
  memory.create(ctx,bob,{layer:'USER',key:'margin',text:'Secret private target'});
  const result=memory.search(ctx,alice);assert.equal(result.conflicts.length,1);assert.equal(result.conflicts[0].memory_ids.length,2);
  assert.equal(result.conflicts[0].automatic_resolution,false);
});
test('failed persistence atomically rolls back creation and supersession',()=>{
  const s=setup(),{memory}=s;const one=memory.create(ctx,alice,{layer:'USER',key:'state',text:'keep'});
  s.breakStorage();assert.throws(()=>memory.create(ctx,alice,{layer:'USER',key:'state',text:'lose',supersedes:one.id,expected_revision:1}),/disk full/);
  assert.equal(memory.search(ctx,alice).items[0].text,'keep');assert.equal(memory.search(ctx,alice).items[0].status,'ACTIVE');
  assert.throws(()=>memory.remove(ctx,alice,one.id,{expected_revision:1}),/disk full/);
  assert.equal(memory.search(ctx,alice).total,1);
});
test('context is relevant, bounded and source-labelled; unavailable is distinct from empty',()=>{
  const {memory}=setup();
  memory.create(ctx,alice,{layer:'USER',key:'margin',text:'margin '.repeat(1000)});
  memory.create(ctx,alice,{layer:'USER',key:'weather',text:'Rain in London'});
  const source={id:'crm',source_class:'CUSTOMER_TRUTH',authorize:()=>true,visible:()=>true,project:r=>r,read:()=>({state:'UNAVAILABLE',items:[]})};
  const result=assembleContext({ctx,actor:alice,query:'margin',memory,sources:[source],limits:{max_bytes:1024}});
  assert.equal(result.items.length,0);assert.equal(result.source_states[0].state,'UNAVAILABLE');
  assert.ok(result.limits.used_bytes<=1024);assert.equal(result.withheld[0].reason,'CONTEXT_BUDGET');
  const larger=assembleContext({ctx,actor:alice,query:'margin',memory,limits:{max_bytes:16000}});
  assert.equal(larger.items.length,1);assert.equal(larger.items[0].untrusted_data,true);
  assert.equal(larger.items[0].provenance.source_class,'USER_ASSERTED');
});
test('source permission loss during retrieval excludes the data',()=>{
  const {memory}=setup();let allowed=true;
  const source={id:'crm',authorize:()=>allowed,read:()=>{allowed=false;return{items:[{id:'secret',text:'margin'}]};},visible:()=>true,project:r=>r};
  const result=assembleContext({ctx,actor:alice,query:'margin',memory,sources:[source]});
  assert.equal(result.items.length,0);assert.equal(result.source_states[0].state,'PERMISSION_DENIED');
});
