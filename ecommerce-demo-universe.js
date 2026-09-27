'use strict';

const L=require('./demo-universe-law');
const references=require('./public-data/ecommerce/2026-09-26/demo-reference-selection.json');
const DAY=86400000,label=text=>L.LABEL+' '+text,ref=id=>({$ref:id});
function build({seed,as_of,product_count=120,order_count=360,customer_count=300,history_months=18}={}){
  if(typeof seed!=='string'||!/^[A-Za-z0-9_.:-]{1,120}$/.test(seed)||typeof as_of!=='string'||!Number.isFinite(Date.parse(as_of))||new Date(as_of).toISOString()!==as_of||!Number.isSafeInteger(product_count)||product_count<12||product_count>240||!Number.isSafeInteger(order_count)||order_count<12||order_count>1000||!Number.isSafeInteger(customer_count)||customer_count<12||customer_count>1000||!Number.isSafeInteger(history_months)||history_months<12||history_months>24)throw Object.assign(Error('ecommerce_demo_options_invalid'),{code:'ecommerce_demo_options_invalid',statusCode:422});
  if(references.schema_version!=='foundly-demo-product-reference-selection/1'||references.items.length<product_count)throw Error('ecommerce_demo_reference_selection_invalid');
  const end=Date.parse(as_of),begin=new Date(end);begin.setUTCMonth(begin.getUTCMonth()-history_months);const start=begin.getTime(),days=Math.floor((end-start)/DAY),stamp=n=>new Date(start+n*DAY).toISOString();
  const scenario_id='ecommerce-'+L.hash({seed,as_of,product_count,order_count,customer_count,history_months}).slice(0,24),prefix='demo-'+L.hash(scenario_id).slice(0,12),n=(tag,max)=>parseInt(L.hash({seed,tag}).slice(0,8),16)%max;
  const locations=[['Nederland','NL','Europe/Amsterdam'],['België','BE','Europe/Brussels'],['Duitsland','DE','Europe/Berlin']].map(([name,country,timezone],i)=>({id:'location-'+i,name:label('Commerce '+name),country,timezone,classification:'SYNTHETIC_DEMO'}));
  const personas=['MANAGER','SALES','ACCOUNTANT','MARKETING','VIEWER','FINANCE_ADMIN','SALES','MANAGER','VIEWER'].map((role,i)=>({id:'persona-'+i,name:label('Commerce '+role+' '+(i+1)),role,location_id:locations[i%3].id,classification:'SYNTHETIC_DEMO'}));
  const nodes=[],node=(id,kind,contract,module,entity,day,input,extra={})=>{
    const row={id,kind,contract,module,entity,occurred_at:stamp(day),location_id:extra.location_id||locations[0].id,persona_id:extra.persona_id||personas[0].id,input,depends_on:[...new Set([...L.references(input),...(extra.depends_on||[])])],provenance:L.provenance(scenario_id,id)};nodes.push(row);return row;
  };
  const action=(id,kind,entity,day,operation,values,reason,extra)=>node(id,kind,'commerce.action','sales',entity,day,{operation,values,reason:label(reason)},extra);
  node('company','company','crm.create','crm','companies',0,{name:label('Foundly Commerce Group'),country:'NL',description:label('Fictional merchant. Public product references are separate from invented merchant prices, stock and transactions.')});
  for(const location of locations)node(location.id,'location','crm.create','crm','companies',0,{name:location.name,parent_company_id:ref('company'),country:location.country,timezone:location.timezone},{location_id:location.id});
  for(const persona of personas)node(persona.id,'identity','identity.invite','identity','members',0,{username:scenario_id+'.'+persona.id+'.demo',display_name:persona.name,roles:[persona.role],permissions:[],team_ids:[persona.location_id],confirm:true,reason:label('Isolated role-bound invitation; normal enrollment is required.')},{location_id:persona.location_id,persona_id:persona.id});
  for(let i=0;i<12;i++)node('supplier-'+i,'supplier','domain.create','procurement','suppliers',0,{name:label('Commerce supplier '+(i+1)),description:label('Fictional supplier; not the manufacturer or public reference contributor.')});
  for(let i=0;i<18;i++){
    node('campaign-'+i,'campaign','domain.create','marketing','campaigns',0,{title:label('Commerce campaign '+(i+1)),status:'DRAFT',budget_cents:60000+n('budget-'+i,100000),currency:'EUR',description:label('Synthetic campaign scenario; not published to an external platform.'),industry_fields:{sales_channel:['Web','Marketplace','Email'][i%3],campaign_reference:scenario_id+'-'+i}});
    node('crm-campaign-'+i,'crm_campaign','crm.create','crm','campaigns',0,{name:label('Commerce campaign '+(i+1)),marketing_campaign_id:ref('campaign-'+i),description:label('CRM attribution source linked to the separate Marketing campaign.')});
  }
  for(const location of locations)node('calendar-'+location.id,'calendar','domain.create','calendar','calendars',0,{name:location.name+' agenda',timezone:location.timezone},{location_id:location.id});
  const products=[];
  for(let i=0;i<product_count;i++){
    const source=references.items[i],price=499+n('price-'+i,5000),stock=Math.ceil(order_count/product_count)*4+30;
    products.push({id:'product-'+i,native_id:prefix+'-product-'+i,price,stock,revision:2,on_hand:stock,reserved:0,quarantined:0,sources:['product-'+i,'stock-'+i]});
    action('product-'+i,'product','commerce_products',0,'PRODUCT_SAVE',{product_id:products[i].native_id,sku:prefix.toUpperCase()+'-'+String(i+1).padStart(4,'0'),name:label(source.product_name+' · merchant scenario '+(i+1)),gtin:source.code,currency:'EUR',unit_price_minor:price,tax_rate_bps:2100,expected_revision:0,attributes:{public_reference_id:source.reference_id,public_snapshot_date:'2026-09-26',price_authority:'SYNTHETIC_MERCHANT_PRICE',tax_authority:'EXPLICIT_SCENARIO_RATE_NOT_TAX_ADVICE'}},'Create scenario article from a separately attributed public contributor reference. Price, tax and stock are fictional.');
    action('stock-'+i,'stock_receipt','commerce_inventory',0,'STOCK_RECEIVE',{product_id:ref('product-'+i),expected_product_revision:1,expected_revision:1,quantity:stock,evidence_reference:label('Fictional opening inventory; no physical receipt or supplier invoice.')},'Record the fictional opening inventory.');
  }
  for(let i=0;i<customer_count;i++)node('customer-'+i,'customer','crm.create','crm','contacts',0,{name:label('Commerce customer '+String(i+1).padStart(4,'0')),email:'commerce'+(i+1)+'@example.test',billing_address:label('Fictional billing address '+(i+1)),country:locations[i%3].country,company_id:ref('company'),description:label('Invented contact and billing address; no real person or external contact.')},{location_id:locations[i%3].id});
  const orderDay=i=>2+Math.floor(i/order_count*(days-12));
  for(let i=0;i<order_count*2;i++){
    const day=orderDay(i%order_count)-1,product=i%product_count,customer=i%customer_count;
    node('lead-'+i,'lead','crm.create','crm','leads',day,{name:label('Commerce enquiry '+(i+1)),contact_id:ref('customer-'+customer),campaign_id:ref('crm-campaign-'+i%18),status:i%5===0?'OPEN':'QUALIFIED',source:'SYNTHETIC_DEMO',occurred_at:stamp(day),related_refs:[{module:'sales',entity:'commerce_products',id:ref('product-'+product)}],description:label('Synthetic enquiry; not a completed order, sale or payment.')});
    for(let j=0;j<2;j++)node('interaction-'+i+'-'+j,'interaction','crm.create','crm','activities',day,{title:label('Commerce contact history '+(i+1)+'-'+j),type:j?'EMAIL':'CALL',contact_id:ref('customer-'+customer),lead_id:ref('lead-'+i),occurred_at:stamp(day),description:label('Fictional interaction history; no email or telephone call performed.')});
  }
  let fulfilledNet=0,returnedNet=0;const fulfilledIds=[],returnIds=[];
  for(let i=0;i<order_count;i++){
    const product=products[i%product_count],quantity=2+i%3,day=orderDay(i),order=prefix+'-order-'+i;
    action('order-'+i,'order','commerce_orders',day,'ORDER_RESERVE',{order_id:order,currency:'EUR',customer_reference:ref('customer-'+i%customer_count),expected_revision:0,lines:[{product_id:ref(product.id),quantity,expected_product_revision:1,expected_inventory_revision:product.revision}]},'Reserve fictional stock for the referenced native CRM contact; financial linkage is a separate confirmed action.',{depends_on:['lead-'+i]});
    product.revision++;product.reserved+=quantity;product.sources.push('order-'+i);
    // Stable caller-selected order IDs are part of the exact confirmed input.
    // Mutable order snapshots are not reused as immutable dependency evidence.
    if(i%10<7){
      action('fulfil-'+i,'fulfilment','commerce_orders',day+1,'ORDER_FULFILL',{order_id:order,expected_revision:1,evidence_reference:label('Fictional fulfilment '+stamp(day+1)+'; no carrier dispatch.')},'Record the synthetic fulfilment; no external shipment is performed.');
      product.revision++;product.on_hand-=quantity;product.reserved-=quantity;fulfilledNet+=product.price*quantity;fulfilledIds.push('fulfil-'+i);product.sources.push('fulfil-'+i);
      if(i%10===0){
        const disposition=i%20?'QUARANTINE':'RESTOCK';
        action('return-'+i,'return','commerce_orders',day+3,'ORDER_RETURN',{order_id:order,expected_revision:2,lines:[{product_id:ref(product.id),quantity:1,disposition}],evidence_reference:label('Fictional return '+stamp(day+3)+'; no refund recorded.')},'Record one synthetic returned unit; financial correction remains separate.');
        product.revision++;product[disposition==='RESTOCK'?'on_hand':'quarantined']++;returnedNet+=product.price;returnIds.push('return-'+i);product.sources.push('return-'+i);
      }
    }else if(i%10===7){
      action('cancel-'+i,'cancellation','commerce_orders',day+1,'ORDER_CANCEL',{order_id:order,expected_revision:1},'Cancel the unbilled scenario order and release its reservation.');product.revision++;product.reserved-=quantity;product.sources.push('cancel-'+i);
    }
  }
  for(let i=0;i<Math.min(60,order_count);i++)node('purchase-'+i,'purchase','domain.create','procurement','opportunities',0,{title:label('Replenishment proposal '+(i+1)),supplier_id:ref('supplier-'+i%12),value_cents:20000+n('purchase-'+i,40000),currency:'EUR',status:'QUALIFIED',industry_fields:{supplier_sku:products[i%product_count].native_id,purchase_channel:'Synthetic supplier scenario'},description:label('Internal hypothetical replenishment; not a committed purchase, invoice or receipt.')});
  for(let i=0;i<Math.min(30,order_count);i++){
    const location=locations[i%3],day=orderDay(i),time=start+day*DAY+(9+i%6)*3600000;
    node('meeting-'+i,'meeting','domain.create','calendar','events',day,{title:label('Commerce support appointment '+(i+1)),calendar_id:ref('calendar-'+location.id),start_at:new Date(time).toISOString(),end_at:new Date(time+1800000).toISOString(),timezone:location.timezone,participants:['commerce'+(i%customer_count+1)+'@example.test'],description:label('Fictional support appointment without external invitation.')},{location_id:location.id});
    node('draft-'+i,'communication_draft','domain.create','communication','drafts',day,{title:label('Order support draft '+(i+1)),content:label('Prepared fictional order assistance; nothing has been sent.'),to:['commerce'+(i%customer_count+1)+'@example.test'],cc:[],industry_fields:{commerce_order_reference:prefix+'-order-'+i}});
  }
  for(let i=0;i<6;i++)node('template-'+i,'communication_template','domain.create','communication','templates',0,{title:label('Commerce template '+(i+1)),content:label('Fictional support response; sending requires separate explicit confirmation.')});
  node('context-policy','zero_context','memory.create','knowledge','memories',days,{layer:'ORGANIZATION',key:scenario_id+'-provenance',text:label('The merchant, contacts, prices, stock and order history are synthetic. Product GTINs point to dated public contributor references with attribution; these are not merchant prices, live stock or independently verified specifications. Read current native records for actions. Fulfilment is not accounting revenue. Returns are not refunds. Only eligible fulfilled orders receive confirmed native CRM/Finance invoices. Other orders and returns need separate billing or correction. Internal payment entries are not bank settlements. Scenario time '+as_of+' is separate from native audit time.'),roles:[...new Set(personas.map(p=>p.role)),'ADMIN','FOUNDER','SUPER_ADMIN'],capabilities:[],sensitivity:'INTERNAL',confidence:null});
  const scenarios=[
    {id:'commerce-order-chain',kind:'NORMAL',description:label('Trace actual article, stock, CRM contact and native reserved/fulfilled order.'),source_ids:['product-0','stock-0','customer-0','lead-0','order-0','fulfil-0','return-0'],expectations:{external_dispatch:false,payment_verified:false,financial_status:'UNPOSTED'}},
    {id:'partial-return',kind:'ANOMALY',description:label('One returned unit reduces stock exposure; it does not issue a credit or refund.'),source_ids:['order-0','fulfil-0','return-0'],expectations:{returned_quantity:1,refund_recorded:false}},
    {id:'cancel-unbilled',kind:'NORMAL',description:label('An unbilled cancelled order releases its exact reserved quantity.'),source_ids:['order-7','cancel-7'],expectations:{status:'CANCELLED',invoice_id:null}},
    {id:'missing-provider',kind:'OPERATIONAL_FAILURE',description:label('Public product references and synthetic orders never establish marketplace or payment-provider access.'),source_ids:['product-0','order-0'],expectations:{provider_connected:false}},
    {id:'native-stock-conservation',kind:'NORMAL',description:label('Reconcile receipts, fulfilments, reservations and dispositions in the actual native inventory ledger.'),source_ids:products[0].sources,expectations:{product_id:ref('product-0'),on_hand:products[0].on_hand,reserved:products[0].reserved,quarantined:products[0].quarantined,available:products[0].on_hand-products[0].reserved}}
  ];
  return L.seal(require('./demo-finance-purchases').append(require('./demo-finance-transactions').append(require('./demo-finance-foundation').append({schema_version:L.VERSION,scenario_id,seed,as_of,history_start:stamp(0),industry_id:'ECOMMERCE',company:{name:label('Foundly Commerce Group'),classification:'SYNTHETIC_DEMO'},locations,personas,nodes,scenarios,derived:[{id:'synthetic-fulfilled-net',classification:'DERIVED_ESTIMATED',metric:'fulfilled_order_net_minor',value:fulfilledNet,currency:'EUR',period_start:stamp(0),period_end:as_of,source_ids:fulfilledIds,formula:'SUM(native fulfilled order net amounts before returns); not recognized revenue or received cash'},{id:'synthetic-returned-net',classification:'DERIVED_ESTIMATED',metric:'returned_order_net_minor',value:returnedNet,currency:'EUR',period_start:stamp(0),period_end:as_of,source_ids:returnIds,formula:'SUM(native returned unit net amounts); not issued credits or refunds'}]})),history_months));
}
module.exports={build};
