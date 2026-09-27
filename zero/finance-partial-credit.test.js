'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const {fixture, input} = require('../zero-evaluation/finance-mutation-fixture');
function sale(f) {
 const value = input(f);
 value.lines = [{description:'[SYNTHETIC_DEMO] Returned accessory',quantity:2,unit_price_cents:101,vat_rate:21,product_id:'accessory'}, {description:'[SYNTHETIC_DEMO] Retained item',quantity:1,unit_price_cents:1000,vat_rate:9,product_id:'retained'}];
 const draft = f.core.createInvoice(f.ctx,f.actor,value);
 f.core.postInvoice(f.ctx,f.actor,draft.invoice.id);
 return draft;
}
const credit = (number, line_ids) => ({invoice_number:number,invoice_date:'2026-09-20',supply_date:'2026-09-01',due_date:'2026-09-20',reason:'Explicit selected-line correction',line_ids});
test('selected source lines create a partial credit with exact source tax, independent posting and allocation', () => {
 const f=fixture(), original=sale(f), first=f.core.createCreditNote(f.ctx,f.actor,original.invoice.id,credit('PARTIAL-1',[original.lines[0].id]));
 assert.equal(first.invoice.gross_cents,244);assert.equal(first.invoice.net_cents,202);assert.equal(first.invoice.vat_cents,42);
 assert.deepEqual(first.invoice.credit_line_ids,[original.lines[0].id]);assert.equal(first.lines.length,1);assert.equal(first.lines[0].product_id,'accessory');
 assert.equal(f.rows('journal_entries').length,1);assert.equal(f.rows('payments').length,0);
 f.core.postInvoice(f.ctx,f.actor,first.invoice.id);
 f.core.allocateCredit(f.ctx,f.actor,{credit_note_id:first.invoice.id,invoice_id:original.invoice.id,amount_cents:244,currency:'EUR',date:'2026-09-20',reference:'selected lines'});
 assert.equal(f.rows('invoices')[0].outstanding_cents,1090);assert.equal(f.rows('invoices')[0].status,'PARTIALLY_SETTLED');
 const second=f.core.createCreditNote(f.ctx,f.actor,original.invoice.id,credit('PARTIAL-2',[original.lines[1].id]));
 f.core.postInvoice(f.ctx,f.actor,second.invoice.id);
 assert.equal(second.invoice.gross_cents,1090);assert.ok(f.rows('journal_entries').every(j=>j.credit_cents===j.debit_cents));
 assert.equal(first.invoice.gross_cents+second.invoice.gross_cents,original.invoice.gross_cents);
});
test('line reservations prevent duplicate credits even where another line leaves sufficient invoice value', () => {
 const f=fixture(),original=sale(f);f.core.createCreditNote(f.ctx,f.actor,original.invoice.id,credit('RESERVE-1',[original.lines[0].id]));const before=f.snapshot();
 assert.throws(()=>f.core.createCreditNote(f.ctx,f.actor,original.invoice.id,credit('RESERVE-2',[original.lines[0].id])),{code:'finance_credit_amount_exceeded'});
 assert.equal(f.snapshot(),before);
 const full=credit('FULL',undefined);delete full.line_ids;
 assert.throws(()=>f.core.createCreditNote(f.ctx,f.actor,original.invoice.id,full),{code:'finance_credit_amount_exceeded'});assert.equal(f.snapshot(),before);
});
test('partial selection rejects missing, foreign, duplicated and empty source line identities before effects', () => {
 for(const which of ['empty','duplicate','foreign','type']){
  const f=fixture(),original=sale(f),selection=which==='empty'?[]:which==='duplicate'?[original.lines[0].id,original.lines[0].id]:which==='foreign'?['another-invoice-line']:'not-an-array',before=f.snapshot();
  assert.throws(()=>f.core.createCreditNote(f.ctx,f.actor,original.invoice.id,credit('INVALID',selection)),e=>e.code?.startsWith('finance_credit_'));assert.equal(f.snapshot(),before);
 }
});
test('posting an earlier partial credit stays valid after another disjoint credit, but rejects changed source lines',()=>{
 const f=fixture(),original=sale(f),first=f.core.createCreditNote(f.ctx,f.actor,original.invoice.id,credit('EARLY',[original.lines[0].id]));
 f.core.createCreditNote(f.ctx,f.actor,original.invoice.id,credit('LATER',[original.lines[1].id]));f.core.postInvoice(f.ctx,f.actor,first.invoice.id);
 const draft=f.rows('invoices').find(r=>r.invoice_number==='LATER');f.rows('invoice_lines').find(r=>r.id===original.lines[1].id).product_id='changed-source';const before=f.snapshot();
 assert.throws(()=>f.core.postInvoice(f.ctx,f.actor,draft.id),{code:'finance_credit_amount_mismatch'});assert.equal(f.snapshot(),before);
});
test('partial action freezes selection, rolls back failure, and recovers its original draft after restart and posting',()=>{
 const f=fixture(),original=sale(f),value={operation:'CREDIT_NOTE_CREATE',input:{invoice_id:original.invoice.id,...credit('RECOVER',[original.lines[0].id])}},preview=f.core.previewInvoiceAction(f.ctx,f.actor,value);
 assert.equal(preview.ready,true);assert.equal(preview.summary.credit_scope,'SELECTED_ORIGINAL_LINES');assert.equal(preview.summary.amount_cents,244);
 const command={...value,request_id:'partial-recovery',confirm:true,reason:'Confirm selected source lines',expected_source_hash:preview.source_hash},before=f.snapshot();
 f.failNext();assert.throws(()=>f.core.executeInvoiceAction(f.ctx,f.actor,command),/injected durable persistence failure/);assert.equal(f.snapshot(),before);
 f.restart();const saved=f.core.executeInvoiceAction(f.ctx,f.actor,command);f.core.postInvoice(f.ctx,f.actor,saved.current_invoice.id);f.restart();
 const recovered=f.core.recoverInvoiceAction(f.ctx,f.actor,command);assert.equal(recovered.original_result.invoice.status,'DRAFT');assert.equal(recovered.current_invoice.status,'POSTED');assert.equal(f.rows('invoices').length,2);
 assert.throws(()=>f.core.recoverInvoiceAction(f.ctx,{...f.actor,roles:['VIEWER']},command),{code:'finance_forbidden'});
});
test('generic credit metadata cannot change the selected source quantities, tax or selection',()=>{
 for(const tamper of ['quantity','vat_rate','selection']){
  const f=fixture(),original=sale(f),preview=f.core.previewInvoiceAction(f.ctx,f.actor,{operation:'CREDIT_NOTE_CREATE',input:{invoice_id:original.invoice.id,...credit('GENERIC',[original.lines[0].id])}}),payload=preview.prepared_invoice;
  if(tamper==='selection')payload.credit_line_ids=[original.lines[1].id];else payload.lines[0][tamper]++;
  const before=f.snapshot();assert.throws(()=>f.core.createInvoice(f.ctx,f.actor,payload),{code:'finance_credit_amount_mismatch'});assert.equal(f.snapshot(),before);
 }
});
