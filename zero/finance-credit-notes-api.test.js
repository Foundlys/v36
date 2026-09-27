'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const {fixture}=require('../zero-evaluation/fixture'),{input}=require('../zero-evaluation/finance-mutation-fixture');
for(const industry of ['AUTOMOTIVE','ECOMMERCE'])test(industry+' ZERO creates and posts a full native credit through a lost reply and encrypted restart without refund or duplicate',async()=>{
 const s=await fixture({NODE_OPTIONS:'--require '+require.resolve('../zero-evaluation/finance-http-faults')});
 try{
  assert.equal((await s.request('/api/composition','PUT',{industry_id:industry,entitlements:['finance'],expected_revision:0})).status,200);
  const member=await s.enroll('credit.demo.'+industry.toLowerCase(),['FINANCE_ADMIN']),call=(route,method='GET',body,headers={})=>s.request(route,method,body,member.cookie,headers);
  const entity=(await call('/api/finance/legal-entities','POST',{name:'[SYNTHETIC DEMO] Credit source',legal_form:'BV'})).body;
  assert.equal((await call('/api/finance/periods','POST',{legal_entity_id:entity.id,start_date:'2026-01-01',end_date:'2026-12-31'})).status,201);
  assert.equal((await call('/api/finance/legal-entities/'+entity.id+'/bootstrap-chart','POST',{})).status,201);
  const turn=(operation,value)=>({message:'Voer uitsluitend de expliciet bevestigde financiële demohandeling uit',conversation_id:crypto.randomUUID(),turn_id:crypto.randomUUID(),client_context:{finance_action:{operation,input:value}}});
  async function prepare(operation,value){const r=await call('/api/zero/turn','POST',turn(operation+'_PREVIEW',value));assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.body.finance_data.ready,true,JSON.stringify(r.body.finance_data));return{input:value,request_id:crypto.randomUUID(),expected_source_hash:r.body.finance_data.source_hash,confirm:true,reason:'[SYNTHETIC DEMO] Confirm this exact internal action'};}
  async function execute(operation,value){const command=await prepare(operation,value),r=await call('/api/zero/turn','POST',turn(operation+'_EXECUTE',command));assert.equal(r.status,200,JSON.stringify(r.body));return r.body.finance_data;}
  const invoice=(await execute('INVOICE_CREATE',{...input({entity}),customer_name:'PRIVATE_CREDIT_CUSTOMER'})).current_invoice;
  await execute('INVOICE_POST',{invoice_id:invoice.id});await execute('PAYMENT_RECORD',{invoice_id:invoice.id,amount_cents:invoice.gross_cents,date:'2026-09-10'});
  const command=await prepare('CREDIT_NOTE_CREATE',{invoice_id:invoice.id,invoice_number:'ZERO-CREDIT-001',invoice_date:'2026-09-20',supply_date:'2026-09-01',due_date:'2026-09-20',reason:'Verified full correction'}),creditTurn=turn('CREDIT_NOTE_CREATE_EXECUTE',command);
  await assert.rejects(call('/api/zero/turn','POST',creditTurn,{'x-fixture-finance-drop':'committed-reply'}));
  await s.stop();await s.start();member.cookie=await s.login(member);
  const recovery=await call('/api/zero/turn','POST',creditTurn);assert.equal(recovery.status,200,JSON.stringify(recovery.body));const credit=recovery.body.finance_data.current_invoice;
  assert.equal(recovery.body.finance_data.deduplicated,true);assert.equal(recovery.body.actions[0].performed_now,false);assert.equal(credit.credits_invoice_id,invoice.id);assert.equal(credit.status,'DRAFT');assert.ok(!('posted_at'in credit));assert.ok(!('last_payment_at'in credit));
  await execute('INVOICE_POST',{invoice_id:credit.id});
  const original=await call('/api/zero/turn','POST',turn('CREDIT_NOTE_CREATE_RECOVER',command));assert.equal(original.status,200,JSON.stringify(original.body));assert.equal(original.body.finance_data.original_result.invoice.status,'DRAFT');assert.equal(original.body.finance_data.current_invoice.status,'POSTED');assert.equal(original.body.finance_data.original_result_is_current,false);
  assert.equal((await call('/api/finance/records/invoices')).body.total,2);assert.equal((await call('/api/finance/records/payments')).body.total,1);
  const journals=(await call('/api/finance/records/journal_entries?limit=100')).body;assert.equal(journals.total,3);assert.ok(journals.items.every(j=>j.debit_cents===j.credit_cents));
  const balances=(await call('/api/finance/counterparty-balances')).body;assert.equal(balances.items[0].direction,'PAYABLE');assert.equal(balances.items[0].outstanding_cents,invoice.gross_cents);
  const invalid=await call('/api/zero/turn','POST',turn('PAYMENT_RECORD_PREVIEW',{invoice_id:credit.id,amount_cents:credit.gross_cents,date:'2026-09-20'}));assert.equal(invalid.status,200,JSON.stringify(invalid.body));assert.equal(invalid.body.finance_data.ready,false);assert.ok(invalid.body.finance_data.blockers.includes('CREDIT_NOTE_REQUIRES_REFUND'));
  assert.equal(original.body.verification.external_payment_performed,false);assert.ok(!fs.readFileSync(path.join(s.dir,'foundly-core-state.json'),'utf8').includes('PRIVATE_CREDIT_CUSTOMER'));
  assert.ok(!JSON.stringify((await call('/api/zero/conversation/'+creditTurn.conversation_id)).body).includes('PRIVATE_CREDIT_CUSTOMER'));
  assert.equal((await s.request('/api/composition','PUT',{industry_id:industry,entitlements:['finance'],capability_flags:{'finance:ledger':false},expected_revision:1})).status,200);
  assert.equal((await call('/api/zero/turn','POST',turn('CREDIT_NOTE_CREATE_RECOVER',command))).status,403);assert.ok(!(await call('/api/zero/status')).body.tools.some(t=>t.tool_id.startsWith('finance_credit_note_create')));
 }finally{await s.close();}
});
