'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{fixture}=require('../zero-evaluation/fixture');
const inviteInput=username=>({username,display_name:'Literal private identity',roles:['VIEWER'],permissions:[],confirm:true,reason:'Isolated identity mutation recovery'});
test('native persistence failure rolls back the identity mutation and its recovery receipt together',async()=>{
 const dir=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'identity-fault-')),marker=path.join(dir,'fail'),f=await fixture({NODE_OPTIONS:'--require '+require.resolve('../zero-evaluation/identity-persistence-fault'),FOUNDLY_IDENTITY_FAIL_FILE:marker});
 try{
  assert.equal((await f.request('/api/composition','PUT',{entitlements:['crm'],expected_revision:0})).status,200);
  const initial=await f.request('/api/identity/users','POST',inviteInput('identity.rollback.existing'));assert.equal(initial.status,201);const member=initial.body.member,route='/api/identity/users/'+encodeURIComponent(member.id);
  const cases=[['/api/identity/users','POST',inviteInput('identity.rollback.new'),'identity-fault-invite-001'],[route+'/reissue','POST',{expected_revision:1,confirm:true,reason:'Atomic invitation renewal'},'identity-fault-reissue-001'],[route,'PUT',{expected_revision:2,status:'SUSPENDED',roles:['VIEWER'],confirm:true,reason:'Atomic access change'},'identity-fault-update-001']];
  for(const [endpoint,method,input,key]of cases){const before=(await f.request('/api/identity/users')).body;fs.writeFileSync(marker,'fail');let failed;try{failed=await f.request(endpoint,method,input,null,{'idempotency-key':key});}finally{fs.rmSync(marker,{force:true});}assert.equal(failed.status,500);assert.deepEqual((await f.request('/api/identity/users')).body,before);assert.equal((await f.request('/api/identity/requests/'+key)).status,404);const retry=await f.request(endpoint,method,input,null,{'idempotency-key':key});assert.ok([200,201].includes(retry.status));assert.equal(retry.body.request_id,key);assert.deepEqual((await f.request(endpoint,method,input,null,{'idempotency-key':key})).body,retry.body);}
  const recovery='/api/identity/requests/identity-fault-recovery-001',review={operation:'INVITE',target_id:null,expected_revision:0,confirm:true};fs.writeFileSync(marker,'fail');try{assert.equal((await f.request(recovery+'/recover','POST',review)).status,500);}finally{fs.rmSync(marker,{force:true});}assert.equal((await f.request(recovery)).status,404);assert.equal((await f.request(recovery+'/recover','POST',review)).body.status,'NOT_APPLIED');
  await f.stop();await f.start();assert.equal((await f.request('/api/identity/users')).body.items.find(row=>row.id===member.id).revision,3);assert.equal((await f.request(recovery)).body.status,'NOT_APPLIED');
 }finally{fs.rmSync(marker,{force:true});await f.close();fs.rmSync(dir,{recursive:true,force:true});}
});
test('real identity invitation recovers its dropped HTTP response and encrypted receipt after restart without duplicating a member',async()=>{
 const f=await fixture({NODE_OPTIONS:'--require '+require.resolve('../zero-evaluation/identity-ack-drop')});try{
  assert.equal((await f.request('/api/composition','PUT',{entitlements:['crm'],expected_revision:0})).status,200);
  const input=inviteInput('identity.lost.ack'),headers={'idempotency-key':'identity-invite-recovery-001'};
  await assert.rejects(f.request('/api/identity/users','POST',input,null,{...headers,'x-zero-identity-drop-reply':'isolated-http-fixture'}));
  const members=await f.request('/api/identity/users');assert.equal(members.body.items.filter(m=>m.username===input.username).length,1);
  await f.stop();await f.start();const replay=await f.request('/api/identity/users','POST',input,null,headers);assert.equal(replay.status,201);assert.equal(replay.body.request_id,headers['idempotency-key']);assert.equal(replay.body.operation,'INVITE');assert.equal(replay.body.member.id,members.body.items[0].id);assert.equal(replay.body.delivered,false);assert.match(replay.body.invite_token,/^[a-f0-9]{64}$/);
  const observed=await f.request('/api/identity/requests/'+headers['idempotency-key']);assert.equal(observed.status,200);assert.deepEqual(observed.body,replay.body);
  assert.equal((await f.request('/api/identity/users')).body.items.filter(m=>m.username===input.username).length,1);
  const raw=fs.readFileSync(path.join(f.dir,'foundly-core-state.json'),'utf8');for(const secret of [input.username,input.display_name,replay.body.invite_token])assert.ok(!raw.includes(secret));
  for(const route of ['/api/workspaces/data/snapshot','/api/identity/users'])assert.ok(!JSON.stringify((await f.request(route)).body).includes(replay.body.invite_token));
  const changed=await f.request('/api/identity/users','POST',{...input,display_name:'Different request'},null,headers);assert.equal(changed.status,409);assert.equal(changed.body.code,'identity_request_conflict');
 }finally{await f.close();}
});
test('native update and invitation reissue receipts are stable and older retries never resurrect invalid invitation tokens or access',async()=>{
 const f=await fixture();try{
  assert.equal((await f.request('/api/composition','PUT',{entitlements:['crm'],expected_revision:0})).status,200);
  const invited=await f.request('/api/identity/users','POST',inviteInput('identity.reissue'),null,{'idempotency-key':'identity-invite-reissue-001'});assert.equal(invited.status,201);
  const id=invited.body.member.id,route='/api/identity/users/'+encodeURIComponent(id),input={expected_revision:1,confirm:true,reason:'Explicit isolated invitation renewal'},headers={'idempotency-key':'identity-reissue-recovery-001'};
  const first=await f.request(route+'/reissue','POST',input,null,headers);assert.equal(first.status,200);const second=await f.request(route+'/reissue','POST',input,null,headers);assert.equal(second.status,200);assert.deepEqual(second.body,first.body);assert.equal(first.body.member.revision,2);
  const old=await f.request('/api/identity/requests/identity-invite-reissue-001');assert.equal(old.status,409);assert.equal(old.body.code,'identity_request_superseded');assert.ok(!JSON.stringify(old.body).includes(invited.body.invite_token));
  const update={expected_revision:2,status:'SUSPENDED',roles:['VIEWER'],confirm:true,reason:'Explicit isolated access revocation'},updateHeaders={'idempotency-key':'identity-update-recovery-001'};
  const updated=await f.request(route,'PUT',update,null,updateHeaders);assert.equal(updated.status,200);assert.equal(updated.body.member.revision,3);const replay=await f.request(route,'PUT',update,null,updateHeaders);assert.equal(replay.status,200);assert.deepEqual(replay.body,updated.body);
  const stale=await f.request(route+'/reissue','POST',input,null,headers);assert.equal(stale.status,409);assert.equal(stale.body.code,'identity_request_superseded');assert.ok(!JSON.stringify(stale.body).includes(first.body.invite_token));assert.equal((await f.request('/api/identity/users')).body.items.find(m=>m.id===id).status,'SUSPENDED');
 }finally{await f.close();}
});
test('identity receipts require the same current authorised actor and stay outside generic data routes',async()=>{
 const f=await fixture();try{
  assert.equal((await f.request('/api/composition','PUT',{entitlements:['crm'],expected_revision:0})).status,200);
  const first=await f.enroll('identity.receipt.admin',['SUPER_ADMIN']),other=await f.enroll('identity.receipt.other',['SUPER_ADMIN']),key='identity-owned-receipt-001',headers={'idempotency-key':key};
  const result=await f.request('/api/identity/users','POST',inviteInput('identity.receipt.invitee'),first.cookie,headers);assert.equal(result.status,201);
  const lookup='/api/identity/requests/'+key;assert.equal((await f.request(lookup,'GET',undefined,other.cookie)).status,404);assert.equal((await f.request(lookup,'GET',undefined,first.cookie)).status,200);
  const hidden=await f.request('/api/module/data/data','GET',undefined,first.cookie);assert.ok(!JSON.stringify(hidden.body).includes(result.body.invite_token));
  assert.equal((await f.request('/api/identity/users/'+encodeURIComponent(first.member.id),'PUT',{roles:['VIEWER'],expected_revision:first.member.revision,confirm:true,reason:'Revoke manager role'})).status,200);
  assert.equal((await f.request(lookup,'GET',undefined,first.cookie)).status,401);first.cookie=await f.login(first);assert.equal((await f.request(lookup,'GET',undefined,first.cookie)).status,403);
 }finally{await f.close();}
});
test('parallel native invitations with one request identity produce one durable member and one reusable receipt',async()=>{
 const f=await fixture();try{
  assert.equal((await f.request('/api/composition','PUT',{entitlements:['crm'],expected_revision:0})).status,200);const input=inviteInput('identity.parallel'),headers={'idempotency-key':'identity-parallel-request-001'};
  const [a,b]=await Promise.all([f.request('/api/identity/users','POST',input,null,headers),f.request('/api/identity/users','POST',input,null,headers)]);assert.equal(a.status,201);assert.equal(b.status,201);assert.deepEqual(a.body,b.body);assert.equal((await f.request('/api/identity/users')).body.items.length,1);
  await f.stop();await f.start();assert.deepEqual((await f.request('/api/identity/requests/'+headers['idempotency-key'])).body,a.body);
 }finally{await f.close();}
});
test('native recovery wins against a real incomplete HTTP body and its terminal receipt survives encrypted restart',async()=>{
 const f=await fixture();let held;try{
  assert.equal((await f.request('/api/composition','PUT',{entitlements:['crm'],expected_revision:0})).status,200);const key='identity-held-body-request',input=inviteInput('identity.held.body'),body=JSON.stringify(input),review={operation:'INVITE',target_id:null,expected_revision:0,confirm:true};
  const response=new Promise((resolve,reject)=>{held=require('node:http').request(f.base+'/api/identity/users',{method:'POST',headers:{authorization:'Bearer '+f.env.FOUNDLY_ADMIN_TOKEN,origin:f.env.FOUNDLY_PUBLIC_BASE_URL,'content-type':'application/json','content-length':Buffer.byteLength(body),'idempotency-key':key}},res=>{let data='';res.on('data',part=>data+=part);res.on('end',()=>resolve({status:res.statusCode,body:JSON.parse(data)}));});held.on('error',reject);held.flushHeaders();held.write(body.slice(0,body.length-1));});
  const result=await f.request('/api/identity/requests/'+key+'/recover','POST',review);assert.equal(result.status,200);assert.equal(result.body.status,'NOT_APPLIED');held.end(body.slice(-1));const late=await response;assert.equal(late.status,409);assert.equal(late.body.code,'identity_request_abandoned');assert.equal((await f.request('/api/identity/users')).body.items.length,0);
  await f.stop();await f.start();assert.deepEqual((await f.request('/api/identity/requests/'+key)).body,result.body);assert.equal((await f.request('/api/identity/users','POST',input,null,{'idempotency-key':key})).body.code,'identity_request_abandoned');
  const created=await f.request('/api/identity/users','POST',input,null,{'idempotency-key':'identity-fresh-body-request'});assert.equal(created.status,201);assert.deepEqual((await f.request('/api/identity/requests/identity-fresh-body-request/recover','POST',review)).body,created.body);
 }finally{held?.destroy();await f.close();}
});
