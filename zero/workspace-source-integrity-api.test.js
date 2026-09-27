'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{fixture:server}=require('../zero-evaluation/fixture'),{fixture:page}=require('../zero-evaluation/workspace-page-fixture');
test('actual shared workspace controller exports current native member data and denies cached release after capability revocation and encrypted restart',async()=>{
 const native=await server();try{
  assert.equal((await native.request('/api/composition','PUT',{entitlements:['sales'],expected_revision:0})).status,200);const member=await native.enroll('workspace-source-manager',['MANAGER']);
  const created=await native.request('/api/sales/opportunities','POST',{title:'PRIVATE native workspace opportunity',value_cents:123,currency:'USD'},member.cookie);assert.equal(created.status,201,JSON.stringify(created.body));
  const f=page({workspaceId:'sales'});f.context.fetch=async(route,options={})=>{f.calls.push({route,options});const result=await native.request(route,options.method||'GET',options.body?JSON.parse(options.body):undefined,member.cookie,options.headers);return {ok:result.status>=200&&result.status<300,status:result.status,json:async()=>result.body};};
  await f.ui.loadWorkspaceData();assert.ok(f.nodes.recordRows.textContent.includes('PRIVATE native workspace opportunity'));await f.ui.exportRows();assert.equal(f.downloads.length,1);assert.ok(f.downloads[0].parts[0].includes('PRIVATE native workspace opportunity'));
  assert.equal((await native.request('/api/composition','PUT',{entitlements:[],expected_revision:1})).status,200);await f.ui.exportRows();assert.equal(f.downloads.length,1,'Native denial must prevent a second export of cached data');assert.equal(f.ui.state.snapshot,null);assert.equal(f.nodes.recordRows.textContent,'');
  await native.stop();await native.start();await f.ui.exportRows();assert.equal(f.downloads.length,1);assert.equal((await native.request('/api/workspaces/sales/snapshot','GET',undefined,member.cookie)).status,403);
 }finally{await native.close();}
});
