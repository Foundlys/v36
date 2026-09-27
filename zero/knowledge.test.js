'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {KnowledgeRefresh}=require('./knowledge');
const ctx={tenant_id:'one',dealer_id:'d'},actor={id:'alice',roles:['MANAGER']};
function setup(){const buckets=new Map();let now=Date.parse('2026-09-24T12:00:00Z'),fail=false;const engine=new KnowledgeRefresh({now:()=>new Date(now),adapter:{bucket(c,k){const key=c.tenant_id+':'+c.dealer_id+':'+k;if(!buckets.has(key))buckets.set(key,[]);return buckets.get(key);},persist(){if(fail)throw Error('disk full');}}});return {engine,advance:n=>now+=n,fail:()=>fail=true};}
const input=(extra={})=>({topic:'Strategy reference',category:'DOCUMENTATION',text:'Reference statement, not Customer Truth',sources:[{url:'https://example.com/reference',title:'Original reference',source_type:'PRIMARY',retrieved_at:'2026-09-24T11:00:00Z'}],expires_at:'2026-10-01T12:00:00Z',...extra});
function move(e,r,operation,extra={}){return e.transition(ctx,actor,r.id,{operation,expected_revision:r.revision,content_hash:r.content_hash,reason:'Reviewed the exact source and applicability',confirm:true,...extra});}
const activate=(e,r)=>move(e,move(e,move(e,r,'EVALUATE'),'VERIFY'),'ACTIVATE');
test('internet content stays quarantined until evaluation, exact source review and explicit activation',()=>{
 const {engine:e}=setup();let row=e.stage(ctx,actor,input());assert.equal(e.list(ctx,actor,{active:true}).items.length,0);
 assert.throws(()=>move(e,row,'ACTIVATE'),{code:'zero_knowledge_transition_invalid'});
 row=move(e,row,'EVALUATE');assert.equal(row.assessment.factual_accuracy_verified,false);
 assert.throws(()=>move(e,row,'VERIFY',{confirm:false}),{code:'zero_knowledge_confirmation_required'});
 assert.throws(()=>move(e,row,'VERIFY',{content_hash:'changed'}),{code:'zero_knowledge_revision_conflict'});
 row=move(e,move(e,row,'VERIFY'),'ACTIVATE');assert.equal(row.verification_state,'OPERATOR_ATTESTED');assert.equal(e.list(ctx,actor,{active:true}).items.length,1);assert.equal(row.customer_truth,false);assert.equal(row.executable,false);
});
test('regulatory reference requires jurisdiction, authority, primary source and effective date',()=>{
 const {engine:e}=setup();const row=move(e,e.stage(ctx,actor,input({category:'REGULATION'})),'EVALUATE');assert.equal(row.state,'QUARANTINED');assert.ok(row.assessment.gaps.includes('JURISDICTION_MISSING'));
 assert.throws(()=>move(e,row,'VERIFY'),{code:'zero_knowledge_transition_invalid'});
});
test('reviewed version rollback is auditable, exact and scoped; expiry excludes inference',()=>{
 const s=setup(),e=s.engine,first=activate(e,e.stage(ctx,actor,input())),second=activate(e,e.stage(ctx,actor,input({supersedes:first.id,text:'Corrected reference'})));
 assert.equal(e.list(ctx,actor,{active:true}).items[0].id,second.id);move(e,second,'ROLLBACK');assert.equal(e.list(ctx,actor,{active:true}).items[0].id,first.id);
 for(const [c,a]of [[ctx,{id:'admin',roles:['ADMIN']}],[{...ctx,tenant_id:'other'},actor]])assert.equal(e.list(c,a,{active:true}).items.length,0);
 s.advance(8*86400000);assert.equal(e.list(ctx,actor,{active:true}).items.length,0);assert.ok(e.due(ctx,actor).some(x=>x.reason==='EXPIRED'));
});
test('read-only users cannot stage or activate and a persist failure restores the previous version',()=>{
 const s=setup(),e=s.engine,r=e.stage(ctx,actor,input());assert.throws(()=>e.stage(ctx,{id:'reader',roles:['VIEWER']},input()),{code:'zero_permission_denied'});
 s.fail();assert.throws(()=>move(e,r,'EVALUATE'),/disk full/);assert.equal(e.owned(ctx,actor,r.id).state,'QUARANTINED');assert.equal(e.owned(ctx,actor,r.id).revision,1);
});
