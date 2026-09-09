'use strict';
const crypto=require('node:crypto');
const fail=(code,message,statusCode=422)=>{throw Object.assign(new Error(message),{code,statusCode});};
const clone=value=>JSON.parse(JSON.stringify(value));
const digest=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
function dateOnly(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)fail('forecast_date_invalid','Gebruik een geldige datum (JJJJ-MM-DD)');return value;}
function validateForecast(entity,value){
  if(entity==='forecast_snapshots')fail('forecast_snapshot_action_required','Bewaar een prognose via de expliciete snapshotactie');
  if(entity!=='opportunities')return;
  for(const field of ['expected_close_date','closed_date'])if(value[field]!==undefined&&value[field]!==null&&value[field]!=='')dateOnly(value[field]);
  if(value.forecast_category!==undefined&&(!/^[A-Za-z0-9 _-]{1,80}$/.test(value.forecast_category)))fail('forecast_category_invalid','Gebruik een korte prognosecategorie');
}
function forecast(domain,ctx,actor,query={}){
  domain.scope(ctx,actor);
  domain.resolver.assertCapability(ctx,actor,'sales:forecast');domain.resolver.assertCapability(ctx,actor,'sales:opportunities');
  const from=dateOnly(query.from),to=dateOnly(query.to);if(to<from||Date.parse(to)-Date.parse(from)>366*86400000)fail('forecast_period_invalid','Kies een periode van maximaal één jaar');
  if(query.currency&&!/^[A-Z]{3}$/.test(query.currency))fail('forecast_currency_invalid','Gebruik een valutacode');
  const all=domain.bucket(ctx,'opportunities').filter(row=>!row.deleted_at&&row.status!=='ARCHIVED'&&domain.visible(row,actor)&&(!query.owner_id||row.owner_id===query.owner_id)&&(!query.pipeline_id||row.pipeline_id===query.pipeline_id));
  if(all.length>10000)fail('forecast_scope_limit','Beperk de prognose tot een eigenaar of pipeline met maximaal tienduizend kansen');
  const groups=Object.create(null),excluded=[],included=[];
  function add(group,key,value){if(!Number.isSafeInteger(group[key]+value))fail('forecast_amount_overflow','Het totaal overschrijdt het ondersteunde bedrag');group[key]+=value;}
  for(const row of all){
    if(['LOST','CANCELLED'].includes(row.status)||query.currency&&row.currency&&row.currency!==query.currency)continue;
    const won=row.status==='WON',date=won?row.closed_date:row.expected_close_date;
    if(!date){excluded.push({id:row.id,revision:row.revision,owner_id:row.owner_id,currency:row.currency||null,reason:won?'MISSING_ACTUAL_CLOSE_DATE':'MISSING_EXPECTED_CLOSE_DATE'});continue;}
    try{dateOnly(date);}catch{excluded.push({id:row.id,revision:row.revision,owner_id:row.owner_id,currency:row.currency||null,reason:'INVALID_CLOSE_DATE'});continue;}
    if(date<from||date>to||query.currency&&row.currency&&row.currency!==query.currency)continue;
    if(!row.currency||!Number.isSafeInteger(row.value_cents)||row.value_cents<0){excluded.push({id:row.id,revision:row.revision,owner_id:row.owner_id,currency:row.currency||null,reason:'MISSING_AMOUNT_OR_CURRENCY'});continue;}
    const group=groups[row.currency]||(groups[row.currency]={currency:row.currency,open_count:0,won_count:0,open_cents:0,won_cents:0,weighted_known_cents:0,probability_known_count:0,probability_missing_count:0,categories:Object.create(null)});
    const category=won?'CLOSED_WON':row.forecast_category||'UNCATEGORIZED',bucket=group.categories[category]||(group.categories[category]={count:0,value_cents:0});bucket.count++;add(bucket,'value_cents',row.value_cents);
    const weight=!won&&Number.isFinite(row.probability)&&row.probability>=0&&row.probability<=1?Math.round(row.value_cents*row.probability):null;
    if(won){group.won_count++;add(group,'won_cents',row.value_cents);}else{group.open_count++;add(group,'open_cents',row.value_cents);if(weight===null)group.probability_missing_count++;else{group.probability_known_count++;add(group,'weighted_known_cents',weight);}}
    included.push({id:row.id,revision:row.revision,title:row.title,status:row.status,date,currency:row.currency,value_cents:row.value_cents,probability:won?null:row.probability??null,weighted_cents:weight,forecast_category:category,owner_id:row.owner_id,pipeline_id:row.pipeline_id||null,provenance:row.provenance});
  }
  for(const group of Object.values(groups)){group.weighted_cents=group.probability_known_count?group.weighted_known_cents:null;group.probability_coverage=group.open_count?group.probability_known_count/group.open_count:null;group.weighted_scope=group.probability_missing_count?'PARTIAL_KNOWN_PROBABILITIES':'ALL_OPEN_RECORDS_WITH_PROBABILITY';}
  const filters={from,to,currency:query.currency||null,owner_id:query.owner_id||null,pipeline_id:query.pipeline_id||null},quotas=require('./sales-quotas').quotaComparison(domain,ctx,actor,filters,included,excluded),basis={filters,quotas,records:included.map(row=>({id:row.id,revision:row.revision,value_cents:row.value_cents,probability:row.probability,date:row.date,status:row.status})),excluded};
  return {module_id:'sales',available:included.length>0,filters,quotas,groups:Object.values(groups),items:included,excluded,source_record_count:all.length,basis_fingerprint:digest(basis),calculation:'SUM_OF_RECORDED_AMOUNT_TIMES_RECORDED_PROBABILITY',won_basis:'USER_RECORDED_CLOSED_DATE_AND_WON_STATUS',accounting_revenue:false,provider_verified:false,observed_at:new Date().toISOString()};
}
function snapshotForecast(domain,ctx,actor,input,options={}){
  domain.scope(ctx,actor,'write');
  domain.resolver.assertCapability(ctx,actor,'sales:forecast','write');const key=options.idempotency_key;if(typeof key!=='string'||!key.length||key.length>200)fail('forecast_idempotency_required','Een unieke actie-ID is verplicht');
  const signature=digest(input),keys=domain.adapter.bucket(ctx,'sales:idempotency'),previous=keys.find(row=>row.key===key&&row.actor_id===actor.id);
  if(previous){if(previous.fingerprint!==signature)fail('idempotency_conflict','Actie-ID heeft andere inhoud',409);return {record:domain.get(ctx,actor,'forecast_snapshots',previous.record_id),deduplicated:true};}
  if(input.confirm!==true||!String(input.title||'').trim()||String(input.title).length>240)fail('forecast_confirmation_required','Bevestig de prognose met een korte titel');
  const computed=input.scenario?require('./sales-scenarios').scenarioForecast(domain,ctx,actor,input.filters||{},input.scenario):forecast(domain,ctx,actor,input.filters||{});if(computed.basis_fingerprint!==input.basis_fingerprint)fail('forecast_basis_changed','De berekeningsbasis is gewijzigd; bekijk eerst de actuele prognose',409);
  const result=domain.mutate(ctx,()=>{
    const rows=domain.bucket(ctx,'forecast_snapshots');if(rows.length>=1000)fail('forecast_snapshot_capacity','Archiveer prognoses volgens het bewaarbeleid',507);
    const now=new Date().toISOString(),row={id:crypto.randomUUID(),tenant_id:ctx.tenant_id,dealer_id:ctx.dealer_id,owner_id:actor.id,owned_entity:'forecast_snapshots',source_module:'sales',schema_version:1,revision:1,title:String(input.title).trim(),status:'SAVED_SNAPSHOT',created_at:now,updated_at:now,forecast:computed,provenance:{source_id:'owned_sales_records',actor_id:actor.id,classification:computed.scenario?'USER_ASSUMPTION_SCENARIO':'CALCULATED_FROM_RECORDED_INPUT',provider_verified:false},immutable:true};
    rows.push(row);keys.push({key,actor_id:actor.id,fingerprint:signature,record_id:row.id});domain.recordEvent(ctx,actor,'forecast_snapshots',row,'created');return {record:clone(row),deduplicated:false};
  });try{domain.flush(ctx,actor);}catch{result.event_delivery='QUEUED_RETRY';}return result;
}
module.exports={dateOnly,validateForecast,forecast,snapshotForecast};
