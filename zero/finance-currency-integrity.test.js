'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{FoundlyFinanceCore}=require('../finance-core');
const {fixture:server}=require('../zero-evaluation/fixture'),{fixture:page}=require('../zero-evaluation/finance-page-fixture'),{locales}=require('../foundly-i18n');
const ctx={tenant_id:'currency-evidence',dealer_id:'default'},actor={id:'accountant',roles:['ADMIN']},date='2026-06-01';
function fixture(){const store=new Map();return new FoundlyFinanceCore({now:()=>new Date('2026-06-15T00:00:00Z'),bucket:(c,name)=>{const key=c.tenant_id+':'+c.dealer_id+':'+name;if(!store.has(key))store.set(key,[]);return store.get(key);}});}
function entity(core,currency){const e=core.createLegalEntity(ctx,actor,{name:currency+' observed entity',legal_form:'BV',currency});core.createPeriod(ctx,actor,{legal_entity_id:e.id,start_date:'2026-01-01',end_date:'2026-12-31'});const accounts={};for(const [role,type] of [['BANK','ASSET'],['AR','ASSET'],['REVENUE','REVENUE'],['VAT_PAYABLE','LIABILITY']])accounts[role]=core.createAccount(ctx,actor,{legal_entity_id:e.id,code:role,name:role,type,system_role:role,currency});return {e,accounts};}
function posting(subject,amount=123,currency=subject.e.currency){return {legal_entity_id:subject.e.id,date,currency,lines:[{account_id:subject.accounts.BANK.id,debit_cents:amount,credit_cents:0},{account_id:subject.accounts.REVENUE.id,debit_cents:0,credit_cents:amount}]};}
function invoice(subject){return {legal_entity_id:subject.e.id,kind:'SALES',invoice_number:'OBS-001',supplier_name:'Observed supplier',supplier_address:'Source address',supplier_vat_id:'NL-source',supplier_kvk_number:'source-kvk',customer_name:'Observed customer',customer_address:'Customer address',invoice_date:date,supply_date:date,due_date:'2026-07-01',currency:subject.e.currency,lines:[{description:'Observed line',quantity:1,unit_price_cents:123,vat_rate:0}]};}
test('native account creation and chart bootstrap inherit the explicit legal-entity currency',()=>{
 const f=fixture(),e=f.createLegalEntity(ctx,actor,{name:'USD entity',legal_form:'BV',currency:'USD'});assert.ok(f.bootstrapDutchChart(ctx,actor,e.id).every(row=>row.currency==='USD'));
});
test('native reports and dashboard retain actual USD without inventing EUR',()=>{
 const f=fixture(),s=entity(f,'USD');f.postJournal(ctx,actor,posting(s));const r=f.reports(ctx,actor,{});assert.equal(r.currency,'USD');assert.equal(r.profit_and_loss.revenue_cents,123);assert.equal(r.profit_and_loss.rows[0].currency,'USD');const d=f.dashboard(ctx,actor,{});assert.equal(d.currency,'USD');assert.equal(d.widgets.find(row=>row.id==='revenue').currency,'USD');
});
test('native mixed-currency reports expose separate observed groups and no summed scalar',()=>{
 const f=fixture(),usd=entity(f,'USD'),eur=entity(f,'EUR');f.postJournal(ctx,actor,posting(usd,123));f.postJournal(ctx,actor,posting(eur,456));const r=f.reports(ctx,actor,{});assert.equal(r.currency,null);assert.equal(r.profit_and_loss.revenue_cents,null);assert.equal(r.trial_balance.total_debit_cents,null);assert.deepEqual(r.currency_groups.map(g=>[g.currency,g.profit_and_loss.revenue_cents]),[['EUR',456],['USD',123]]);assert.equal(r.fx_conversion_performed,false);assert.equal(f.reports(ctx,actor,{legal_entity_id:usd.e.id}).currency,'USD');
});
test('native reports preserve signed revenue observations instead of clamping a debit to zero',()=>{
 const f=fixture(),s=entity(f,'EUR'),p=posting(s,1);p.lines=p.lines.map(line=>({...line,debit_cents:line.credit_cents,credit_cents:line.debit_cents}));f.postJournal(ctx,actor,p);assert.equal(f.reports(ctx,actor,{}).profit_and_loss.revenue_cents,-1);
});
test('native invoice posting and payment preserve invoice currency in their actual journals',()=>{
 const f=fixture(),s=entity(f,'USD'),created=f.createInvoice(ctx,actor,invoice(s)),posted=f.postInvoice(ctx,actor,created.invoice.id);assert.equal(posted.journal.entry.currency,'USD');const paid=f.recordPayment(ctx,actor,{invoice_id:created.invoice.id,amount_cents:123,date});assert.equal(paid.journal.entry.currency,'USD');assert.equal(paid.payment.currency,'USD');
});
test('native reversal retains the original journal currency',()=>{
 const f=fixture(),s=entity(f,'USD'),original=f.postJournal(ctx,actor,posting(s));assert.equal(f.reverseJournal(ctx,actor,original.entry.id,'Observed reversal',{date}).entry.currency,'USD');
});
test('native journal rejects incompatible account currencies before persisting any entry',()=>{
 const f=fixture(),s=entity(f,'EUR');assert.throws(()=>f.postJournal(ctx,actor,posting(s,123,'USD')),error=>error.code==='finance_currency_mismatch');assert.equal(f.list(ctx,actor,'journal_entries').total,0);
});
test('native journals reject unsafe monetary integers before persistence',()=>{
 const f=fixture(),s=entity(f,'EUR');assert.throws(()=>f.postJournal(ctx,actor,posting(s,Number.MAX_SAFE_INTEGER+1)),error=>error.code==='finance_amount_invalid');assert.equal(f.list(ctx,actor,'journal_entries').total,0);
});
test('native reports never round overflowing sums into a claimed monetary observation',()=>{
 const f=fixture(),s=entity(f,'EUR');f.postJournal(ctx,actor,posting(s,Number.MAX_SAFE_INTEGER));f.postJournal(ctx,actor,posting(s,1));const r=f.reports(ctx,actor,{});assert.equal(r.profit_and_loss.revenue_cents,null);assert.ok(r.issues.some(row=>row.code==='AMOUNT_OUT_OF_RANGE'));
});
test('historical ledger currency conflicts remain unverified without rewriting stored records',()=>{
 const f=fixture(),s=entity(f,'USD');f.postJournal(ctx,actor,posting(s));f.collection(ctx,'journal_entries')[0].currency='EUR';const prior=JSON.stringify(f.collection(ctx,'journal_entries')),r=f.reports(ctx,actor,{});assert.equal(r.profit_and_loss.revenue_cents,null);assert.ok(r.issues.some(row=>row.code==='LEDGER_CURRENCY_MISMATCH'));assert.equal(JSON.stringify(f.collection(ctx,'journal_entries')),prior);
});
test('historical currency conflicts also invalidate the affected entity currency instead of showing a false zero',()=>{
 const f=fixture(),s=entity(f,'USD');f.postJournal(ctx,actor,posting(s));f.collection(ctx,'journal_entries')[0].currency='EUR';const usd=f.reports(ctx,actor,{}).currency_groups.find(group=>group.currency==='USD');assert.equal(usd.profit_and_loss.revenue_cents,null);assert.equal(usd.available,false);
});
test('legal-entity request identity binds currency while exact historical replay remains compatible',()=>{
 const f=fixture(),data={name:'Currency-bound entity',legal_form:'BV',currency:'USD'},options={idempotencyKey:'legal-currency-request'},first=f.createLegalEntity(ctx,actor,data,options);assert.throws(()=>f.createLegalEntity(ctx,actor,{...data,currency:'EUR'},options),error=>error.code==='finance_idempotency_conflict');
 const receipt=f.collection(ctx,'idempotency')[0];receipt.signature=require('node:crypto').createHash('sha256').update(JSON.stringify({name:data.name,legalForm:data.legal_form})).digest('hex');const replay=f.createLegalEntity(ctx,actor,data,options);assert.equal(replay.id,first.id);assert.equal(replay.currency,'USD');assert.equal(f.list(ctx,actor,'legal_entities').total,1);
});
test('native bank reconciliation rejects another currency without changing either ledger or invoice',()=>{
 const f=fixture(),s=entity(f,'USD'),created=f.createInvoice(ctx,actor,invoice(s));f.postInvoice(ctx,actor,created.invoice.id);const transaction=f.importBankTransaction(ctx,actor,{legal_entity_id:s.e.id,external_id:'observed-eur-bank',date,amount_cents:123,currency:'EUR'}),before=f.list(ctx,actor,'journal_entries').total;
 assert.equal(f.reconciliationProposals(ctx,actor,transaction.id).proposals.length,0);assert.throws(()=>f.confirmReconciliation(ctx,actor,{bank_transaction_id:transaction.id,invoice_id:created.invoice.id}),error=>error.code==='finance_currency_mismatch');assert.equal(f.list(ctx,actor,'journal_entries').total,before);assert.equal(f.list(ctx,actor,'invoices').items[0].outstanding_cents,123);
});
test('native counterparty balances never combine invoices with different currencies',()=>{
 const f=fixture();for(const code of ['EUR','USD']){const s=entity(f,code),created=f.createInvoice(ctx,actor,invoice(s));f.postInvoice(ctx,actor,created.invoice.id);}const r=f.counterpartyBalances(ctx,actor,{});assert.equal(r.items.length,2);assert.deepEqual(r.items.map(row=>[row.currency,row.outstanding_cents]).sort(),[['EUR',123],['USD',123]]);
});
test('native bank import inherits entity currency and binds request identity to observed currency',()=>{
 const f=fixture(),s=entity(f,'USD'),input={legal_entity_id:s.e.id,external_id:'bank-currency-input',date,amount_cents:123},options={idempotencyKey:'bank-currency-request'},first=f.importBankTransaction(ctx,actor,input,options);assert.equal(first.currency,'USD');assert.throws(()=>f.importBankTransaction(ctx,actor,{...input,currency:'EUR'},options),error=>error.code==='finance_idempotency_conflict');assert.equal(f.importBankTransaction(ctx,actor,input,options).id,first.id);
});
test('actual Finance controller formats source currencies in eight locales and leaves missing currency unknown',async()=>{
 const f=page();f.reports.currency='USD';f.dashboard.currency='USD';await f.context.load();const row=f.nodes.financePnl.children[0],card=f.nodes.financeKpis.children[0],calls=f.calls.length;
 for(const locale of locales){f.i.setLocale(locale);assert.equal(card.children[1].textContent,f.i.currencyCents(123450,'USD'));assert.equal(row.children[4].textContent,f.i.currencyCents(-123450,'USD'));assert.equal(f.calls.length,calls);}
 delete f.reports.currency;delete f.dashboard.currency;await f.context.load();assert.equal(f.nodes.financeKpis.children[0].children[1].textContent,f.i.t('common.unknown'));
});
test('actual Finance controller renders both native currency groups without presenting their sum',async()=>{
 const f=page();f.reports.currency=null;f.dashboard.currency=null;f.dashboard.widgets=[{id:'revenue',value_cents:null,available:false}];f.dashboard.currency_groups=[{currency:'USD',widgets:[{id:'revenue',value_cents:123,currency:'USD',available:true}]},{currency:'EUR',widgets:[{id:'revenue',value_cents:456,currency:'EUR',available:true}]}];await f.context.load();assert.equal(f.nodes.financeKpis.children.length,2);assert.ok(f.nodes.financeKpis.textContent.includes(f.i.currencyCents(123,'USD')));assert.ok(f.nodes.financeKpis.textContent.includes(f.i.currencyCents(456,'EUR')));
});
test('native member reports, workspace and ZERO retain source currency through encrypted restart',async()=>{
 const f=await server();try{
  assert.equal((await f.request('/api/composition','PUT',{entitlements:['finance'],expected_revision:0})).status,200);const member=await f.enroll('finance-currency-accountant',['ACCOUNTANT']),call=(route,method,body)=>f.request(route,method,body,member.cookie);
  const made=await call('/api/finance/legal-entities','POST',{name:'USD source entity',legal_form:'BV',currency:'USD'});assert.equal(made.status,201,JSON.stringify(made.body));const e=made.body;
  const accounts={};for(const [role,type] of [['BANK','ASSET'],['REVENUE','REVENUE']]){const r=await call('/api/finance/accounts','POST',{legal_entity_id:e.id,code:role,name:role,type,system_role:role,currency:'USD'});assert.equal(r.status,201,JSON.stringify(r.body));accounts[role]=r.body;}
  assert.equal((await call('/api/finance/periods','POST',{legal_entity_id:e.id,start_date:'2026-01-01',end_date:'2026-12-31'})).status,201);assert.equal((await call('/api/finance/journals','POST',posting({e,accounts},Number.MAX_SAFE_INTEGER))).status,201);
  for(let n=0;n<2;n++){
   const r=await call('/api/finance/reports');assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.body.currency,'USD');assert.equal(r.body.profit_and_loss.revenue_cents,Number.MAX_SAFE_INTEGER);
   const snapshot=await call('/api/workspaces/finance/snapshot');assert.equal(snapshot.status,200,JSON.stringify(snapshot.body));assert.equal(snapshot.body.metrics.revenue.currency,'USD');assert.equal(snapshot.body.metrics.revenue.value,Number.MAX_SAFE_INTEGER);
   const zero=await call('/api/zero/turn','POST',{message:'Toon het finance overzicht',conversation_id:'finance-currency-evidence',turn_id:'finance-currency-turn-'+n});assert.equal(zero.status,200,JSON.stringify(zero.body));assert.equal(zero.body.finance_data.currency,'USD');assert.ok(zero.body.answer.includes('US$')||zero.body.answer.includes('USD'));assert.ok(!zero.body.answer.includes('€'));assert.ok(zero.body.answer.includes(require('../foundly-i18n').create('nl-NL').currencyCents(Number.MAX_SAFE_INTEGER,'USD')),'ZERO must retain every exact cent at the safe integer boundary');
   if(!n){await f.stop();await f.start();}
  }
 }finally{await f.close();}
});
