'use strict';

const L=require('./demo-universe-law'),{amounts}=require('./finance-invoice-amounts');
const DAY=86400000,label=text=>L.LABEL+' '+text,ref=id=>({$ref:id});
const day=(at,offset=0)=>new Date(Date.parse(at)+offset*DAY).toISOString().slice(0,10);
// Separate fictional operating expenses. Neither replenishment proposals nor
// opening inventory are converted into committed purchases or inventory cost.
function append(body,months){
  const entity=body.nodes.find(n=>n.id==='finance-entity').input,suppliers=body.nodes.filter(n=>n.kind==='supplier');
  const first=new Date(body.history_start),last=new Date(body.as_of),flows=[];
  function action(id,kind,operation,at,values,reason,location,extra=[]){
    const input={operation,values,reason:label(reason)};
    body.nodes.push({id,kind,contract:'finance.action',module:'finance',entity:'invoices',occurred_at:new Date(at).toISOString(),location_id:location,persona_id:body.personas[0].id,input,depends_on:[...new Set([...L.references(input),...extra])],provenance:L.provenance(body.scenario_id,id)});
  }
  for(let index=0;index<months;index++){
    // Evenly spaced monthly examples leave room for the separate payment date.
    const at=new Date(first.getTime()+Math.floor((index+0.5)/months*((last-first)/DAY-8))*DAY).toISOString(),supplier=suppliers[index%suppliers.length],location=body.locations[index%body.locations.length].id;
    const suffix='m'+String(index+1).padStart(2,'0'),draft='finance-cost-draft-'+suffix,approve='finance-cost-approve-'+suffix,post='finance-cost-post-'+suffix,payment='finance-cost-payment-'+suffix;
    const number='DEMO-COST-'+body.industry_id.slice(0,4)+'-'+suffix.toUpperCase(),net=12000+parseInt(L.hash({seed:body.seed,expense:index}).slice(0,8),16)%38000,gross=amounts(1,net,21).gross_cents,state=index%5;
    const values={legal_entity_id:ref('finance-entity'),kind:'PURCHASE',currency:'EUR',invoice_number:number,invoice_date:day(at),supply_date:day(at),due_date:day(at,14),supplier_name:supplier.input.name,supplier_address:label('Fictional supplier billing address '+(index%suppliers.length+1)),supplier_vat_id:'DEMO-NOT-REGISTERED',supplier_kvk_number:'DEMO-NOT-REGISTERED',customer_name:entity.name,customer_address:entity.address,
      lines:[{description:label(['Office services','Software services','Cleaning services'][index%3]+' · fictional completed service'),quantity:1,unit_price_cents:net,vat_rate:21}],
      demo_source:{classification:'SYNTHETIC_DEMO',authority:'CONFIRMED_SCENARIO_INPUT',supplier_id:ref(supplier.id),expense_kind:'OPERATING_SERVICE',amount_authority:'FICTIONAL_NET_EXPENSE_AMOUNT',tax_authority:'EXPLICIT_SCENARIO_RATE_NOT_TAX_ADVICE',procurement_commitment_created:false,inventory_valuation_performed:false}};
    action(draft,'finance_purchase_invoice','INVOICE_CREATE',at,values,'Create the separate fictional operating-service invoice. No procurement proposal is committed and no inventory value or cost of goods sold is booked.',location);
    const flow={draft,approval_status:state===0?'PENDING':'APPROVED',status:state<2?'DRAFT':state===2?'POSTED':state===3?'PARTIALLY_PAID':'PAID',gross_cents:gross,paid_cents:0};
    if(state>0){
      action(approve,'finance_purchase_approval','INVOICE_APPROVE',at,{invoice_id:ref(draft)},'Explicitly approve the exact fictional supplier invoice and its current lines. Actual authenticated actor and audit time are retained; this approval does not post or pay.',location);flow.approve=approve;
    }
    if(state>1){
      action(post,'finance_purchase_posting','INVOICE_POST',at,{invoice_id:ref(approve)},'Post the approved fictional operating expense through the native expense, input-tax and payable accounts.',location,['finance-period-'+day(at).slice(0,4),'finance-account-4000','finance-account-1520','finance-account-1600']);flow.post=post;
      if(state>2){
        const paid=state===3?Math.floor(gross/2):gross,date=day(at,7);
        action(payment,'finance_purchase_payment','PAYMENT_RECORD',date,{invoice_id:ref(post),amount_cents:paid,currency:'EUR',date,reference:label('Fictional outgoing internal payment '+number+'; no bank settlement')},'Record only the fictional outgoing internal payment against the payable. No bank transfer or verified external settlement is performed.',location,['finance-period-'+date.slice(0,4),'finance-account-1000','finance-account-1600']);flow.payment=payment;flow.paid_cents=paid;
      }
    }
    flows.push(flow);
  }
  body.scenarios.push({id:'native-financial-purchase-history',kind:'NORMAL',description:label('Trace separate operating-service purchase invoices from pending approval through approved draft, posted payable and outgoing internal payment. These are not vehicle acquisition, stock valuation, purchase credits or verified bank transactions.'),source_ids:flows.flatMap(f=>[f.draft,...(f.approve?[f.approve]:[]),...(f.post?[f.post]:[]),...(f.payment?[f.payment]:[])]),expectations:{purchase_invoice_count:flows.length,pending_approval_count:flows.filter(f=>!f.approve).length,approved_draft_count:flows.filter(f=>f.approve&&!f.post).length,posted_invoice_count:flows.filter(f=>f.post).length,outgoing_payment_count:flows.filter(f=>f.payment).length,journal_count:flows.filter(f=>f.post).length+flows.filter(f=>f.payment).length,purchase_status_counts:Object.fromEntries(['DRAFT','POSTED','PARTIALLY_PAID','PAID'].map(status=>[status,flows.filter(f=>f.status===status).length])),posted_expense_gross_cents:flows.filter(f=>f.post).reduce((n,f)=>n+f.gross_cents,0),paid_cents:flows.reduce((n,f)=>n+f.paid_cents,0),outstanding_posted_cents:flows.filter(f=>f.post).reduce((n,f)=>n+f.gross_cents-f.paid_cents,0),external_payment_performed:false,bank_settlement_verified:false,inventory_valuation_performed:false,procurement_commitment_created:false,purchase_credit_history_complete:false}});
  return body;
}
module.exports={append};
