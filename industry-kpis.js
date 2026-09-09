'use strict';
const {requirePermission}=require('./capability-resolver');
const fail=(code,message,statusCode=422)=>{throw Object.assign(new Error(message),{code,statusCode});};
function industryKpis(resolver,platform,ctx,actor,query={}){
  requirePermission(actor,'analysis:read');resolver.assertCapability(ctx,actor,'analysis:kpis','read');resolver.assertCapability(ctx,actor,'analysis:events','read');
  const resolution=resolver.resolve(ctx,actor),definitions=resolution.industry_extensions?.analysis?.kpi_definitions||[];
  const dates=['from','to'].map(key=>{const value=query[key];if(typeof value!=='string'||!/(?:Z|[+-]\d{2}:\d{2})$/.test(value)||!Number.isFinite(Date.parse(value)))fail('industry_kpi_period_invalid','Geef een geldige periode met tijdzone-offset');return Date.parse(value);});
  if(dates[1]<=dates[0])fail('industry_kpi_period_invalid','Einde moet na start liggen');
  if(!definitions.length)return {industry_id:resolution.industry_id,items:[],period:{from:query.from,to:query.to},status:'NO_REGISTERED_KPIS'};
  if(definitions.some(def=>def.currency_required)&&!/^[A-Z]{3}$/.test(query.currency||''))fail('industry_kpi_currency_required','Kies één valuta voor deze berekening');
  const events=platform.eventsForProjection(ctx,actor).filter(event=>Date.parse(event.occurred_at)>=dates[0]&&Date.parse(event.occurred_at)<dates[1]);
  if(events.length>10000)fail('industry_kpi_period_too_large','Verklein de periode voor deze berekening');
  const items=definitions.map(def=>{
    if(def.operation!=='RATIO_OF_SUMS_PERCENT'||!def.id||!def.event_name||!def.numerator||!def.denominator)fail('industry_kpi_definition_invalid','Branche-KPI heeft geen ondersteunde definitie');
    const matching=events.filter(event=>event.event_name===def.event_name&&event.properties?.industry_id===resolution.industry_id);
    let numerator=0,denominator=0,invalid=0;const evidence=[];
    for(const event of matching){const a=event.properties[def.numerator],b=event.properties[def.denominator];
      if(!Number.isSafeInteger(a)||a<0||!Number.isSafeInteger(b)||b<0||def.currency_required&&(!query.currency||event.properties.currency!==query.currency)){invalid++;continue;}
      numerator+=a;denominator+=b;if(!Number.isSafeInteger(numerator)||!Number.isSafeInteger(denominator))fail('industry_kpi_overflow','Berekening overschrijdt de veilige numerieke grens');
      evidence.push({event_id:event.event_id,source:event.source,occurred_at:event.occurred_at,received_at:event.received_at,provider_verified:event.provider_verified===true});
    }
    const available=evidence.length>0&&denominator>0;
    return {id:def.id,name:def.name||def.id,definition:{version:def.version||1,formula:`sum(${def.numerator}) / sum(${def.denominator}) * 100`,event_name:def.event_name},available,value:available?numerator/denominator*100:null,unit:'PERCENT',currency:query.currency||null,period:{from:query.from,to:query.to},sample_size:evidence.length,data_quality:{excluded_visible_records:invalid,status:invalid?'INCOMPLETE':available?'SUPPORTED':'NO_USABLE_DATA'},freshness:evidence.map(e=>e.received_at).filter(Boolean).sort().at(-1)||null,supporting_records:evidence,confidence:null,confidence_reason:'DETERMINISTIC_ARITHMETIC_SOURCE_VALIDITY_NOT_ESTIMATED',comparison:null,trend:null};
  });
  return {industry_id:resolution.industry_id,items,period:{from:query.from,to:query.to},scope:'PERMISSION_FILTERED_CANONICAL_EVENTS'};
}
module.exports={industryKpis};
