'use strict';
const fail=(code,message,statusCode=422)=>{throw Object.assign(new Error(message),{code,statusCode});};
function validateQuota(domain,ctx,actor,entity,value,previous){
  if(entity!=='quotas')return;
  domain.scope(ctx,actor,'manage');
  const {dateOnly}=require('./sales-forecast');dateOnly(value.period_start);dateOnly(value.period_end);
  if(value.period_end<value.period_start||Date.parse(value.period_end)-Date.parse(value.period_start)>366*86400000)fail('quota_period_invalid','Kies een doelperiode van maximaal één jaar');
  if(typeof value.owner_id!=='string'||!/^[A-Za-z0-9_.:-]{1,200}$/.test(value.owner_id)||!/^[A-Z]{3}$/.test(value.currency||'')||!Number.isSafeInteger(value.target_cents)||value.target_cents<0)fail('quota_value_invalid','Eigenaar, valuta en een doelbedrag in gehele centen zijn verplicht');
  if(!['DRAFT','OPEN','ARCHIVED'].includes(value.status||'DRAFT'))fail('quota_status_invalid','Gebruik Concept, Open of Gearchiveerd');
  if(value.status==='OPEN'&&domain.bucket(ctx,'quotas').some(row=>row.id!==previous?.id&&row.status==='OPEN'&&row.owner_id===value.owner_id&&row.currency===value.currency&&row.period_start<=value.period_end&&row.period_end>=value.period_start))fail('quota_period_overlap','Er is al een actief doel voor deze eigenaar, valuta en periode',409);
}
function quotaComparison(domain,ctx,actor,filters,items,excluded){
  if(filters.pipeline_id)return {status:'PIPELINE_TARGET_NOT_DEFINED',items:[]};
  const quotas=domain.bucket(ctx,'quotas').filter(row=>row.status==='OPEN'&&!row.deleted_at&&domain.visible(row,actor)&&row.period_start===filters.from&&row.period_end===filters.to&&(!filters.currency||row.currency===filters.currency)&&(!filters.owner_id||row.owner_id===filters.owner_id));
  const pairs=new Map();for(const row of [...items,...quotas])pairs.set(JSON.stringify([row.owner_id,row.currency]),{owner_id:row.owner_id,currency:row.currency});
  const result=[...pairs.values()].map(pair=>{
    const records=items.filter(row=>row.owner_id===pair.owner_id&&row.currency===pair.currency),targets=quotas.filter(row=>row.owner_id===pair.owner_id&&row.currency===pair.currency),quota=targets.length===1?targets[0]:null;
    const incomplete=excluded.filter(row=>row.owner_id===pair.owner_id&&(!row.currency||row.currency===pair.currency)).length;
    const won=records.filter(row=>row.status==='WON').reduce((sum,row)=>sum+row.value_cents,0),known=records.filter(row=>row.status!=='WON'&&row.weighted_cents!==null).reduce((sum,row)=>sum+row.weighted_cents,0),missing=records.filter(row=>row.status!=='WON'&&row.weighted_cents===null).length;
    if(!Number.isSafeInteger(won)||!Number.isSafeInteger(known)||!Number.isSafeInteger(won+known))fail('quota_total_overflow','Doelvergelijking overschrijdt de veilige bedraggrens');
    const reason=targets.length>1?'AMBIGUOUS_TARGET':!quota?'NO_EXACT_PERIOD_TARGET':!records.length?'NO_SOURCE_RECORDS':incomplete?'INCOMPLETE_SOURCE_RECORDS':quota.target_cents===0?'ZERO_TARGET':null;
    return {...pair,quota:quota?{id:quota.id,revision:quota.revision,target_cents:quota.target_cents,period_start:quota.period_start,period_end:quota.period_end}:null,available:reason===null,unavailable_reason:reason,source_record_count:records.length,excluded_record_count:incomplete,won_cents:records.length?won:null,weighted_known_cents:records.length?known:null,probability_missing_count:missing,attainment_percent:reason===null?won/quota.target_cents*100:null,projected_attainment_percent:reason===null&&!missing?(won+known)/quota.target_cents*100:null,accounting_revenue:false};
  });
  return {status:result.length?'RECORDED_OWNER_TARGETS':'NO_TARGET_OR_SOURCE_RECORDS',period_matching:'EXACT_NO_PRORATING',items:result};
}
module.exports={validateQuota,quotaComparison};
