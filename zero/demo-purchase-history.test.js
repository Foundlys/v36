'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {fixture,reserve,advance}=require('../zero-evaluation/demo-universe-fixture'),L=require('../demo-universe-law'),{SCOPE}=require('../demo-universe-engine');
function setup(industry){
 const f=fixture({industry,full:true,options:industry==='ECOMMERCE'?{product_count:12,order_count:12,customer_count:12}:{}}),build=f.engine.build;
 f.engine.build=options=>{const m=build(options),map=new Map(m.nodes.map(n=>[n.id,n])),selected=new Set();function add(id){if(selected.has(id))return;selected.add(id);for(const dep of map.get(id).depends_on)add(dep);}for(const n of m.nodes.filter(n=>n.contract==='finance.create'||n.id.startsWith('finance-cost-')))add(n.id);m.nodes=m.nodes.filter(n=>selected.has(n.id));m.scenarios=m.scenarios.filter(s=>s.source_ids.every(id=>selected.has(id)));m.derived=[];delete m.fingerprint;return L.seal(m);};return f;
}
const rows=(f,entity)=>f.adapter.bucket(f.ctx,'finance:'+entity);
function finish(f,row){while(row.status!=='SEEDED')row=advance(f,row);return row;}
for(const industry of ['AUTOMOTIVE','ECOMMERCE'])test(industry+' separate native service expenses reconcile payable, expense, tax and outgoing cash without turning proposals into purchases',()=>{
 const f=setup(industry),row=finish(f,reserve(f)),invoices=rows(f,'invoices'),payments=rows(f,'payments'),posted=invoices.filter(i=>i.status!=='DRAFT');
 assert.equal(invoices.length,18);assert.equal(invoices.filter(i=>i.approval_status==='PENDING').length,4);assert.equal(invoices.filter(i=>i.approval_status==='APPROVED'&&i.status==='DRAFT').length,4);assert.equal(posted.length,10);assert.equal(payments.length,6);assert.equal(rows(f,'journal_entries').length,16);
 for(const invoice of invoices){assert.equal(invoice.kind,'PURCHASE');assert.ok(invoice.created_at>invoice.invoice_date);assert.equal(invoice.demo_source.inventory_valuation_performed,false);assert.equal(invoice.demo_source.procurement_commitment_created,false);assert.equal(invoice.supplier_name,f.domains.procurement.get(f.ctx,f.actor,'suppliers',invoice.demo_source.supplier_id).name);assert.equal(invoice.gross_cents,invoice.outstanding_cents+invoice.paid_cents);if(invoice.approval_status==='APPROVED'){assert.equal(invoice.approved_by,f.actor.id);assert.ok(invoice.approval_reason.startsWith(L.LABEL));}}
 const balance=role=>{const id=rows(f,'accounts').find(a=>a.system_role===role).id;return rows(f,'journal_lines').filter(l=>l.account_id===id).reduce((n,l)=>n+l.debit_cents-l.credit_cents,0);};
 assert.equal(-balance('AP'),posted.reduce((n,i)=>n+i.outstanding_cents,0));assert.equal(balance('EXPENSE'),posted.reduce((n,i)=>n+i.net_cents,0));assert.equal(balance('VAT_RECEIVABLE'),posted.reduce((n,i)=>n+i.vat_cents,0));assert.equal(-balance('BANK'),payments.reduce((n,p)=>n+p.amount_cents,0));assert.equal(balance('COGS'),0);assert.equal(balance('REVENUE'),0);
 for(const journal of rows(f,'journal_entries'))assert.equal(journal.debit_cents,journal.credit_cents);assert.ok(payments.every(p=>!p.bank_transaction_id));assert.equal(rows(f,'bank_transactions').length,0);assert.equal(rows(f,'reconciliations').length,0);assert.equal(row.full_acceptance,false);
 const ids=invoices.map(i=>i.id);Object.assign(f,f.restart());assert.deepEqual(rows(f,'invoices').map(i=>i.id),ids);assert.equal(f.engine.get(f.ctx,f.actor,row.id).applied_nodes,row.total_nodes);
});
for(const operation of ['INVOICE_APPROVE','INVOICE_POST','PAYMENT_RECORD'])test('lost demo cursor after '+operation+' preserves the committed purchase effect exactly once',()=>{
 const f=setup('ECOMMERCE'),manifest=f.engine.build(f.options),index=manifest.nodes.findIndex(n=>n.id.startsWith('finance-cost-')&&n.input.operation===operation);let row=reserve(f);while(row.applied_nodes<index)row=advance(f,row,Math.min(100,index-row.applied_nodes));
 let dropped=false;f.engine.finance=new Proxy(f.finance,{get(target,key){if(key==='executeInvoiceAction')return(...args)=>{const result=target.executeInvoiceAction(...args);if(!dropped){dropped=true;throw Error('lost purchase effect reply');}return result;};return Reflect.get(target,key);}});
 assert.throws(()=>advance(f,row,1),/lost purchase effect reply/);const counts=['invoices','payments','journal_entries'].map(e=>rows(f,e).length),invoice=rows(f,'invoices').at(-1),revision=invoice.revision;
 Object.assign(f,f.restart());row=f.engine.get(f.ctx,f.actor,row.id);assert.equal(row.applied_nodes,index);row=advance(f,row,1);assert.deepEqual(['invoices','payments','journal_entries'].map(e=>rows(f,e).length),counts);assert.equal(rows(f,'invoices').find(i=>i.id===invoice.id).revision,revision);assert.equal(f.adapter.bucket(f.ctx,SCOPE)[0].cursor,index+1);finish(f,row);
});
test('monthly purchase history stays inside the retained horizon for month boundaries',()=>{
 for(const as_of of ['2026-09-01T00:00:00.000Z','2026-03-31T00:00:00.000Z'])for(const history_months of [12,18,24]){const m=require('../ecommerce-demo-universe').build({seed:'expense-calendar-boundaries',as_of,history_months,product_count:12,order_count:12,customer_count:12});assert.equal(m.nodes.filter(n=>n.kind==='finance_purchase_invoice').length,history_months);for(const n of m.nodes.filter(n=>n.id.startsWith('finance-cost-'))){assert.ok(n.occurred_at>=m.history_start);assert.ok(n.occurred_at<=as_of);}}
});
test('a retained confirmed graph from before purchase history keeps its original nodes and fingerprint after restart',()=>{
 const f=setup('ECOMMERCE'),build=f.engine.build;
 f.engine.build=options=>{const m=JSON.parse(JSON.stringify(build(options)));m.nodes=m.nodes.filter(n=>!n.id.startsWith('finance-cost-'));m.scenarios=m.scenarios.filter(s=>s.id!=='native-financial-purchase-history');delete m.fingerprint;return L.seal(m);};
 let row=reserve(f);const fingerprint=row.plan_fingerprint,total=row.total_nodes;row=advance(f,row,1);Object.assign(f,f.restart());row=finish(f,f.engine.get(f.ctx,f.actor,row.id));assert.equal(row.plan_fingerprint,fingerprint);assert.equal(row.total_nodes,total);assert.equal(rows(f,'invoices').length,0);
});
