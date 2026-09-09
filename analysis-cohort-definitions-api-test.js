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
 await start();const config=async(flags={},enabled=['analysis'])=>{const current=(await call('/api/composition')).body;assert.equal((await call('/api/composition','PUT',{entitlements:['analysis'],enabled_modules:enabled,expected_revision:current.profile?.revision||0,capability_flags:flags})).status,200);};await config();
 const route='/api/analysis/cohort_definitions',query={from:'2026-01-01T00:00:00Z',to:'2026-02-01T00:00:00Z',identity_field:'customer_id',acquisition_event:'customer_joined',return_event:'customer_returned',interval_days:7,periods:3},input={title:'Retained January fixture',owner_id:'cohort-reader',cohort_definition:query},headers={'idempotency-key':'cohort-definition-create-fixture'};
 assert.equal((await fetch(base+route)).status,401);
 let result=await call(route,'POST',input,headers);assert.equal(result.status,201,JSON.stringify(result.body));let row=result.body.record;
 result=await call(route,'POST',input,headers);assert.equal(result.status,200);assert.equal(result.body.record.id,row.id);assert.equal((await call(route)).body.total,1);
 const page=await call('/analysis');for(const id of ['cohortDefinitionsForm','cohortSaveDefinitionForm','cohortSavedDefinition'])assert.ok(page.body.includes('id="'+id+'"'));
 const source={event_name:'customer_joined',occurred_at:'2026-01-02T00:00:00Z',source:'fixture',customer_id:'visible',permissions:{user_ids:['cohort-reader']},consent_context:{purpose:'cohort_fixture',legal_basis:'contract'}};
 assert.equal((await call('/api/platform/events/ingest','POST',{...source,event_id:'definition-readable'})).status,202);
 assert.equal((await call('/api/platform/events/ingest','POST',{...source,event_id:'definition-private',customer_id:'private',permissions:{user_ids:['authoring-owner']}})).status,202);
 const run=()=>route+'/'+row.id+'/query?expected_revision='+row.revision;
 await stop();env.FOUNDLY_PLATFORM_ROLES='VIEWER';env.FOUNDLY_PLATFORM_USER_ID='cohort-reader';await start();
 assert.equal((await call(route)).body.total,1);assert.deepEqual((await call(route+'/'+row.id)).body.record,row);
 result=await call(run());assert.equal(result.status,200,JSON.stringify(result.body));assert.equal(result.body.sample_size,1);assert.equal(result.body.definition_reference.id,row.id);assert.equal(result.body.saved_result,false);assert.ok(!JSON.stringify(result.body).includes('definition-private'));const report=result.body;
 assert.equal((await call(route,'POST',input)).status,403);assert.equal((await call(run()+'&owner_id=authoring-owner')).status,422);
 await stop();await start();assert.deepEqual((await call(run())).body,report);
 await stop();env.FOUNDLY_PLATFORM_USER_ID='unrelated-reader';await start();assert.equal((await call(route)).body.total,0);assert.equal((await call(run())).status,404);
 await stop();env.FOUNDLY_PLATFORM_USER_ID='authoring-owner';env.FOUNDLY_PLATFORM_ROLES='ADMIN,SUPER_ADMIN';await start();
 result=await call(route+'/'+row.id,'PUT',{title:'Reviewed definition',expected_revision:row.revision});assert.equal(result.status,200);assert.equal((await call(run())).status,409);row=result.body.record;
 await config({'analysis:events':false});assert.equal((await call(route)).status,200);assert.equal((await call(run())).status,403);
 await config({'analysis:reports':false});assert.equal((await call(route)).status,403);assert.equal((await call(run())).status,403);
 await config({},[]);assert.equal((await call(route)).status,403);result=await call('/api/analysis/owned-export');assert.equal(result.status,200);assert.equal(result.body.collections.cohort_definitions[0].id,row.id);
 console.log('PASS authenticated saved cohort definitions, create replay, read-only/current owner execution, private source exclusion, stale revision refusal, encrypted restart, capability denial and retained export; UI delivery verified, browser interaction unproven');
}finally{await stop();fs.rmSync(dir,{recursive:true,force:true});}})().catch(error=>{console.error(error);process.exitCode=1;});
