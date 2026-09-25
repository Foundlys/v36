'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {buildConnectorRegistry,buildSourceRegistry}=require('../foundly-registry');
const registry={observed:{naam:'Literal observed source',auth:'api_key',modules:['data'],capabilities:['tenant_credentials']}},profiles={observed:{credential_fields:[{key:'pin',label:'Literal secret label'}]}};
function observe(row={},counts={},extra={}){return buildConnectorRegistry({registry,profiles,statuses:[{id:'observed',...row}],recordsBySource:counts,...extra})[0];}
test('connector registry requires actual booleans for configured, authentication, probe and sync success',()=>{
 for(const value of ['false','true',1,{},[]]){const c=observe({configured:value,connected:value,authenticated:value,token_stored:value,probe_ok:value,initial_sync_ok:value},{observed:0});assert.notEqual(c.connection_state,'CONNECTED');assert.notEqual(c.configuration_state,'CONFIGURED');assert.notEqual(c.authentication_state,'AUTHENTICATED');assert.notEqual(c.probe_state,'PASS');assert.notEqual(c.sync_state,'PASS');}
});
test('stored tokens are not proof of successful provider authentication',()=>{
 const c=observe({configured:true,token_stored:true,connected:false,probe_ok:false});assert.equal(c.connection_state,'CONFIGURED');assert.equal(c.authentication_state,'NOT_VERIFIED');
});
test('retained source records do not prove that a native synchronization or bootstrap succeeded',()=>{
 const c=observe({configured:true,connected:true,probe_ok:true},{observed:12});assert.equal(c.records,12);assert.notEqual(c.sync_state,'PASS');assert.notEqual(c.connection_state,'CONNECTED');
});
test('missing or malformed connector latency is unknown and actual zero is preserved',()=>{
 for(const value of [undefined,null,'',false,true,'12',-1,Infinity,NaN])assert.equal(observe({latency_ms:value}).latency,null,'Invalid latency '+String(value));assert.equal(observe({latency_ms:0}).latency,0);assert.equal(observe({latency_ms:12.5}).latency,12.5);
});
test('connector count coverage distinguishes missing observations from an explicitly observed zero',()=>{
 assert.equal(observe().records,null);assert.equal(observe({}, {},{countsComplete:true}).records,0);
 for(const value of [null,undefined,'',false,'3',-1,.5,Number.MAX_SAFE_INTEGER+1]){const c=observe({}, {observed:value},{countsComplete:true});assert.equal(c.records,null);assert.equal(buildSourceRegistry({connectors:[c]}).find(r=>r.source_id==='observed').records_available,null);}
 assert.equal(observe({}, {observed:0}).records,0);
});
test('connector registry masks credential fields by default unless their declared contract marks them nonsecret',()=>{
 assert.equal(observe().credential_contract.fields[0].secret,true);
});
test('unknown connector configuration and authentication stay unknown in the source projection',()=>{
 const c=observe(),s=buildSourceRegistry({connectors:[c]}).find(r=>r.source_id==='observed');assert.equal(c.connection_state,'UNKNOWN');assert.equal(c.configuration_state,'UNKNOWN');assert.equal(c.authentication_state,'UNKNOWN');assert.equal(s.configured,null);assert.equal(s.authenticated,null);
});
test('contradictory probe flags cannot create a passed probe or a connected lifecycle',()=>{
 const c=observe({configured:true,connected:true,probe_ok:false,initial_sync_ok:true});assert.notEqual(c.probe_state,'PASS');assert.notEqual(c.connection_state,'CONNECTED');
});
test('explicit successful native probe and bootstrap preserve a positive connected observation',()=>{
 const c=observe({configured:true,connected:true,probe_ok:true,initial_sync_ok:true,latency_ms:0},{observed:0});assert.equal(c.connection_state,'CONNECTED');assert.equal(c.probe_state,'PASS');assert.equal(c.sync_state,'PASS');assert.equal(c.records,0);assert.equal(c.latency,0);
});
