'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{fixture:storage}=require('../zero-evaluation/crm-save-fixture');
const profile={business_name:'Literal private business',country:'NL',industry:'automotive',segment:'dealer',defaults_locale:'en-GB'},options={idempotencyKey:'profile-atomic-request'};
function fixture(){const f=storage();f.actor.roles=['MANAGER'];return {...f,provision:()=>f.core.provisionProfile(f.ctx,f.actor,profile,options)};}
test('CRM profile persists tenant, pipeline, stages, default dashboard, audit and receipts once',()=>{
 const f=fixture(),before=f.count(),result=f.provision();assert.equal(f.count(),before+1);f.restart();const replay=f.provision();assert.equal(replay.idempotent_replay,true);assert.equal(replay.pipeline.id,result.pipeline.id);assert.equal(f.core.list(f.ctx,f.actor,'stages').total,6);assert.equal(f.count(),before+1);
});
test('CRM profile rolls back every new effect and previous default when final persistence fails',()=>{
 const f=fixture(),prior=f.save('Literal previous default',{is_default:true}),before=f.snapshot(),events=f.events.length,persist=f.core.adapter.persist;
 f.core.adapter.persist=()=>{if(f.core.collection(f.ctx,'dashboard_views').some(row=>row.business_profile))throw Error('simulated profile final persistence failure');persist();};
 assert.throws(()=>f.provision(),/profile final persistence failure/);assert.equal(f.snapshot(),before);assert.equal(f.events.length,events);f.core.adapter.persist=persist;f.restart();assert.equal(f.core.get(f.ctx,f.actor,'dashboard_views',prior.id).is_default,true);assert.equal(f.core.list(f.ctx,f.actor,'pipelines').total,0);assert.equal(f.provision().ok,true);
});
test('CRM profile does not leave early effects when a later stage reaches capacity',()=>{
 const f=fixture();f.core.collection(f.ctx,'stages').push(...Array.from({length:24997},(_,n)=>({id:'existing_'+n,tenant_id:f.ctx.tenant_id,dealer_id:f.ctx.dealer_id})));const before=f.snapshot(),events=f.events.length,writes=f.count();assert.throws(()=>f.provision(),e=>e.statusCode===507);assert.equal(f.snapshot(),before);assert.equal(f.events.length,events);assert.equal(f.count(),writes);
});
test('CRM profile preserves explicit permission grants through every nested operation',()=>{
 const f=fixture();f.actor.roles=[];f.actor.permissions=['crm:manage','crm:read_all','crm:write_all','crm:dashboard'];const result=f.provision();assert.equal(result.ok,true);assert.equal(result.stages.length,6);assert.equal(f.provision().idempotent_replay,true);
});
test('CRM cached profile rechecks current read and dashboard access before releasing private results',()=>{
 for(const revoke of ['read','dashboard','archived_pipeline','reassigned_dashboard']){const f=fixture(),first=f.provision();if(revoke==='archived_pipeline')f.core.remove(f.ctx,f.actor,'pipelines',first.pipeline.id);else if(revoke==='reassigned_dashboard'){f.core.update(f.ctx,f.actor,'dashboard_views',first.dashboard.id,{owner_id:'other_owner'});f.actor.roles=[];f.actor.permissions=['crm:manage','crm:dashboard','crm:read_assigned','crm:write_assigned'];}else {f.actor.roles=[];f.actor.permissions=revoke==='read'?['crm:manage','crm:dashboard']:['crm:manage','crm:read_all'];}const before=f.snapshot(),writes=f.count();assert.throws(()=>f.provision(),e=>[403,404].includes(e.statusCode),revoke);assert.equal(f.snapshot(),before);assert.equal(f.count(),writes);}
});
test('CRM historical profile receipts replay without inventing atomic completion evidence or recreating configuration',()=>{
 const f=fixture(),first=f.provision(),receipt=f.core.adapter.bucket(f.ctx,'crm:idempotency').find(row=>row.result?.profile);delete receipt.result.configuration_status;f.core.commit();const before=f.snapshot(),writes=f.count();f.restart();const replay=f.provision();assert.equal(replay.configuration_status,'LEGACY_OUTCOME_UNVERIFIED');assert.equal(replay.pipeline.id,first.pipeline.id);assert.equal(f.snapshot(),before);assert.equal(f.count(),writes);
});
