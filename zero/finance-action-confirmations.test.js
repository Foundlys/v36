'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {fixture,input,posted}=require('../zero-evaluation/finance-mutation-fixture');
function command(f,operation,value,request_id='confirmed-screen-action'){
 const preview=f.core.previewInvoiceAction(f.ctx,f.actor,{operation,input:value});assert.equal(preview.ready,true);
 return{operation,input:value,request_id,expected_source_hash:preview.source_hash,confirm:true,reason:'Explicit review of native source'};
}
const pending=(f,operation='INVOICE_POST',actor=f.actor)=>f.core.listInvoiceActionConfirmations(f.ctx,actor,{operation});
test('retained confirmation survives restart and remains owner scoped without financial effects or browser storage',()=>{
 const f=fixture(),draft=f.core.createInvoice(f.ctx,f.actor,input(f)).invoice,request=command(f,'INVOICE_POST',{invoice_id:draft.id});
 const saved=f.core.rememberInvoiceAction(f.ctx,f.actor,request);assert.equal(saved.status,'PENDING');assert.equal(saved.financial_posting_performed,false);assert.equal(f.rows('journal_entries').length,0);
 const after=f.count();assert.deepEqual(pending(f).items[0].command,request);assert.equal(f.count(),after);assert.equal(pending(f,'INVOICE_POST',{...f.actor,id:'another-authorized-accountant'}).total,0);
 f.restart();assert.deepEqual(pending(f).items[0].command,request);assert.equal(f.core.rememberInvoiceAction(f.ctx,f.actor,request).deduplicated,true);assert.equal(pending(f).total,1);
 assert.equal(f.core.executeInvoiceAction(f.ctx,f.actor,pending(f).items[0].command).state,'COMMITTED');f.restart();
 const recovered=f.core.recoverInvoiceAction(f.ctx,f.actor,pending(f).items[0].command);assert.equal(recovered.deduplicated,true);assert.equal(f.rows('journal_entries').length,1);
 assert.equal(f.core.acknowledgeInvoiceAction(f.ctx,f.actor,request).state,'COMMITTED');assert.equal(pending(f).total,0);f.restart();assert.equal(pending(f).total,0);
 assert.equal(f.core.rememberInvoiceAction(f.ctx,f.actor,request).status,'ACKNOWLEDGED');assert.equal(f.rows('journal_entries').length,1);
});
test('an unresolved retained action requires explicit recovery before acknowledgement; retirement stops a delayed execute',()=>{
 const f=fixture(),draft=f.core.createInvoice(f.ctx,f.actor,input(f)).invoice,request=command(f,'INVOICE_POST',{invoice_id:draft.id});f.core.rememberInvoiceAction(f.ctx,f.actor,request);
 assert.throws(()=>f.core.acknowledgeInvoiceAction(f.ctx,f.actor,request),{code:'finance_action_confirmation_unresolved'});assert.equal(pending(f).total,1);
 assert.equal(f.core.recoverInvoiceAction(f.ctx,f.actor,request).state,'NOT_APPLIED');assert.equal(f.core.acknowledgeInvoiceAction(f.ctx,f.actor,request).state,'NOT_APPLIED');
 assert.throws(()=>f.core.executeInvoiceAction(f.ctx,f.actor,request),{code:'finance_action_abandoned'});assert.equal(f.rows('journal_entries').length,0);
});
test('retention binds exact input and current role, fails closed on tampering and rejects stale source confirmation',()=>{
 const f=fixture(),sale=posted(f).invoice,request=command(f,'PAYMENT_RECORD',{invoice_id:sale.id,amount_cents:6000,date:'2026-09-10'});f.core.rememberInvoiceAction(f.ctx,f.actor,request);
 assert.throws(()=>f.core.rememberInvoiceAction(f.ctx,f.actor,{...request,reason:'different reason'}),{code:'finance_action_request_conflict'});
 assert.throws(()=>pending(f,'PAYMENT_RECORD',{...f.actor,roles:['VIEWER']}),{code:'finance_forbidden'});
 assert.throws(()=>f.core.acknowledgeInvoiceAction(f.ctx,{...f.actor,id:'other'},request),{code:'finance_action_confirmation_unresolved'});
 const row=f.adapter.bucket(f.ctx,require('../finance-invoice-actions').CONFIRMATIONS)[0];row.command.input.amount_cents=5000;
 assert.throws(()=>pending(f,'PAYMENT_RECORD'),{code:'finance_action_confirmation_invalid'});
 const next=command(f,'PAYMENT_RECORD',{invoice_id:sale.id,amount_cents:6000,date:'2026-09-10'},'new-stale-confirmation');f.rows('invoices')[0].customer_address+=' corrected';
 assert.throws(()=>f.core.rememberInvoiceAction(f.ctx,f.actor,next),{code:'finance_action_source_changed'});assert.equal(f.rows('payments').length,0);
});
test('failed retention prevents a financial attempt and failed acknowledgement keeps its exact recovery command',()=>{
 const f=fixture(),draft=f.core.createInvoice(f.ctx,f.actor,input(f)).invoice,request=command(f,'INVOICE_POST',{invoice_id:draft.id}),before=f.snapshot();f.failNext();
 assert.throws(()=>f.core.rememberInvoiceAction(f.ctx,f.actor,request),/injected durable persistence failure/);assert.equal(f.snapshot(),before);assert.equal(f.rows('journal_entries').length,0);f.restart();
 f.core.rememberInvoiceAction(f.ctx,f.actor,request);f.core.executeInvoiceAction(f.ctx,f.actor,request);const committed=f.snapshot();f.failNext();
 assert.throws(()=>f.core.acknowledgeInvoiceAction(f.ctx,f.actor,request),/injected durable persistence failure/);assert.equal(f.snapshot(),committed);f.restart();
 assert.deepEqual(pending(f).items[0].command,request);assert.equal(f.core.recoverInvoiceAction(f.ctx,f.actor,request).state,'COMMITTED');f.core.acknowledgeInvoiceAction(f.ctx,f.actor,request);assert.equal(f.rows('journal_entries').length,1);
});

test('a confirmation delayed beyond explicit non-application recovery cannot create a new pending attempt',()=>{
 const f=fixture(),draft=f.core.createInvoice(f.ctx,f.actor,input(f)).invoice,request=command(f,'INVOICE_POST',{invoice_id:draft.id});
 assert.equal(f.core.recoverInvoiceAction(f.ctx,f.actor,request).state,'NOT_APPLIED');assert.equal(f.core.acknowledgeInvoiceAction(f.ctx,f.actor,request).state,'NOT_APPLIED');
 assert.equal(f.core.rememberInvoiceAction(f.ctx,f.actor,request).status,'ACKNOWLEDGED');assert.equal(pending(f).total,0);assert.equal(f.rows('journal_entries').length,0);
 assert.throws(()=>f.core.executeInvoiceAction(f.ctx,f.actor,request),{code:'finance_action_abandoned'});
});

test('corrupted closed markers cannot hide an unresolved retained confirmation',()=>{
 const f=fixture(),draft=f.core.createInvoice(f.ctx,f.actor,input(f)).invoice,request=command(f,'INVOICE_POST',{invoice_id:draft.id});f.core.rememberInvoiceAction(f.ctx,f.actor,request);
 f.adapter.bucket(f.ctx,require('../finance-invoice-actions').CONFIRMATIONS)[0].status='ACKNOWLEDGED';
 assert.throws(()=>pending(f),{code:'finance_action_confirmation_invalid'});assert.equal(f.rows('journal_entries').length,0);
});
