'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const C=require('./contracts'),{isReadFollowup,reference}=require('./native-followup');
test('bounded native read follow-ups never grant action authority or absorb a new subject',()=>{
 for(const q of ['Maak het korter.','Leg dat kort uit','Geef me één volgende controle','Waarom die keuze?','Make it shorter','Explain that briefly','Give me the next check','Mach es kürzer','Explique cela brièvement','Hazlo más breve','Gør det kortere','Gjør det kortere','Gör det kortare'])assert.equal(isReadFollowup(q),true,q);
 for(const q of ['ja','doe dat','voer het uit','Maak het korter en verstuur het','Maak het korter. Maak een taak.','Leg uit waarom auto’s duur zijn','Leg Sales kort uit','What is tomorrow’s weather?','Correction: prioritize revenue','',null])assert.equal(isReadFollowup(q),false,String(q));
});
test('native continuation references require the exact latest owned, read-only conversation pair',()=>{
 const at='2026-09-27T00:00:00Z',message='Compare Sales and Automation';
 const rows=[{role:'user',at,owner_id:'alice',content:message},{role:'assistant',at,owner_id:'alice',content:'Retained read notice'}];
 const audit={owner_id:'alice',timestamp:at,transcript:message,turn_id:'prior-turn',actions:[],result_snapshot:{actions:[],plan:{agent_plan_id:'prior-plan'},verification:{source_reverified:true},zero_context_reference:{message_hash:C.hash(message),read_only:true,native_modules:['sales','automation']}}};
 assert.deepEqual(reference(rows,audit),{turn_id:'prior-turn',analysis_id:'prior-plan',modules:['sales','automation']});
 for(const change of [a=>a.owner_id='bob',a=>a.transcript='Changed',a=>a.timestamp='other',a=>a.turn_id=null,a=>a.actions=[{status:'executed'}],a=>a.result_snapshot.actions=[{}],a=>a.result_snapshot.verification.source_reverified=false,a=>a.result_snapshot.zero_context_reference.read_only='true',a=>a.result_snapshot.zero_context_reference.message_hash='forged',a=>a.result_snapshot.zero_context_reference.native_modules=['sales','sales'],a=>a.result_snapshot.zero_context_reference.native_modules=['sales','unknown'],a=>a.result_snapshot.plan.agent_plan_id=null]){const bad=C.clone(audit);change(bad);assert.equal(reference(rows,bad),null);}
 assert.equal(reference([...rows,{role:'user',at,owner_id:'alice',content:'New subject'}],audit),null);
 assert.equal(reference([{...rows[0],owner_id:'bob'},rows[1]],audit),null);
 const out=reference(rows,audit);out.modules.push('crm');assert.equal(audit.result_snapshot.zero_context_reference.native_modules.length,2);
});
