'use strict';
const assert=require('node:assert/strict');
const {FoundlyPlatformCore}=require('./platform-core');
const {CapabilityResolver}=require('./capability-resolver');
const {guardDomain}=require('./composition-runtime');
const state=new Map(),ctx={tenant_id:'workflow-retry-fixture',dealer_id:'default'},owner={id:'owner',roles:['ADMIN','SUPER_ADMIN']},foreign={id:'another-owner',roles:['ADMIN','SUPER_ADMIN']};
let clock=new Date('2026-09-09T00:00:00Z'),disk,mode='fail_after_write',attempts=0,contractAvailable=true;
const adapter={bucket(c,s){const key=JSON.stringify([c,s]);if(!state.has(key))state.set(key,[]);return state.get(key);},now:()=>clock,persist(){disk=JSON.stringify([...state]);},automationActionContract:type=>({idempotent:contractAvailable&&type==='create_task'}),executeAutomationAction(c,actor,action,run){
 attempts++;
 if(mode==='deny')throw Object.assign(new Error('Private fixture forbidden reason'),{statusCode:403,code:'fixture_forbidden',retryable:true});
 if(mode==='permanent')throw Object.assign(new Error('Private fixture permanent failure'),{code:'fixture_permanent'});
 if(mode==='always_transient')throw Object.assign(new Error('Private transient diagnostic'),{code:'EIO'});
 const record=core.createAutomationRecord(c,actor,'tasks',{title:action.title},{idempotencyKey:run.idempotency_key});
 if(mode==='fail_after_write'){mode='success';throw Object.assign(new Error('Result unavailable after durable write'),{code:'ETIMEDOUT'});}
 return {executed:true,record_id:record.id,external_write:false};
}};
const resolver=new CapabilityResolver({...adapter,audit(){}});
resolver.configure(ctx,owner,{entitlements:['automation'],expected_revision:0});
let raw=new FoundlyPlatformCore(adapter),core=guardDomain(raw,'platform',()=>resolver);
const trigger={type:'schedule',automatic:true,at:clock.toISOString()},retry={max_attempts:3,initial_delay_seconds:10};
function workflow(name,policy=retry){return core.defineAutomation(ctx,owner,{name,trigger,actions:[{type:'create_task',title:name,retry:policy}]});}
function restore(){state.clear();for(const [key,value] of JSON.parse(disk))state.set(key,value);raw=new FoundlyPlatformCore(adapter);core=guardDomain(raw,'platform',()=>resolver);}
const flow=workflow('Retry after durable result loss');
const initial=core.tickAutomations(ctx,owner);assert.equal(initial.runs[0].status,'WAITING_RETRY');assert.equal(attempts,1);assert.equal(core.automationRecords(ctx,owner,'tasks').total,1);
let run=core.automationStatus(ctx,owner).runs[0];assert.equal(run.steps[0].attempts,1);assert.equal(run.next_wakeup_at,'2026-09-09T00:00:10.000Z');
assert.equal(core.tickAutomations(ctx,owner).processed,0,'No early retry');
restore();clock=new Date('2026-09-09T00:00:11Z');assert.equal(core.tickAutomations(ctx,foreign).processed,0,'Scheduler cannot lend another identity');
resolver.configure(ctx,owner,{entitlements:['automation'],capability_flags:{'automation:workflows':false},expected_revision:1});
assert.throws(()=>core.tickAutomations(ctx,owner),{code:'capability_disabled'});assert.equal(attempts,1);
resolver.configure(ctx,owner,{entitlements:['automation'],expected_revision:2});
contractAvailable=false;const unavailable=core.tickAutomations(ctx,owner);assert.equal(unavailable.runs[0].code,'automation_retry_contract_missing');assert.equal(core.automationStatus(ctx,owner).runs[0].status,'WAITING_RETRY');assert.equal(attempts,1);contractAvailable=true;
assert.equal(core.tickAutomations(ctx,owner).runs[0].status,'SUCCEEDED');assert.equal(attempts,2);assert.equal(core.automationRecords(ctx,owner,'tasks').total,1,'Retry returns the same durable record');
run=core.automationStatus(ctx,owner).runs[0];assert.equal(run.steps[0].attempts,2);assert.equal(run.errors.length,1);assert.equal(core.tickAutomations(ctx,owner).processed,0);

mode='always_transient';const failed=workflow('Exhausted bounded retries',{max_attempts:2,initial_delay_seconds:5});
assert.equal(core.tickAutomations(ctx,owner).runs[0].status,'WAITING_RETRY');clock=new Date(clock.getTime()+5000);
assert.equal(core.tickAutomations(ctx,owner).runs[0].status,'DEAD_LETTER');const exhaustedAttempts=attempts;
clock=new Date(clock.getTime()+3600000);assert.equal(core.tickAutomations(ctx,owner).processed,0);assert.equal(attempts,exhaustedAttempts);
const dead=core.automationStatus(ctx,owner).runs.find(row=>row.automation_id===failed.id);assert.equal(dead.steps[0].attempts,2);assert.ok(!JSON.stringify(dead).includes('Private transient diagnostic'));
restore();assert.equal(core.automationStatus(ctx,owner).dead_letter,1);

// Exponential backoff is bounded independently of retry count.
mode='always_transient';const backedOff=workflow('Bounded exponential backoff',{max_attempts:3,initial_delay_seconds:2400});
let before=clock.getTime();core.tickAutomations(ctx,owner);let scheduled=core.automationStatus(ctx,owner).runs.find(row=>row.automation_id===backedOff.id);assert.equal(Date.parse(scheduled.next_wakeup_at)-before,2400000);
clock=new Date(Date.parse(scheduled.next_wakeup_at));before=clock.getTime();core.tickAutomations(ctx,owner);scheduled=core.automationStatus(ctx,owner).runs.find(row=>row.automation_id===backedOff.id);assert.equal(Date.parse(scheduled.next_wakeup_at)-before,3600000);
clock=new Date(Date.parse(scheduled.next_wakeup_at));assert.equal(core.tickAutomations(ctx,owner).runs[0].status,'DEAD_LETTER');
assert.equal(core.automationStatus(ctx,owner).runs.find(row=>row.automation_id===backedOff.id).steps[0].attempts,3);

for(const failureMode of ['deny','permanent']){mode=failureMode;workflow(failureMode);assert.equal(core.tickAutomations(ctx,owner).runs[0].status,'ERROR');}
for(const action of [{type:'webhook',retry},{type:'notify',retry}])assert.throws(()=>core.defineAutomation(ctx,owner,{name:'No unproven retry',trigger:'custom_event',actions:[action]}),{code:'automation_retry_contract_missing'});
for(const policy of [{max_attempts:6,initial_delay_seconds:1},{max_attempts:2,initial_delay_seconds:0},{max_attempts:2,initial_delay_seconds:1,retry_all_errors:true}])assert.throws(()=>workflow('Invalid retry',policy),{code:'automation_retry_invalid'});
assert.throws(()=>core.defineAutomation(ctx,owner,{name:flow.name,trigger,actions:[{type:'create_task',title:flow.name,retry:{...retry,max_attempts:5}}]}),{code:'automation_version_immutable'});
console.log('PASS durable bounded retry, backoff, result-loss idempotency, owner/capability revalidation, revoked adapter contract, permanent-error refusal, dead-letter retention and restart');
