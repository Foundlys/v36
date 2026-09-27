'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const {fixture}=require('../zero-evaluation/fixture'),{input}=require('../zero-evaluation/finance-mutation-fixture');
for(const industry of ['AUTOMOTIVE','ECOMMERCE'])test(industry+' partial credit survives actual HTTP reply loss, encrypted restart and separate internal refund',async()=>{
 const s=await fixture({NODE_OPTIONS:'--require '+JSON.stringify(require.resolve('../zero-evaluation/finance-http-faults'))});
 try{
  assert.equal((await s.request('/api/composition','PUT',{industry_id:industry,entitlements:['finance'],expected_revision:0})).status,200);
  const member=await s.enroll('partial.credit.'+industry.toLowerCase(),['FINANCE_ADMIN']),call=(route,method='GET',body,headers={})=>s.request(route,method,body,member.cookie,headers);
  const entity=(await call('/api/finance/legal-entities','POST',{name:'[SYNTHETIC_DEMO] Partial correction',legal_form:'BV'})).body;
  assert.equal((await call('/api/finance/periods','POST',{legal_entity_id:entity.id,start_date:'2026-01-01',end_date:'2026-12-31'})).status,201);
  assert.equal((await call('/api/finance/legal-entities/'+entity.id+'/bootstrap-chart','POST',{})).status,201);
  const turn=(operation,value)=>({message:'Voer uitsluitend de expliciet bevestigde financiële demohandeling uit',conversation_id:crypto.randomUUID(),turn_id:crypto.randomUUID(),client_context:{finance_action:{operation,input:value}}});
  async function prepare(operation,value){const r=await call('/api/zero/turn','POST',turn(operation+'_PREVIEW',value));assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.body.finance_data.ready,true,JSON.stringify(r.body.finance_data));return{input:value,request_id:crypto.randomUUID(),expected_source_hash:r.body.finance_data.source_hash,confirm:true,reason:'[SYNTHETIC_DEMO] Confirm this exact internal action'};}
  async function execute(operation,value){const command=await prepare(operation,value),r=await call('/api/zero/turn','POST',turn(operation+'_EXECUTE',command));assert.equal(r.status,200,JSON.stringify(r.body));return r.body.finance_data;}
  const payload=input({entity});payload.customer_name='PRIVATE_PARTIAL_CREDIT_CUSTOMER';payload.lines=[{description:'Returned item',quantity:2,unit_price_cents:101,vat_rate:21},{description:'Retained item',quantity:1,unit_price_cents:1000,vat_rate:9}];
  const created=await execute('INVOICE_CREATE',payload),invoice=created.current_invoice,lineId=created.current_result.lines[0].id;
  await execute('INVOICE_POST',{invoice_id:invoice.id});await execute('PAYMENT_RECORD',{invoice_id:invoice.id,amount_cents:invoice.gross_cents,date:'2026-09-10'});
  const command=await prepare('CREDIT_NOTE_CREATE',{invoice_id:invoice.id,invoice_number:'ZERO-PARTIAL-001',invoice_date:'2026-09-20',supply_date:'2026-09-01',due_date:'2026-09-20',line_ids:[lineId]}),creditTurn=turn('CREDIT_NOTE_CREATE_EXECUTE',command);
  await assert.rejects(call('/api/zero/turn','POST',creditTurn,{'x-fixture-finance-drop':'committed-reply'}));
  await s.stop();await s.start();member.cookie=await s.login(member);
  const recovery=await call('/api/zero/turn','POST',turn('CREDIT_NOTE_CREATE_RECOVER',command));assert.equal(recovery.status,200,JSON.stringify(recovery.body));const credit=recovery.body.finance_data.current_invoice;
  assert.equal(credit.gross_cents,244);assert.equal(credit.status,'DRAFT');assert.deepEqual(credit.credit_line_ids,[lineId]);assert.equal(recovery.body.finance_data.external_payment_performed,false);
  await execute('INVOICE_POST',{invoice_id:credit.id});await execute('CREDIT_REFUND_RECORD',{credit_note_id:credit.id,amount_cents:244,currency:'EUR',date:'2026-09-20',reference:'Internal partial refund; no bank transfer'});
  const again=await call('/api/zero/turn','POST',turn('CREDIT_NOTE_CREATE_RECOVER',command));assert.equal(again.status,200,JSON.stringify(again.body));assert.equal(again.body.finance_data.original_result.invoice.status,'DRAFT');assert.equal(again.body.finance_data.current_invoice.status,'SETTLED');
  const invoices=(await call('/api/finance/records/invoices')).body;assert.equal(invoices.total,2);assert.equal(invoices.items.find(i=>i.id===invoice.id).status,'PAID');
  const journals=(await call('/api/finance/records/journal_entries')).body;assert.equal(journals.total,4);assert.ok(journals.items.every(j=>j.debit_cents===j.credit_cents));
  const duplicate=await call('/api/zero/turn','POST',turn('CREDIT_NOTE_CREATE_PREVIEW',{...command.input,invoice_number:'DUPLICATE-PARTIAL'}));assert.equal(duplicate.status,200,JSON.stringify(duplicate.body));assert.equal(duplicate.body.finance_data.ready,false);
  assert.ok(!fs.readFileSync(path.join(s.dir,'foundly-core-state.json'),'utf8').includes('PRIVATE_PARTIAL_CREDIT_CUSTOMER'));
  assert.equal((await s.request('/api/composition','PUT',{industry_id:industry,entitlements:['finance'],capability_flags:{'finance:ledger':false},expected_revision:1})).status,200);
  assert.equal((await call('/api/zero/turn','POST',turn('CREDIT_NOTE_CREATE_RECOVER',command))).status,403);
 }finally{await s.close();}
});
