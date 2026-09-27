'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {FoundlyCrmCore}=require('../crm-core');
const {fixture}=require('../zero-evaluation/crm-save-fixture');

test('native CRM dashboard rejected revision, validation, ownership and missing-target writes do not demote existing defaults or alter audit',()=>{
 for(const mode of ['revision','validation','ownership','missing']){const f=fixture(),first=f.save('Literal first',{is_default:true}),other=f.core.saveDashboard(f.ctx,f.other,{name:'Literal other',widgets:[{id:'dashboard_leads',type:'KPI',metric:'leads',x:0,y:0,w:4,h:2}],share_mode:'TEAM',team_id:'team_a'});
  const payload=mode==='revision'?{id:first.id,is_default:true}:mode==='validation'?{is_default:true,widgets:[{type:'BAD'}]}:{id:mode==='ownership'?other.id:'not_found',is_default:true};
  // Revision rejection must also preserve another existing default.
  if(mode==='revision'){f.save('Literal second',{is_default:true});}
  const before=f.snapshot(),count=f.count(),emitted=f.events.length;assert.throws(()=>f.save('Literal rejected',payload,mode==='revision'?{expectedRevision:0}:{}),error=>error.code===({revision:'crm_revision_conflict',validation:'crm_dashboard_invalid',ownership:'crm_forbidden',missing:'crm_record_not_found'}[mode]));assert.equal(f.snapshot(),before);assert.equal(f.count(),count);assert.equal(f.events.length,emitted);}
});
test('native CRM dashboard replay cannot demote a newer default or repeat audits and writes',()=>{
 const f=fixture(),input={is_default:true},options={idempotencyKey:'dashboard-replay-original'},first=f.save('Literal first',input,options),second=f.save('Literal newer',{is_default:true}),before=f.snapshot(),count=f.count(),events=f.events.length;
 const replay=f.save('Literal first',input,options);assert.equal(replay.id,first.id);assert.equal(replay.idempotent_replay,true);assert.equal(f.snapshot(),before);assert.equal(f.count(),count);assert.equal(f.events.length,events);assert.equal(f.core.dashboard(f.ctx,f.actor,{}).id,second.id);
});
test('native CRM dashboard persistence failure restores target, previous default, audit and replay state before retry',()=>{
 const f=fixture(),first=f.save('Literal first',{is_default:true}),before=f.snapshot(),events=f.events.length;f.fail(true);assert.throws(()=>f.save('Literal second',{is_default:true},{idempotencyKey:'dashboard-failed-disk'}),/persistence failure/);assert.equal(f.snapshot(),before);assert.equal(f.events.length,events);assert.equal(f.core.get(f.ctx,f.actor,'dashboard_views',first.id).is_default,true);f.fail(false);const second=f.save('Literal second',{is_default:true},{idempotencyKey:'dashboard-failed-disk'});assert.equal(f.core.list(f.ctx,f.actor,'dashboard_views').total,2);f.restart();assert.equal(f.core.dashboard(f.ctx,f.actor,{}).id,second.id);assert.equal(f.save('Literal second',{is_default:true},{idempotencyKey:'dashboard-failed-disk'}).idempotent_replay,true);
});
test('native CRM dashboard update, default demotion, audit and idempotency result persist in one commit',()=>{
 const f=fixture(),first=f.save('Literal first',{is_default:true}),second=f.save('Literal second'),before=f.count();const next=f.save('Literal changed',{id:second.id,is_default:true},{idempotencyKey:'dashboard-update-atomic',expectedRevision:second.revision});assert.equal(f.count(),before+1);assert.equal(next.revision,second.revision+1);assert.equal(f.core.get(f.ctx,f.actor,'dashboard_views',first.id).is_default,false);f.restart();assert.equal(f.core.dashboard(f.ctx,f.actor,{}).id,second.id);const n=f.count(),replay=f.save('Literal changed',{id:second.id,is_default:true},{idempotencyKey:'dashboard-update-atomic',expectedRevision:second.revision});assert.equal(replay.idempotent_replay,true);assert.equal(f.count(),n);
});
test('native CRM dashboard replay checks current permission and target ownership before returning cached private records',()=>{
 const f=fixture(),options={idempotencyKey:'dashboard-replay-permission'},first=f.save('Literal private saved',{is_default:true},options);f.actor.roles=['VIEWER'];assert.throws(()=>f.save('Literal private saved',{is_default:true},options),e=>e.code==='crm_forbidden');f.actor.roles=['SALES'];const row=f.adapter.bucket(f.ctx,'crm:dashboard_views').find(r=>r.id===first.id);row.owner_id=f.other.id;row.team_id='team_b';const before=f.snapshot();assert.throws(()=>f.save('Literal private saved',{is_default:true},options),e=>[403,404].includes(e.statusCode));assert.equal(f.snapshot(),before);
});
test('native CRM dashboard malformed default flags and conflicting replay payloads make no mutation',()=>{
 const f=fixture();f.save('Literal first',{is_default:true},{idempotencyKey:'dashboard-default-typed'});for(const value of ['false','true',1,null]){const before=f.snapshot();assert.throws(()=>f.save('Literal invalid',{is_default:value}),e=>e.code==='crm_dashboard_invalid');assert.equal(f.snapshot(),before);}const before=f.snapshot();assert.throws(()=>f.save('Literal changed',{is_default:true},{idempotencyKey:'dashboard-default-typed'}),e=>e.code==='crm_idempotency_conflict');assert.equal(f.snapshot(),before);
});
test('native CRM dashboard signatures replay receipts produced through the existing generic create and update contracts',()=>{
 const f=fixture(),input={name:'Literal legacy dashboard',widgets:[{id:'legacy_leads',type:'KPI',metric:'leads',x:0,y:0,w:4,h:2}],share_mode:'PRIVATE',is_default:true},data={...input,owner_id:f.actor.id,persisted:true},first=f.core.create(f.ctx,f.actor,'dashboard_views',data,{idempotencyKey:'legacy-dashboard-create'});f.save('Literal current default',{is_default:true});let before=f.snapshot();let replay=f.core.saveDashboard(f.ctx,f.actor,input,{idempotencyKey:'legacy-dashboard-create'});assert.equal(replay.id,first.id);assert.equal(replay.idempotent_replay,true);assert.equal(f.snapshot(),before);
 const record=f.core.get(f.ctx,f.actor,'dashboard_views',first.id),update={...input,id:first.id,name:'Literal legacy edit'},options={idempotencyKey:'legacy-dashboard-update',expectedRevision:record.revision};f.core.update(f.ctx,f.actor,'dashboard_views',first.id,{...update,owner_id:f.actor.id,persisted:true},options);before=f.snapshot();replay=f.core.saveDashboard(f.ctx,f.actor,update,options);assert.equal(replay.idempotent_replay,true);assert.equal(f.snapshot(),before);
});
