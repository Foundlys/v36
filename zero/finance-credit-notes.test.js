'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {fixture,input,posted}=require('../zero-evaluation/finance-mutation-fixture');
const creditInput=()=>({invoice_number:'CREDIT-001',invoice_date:'2026-09-20',supply_date:'2026-09-01',due_date:'2026-09-20',reason:'Explicit verified correction'});
test('a credit draft references its paid source without inheriting its posting, settlement or commerce invoice authority',()=>{
 const f=fixture(),payload={...input(f),commerce_source:{order_id:'original-order',authority:'NATIVE_CONFIRMED_ORDER_AND_CRM_CONTACT'}},original=f.core.createInvoice(f.ctx,f.actor,payload).invoice;
 f.core.postInvoice(f.ctx,f.actor,original.id);f.core.recordPayment(f.ctx,f.actor,{invoice_id:original.id,amount_cents:original.gross_cents,date:'2026-09-10'});
 const before=f.snapshot(),draft=f.core.createCreditNote(f.ctx,f.actor,original.id,creditInput(),{idempotencyKey:'native-credit-clean'});
 assert.equal(draft.invoice.status,'DRAFT');assert.equal(draft.invoice.paid_cents,0);assert.equal(draft.invoice.credits_invoice_id,original.id);assert.equal(draft.invoice.gross_cents,original.gross_cents);
 for(const field of ['posted_at','posted_by','journal_entry_id','immutable','last_payment_at','commerce_source'])assert.equal(Object.hasOwn(draft.invoice,field),false,field);
 assert.equal(f.rows('journal_entries').length,2);assert.equal(f.rows('payments').length,1);assert.equal(f.rows('invoices')[0].status,'PAID');assert.notEqual(f.snapshot(),before);
 f.restart();const replay=f.core.createCreditNote(f.ctx,f.actor,original.id,creditInput(),{idempotencyKey:'native-credit-clean'});assert.equal(replay.invoice.id,draft.invoice.id);assert.equal(f.rows('invoices').length,2);
});
test('draft sources and a second full credit are rejected without changing financial records',()=>{
 const f=fixture(),draft=f.core.createInvoice(f.ctx,f.actor,input(f)).invoice,before=f.snapshot();
 assert.throws(()=>f.core.createCreditNote(f.ctx,f.actor,draft.id,creditInput()),{code:'finance_credit_source_not_posted'});assert.equal(f.snapshot(),before);
 f.core.postInvoice(f.ctx,f.actor,draft.id);f.core.createCreditNote(f.ctx,f.actor,draft.id,creditInput());const saved=f.snapshot();
 assert.throws(()=>f.core.createCreditNote(f.ctx,f.actor,draft.id,{...creditInput(),invoice_number:'CREDIT-002'}),{code:'finance_credit_amount_exceeded'});assert.equal(f.snapshot(),saved);
});
test('generic credit input cannot bypass the original invoice, currency, amounts or counterparty checks',()=>{
 for(const change of ['missing-source','amount','customer','currency','product','vat-code']){
  const f=fixture(),sale=posted(f).invoice,payload={...input(f,'DIRECT-CREDIT'),kind:'CREDIT_NOTE',credits_invoice_id:sale.id};
  if(change==='missing-source')delete payload.credits_invoice_id;
  if(change==='amount')payload.lines[0].unit_price_cents++;
  if(change==='customer')payload.customer_name='Another customer';
  if(change==='currency')payload.currency='USD';
  if(change==='product')payload.lines[0].product_id='unrelated-product';
  if(change==='vat-code')payload.lines[0].vat_code='another-tax-authority';
  const before=f.snapshot();assert.throws(()=>f.core.createInvoice(f.ctx,f.actor,payload),e=>e.code?.startsWith('finance_credit_'));assert.equal(f.snapshot(),before);
 }
});
test('invoice preparation and direct creation reject caller-invented posting, payment and audit fields',()=>{
 for(const field of ['posted_at','journal_entry_id','immutable','paid_cents','last_payment_at','approved_by','status','revision']){
  const f=fixture(),payload={...input(f),[field]:field==='paid_cents'||field==='revision'?1:'fabricated'},before=f.snapshot();
  assert.throws(()=>f.core.previewInvoiceAction(f.ctx,f.actor,{operation:'INVOICE_CREATE',input:payload}),{code:'finance_invoice_reserved_field'});
  assert.throws(()=>f.core.createInvoice(f.ctx,f.actor,payload),{code:'finance_invoice_reserved_field'});assert.equal(f.snapshot(),before);
 }
});
test('a source-bound full credit action retains original/current credit state after posting and current authority on recovery',()=>{
 const f=fixture(),sale=posted(f).invoice,value={operation:'CREDIT_NOTE_CREATE',input:{invoice_id:sale.id,...creditInput()}},preview=f.core.previewInvoiceAction(f.ctx,f.actor,value);assert.equal(preview.ready,true);
 const command={...value,expected_source_hash:preview.source_hash,request_id:'confirmed-credit-note',confirm:true,reason:'Approve the exact full credit source'},first=f.core.executeInvoiceAction(f.ctx,f.actor,command);
 assert.equal(first.current_invoice.kind,'CREDIT_NOTE');assert.equal(first.current_invoice.status,'DRAFT');assert.equal(first.financial_posting_performed,false);assert.equal(first.external_payment_performed,false);
 f.core.postInvoice(f.ctx,f.actor,first.current_invoice.id);f.restart();const recovered=f.core.recoverInvoiceAction(f.ctx,f.actor,command);
 assert.equal(recovered.original_result.invoice.status,'DRAFT');assert.equal(recovered.current_invoice.status,'POSTED');assert.equal(recovered.original_result_is_current,false);assert.equal(f.rows('invoices').length,2);assert.equal(f.rows('journal_entries').length,2);
 assert.throws(()=>f.core.recoverInvoiceAction(f.ctx,{...f.actor,roles:['VIEWER']},command),{code:'finance_forbidden'});
});
test('posting rechecks the original invoice and refuses a credit after its source journal was reversed',()=>{
 const f=fixture(),sale=posted(f).invoice,draft=f.core.createCreditNote(f.ctx,f.actor,sale.id,creditInput()).invoice;
 const preview=f.core.previewInvoiceAction(f.ctx,f.actor,{operation:'INVOICE_POST',input:{invoice_id:draft.id}});assert.equal(preview.ready,true);
 f.core.reverseJournal(f.ctx,f.actor,sale.journal_entry_id,'Explicit original journal reversal');const before=f.snapshot();
 assert.throws(()=>f.core.postInvoice(f.ctx,f.actor,draft.id),{code:'finance_credit_source_not_posted'});assert.equal(f.snapshot(),before);assert.equal(f.rows('invoices').find(i=>i.id===draft.id).status,'DRAFT');
});
test('an outstanding credit is payable to the customer and does not invent a new customer receivable or refund',()=>{
 const f=fixture(),sale=posted(f).invoice;f.core.recordPayment(f.ctx,f.actor,{invoice_id:sale.id,amount_cents:sale.gross_cents,date:'2026-09-10'});
 const draft=f.core.createCreditNote(f.ctx,f.actor,sale.id,creditInput()).invoice;f.core.postInvoice(f.ctx,f.actor,draft.id);
 const balances=f.core.counterpartyBalances(f.ctx,f.actor,{legal_entity_id:f.entity.id});assert.equal(balances.items.length,1);assert.equal(balances.items[0].direction,'PAYABLE');assert.equal(balances.items[0].counterparty,sale.customer_name);assert.equal(balances.items[0].outstanding_cents,sale.gross_cents);assert.deepEqual(balances.items[0].invoice_ids,[draft.id]);
 assert.equal(f.rows('payments').length,1);assert.equal(f.rows('invoices').find(i=>i.id===sale.id).status,'PAID');
});
test('failed full-credit persistence rolls back reservations and exact retry creates one source-bound draft',()=>{
 const f=fixture(),sale=posted(f).invoice,before=f.snapshot();f.failNext();
 assert.throws(()=>f.core.createCreditNote(f.ctx,f.actor,sale.id,creditInput(),{idempotencyKey:'credit-atomic-retry'}),/injected durable persistence failure/);assert.equal(f.snapshot(),before);
 f.restart();const created=f.core.createCreditNote(f.ctx,f.actor,sale.id,creditInput(),{idempotencyKey:'credit-atomic-retry'});assert.equal(f.rows('invoices').length,2);assert.equal(created.invoice.credits_invoice_id,sale.id);
});
test('full-credit preparation binds intervening source corrections, rejects impossible dates and never treats a partial amount as a full credit',()=>{
 const f=fixture(),sale=posted(f).invoice,value={operation:'CREDIT_NOTE_CREATE',input:{invoice_id:sale.id,...creditInput()}},preview=f.core.previewInvoiceAction(f.ctx,f.actor,value);
 assert.throws(()=>f.core.previewInvoiceAction(f.ctx,f.actor,{...value,input:{...value.input,invoice_date:'2026-02-31'}}),{code:'finance_credit_date_invalid'});
 f.rows('invoices')[0].customer_address+=' corrected address';const before=f.snapshot();assert.throws(()=>f.core.executeInvoiceAction(f.ctx,f.actor,{...value,expected_source_hash:preview.source_hash,request_id:'stale-credit-source',confirm:true,reason:'Previously reviewed source'}),{code:'finance_action_source_changed'});assert.equal(f.snapshot(),before);
 const payload={...input(f,'PARTIAL-CREDIT',5000),kind:'CREDIT_NOTE',credits_invoice_id:sale.id,customer_address:f.rows('invoices')[0].customer_address};assert.throws(()=>f.core.createInvoice(f.ctx,f.actor,payload),{code:'finance_credit_amount_mismatch'});assert.equal(f.snapshot(),before);
});
