'use strict';
const crypto=require('node:crypto');
const {forecast}=require('./sales-forecast');
const fail=(code,message,statusCode=422)=>{throw Object.assign(new Error(message),{code,statusCode});};
function scenarioForecast(domain,ctx,actor,filters,input){
  domain.scope(ctx,actor);domain.resolver.assertCapability(ctx,actor,'sales:forecast');domain.resolver.assertCapability(ctx,actor,'sales:opportunities');
  if(!filters||typeof filters!=='object'||Array.isArray(filters)||Object.keys(filters).some(key=>!['from','to','currency','owner_id','pipeline_id'].includes(key)))fail('scenario_filters_invalid','Gebruik expliciete prognosefilters');
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!['title','reason','adjustments'].includes(key)))fail('scenario_invalid','Gebruik een expliciet scenario met naam, onderbouwing en kansaanpassingen');
  for(const [key,max] of [['title',160],['reason',1000]])if(typeof input[key]!=='string'||!input[key].trim()||input[key].length>max)fail('scenario_rationale_required','Geef een korte scenarionaam en onderbouwing');
  if(!Array.isArray(input.adjustments)||input.adjustments.length<1||input.adjustments.length>200)fail('scenario_adjustments_invalid','Kies één tot tweehonderd expliciete kansaanpassingen');
  const ids=new Set(),adjustments=input.adjustments.map(row=>{
    if(!row||typeof row!=='object'||Array.isArray(row)||Object.keys(row).some(key=>!['opportunity_id','expected_revision','probability_bps'].includes(key))||typeof row.opportunity_id!=='string'||!row.opportunity_id||row.opportunity_id.length>200||!Number.isSafeInteger(row.expected_revision)||row.expected_revision<1||!Number.isInteger(row.probability_bps)||row.probability_bps<0||row.probability_bps>10000)fail('scenario_adjustment_invalid','Een aanpassing vereist een exacte kansrevisie en een percentage van 0 tot 100');
    if(ids.has(row.opportunity_id))fail('scenario_adjustment_duplicate','Kies iedere verkoopkans maximaal één keer');ids.add(row.opportunity_id);return {...row};
  }).sort((a,b)=>a.opportunity_id.localeCompare(b.opportunity_id));
  const baseline=forecast(domain,ctx,actor,filters),sources=new Map(baseline.items.map(row=>[row.id,row]));
  for(const adjustment of adjustments){const source=sources.get(adjustment.opportunity_id);if(!source||source.status==='WON')fail('scenario_source_unavailable','Kies een toegankelijke open verkoopkans binnen de berekeningsbasis');if(source.revision!==adjustment.expected_revision)fail('scenario_source_changed','De verkoopkans is gewijzigd; laad de prognose opnieuw',409);}
  const overrides=new Map(adjustments.map(row=>[row.opportunity_id,row])),safe=value=>{if(!Number.isSafeInteger(value))fail('scenario_amount_overflow','De berekening overschrijdt het ondersteunde bedrag');return value;};
  const items=baseline.items.map(row=>{const change=overrides.get(row.id),weight=change?Number((BigInt(row.value_cents)*BigInt(change.probability_bps)+5000n)/10000n):row.weighted_cents;return {...row,scenario_probability_bps:change?.probability_bps??null,scenario_weighted_cents:weight,assumption_applied:Boolean(change)};});
  const groups=baseline.groups.map(group=>{
    const rows=items.filter(row=>row.currency===group.currency&&row.status!=='WON'),missing=rows.filter(row=>row.scenario_weighted_cents===null).length,known=rows.reduce((sum,row)=>safe(sum+(row.scenario_weighted_cents??0)),0),excluded=baseline.excluded.filter(row=>!row.currency||row.currency===group.currency).length;
    const original=excluded||group.probability_missing_count?null:safe(group.won_cents+group.weighted_known_cents),scenario=excluded||missing?null:safe(group.won_cents+known);
    return {currency:group.currency,recorded_won_cents:group.won_cents,baseline_projected_cents:original,scenario_projected_cents:scenario,delta_cents:original===null||scenario===null?null:safe(scenario-original),scenario_weighted_known_cents:known,scenario_probability_missing_count:missing,excluded_source_count:excluded,comparison_available:original!==null&&scenario!==null};
  });
  const assumptions={title:input.title.trim(),reason:input.reason.trim(),adjustments},basis_fingerprint=crypto.createHash('sha256').update(JSON.stringify({baseline:baseline.basis_fingerprint,assumptions})).digest('hex');
  return {...baseline,baseline_fingerprint:baseline.basis_fingerprint,basis_fingerprint,scenario:{model_version:1,...assumptions,groups,items,classification:'USER_ASSUMPTION_SCENARIO',probability_unit:'BASIS_POINTS',calculation:'RECORDED_WON_PLUS_OPEN_AMOUNT_TIMES_EXPLICIT_OR_RECORDED_PROBABILITY',source_records_modified:false,confidence:null,accounting_revenue:false,provider_verified:false}};
}
module.exports={scenarioForecast};
