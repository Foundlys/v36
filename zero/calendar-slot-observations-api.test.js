'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{fixture}=require('../zero-evaluation/fixture');
const base='/api/calendar/scheduling';
async function setup(f){
 assert.equal((await f.request('/api/composition','PUT',{entitlements:['calendar'],expected_revision:0})).status,200);
 const owner=await f.enroll('slot.observation.owner',['SALES']),calendar=await f.request('/api/calendar/calendars','POST',{name:'PRIVATE slot calendar',timezone:'Europe/Amsterdam'},owner.cookie);
 assert.equal(calendar.status,201);const from='2026-10-02T08:00:00.000Z',to='2026-10-05T08:00:00.000Z',availability=await f.request('/api/calendar/availability','POST',{title:'PRIVATE available window',calendar_id:calendar.body.record.id,start_at:from,end_at:to,timezone:'Europe/Amsterdam'},owner.cookie);
 assert.equal(availability.status,201);return {owner,calendar:calendar.body.record,availability:availability.body.record,query:{calendar_ids:calendar.body.record.id,from,to,duration_minutes:5,step_minutes:5}};
}
function slots(f,s,query=s.query){return f.request(base+'/slots?'+new URLSearchParams(query),'GET',undefined,s.owner.cookie);}
test('actual scheduling HTTP retains unknown limited totals across encrypted restart and exposes current booking authority separately',async()=>{
 const f=await fixture();try{const s=await setup(f),first=await slots(f,s);assert.equal(first.status,200);assert.equal(first.body.schema_version,1);assert.deepEqual(first.body.request_context,{tenant_id:'zero-evaluation',dealer_id:'default',actor_id:s.owner.member.id});assert.deepEqual(first.body.query,{...s.query,calendar_ids:[s.calendar.id],distribution:'AVAILABILITY'});assert.equal(first.body.total,null);assert.equal(first.body.total_is_exact,false);assert.equal(first.body.candidate_limit_applied,true);assert.equal(first.body.returned_count,500);assert.equal(first.body.can_book,true);
 for(const field of ['duration_minutes','step_minutes']){const invalid=await slots(f,s,{...s.query,[field]:0});assert.equal(invalid.status,422);assert.equal(invalid.body.code,'scheduling_window_invalid');}
 await f.stop();await f.start();s.owner.cookie=await f.login(s.owner);const restarted=await slots(f,s);assert.equal(restarted.body.total,null);assert.deepEqual(restarted.body.items,first.body.items);
 assert.equal((await f.request('/api/identity/users/'+s.owner.member.id,'PUT',{roles:['VIEWER'],expected_revision:s.owner.member.revision,confirm:true,reason:'Revoke native booking in isolated test'})).status,200);s.owner.cookie=await f.login(s.owner);
 const current=await slots(f,s);assert.equal(current.status,200);assert.equal(current.body.can_book,false);assert.equal(current.body.total,null);const denied=await f.request(base+'/book','POST',{...first.body.items[0],title:'Must not be booked',confirm:true},s.owner.cookie,{'idempotency-key':crypto.randomUUID()});assert.equal(denied.status,403);assert.equal((await f.request('/api/calendar/events','GET',undefined,s.owner.cookie)).body.total,0);
 }finally{await f.close();}
});
test('actual scheduling HTTP refuses a stale availability revision and persists only a newly selected confirmed slot',async()=>{
 const f=await fixture();try{const s=await setup(f),query={...s.query,to:'2026-10-02T09:00:00.000Z',duration_minutes:60},before=await slots(f,s,query);assert.equal(before.status,200);assert.equal(before.body.total,1);assert.equal(before.body.total_is_exact,true);
 const changed=await f.request('/api/calendar/availability/'+s.availability.id,'PUT',{title:'PRIVATE changed availability',expected_revision:s.availability.revision},s.owner.cookie);assert.equal(changed.status,200);
 const old=await f.request(base+'/book','POST',{...before.body.items[0],title:'Must not use old selection',confirm:true},s.owner.cookie,{'idempotency-key':crypto.randomUUID()});assert.equal(old.status,409);assert.equal(old.body.code,'availability_changed');
 const after=await slots(f,s,query);assert.equal(after.body.total,1);assert.notEqual(after.body.items[0].availability_revision,before.body.items[0].availability_revision);const booked=await f.request(base+'/book','POST',{...after.body.items[0],title:'PRIVATE explicitly selected appointment',confirm:true},s.owner.cookie,{'idempotency-key':crypto.randomUUID()});assert.equal(booked.status,201);assert.equal(booked.body.record.start_at,query.from);assert.equal(booked.body.record.end_at,query.to);
 await f.stop();await f.start();s.owner.cookie=await f.login(s.owner);const remaining=await slots(f,s,query);assert.equal(remaining.body.total,0);assert.equal(remaining.body.total_is_exact,true);assert.equal(remaining.body.truncated,false);assert.equal((await f.request('/api/calendar/events','GET',undefined,s.owner.cookie)).body.total,1);
 }finally{await f.close();}
});
