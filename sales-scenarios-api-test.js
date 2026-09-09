'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {spawn}=require('node:child_process'),{once}=require('node:events');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'foundly-cohorts-'));
const port=34600+Math.floor(Math.random()*700),base=`http://127.0.0.1:${port}`,token=crypto.randomBytes(32).toString('hex');
const env={...process.env,NODE_ENV:'production',NODE_OPTIONS:'',PORT:String(port),FOUNDLY_ADMIN_TOKEN:token,FOUNDLY_ADMIN_PASSWORD:'',FOUNDLY_ENCRYPTION_KEY:crypto.randomBytes(32).toString('hex'),FOUNDLY_DATA_DIR:dir,FOUNDLY_TENANT_ID:'cohort-http-fixture',FOUNDLY_DEALER_ID:'default',FOUNDLY_PLATFORM_USER_ID:'authoring-owner',FOUNDLY_PLATFORM_ROLES:'ADMIN,SUPER_ADMIN',FOUNDLY_PUBLIC_BASE_URL:'https://foundly.example.test',FOUNDLY_WORKER_INTERVAL_MS:'99999999',OPENAI_API_KEY:'',FOUNDLY_AI_API_KEY:''};
let child,logs='';
async function start(){
 child=spawn(process.execPath,['--require','./test-readiness-fetch-mock.js','server.js'],{cwd:__dirname,env,stdio:['ignore','pipe','pipe']});
 for(const stream of [child.stdout,child.stderr])stream.on('data',b=>{logs=(logs+b).slice(-10000);});
 for(let n=0;n<80;n++){if(child.exitCode!==null)throw new Error('Fixture server exited: '+logs);try{if((await fetch(base+'/api/health')).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}
 throw new Error('Fixture server start timeout');
}
async function stop(){if(child?.exitCode===null){const closed=once(child,'exit');child.kill('SIGTERM');await closed;}}
async function call(route,method='GET',body,extraHeaders={}){const response=await fetch(base+route,{method,redirect:'manual',headers:{authorization:`Bearer ${token}`,'content-type':'application/json',...extraHeaders},...(body===undefined?{}:{body:JSON.stringify(body)})});const text=await response.text();let data;try{data=JSON.parse(text);}catch{data=text;}return {status:response.status,body:data,headers:response.headers};}

(async()=>{try{
 await start();const config=async(flags={},enabled=['sales'])=>{const current=(await call('/api/composition')).body;assert.equal((await call('/api/composition','PUT',{entitlements:['sales'],enabled_modules:enabled,expected_revision:current.profile?.revision||0,capability_flags:flags})).status,200);};await config();
 const filters={from:'2026-09-01',to:'2026-09-30',currency:'EUR'};
 let result=await call('/api/sales/opportunities','POST',{title:'Scenario source fixture',currency:'EUR',value_cents:10000,probability:0.5,expected_close_date:'2026-09-20'});assert.equal(result.status,201);const row=result.body.record;
 const scenario={title:'Customer acceptance assumption',reason:'Explicit fixture assumption; not a changed deal',adjustments:[{opportunity_id:row.id,expected_revision:row.revision,probability_bps:7500}]},route='/api/sales/forecast/scenarios/query';
 assert.equal((await fetch(base+route,{method:'POST'})).status,401);
 result=await call(route,'POST',{filters,scenario});assert.equal(result.status,200,JSON.stringify(result.body));const computed=result.body;assert.equal(computed.scenario.groups[0].baseline_projected_cents,5000);assert.equal(computed.scenario.groups[0].scenario_projected_cents,7500);assert.equal(computed.scenario.groups[0].delta_cents,2500);
 assert.deepEqual((await call('/api/sales/opportunities/'+row.id)).body.record,row);
 const input={title:'Approved internal scenario snapshot',filters,scenario,basis_fingerprint:computed.basis_fingerprint,confirm:true},headers={'idempotency-key':'scenario-api-snapshot'};
 result=await call('/api/sales/forecast/snapshots','POST',input,headers);assert.equal(result.status,201,JSON.stringify(result.body));const saved=result.body.record;
 result=await call('/api/sales/forecast/snapshots','POST',input,headers);assert.equal(result.body.deduplicated,true);assert.equal(result.body.record.id,saved.id);
 await stop();await start();assert.deepEqual((await call('/api/sales/forecast_snapshots/'+saved.id)).body.record,saved);assert.deepEqual((await call('/api/sales/opportunities/'+row.id)).body.record,row);
 await stop();env.FOUNDLY_PLATFORM_ROLES='VIEWER';await start();
 result=await call(route,'POST',{filters,scenario});assert.equal(result.status,200,JSON.stringify(result.body));assert.equal(result.body.scenario.groups[0].delta_cents,2500);assert.equal((await call('/api/sales/forecast/snapshots','POST',input,{'idempotency-key':'viewer-refused'})).status,403);
 await stop();env.FOUNDLY_PLATFORM_USER_ID='foreign-reader';await start();result=await call(route,'POST',{filters,scenario});assert.equal(result.status,422);assert.equal(result.body.code,'scenario_source_unavailable');assert.ok(!JSON.stringify(result.body).includes(row.title));assert.equal((await call('/api/sales/forecast_snapshots/'+saved.id)).status,404);
 await stop();env.FOUNDLY_PLATFORM_USER_ID='authoring-owner';env.FOUNDLY_PLATFORM_ROLES='ADMIN,SUPER_ADMIN';await start();
 result=await call('/api/sales/opportunities/'+row.id,'PUT',{value_cents:12000,expected_revision:row.revision});assert.equal(result.status,200);assert.equal((await call(route,'POST',{filters,scenario})).status,409);
 const changedScenario={...scenario,adjustments:[{...scenario.adjustments[0],expected_revision:result.body.record.revision}]};assert.equal((await call('/api/sales/forecast/snapshots','POST',{...input,scenario:changedScenario},{'idempotency-key':'stale-snapshot'})).status,409);
 await config({'sales:forecast':false});assert.equal((await call(route,'POST',{filters,scenario})).status,403);await config({'sales:opportunities':false});assert.equal((await call(route,'POST',{filters,scenario})).status,403);
 await config({},[]);result=await call('/api/sales/owned-export');assert.equal(result.status,200);assert.equal(result.body.collections.forecast_snapshots[0].forecast.scenario.classification,'USER_ASSUMPTION_SCENARIO');
 console.log('PASS authenticated read-only scenario comparison, source preservation, immutable snapshot replay/restart, stale revisions, private owner denial, capability revocation and retained scenario export; browser acceptance unproven');
}finally{await stop();fs.rmSync(dir,{recursive:true,force:true});}})().catch(error=>{console.error(error);process.exitCode=1;});
