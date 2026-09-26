'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),http=require('node:http'),{fixture}=require('../zero-evaluation/fixture');
test('workspace dashboard current capability is checked after the authenticated body wait and before mutation or receipt replay',async()=>{
 for(const replay of [false,true]){
 const marker=path.join(os.tmpdir(),'workspace-body-'+crypto.randomUUID()),f=await fixture({NODE_OPTIONS:'--require '+path.resolve(__dirname,'../test-identity-body-barrier.js'),FOUNDLY_IDENTITY_BODY_BARRIER:marker});let outgoing;
 try{
  await f.request('/api/composition','PUT',{entitlements:['sales'],expected_revision:0});const member=await f.enroll('workspace-body-manager',['MANAGER']),route='/api/workspaces/sales/dashboard',initial=(await f.request(route,'GET',undefined,member.cookie)).body.dashboard,body=JSON.stringify({...initial,scope:'PERSONAL',name:'Must not persist after capability revocation'});
  if(replay)assert.equal((await f.request(route,'PUT',JSON.parse(body),member.cookie,{'if-match':String(initial.revision),'idempotency-key':'workspace-body-identity'})).status,201);
  const reply=new Promise((resolve,reject)=>{outgoing=http.request(f.base+route,{method:'PUT',headers:{cookie:member.cookie,origin:'https://foundly.example.test','content-type':'application/json','content-length':Buffer.byteLength(body),'if-match':String(initial.revision),'idempotency-key':'workspace-body-identity','x-identity-fixture-barrier':'body'}},response=>{let text='';response.on('data',b=>text+=b);response.on('end',()=>resolve({status:response.statusCode,body:JSON.parse(text)}));});outgoing.on('error',reject);outgoing.write(body.slice(0,5));});reply.catch(()=>{});
  for(let n=0;n<50&&!fs.existsSync(marker);n++)await new Promise(r=>setTimeout(r,20));assert.ok(fs.existsSync(marker));assert.equal((await f.request('/api/composition','PUT',{entitlements:[],expected_revision:1})).status,200);outgoing.end(body.slice(5));const response=await reply;assert.equal(response.status,403,JSON.stringify(response.body));
  await f.request('/api/composition','PUT',{entitlements:['sales'],expected_revision:2});assert.equal((await f.request(route,'GET',undefined,member.cookie)).body.dashboard.revision,initial.revision+(replay?1:0));
 }finally{outgoing?.destroy();if(fs.existsSync(marker))fs.unlinkSync(marker);await f.close();}
 }
});
