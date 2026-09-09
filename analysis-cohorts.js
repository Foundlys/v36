'use strict';
const {requirePermission}=require('./capability-resolver');
const DAY=86400000;
const fail=(code,message)=>{throw Object.assign(new Error(message),{code,statusCode:422});};
function cohortRetention(events,query={},now=Date.now()){
  const keys=['from','to','interval_days','periods','identity_field','acquisition_event','return_event'];
  if(Object.keys(query).some(key=>!keys.includes(key)))fail('cohort_query_invalid','De cohortdefinitie bevat een niet-ondersteunde filter');
  const date=key=>{const value=query[key];if(typeof value!=='string'||!/(?:Z|[+-]\d{2}:\d{2})$/.test(value)||!Number.isFinite(Date.parse(value)))fail('cohort_period_invalid','Kies een geldige periode met tijdzone-offset');return Date.parse(value);};
  const from=date('from'),to=date('to');
  if(to<=from||to-from>366*DAY)fail('cohort_period_invalid','Kies een periode van maximaal 366 dagen');
  const days=Number(query.interval_days??7),periods=Number(query.periods??4),field=query.identity_field;
  if(![1,7,30].includes(days)||!Number.isInteger(periods)||periods<1||periods>12)fail('cohort_interval_invalid','Kies 1, 7 of 30 dagen en 1 tot 12 vervolgperioden');
  if(!['customer_id','lead_id','anonymous_id','session_id'].includes(field))fail('cohort_identity_invalid','Kies expliciet een ondersteund identiteitstype');
  const names=['acquisition_event','return_event'].map(key=>{const value=query[key];if(typeof value!=='string'||!/^[a-z][a-z0-9_.:-]{1,79}$/.test(value))fail('cohort_event_invalid','Kies twee expliciete canonical eventnamen');return value;});
  if(names[0]===names[1])fail('cohort_event_invalid','Instroom en terugkeer moeten verschillende events zijn');
  if(!Array.isArray(events)||events.length>20000)fail('cohort_capacity_exceeded','Deze analyse ondersteunt maximaal 20.000 toegankelijke bronrecords');
  const observedTo=Math.min(to,Number(now)),width=days*DAY,first=new Map(),valid=[],seen=new Set();let invalid=0;
  if(!Number.isFinite(observedTo)||from>=observedTo)fail('cohort_period_invalid','De gekozen periode is nog niet waargenomen');
  for(const event of events){
    if(!names.includes(event?.event_name))continue;
    if(typeof event.event_id!=='string'||!event.event_id){invalid++;continue;}
    if(seen.has(event.event_id))continue;seen.add(event.event_id);
    const at=Date.parse(event.occurred_at);
    if(!Number.isFinite(at)){invalid++;continue;}
    if(at>=observedTo)continue;
    const subject=event[field],source=event.source;
    if(typeof subject!=='string'||!subject||subject.length>200||typeof source!=='string'||!source||source.length>80){invalid++;continue;}
    // No inferred cross-source identity stitching or inferred people.
    const identity=JSON.stringify([source,subject]),row={event,at,identity};valid.push(row);
    if(event.event_name===names[0]&&(!first.has(identity)||first.get(identity).at>at))first.set(identity,row);
  }
  const cohorts=new Map(),members=new Map(),evidence=new Map();
  for(const [identity,row] of first){
    if(row.at<from)continue;
    const index=Math.floor((row.at-from)/width);let cohort=cohorts.get(index);
    if(!cohort){cohort={start:from+index*width,members:new Set(),cells:Array.from({length:periods+1},()=>new Set())};cohorts.set(index,cohort);}
    cohort.members.add(identity);members.set(identity,{cohort,acquired_at:row.at});evidence.set(row.event.event_id,row.event);
  }
  for(const row of valid){
    if(row.event.event_name!==names[1])continue;
    const member=members.get(row.identity);if(!member||row.at<member.acquired_at)continue;
    const age=Math.floor((row.at-member.cohort.start)/width);if(age<0||age>periods)continue;
    member.cohort.cells[age].add(row.identity);evidence.set(row.event.event_id,row.event);
  }
  const iso=value=>new Date(value).toISOString();
  const items=[...cohorts.values()].sort((a,b)=>a.start-b.start).map(cohort=>({
    from:iso(cohort.start),to:iso(cohort.start+width),members:cohort.members.size,
    cells:cohort.cells.map((identities,age)=>{const complete=cohort.start+(age+1)*width<=observedTo;return {age,from:iso(cohort.start+age*width),to:iso(cohort.start+(age+1)*width),observed_returning_members:identities.size,complete,retention_percent:complete?identities.size/cohort.members.size*100:null,status:complete?'OBSERVED':'INCOMPLETE_WINDOW'};})
  }));
  const sources=[...new Set([...evidence.values()].map(event=>event.source))].sort(),support=[...evidence.values()].sort((a,b)=>a.event_id.localeCompare(b.event_id)),freshness=support.map(event=>event.received_at).filter(value=>Number.isFinite(Date.parse(value))).sort().at(-1)||null;
  return {schema_version:'foundly-cohort-retention/1.0.0',available:items.length>0,status:items.length?'OBSERVED_COHORTS':'NO_ACCESSIBLE_COHORTS',definition:{version:1,acquisition_event:names[0],return_event:names[1],identity_field:field,identity_namespace:'SOURCE',membership:'FIRST_VISIBLE_ACQUISITION_IN_RETAINED_HISTORY',interval_days:days,periods,alignment:'FIXED_INTERVALS_ANCHORED_AT_FROM',formula:'distinct returning members / observed cohort members * 100',period_zero:'RETURN_EVENT_IN_ACQUISITION_INTERVAL'},period:{from:iso(from),to:iso(to),observed_to:iso(observedTo)},items,sources,freshness,sample_size:members.size,data_quality:{excluded_visible_records:invalid,historical_coverage:'RETAINED_PERMISSION_FILTERED_EVENTS_ONLY',source_completeness:'NOT_ESTIMATED'},supporting_records:support.slice(0,2000).map(event=>({event_id:event.event_id,event_name:event.event_name,source:event.source,occurred_at:event.occurred_at,received_at:event.received_at,provider_verified:event.provider_verified===true})),supporting_record_count:support.length,supporting_records_truncated:support.length>2000,confidence:null,comparison:null,trend:null,query_execution:'BATCH_CANONICAL_PROJECTION',persistent_changes:false};
}
function queryCohorts(resolver,platform,ctx,actor,query){
  requirePermission(actor,'analysis:read');resolver.assertCapability(ctx,actor,'analysis:reports');resolver.assertCapability(ctx,actor,'analysis:events');
  const now=Date.now(),validated=cohortRetention([],query,now);
  const events=platform.eventsForProjection(ctx,actor,{event_names:[validated.definition.acquisition_event,validated.definition.return_event],occurred_before:validated.period.observed_to,max_events:20000,max_bytes:8*1024*1024});
  return cohortRetention(events,query,now);
}
module.exports={cohortRetention,queryCohorts};
