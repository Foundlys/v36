'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {fixture}=require('../zero-evaluation/crm-save-fixture');
const contact=f=>f.core.create(f.ctx,f.actor,'contacts',{name:'Literal private contact'});
test('native CRM cached update cannot bypass current write permission or target ownership',()=>{
 for(const revoke of ['role','owner']){const f=fixture(),row=contact(f),input={phone:'Literal private phone'},options={expectedRevision:row.revision,idempotencyKey:'record-update-current-access'};f.core.update(f.ctx,f.actor,'contacts',row.id,input,options);if(revoke==='role')f.actor.roles=['VIEWER'];else f.core.update(f.ctx,{id:'admin_actor',roles:['ADMIN']},'contacts',row.id,{owner_id:f.other.id});const before=f.snapshot(),writes=f.count();assert.throws(()=>f.core.update(f.ctx,f.actor,'contacts',row.id,input,options),e=>e.statusCode===403);assert.equal(f.snapshot(),before);assert.equal(f.count(),writes);}
});
test('native CRM cached creation cannot disclose a record whose ownership changed or which was archived',()=>{
 for(const change of ['owner','archive']){const f=fixture(),input={name:'Literal private original'},options={idempotencyKey:'record-create-current-access'},row=f.core.create(f.ctx,f.actor,'contacts',input,options);if(change==='owner')f.core.update(f.ctx,{id:'admin_actor',roles:['ADMIN']},'contacts',row.id,{owner_id:f.other.id});else f.core.remove(f.ctx,f.actor,'contacts',row.id);const before=f.snapshot();assert.throws(()=>f.core.create(f.ctx,f.actor,'contacts',input,options),e=>[403,404].includes(e.statusCode));assert.equal(f.snapshot(),before);}
});
test('native CRM stale archive revision is rejected before changing records, audit or receipts',()=>{
 const f=fixture(),row=contact(f);f.core.update(f.ctx,f.actor,'contacts',row.id,{phone:'Literal newer phone'},{expectedRevision:row.revision});const before=f.snapshot(),writes=f.count();assert.throws(()=>f.core.remove(f.ctx,f.actor,'contacts',row.id,{expectedRevision:row.revision,idempotencyKey:'record-archive-stale-revision'}),e=>e.code==='crm_revision_conflict');assert.equal(f.snapshot(),before);assert.equal(f.count(),writes);
});
test('native CRM archive replay still checks current write permission',()=>{
 const f=fixture(),row=contact(f),options={expectedRevision:row.revision,idempotencyKey:'record-archive-current-access'};f.core.remove(f.ctx,f.actor,'contacts',row.id,options);f.actor.roles=['VIEWER'];const before=f.snapshot();assert.throws(()=>f.core.remove(f.ctx,f.actor,'contacts',row.id,options),e=>e.statusCode===403);assert.equal(f.snapshot(),before);
});
test('native CRM failed create, update and archive persistence restores records, audit and idempotency state without notifications',()=>{
 for(const action of ['create','update','archive']){const f=fixture(),row=contact(f),before=f.snapshot(),events=f.events.length;f.fail(true);const options={expectedRevision:row.revision,idempotencyKey:'record-atomic-'+action},call=()=>action==='create'?f.core.create(f.ctx,f.actor,'contacts',{name:'Literal new'},options):action==='update'?f.core.update(f.ctx,f.actor,'contacts',row.id,{phone:'Literal update'},options):f.core.remove(f.ctx,f.actor,'contacts',row.id,options);assert.throws(call,/persistence failure/);assert.equal(f.snapshot(),before);assert.equal(f.events.length,events);f.fail(false);const result=call();assert.ok(result.id);}
});
test('native CRM create, update and archive each persist the record and replay receipt once',()=>{
 const f=fixture();let before=f.count();const row=f.core.create(f.ctx,f.actor,'contacts',{name:'Literal atomic'},{idempotencyKey:'record-atomic-create-once'});assert.equal(f.count(),before+1);before=f.count();const updated=f.core.update(f.ctx,f.actor,'contacts',row.id,{phone:'Literal phone'},{expectedRevision:row.revision,idempotencyKey:'record-atomic-update-once'});assert.equal(f.count(),before+1);before=f.count();f.core.remove(f.ctx,f.actor,'contacts',row.id,{expectedRevision:updated.revision,idempotencyKey:'record-atomic-delete-once'});assert.equal(f.count(),before+1);f.restart();const count=f.count();assert.equal(f.core.remove(f.ctx,f.actor,'contacts',row.id,{expectedRevision:updated.revision,idempotencyKey:'record-atomic-delete-once'}).idempotent_replay,true);assert.equal(f.count(),count);
});
test('native CRM new archive receipts reject changed revision headers while historical archive receipts remain replayable',()=>{
 const f=fixture(),row=contact(f),options={expectedRevision:row.revision,idempotencyKey:'record-delete-revision-signature'};f.core.remove(f.ctx,f.actor,'contacts',row.id,options);assert.throws(()=>f.core.remove(f.ctx,f.actor,'contacts',row.id,{...options,expectedRevision:row.revision+1}),e=>e.code==='crm_idempotency_conflict');
 const old=contact(f),result=f.core.remove(f.ctx,f.actor,'contacts',old.id),sha=v=>crypto.createHash('sha256').update(v).digest('hex'),key='record-delete-legacy-signature';f.adapter.bucket(f.ctx,'crm:idempotency').push({digest:sha(f.actor.id+':'+key),signature:sha('contacts:'+old.id+':delete'),result,created_at:'2026-09-01T00:00:00Z'});const before=f.snapshot();assert.equal(f.core.remove(f.ctx,f.actor,'contacts',old.id,{expectedRevision:old.revision,idempotencyKey:key}).idempotent_replay,true);assert.equal(f.snapshot(),before);
});
test('native CRM capacity rejection does not leave an extra record behind',()=>{
 const f=fixture(),rows=f.adapter.bucket(f.ctx,'crm:contacts');for(let i=0;i<25000;i++)rows.push({id:'capacity_'+i,owner_id:f.actor.id,name:'Literal source'});const before=f.snapshot();assert.throws(()=>f.core.create(f.ctx,f.actor,'contacts',{name:'Beyond capacity'}),e=>e.code==='crm_capacity_reached');assert.equal(f.snapshot(),before);
});
test('native CRM dashboard save and replay preserve explicit permission principals without role grants',()=>{
 const f=fixture();f.actor.roles=[];f.actor.permissions=['crm:read_assigned','crm:write_assigned','crm:dashboard'];const options={idempotencyKey:'explicit-permission-dashboard'},row=f.save('Literal explicit permission',{is_default:true},options);const result=f.save('Literal explicit permission',{is_default:true},options);assert.equal(result.id,row.id);assert.equal(result.idempotent_replay,true);
});
