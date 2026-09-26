'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {StackProbe,describeSchema}=require('./discovery');
const ctx={tenant_id:'one',dealer_id:'d'},actor={id:'alice',roles:['MANAGER']};
const target={id:'custom-crm',schema_url:'https://crm.example/openapi.json',credential_env:'CRM_KEY',module:'crm',ttl_seconds:60};
const doc={openapi:'3.1.0',paths:{'/customers':{get:{operationId:'listCustomers'},post:{operationId:'createCustomer'}}},components:{schemas:{Customer:{required:['id'],properties:{id:{type:'integer'},email:{type:'string'},team:{$ref:'#/components/schemas/Team'}}}},securitySchemes:{Auth:{type:'http',scheme:'bearer'}}},webhooks:{changed:{post:{}}}};
function setup(options={}){let time=Date.parse('2026-09-24T12:00:00Z'),allowed=true;const rows=new Map(),adapter={bucket(c,k){const key=c.tenant_id+':'+c.dealer_id+':'+k;if(!rows.has(key))rows.set(key,[]);return rows.get(key);},persist(){}};
 return {probe:new StackProbe({targets:[target],env:{CRM_KEY:'private fixture credential'},adapter,now:()=>new Date(time),authorize:()=>allowed,validateUrl:async()=>{},fetch:async()=>new Response(JSON.stringify(doc)),...options}),advance:n=>time+=n,revoke:()=>allowed=false,adapter};
}
test('authorized OpenAPI observation proves only documented schemas; runtime behavior remains unknown',async()=>{
 let options;const s=setup({fetch:async(_u,o)=>{options=o;return new Response(JSON.stringify(doc));}});
 const result=await s.probe.discover(ctx,actor,{target_id:'custom-crm'});assert.equal(result.state,'OBSERVED');assert.equal(options.redirect,'error');assert.equal(options.headers.authorization,'Bearer private fixture credential');
 const facts=s.probe.facts(ctx,actor);assert.ok(facts.some(f=>f.kind==='SCHEMA'&&f.value.some(p=>p.name==='id'&&p.type==='integer')));assert.ok(facts.some(f=>f.reason==='DOCUMENTATION_IS_NOT_RUNTIME_BEHAVIOR'));
 assert.ok(!JSON.stringify(facts).includes('private fixture credential'));assert.ok(facts.filter(f=>f.evidence_state==='PROVEN').every(f=>f.proof_scope==='OBSERVED_SCHEMA_DOCUMENT_ONLY'));
 s.advance(61000);assert.ok(s.probe.facts(ctx,actor).some(f=>f.reason==='STALE_METADATA'));
});
test('expired authorization and partial provider outage are blocked, not zero records',async()=>{
 const s=setup({fetch:async()=>new Response('{}',{status:401})});const result=await s.probe.discover(ctx,actor,{target_id:'custom-crm'});
 assert.equal(result.state,'BLOCKED');assert.equal(result.code,'zero_discovery_provider_401');assert.ok(s.probe.facts(ctx,actor).some(f=>f.evidence_state==='BLOCKED'));
});
test('client cannot supply a URL, discover a disabled module or read another operator observation',async()=>{
 const s=setup();await assert.rejects(s.probe.discover(ctx,actor,{target_id:'custom-crm',schema_url:'http://169.254.169.254'}),{code:'zero_unknown_field'});
 await s.probe.discover(ctx,actor,{target_id:'custom-crm'});assert.ok(!s.probe.facts(ctx,{id:'admin',roles:['ADMIN']}).some(f=>f.evidence_state==='PROVEN'));
 assert.ok(!s.probe.facts({...ctx,tenant_id:'two'},actor).some(f=>f.evidence_state==='PROVEN'));
 s.revoke();await assert.rejects(s.probe.discover(ctx,actor,{target_id:'custom-crm'}),{code:'zero_discovery_target_denied'});
});
test('current permission after remote IO gates both the response and persistence',async()=>{
 let release;const s=setup({fetch:()=>new Promise(resolve=>release=resolve)}),pending=s.probe.discover(ctx,actor,{target_id:'custom-crm'});
 await new Promise(setImmediate);s.revoke();release(new Response(JSON.stringify(doc)));await assert.rejects(pending,{code:'zero_discovery_revoked'});
 assert.equal(s.probe.facts(ctx,actor).length,0);
});
test('legacy schemas, missing documentation and oversized metadata have explicit outcomes',async()=>{
 assert.ok(describeSchema({swagger:'2.0',definitions:{Legacy:{properties:{id:{type:'string'}}}}}).items.some(f=>f.kind==='SCHEMA'));
 assert.throws(()=>describeSchema({notice:'no documentation'}),{code:'zero_discovery_schema_unsupported'});
 const s=setup({fetch:async()=>new Response(' '.repeat(530000))});assert.equal((await s.probe.discover(ctx,actor,{target_id:'custom-crm'})).code,'zero_discovery_document_too_large');
});
