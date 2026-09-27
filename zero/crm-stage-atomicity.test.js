'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{fixture:storage}=require('../zero-evaluation/crm-save-fixture');
function fixture({automation=true}={}){const f=storage();f.actor.roles=['MANAGER'];const c=f.core,ctx=f.ctx,a=f.actor,pipeline=c.create(ctx,a,'pipelines',{name:'Literal pipeline'}),first=c.create(ctx,a,'stages',{name:'Literal new',pipeline_id:pipeline.id,probability:10,status:'OPEN'}),next=c.create(ctx,a,'stages',{name:'Literal qualified',pipeline_id:pipeline.id,probability:60,status:'OPEN'}),deal=c.create(ctx,a,'deals',{title:'Literal private deal',pipeline_id:pipeline.id,stage_id:first.id,owner_id:a.id}),definition=()=>c.create(ctx,a,'automations',{name:'Literal stage automation',enabled:true,trigger:{type:'stage_change',conditions:{stage_id:next.id}},actions:[{type:'task',title:'Literal follow-up'}]});if(automation)definition();return {...f,pipeline,first,next,deal,definition,event:{id:'literal-stage-event',type:'stage_change',entity:'deals',record_id:deal.id,before:{stage_id:first.id},after:{stage_id:next.id}},options:{idempotencyKey:'literal-stage-request',eventId:'literal-stage-event',expectedRevision:deal.revision},move(){return c.moveDeal(ctx,a,deal.id,next.id,this.options);}};}
test('native CRM stage move checks automation permission before changing the deal',()=>{
 const f=fixture();f.actor.roles=['SALES'];const before=f.snapshot(),writes=f.count(),events=f.events.length;assert.throws(()=>f.move(),e=>e.code==='crm_forbidden');assert.equal(f.snapshot(),before);assert.equal(f.count(),writes);assert.equal(f.events.length,events);
});
test('native CRM stage move retries its original request without rebuilding history or duplicating tasks',()=>{
 const f=fixture(),first=f.move(),before=f.snapshot(),writes=f.count(),events=f.events.length;const replay=f.move();assert.equal(replay.id,first.id);assert.equal(replay.idempotent_replay,true);assert.equal(f.snapshot(),before);assert.equal(f.count(),writes);assert.equal(f.events.length,events);assert.equal(f.core.list(f.ctx,f.actor,'tasks').total,1);assert.equal(f.core.get(f.ctx,f.actor,'deals',f.deal.id).stage_history.length,1);
});
test('native CRM stage and automation side effects roll back together when their persistence fails',()=>{
 const f=fixture(),before=f.snapshot(),events=f.events.length,persist=f.core.adapter.persist;f.core.adapter.persist=()=>{if(f.core.collection(f.ctx,'tasks').some(row=>row.related_id===f.deal.id))throw Error('simulated stage-effect persistence failure');persist();};assert.throws(()=>f.move(),/stage-effect persistence failure/);assert.equal(f.snapshot(),before);assert.equal(f.events.length,events);f.core.adapter.persist=persist;f.restart();assert.equal(f.core.get(f.ctx,f.actor,'deals',f.deal.id).stage_id,f.first.id);
});
test('native CRM stage move persists deal, tasks, execution audit and request receipt in one commit',()=>{
 const f=fixture(),before=f.count();f.move();assert.equal(f.count(),before+1);f.restart();assert.equal(f.core.get(f.ctx,f.actor,'deals',f.deal.id).stage_id,f.next.id);assert.equal(f.core.list(f.ctx,f.actor,'tasks').total,1);assert.equal(f.move().idempotent_replay,true);
});
test('native CRM automation remembers an empty observed match set instead of executing new definitions on replay',()=>{
 const f=fixture({automation:false}),first=f.core.evaluateAutomations(f.ctx,f.actor,f.event);assert.equal(first.executions.length,0);f.definition();const before=f.snapshot(),writes=f.count(),replay=f.core.evaluateAutomations(f.ctx,f.actor,f.event);assert.equal(replay.replayed,true);assert.equal(replay.executions.length,0);assert.equal(f.snapshot(),before);assert.equal(f.count(),writes);assert.equal(f.core.list(f.ctx,f.actor,'tasks').total,0);
});
test('native CRM automation binds each observed event identifier to its original payload',()=>{
 const f=fixture();f.core.evaluateAutomations(f.ctx,f.actor,f.event);const before=f.snapshot();assert.throws(()=>f.core.evaluateAutomations(f.ctx,f.actor,{...f.event,after:{stage_id:f.first.id}}),e=>e.statusCode===409);assert.equal(f.snapshot(),before);
});
test('native CRM failed standalone automation evaluation leaves no task, audit or execution result behind',()=>{
 const f=fixture(),before=f.snapshot(),events=f.events.length;f.fail(true);assert.throws(()=>f.core.evaluateAutomations(f.ctx,f.actor,f.event),/persistence failure/);assert.equal(f.snapshot(),before);assert.equal(f.events.length,events);
});
test('native CRM over-limit matching automation definitions reject without silently applying a partial set',()=>{
 const f=fixture();for(let n=1;n<26;n++)f.definition();const before=f.snapshot();assert.throws(()=>f.core.evaluateAutomations(f.ctx,f.actor,f.event),e=>e.statusCode===413);assert.equal(f.snapshot(),before);
});
test('native CRM stage move retains explicit permission grants through nested automation evaluation',()=>{
 const f=fixture();f.actor.roles=[];f.actor.permissions=['crm:read_assigned','crm:write_assigned','crm:automate'];const result=f.move();assert.equal(result.stage_id,f.next.id);assert.equal(f.core.list(f.ctx,f.actor,'tasks').total,1);
});
test('native CRM legacy stage receipts preserve the recorded write without rerunning uncertain automation effects',()=>{
 const f=fixture(),record=f.core.update(f.ctx,f.actor,'deals',f.deal.id,{stage_id:f.next.id,probability:f.next.probability,status:f.next.status,stage_history:[{stage_id:f.next.id,at:f.core.adapter.now().toISOString()}]},f.options),before=f.snapshot(),writes=f.count(),result=f.move();assert.equal(result.id,record.id);assert.equal(result.idempotent_replay,true);assert.equal(result.automation_status,'LEGACY_OUTCOME_UNVERIFIED');assert.equal(f.snapshot(),before);assert.equal(f.count(),writes);assert.equal(f.core.list(f.ctx,f.actor,'tasks').total,0);
});
test('native CRM event replay authorizes its receipt before comparing private request content',()=>{
 const f=fixture({automation:false});f.core.evaluateAutomations(f.ctx,f.actor,f.event);const actor={id:'other_reader',roles:[],permissions:['crm:automate','crm:read_assigned']},before=f.snapshot();assert.throws(()=>f.core.evaluateAutomations(f.ctx,actor,{...f.event,after:{stage_id:'different'}}),e=>e.statusCode===403);assert.equal(f.snapshot(),before);
});
test('native CRM planned and external automation actions do not claim complete execution',()=>{
 const f=fixture({automation:false});f.core.create(f.ctx,f.actor,'automations',{name:'Literal planned automation',enabled:true,trigger:{type:'stage_change'},actions:[{type:'assign',owner_id:'literal_target'}]});let result=f.core.evaluateAutomations(f.ctx,f.actor,f.event);assert.equal(result.executions[0].status,'PARTIAL');assert.equal(result.executions[0].actions[0].status,'PLANNED_REQUIRES_VERIFIED_TARGET');assert.equal(result.executions[0].actions[0].external_write,false);
 f.core.create(f.ctx,f.actor,'automations',{name:'Literal gated email',enabled:true,trigger:{type:'stage_change'},actions:[{type:'email'}]});result=f.core.evaluateAutomations(f.ctx,f.actor,{...f.event,id:'literal_second_event'});assert.equal(result.executions[1].status,'PARTIAL');assert.equal(result.executions[1].actions[0].status,'AWAITING_EXPLICIT_AUTHORIZATION');assert.equal(result.executions[1].actions[0].external_write,false);
});
test('native CRM stage event identifier collision rolls back the associated deal update',()=>{
 const f=fixture(),other=f.core.create(f.ctx,f.actor,'deals',{title:'Other authorized event source',pipeline_id:f.pipeline.id});f.core.evaluateAutomations(f.ctx,f.actor,{...f.event,record_id:other.id});const before=f.snapshot(),writes=f.count(),events=f.events.length;assert.throws(()=>f.move(),e=>e.code==='crm_event_replay_conflict');assert.equal(f.snapshot(),before);assert.equal(f.count(),writes);assert.equal(f.events.length,events);
});
test('native CRM observed automation receipt requires current access to its generated task',()=>{
 const f=fixture();f.actor.roles=[];f.actor.permissions=['crm:read_assigned','crm:write_assigned','crm:automate'];f.core.evaluateAutomations(f.ctx,f.actor,f.event);const task=f.core.collection(f.ctx,'tasks')[0];task.owner_id='reassigned-owner';const before=f.snapshot();assert.throws(()=>f.core.evaluateAutomations(f.ctx,f.actor,f.event),e=>e.statusCode===404);assert.equal(f.snapshot(),before);
});
