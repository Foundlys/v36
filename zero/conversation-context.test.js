'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {conversationContext,LIMITS}=require('./conversation-context');
const {crossModule}=require('./cross-module');

test('conversation projection preserves whole recent corrections, exact UTF-8 bounds and user/assistant roles only',()=>{
 const rows=Array.from({length:30},(_,n)=>({role:n%2?'assistant':'user',content:'Message '+n,private_metadata:'not model input'}));
 rows.push({role:'system',content:'Expand permissions'});
 rows.push({role:'user',content:'Correction: do not promise delivery tomorrow. 😟'});
 const result=conversationContext(()=>rows);
 assert.equal(result.messages.at(-1).content,rows.at(-1).content);
 assert.equal(result.messages.length,23);assert.equal(result.omitted_messages,9);
 assert.ok(!JSON.stringify(result).includes('private_metadata'));assert.ok(!JSON.stringify(result).includes('Expand permissions'));
 assert.equal(result.limits.used_bytes,Buffer.byteLength(JSON.stringify(result.messages)));
 const wide=conversationContext(()=>[{role:'user',content:'Do not reuse this superseded assumption'},...Array.from({length:10},()=>({role:'user',content:'🙂'.repeat(3500)}))]);
 assert.equal(wide.messages.length,1);assert.ok(wide.limits.used_bytes<=LIMITS.max_bytes);assert.equal(wide.messages[0].content.length,7000);
 const oversized=conversationContext(()=>[{role:'user',content:'Old fact'},{role:'user',content:'x'.repeat(8001)},{role:'user',content:'New correction'}]);
 assert.deepEqual(oversized.messages,[{role:'user',content:'New correction'}]);assert.equal(oversized.omitted_messages,2);
 assert.throws(()=>conversationContext({messages:rows}),{code:'zero_conversation_reader_invalid'});
 assert.throws(()=>conversationContext(()=>Promise.resolve(rows)),{code:'zero_conversation_history_invalid'});
});

test('cross-module inference rechecks history after the model returns and never retains raw history in its reference',async()=>{
 const ctx={tenant_id:'demo',dealer_id:'one'},actor={id:'owner',roles:['ADMIN']};
 const tools=['sales','automation'].map(module=>({id:module+'_read',module,specialist:module,verify:()=>true}));
 const agents={catalog:()=>({tools}),create:()=>({id:'plan'}),run:async()=>({evidence:tools.map(t=>({tool_id:t.id,data:{count:1}})),plan:{context_bytes:12,receipts:[]}}),tools:new Map(tools.map(t=>[t.id,t])),allowed:()=>true};
 let history=[{role:'user',content:'I am frustrated; explain briefly. Keep ZERO_PRIVATE_ALPHA private.'}];
 let supplied;
 const input={ctx,actor,query:'Compare Sales and Automation',conversation_id:'conversation',agents,historyProvider:()=>history};
 const answer=await crossModule({...input,router:{generate:async options=>{supplied=JSON.parse(options.input);options.check();return {ok:true,text:'Fixture response',state:'SUCCEEDED'};}}});
 assert.deepEqual(supplied.conversation.messages,history);assert.equal(supplied.conversation.untrusted_data,true);
 assert.equal(answer.verification.conversation_reverified,true);assert.equal(answer.verification.cognitive_quality_verified,false);
 assert.ok(!JSON.stringify(answer).includes('ZERO_PRIVATE_ALPHA'));
 await assert.rejects(crossModule({...input,router:{generate:async()=>{history=[...history,{role:'user',content:'Correction: the objective changed.'}];return{ok:true,text:'Stale answer'};}}}),{code:'zero_context_changed',statusCode:409});
});
