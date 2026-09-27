'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {fixture,input}=require('../zero-evaluation/finance-mutation-fixture');
const {fixture:composed}=require('../zero-evaluation/demo-universe-fixture');
const {guardDomain,assertRoute}=require('../composition-runtime');
function command(f,id){const p=f.core.previewInvoiceAction(f.ctx,f.actor,{operation:'INVOICE_APPROVE',input:{invoice_id:id}});assert.equal(p.ready,true,JSON.stringify(p));return{operation:'INVOICE_APPROVE',input:{invoice_id:id},request_id:crypto.randomUUID(),expected_source_hash:p.source_hash,confirm:true,reason:'Explicit supplier and line review'};}
function purchase(f,number){return f.core.createInvoice(f.ctx,f.actor,{...input(f,number),kind:'PURCHASE'}).invoice;}
test('approval-only authority preserves exact invoice and lines through retention, native commit, restart and current-state recovery',()=>{
 const f=fixture(),invoice=purchase(f);f.actor.roles=['APPROVER'];const action=command(f,invoice.id),before=f.count();
 assert.equal(f.core.previewInvoiceAction(f.ctx,f.actor,{operation:action.operation,input:action.input}).ready,true);assert.equal(f.count(),before);
 f.core.rememberInvoiceAction(f.ctx,f.actor,action);assert.equal(f.rows('invoices')[0].approval_status,'PENDING');
 const result=f.core.executeInvoiceAction(f.ctx,f.actor,action);assert.equal(result.original_result.invoice.approval_status,'APPROVED');assert.equal(result.current_invoice.status,'DRAFT');assert.equal(result.current_invoice.approved_by,f.actor.id);assert.equal(result.current_invoice.approval_reason,action.reason);assert.equal(result.financial_posting_performed,false);assert.equal(f.rows('journal_entries').length,0);assert.equal(f.rows('payments').length,0);
 assert.throws(()=>f.core.postInvoice(f.ctx,f.actor,invoice.id),{statusCode:403});assert.throws(()=>purchase(f,'FORBIDDEN'),{statusCode:403});
 f.restart();assert.equal(f.core.listInvoiceActionConfirmations(f.ctx,f.actor,{operation:'INVOICE_APPROVE'}).total,1);const snapshot=f.snapshot();assert.equal(f.core.recoverInvoiceAction(f.ctx,f.actor,action).deduplicated,true);assert.equal(f.snapshot(),snapshot);
 f.rows('invoice_lines')[0].description+=' changed after approval';const current=f.core.inspectInvoiceAction(f.ctx,f.actor,action);assert.equal(current.original_result_is_current,false);assert.notEqual(current.original_result.lines[0].description,current.current_result.lines[0].description);
 f.core.acknowledgeInvoiceAction(f.ctx,f.actor,action);assert.equal(f.core.listInvoiceActionConfirmations(f.ctx,f.actor,{operation:'INVOICE_APPROVE'}).total,0);
 f.actor.roles=['ACCOUNTANT'];assert.throws(()=>f.core.recoverInvoiceAction(f.ctx,f.actor,action),{statusCode:403});
});
test('purchase approval detects source changes without revision bumps and rejects incorrect type, invalid amounts and unconfirmed input',()=>{
 const f=fixture(),invoice=purchase(f),action=command(f,invoice.id);f.rows('invoice_lines')[0].description+=' changed';let snapshot=f.snapshot();
 assert.throws(()=>f.core.executeInvoiceAction(f.ctx,f.actor,action),{code:'finance_action_source_changed'});assert.equal(f.snapshot(),snapshot);
 const updated=command(f,invoice.id);assert.throws(()=>f.core.executeInvoiceAction(f.ctx,f.actor,{...updated,confirm:false}),{code:'finance_action_confirmation_required'});
 f.rows('invoice_lines')[0].unit_price_cents++;assert.ok(f.core.previewInvoiceAction(f.ctx,f.actor,{operation:action.operation,input:action.input}).blockers.includes('INVOICE_TOTALS_INVALID'));
 const sales=f.core.createInvoice(f.ctx,f.actor,input(f,'SALE')).invoice;assert.ok(f.core.previewInvoiceAction(f.ctx,f.actor,{operation:'INVOICE_APPROVE',input:{invoice_id:sales.id}}).blockers.includes('INVOICE_NOT_PURCHASE'));
 assert.throws(()=>f.core.previewInvoiceAction(f.ctx,f.actor,{operation:'INVOICE_APPROVE',input:{invoice_id:invoice.id,reason:'injected'}}),{code:'finance_action_invalid'});
});
test('failed approval persistence rolls back invoice, receipt and audit; unseen recovery durably prevents delayed approval',()=>{
 const f=fixture(),invoice=purchase(f),action=command(f,invoice.id),before=f.snapshot(),emitted=f.emitted.length;f.failNext();
 assert.throws(()=>f.core.executeInvoiceAction(f.ctx,f.actor,action),/injected durable persistence failure/);assert.equal(f.snapshot(),before);assert.equal(f.emitted.length,emitted);
 assert.equal(f.core.recoverInvoiceAction(f.ctx,f.actor,action).state,'NOT_APPLIED');f.restart();assert.throws(()=>f.core.executeInvoiceAction(f.ctx,f.actor,action),{code:'finance_action_abandoned'});assert.equal(f.rows('invoices')[0].approval_status,'PENDING');
 const next=command(f,invoice.id);assert.equal(f.core.executeInvoiceAction(f.ctx,f.actor,next).current_invoice.approval_status,'APPROVED');assert.ok(f.core.previewInvoiceAction(f.ctx,f.actor,{operation:next.operation,input:next.input}).blockers.includes('PURCHASE_NOT_PENDING'));
});
test('composition and ZERO discover approve separately from write and recheck capability before retained recovery',()=>{
 const f=fixture(),invoice=purchase(f),c=composed(),resolver=c.resolver;resolver.configure(f.ctx,{id:'root',roles:['SUPER_ADMIN']},{entitlements:['finance'],capability_flags:{'finance:ledger':false,'finance:payments':false},expected_revision:0});
 f.actor.roles=['APPROVER'];const core=guardDomain(f.core,'finance',()=>resolver),action=command({...f,core},invoice.id),tools=resolver.resolve(f.ctx,f.actor).tools;
 assert.ok(tools.includes('finance_invoice_approve_execute'));assert.ok(!tools.includes('finance_invoice_post_execute'));assert.ok(!tools.includes('finance_invoice_create_execute'));
 assert.doesNotThrow(()=>assertRoute('/api/finance/invoice-actions/execute',resolver,f.ctx,f.actor,'POST'));
 assert.equal(core.executeInvoiceAction(f.ctx,f.actor,action).current_invoice.approval_status,'APPROVED');
 assert.throws(()=>core.executeInvoiceAction(f.ctx,f.actor,{...action,operation:'INVOICE_POST'}),{statusCode:403});
 resolver.configure(f.ctx,{id:'root',roles:['SUPER_ADMIN']},{entitlements:['finance'],capability_flags:{'finance:invoices':false},expected_revision:1});
 assert.throws(()=>core.listInvoiceActionConfirmations(f.ctx,f.actor,{operation:'INVOICE_APPROVE'}),{statusCode:403});assert.throws(()=>core.recoverInvoiceAction(f.ctx,f.actor,action),{statusCode:403});
});
test('purchase posting requires approval of the current invoice and lines, while a legacy approved draft needs explicit renewal',()=>{
 for(const change of ['line','supplier','entity','legacy']){
  const f=fixture(),invoice=purchase(f),first=command(f,invoice.id);f.core.executeInvoiceAction(f.ctx,f.actor,first);
  if(change==='line')f.rows('invoice_lines')[0].description+=' changed after approval';
  if(change==='supplier')f.rows('invoices')[0].supplier_address+=' changed after approval';
  if(change==='entity')f.rows('legal_entities')[0].address='Changed legal address';
  if(change==='legacy'){delete f.rows('invoices')[0].approval_version;delete f.rows('invoices')[0].approval_source_hash;}
  const snapshot=f.snapshot();assert.throws(()=>f.core.postInvoice(f.ctx,f.actor,invoice.id),{code:'finance_purchase_approval_required'});assert.equal(f.snapshot(),snapshot);
  assert.ok(f.core.previewInvoiceAction(f.ctx,f.actor,{operation:'INVOICE_POST',input:{invoice_id:invoice.id}}).blockers.includes('PURCHASE_NOT_APPROVED'));
  const renewed=command(f,invoice.id);f.core.executeInvoiceAction(f.ctx,f.actor,renewed);assert.equal(f.core.postInvoice(f.ctx,f.actor,invoice.id).invoice.status,'POSTED');assert.equal(f.rows('journal_entries').length,1);
 }
 const f=fixture();for(const field of ['approval_version','approval_source_hash'])assert.throws(()=>f.core.createInvoice(f.ctx,f.actor,{...input(f),[field]:'injected'}),{code:'finance_invoice_reserved_field'});
});
