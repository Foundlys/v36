'use strict';
const crypto=require('node:crypto'),hash=v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex'),fail=(code,message,statusCode=409)=>{throw Object.assign(Error(message),{code,statusCode});};
function approvedBasis(domain,ctx,rfq){
 const rows=domain.bucket(ctx,'awards').filter(r=>r.rfq_id===rfq.id&&r.status==='APPROVED_INTERNAL').sort((a,b)=>a.id.localeCompare(b.id));
 if(rows.length>1000)fail('incremental_award_capacity','De volledige toekenningsgeschiedenis overschrijdt de controlelimiet',413);
 let value=0n;const items=new Map(),offers=new Map();
 for(const row of rows){
  if(row.currency!==rfq.currency||!Number.isSafeInteger(row.value_cents)||row.value_cents<0)fail('incremental_prior_award_invalid','Eerdere toekenning heeft geen vergelijkbaar exact bedrag');
  const lines=row.allocation_lines||row.bid_lines;if(!Array.isArray(lines)||!lines.length)fail('incremental_prior_scope_unknown','De eerdere toekenning heeft geen volledige bewaarde artikelbasis');let lineValue=0n;
  for(const line of lines){const bidId=line.bid_id||row.bid_id;if(!bidId||!rfq.lines.some(r=>r.item_id===line.item_id)||!Number.isSafeInteger(line.quantity)||line.quantity<1||!Number.isSafeInteger(line.unit_price_cents)||line.unit_price_cents<0)fail('incremental_prior_scope_invalid','De huidige aanvraag moet de reeds toegewezen artikelen en exacte aantallen behouden');const key=JSON.stringify([bidId,line.item_id]);items.set(line.item_id,(items.get(line.item_id)||0n)+BigInt(line.quantity));offers.set(key,(offers.get(key)||0n)+BigInt(line.quantity));lineValue+=BigInt(line.quantity)*BigInt(line.unit_price_cents);}
  if(lineValue!==BigInt(row.value_cents))fail('incremental_prior_total_invalid','De eerdere artikelsom wijkt af van het bewaarde goedkeuringsbedrag');value+=lineValue;
 }
 if(value>BigInt(Number.MAX_SAFE_INTEGER)||rfq.lines.some(line=>(items.get(line.item_id)||0n)>BigInt(line.quantity)))fail('incremental_prior_capacity_invalid','Eerdere toekenningen overschrijden de huidige aanvraag of veilige bedraggrens');
 return {rows,items,offers,value:Number(value),fingerprint:hash(rows)};
}
function bind(domain,ctx,rfq,proposal){
 const prior=approvedBasis(domain,ctx,rfq),selected=new Map();
 for(const line of proposal.allocation_lines){selected.set(line.item_id,(selected.get(line.item_id)||0n)+BigInt(line.quantity));const bid=domain.bucket(ctx,'bids').find(b=>b.id===line.bid_id),offered=bid?.lines.find(l=>l.item_id===line.item_id);if(!offered||(prior.offers.get(JSON.stringify([line.bid_id,line.item_id]))||0n)+BigInt(line.quantity)>BigInt(offered.quantity))fail('incremental_bid_quantity_exceeded','Dit aanbod is gedeeltelijk al toegewezen');}
 const remaining=rfq.lines.map(line=>{const quantity=BigInt(line.quantity)-(prior.items.get(line.item_id)||0n)-(selected.get(line.item_id)||0n);if(quantity<0n)fail('incremental_rfq_quantity_exceeded','De verdeling overschrijdt het nog beschikbare aantal');return {item_id:line.item_id,requested_quantity:line.quantity,previously_approved_quantity:Number(prior.items.get(line.item_id)||0n),selected_quantity:Number(selected.get(line.item_id)||0n),remaining_quantity:Number(quantity)};});
 const total=BigInt(prior.value)+BigInt(proposal.value_cents);if(total>BigInt(Number.MAX_SAFE_INTEGER))fail('incremental_total_overflow','Het gezamenlijke bedrag overschrijdt de veilige grens');
 return {...proposal,allocation_kind:'ITEM_INCREMENTAL',previously_approved_cents:prior.value,approval_basis_cents:Number(total),prior_approved_count:prior.rows.length,prior_approved_fingerprint:prior.fingerprint,remaining_lines:remaining,request_fully_allocated:remaining.every(l=>l.remaining_quantity===0)};
}
function preview(domain,ctx,actor,rfqId,allocations){
 domain.scope(ctx,actor);domain.resolver.assertCapability(ctx,actor,'procurement:approvals');
 const rfq=domain.get(ctx,actor,'rfqs',rfqId),proposal=require('./procurement-allocations').allocationProposal(domain,ctx,actor,rfqId,allocations,{partial:true}),bound=bind(domain,ctx,rfq,proposal),policy=require('./procurement-reviews').mandatoryPolicy(domain,ctx,bound.currency,bound.approval_basis_cents);
 if(!policy)fail('approval_policy_required','Configureer een actief beleid voor het cumulatieve bedrag');
 const data={...bound,policy_id:policy.id,policy_revision:policy.revision,approval_steps:policy.approval_steps,allow_self_approval:policy.allow_self_approval===true};return {...data,preview_fingerprint:hash(data),external_commitment:false,provider_verified:false};
}
function current(domain,ctx,row){
 const rfq=domain.bucket(ctx,'rfqs').find(r=>r.id===row.rfq_id);if(!rfq||rfq.revision!==row.rfq_revision||['CANCELLED','ARCHIVED'].includes(rfq.status))return false;
 try{const proposal=require('./procurement-allocations').allocationFromRecords(rfq,id=>domain.bucket(ctx,'bids').find(b=>b.id===id),row.allocations,{partial:true}),bound=bind(domain,ctx,rfq,proposal);return hash(bound)===hash(Object.fromEntries(Object.keys(bound).map(k=>[k,row[k]])));}catch{return false;}
}
module.exports={approvedBasis,bind,preview,current};
