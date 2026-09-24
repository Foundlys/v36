'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{fixture}=require('../zero-evaluation/fixture');
const {fixture:page}=require('../zero-evaluation/workspace-page-fixture');
test('native workspace dashboard exact request replay survives later writes and encrypted restart without another revision',async()=>{
 const f=await fixture();try{
  await f.request('/api/composition','PUT',{entitlements:['sales'],expected_revision:0});const member=await f.enroll('workspace-replay-manager',['MANAGER']),route='/api/workspaces/sales/dashboard?scope=PERSONAL',initial=(await f.request(route,'GET',undefined,member.cookie)).body.dashboard,body={...initial,scope:'PERSONAL',name:'Private original dashboard'},headers={'if-match':String(initial.revision),'idempotency-key':'workspace-original-save'};
  const first=await f.request(route,'PUT',body,member.cookie,headers);assert.equal(first.status,201);const replay=await f.request(route,'PUT',body,member.cookie,headers);assert.equal(replay.status,200,JSON.stringify(replay.body));assert.deepEqual(replay.body.dashboard,first.body.dashboard);assert.equal(replay.body.idempotent_replay,true);
  const later=await f.request(route,'PUT',{...first.body.dashboard,name:'Private later dashboard'},member.cookie,{'if-match':String(first.body.dashboard.revision),'idempotency-key':'workspace-later-save'});assert.equal(later.status,200);assert.equal((await f.request(route,'PUT',{...body,name:'Changed payload'},member.cookie,headers)).status,409);
  await f.stop();await f.start();const restored=await f.request(route,'PUT',body,member.cookie,headers);assert.equal(restored.status,200);assert.deepEqual(restored.body.dashboard,first.body.dashboard);assert.deepEqual((await f.request(route,'GET',undefined,member.cookie)).body.dashboard,later.body.dashboard);
  assert.equal((await f.request('/api/composition','PUT',{entitlements:[],expected_revision:1})).status,200);assert.equal((await f.request(route,'PUT',body,member.cookie,headers)).status,403);
 }finally{await f.close();}
});
test('actual shared controller retries a committed native save after a lost reply and encrypted restart',async()=>{
 const native=await fixture();try{
  await native.request('/api/composition','PUT',{entitlements:['sales'],expected_revision:0});const member=await native.enroll('workspace-controller-retry',['MANAGER']),f=page({workspaceId:'sales'}),writes=[];let lose=true;
  f.context.fetch=async(route,options={})=>{const result=await native.request(route,options.method||'GET',options.body?JSON.parse(options.body):undefined,member.cookie,options.headers);if(options.method==='PUT'){writes.push({route,options:JSON.parse(JSON.stringify(options))});if(lose){lose=false;assert.equal(result.status,201);throw Error('Lost committed native acknowledgement');}}return {ok:result.status>=200&&result.status<300,status:result.status,json:async()=>result.body};};
  await f.ui.loadWorkspaceData();f.ui.toggleEditing(true);f.nodes.dateFrom.value='2026-09-01';await f.ui.saveDashboard();assert.equal(f.nodes.dateFrom.disabled,true);await native.stop();await native.start();await f.ui.loadWorkspaceData();await f.ui.saveDashboard();assert.deepEqual(writes[1],writes[0]);assert.equal(f.ui.state.dashboard.revision,1);assert.equal(f.ui.state.dashboard.filters.from,'2026-09-01');assert.equal(f.nodes.dateFrom.disabled,false);assert.equal((await native.request('/api/workspaces/sales/dashboard','GET',undefined,member.cookie)).body.dashboard.revision,1);
 }finally{await native.close();}
});
test('workspace dashboard rejects malformed request identity before a native layout or receipt is written',async()=>{
 const f=await fixture();try{
  await f.request('/api/composition','PUT',{entitlements:['sales'],expected_revision:0});const route='/api/workspaces/sales/dashboard',initial=(await f.request(route)).body.dashboard,result=await f.request(route,'PUT',{...initial,scope:'PERSONAL'},null,{'if-match':String(initial.revision),'idempotency-key':'malformed key'});assert.equal(result.status,422);assert.equal((await f.request(route)).body.dashboard.revision,initial.revision);
 }finally{await f.close();}
});
test('failed workspace dashboard persistence rolls back the request receipt as well as layout and audit',async()=>{
 const f=await fixture({NODE_OPTIONS:'--require '+path.resolve(__dirname,'../test-dashboard-persist-fault.js')});try{
  await f.request('/api/composition','PUT',{entitlements:['sales'],expected_revision:0});const route='/api/workspaces/sales/dashboard',initial=(await f.request(route)).body.dashboard,input={...initial,scope:'PERSONAL',name:'Retry after failed disk write'},headers={'if-match':String(initial.revision),'idempotency-key':'workspace-persist-retry'},marker=path.join(f.dir,'fixture-dashboard-write-failure');fs.writeFileSync(marker,'isolated fixture');assert.ok((await f.request(route,'PUT',input,null,headers)).status>=400);fs.unlinkSync(marker);assert.equal((await f.request(route)).body.dashboard.revision,initial.revision);await f.stop();await f.start();const saved=await f.request(route,'PUT',input,null,headers);assert.equal(saved.status,201);assert.equal(saved.body.dashboard.revision,initial.revision+1);const replay=await f.request(route,'PUT',input,null,headers);assert.equal(replay.status,200);assert.equal(replay.body.idempotent_replay,true);assert.deepEqual(replay.body.dashboard,saved.body.dashboard);
 }finally{const marker=path.join(f.dir,'fixture-dashboard-write-failure');if(fs.existsSync(marker))fs.unlinkSync(marker);await f.close();}
});
