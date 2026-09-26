'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {fixture}=require('../zero-evaluation/fixture');
async function setup(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'foundly-probe-authority-')),file=name=>path.join(dir,name),set=control=>fs.writeFileSync(file('control.json'),JSON.stringify({payload:{},probe:true,...control}));set({});
 const f=await fixture({NODE_OPTIONS:'--require '+require.resolve('../zero-evaluation/connector-source-fixture'),FOUNDLY_SYNC_FIXTURE_DIR:dir});
 try{assert.equal((await f.request('/api/composition','PUT',{entitlements:['procurement','crm'],expected_revision:0})).status,200);assert.equal((await f.request('/api/connector-runtime/profile/rdw','PUT',{base_url:'https://source-sync.fixture.test',health:{path:'/health',method:'GET'}})).status,200);const member=await f.enroll('probe.authority.manager',['ADMIN']);
  return {...f,file,set,member,probe:()=>f.request('/api/connector-runtime/test/rdw','POST',{},member.cookie),fetches:()=>Number(fs.existsSync(file('fetches'))?fs.readFileSync(file('fetches'),'utf8'):0),async waitFor(name){for(let n=0;n<200&&!fs.existsSync(file(name));n++)await new Promise(resolve=>setTimeout(resolve,20));assert.ok(fs.existsSync(file(name)),name);},async revoke(){assert.equal((await f.request('/api/identity/users/'+member.member.id,'PUT',{roles:['VIEWER'],expected_revision:member.member.revision,confirm:true,reason:'Isolated provider verification rights revocation'})).status,200);},async close(){fs.writeFileSync(file('release'),'release');fs.writeFileSync(file('dns-release'),'release');await f.close();fs.rmSync(dir,{recursive:true,force:true});}};
 }catch(error){await f.close();fs.rmSync(dir,{recursive:true,force:true});throw error;}
}
for(const phase of ['DNS','provider']){
 test('native generic probe refuses rights revoked during '+phase,async()=>{
  const f=await setup();try{f.set(phase==='DNS'?{dns_wait:true}:{wait:true});const pending=f.probe();await f.waitFor(phase==='DNS'?'dns-started':'started');await f.revoke();fs.writeFileSync(f.file(phase==='DNS'?'dns-release':'release'),'resume');const result=await pending;assert.ok([401,403].includes(result.status),JSON.stringify(result.body));assert.equal(f.fetches(),phase==='DNS'?0:1,'A revoked principal must not release a new provider request');}finally{await f.close();}
 });
 test('native generic probe rejects configuration revision changed during '+phase,async()=>{
  const f=await setup();try{f.set(phase==='DNS'?{dns_wait:true}:{wait:true});const pending=f.probe();await f.waitFor(phase==='DNS'?'dns-started':'started');assert.equal((await f.request('/api/connector-runtime/config/rdw','PUT',{credentials:{}})).status,200);fs.writeFileSync(f.file(phase==='DNS'?'dns-release':'release'),'resume');const result=await pending;assert.equal(result.status,409,JSON.stringify(result.body));assert.equal(f.fetches(),phase==='DNS'?0:1);}finally{await f.close();}
 });
}
test('native generic probe rejects a changed runtime profile before accepting the old provider response',async()=>{
 const f=await setup();try{f.set({wait:true});const pending=f.probe();await f.waitFor('started');assert.equal((await f.request('/api/connector-runtime/profile/rdw','PUT',{health:{path:'/different-health',method:'GET'}})).status,200);fs.writeFileSync(f.file('release'),'resume');assert.equal((await pending).status,409);}finally{await f.close();}
});
test('native generic probe cannot return connector details after the owner module is disabled',async()=>{
 const f=await setup();try{f.set({wait:true});const pending=f.probe();await f.waitFor('started');assert.equal((await f.request('/api/composition','PUT',{entitlements:['crm'],expected_revision:1})).status,200);fs.writeFileSync(f.file('release'),'resume');assert.equal((await pending).status,403);}finally{await f.close();}
});
test('native generic probe preserves explicit provider failure and binds a current success to the configuration revision',async()=>{
 const f=await setup();try{f.set({status:401});const failed=await f.probe();assert.equal(failed.status,200);assert.equal(failed.body.connector.connected,false);f.set({});const success=await f.probe();assert.equal(success.status,200);assert.equal(success.body.connector.id,'rdw');assert.equal(success.body.connector.connected,true);assert.equal(success.body.connector.configuration_revision,0);}finally{await f.close();}
});
for(const route of ['encoded','custom'])test('native '+route+' connector probe retains the current owner module boundary',async()=>{
 const f=await setup();try{
  const id=route==='encoded'?'%72dw':'custom_probe';
  if(route==='custom')assert.equal((await f.request('/api/connector-runtime/profiles','POST',{id,naam:'Isolated owned source',auth_strategy:'public',modules:['inkoop'],base_url:'https://source-sync.fixture.test',health:{path:'/health',method:'GET'},credential_fields:[]})).status,201);
  f.set({wait:true});const pending=f.request('/api/connector-runtime/test/'+id,'POST',{},f.member.cookie);await f.waitFor('started');assert.equal((await f.request('/api/composition','PUT',{entitlements:['crm'],expected_revision:1})).status,200);fs.writeFileSync(f.file('release'),'resume');assert.equal((await pending).status,403);
 }finally{await f.close();}
});
