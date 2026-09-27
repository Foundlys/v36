'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const {fixture}=require('../zero-evaluation/fixture'),{MODULES}=require('../module-catalog');

test('actual E-commerce pack seeds native commerce through lost HTTP acknowledgement and encrypted restart, then ZERO bills its actual order and CRM contact',async()=>{
  const s=await fixture({FOUNDLY_TENANT_ID:'demo-commerce-http',FOUNDLY_DEMO_UNIVERSE_ENABLED:'true',FOUNDLY_DEMO_TENANT_ID:'demo-commerce-http',NODE_OPTIONS:'--require '+require.resolve('../zero-evaluation/demo-universe-ack-drop')+' --require '+require.resolve('../zero-evaluation/demo-persist-failure')});
  try{
    const composition={industry_id:'ECOMMERCE',entitlements:Object.keys(MODULES),expected_revision:0};assert.equal((await s.request('/api/composition','PUT',composition)).status,200);
    const member=await s.enroll('commerce.demo.owner',['SUPER_ADMIN']),call=(route,method='GET',body,headers={})=>s.request(route,method,body,member.cookie,headers);
    const resolution=(await call('/api/composition')).body.resolution;assert.equal(resolution.industry_id,'ECOMMERCE');assert.equal(resolution.visible_modules.length,9);assert.ok(!resolution.tools.some(t=>t.startsWith('automotive_')));
    const presets=await call('/api/composition/industry-presets?module=sales');assert.equal(presets.status,200,JSON.stringify(presets.body));assert.ok(presets.body.items.some(p=>p.id==='commerce_operations'));assert.deepEqual(presets.body.unavailable,[]);
    const workflow=await call('/api/composition/industry-presets?module=automation');assert.equal(workflow.status,200);assert.ok(workflow.body.items.some(p=>p.id==='commerce_order_review'&&p.draft.automatic===false));
    const options={seed:'commerce-http',as_of:'2026-09-26T00:00:00.000Z',product_count:12,order_count:12,customer_count:12};
    const p=await call('/api/demo-universe/preview','POST',options);assert.equal(p.status,200,JSON.stringify(p.body));assert.equal(p.body.industry_id,'ECOMMERCE');assert.equal(p.body.counts.order,12);
    const start=await call('/api/demo-universe/runs','POST',{...options,plan_fingerprint:p.body.plan_fingerprint,expected_profile_revision:p.body.profile_revision,confirm:true,reason:'Explicit isolated commerce seed'},{'idempotency-key':'commerce-http-seed'});assert.equal(start.status,201,JSON.stringify(start.body));let row=start.body.universe;
    const route='/api/demo-universe/runs/'+row.id,advance=cursor=>({expected_cursor:cursor,expected_profile_revision:1,limit:100,confirm:true,reason:'Explicit isolated native continuation'});
    await assert.rejects(call(route+'/advance','POST',advance(0),{'x-demo-drop-reply':'isolated-demo-fixture'}));
    await s.stop();await s.start();member.cookie=await s.login(member);
    row=(await call(route)).body.universe;assert.ok(row.applied_nodes>0&&row.applied_nodes<=100,'Recover the actual acknowledged prefix, not the requested upper limit');assert.equal((await call(route+'/advance','POST',advance(0))).status,409);
    const manifest=require('../ecommerce-demo-universe').build(options),financeStart=manifest.nodes.findIndex(n=>n.contract==='finance.create'),postIndex=manifest.nodes.findIndex(n=>n.input.operation==='INVOICE_POST'),paymentIndex=manifest.nodes.findIndex(n=>n.input.operation==='PAYMENT_RECORD');let financeFaultChecked=false,postingFaultChecked=false,paymentReplyLost=false;
    while(row.status!=='SEEDED'){
      const before=row.applied_nodes,stop=[financeStart,postIndex,paymentIndex].find(n=>n>before),input={...advance(before),limit:stop===undefined?100:Math.min(100,stop-before)};
      if(before===financeStart&&!financeFaultChecked){
        const failed=await call(route+'/advance','POST',{...input,limit:1},{'x-demo-fail-persist':'isolated-demo-fixture'});assert.equal(failed.status,507,JSON.stringify(failed.body));
        assert.equal((await call(route)).body.universe.applied_nodes,financeStart);assert.equal((await call('/api/finance/records/legal_entities')).body.total,0);
        await s.stop();await s.start();member.cookie=await s.login(member);assert.equal((await call(route)).body.universe.applied_nodes,financeStart);financeFaultChecked=true;
      }
      if(before===postIndex&&!postingFaultChecked){
        const draftBefore=(await call('/api/finance/records/invoices?limit=100')).body.items;
        const failed=await call(route+'/advance','POST',{...input,limit:1},{'x-demo-fail-persist':'isolated-demo-fixture'});assert.equal(failed.status,507,JSON.stringify(failed.body));
        assert.equal((await call(route)).body.universe.applied_nodes,postIndex);assert.equal((await call('/api/finance/records/journal_entries?limit=100')).body.total,0);assert.deepEqual((await call('/api/finance/records/invoices?limit=100')).body.items,draftBefore);
        await s.stop();await s.start();member.cookie=await s.login(member);assert.equal((await call(route)).body.universe.applied_nodes,postIndex);assert.equal((await call('/api/finance/records/journal_entries?limit=100')).body.total,0);postingFaultChecked=true;
      }
      if(before===paymentIndex&&!paymentReplyLost){
        await assert.rejects(call(route+'/advance','POST',{...input,limit:1},{'x-demo-drop-reply':'isolated-demo-fixture'}));
        await s.stop();await s.start();member.cookie=await s.login(member);row=(await call(route)).body.universe;assert.equal(row.applied_nodes,paymentIndex+1);assert.equal((await call('/api/finance/records/payments')).body.total,1);
        assert.equal((await call(route+'/advance','POST',{...input,limit:1})).status,409);assert.equal((await call('/api/finance/records/payments')).body.total,1);paymentReplyLost=true;continue;
      }
      const next=await call(route+'/advance','POST',input);assert.equal(next.status,200,JSON.stringify(next.body));row=next.body.universe;assert.equal(row.applied_nodes-before,row.batch.applied_nodes);assert.ok(row.batch.applied_nodes>0&&row.batch.applied_nodes<=100);assert.equal(row.batch.work_budget_ms,1000);
    }
    assert.equal(financeFaultChecked,true);assert.equal(postingFaultChecked,true);assert.equal(paymentReplyLost,true);
    assert.equal(row.full_acceptance,false);assert.equal(row.total_nodes,264);
    const products=(await call('/api/sales/commerce/commerce_products?limit=100')).body,orders=(await call('/api/sales/commerce/commerce_orders?limit=100')).body;
    assert.equal(products.total,12);assert.equal(orders.total,12);assert.ok(products.items.every(r=>r.provenance.classification==='SYNTHETIC_DEMO'));assert.equal(orders.items.filter(r=>r.financial_status==='INVOICE_LINKED').length,6);
    const productReference=await call('/api/crm/product-reference?code='+products.items[0].gtin+'&limit=2');assert.equal(productReference.status,200);assert.ok(productReference.body.results.some(r=>r.product.code===products.items[0].gtin));
    const order=orders.items.find(r=>r.status==='FULFILLED'&&!r.invoice_id),contact=(await call('/api/crm/contacts/'+order.customer_reference)).body.record;assert.ok(contact.name.startsWith('[SYNTHETIC DEMO]'));
    await s.stop();await s.start();member.cookie=await s.login(member);
    const entities=(await call('/api/finance/records/legal_entities')).body;assert.equal(entities.total,1);const entity=entities.items[0];assert.ok(entity.name.startsWith('[SYNTHETIC DEMO]'));assert.equal(entity.vat_id,'DEMO-NOT-REGISTERED');
    assert.equal((await call('/api/finance/records/fiscal_periods')).body.total,2);assert.equal((await call('/api/finance/records/accounts')).body.total,9);assert.equal((await call('/api/finance/records/invoices?limit=100')).body.total,6);assert.equal((await call('/api/finance/records/payments')).body.total,3);
    const turn=(operation,input)=>({message:'Voer de expliciet bevestigde demohandeling uit',conversation_id:crypto.randomUUID(),turn_id:crypto.randomUUID(),client_context:{finance_action:{operation,input}}});
    async function action(operation,input){const preview=await call('/api/zero/turn','POST',turn(operation+'_PREVIEW',input));assert.equal(preview.status,200,JSON.stringify(preview.body));assert.equal(preview.body.finance_data.ready,true);const r=await call('/api/zero/turn','POST',turn(operation+'_EXECUTE',{input,expected_source_hash:preview.body.finance_data.source_hash,confirm:true,reason:'Explicit synthetic merchant booking',request_id:crypto.randomUUID()}));assert.equal(r.status,200,JSON.stringify(r.body));return r.body.finance_data;}
    const result=await action('COMMERCE_INVOICE_CREATE',{order_id:order.id,contact_id:contact.id,legal_entity_id:entity.id,invoice_number:'DEMO-COMMERCE-001',invoice_date:'2025-11-17',supply_date:'2025-11-17',due_date:'2025-12-17'}),invoice=result.current_invoice;
    assert.equal(invoice.gross_cents,order.totals.gross_minor);assert.equal(invoice.customer_name,contact.name);
    await action('INVOICE_POST',{invoice_id:invoice.id});const paid=await action('PAYMENT_RECORD',{invoice_id:invoice.id,amount_cents:invoice.gross_cents,date:'2025-11-20'});assert.equal(paid.current_invoice.status,'PAID');assert.equal(paid.external_payment_performed,false);
    const journals=(await call('/api/finance/records/journal_entries?limit=100')).body;assert.equal(journals.total,9);assert.ok(journals.items.every(j=>j.debit_cents===j.credit_cents&&j.posted_at>j.date));assert.equal(journals.items.filter(j=>j.source_id===invoice.id&&j.date.startsWith('2025-11-')).length,2,JSON.stringify({invoice:invoice.id,journals:journals.items}));
    assert.equal((await call('/api/finance/records/invoices?limit=100')).body.total,7);assert.equal((await call('/api/finance/records/payments')).body.total,4);assert.equal((await call('/api/communication/messages')).body.total,0);
    assert.ok(!fs.readFileSync(path.join(s.dir,'foundly-core-state.json'),'utf8').includes('Fictional billing address'));
    assert.equal((await s.request('/api/composition','PUT',{...composition,expected_revision:1,enabled_modules:Object.keys(MODULES).filter(id=>id!=='sales')})).status,200);
    assert.equal((await call('/api/sales/commerce/commerce_orders')).status,403);assert.ok(!(await call('/api/zero/status')).body.tools.some(t=>t.tool_id==='finance_commerce_invoice_create_execute'));
    assert.equal((await s.request('/api/composition','PUT',{...composition,expected_revision:2})).status,200);assert.equal((await call('/api/sales/commerce/commerce_orders')).body.total,12);
  }finally{await s.close();}
});
