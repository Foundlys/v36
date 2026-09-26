'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {ModelRouter,registryFromEnvironment}=require('./router');
const {research,sourceMetadata}=require('./research');
const ctx={tenant_id:'one',dealer_id:'d'},actor={id:'alice',roles:['MANAGER']};
const spec={id:'research',provider:'openai',model:'isolated-fixture',base_url:'https://api.openai.com/v1',credential_env:'FIXTURE',protocols:['responses'],tasks:['research'],privacy:['CONFIDENTIAL'],web_search:true,max_output_tokens:128,timeout_ms:500};
function setup(options={}){const buckets=new Map();return new ModelRouter({models:[spec],env:{FIXTURE:'not-a-real-key'},adapter:{bucket(_c,k){if(!buckets.has(k))buckets.set(k,[]);return buckets.get(k);},persist(){}},...options});}
const output={status:'completed',output_text:'A reference answer',usage:{input_tokens:5,output_tokens:8},output:[{type:'web_search_call',status:'completed',action:{sources:[{url:'https://example.com/reference',title:'Reference'}]}}]};
test('research uses bounded tools and shared durable budgets, with unknown source facts kept unknown',async()=>{
 let captured,calls=0;const router=setup({policy:{daily_requests:1},fetch:async(_url,options)=>{calls++;captured=JSON.parse(options.body);return new Response(JSON.stringify(output));}});
 const r=await research({router,ctx,actor,query:'Investigate the issue'});assert.equal(captured.max_tool_calls,1);assert.equal(captured.store,false);assert.equal(r.sources[0].published_at,null);assert.equal(r.customer_records_changed,false);assert.equal(r.sources[0].claim_verified,false);
 await assert.rejects(research({router,ctx,actor,query:'Investigate again'}),{code:'zero_research_budget_exhausted'});assert.equal(calls,1);
});
test('model-only text or a citation without a completed search is not current research evidence',async()=>{
 const router=setup({fetch:async()=>new Response(JSON.stringify({...output,output:[]}))});
 await assert.rejects(research({router,ctx,actor,query:'Current issue'}),{code:'zero_research_provider_unavailable'});
});
test('research monetary budgets include tool charges and cannot assume a missing search price',async()=>{
 let calls=0;const fetcher=async()=>{calls++;return new Response(JSON.stringify(output));};
 const router=setup({models:[{...spec,input_usd_per_million:1,output_usd_per_million:2}],policy:{daily_usd:1},fetch:fetcher});
 await assert.rejects(research({router,ctx,actor,query:'Issue'}),{code:'zero_research_budget_exhausted'});assert.equal(calls,0);
 const priced=setup({models:[{...spec,input_usd_per_million:1,output_usd_per_million:2,web_search_usd_per_call:.01}],fetch:fetcher});
 const r=await research({router:priced,ctx,actor,query:'Issue'});assert.equal(r.model.usage.cost_usd,.010021);assert.equal(r.model.usage.tool_calls,1);
});
test('unsafe URLs and credential scope are not accepted as source or provider authority',()=>{
 const result=sourceMetadata([{url:'javascript:alert(1)'},{url:'https://user:secret@example.com/path'},{url:'https://example.com',published_at:'invented'}],'2026-09-24T00:00:00Z');
 assert.equal(result.length,1);assert.equal(result[0].published_at,null);
 const config=registryFromEnvironment({FOUNDLY_AI_BASE_URL:'https://private-provider.example/v1',FOUNDLY_AI_API_KEY:'private-provider-key'});
 assert.equal(config.find(x=>x.id==='web-research').credential_env,'OPENAI_API_KEY');
});
