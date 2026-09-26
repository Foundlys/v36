'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {fixture}=require('../zero-evaluation/fixture');
test('native connector receipt survives restart and replays without replacing a newer encrypted configuration',async()=>{
 const f=await fixture();try{
  assert.equal((await f.request('/api/composition','PUT',{entitlements:['communication'],expected_revision:0})).status,200);
  const member=await f.enroll('connector.recovery',['ADMIN']),route='/api/connector-runtime/config/email';
  const call=(method,body,key)=>f.request(route,method,body,member.cookie,key?{'idempotency-key':key}:{});
  const original=await call('GET');assert.equal(original.body.revision,0);
  const input={expected_revision:0,credentials:{smtp_user:'first recorded identity',smtp_password:'isolated secret value'}},first=await call('PUT',input,'first-confirmed-configuration');
  assert.equal(first.status,200);assert.equal(first.body.revision,1);assert.equal(first.body.request_id,'first-confirmed-configuration');
  const second=await call('PUT',{expected_revision:1,credentials:{smtp_user:'newer recorded identity'}},'second-confirmed-configuration');assert.equal(second.status,200);assert.equal(second.body.revision,2);
  await f.stop();await f.start();
  const replay=await call('PUT',input,'first-confirmed-configuration');assert.equal(replay.status,200);assert.deepEqual(replay.body,first.body);
  const actual=await call('GET');assert.equal(actual.body.revision,2);assert.equal(actual.body.config.credentials.smtp_user,'newer recorded identity');assert.ok(!JSON.stringify(actual.body).includes('isolated secret value'));
  const reused=await call('PUT',{...input,credentials:{smtp_user:'changed replay'}},'first-confirmed-configuration');assert.equal(reused.status,409);assert.equal(reused.body.code,'connector_request_conflict');
  const stale=await call('PUT',{expected_revision:0,credentials:{smtp_user:'stale writer'}},'stale-new-request');assert.equal(stale.status,409);assert.equal(stale.body.code,'connector_revision_conflict');assert.equal((await call('GET')).body.config.credentials.smtp_user,'newer recorded identity');
  for(const filename of fs.readdirSync(f.dir).filter(name=>/^connector-.*\.json$/.test(name))){const raw=fs.readFileSync(path.join(f.dir,filename),'utf8');assert.ok(!raw.includes('isolated secret value'));assert.ok(!raw.includes('newer recorded identity'));}
  const deleted=await call('DELETE');assert.equal(deleted.status,200);const afterDelete=await call('GET');assert.equal(afterDelete.body.configured,false);assert.equal(afterDelete.body.revision,3);
  assert.deepEqual((await call('PUT',input,'first-confirmed-configuration')).body,first.body);assert.equal((await call('GET')).body.configured,false,'A receipt retry must not resurrect deleted secrets');
 }finally{await f.close();}
});
test('native connector refuses corrupt encrypted state instead of replacing it with an empty configuration',async()=>{
 const f=await fixture();try{
  assert.equal((await f.request('/api/composition','PUT',{entitlements:['communication'],expected_revision:0})).status,200);
  const route='/api/connector-runtime/config/email';assert.equal((await f.request(route,'PUT',{credentials:{smtp_user:'original configuration'}})).status,200);
  await f.stop();const file=fs.readdirSync(f.dir).find(name=>/^connector-.*-email\.json$/.test(name));assert.ok(file);const target=path.join(f.dir,file);fs.writeFileSync(target,'{"encrypted":true,"data":"damaged"}');await f.start();
  const observed=await f.request(route);assert.equal(observed.status,503);assert.equal(observed.body.code,'connector_configuration_unreadable');
  const attempted=await f.request(route,'PUT',{credentials:{smtp_user:'must not replace'}});assert.equal(attempted.status,503);assert.equal(fs.readFileSync(target,'utf8'),'{"encrypted":true,"data":"damaged"}');
 }finally{await f.close();}
});
test('native connector does not return undeclared or explicitly secret credentials as readable metadata',async()=>{
 const f=await fixture();try{
  assert.equal((await f.request('/api/composition','PUT',{entitlements:['communication'],expected_revision:0})).status,200);
  const route='/api/connector-runtime/config/email';assert.equal((await f.request(route,'PUT',{credentials:{smtp_user:'permitted account name',pin:'isolated unclassified value'}})).status,200);const result=await f.request(route);assert.equal(result.body.config.credentials.smtp_user,'permitted account name');assert.ok(!JSON.stringify(result.body).includes('isolated unclassified value'));
 }finally{await f.close();}
});
test('native credential write recovers an actually dropped HTTP response with one durable revision',async()=>{
 const f=await fixture({NODE_OPTIONS:'--require '+require.resolve('../zero-evaluation/connector-ack-drop')});try{
  assert.equal((await f.request('/api/composition','PUT',{entitlements:['communication'],expected_revision:0})).status,200);
  const member=await f.enroll('connector.dropped.reply',['ADMIN']),route='/api/connector-runtime/config/email',input={expected_revision:0,credentials:{smtp_user:'one durable identity'}},headers={'idempotency-key':'dropped-response-proof'};
  await assert.rejects(f.request(route,'PUT',input,member.cookie,{...headers,'x-zero-connector-drop-reply':'isolated-http-fixture'}));
  const actual=await f.request(route,'GET',undefined,member.cookie);assert.equal(actual.body.revision,1);assert.equal(actual.body.config.credentials.smtp_user,'one durable identity');
  await f.stop();await f.start();const recovered=await f.request(route,'PUT',input,member.cookie,headers);assert.equal(recovered.status,200);assert.equal(recovered.body.request_id,'dropped-response-proof');assert.equal(recovered.body.revision,1);assert.equal((await f.request(route,'GET',undefined,member.cookie)).body.revision,1);
 }finally{await f.close();}
});
