'use strict';

const L=require('./demo-universe-law'),{amounts}=require('./finance-invoice-amounts');
const DAY=86400000,label=text=>L.LABEL+' '+text,ref=id=>({$ref:id});
const day=(at,offset=0)=>new Date(Date.parse(at)+offset*DAY).toISOString().slice(0,10);
function append(body){
  const original=new Map(body.nodes.map(n=>[n.id,n])),entity=original.get('finance-entity').input,flows=[];
  function action(id,kind,operation,at,values,reason,source,extra=[]){
    const input={operation,values,reason:label(reason)},node={id,kind,contract:'finance.action',module:'finance',entity:operation==='PAYMENT_RECORD'?'payments':'invoices',occurred_at:new Date(at).toISOString(),location_id:source.location_id,persona_id:body.personas[0].id,input,depends_on:[...new Set([...L.references(input),...extra])],provenance:L.provenance(body.scenario_id,id)};
    body.nodes.push(node);return node;
  }
  const candidates=body.industry_id==='ECOMMERCE'
    ?body.nodes.filter(n=>n.kind==='fulfilment'&&Number(n.id.split('-')[1])%10>=1&&Number(n.id.split('-')[1])%10<=5)
    :body.nodes.filter(n=>n.kind==='sale');
  for(const [index,source] of candidates.entries()){
    const suffix=source.id.split('-')[1],created='finance-invoice-'+suffix,posted='finance-post-'+suffix,paid='finance-payment-'+suffix,at=source.occurred_at,number='DEMO-'+body.industry_id.slice(0,4)+'-'+String(index+1).padStart(5,'0');
    let operation,values,gross;
    if(body.industry_id==='ECOMMERCE'){
      const order=original.get('order-'+suffix),product=original.get(order.input.values.lines[0].product_id.$ref),line=order.input.values.lines[0];
      operation='COMMERCE_INVOICE_CREATE';
      values={order_id:ref(source.id),contact_id:order.input.values.customer_reference,legal_entity_id:ref('finance-entity'),invoice_number:number,invoice_date:day(at),supply_date:day(at),due_date:day(at,30)};
      gross=amounts(line.quantity,product.input.values.unit_price_minor,product.input.values.tax_rate_bps/100).gross_cents;
    }else{
      const person=original.get(source.input.related_refs.find(r=>r.entity==='people').id.$ref),vehicle=original.get(source.input.industry_fields.vehicle_id.$ref);
      operation='INVOICE_CREATE';
      values={legal_entity_id:ref('finance-entity'),kind:'SALES',currency:'EUR',invoice_number:number,invoice_date:day(at),supply_date:day(at),due_date:day(at,30),supplier_name:entity.name,supplier_address:entity.address,supplier_vat_id:entity.vat_id,supplier_kvk_number:entity.kvk_number,customer_name:person.input.name,customer_address:person.input.billing_address,
        lines:[{description:vehicle.input.name,quantity:1,unit_price_cents:source.input.value_cents,vat_rate:21}],
        demo_source:{classification:'SYNTHETIC_DEMO',authority:'CONFIRMED_SCENARIO_INPUT',sale_id:ref(source.id),person_id:ref(person.id),vehicle_id:ref(vehicle.id),amount_authority:'FICTIONAL_NET_SALE_AMOUNT',tax_authority:'EXPLICIT_SCENARIO_RATE_NOT_TAX_ADVICE'}};
      gross=amounts(1,source.input.value_cents,21).gross_cents;
    }
    action(created,'finance_invoice',operation,at,values,'Create the confirmed fictional customer invoice. Native source IDs and actual audit time remain separate from scenario dates.',source);
    const state=index%5,flow={invoice:created,source:source.id,status:state===0?'DRAFT':state===1?'POSTED':state===2?'PARTIALLY_PAID':'PAID',gross_cents:gross,paid_cents:0};
    if(state>0){
      const year=day(at).slice(0,4);
      action(posted,'finance_posting','INVOICE_POST',at,{invoice_id:ref(created)},'Post this fictional invoice through the native balanced journal and open fiscal period.',source,['finance-period-'+year,'finance-account-1300','finance-account-8000','finance-account-1521']);flow.posting=posted;
      if(state>1){
        const paymentDate=day(at,7),payment=state===2?Math.floor(gross/2):gross;
        action(paid,'finance_payment','PAYMENT_RECORD',paymentDate,{invoice_id:ref(posted),amount_cents:payment,currency:'EUR',date:paymentDate,reference:label('Fictional internal receipt '+number+'; no bank settlement')},'Record only the synthetic internal payment booking. No bank transfer, provider settlement or reconciliation is performed.',source,['finance-period-'+paymentDate.slice(0,4),'finance-account-1000','finance-account-1300']);flow.payment=paid;flow.paid_cents=payment;
      }
    }
    flows.push(flow);
  }
  const counts=Object.fromEntries(['DRAFT','POSTED','PARTIALLY_PAID','PAID'].map(status=>[status,flows.filter(f=>f.status===status).length]));
  const sources=flows.flatMap(f=>[f.invoice,...(f.posting?[f.posting]:[]),...(f.payment?[f.payment]:[])]);
  body.scenarios.push({id:'native-financial-sales-history',kind:'NORMAL',description:label('Inspect native invoices, open balances and balanced journals across the fictional history. Internal payment bookings are not external bank evidence; unbilled orders and returns remain separate.'),source_ids:sources,expectations:{invoice_count:flows.length,status_counts:counts,payment_count:flows.filter(f=>f.payment).length,journal_count:flows.filter(f=>f.posting).length+flows.filter(f=>f.payment).length,external_payment_performed:false,bank_settlement_verified:false,complete_purchase_credit_refund_history:false}});
  for(const [status,kind]of [['POSTED','ANOMALY'],['PARTIALLY_PAID','ANOMALY'],['PAID','NORMAL']]){
    const flow=flows.find(f=>f.status===status);if(!flow)continue;
    body.scenarios.push({id:'native-finance-'+status.toLowerCase().replaceAll('_','-'),kind,description:label('Trace '+status+' from its native invoice and exact ledger balance; independently inspect current records.'),source_ids:[flow.source,flow.invoice,...(flow.posting?[flow.posting]:[]),...(flow.payment?[flow.payment]:[])],expectations:{status,gross_cents:flow.gross_cents,paid_cents:flow.paid_cents,outstanding_cents:flow.gross_cents-flow.paid_cents,external_payment_performed:false}});
  }
  return body;
}
module.exports={append};
