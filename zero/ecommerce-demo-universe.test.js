'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),L=require('../demo-universe-law'),E=require('../ecommerce-demo-universe'),A=require('../automotive-demo-universe');
const {fixture,reserve,advance}=require('../zero-evaluation/demo-universe-fixture'),{SCOPE}=require('../demo-universe-engine'),commerce=require('../sales-commerce');
const options={seed:'foundly-commerce-v1',as_of:'2026-09-26T00:00:00.000Z'},small={product_count:12,order_count:12,customer_count:12};
const setup=extra=>fixture({industry:'ECOMMERCE',options:{...options,...small},...extra});
function finish(f,row=reserve(f)){while(row.status!=='SEEDED')row=advance(f,row);return row;}

test('E-commerce graph is deterministic, uses attributed public references and keeps invented merchant amounts separate',()=>{
  const m=E.build(options),proof=L.validate(m);assert.equal(m.fingerprint,E.build(options).fingerprint);assert.notEqual(m.fingerprint,E.build({...options,seed:'different'}).fingerprint);
  assert.equal(proof.counts.product,120);assert.equal(proof.counts.order,360);assert.equal(proof.counts.customer,300);assert.equal(proof.counts.interaction,1440);
  assert.equal(proof.live_provider_evidence,false);assert.equal(m.history_start,'2025-03-26T00:00:00.000Z');
  const refs=require('../public-data/ecommerce/2026-09-26/demo-reference-selection.json');assert.equal(refs.price_or_stock_authority,false);
  for(const n of m.nodes.filter(n=>n.kind==='product')){const p=n.input.values,r=refs.items.find(x=>x.reference_id===p.attributes.public_reference_id);assert.equal(p.gtin,r.code);assert.equal(r.provenance.license,'ODbL-1.0');assert.equal(r.provenance.authority,'PUBLIC_CONTRIBUTOR_CLAIM');assert.equal(p.attributes.price_authority,'SYNTHETIC_MERCHANT_PRICE');assert.equal(n.provenance.classification,'SYNTHETIC_DEMO');}
  const roles=require('../module-role-policy').ROLE_IDS;assert.ok(m.personas.every(p=>roles.includes(p.role)));assert.ok(m.personas.some(p=>p.role==='FINANCE_ADMIN'));
});

test('Automotive and E-commerce enquiries target real CRM campaign nodes with a separate Marketing link',()=>{
  for(const m of [A.build(options),E.build(options)]){
    const lookup=new Map(m.nodes.map(n=>[n.id,n]));
    for(const lead of m.nodes.filter(n=>n.kind==='lead')){const campaign=lookup.get(lead.input.campaign_id.$ref);assert.equal(campaign.module,'crm');assert.equal(campaign.entity,'campaigns');const marketing=lookup.get(campaign.input.marketing_campaign_id.$ref);assert.equal(marketing.module,'marketing');}
  }
  const f=setup();finish(f);const lead=f.crm.list(f.ctx,f.actor,'leads').items[0],campaign=f.crm.get(f.ctx,f.actor,'campaigns',lead.campaign_id);
  assert.equal(f.domains.marketing.get(f.ctx,f.actor,'campaigns',campaign.marketing_campaign_id).title,campaign.name);
});

test('full default E-commerce graph passes actual native contracts and conserves inventory with native financial history and exact invoice links',()=>{
  const f=fixture({industry:'ECOMMERCE',durable:false,options}),row=finish(f),manifest=E.build(options),binding=f.adapter.bucket(f.ctx,SCOPE)[0].bindings;
  assert.equal(row.status,'SEEDED');assert.equal(row.full_acceptance,false);assert.equal(commerce.list(f.domains.sales,f.ctx,f.actor,'commerce_products').total,120);assert.equal(commerce.list(f.domains.sales,f.ctx,f.actor,'commerce_orders').total,360);
  const stock=commerce.read(f.domains.sales,f.ctx,f.actor,'commerce_inventory',binding['product-0'].id),expected=manifest.scenarios.find(s=>s.id==='native-stock-conservation').expectations;
  for(const field of ['on_hand','reserved','quarantined','available'])assert.equal(stock[field],expected[field],field);
  const orders=f.domains.sales.bucket(f.ctx,'commerce_orders');assert.ok(orders.some(r=>r.status==='PARTIALLY_RETURNED'));assert.ok(orders.some(r=>r.status==='CANCELLED'));assert.ok(orders.some(r=>r.status==='RESERVED'));
  assert.ok(orders.every(r=>r.provenance.classification==='SYNTHETIC_DEMO'&&!r.payment_verified&&!r.external_dispatch));
  const linked=orders.filter(r=>r.invoice_id);assert.equal(linked.length,180);assert.ok(linked.every(r=>r.financial_status==='INVOICE_LINKED'));assert.ok(orders.filter(r=>!r.invoice_id).every(r=>r.financial_status==='UNPOSTED'));
  const invoices=f.adapter.bucket(f.ctx,'finance:invoices');for(const order of linked){const invoice=invoices.find(r=>r.id===order.invoice_id);assert.equal(invoice.gross_cents,order.totals.gross_minor);assert.equal(invoice.commerce_source.order_id,order.id);assert.equal(invoice.commerce_source.contact_id,order.crm_contact_id);}
  assert.equal(f.adapter.bucket(f.ctx,'finance:invoices').length,182);assert.equal(f.adapter.bucket(f.ctx,'finance:payments').length,108);assert.equal(f.adapter.bucket(f.ctx,'finance:journal_entries').length,255);assert.equal(f.adapter.bucket(f.ctx,'communication:submissions').length,0);
  assert.equal(f.crm.list(f.ctx,f.actor,'contacts').total,300);assert.equal(f.identities.list(f.ctx,f.actor).items.length,9);assert.ok(f.identities.list(f.ctx,f.actor).items.every(p=>p.status==='INVITED'));
  const movements=f.domains.sales.bucket(f.ctx,'commerce_movements');assert.ok(movements.every(r=>r.physical_verification==='SYNTHETIC_DEMO'));
});

test('a lost commerce seed checkpoint recovers one native fulfilment after restart and before a later return can run',()=>{
  const f=setup(),m=E.build({...options,...small}),index=m.nodes.findIndex(n=>n.id==='fulfil-0');let row=reserve(f);
  while(row.applied_nodes<index)row=advance(f,row,Math.min(100,index-row.applied_nodes));
  f.failReceiptAt(index+1);assert.throws(()=>advance(f,row,10),/seed receipt persistence failure/);
  assert.equal(f.adapter.bucket(f.ctx,SCOPE)[0].cursor,index);
  assert.equal(f.domains.sales.bucket(f.ctx,'commerce_orders')[0].status,'FULFILLED');
  assert.equal(f.domains.sales.bucket(f.ctx,'commerce_movements').filter(r=>r.operation==='ORDER_FULFILL').length,1);
  f.allowPersistence();Object.assign(f,f.restart());row=f.engine.get(f.ctx,f.actor,row.id);row=finish(f,row);
  assert.equal(f.domains.sales.bucket(f.ctx,'commerce_orders').length,12);assert.equal(f.domains.sales.bucket(f.ctx,'commerce_orders')[0].status,'PARTIALLY_RETURNED');
  assert.equal(f.domains.sales.bucket(f.ctx,'commerce_movements').filter(r=>r.operation==='ORDER_FULFILL').length,9);
});

test('current Sales authority and changed native sources block seed recovery without overwriting existing native work',()=>{
  const f=setup(),m=E.build({...options,...small}),index=m.nodes.findIndex(n=>n.id==='product-0');let row=reserve(f);row=advance(f,row,index);row=advance(f,row,1);
  f.resolver.configure(f.ctx,f.actor,{industry_id:'ECOMMERCE',entitlements:['crm','procurement','sales','marketing','communication','calendar','finance'],capability_flags:{'sales:quotes':false},expected_revision:1});
  assert.throws(()=>advance(f,row,1),{code:'capability_disabled'});assert.equal(f.domains.sales.bucket(f.ctx,'commerce_inventory')[0].on_hand,0);
  f.resolver.configure(f.ctx,f.actor,{industry_id:'ECOMMERCE',entitlements:['crm','procurement','sales','marketing','communication','calendar','finance'],expected_revision:2});
  const native=f.domains.sales.bucket(f.ctx,'commerce_products')[0];commerce.execute(f.domains.sales,f.ctx,f.actor,'PRODUCT_SAVE',{product_id:native.id,sku:native.sku,name:native.name,currency:'EUR',unit_price_minor:1,tax_rate_bps:2100,expected_revision:1,confirm:true,reason:'Explicit later user change'},{idempotency_key:'changed-demo-product'});
  assert.throws(()=>advance(f,row,1),{code:'demo_dependency_changed'});assert.equal(f.domains.sales.bucket(f.ctx,'commerce_inventory')[0].on_hand,0);
});

test('pack choice controls seed parameters and typed command provenance cannot be changed on replay',()=>{
  const f=setup();assert.throws(()=>f.engine.preview(f.ctx,f.actor,{...f.options,vehicle_count:200}),{code:'demo_request_invalid'});
  const action=E.build({...options,...small}).nodes.find(n=>n.kind==='product'),input={...action.input.values,confirm:true,reason:action.input.reason},key='explicit-origin-replay',origin={classification:'SYNTHETIC_DEMO',source_reference:action.provenance.source_reference};
  commerce.execute(f.domains.sales,f.ctx,f.actor,action.input.operation,input,{idempotency_key:key,demo_provenance:origin});
  assert.throws(()=>commerce.execute(f.domains.sales,f.ctx,f.actor,action.input.operation,input,{idempotency_key:key}),{code:'commerce_request_conflict'});
  const recovery=commerce.recover(f.domains.sales,f.ctx,f.actor,{operation:action.input.operation,input,request_id:key,confirm:true});assert.equal(recovery.record.provenance.classification,'SYNTHETIC_DEMO');
  assert.throws(()=>commerce.recover(f.domains.sales,f.ctx,{...f.actor,id:'another-actor'},{operation:action.input.operation,input,request_id:key,confirm:true}),{code:'commerce_recovery_invalid'});
  assert.throws(()=>commerce.execute(f.domains.sales,f.ctx,f.actor,action.input.operation,input,{idempotency_key:'invalid-demo-provenance',demo_provenance:{classification:'LIVE_PROVIDER',source_reference:origin.source_reference}}),{code:'commerce_provenance_invalid'});
});
