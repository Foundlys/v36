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
async function call(route,method='GET',body){const response=await fetch(base+route,{method,redirect:'manual',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});const text=await response.text();let data;try{data=JSON.parse(text);}catch{data=text;}return {status:response.status,body:data,headers:response.headers};}

(async()=>{try{
 await start();
 const configure=async(flags={})=>{const current=(await call('/api/composition')).body;assert.equal((await call('/api/composition','PUT',{entitlements:['analysis'],expected_revision:current.profile?.revision||0,capability_flags:flags})).status,200);};await configure();
 const query={from:'2026-01-01T00:00:00Z',to:'2026-01-17T00:00:00Z',identity_field:'customer_id',acquisition_event:'customer_joined',return_event:'customer_returned',interval_days:'7',periods:'3'},route='/api/analysis/cohorts?'+new URLSearchParams(query);
 assert.equal((await fetch(base+route)).status,401);assert.equal((await call(route)).body.available,false);
 const page=await call('/analysis');assert.equal(page.status,200);assert.ok(page.body.includes('href="#cohorts"'));assert.ok(page.body.includes('id="cohortForm"'));assert.ok(page.body.indexOf('/analysis-cohorts-client.js')<page.body.indexOf('/analysis-script.js'));
 const asset=await call('/analysis-cohorts-client.js');assert.equal(asset.status,200);assert.ok(asset.body.includes('FoundlyCohortUI'));assert.equal((await fetch(base+'/analysis-cohorts-client.js')).status,401);
 async function ingest(id,name,date,customer,source='fixture-a',reader='cohort-reader') {const result=await call('/api/platform/events/ingest','POST',{event_id:id,event_name:name,occurred_at:date,source,customer_id:customer,permissions:{user_ids:[reader]},consent_context:{purpose:'cohort_fixture',legal_basis:'contract'}});assert.equal(result.status,202,JSON.stringify(result.body));return result;}
 await ingest('cohort-http-a','customer_joined','2026-01-01T00:00:00Z','a');await ingest('cohort-http-b','customer_joined','2026-01-02T00:00:00Z','b');await ingest('cohort-http-return','customer_returned','2026-01-08T00:00:00Z','a');await ingest('cohort-http-return-two','customer_returned','2026-01-09T00:00:00Z','a');await ingest('cohort-private','customer_joined','2026-01-01T00:00:00Z','private','fixture-private','authoring-owner');
 const adminResult=await call(route);assert.equal(adminResult.status,200,JSON.stringify(adminResult.body));assert.equal(adminResult.body.sample_size,3);
 await stop();env.FOUNDLY_PLATFORM_ROLES='VIEWER';env.FOUNDLY_PLATFORM_USER_ID='cohort-reader';await start();
 let result=await call(route);assert.equal(result.status,200,JSON.stringify(result.body));const report=result.body;assert.equal(report.sample_size,2);assert.equal(report.items[0].cells[1].retention_percent,50);assert.equal(report.items[0].cells[2].retention_percent,null);assert.equal(report.persistent_changes,false);assert.ok(!JSON.stringify(report).includes('cohort-private'));assert.ok(report.supporting_records.every(row=>!row.provider_verified));
 await stop();await start();assert.deepEqual((await call(route)).body,report,'Encrypted restart retains the canonical evidence and calculation');
 assert.equal((await call(route+'&source=unsupported-filter')).status,422);assert.equal((await call('/api/automation/status')).status,403);
 await stop();env.FOUNDLY_PLATFORM_ROLES='ADMIN,SUPER_ADMIN';env.FOUNDLY_PLATFORM_USER_ID='authoring-owner';await start();await configure({'analysis:events':false});assert.equal((await call(route)).status,403);await configure({'analysis:reports':false});assert.equal((await call(route)).status,403);
 console.log('PASS authenticated Analysis-only cohorts, delivered UI contract, private-source filtering, incomplete windows, encrypted restart, current event/report capabilities and explicit unsupported-filter rejection; no browser acceptance claimed');
}finally{await stop();fs.rmSync(dir,{recursive:true,force:true});}})().catch(error=>{console.error(error);console.error(logs);process.exitCode=1;});
