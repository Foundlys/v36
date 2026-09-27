'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
test('social collection retains the exact uncertain request and stops without replay after an actual HTTP response is lost',async()=>{
 const fixtures=require('../zero-evaluation/fixture'),original=fixtures.fixture,dir=fs.mkdtempSync(path.join(os.tmpdir(),'social-trace-failure-')),output=path.join(dir,'trace.json');let calls=0;
 fixtures.fixture=async options=>{const f=await original(options),request=f.request;f.request=async(...args)=>{const result=await request(...args);if(args[0]==='/api/zero/turn'&&++calls===2)throw Object.assign(Error('Isolated lost response after native HTTP completed'),{name:'TimeoutError'});return result;};return f;};
 try{
  const {collect}=require('../zero-evaluation/social-collect');await assert.rejects(collect({industry:'ECOMMERCE',seed:false,caseIds:['cross-module-correction'],output}),{name:'TimeoutError'});
  const report=JSON.parse(fs.readFileSync(output,'utf8')),item=report.cases[0];assert.equal(calls,2);assert.equal(report.completed_at,undefined);assert.equal(item.status,'TRANSPORT_OR_NATIVE_FAILURE');assert.equal(item.turns[0].transport_state,'RESPONSE_RECEIVED');assert.equal(item.turns[0].response.status,200);
  assert.equal(item.turns[1].transport_state,'NO_RESPONSE');assert.equal(item.turns[1].request.message,require('../zero-evaluation/social-corpus.v1.json').cases.find(c=>c.id===item.id).turns[1]);assert.ok(item.turns[1].request.turn_id);assert.equal(item.turns[1].response,undefined);assert.equal(report.quality_status,'UNVERIFIED_REQUIRES_INDEPENDENT_REVIEW');assert.equal(report.demo_acceptance,false);
 }finally{fixtures.fixture=original;fs.rmSync(dir,{recursive:true,force:true});}
});
