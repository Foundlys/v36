'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {fixture,reserve,advance}=require('../zero-evaluation/demo-universe-fixture');
const {SCOPE,ADVANCE_WORK_BUDGET_MS}=require('../demo-universe-engine');
function pace(f){let time=0;f.engine.clock=()=>{const before=time;time+=600;return before;};}
test('native seeding yields a durably acknowledged prefix and continues from its actual cursor',()=>{
 const f=fixture();let row=reserve(f);pace(f);row=advance(f,row,100);
 assert.equal(row.applied_nodes,2);assert.equal(row.batch.applied_nodes,2);assert.equal(row.batch.yield_reason,'WORK_BUDGET');assert.equal(row.batch.work_budget_ms,ADVANCE_WORK_BUDGET_MS);
 const first=f.adapter.bucket(f.ctx,'crm:companies').map(r=>r.id);Object.assign(f,f.restart());pace(f);
 row=f.engine.get(f.ctx,f.actor,row.id);assert.equal(row.applied_nodes,2);row=advance(f,row,100);assert.equal(row.applied_nodes,4);
 while(row.status!=='SEEDED')row=advance(f,row,100);
 assert.deepEqual(f.adapter.bucket(f.ctx,'crm:companies').map(r=>r.id),first);assert.equal(row.batch.yield_reason,'COMPLETE');assert.equal(row.full_acceptance,false);
});
test('time-budget checkpoint failure cannot acknowledge uncertain native effects and exact replay survives restart',()=>{
 const f=fixture();let row=reserve(f);pace(f);f.failReceiptAt(2);
 assert.throws(()=>advance(f,row,100),/seed receipt persistence failure/);assert.equal(f.adapter.bucket(f.ctx,SCOPE)[0].cursor,0);
 const first=f.adapter.bucket(f.ctx,'crm:companies').map(r=>r.id);assert.equal(first.length,2);
 f.allowPersistence();Object.assign(f,f.restart());pace(f);row=f.engine.get(f.ctx,f.actor,row.id);row=advance(f,row,100);
 assert.equal(row.applied_nodes,2);assert.deepEqual(f.adapter.bucket(f.ctx,'crm:companies').map(r=>r.id),first);
});
