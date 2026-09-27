'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {create,act}=require('../zero-evaluation/finance-action-client-fixture'),{locales}=require('../foundly-locales');
const row=(f,id)=>f.native.rows('invoices').find(r=>r.id===id),root='/api/finance/invoice-actions/';
test('approve-only review exposes the exact supplier and every invoice line in all locales before separate confirmation',async()=>{
 const {fixture,input}=require('../zero-evaluation/finance-mutation-fixture'),native=fixture(),draft=input(native);draft.kind='PURCHASE';draft.lines[0].description='Reviewed service <img>';
 draft.lines.push({...draft.lines[0],description:'Second reviewed service',quantity:2,unit_price_cents:550});const id=native.core.createInvoice(native.ctx,native.actor,draft).invoice.id;native.actor.roles=['APPROVER'];
 const f=create({native,operations:['INVOICE_APPROVE']});await f.box.ready;assert.ok(f.field('document').textContent.includes('approval required'));await f.set('document',id);await f.button('preview').fire('click');
 assert.ok(f.box.textContent.includes(draft.supplier_name));assert.ok(f.box.textContent.includes('Reviewed service <img>'));assert.ok(f.box.textContent.includes('Second reviewed service'));assert.ok(!f.box.all().some(n=>n.tag==='img'));assert.equal(row(f,id).approval_status,'PENDING');
 await f.confirm();const calls=f.calls.length;for(const locale of locales){f.context.FoundlyI18n.setLocale(locale);assert.equal(f.calls.length,calls);assert.equal(f.context.FoundlyI18n.missingKeys().length,0);assert.ok(f.box.textContent.includes(f.context.FoundlyI18n.currencyCents(1331,'EUR')));assert.equal(f.field('confirm').checked,true);}
 await f.button('submit').fire('click');assert.equal(row(f,id).approval_status,'APPROVED');assert.equal(native.rows('journal_entries').length,0);assert.equal(native.rows('payments').length,0);assert.equal(f.box.canLeave(),true);
});
test('the actual Finance controller executes posting, receipts, full credit, allocation and refund through distinct reviewed confirmations',async()=>{
 const f=create();await f.box.ready;const id=f.native.rows('invoices')[0].id;
 await f.button('submit').fire('click');assert.equal(f.native.rows('journal_entries').length,0);
 await act(f,'INVOICE_POST',id);assert.equal(row(f,id).status,'POSTED');
 await act(f,'PAYMENT_RECORD',id,{amount:'60,00',date:'2026-09-10',reference:'Internal receipt'});assert.equal(row(f,id).paid_cents,6000);
 await act(f,'CREDIT_NOTE_CREATE',id,{number:'UI-CREDIT-001',date:'2026-09-20',supply_date:'2026-09-01',due_date:'2026-09-20'});const credit=f.native.rows('invoices').find(r=>r.kind==='CREDIT_NOTE');assert.ok(credit,f.box.textContent);
 await act(f,'INVOICE_POST',credit.id);assert.equal(row(f,credit.id).status,'POSTED');
 await act(f,'CREDIT_ALLOCATE',credit.id,{amount:'61.00',date:'2026-09-20',reference:'Original invoice allocation'});assert.equal(row(f,id).status,'SETTLED');
 await act(f,'CREDIT_REFUND_RECORD',credit.id,{amount:'60.00',date:'2026-09-20',reference:'Internal refund'});assert.equal(row(f,credit.id).status,'SETTLED');assert.equal(f.native.rows('credit_settlements').length,2);assert.equal(f.native.rows('journal_entries').length,4);
 assert.equal(f.box.canLeave(),true);assert.equal(f.native.core.reports(f.native.ctx,f.native.actor).cash_flow.cash_balance_cents,0);
 assert.ok(!f.box.all().some(n=>n.tag==='img'));assert.equal(f.context.FoundlyI18n.missingKeys().length,0);
 const actions=f.calls.filter(c=>c.route.endsWith('/execute'));assert.equal(actions.length,6);
 for(const action of actions){const staging=f.calls.find(c=>c.route.endsWith('/confirmations')&&c.body?.request_id===action.body.request_id);assert.ok(staging);assert.deepEqual(staging.body,action.body);}
});
test('an actual committed payment lost before acknowledgement is found after reload and recovered without executing again',async()=>{
 const f=create();await f.box.ready;const id=f.native.rows('invoices')[0].id;f.native.core.postInvoice(f.native.ctx,f.native.actor,id);
 await f.button('clear').fire('click');f.lose(root+'execute');await act(f,'PAYMENT_RECORD',id,{amount:'60',date:'2026-09-10',reference:'Lost receipt'});assert.equal(f.native.rows('payments').length,1);assert.equal(f.box.canLeave(),false);
 f.detach();f.native.restart();f.native.core.recordPayment(f.native.ctx,f.native.actor,{invoice_id:id,amount_cents:6100,date:'2026-09-11'});
 const next=create({native:f.native});await next.box.ready;assert.equal(next.box.canLeave(),false);await next.button('submit').fire('click');assert.equal(next.calls.filter(c=>c.route.endsWith('/execute')).length,0);
 await next.button('recover').fire('click');assert.equal(next.native.rows('payments').length,2);assert.equal(next.box.canLeave(),true);
 assert.ok(next.box.textContent.includes(next.context.FoundlyI18n.t('finance.actions.status_partially_paid')));assert.ok(next.box.textContent.includes(next.context.FoundlyI18n.t('finance.actions.status_paid')));
});
for(const failure of ['confirmation-response','confirmation-persist','acknowledgement-response'])test('the action controller retains correct outcome boundaries for '+failure,async()=>{
 const f=create();await f.box.ready;const id=f.native.rows('invoices')[0].id;
 await f.set('document',id);await f.button('preview').fire('click');await f.confirm();
 if(failure==='confirmation-response')f.lose(root+'confirmations');if(failure==='confirmation-persist')f.native.failNext();if(failure==='acknowledgement-response')f.lose(root+'acknowledge');
 await f.button('submit').fire('click');assert.equal(f.box.canLeave(),false);assert.equal(f.native.rows('journal_entries').length,failure==='acknowledgement-response'?1:0);
 await f.button('recover').fire('click');assert.equal(f.box.canLeave(),true);assert.equal(f.native.rows('journal_entries').length,failure==='acknowledgement-response'?1:0);
});
test('editing after preparation removes confirmation; a stale native source is explicitly retired without a financial effect',async()=>{
 const f=create();await f.box.ready;const id=f.native.rows('invoices')[0].id;
 await f.set('document',id);await f.button('preview').fire('click');await f.confirm();await f.set('document',id);assert.equal(f.field('confirm').checked,false);
 await f.button('submit').fire('click');assert.equal(f.native.rows('journal_entries').length,0);
 await f.button('preview').fire('click');await f.confirm();row(f,id).customer_address+=' changed after review';await f.button('submit').fire('click');assert.equal(f.native.rows('journal_entries').length,0);assert.equal(f.box.canLeave(),false);
 await f.button('recover').fire('click');assert.equal(f.box.canLeave(),true);assert.equal(f.native.rows('journal_entries').length,0);
});
test('a detached controller stops before execution when retaining confirmation completes late',async()=>{
 const f=create();await f.box.ready;await f.set('document',f.native.rows('invoices')[0].id);await f.button('preview').fire('click');await f.confirm();
 const release=f.hold(root+'confirmations'),running=f.button('submit').fire('click');await release.started;f.detach();release();await running;
 assert.equal(f.native.rows('journal_entries').length,0);assert.equal(f.calls.filter(c=>c.route.endsWith('/execute')).length,0);
 const next=create({native:f.native});await next.box.ready;await next.button('recover').fire('click');assert.equal(next.box.canLeave(),true);assert.equal(f.native.rows('journal_entries').length,0);
});
test('all eight locales preserve exact editable values, current confirmation and literal source labels without making requests',async()=>{
 const f=create();await f.box.ready;const id=f.native.rows('invoices')[0].id;await f.set('document',id);await f.button('preview').fire('click');await f.confirm();const calls=f.calls.length,select=f.field('document');
 for(const locale of locales){f.context.FoundlyI18n.setLocale(locale);assert.equal(f.calls.length,calls);assert.equal(f.field('document'),select);assert.equal(select.value,id);assert.equal(f.field('confirm').checked,true);assert.equal(f.field('reason').value,'Explicit reviewed source');assert.ok(select.textContent.includes('SOURCE <img> 001'));assert.equal(f.context.FoundlyI18n.missingKeys().length,0);assert.ok(f.box.textContent.includes(f.context.FoundlyI18n.currencyCents(12100,'EUR')));}
 const parse=f.context.FoundlyFinanceInvoiceActions.cents;assert.equal(parse('90071992547409.91'),Number.MAX_SAFE_INTEGER);assert.equal(parse('0,01'),1);
 for(const value of ['90071992547409.92','1,234','0','-1','1e2','1.2.3'])assert.throws(()=>parse(value));
});
test('bounded invoice pages retain native source identity and cannot discard a prepared action on navigation',async()=>{
 const f=create(),{input}=require('../zero-evaluation/finance-mutation-fixture');
 for(let i=1;i<53;i++)f.native.core.createInvoice(f.native.ctx,f.native.actor,input(f.native,'PAGE-'+i));
 await f.box.ready;await f.button('clear').fire('click');assert.equal(f.field('document').children.length,51);
 await f.button('next').fire('click');assert.equal(f.field('document').children.length,4);const id=f.native.rows('invoices')[52].id;
 await f.set('document',id);await f.button('preview').fire('click');const before=f.calls.length;await f.button('previous').fire('click');assert.equal(f.calls.length,before);assert.equal(f.field('document').value,id);
 await f.confirm();await f.button('submit').fire('click');assert.equal(row(f,id).status,'POSTED');assert.equal(f.native.rows('journal_entries').length,1);assert.ok(f.calls.some(c=>c.route.includes('limit=50&cursor=50')));
});
