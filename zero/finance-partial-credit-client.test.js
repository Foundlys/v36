'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {create}=require('../zero-evaluation/finance-action-client-fixture');
const {fixture,input}=require('../zero-evaluation/finance-mutation-fixture');
const {locales}=require('../foundly-locales');
async function setup(){
 const native=fixture(),value=input(native);value.lines.push({...value.lines[0],description:'Retained literal <img>',unit_price_cents:2000});
 const original=native.core.createInvoice(native.ctx,native.actor,value);native.core.postInvoice(native.ctx,native.actor,original.invoice.id);
 const f=create({native});await f.box.ready;await f.set('operation','CREDIT_NOTE_CREATE');await f.set('document',original.invoice.id);
 for(const[key,value]of Object.entries({number:'PARTIAL-UI',date:'2026-09-20',supply_date:'2026-09-01',due_date:'2026-09-20'}))await f.set(key,value);
 await f.button('preview').fire('click');return{f,original};
}
test('partial credit line choices invalidate confirmation, preserve literal source and survive all eight locale changes',async()=>{
 const {f,original}=await setup();await f.confirm();
 const choices=()=>f.box.all().filter(n=>n.getAttribute('data-finance-credit-line'));
 assert.equal(choices().length,2);choices()[1].checked=false;await choices()[1].fire('change');
 assert.equal(f.field('confirm').checked,false);assert.equal(f.button('submit').disabled,true);
 await f.button('preview').fire('click');await f.confirm();const calls=f.calls.length;
 for(const locale of locales){f.context.FoundlyI18n.setLocale(locale);assert.equal(choices()[1].checked,false);assert.equal(f.field('confirm').checked,true);assert.equal(f.calls.length,calls);assert.equal(f.context.FoundlyI18n.missingKeys().length,0);}
 assert.ok(f.box.textContent.includes('Retained literal <img>'));assert.ok(!f.box.all().some(n=>n.tag==='img'));
 await f.button('submit').fire('click');const credit=f.native.rows('invoices').find(i=>i.kind==='CREDIT_NOTE');assert.ok(credit,f.box.textContent);assert.equal(credit.gross_cents,12100);assert.deepEqual(credit.credit_line_ids,[original.lines[0].id]);assert.equal(f.native.rows('journal_entries').length,1);
});
test('partial credit lost response recovers exact selected lines after a fresh controller and restart',async()=>{
 const {f,original}=await setup(),choice=f.box.all().find(n=>n.getAttribute('data-finance-credit-line')===original.lines[1].id);choice.checked=false;await choice.fire('change');
 await f.button('preview').fire('click');await f.confirm();f.lose('/api/finance/invoice-actions/execute');await f.button('submit').fire('click');assert.equal(f.native.rows('invoices').length,2);
 f.detach();f.native.restart();const next=create({native:f.native});await next.box.ready;await next.button('recover').fire('click');
 assert.equal(next.native.rows('invoices').length,2);assert.deepEqual(next.native.rows('invoices')[1].credit_line_ids,[original.lines[0].id]);assert.equal(next.calls.filter(c=>c.route.endsWith('/execute')).length,0);assert.equal(next.box.canLeave(),true);
});
