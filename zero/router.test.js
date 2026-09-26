'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {ModelRouter,USAGE}=require('./router');
const ctx={tenant_id:'one',dealer_id:'d'},actor={id:'alice',roles:['MANAGER']};
const model=(id='primary',extra={})=>({id,provider:'contract-fixture',model:'fixture-model',base_url:'https://provider.example.test/v1',credential_env:'FIXTURE_KEY',protocols:['responses'],tasks:['conversation','verification'],privacy:['INTERNAL'],max_input_bytes:16000,max_output_tokens:128,timeout_ms:100,...extra});
const input={ctx,actor,system:'System policy',input:'A bounded request',workflow_id:'test-workflow'};
function setup(options={}){const rows=new Map();let fail=false;const adapter={bucket(c,k){const key=c.tenant_id+':'+c.dealer_id+':'+k;if(!rows.has(key))rows.set(key,[]);return rows.get(key);},persist(){if(fail)throw Error('disk full');}};
return{router:new ModelRouter({models:[model()],env:{FIXTURE_KEY:'fixture-secret'},adapter,...options}),rows,adapter,fail:()=>fail=true};}
const ok=(text='actual adapter result',usage={input_tokens:8,output_tokens:5})=>new Response(JSON.stringify({status:'completed',output_text:text,usage}),{status:200});
test('no configured provider is unavailable, never a successful empty answer',async()=>{
 const {router}=setup({env:{}});const result=await router.generate(input);assert.equal(result.ok,false);assert.equal(result.state,'NO_ELIGIBLE_MODEL');assert.equal(router.publicRegistry(ctx,actor).available,false);
});
test('bounded fallback uses a permitted second provider and records actual usage',async()=>{
 let calls=0;const {router}=setup({models:[model('primary'),model('secondary',{priority:1})],fetch:async()=>++calls===1?new Response('{}',{status:503}):ok()});
 const r=await router.generate(input);assert.equal(calls,2);assert.equal(r.model_id,'secondary');assert.equal(r.fallback_used,true);assert.equal(r.usage.tokens,13);assert.equal(r.usage.cost_usd,null);
 assert.equal(router.telemetry(ctx,actor).actual_tokens,null,'Unknown failed-attempt usage is not reported as zero');
});
test('retry ceilings, circuit limits and unknown-usage charging prevent storms',async()=>{
 let calls=0;const s=setup({models:[model('one',{protocols:['responses','chat']}),model('two')],policy:{max_attempts:2,daily_requests:3},fetch:async()=>{calls++;return new Response('{}',{status:503});}});
 const r=await s.router.generate(input);assert.equal(r.ok,false);assert.equal(calls,2);
 const r2=await s.router.generate({...input,workflow_id:'next'});assert.equal(r2.state,'BUDGET_EXHAUSTED');assert.equal(calls,3);
 const usage=s.adapter.bucket(ctx,USAGE);assert.ok(usage.every(x=>x.charged_tokens>0&&x.actual_tokens===null));
});
test('tenant and workflow limits persist across router recreation and isolate tenants',async()=>{
 let calls=0;const s=setup({policy:{workflow_requests:1},fetch:async()=>{calls++;return ok();}});
 assert.equal((await s.router.generate(input)).ok,true);assert.equal((await s.router.generate(input)).state,'BUDGET_EXHAUSTED');
 const restarted=new ModelRouter({models:[model()],env:{FIXTURE_KEY:'secret'},adapter:s.adapter,policy:{workflow_requests:1},fetch:async()=>ok()});
 assert.equal((await restarted.generate(input)).state,'BUDGET_EXHAUSTED');
 assert.equal((await restarted.generate({...input,ctx:{tenant_id:'two',dealer_id:'d'}})).ok,true);
 assert.equal(s.router.telemetry(ctx,{id:'bob',roles:['ADMIN']}).requests,0);
});
test('explicit money caps require prices and reject spending before a provider call',async()=>{
 let calls=0;const s=setup({policy:{daily_usd:1},fetch:async()=>{calls++;return ok();}});
 const r=await s.router.generate(input);assert.equal(r.code,'zero_model_price_required');assert.equal(calls,0);
 const priced=setup({models:[model('priced',{input_usd_per_million:1,output_usd_per_million:2})],policy:{daily_usd:.00001},fetch:async()=>{calls++;return ok();}});
 assert.equal((await priced.router.generate(input)).code,'zero_money_budget_exhausted');assert.equal(calls,0);
});
test('privacy and task restrictions exclude otherwise configured models',async()=>{
 let calls=0;const {router}=setup({fetch:async()=>{calls++;return ok();}});
 assert.equal((await router.generate({...input,privacy:'RESTRICTED'})).state,'NO_ELIGIBLE_MODEL');
 assert.equal((await router.generate({...input,task:'research'})).state,'NO_ELIGIBLE_MODEL');assert.equal(calls,0);
});
test('concurrency and cancellation preserve bounded execution and truthful outcomes',async()=>{
 let release;const waiting=new Promise(r=>release=r);const {router}=setup({policy:{concurrency:1},fetch:async()=>{await waiting;return ok();}});
 const controller=new AbortController(),one=router.generate({...input,signal:controller.signal});
 assert.equal((await router.generate(input)).state,'CONCURRENCY_LIMIT');controller.abort();release();
 await assert.rejects(one,{code:'zero_cancelled'});assert.equal(router.inflight.size,0);
});
test('a hung adapter times out and releases its slot without fake completion',async()=>{
 const {router}=setup({policy:{max_attempts:1},fetch:()=>new Promise(()=>{})});
 const r=await router.generate(input);assert.equal(r.state,'PROVIDER_UNAVAILABLE');assert.equal(r.attempts[0].code,'zero_provider_timeout');assert.equal(router.inflight.size,0);
});
test('revoked authority after provider response cannot release its content',async()=>{
 let allowed=true;const {router}=setup({fetch:async()=>{allowed=false;return ok('restricted answer');}});
 await assert.rejects(router.generate({...input,check:()=>{if(!allowed)throw Object.assign(Error('revoked'),{statusCode:403,code:'revoked'});}}),{code:'revoked'});
});
test('persistent reservation failure prevents paid execution',async()=>{
 let calls=0;const s=setup({fetch:async()=>{calls++;return ok();}});s.fail();
 await assert.rejects(s.router.generate(input),/disk full/);assert.equal(calls,0);assert.equal(s.adapter.bucket(ctx,USAGE).length,0);
});
test('incomplete model output is not accepted as a business answer',async()=>{
 const {router}=setup({fetch:async()=>new Response(JSON.stringify({status:'incomplete',output_text:'half an answer',usage:{input_tokens:10,output_tokens:128}}))});
 const r=await router.generate(input);assert.equal(r.ok,false);assert.equal(r.attempts[0].code,'zero_provider_incomplete');
});
test('Anthropic adapter preserves system boundary, token cap and usage',async()=>{
 let captured;const {router}=setup({models:[model('anthropic',{protocols:['anthropic'],provider:'anthropic'})],fetch:async(url,options)=>{captured={url,...options};return new Response(JSON.stringify({stop_reason:'end_turn',content:[{type:'text',text:'response'}],usage:{input_tokens:4,output_tokens:2}}));}});
 const r=await router.generate(input);assert.equal(r.ok,true);assert.ok(captured.url.endsWith('/messages'));assert.equal(JSON.parse(captured.body).max_tokens,128);assert.equal(r.usage.tokens,6);
 assert.ok(!JSON.stringify(router.publicRegistry(ctx,actor)).includes('fixture-secret'));
});
