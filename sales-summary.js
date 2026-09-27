'use strict';
// Summary has no date filter. It describes current authorized native records,
// with explicit known subtotals; it is neither revenue nor a provider claim.
const {weightedCents}=require('./sales-forecast-client-state');
const money=v=>Number.isSafeInteger(v)&&v>=0,probability=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1,currency=v=>typeof v==='string'&&/^[A-Z]{3}$/.test(v),MAX=BigInt(Number.MAX_SAFE_INTEGER);
function summarize(rows,{available=true}={}){
 const groups=new Map(),excluded=[];let activeCount=0,unassigned=0,included=0;
 if(available)for(const row of rows){
  if(row.deleted_at||['ARCHIVED','LOST','CANCELLED'].includes(row.status))continue;
  activeCount++;
  const exclude=reason=>excluded.push({id:row.id,revision:row.revision??null,currency:currency(row.currency)?row.currency:null,reason});
  if(!currency(row.currency)){unassigned++;exclude('MISSING_OR_INVALID_CURRENCY');continue;}
  let g=groups.get(row.currency);
  if(!g){g={currency:row.currency,open_count:0,won_count:0,probability_known_count:0,probability_missing_count:0,weighted_source_count:0,open_amount_missing_count:0,won_amount_missing_count:0,open_known_cents:0n,won_known_cents:0n,weighted_known_cents:0n};groups.set(row.currency,g);}
  const won=row.status==='WON',known=probability(row.probability),validAmount=money(row.value_cents);
  if(won)g.won_count++;else{g.open_count++;if(known)g.probability_known_count++;else g.probability_missing_count++;}
  if(!validAmount){g[won?'won_amount_missing_count':'open_amount_missing_count']++;exclude('MISSING_OR_INVALID_AMOUNT');continue;}
  included++;g[won?'won_known_cents':'open_known_cents']+=BigInt(row.value_cents);
  if(!won&&known){g.weighted_source_count++;g.weighted_known_cents+=BigInt(weightedCents(row.value_cents,row.probability));}
 }
 const currency_groups=Object.fromEntries([...groups].map(([code,g])=>{
  const overflow_fields=[];
  for(const field of ['open_known_cents','won_known_cents','weighted_known_cents']){if(g[field]>MAX){g[field]=null;overflow_fields.push(field);}else g[field]=Number(g[field]);}
  const incomplete=unassigned>0||g.open_amount_missing_count+g.won_amount_missing_count>0;
  return [code,{...g,open_cents:unassigned||g.open_amount_missing_count?null:g.open_known_cents,won_cents:unassigned||g.won_amount_missing_count?null:g.won_known_cents,weighted_cents:g.weighted_source_count?g.weighted_known_cents:null,weighted_total_cents:g.open_count>0&&g.weighted_source_count===g.open_count&&!unassigned?g.weighted_known_cents:null,probability_coverage:g.open_count?g.probability_known_count/g.open_count:null,weighted_scope:incomplete||g.probability_missing_count?'PARTIAL_KNOWN_PROBABILITIES':'ALL_OPEN_RECORDS_WITH_PROBABILITY',source_coverage:incomplete?'PARTIAL_SOURCE_RECORDS':'COMPLETE_SOURCE_RECORDS',unassigned_currency_count:unassigned,overflow_fields,accounting_revenue:false,provider_verified:false}];
 }));
 const partial=excluded.length>0||Object.values(currency_groups).some(g=>g.probability_missing_count||g.overflow_fields.length);
 return {currency_groups,sales_summary:{schema_version:2,source_available:available,state:!available?'SOURCE_UNAVAILABLE':!activeCount?'NO_ACTIVE_SOURCES':partial?'PARTIAL':'AVAILABLE',source_record_count:available?rows.length:null,active_record_count:available?activeCount:null,included_record_count:available?included:null,excluded_source_count:available?excluded.length:null,excluded_sources:available?excluded:null,unassigned_currency_count:available?unassigned:null,scope:'ALL_CURRENT_AUTHORIZED_OPPORTUNITIES_NO_DATE_FILTER',accounting_revenue:false,provider_verified:false}};
}
module.exports={summarize};
