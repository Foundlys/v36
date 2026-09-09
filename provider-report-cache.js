'use strict';
const crypto=require('node:crypto');
const {providerRouteContract}=require('./module-access-contracts');
function canonical(value){
  if(Array.isArray(value))return value.map(canonical);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));
  return value;
}

// Internal read-through cache. This function is never a generic HTTP ingest API.
// Caller authorization is checked again; each user's provider queries stay private.
function cacheProviderReport(core,ctx,actor,route,source,request,data,observedAt){
  const contract=providerRouteContract(route);
  if(!contract||contract.operation!=='read'||!contract.capability.startsWith(core.id+':'))throw new TypeError('Provider report ownership mismatch');
  core.resolver.assertCapability(ctx,actor,contract.capability,'read');
  const capability=contract.capability.split(':')[1],entity=capability==='events'?'provider_events':capability==='campaigns'?'provider_campaigns':'provider_reports';
  const key=crypto.createHash('sha256').update(JSON.stringify(canonical({actor_id:actor.id,source,request}))).digest('hex');
  const result=core.mutate(ctx,()=>{
    const rows=core.bucket(ctx,entity),prior=rows.find(row=>row.id===key);
    if(!prior&&rows.length>=25000)throw Object.assign(new Error('Providerreportlimiet bereikt'),{statusCode:507,code:'provider_report_capacity'});
    const row={id:key,title:source,tenant_id:ctx.tenant_id,dealer_id:ctx.dealer_id,owner_id:actor.id,source_module:core.id,owned_entity:entity,schema_version:1,status:'OPEN',created_at:prior?.created_at||observedAt,updated_at:observedAt,revision:(prior?.revision||0)+1,request:canonical(request),data,provenance:{source_id:source,source_kind:'external_provider',method:'provider_api',provider_verified:true,observed_at:observedAt}};
    if(prior)rows[rows.indexOf(prior)]=row;else rows.push(row);
    core.recordEvent(ctx,actor,entity,row,prior?'updated':'created');
    return {record_id:key,revision:row.revision,owner_module:core.id};
  });
  try{core.flush(ctx,actor);}catch{result.event_delivery='QUEUED_RETRY';}
  return result;
}
module.exports={cacheProviderReport};
