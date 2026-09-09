'use strict';
const fail=(code,message,statusCode=422)=>{throw Object.assign(new Error(message),{code,statusCode});};
function allocationProposal(domain,ctx,actor,rfqId,input){
  domain.resolver.assertCapability(ctx,actor,'procurement:sourcing');
  const rfq=domain.get(ctx,actor,'rfqs',rfqId);
  if(['CANCELLED','ARCHIVED'].includes(rfq.status))fail('rfq_closed','De aanvraag is gesloten',409);
  if(!Array.isArray(input)||!input.length||input.length>500)fail('allocation_invalid','Kies één tot vijfhonderd artikelverdelingen');
  const allocated=new Map(),seen=new Set(),bids=new Map();let total=0;
  const allocations=input.map(line=>{
    if(!line||typeof line!=='object'||Array.isArray(line)||Object.keys(line).some(key=>!['bid_id','item_id','quantity'].includes(key))||typeof line.bid_id!=='string'||typeof line.item_id!=='string'||!Number.isSafeInteger(line.quantity)||line.quantity<1)fail('allocation_invalid','Iedere verdeling vereist bieding, artikel en een positief geheel aantal');
    const key=JSON.stringify([line.bid_id,line.item_id]);if(seen.has(key))fail('allocation_duplicate','Voeg aantallen voor dezelfde bieding en hetzelfde artikel samen');seen.add(key);
    const requested=rfq.lines.find(item=>item.item_id===line.item_id);if(!requested)fail('allocation_item_unknown','Dit artikel staat niet in de aanvraag');
    if(!bids.has(line.bid_id))bids.set(line.bid_id,domain.get(ctx,actor,'bids',line.bid_id));const bid=bids.get(line.bid_id);
    if(bid.rfq_id!==rfq.id||bid.rfq_revision!==rfq.revision||bid.currency!==rfq.currency||['CANCELLED','ARCHIVED'].includes(bid.status))fail('allocation_bid_changed','Gebruik een actuele bieding voor deze aanvraag en valuta',409);
    const offered=bid.lines.find(item=>item.item_id===line.item_id);
    if(!offered||line.quantity>offered.quantity||!Number.isSafeInteger(offered.unit_price_cents)||offered.unit_price_cents<0)fail('allocation_quantity_invalid','Gekozen aantal valt buiten deze bieding');
    allocated.set(line.item_id,(allocated.get(line.item_id)||0)+line.quantity);
    const amount=line.quantity*offered.unit_price_cents;total+=amount;if(!Number.isSafeInteger(amount)||!Number.isSafeInteger(total))fail('allocation_total_invalid','Totaal overschrijdt de veilige bedraggrens');
    return {bid_id:bid.id,bid_revision:bid.revision,item_id:line.item_id,quantity:line.quantity,unit_price_cents:offered.unit_price_cents,value_cents:amount,supplier_id:bid.supplier_id,evidence_reference:bid.evidence_reference,...(offered.delivery_days!==undefined?{delivery_days:offered.delivery_days}:{})};
  }).sort((a,b)=>a.item_id.localeCompare(b.item_id)||a.bid_id.localeCompare(b.bid_id));
  if(rfq.lines.some(item=>allocated.get(item.item_id)!==item.quantity))fail('allocation_scope_incomplete','Verdeel de volledige gevraagde aantallen precies één keer; beoordeling geldt voor het gezamenlijke totaal');
  return {rfq_id:rfq.id,rfq_revision:rfq.revision,allocation_kind:'ITEM_SPLIT',allocations:allocations.map(({bid_id,item_id,quantity})=>({bid_id,item_id,quantity})),allocation_lines:allocations,value_cents:total,currency:rfq.currency,title:`Artikelverdeling: ${rfq.title}`};
}
module.exports={allocationProposal};
