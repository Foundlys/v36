'use strict';
const assert=require('node:assert/strict');
const {CapabilityResolver}=require('./capability-resolver');
const {assertCoreRoute,privateRowVisible}=require('./core-access-contracts');
const state=new Map(),ctx={tenant_id:'core-guard-fixture',dealer_id:'default'},admin={id:'admin',roles:['SUPER_ADMIN']},viewer={id:'reader',roles:['VIEWER']},manager={id:'manager',roles:['MANAGER']};
const resolver=new CapabilityResolver({bucket(c,s){if(!state.has(s))state.set(s,[]);return state.get(s);},audit(){},persist(){}});
resolver.configure(ctx,admin,{entitlements:['crm'],expected_revision:0});
const guard=(path,method='GET',actor=viewer)=>assertCoreRoute(path,method,resolver,ctx,actor);
assert.doesNotThrow(()=>guard('/api/memory/crm'));
assert.throws(()=>guard('/api/memory/finance'),{code:'module_disabled'});
assert.throws(()=>guard('/api/memory/crm','POST'),{code:'composition_forbidden'});
for(const key of ['jarvis-confirmations','workspace-dashboard:crm:ROLE:ADMIN','jarvis-conversation:private','crm%2Fprivate','composition:profiles'])for(const actor of [admin,viewer])assert.throws(()=>guard('/api/memory/'+key,'GET',actor),{code:'memory_scope_forbidden'});
for(const [path,method] of [['/api/workers/tick','POST'],['/api/system/persist','POST'],['/api/integration-config/email','DELETE'],['/api/connector-runtime/config/email','PUT'],['/api/integration-sync/email','POST'],['/api/connector-runtime/test/email','POST'],['/api/google/connect','GET'],['/api/connect/meta','GET'],['/api/connect/meta/disconnect','POST'],['/api/connector-runtime/oauth/generic_rest/start','GET'],['/api/connector-runtime/profiles','POST'],['/api/connector-runtime/profile/email','PUT'],['/api/data/ingest','POST']]){
 assert.throws(()=>guard(path,method),{code:'core_forbidden'});assert.doesNotThrow(()=>guard(path,method,admin));
}
assert.doesNotThrow(()=>guard('/api/connector-runtime/config/email','PUT',manager));
assert.throws(()=>guard('/api/connector-runtime/profile/email','PUT',manager),{code:'core_forbidden'});
for(const route of ['/api/google/oauth/callback','/api/connect/meta/callback','/api/connector-runtime/oauth/generic_rest/callback'])assert.doesNotThrow(()=>guard(route));
assert.equal(privateRowVisible({owner_id:viewer.id},viewer),true);assert.equal(privateRowVisible({owner_id:'other'},viewer),false);assert.equal(privateRowVisible({},viewer),false);assert.equal(privateRowVisible({},admin),true);
resolver.configure(ctx,admin,{entitlements:['crm'],capability_flags:{'crm:leads':false},expected_revision:1});assert.throws(()=>guard('/api/memory/crm'),{code:'capability_disabled'});
console.log('PASS Core route privileges, reserved memory namespaces, owner filtering and preserved OAuth callback boundary');
// A foreign queue prefix cannot starve owned work; one thrown task cannot abort
// later owned work. Failure output never includes the task's private payload.
(async()=>{
 const calls=[],eligible=[...Array.from({length:12},(_,i)=>({id:'foreign-'+i,owner_id:'other'})),{id:'fails',owner_id:viewer.id},{id:'continues',owner_id:viewer.id}];
 const result=await require('./core-access-contracts').processOwnedQueue(eligible,viewer,true,async task=>{calls.push(task.id);if(task.id==='fails')throw new Error('private fixture payload');return {id:task.id,status:'SUCCEEDED'};});
 assert.deepEqual(calls,['fails','continues']);assert.equal(result.ownerBlocked,12);assert.equal(result.processed[0].status,'FAILED');assert.equal(result.processed[1].status,'SUCCEEDED');assert.ok(!JSON.stringify(result).includes('private fixture payload'));
 console.log('PASS owner-bound queue selection, per-task exception isolation and bounded failure disclosure');
})().catch(error=>{console.error(error);process.exitCode=1;});
