'use strict';
const crypto=require('node:crypto'),allocation=require('./procurement-allocations'),incremental=require('./procurement-incremental-allocations');
const hash=v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex'),fail=(code,message,statusCode=422)=>{throw Object.assign(Error(message),{code,statusCode});};
const COSTS=['shipping_cents','tax_cents','fees_cents','handling_cents'];
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v),keys=(v,allowed)=>object(v)&&Object.keys(v).every(k=>allowed.includes(k));
const cents=v=>{if(!Number.isSafeInteger(v)||v<0)fail('procurement_economics_amount_invalid','Gebruik expliciete niet-negatieve gehele centen');return BigInt(v);};
const number=v=>{if(v>BigInt(Number.MAX_SAFE_INTEGER)||v<BigInt(Number.MIN_SAFE_INTEGER))fail('procurement_economics_overflow','Het bedrag overschrijdt de veilige grens');return Number(v);};
function compare(core,ctx,actor,rfqId,input){
 core.scope(ctx,actor);core.resolver.assertCapability(ctx,actor,'procurement:opportunities','read');core.resolver.assertCapability(ctx,actor,'procurement:sourcing','read');
 if(!keys(input,['allocation_mode','scenarios','expected_source_hash'])||!['FULL','INCREMENTAL'].includes(input.allocation_mode)||!Array.isArray(input.scenarios)||!input.scenarios.length||input.scenarios.length>20)fail('procurement_economics_input_invalid','Kies een expliciete scope en maximaal twintig scenario’s');
 const rfq=core.get(ctx,actor,'rfqs',rfqId),sources=new Map(),ids=new Set(),scopeKeys=new Set(),rows=[];
 for(const scenario of input.scenarios){
  if(!keys(scenario,['id','label','allocations','costs','expected_value_cents'])||typeof scenario.id!=='string'||!/^[-A-Za-z0-9_.:]{1,80}$/.test(scenario.id)||ids.has(scenario.id)||typeof scenario.label!=='string'||!scenario.label.trim()||scenario.label.length>200||scenario.costs!==undefined&&!keys(scenario.costs,COSTS))fail('procurement_economics_scenario_invalid','Gebruik unieke scenario’s met expliciete kostenvelden');ids.add(scenario.id);
  let proposal=allocation.allocationProposal(core,ctx,actor,rfqId,scenario.allocations,{partial:input.allocation_mode==='INCREMENTAL'});if(input.allocation_mode==='INCREMENTAL')proposal=incremental.bind(core,ctx,rfq,proposal);
  const scope=new Map();for(const line of proposal.allocation_lines){scope.set(line.item_id,(scope.get(line.item_id)||0)+line.quantity);sources.set(line.bid_id,core.get(ctx,actor,'bids',line.bid_id));}scopeKeys.add(JSON.stringify([...scope].sort(([a],[b])=>a.localeCompare(b))));
  const assumptions=scenario.costs||{},missing=COSTS.filter(k=>!Object.hasOwn(assumptions,k));let known=cents(proposal.value_cents);for(const value of Object.values(assumptions))known+=cents(value);const complete=missing.length===0,landed=complete?number(known):null,value=Object.hasOwn(scenario,'expected_value_cents')?number(cents(scenario.expected_value_cents)):null,margin=landed!==null&&value!==null?number(BigInt(value)-BigInt(landed)):null;
  rows.push({id:scenario.id,label:scenario.label,currency:proposal.currency,recorded_bid_cents:proposal.value_cents,known_cost_components_cents:number(known),landed_cost_cents:landed,expected_value_cents:value,scenario_margin_cents:margin,missing_cost_fields:missing,cost_assumptions:{...assumptions},allocation_lines:proposal.allocation_lines,remaining_lines:proposal.remaining_lines||null,previously_approved_cents:proposal.previously_approved_cents??null,complete_cost_assumptions:complete});
 }
 if(scopeKeys.size!==1)fail('procurement_economics_scope_mismatch','Vergelijk dezelfde artikelen en aantallen in alle scenario’s');
 const prior=input.allocation_mode==='INCREMENTAL'?incremental.approvedBasis(core,ctx,rfq).fingerprint:null,source_hash=hash({rfq,bids:[...sources.values()].sort((a,b)=>a.id.localeCompare(b.id)),prior});
 if(input.expected_source_hash!==undefined&&input.expected_source_hash!==source_hash)fail('procurement_economics_source_changed','De aanvraag, biedingen of eerdere toekenningen zijn gewijzigd',409);
 const complete=rows.every(r=>r.complete_cost_assumptions),minimum=complete?Math.min(...rows.map(r=>r.landed_cost_cents)):null;
 return {rfq_id:rfq.id,rfq_revision:rfq.revision,currency:rfq.currency,source_hash,allocation_mode:input.allocation_mode,scenarios:rows,lowest_assumed_cost_scenario_ids:complete?rows.filter(r=>r.landed_cost_cents===minimum).map(r=>r.id):[],recommendation:complete?'De gemarkeerde scenario’s hebben de laagste kosten binnen de expliciet ingevoerde aannames. Controleer kwaliteit, levering en alle bronkosten vóór een afzonderlijke goedkeuring.':'Vul ontbrekende kosten expliciet in voordat je scenario’s op totale kosten vergelijkt.',basis:'RECORDED_BID_PRICES_AND_EXPLICIT_ASSUMPTIONS',supplier_performance:'UNVERIFIED',provider_verified:false,source_records_modified:false,external_commitment:false,financial_posting_performed:false};
}
function snapshot(core,ctx,actor,rfqId,input,{idempotency_key:key}={}){
 core.scope(ctx,actor,'write');core.resolver.assertCapability(ctx,actor,'procurement:opportunities','write');
 if(!keys(input,['query','expected_source_hash','confirm','reason'])||input.confirm!==true||typeof input.reason!=='string'||!input.reason.trim()||input.reason.length>1000||typeof key!=='string'||!key||key.length>200||!/^[a-f0-9]{64}$/.test(input.expected_source_hash||''))fail('procurement_economics_confirmation_required','Bevestig de actuele scenariovergelijking met een reden');
 core.get(ctx,actor,'rfqs',rfqId);const ops=core.adapter.bucket(ctx,'procurement:idempotency'),fingerprint=hash({operation:'ECONOMICS_SNAPSHOT',rfqId,input}),prior=ops.find(r=>r.actor_id===actor.id&&r.key===key);
 if(prior){if(prior.fingerprint!==fingerprint)fail('procurement_economics_key_conflict','De actie-ID hoort bij andere invoer',409);return {record:core.get(ctx,actor,'economics_snapshots',prior.record_id),deduplicated:true,external_commitment:false};}
 const result=compare(core,ctx,actor,rfqId,input.query);if(result.source_hash!==input.expected_source_hash)fail('procurement_economics_source_changed','De scenariobron is gewijzigd',409);if(core.bucket(ctx,'economics_snapshots').length>=10000)fail('procurement_economics_capacity','De bewaarlimiet voor scenario’s is bereikt',507);
 const saved=core.mutate(ctx,()=>{const now=new Date().toISOString(),row={id:crypto.randomUUID(),owned_entity:'economics_snapshots',owner_id:actor.id,tenant_id:ctx.tenant_id,dealer_id:ctx.dealer_id,rfq_id:rfqId,rfq_revision:result.rfq_revision,source_hash:result.source_hash,comparison:result,comparison_hash:hash(result),reason:input.reason,status:'RECORDED_INTERNAL',revision:1,created_at:now,updated_at:now};core.bucket(ctx,'economics_snapshots').push(row);ops.push({key,actor_id:actor.id,fingerprint,record_id:row.id});core.recordEvent(ctx,actor,'economics_snapshots',row,'created');return {record:JSON.parse(JSON.stringify(row)),deduplicated:false,external_commitment:false};});try{core.flush(ctx,actor);}catch{saved.event_delivery='QUEUED_RETRY';}return saved;
}
function readable(core,ctx,actor,row,options={}){
 if(core.id!=='procurement'||row.owned_entity!=='economics_snapshots')return true;
 const rfq=core.bucket(ctx,'rfqs').find(r=>r.id===row.rfq_id);if(!rfq||!core.visible(rfq,actor)||row.comparison_hash!==hash(row.comparison))return false;
 if(!options.exporting)try{core.resolver.assertCapability(ctx,actor,'procurement:sourcing');}catch(error){if(error.statusCode===403)return false;throw error;}
 return Array.isArray(row.comparison?.scenarios)&&row.comparison.scenarios.every(s=>Array.isArray(s.allocation_lines)&&s.allocation_lines.every(line=>{const bid=core.bucket(ctx,'bids').find(r=>r.id===line.bid_id);return bid&&core.visible(bid,actor);}));
}
module.exports={COSTS,compare,snapshot,readable};
