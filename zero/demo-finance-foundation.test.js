'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {fixture,reserve,advance}=require('../zero-evaluation/demo-universe-fixture'),{SCOPE,MANIFESTS}=require('../demo-universe-engine'),L=require('../demo-universe-law');
function foundation(industry='AUTOMOTIVE'){
 const f=fixture({industry});f.engine.build=options=>{
  const graph=require(industry==='ECOMMERCE'?'../ecommerce-demo-universe':'../automotive-demo-universe').build(options);
  graph.nodes=graph.nodes.filter(n=>n.contract==='finance.create');graph.scenarios=graph.scenarios.filter(s=>s.id==='native-finance-foundation');graph.derived=[];delete graph.fingerprint;return L.seal(graph);
 };return f;
}
for(const industry of ['AUTOMOTIVE','ECOMMERCE'])test(industry+' demo uses native entity, complete fiscal periods and ledger mappings without inventing invoice or payment history',()=>{
 const f=foundation(industry),row=advance(f,reserve(f));assert.equal(row.status,'SEEDED');assert.equal(row.total_nodes,12);
 const entities=f.finance.list(f.ctx,f.actor,'legal_entities').items,periods=f.finance.list(f.ctx,f.actor,'fiscal_periods').items,accounts=f.finance.list(f.ctx,f.actor,'accounts').items;
 assert.equal(entities.length,1);assert.equal(entities[0].currency,'EUR');assert.ok(entities[0].name.startsWith(L.LABEL));assert.equal(entities[0].vat_id,'DEMO-NOT-REGISTERED');
 assert.deepEqual(periods.map(r=>[r.start_date,r.end_date]),[['2025-01-01T00:00:00.000Z','2025-12-31T23:59:59.999Z'],['2026-01-01T00:00:00.000Z','2026-12-31T23:59:59.999Z']]);
 assert.ok(periods.every(p=>p.status==='OPEN'&&p.legal_entity_id===entities[0].id));assert.equal(accounts.length,9);assert.equal(new Set(accounts.map(r=>r.system_role)).size,9);assert.ok(accounts.every(r=>r.currency==='EUR'&&r.name.startsWith(L.LABEL)&&r.legal_entity_id===entities[0].id));
 const bindings=f.adapter.bucket(f.ctx,SCOPE)[0].bindings;assert.equal(bindings['finance-entity'].revision,1);assert.equal(bindings['finance-period-2025'].revision,null);assert.equal(bindings['finance-account-1000'].revision,null);assert.ok(!('revision' in periods[0]));assert.ok(!('revision' in accounts[0]));
 for(const entity of ['invoices','payments','journal_entries','bank_accounts'])assert.equal(f.finance.list(f.ctx,f.actor,entity).total,0);
 Object.assign(f,f.restart());assert.equal(f.engine.get(f.ctx,f.actor,row.id).status,'SEEDED');assert.equal(f.finance.list(f.ctx,f.actor,'accounts').total,9);
 assert.equal(row.full_acceptance,false);assert.equal(row.external_effects,false);
});
test('lost native Finance foundation receipts recover each original record without duplicate entity, period or account',()=>{
 for(const before of [0,1,3]){
  const f=foundation();let row=reserve(f);if(before)row=advance(f,row,before);
  const manifest=f.adapter.bucket(f.ctx,MANIFESTS)[0],entity=manifest.nodes[before].entity;
  f.failReceiptAt(before+1);assert.throws(()=>advance(f,row,1),/seed receipt persistence failure/);
  const ids=f.finance.list(f.ctx,f.actor,entity).items.map(r=>r.id);assert.ok(ids.length);
  f.allowPersistence();Object.assign(f,f.restart());row=f.engine.get(f.ctx,f.actor,row.id);assert.equal(row.applied_nodes,before);
  row=advance(f,row,1);assert.equal(row.applied_nodes,before+1);assert.deepEqual(f.finance.list(f.ctx,f.actor,entity).items.map(r=>r.id),ids);
 }
});
test('Finance foundation requires current Finance capabilities and does not grant manager posting or write rights',()=>{
 const f=foundation();let row=reserve(f);row=advance(f,row,1);
 f.resolver.configure(f.ctx,f.actor,{industry_id:'AUTOMOTIVE',entitlements:['finance'],capability_flags:{'finance:ledger':false},expected_revision:1});
 assert.throws(()=>advance(f,row,1),{code:'capability_disabled'});assert.equal(f.adapter.bucket(f.ctx,SCOPE)[0].cursor,1);assert.equal(f.adapter.bucket(f.ctx,'finance:fiscal_periods').length,0);
 const g=foundation(),reserved=reserve(g);g.actor.roles=['MANAGER'];assert.throws(()=>advance(g,reserved,1),{statusCode:403});assert.equal(g.adapter.bucket(g.ctx,'finance:legal_entities').length,0);
});
test('unversioned native configuration dependencies still require an exact current source hash',()=>{
 const f=foundation(),build=f.engine.build;f.engine.build=options=>{const m=build(options);delete m.fingerprint;m.nodes[3].depends_on.push('finance-period-2025');return L.seal(m);};
 let row=advance(f,reserve(f),3);f.adapter.bucket(f.ctx,'finance:fiscal_periods')[0].status='CLOSED';
 assert.throws(()=>advance(f,row,1),{code:'demo_dependency_changed'});assert.equal(f.adapter.bucket(f.ctx,'finance:accounts').length,0);assert.equal(f.adapter.bucket(f.ctx,SCOPE)[0].cursor,3);
});
test('full generated demos declare native Finance configuration across every scenario year and keep confirmed older graphs',()=>{
 for(const industry of ['AUTOMOTIVE','ECOMMERCE']){
  const build=require(industry==='ECOMMERCE'?'../ecommerce-demo-universe':'../automotive-demo-universe').build;
  const m=build({seed:'foundation-years',as_of:'2026-09-26T00:00:00.000Z',history_months:24});
  assert.equal(L.validate(m).counts.finance_period,3);assert.equal(m.nodes.filter(n=>n.contract==='finance.create').length,13);
 }
 const f=foundation(),row=reserve(f);Object.assign(f,f.restart());f.engine.build=()=>{throw Error('New generator must not replace the confirmed graph');};
 assert.equal(advance(f,row).plan_fingerprint,row.plan_fingerprint);
});
