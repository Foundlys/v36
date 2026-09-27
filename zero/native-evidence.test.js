'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {project,MAX_BYTES}=require('./native-evidence'),{nativeTools}=require('./native-agents'),{AgentOrchestrator,LIMITS}=require('./agents');
const ctx={tenant_id:'demo-evidence',dealer_id:'default'},actor={id:'owner',roles:['ADMIN']};
function large(){return {module_id:'sales',by_entity:{opportunities:{available:true,total:105,limit:100,offset:0,next_offset:100,items:Array.from({length:100},(_,i)=>({id:'row-'+i,revision:1,currency:i%2?'USD':'EUR',value_cents:i,description:'Do not promise a discount. 🙂'.repeat(300),provenance:{classification:'SYNTHETIC_DEMO'}}))}},currency_groups:{EUR:{open_known_cents:123,weighted_cents:null,accounting_revenue:false},USD:{open_known_cents:0,weighted_cents:0,accounting_revenue:false}},sales_summary:{source_record_count:105,excluded_source_count:0,accounting_revenue:false},aggregate_scope:'ALL_PERMISSION_FILTERED_RECORDS',observed_at:new Date().toISOString()};}
test('large native evidence keeps exact totals/currency/null semantics and discloses whole-row omission and native pagination',()=>{
 const source=large(),before=JSON.stringify(source),out=project(source,'SYNTHETIC_DEMO');
 assert.ok(Buffer.byteLength(JSON.stringify(out))<=MAX_BYTES);assert.equal(JSON.stringify(source),before);
 assert.deepEqual(out.currency_groups,source.currency_groups);assert.deepEqual(out.sales_summary,source.sales_summary);
 assert.equal(out.by_entity.opportunities.total,105);assert.equal(out.by_entity.opportunities.next_offset,100);
 assert.deepEqual(out.by_entity.opportunities.items,[],'Oversized row is withheld whole, including its negation');
 assert.deepEqual(out.zero_evidence_projection.omitted,[{path:'/by_entity/opportunities/items',reason:'CONTEXT_BUDGET',native_returned_records:100,retained_records:0}]);
 assert.equal(out.zero_evidence_projection.source_class,'SYNTHETIC_DEMO');
 const small=project({currency:'EUR',total_cents:0,available:false},'CUSTOMER_TRUTH');assert.equal(small.zero_evidence_projection.representation,'COMPLETE_NATIVE_RESPONSE');assert.equal(small.available,false);
});
test('whole aggregate withholding is explicit when many currency groups cannot fit, and retained rows are exact prefixes',()=>{
 const source={currency_groups:Object.fromEntries(Array.from({length:1000},(_,i)=>['currency-'+i,{currency:'currency-'+i,total_cents:i,available:true}])),runs:Array.from({length:30},(_,i)=>({id:'run-'+i,status:'BLOCKED',reason:'Do not retry without review. '.repeat(15)}))};
 const out=project(source,'CUSTOMER_TRUTH');assert.ok(Buffer.byteLength(JSON.stringify(out))<=MAX_BYTES);
 assert.equal(out.currency_groups,undefined);assert.ok(out.zero_evidence_projection.omitted.some(x=>x.path==='/currency_groups'&&x.whole_field_withheld));
 assert.deepEqual(out.runs,source.runs.slice(0,out.runs.length));assert.ok(out.runs.length>0&&out.runs.length<30);
});
test('native source revalidation includes omitted details, rejects altered projections and keeps every specialist within the shared budget',async()=>{
 let source=large(),demo=true;const tools=nativeTools({composition:()=>({assertTool(){}}),domain:()=>({summary:()=>source}),crm:()=>({analytics:()=>source}),crmActor:a=>a,finance:()=>({reports:()=>source}),platform:()=>({automationStatus:()=>source}),isDemoScope:()=>demo});
 const tool=tools.find(t=>t.id==='sales_pipeline'),out=tool.read(ctx,actor);assert.equal(tool.verify(ctx,actor,out),true);
 source.by_entity.opportunities.items[99].description='Changed omitted source';assert.equal(tool.verify(ctx,actor,out),false);
 const fresh=tool.read(ctx,actor);fresh.currency_groups.EUR.open_known_cents++;assert.equal(tool.verify(ctx,actor,fresh),false);
 const rows=[],engine=new AgentOrchestrator({adapter:{bucket:()=>rows,persist(){}},tools});
 const plan=engine.create(ctx,actor,{objective:'Inspect all authorized specialists',request_id:'all-specialists',steps:tools.map(t=>({id:t.module,tool_id:t.id}))});
 const result=await engine.run(ctx,actor,plan.id);assert.equal(result.plan.state,'VERIFIED');assert.ok(result.plan.context_bytes<=LIMITS.context_bytes);
 assert.ok(result.plan.receipts.every(r=>r.source_class==='SYNTHETIC_DEMO'));assert.ok(engine.catalog(ctx,actor).tools.every(t=>t.source_class==='SYNTHETIC_DEMO'));
 const prior=tool.read(ctx,actor);demo=false;assert.equal(tool.verify(ctx,actor,prior),false);
});
