'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {fixture}=require('../zero-evaluation/fixture');
async function setup(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'foundly-source-sync-')),file=name=>path.join(dir,name),set=control=>fs.writeFileSync(file('control.json'),JSON.stringify(control));set({payload:[]});
 const f=await fixture({NODE_OPTIONS:'--require '+require.resolve('../zero-evaluation/connector-source-fixture'),FOUNDLY_SYNC_FIXTURE_DIR:dir});
 try{assert.equal((await f.request('/api/composition','PUT',{entitlements:['procurement','crm'],expected_revision:0})).status,200);assert.equal((await f.request('/api/connector-runtime/profile/rdw','PUT',{base_url:'https://source-sync.fixture.test',health:{path:'/health',method:'GET'},sync:{path:'/sync',method:'GET'}})).status,200);const member=await f.enroll('source.sync.manager',['ADMIN']);
  return {...f,file,set,member,fetches:()=>Number(fs.existsSync(file('fetches'))?fs.readFileSync(file('fetches'),'utf8'):0),sync:(key,extra={})=>f.request('/api/connector-runtime/sync/rdw','POST',{expected_revision:0},member.cookie,{'idempotency-key':key,...extra}),rows:async()=>{const r=await f.request('/api/module/data/data');assert.equal(r.status,200);return r.body.records.filter(row=>row.entity_type==='connector_source_observation');},async waiting(){for(let n=0;n<150&&!fs.existsSync(file('started'));n++)await new Promise(resolve=>setTimeout(resolve,20));assert.ok(fs.existsSync(file('started')));},async close(){fs.rmSync(file('fail-commit'),{force:true});fs.writeFileSync(file('release'),'release');await f.close();fs.rmSync(dir,{recursive:true,force:true});}};
 }catch(error){await f.close();fs.rmSync(dir,{recursive:true,force:true});throw error;}
}
test('native generic sync durably imports scoped source observations without promoting provider fields into customer truth',async()=>{
 const f=await setup();try{
  f.set({payload:[{id:'source-1',name:'Literal external <img>',long_text:'z'.repeat(9000),tenant_id:'forged',_source:'manual',provenance:{source_kind:'user_input'}},{id:'source-2',value:0}]});const r=await f.sync('source-page-one');assert.equal(r.status,200);assert.equal(r.body.ingested,2);assert.equal(r.body.target,'data');assert.equal(r.body.customer_objects_changed,false);assert.equal(r.body.source_complete,false);
  const rows=await f.rows();assert.equal(rows.length,2);assert.ok(rows.every(row=>row.tenant_id==='zero-evaluation'&&row.connector_id==='rdw'&&row.provenance.source_kind==='external_provider'));assert.equal(rows.find(row=>row.source_external_id==='source-1').source_payload.name,'Literal external <img>');assert.equal(rows.find(row=>row.source_external_id==='source-1').source_payload._source,'manual');assert.equal(rows.find(row=>row.source_external_id==='source-1').source_payload.long_text.length,9000);assert.equal(rows[0].provenance.observed_at,null,'A native ingestion time cannot invent the provider observation date');assert.ok(!fs.readFileSync(path.join(f.dir,'foundly-core-state.json'),'utf8').includes('Literal external <img>'));
  await f.stop();await f.start();assert.equal((await f.rows()).length,2);const before=f.fetches(),replay=await f.sync('source-page-one');assert.deepEqual(replay.body,r.body);assert.equal(f.fetches(),before,'Durable receipt must avoid another provider request');
  const registry=await f.request('/api/connector-registry/rdw');assert.equal(registry.status,200);assert.equal(registry.body.connector.records,2);assert.equal(registry.body.connector.sync_state,'PASS');
 }finally{await f.close();}
});
test('native sync rejects malformed, oversized or ambiguous pages without partial rows or success counts',async()=>{
 const f=await setup();try{
  for(const [i,control]of [{payload:null},{payload:{}},{payload:[{id:'duplicate',value:1},{id:'duplicate',value:2}]},{payload:Array.from({length:1001},(_,id)=>({id}))},{raw:'[{"id":"unsafe","value":9007199254740993}]'},{payload:[{id:'too-large',text:'x'.repeat(2*1024*1024)}]}].entries()){f.set(control);const r=await f.sync('invalid-page-'+i);assert.ok(r.status>=400,JSON.stringify(r.body));assert.equal((await f.rows()).length,0);}
  f.set({payload:[]});const empty=await f.sync('explicit-empty-page');assert.equal(empty.status,200);assert.equal(empty.body.ingested,0);
 }finally{await f.close();}
});
test('native generic sync rechecks member rights after a provider wait before any ingestion',async()=>{
 const f=await setup();try{
  f.set({payload:[{id:'must-not-persist'}],wait:true});const pending=f.sync('revoked-during-provider');await f.waiting();const changed=await f.request('/api/identity/users/'+f.member.member.id,'PUT',{roles:['VIEWER'],expected_revision:f.member.member.revision,confirm:true,reason:'Isolated sync rights revocation'});assert.equal(changed.status,200);fs.writeFileSync(f.file('release'),'resume');const r=await pending;assert.ok([401,403].includes(r.status),JSON.stringify(r.body));assert.equal((await f.rows()).length,0);
 }finally{await f.close();}
});
test('native sync refuses a changed connector configuration while its source response is pending',async()=>{
 const f=await setup();try{
  f.set({payload:[{id:'stale-configuration'}],wait:true});const pending=f.sync('changed-config-during-provider');await f.waiting();assert.equal((await f.request('/api/connector-runtime/config/rdw','PUT',{credentials:{}})).status,200);fs.writeFileSync(f.file('release'),'resume');const r=await pending;assert.equal(r.status,409);assert.equal((await f.rows()).length,0);
 }finally{await f.close();}
});
test('parallel native sync retries share one provider read and one receipt while new observations update only their source envelope',async()=>{
 const f=await setup();try{
  f.set({payload:[{id:'stable-source',value:1}],wait:true});const first=f.sync('parallel-source-page');await f.waiting();const second=f.sync('parallel-source-page');fs.writeFileSync(f.file('release'),'resume');const [a,b]=await Promise.all([first,second]);assert.equal(a.status,200);assert.deepEqual(a.body,b.body);assert.equal(f.fetches(),1);assert.equal((await f.rows()).length,1);
  f.set({payload:[{id:'stable-source',value:2}]});const changed=await f.sync('changed-source-page');assert.equal(changed.body.created,0);assert.equal(changed.body.updated,1);const rows=await f.rows();assert.equal(rows.length,1);assert.equal(rows[0].source_payload.value,2);
  const legacy=await f.request('/api/integration-sync/rdw','POST',{expected_revision:0},f.member.cookie,{'idempotency-key':'changed-source-page'});assert.deepEqual(legacy.body,changed.body);assert.equal(f.fetches(),2,'Both generic routes must share the same durable request contract');
 }finally{await f.close();}
});
test('native source import rolls back a failed disk commit and safely recovers a dropped acknowledgement',async()=>{
 const f=await setup();try{
  f.set({payload:[{id:'one-durable-source-row'}]});fs.writeFileSync(f.file('fail-commit'),'fail once');const failed=await f.sync('durable-page');fs.rmSync(f.file('fail-commit'));assert.ok(failed.status>=500);assert.equal((await f.rows()).length,0);
  await assert.rejects(f.sync('durable-page',{'x-zero-sync-drop-reply':'isolated-http-fixture'}));assert.equal((await f.rows()).length,1);await f.stop();await f.start();const count=f.fetches(),recovered=await f.sync('durable-page');assert.equal(recovered.status,200);assert.equal(recovered.body.ingested,1);assert.equal(f.fetches(),count);assert.equal((await f.rows()).length,1);
 }finally{await f.close();}
});
test('native source sync rechecks authority after DNS before releasing a provider request',async()=>{
 const f=await setup();try{
  f.set({payload:[{id:'must-not-request'}],dns_wait:true});const pending=f.sync('revoked-during-dns');for(let n=0;n<150&&!fs.existsSync(f.file('dns-started'));n++)await new Promise(resolve=>setTimeout(resolve,20));assert.ok(fs.existsSync(f.file('dns-started')));
  assert.equal((await f.request('/api/identity/users/'+f.member.member.id,'PUT',{roles:['VIEWER'],expected_revision:f.member.member.revision,confirm:true,reason:'Isolated rights revocation during DNS'})).status,200);fs.writeFileSync(f.file('dns-release'),'resume');const result=await pending;assert.ok([401,403].includes(result.status));assert.equal(f.fetches(),0,'An authority revoked during DNS must not release the provider request');
 }finally{fs.writeFileSync(f.file('dns-release'),'resume');await f.close();}
});
test('source import bodies require current connector management and remain hidden when the owning module is disabled',async()=>{
 const f=await setup();try{
  f.set({payload:[{id:'scoped-source',name:'Restricted source payload'}]});assert.equal((await f.sync('scoped-source-page')).status,200);const viewer=await f.enroll('source.import.reader',['VIEWER']);const r=await f.request('/api/module/data/data','GET',undefined,viewer.cookie);assert.ok([200,403].includes(r.status));assert.ok(!JSON.stringify(r.body).includes('Restricted source payload'));
  assert.equal((await f.request('/api/composition','PUT',{entitlements:['crm'],expected_revision:1})).status,200);assert.equal((await f.rows()).length,0,'A retained source must not bypass a disabled owner module through Core Data');
 }finally{await f.close();}
});
test('source sync publishes one durable native activity event atomically with its rows and receipt',async()=>{
 const f=await setup();try{
  const events=async()=>{const r=await f.request('/api/events');assert.equal(r.status,200);return r.body.events.filter(row=>row.type==='sync'&&row.meta?.connector==='rdw');};
  f.set({payload:[{id:'activity-source'}]});fs.writeFileSync(f.file('fail-commit'),'fail once');assert.ok((await f.sync('activity-source-page')).status>=500);fs.rmSync(f.file('fail-commit'));assert.equal((await events()).length,0);
  const committed=await f.sync('activity-source-page');assert.equal(committed.status,200);let rows=await events();assert.equal(rows.length,1);assert.equal(rows[0].meta.proof_id,committed.body.proof_id);assert.equal(rows[0].meta.customer_objects_changed,false);await f.stop();await f.start();assert.deepEqual((await f.sync('activity-source-page')).body,committed.body);assert.equal((await events()).length,1);
 }finally{await f.close();}
});
