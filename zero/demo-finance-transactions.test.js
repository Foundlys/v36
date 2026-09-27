'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {fixture,reserve,advance}=require('../zero-evaluation/demo-universe-fixture'),{SCOPE,MANIFESTS}=require('../demo-universe-engine'),F=require('../demo-finance-actions'),L=require('../demo-universe-law');
function setup(industry='ECOMMERCE',one=false){
  const f=fixture({industry,full:true,options:industry==='ECOMMERCE'?{product_count:12,order_count:12,customer_count:12}:{}}),build=f.engine.build;
  f.engine.build=options=>{
    const m=build(options),map=new Map(m.nodes.map(n=>[n.id,n])),selected=new Set();
    function add(id){if(selected.has(id))return;selected.add(id);for(const dep of map.get(id).depends_on)add(dep);}
    for(const n of m.nodes.filter(n=>n.contract==='finance.create'||industry==='ECOMMERCE'&&n.contract!=='finance.action'))add(n.id);
    const suffix=industry==='ECOMMERCE'?'3':'2';
    for(const n of m.nodes.filter(n=>n.contract==='finance.action'&&(one?n.id.endsWith('-'+suffix):Number(n.id.split('-').at(-1))<(industry==='ECOMMERCE'?6:5))))add(n.id);
    m.nodes=m.nodes.filter(n=>selected.has(n.id));m.scenarios=m.scenarios.filter(s=>s.id==='native-finance-foundation'||s.id.startsWith('native-finance-')&&s.source_ids.every(id=>selected.has(id)));m.derived=[];delete m.fingerprint;return L.seal(m);
  };return f;
}
const rows=(f,entity)=>f.adapter.bucket(f.ctx,'finance:'+entity);
function until(f,row,cursor){while(row.applied_nodes<cursor)row=advance(f,row,Math.min(100,cursor-row.applied_nodes));return row;}
function finish(f,row=reserve(f)){while(row.status!=='SEEDED')row=advance(f,row);return row;}
for(const industry of ['AUTOMOTIVE','ECOMMERCE']){
  test(industry+' native sales history retains exact source links, invoice states and explicit credit settlements, economic dates and balanced journals through restart',()=>{
    const f=setup(industry),row=finish(f),invoices=rows(f,'invoices').filter(i=>i.kind==='SALES'),creditNotes=rows(f,'invoices').filter(i=>i.kind==='CREDIT_NOTE'),payments=rows(f,'payments'),journals=rows(f,'journal_entries'),bindings=f.adapter.bucket(f.ctx,SCOPE)[0].bindings;
    assert.equal(invoices.length,5);assert.equal(payments.length,3);assert.equal(journals.length,10);assert.equal(creditNotes.length,2);assert.ok(creditNotes.every(c=>c.status==='SETTLED'&&c.outstanding_cents===0));assert.equal(creditNotes[0].credits_invoice_id,invoices[1].id);assert.equal(creditNotes[0].allocated_cents,invoices[1].gross_cents);assert.equal(creditNotes[1].credits_invoice_id,invoices[3].id);assert.equal(creditNotes[1].refunded_cents,invoices[3].gross_cents);assert.deepEqual(invoices.map(i=>i.status),['DRAFT','SETTLED','PARTIALLY_PAID','PAID','PAID']);
    const settlements=rows(f,'credit_settlements');assert.deepEqual(settlements.map(s=>s.kind),['ALLOCATION','INTERNAL_REFUND']);assert.ok(settlements.every(s=>s.external_payment_performed===false&&s.bank_settlement_verified===false));
    for(const invoice of invoices){assert.equal(invoice.paid_cents+invoice.credited_cents+invoice.outstanding_cents,invoice.gross_cents);assert.equal(invoice.paid_cents,payments.filter(p=>p.invoice_id===invoice.id).reduce((n,p)=>n+p.amount_cents,0));assert.ok(invoice.created_at>invoice.invoice_date);assert.ok(invoice.customer_name.startsWith(L.LABEL));assert.ok(invoice.customer_address.startsWith(L.LABEL));
      if(industry==='ECOMMERCE'){const order=require('../sales-commerce').read(f.domains.sales,f.ctx,f.actor,'commerce_orders',invoice.commerce_source.order_id);assert.equal(order.invoice_id,invoice.id);assert.equal(order.financial_status,'INVOICE_LINKED');assert.equal(invoice.gross_cents,order.totals.gross_minor);assert.equal(invoice.customer_name,f.crm.get(f.ctx,f.actor,'contacts',invoice.commerce_source.contact_id).name);}
      else{const sale=f.domains.sales.get(f.ctx,f.actor,'opportunities',invoice.demo_source.sale_id),person=f.crm.get(f.ctx,f.actor,'people',invoice.demo_source.person_id);assert.equal(invoice.net_cents,sale.value_cents);assert.equal(invoice.customer_name,person.name);assert.equal(invoice.customer_address,person.billing_address);assert.equal(invoice.demo_source.vehicle_id,sale.industry_fields.vehicle_id);}
    }
    for(const journal of journals){const lines=rows(f,'journal_lines').filter(l=>l.journal_entry_id===journal.id);assert.equal(journal.debit_cents,journal.credit_cents);assert.equal(lines.reduce((n,l)=>n+l.debit_cents-l.credit_cents,0),0);assert.ok(journal.posted_at>journal.date);}
    const balance=role=>{const id=rows(f,'accounts').find(a=>a.system_role===role).id;return rows(f,'journal_lines').filter(l=>l.account_id===id).reduce((n,l)=>n+l.debit_cents-l.credit_cents,0);};
    assert.equal(balance('BANK'),payments.reduce((n,p)=>n+p.amount_cents,0)-settlements.filter(s=>s.kind==='INTERNAL_REFUND').reduce((n,s)=>n+s.amount_cents,0));
    assert.equal(balance('AR'),invoices.filter(i=>i.status!=='DRAFT').reduce((n,i)=>n+i.outstanding_cents,0)-creditNotes.reduce((n,c)=>n+c.outstanding_cents,0));
    assert.equal(-balance('REVENUE'),invoices.filter(i=>i.status!=='DRAFT').reduce((n,i)=>n+i.net_cents,0)-creditNotes.reduce((n,c)=>n+c.net_cents,0));
    assert.ok(payments.every(p=>!p.bank_transaction_id));assert.equal(rows(f,'bank_transactions').length,0);assert.equal(rows(f,'reconciliations').length,0);
    assert.equal(bindings['finance-payment-'+(industry==='ECOMMERCE'?'3':'2')].revision,1);assert.equal(row.full_acceptance,false);assert.equal(row.external_effects,false);
    const ids=invoices.map(i=>i.id);Object.assign(f,f.restart());assert.deepEqual(rows(f,'invoices').filter(i=>i.kind==='SALES').map(i=>i.id),ids);assert.equal(f.engine.get(f.ctx,f.actor,row.id).status,'SEEDED');
  });
  for(const operation of ['CREATE','POST','PAYMENT'])test(industry+' recovers committed '+operation+' after a lost cursor without replaying a changed invoice or duplicating effects',()=>{
    const f=setup(industry,true);let row=reserve(f);const m=f.adapter.bucket(f.ctx,MANIFESTS)[0],index=m.nodes.findIndex(n=>n.contract==='finance.action'&&(operation==='CREATE'?n.input.operation.endsWith('CREATE'):n.input.operation===(operation==='POST'?'INVOICE_POST':'PAYMENT_RECORD')));
    row=until(f,row,index);f.failReceiptAt(index+1);assert.throws(()=>advance(f,row,1),/seed receipt persistence failure/);
    const ids=Object.fromEntries(['invoices','payments','journal_entries','action_requests'].map(e=>[e,rows(f,e).map(r=>r.id||r.request_id)])),preparation=JSON.stringify(f.adapter.bucket(f.ctx,F.SCOPE));
    f.allowPersistence();Object.assign(f,f.restart());row=f.engine.get(f.ctx,f.actor,row.id);assert.equal(row.applied_nodes,index);row=advance(f,row,1);assert.equal(row.applied_nodes,index+1);
    for(const [entity,expected]of Object.entries(ids))assert.deepEqual(rows(f,entity).map(r=>r.id||r.request_id),expected,entity);assert.equal(JSON.stringify(f.adapter.bucket(f.ctx,F.SCOPE)),preparation);
    finish(f,row);assert.equal(rows(f,'invoices').length,1);assert.equal(rows(f,'payments').length,1);assert.equal(rows(f,'journal_entries').length,2);
  });
  for(const kind of ['finance_credit_note','finance_credit_posting','finance_credit_allocation','finance_credit_refund'])test(industry+' retains one native '+kind+' when its demo acknowledgement is lost',()=>{
    const f=setup(industry);let row=reserve(f);const m=f.adapter.bucket(f.ctx,MANIFESTS)[0],index=m.nodes.findIndex(n=>n.kind===kind);assert.ok(index>=0);row=until(f,row,index);
    f.failReceiptAt(index+1);assert.throws(()=>advance(f,row,1),/seed receipt persistence failure/);
    const credits=rows(f,'invoices').filter(i=>i.kind==='CREDIT_NOTE').map(i=>i.id),journals=rows(f,'journal_entries').map(j=>j.id);assert.equal(credits.length,kind==='finance_credit_refund'?2:1);
    f.allowPersistence();Object.assign(f,f.restart());row=f.engine.get(f.ctx,f.actor,row.id);assert.equal(row.applied_nodes,index);row=advance(f,row,1);assert.deepEqual(rows(f,'invoices').filter(i=>i.kind==='CREDIT_NOTE').map(i=>i.id),credits);assert.deepEqual(rows(f,'journal_entries').map(j=>j.id),journals);
    finish(f,row);assert.equal(rows(f,'invoices').filter(i=>i.kind==='CREDIT_NOTE').length,2);assert.equal(rows(f,'credit_settlements').length,2);assert.equal(rows(f,'payments').length,3);
  });
}
test('uncommitted retained preparation fails closed on a changed invoice, while current rights and unrelated source hashes remain mandatory on committed recovery',()=>{
  for(const change of ['uncommitted-invoice','committed-invoice','account','rights','preparation']){
    const f=setup('ECOMMERCE',true);let row=reserve(f);const m=f.adapter.bucket(f.ctx,MANIFESTS)[0],index=m.nodes.findIndex(n=>n.input.operation==='INVOICE_POST');row=until(f,row,index);
    if(change==='uncommitted-invoice'){
      const original=f.engine.finance;f.engine.finance=new Proxy(original,{get(target,key){if(key==='executeInvoiceAction')return()=>{throw Error('Interrupted before native execution');};return Reflect.get(target,key);}});
      assert.throws(()=>advance(f,row,1),/Interrupted before native execution/);f.engine.finance=original;assert.equal(rows(f,'journal_entries').length,0);rows(f,'invoices')[0].customer_address+=' later user edit';
      assert.throws(()=>advance(f,row,1),{code:'finance_action_source_changed'});assert.equal(rows(f,'journal_entries').length,0);continue;
    }
    f.failReceiptAt(index+1);assert.throws(()=>advance(f,row,1),/seed receipt persistence failure/);f.allowPersistence();Object.assign(f,f.restart());row=f.engine.get(f.ctx,f.actor,row.id);
    const expected={ 'committed-invoice':'demo_native_source_changed',account:'demo_dependency_changed',rights:'capability_disabled',preparation:'demo_finance_preparation_invalid'}[change];
    if(change==='committed-invoice')rows(f,'invoices')[0].customer_address+=' changed after posting';
    if(change==='account')rows(f,'accounts').find(a=>a.code==='8000').name+=' edited';
    if(change==='rights')f.resolver.configure(f.ctx,f.actor,{industry_id:'ECOMMERCE',entitlements:['crm','procurement','sales','marketing','communication','calendar','finance'],capability_flags:{'finance:ledger':false},expected_revision:1});
    if(change==='preparation')f.adapter.bucket(f.ctx,F.SCOPE).find(p=>p.node_id===m.nodes[index].id).input_hash='0'.repeat(64);
    assert.throws(()=>advance(f,row,1),{code:expected});assert.equal(f.adapter.bucket(f.ctx,SCOPE)[0].cursor,index);assert.equal(rows(f,'journal_entries').length,1);assert.equal(rows(f,'payments').length,0);
  }
});
test('Law rejects invented financial operations, envelope overrides and swapped non-payment result entities',()=>{
  const f=setup(),m=f.engine.manifest(f.options),node=m.nodes.find(n=>n.contract==='finance.action');
  for(const mutate of [n=>n.input.operation='BANK_TRANSFER',n=>n.input.values.expected_source_hash='0'.repeat(64),n=>n.entity='payments']){const copy=JSON.parse(JSON.stringify(m));mutate(copy.nodes.find(n=>n.id===node.id));delete copy.fingerprint;assert.throws(()=>L.seal(copy),{code:'demo_finance_action_invalid'});}
});
test('an unversioned payment changed after its native acknowledgement cannot be accepted as the original result',()=>{
  const f=setup('AUTOMOTIVE',true);let row=reserve(f);const m=f.adapter.bucket(f.ctx,MANIFESTS)[0],index=m.nodes.findIndex(n=>n.input.operation==='PAYMENT_RECORD');row=until(f,row,index);
  const original=f.engine.finance;
  f.engine.finance=new Proxy(original,{get(target,key){if(key==='executeInvoiceAction')return(...args)=>{const result=target.executeInvoiceAction(...args);rows(f,'payments')[0].reference+=' later change';return result;};return Reflect.get(target,key);}});
  assert.throws(()=>advance(f,row,1),{code:'demo_native_source_changed'});assert.equal(f.adapter.bucket(f.ctx,SCOPE)[0].cursor,index);assert.equal(rows(f,'payments').length,1);assert.equal(rows(f,'journal_entries').length,2);
});

test('old confirmed payment-entity graphs still replay through the original native payment record',()=>{
  const f=setup('AUTOMOTIVE',true),build=f.engine.build;
  f.engine.build=options=>{const m=JSON.parse(JSON.stringify(build(options)));for(const node of m.nodes)if(node.input.operation==='PAYMENT_RECORD')node.entity='payments';delete m.fingerprint;return L.seal(m);};
  finish(f);const binding=f.adapter.bucket(f.ctx,SCOPE)[0].bindings['finance-payment-2'];assert.equal(binding.revision,null);assert.equal(binding.id,rows(f,'payments')[0].id);
});
test('a changed secondary allocation effect after native acknowledgement cannot advance the demo cursor',()=>{
  const f=setup('ECOMMERCE');let row=reserve(f);const m=f.adapter.bucket(f.ctx,MANIFESTS)[0],index=m.nodes.findIndex(n=>n.input.operation==='CREDIT_ALLOCATE');row=until(f,row,index);
  const original=f.engine.finance;
  f.engine.finance=new Proxy(original,{get(target,key){if(key==='executeInvoiceAction')return(...args)=>{const result=target.executeInvoiceAction(...args);rows(f,'invoices').find(i=>i.id===result.current_result.related_invoice.id).customer_address+=' changed after acknowledgement';return result;};return Reflect.get(target,key);}});
  assert.throws(()=>advance(f,row,1),{code:'demo_native_source_changed'});assert.equal(f.adapter.bucket(f.ctx,SCOPE)[0].cursor,index);assert.equal(rows(f,'credit_settlements').length,1);
});
