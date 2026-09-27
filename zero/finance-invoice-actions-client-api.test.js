'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {fixture}=require('../zero-evaluation/fixture'),{create}=require('../zero-evaluation/finance-action-page-http-fixture'),{act}=require('../zero-evaluation/finance-action-client-fixture'),{input}=require('../zero-evaluation/finance-mutation-fixture');
for(const industry of ['AUTOMOTIVE','ECOMMERCE'])test(industry+' actual Finance page uses native and ZERO actions, restores retained confirmation after reply loss and enforces current capabilities',async()=>{
 const s=await fixture({NODE_OPTIONS:'--require '+require.resolve('../zero-evaluation/finance-http-faults')});
 try{
  assert.equal((await s.request('/api/composition','PUT',{industry_id:industry,entitlements:['finance'],expected_revision:0})).status,200);
  const owner=await s.enroll('finance.ui.'+industry.toLowerCase(),['FINANCE_ADMIN']),other=await s.enroll('finance.ui.other.'+industry.toLowerCase(),['FINANCE_ADMIN']);
  const call=(route,method='GET',body)=>s.request(route,method,body,owner.cookie);
  const entity=(await call('/api/finance/legal-entities','POST',{name:'[SYNTHETIC DEMO] Finance UI',legal_form:'BV'})).body;
  assert.equal((await call('/api/finance/periods','POST',{legal_entity_id:entity.id,start_date:'2026-01-01',end_date:'2026-12-31'})).status,201);assert.equal((await call('/api/finance/legal-entities/'+entity.id+'/bootstrap-chart','POST',{})).status,201);
  const draft=await call('/api/finance/invoices','POST',{...input({entity}),customer_name:'PRIVATE_FINANCE_UI_SOURCE'});assert.equal(draft.status,201,JSON.stringify(draft.body));const id=draft.body.invoice.id;
  const html=await call('/finance');assert.equal(html.status,200);assert.ok(html.body.includes('/finance-invoice-actions-client.js'));assert.equal((await call('/finance-invoice-actions-client.js')).status,200);
  let page=await create(s,owner);assert.ok(page.field('operation').children.some(n=>n.value==='CREDIT_REFUND_RECORD'));
  await act(page,'INVOICE_POST',id);assert.ok(page.calls.some(c=>c.route==='/api/finance/invoice-actions/execute'));assert.equal((await call('/api/finance/records/journal_entries')).body.total,1);
  await page.transport('zero');page.loseNext('/api/zero/turn');await act(page,'PAYMENT_RECORD',id,{amount:'60,00',date:'2026-09-10',reference:'Explicit internal receipt'});assert.equal(page.box.canLeave(),false);
  assert.equal((await call('/api/finance/records/payments')).body.total,1);assert.ok(page.calls.some(c=>c.route==='/api/zero/turn'&&c.body.client_context.finance_action.operation==='PAYMENT_RECORD_EXECUTE'));
  assert.equal((await s.request('/api/finance/invoice-actions/confirmations?operation=PAYMENT_RECORD','GET',undefined,other.cookie)).body.total,0);
  page.box.isConnected=false;await s.stop();await s.start();owner.cookie=await s.login(owner);page=await create(s,owner);assert.equal(page.box.canLeave(),false);
  await page.button('recover').fire('click');assert.equal(page.box.canLeave(),true,page.box.textContent);assert.equal((await call('/api/finance/records/payments')).body.total,1);
  assert.ok(page.calls.some(c=>c.route==='/api/finance/invoice-actions/recover'));assert.equal(page.calls.filter(c=>c.route==='/api/finance/invoice-actions/execute').length,0);
  await page.transport('zero');await act(page,'CREDIT_NOTE_CREATE',id,{number:'UI-ZERO-CREDIT-001',date:'2026-09-20',supply_date:'2026-09-01',due_date:'2026-09-20'});
  const invoices=(await call('/api/finance/records/invoices?limit=100')).body.items,credit=invoices.find(i=>i.kind==='CREDIT_NOTE');assert.ok(credit,page.box.textContent);
  await act(page,'INVOICE_POST',credit.id);await act(page,'CREDIT_ALLOCATE',credit.id,{amount:'61',date:'2026-09-20',reference:'Original unpaid balance'});await act(page,'CREDIT_REFUND_RECORD',credit.id,{amount:'60',date:'2026-09-20',reference:'Internal outgoing refund'});
  const settlements=(await call('/api/finance/records/credit_settlements?limit=100')).body;assert.equal(settlements.total,2,page.box.textContent);assert.ok(settlements.items.every(i=>i.external_payment_performed===false));assert.equal((await call('/api/finance/records/journal_entries')).body.total,4);assert.equal((await call('/api/finance/counterparty-balances')).body.items.length,0);
  assert.ok(page.calls.some(c=>c.body?.client_context?.finance_action?.operation==='CREDIT_ALLOCATE_EXECUTE'));assert.ok(page.calls.some(c=>c.body?.client_context?.finance_action?.operation==='CREDIT_REFUND_RECORD_EXECUTE'));
  assert.ok(!fs.readFileSync(path.join(s.dir,'foundly-core-state.json'),'utf8').includes('PRIVATE_FINANCE_UI_SOURCE'));
  assert.equal((await s.request('/api/composition','PUT',{industry_id:industry,entitlements:['finance'],capability_flags:{'finance:payments':false},expected_revision:1})).status,200);
  assert.equal((await call('/api/finance/invoice-actions/confirmations?operation=CREDIT_REFUND_RECORD')).status,403);
  await page.context.load();await page.box.ready;assert.ok(!page.field('operation').children.some(n=>['PAYMENT_RECORD','CREDIT_ALLOCATE','CREDIT_REFUND_RECORD'].includes(n.value)));
 }finally{await s.close();}
});
