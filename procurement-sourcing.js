'use strict';
// Owned procurement records only. No supplier transport or inferred provider access.
const fail=(code,message,statusCode=422)=>{throw Object.assign(new Error(message),{code,statusCode});};
function lines(value,bid=false){
  if(!Array.isArray(value)||!value.length||value.length>100)fail('sourcing_lines_invalid','Gebruik één tot honderd regels');
  const ids=new Set();
  for(const line of value){
    if(!line||typeof line!=='object'||Object.keys(line).some(key=>!(bid?['item_id','quantity','unit_price_cents','delivery_days']:['item_id','description','quantity']).includes(key)))fail('sourcing_line_invalid','Niet-ondersteunde regelvelden');
    if(!/^[A-Za-z0-9_-]{1,80}$/.test(line.item_id||'')||ids.has(line.item_id)||!Number.isSafeInteger(line.quantity)||line.quantity<1||line.quantity>1000000)fail('sourcing_line_invalid','Regels vereisen unieke artikelcodes en positieve gehele aantallen');
    ids.add(line.item_id);
    if(bid){if(!Number.isSafeInteger(line.unit_price_cents)||line.unit_price_cents<0||!Number.isSafeInteger(line.quantity*line.unit_price_cents))fail('sourcing_price_invalid','Ongeldige prijs in gehele centen');if(line.delivery_days!==undefined&&(!Number.isInteger(line.delivery_days)||line.delivery_days<0||line.delivery_days>3650))fail('sourcing_delivery_invalid','Ongeldige levertijd');}
    else if(typeof line.description!=='string'||!line.description.trim()||line.description.length>1000)fail('sourcing_description_required','Omschrijf ieder gevraagd artikel');
  }
}
function validateSourcing(domain,ctx,actor,entity,value){
  if(!['rfqs','bids'].includes(entity))return;
  if(!['DRAFT','OPEN','CANCELLED','ARCHIVED'].includes(value.status||'DRAFT'))fail('sourcing_status_invalid','Gebruik Concept, Open, Geannuleerd of Gearchiveerd');
  if(!/^[A-Z]{3}$/.test(value.currency||''))fail('sourcing_currency_required','Valuta is verplicht');
  lines(value.lines,entity==='bids');
  value.delivery_state=entity==='rfqs'?'NOT_SENT':'MANUALLY_RECORDED_UNVERIFIED';
  if(entity==='rfqs')return;
  const rfq=domain.get(ctx,actor,'rfqs',value.rfq_id);domain.get(ctx,actor,'suppliers',value.supplier_id);
  if(['CANCELLED','ARCHIVED'].includes(rfq.status))fail('rfq_closed','Deze aanvraag is gesloten',409);
  if(value.rfq_revision!==rfq.revision)fail('rfq_revision_conflict','De aanvraag is gewijzigd; beoordeel de nieuwe revisie',409);
  if(value.currency!==rfq.currency)fail('bid_currency_mismatch','Bieding moet dezelfde valuta als de aanvraag gebruiken');
  for(const line of value.lines){const requested=rfq.lines.find(item=>item.item_id===line.item_id);if(!requested||line.quantity!==requested.quantity)fail('bid_scope_mismatch','Artikel en hoeveelheid moeten overeenkomen met de aanvraag');}
  if(typeof value.evidence_reference!=='string'||!value.evidence_reference.trim()||value.evidence_reference.length>1000)fail('bid_evidence_required','Leg de herkomst van de ontvangen bieding vast');
}
function compareBids(domain,ctx,actor,id){
  domain.resolver.assertCapability(ctx,actor,'procurement:sourcing');
  const rfq=domain.get(ctx,actor,'rfqs',id),rows=domain.bucket(ctx,'bids').filter(row=>row.rfq_id===id&&domain.visible(row,actor)&&!['CANCELLED','ARCHIVED'].includes(row.status));
  if(rows.length>500)fail('bid_comparison_limit','Maximaal vijfhonderd actieve biedingen per aanvraag');
  const items=rows.map(row=>{
    const reasons=[];
    if(row.rfq_revision!==rfq.revision)reasons.push('RFQ_REVISION_CHANGED');
    if(row.currency!==rfq.currency)reasons.push('CURRENCY_MISMATCH');
    if(!rfq.lines.every(item=>row.lines?.some(line=>line.item_id===item.item_id&&line.quantity===item.quantity)))reasons.push('INCOMPLETE_SCOPE');
    const total=(row.lines||[]).reduce((sum,line)=>sum+line.quantity*line.unit_price_cents,0);
    if(!Number.isSafeInteger(total))reasons.push('TOTAL_OUT_OF_RANGE');
    const delivery=(row.lines||[]).map(line=>line.delivery_days),completeDelivery=delivery.length>0&&delivery.every(Number.isInteger);
    return {id:row.id,title:row.title,supplier_id:row.supplier_id,revision:row.revision,rfq_revision:row.rfq_revision,currency:row.currency,comparable:!reasons.length,reasons,total_cents:reasons.length?null:total,delivery_days:completeDelivery?Math.max(...delivery):null,lines:row.lines,evidence_reference:row.evidence_reference,provenance:row.provenance};
  });
  const eligible=items.filter(row=>row.comparable).sort((a,b)=>a.total_cents-b.total_cents||a.id.localeCompare(b.id));
  for(const row of eligible){row.price_rank=1+eligible.filter(other=>other.total_cents<row.total_cents).length;row.difference_from_lowest_cents=row.total_cents-eligible[0].total_cents;}
  return {rfq_id:rfq.id,rfq_revision:rfq.revision,title:rfq.title,currency:rfq.currency,items:[...eligible,...items.filter(row=>!row.comparable)],comparable_count:eligible.length,comparison_basis:'RECORDED_FULL_SCOPE_PRICES_ONLY',tax_shipping_basis:'AS_RECORDED_NOT_INDEPENDENTLY_VERIFIED',provider_verified:false,external_commitment:false,observed_at:new Date().toISOString()};
}
module.exports={validateSourcing,compareBids};
