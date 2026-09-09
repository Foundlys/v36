'use strict';
const assert=require('node:assert/strict');
const {FoundlyPlatformCore}=require('./platform-core');
const {CapabilityResolver}=require('./capability-resolver');
const {queryCohorts}=require('./analysis-cohorts');
const state=new Map(),adapter={bucket(c,s){const key=JSON.stringify([c,s]);if(!state.has(key))state.set(key,[]);return state.get(key);},persist(){},audit(){}};
const core=new FoundlyPlatformCore(adapter),resolver=new CapabilityResolver(adapter),ctx={tenant_id:'bounded-projection',dealer_id:'default'},reader={id:'reader',roles:['VIEWER']},admin={id:'owner',roles:['ADMIN','SUPER_ADMIN']};
resolver.configure(ctx,admin,{entitlements:['analysis'],expected_revision:0});
const rows=core.bucket(ctx,'raw_events'),query={event_names:['customer_joined','customer_returned'],occurred_before:'2026-02-01T00:00:00Z',max_events:20,max_bytes:8192};
const event=(id,name,owner='reader')=>({event_id:id,event_name:name,source:'fixture',customer_id:id,occurred_at:'2026-01-02T00:00:00Z',received_at:'2026-01-02T00:00:00Z',permissions:{user_ids:[owner]}});
let copied=0;
for(let n=0;n<50000;n++){
  const row=event('excluded-'+n,n%2?'customer_joined':'unrelated_event',n%2?'private-owner':'reader');
  Object.defineProperty(row,'properties',{enumerable:true,get(){throw new Error('Irrelevant or private payload must not be copied');}});rows.push(row);
}
const visible=event('visible-member','customer_joined');Object.defineProperty(visible,'properties',{enumerable:true,get(){copied++;return {payload:'Accessible fixture'};}});rows.push(visible);
rows.push({...event('future','customer_joined'),occurred_at:'2027-01-01T00:00:00Z'});
const result=core.eventsForProjection(ctx,reader,query);assert.equal(result.length,1);assert.equal(copied,1);assert.equal(result[0].event_id,'visible-member');result[0].source='mutated-copy';assert.equal(visible.source,'fixture');assert.equal(rows.length,50002);
const reportQuery={from:'2026-01-01T00:00:00Z',to:'2026-01-29T00:00:00Z',acquisition_event:'customer_joined',return_event:'customer_returned',identity_field:'customer_id'};
assert.equal(queryCohorts(resolver,core,ctx,reader,reportQuery).sample_size,1,'Large unrelated/private history does not exhaust the cohort source budget');
let called=false;assert.throws(()=>queryCohorts(resolver,{eventsForProjection(){called=true;throw new Error('must not be reached');}},ctx,reader,{...reportQuery,from:'invalid'}),{code:'cohort_period_invalid'});assert.equal(called,false);
assert.throws(()=>core.eventsForProjection(ctx,reader,{...query,max_bytes:8}),{code:'event_projection_capacity_exceeded'});
rows.push(event('second-member','customer_joined'));assert.throws(()=>core.eventsForProjection(ctx,reader,{...query,max_events:1}),{code:'event_projection_capacity_exceeded'});assert.equal(rows.length,50003);
for(const mutation of [{max_events:0},{max_events:20001},{max_bytes:10485761},{max_bytes:0},{occurred_before:'2026-01-01'},{event_names:['bad()']},{owner_id:'ignored-filter'}])assert.throws(()=>core.eventsForProjection(ctx,reader,{...query,...mutation}),{code:'event_projection_query_invalid'});
assert.throws(()=>core.eventsForProjection(ctx,{id:'denied',roles:['UNKNOWN']},query),{code:'platform_forbidden'});
// The existing unbounded contract remains unchanged for other engine consumers.
const plainCtx={tenant_id:'legacy-projection',dealer_id:'default'};core.bucket(plainCtx,'raw_events').push(event('allowed','ordinary'),event('hidden','ordinary','private-owner'));
assert.deepEqual(core.eventsForProjection(plainCtx,reader).map(row=>row.event_id),['allowed']);
console.log('PASS 50,000 unrelated/private events excluded before copying; bounded records/bytes, input validation before retrieval, current ACL, immutable sources and legacy projection compatibility');
