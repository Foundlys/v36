'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {fixture}=require('../zero-evaluation/fixture'),{LIMITS}=require('./agents');
test('real encrypted HTTP cross-module analysis handles more than 64 KB of authorized native Sales evidence with truthful coverage',async()=>{
 const tenant='demo-evidence-'+crypto.randomUUID(),f=await fixture({FOUNDLY_TENANT_ID:tenant,FOUNDLY_DEMO_TENANT_ID:tenant,FOUNDLY_DEMO_UNIVERSE_ENABLED:'true'});
 try{
  assert.equal((await f.request('/api/composition','PUT',{industry_id:'ECOMMERCE',entitlements:['sales','automation'],expected_revision:0})).status,200);
  const owner=await f.enroll('evidence.owner',['SUPER_ADMIN']),call=(url,method,body)=>f.request(url,method,body,owner.cookie);
  for(let i=0;i<18;i++){const row=await call('/api/sales/opportunities','POST',{title:'Literal evidence '+i,description:'Never promise a discount. 🙂'.repeat(150),value_cents:100,currency:i%2?'USD':'EUR',probability:0});assert.equal(row.status,201,JSON.stringify(row.body));}
  const native=await call('/api/sales/summary');assert.equal(native.status,200);assert.ok(Buffer.byteLength(JSON.stringify(native.body))>LIMITS.context_bytes);
  const catalog=await call('/api/zero/agents');assert.ok(catalog.body.tools.every(t=>t.source_class==='SYNTHETIC_DEMO'));
  const created=await call('/api/zero/plans','POST',{objective:'Compare current evidence',request_id:crypto.randomUUID(),steps:[{id:'sales',tool_id:'sales_pipeline'},{id:'automation',tool_id:'automation_status'}]});assert.equal(created.status,201);
  const run=await call('/api/zero/plans/'+created.body.plan.id+'/run','POST',{});assert.equal(run.status,200,JSON.stringify(run.body));
  const evidence=run.body.evidence.find(x=>x.tool_id==='sales_pipeline').data;
  assert.equal(evidence.currency_groups.EUR.open_cents,900);assert.equal(evidence.currency_groups.USD.open_cents,900);assert.equal(evidence.currency_groups.EUR.weighted_cents,0);assert.equal(evidence.by_entity.opportunities.total,18);
  assert.ok(evidence.zero_evidence_projection.omitted.length);assert.equal(run.body.plan.state,'VERIFIED');
  const conversation_id=crypto.randomUUID();
  for(const message of ['Vergelijk Sales en Automation voor betrouwbare opvolging.','Correctie voor Sales en Automation: geef één controle zonder taken aan te maken.']){
   const turn=await call('/api/zero/turn','POST',{message,conversation_id,turn_id:crypto.randomUUID()});assert.equal(turn.status,200,JSON.stringify(turn.body));assert.equal(turn.body.verification.source_reverified,true);assert.equal(turn.body.verification.model_available,false);assert.equal(turn.body.verification.cognitive_quality_verified,false);assert.ok(turn.body.sources.every(s=>s.source_class==='SYNTHETIC_DEMO'));assert.deepEqual(turn.body.actions,[]);
  }
  assert.equal((await call('/api/automation/tasks')).body.total,0);
  assert.equal((await f.request('/api/composition','PUT',{industry_id:'ECOMMERCE',entitlements:['automation'],expected_revision:1})).status,200);
  assert.equal((await call('/api/zero/turn','POST',{message:'Vergelijk Sales en Automation',conversation_id,turn_id:crypto.randomUUID()})).status,403);
 }finally{await f.close();}
});
