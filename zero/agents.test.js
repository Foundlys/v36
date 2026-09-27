'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {AgentOrchestrator,BUCKET}=require('./agents');
const C=require('./contracts');
const ctx={tenant_id:'one',dealer_id:'d'},actor={id:'alice',roles:['MANAGER']};
function setup(extra={}){const buckets=new Map();let state={count:3},allowed=true;
 const adapter={bucket(c,k){const key=c.tenant_id+':'+c.dealer_id+':'+k;if(!buckets.has(key))buckets.set(key,[]);return buckets.get(key);},persist(){}};
 const tool={id:'crm_summary',module:'crm',specialist:'CRM',effect:'READ',responsibility:'Read current CRM evidence',source_class:'CUSTOMER_TRUTH',authorize:()=>allowed,read:()=>({...state}),verify:(_c,_a,output)=>C.hash(output)===C.hash(state),...extra};
 return {engine:new AgentOrchestrator({adapter,tools:[tool]}),adapter,setState:x=>state=x,revoke:()=>allowed=false};
}
const input=(extra={})=>({objective:'Compare authorized facts',request_id:'request-one',steps:[{id:'crm',tool_id:'crm_summary'}],...extra});
test('source-verified plans store only receipts and replay without retaining private source content',async()=>{
 const s=setup();s.setState({private:'private source value'});const plan=s.engine.create(ctx,actor,input());
 const out=await s.engine.run(ctx,actor,plan.id);assert.equal(out.plan.state,'VERIFIED');assert.equal(out.evidence[0].data.private,'private source value');
 assert.ok(!JSON.stringify(s.adapter.bucket(ctx,BUCKET)).includes('private source value'));
 assert.equal((await s.engine.run(ctx,actor,plan.id)).source_refresh_required,true);
 assert.equal(s.engine.create(ctx,actor,input()).id,plan.id);
 assert.throws(()=>s.engine.create(ctx,actor,input({objective:'changed'})),{code:'zero_plan_request_conflict'});
});
test('plans cannot expose hidden tools, expand identity, cross tenants, create loops or duplicate steps',()=>{
 const s=setup(),plan=s.engine.create(ctx,actor,input());
 for(const [c,a]of [[{...ctx,tenant_id:'two'},actor],[ctx,{...actor,id:'admin',roles:['ADMIN']}]])assert.throws(()=>s.engine.get(c,a,plan.id),{code:'zero_plan_missing'});
 assert.throws(()=>s.engine.create(ctx,actor,input({steps:[{id:'a',tool_id:'crm_summary',depends_on:['a']}]})),{code:'zero_plan_dependency_invalid'});
 assert.throws(()=>s.engine.create(ctx,actor,input({steps:[{id:'a',tool_id:'crm_summary'},{id:'b',tool_id:'crm_summary'}]})),{code:'zero_plan_duplicate_step'});
 assert.throws(()=>s.engine.create(ctx,actor,input({steps:[{id:'a',tool_id:'crm_summary',roles:['ADMIN']}]})),{code:'zero_unknown_field'});
 s.revoke();assert.equal(s.engine.catalog(ctx,actor).tools.length,0);assert.throws(()=>s.engine.create(ctx,actor,input()),{code:'zero_agent_tool_denied'});
});
test('independent source verification rejects fabricated success and changed source values',async()=>{
 const s=setup({read:()=>({count:999,verified:true})}),plan=s.engine.create(ctx,actor,input());
 await assert.rejects(s.engine.run(ctx,actor,plan.id),{code:'zero_agent_verification_failed'});
 assert.equal(s.engine.get(ctx,actor,plan.id).state,'FAILED');
});
test('revocation while a tool is pending discards its output',async()=>{
 let release;const s=setup({read:()=>new Promise(resolve=>release=resolve)}),plan=s.engine.create(ctx,actor,input());
 const pending=s.engine.run(ctx,actor,plan.id);await new Promise(setImmediate);s.revoke();release({private:'must not escape'});
 await assert.rejects(pending,{code:'zero_agent_tool_denied'});assert.ok(!JSON.stringify(s.engine.get(ctx,actor,plan.id)).includes('must not escape'));
});
test('cancellation ends a pending read and restart does not silently repeat a plan',async()=>{
 const s=setup({read:()=>new Promise(()=>{})}),plan=s.engine.create(ctx,actor,input());
 const pending=s.engine.run(ctx,actor,plan.id);await new Promise(setImmediate);s.engine.cancel(ctx,actor,plan.id);
 await assert.rejects(pending,{code:'zero_plan_cancelled'});assert.equal(s.engine.get(ctx,actor,plan.id).state,'CANCELLED');
 const second=s.engine.create(ctx,actor,input({request_id:'another'}));s.adapter.bucket(ctx,BUCKET).find(r=>r.id===second.id).state='RUNNING';
 assert.equal(s.engine.get(ctx,actor,second.id).state,'INTERRUPTED');assert.equal((await s.engine.run(ctx,actor,second.id)).replayed,true);
});
test('source budget aborts before oversized context is handed to another worker',async()=>{
 const s=setup({read:()=>({private:'x'.repeat(65000)})}),plan=s.engine.create(ctx,actor,input());
 await assert.rejects(s.engine.run(ctx,actor,plan.id),{code:'zero_agent_context_budget'});
 assert.equal(s.engine.get(ctx,actor,plan.id).tool_calls,1);
});
