'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {spawn}=require('node:child_process'),{once}=require('node:events');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'foundly-provider-boundary-')),log=path.join(dir,'fixture-queries.log');
const port=28200+Math.floor(Math.random()*700),base=`http://127.0.0.1:${port}`,token=crypto.randomBytes(32).toString('hex');
const env={...process.env,NODE_ENV:'production',NODE_OPTIONS:'',PORT:String(port),FOUNDLY_ADMIN_TOKEN:token,FOUNDLY_ADMIN_PASSWORD:'',FOUNDLY_ENCRYPTION_KEY:crypto.randomBytes(32).toString('hex'),FOUNDLY_DATA_DIR:dir,FOUNDLY_TENANT_ID:'provider-fixture',FOUNDLY_DEALER_ID:'default',FOUNDLY_PLATFORM_USER_ID:'report-owner',FOUNDLY_PLATFORM_ROLES:'ADMIN,SUPER_ADMIN',FOUNDLY_PUBLIC_BASE_URL:'https://foundly.example.test',FOUNDLY_WORKER_INTERVAL_MS:'99999999',OPENAI_API_KEY:'',FOUNDLY_AI_API_KEY:'',GOOGLE_CLIENT_ID:'fixture-client',GOOGLE_CLIENT_SECRET:'fixture-secret',GOOGLE_REDIRECT_URI:'https://foundly.example.test/api/google/oauth/callback',GA4_PROPERTY_ID:'12345678',FOUNDLY_PROVIDER_QUERY_TEST_LOG:log};
let child,logs='';
async function start(){
 child=spawn(process.execPath,['--require','./test-provider-report-fetch-mock.js','server.js'],{cwd:__dirname,env,stdio:['ignore','pipe','pipe']});
 for(const stream of [child.stdout,child.stderr])stream.on('data',b=>{logs=(logs+b).slice(-10000);});
 for(let n=0;n<80;n++){if(child.exitCode!==null)throw new Error('Fixture server exited: '+logs);try{if((await fetch(base+'/api/health')).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}
 throw new Error('Fixture server start timeout');
}
async function stop(){if(child?.exitCode===null){const closed=once(child,'exit');child.kill('SIGTERM');await closed;}}
async function call(route,method='GET',body){const response=await fetch(base+route,{method,redirect:'manual',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});const text=await response.text();let data;try{data=JSON.parse(text);}catch{data=text;}return {status:response.status,body:data,headers:response.headers};}
const count=()=>fs.existsSync(log)?fs.readFileSync(log,'utf8').trim().split('\n').length:0;
(async()=>{try{
 await start();assert.equal((await call('/api/composition','PUT',{entitlements:['analysis'],expected_revision:0})).status,200);
 const auth=await call('/api/google/connect');assert.equal(auth.status,302);const state=new URL(auth.headers.get('location')).searchParams.get('state');
 const callback=await call('/api/google/oauth/callback?state='+encodeURIComponent(state)+'&code=fixture-code');assert.equal(callback.status,302);assert.ok(callback.headers.get('location').includes('google=connected'));
 await stop();env.FOUNDLY_PLATFORM_ROLES='VIEWER';await start();
 const result=await call('/api/google/ga4/report','POST',{});assert.equal(result.status,200,JSON.stringify(result.body));assert.equal(result.body.fixture,'SYNTHETIC_GA4_REPORT_NOT_LIVE_EVIDENCE');
 assert.equal((await call('/api/google/ga4/realtime','POST',{})).status,200);
 const reports=await call('/api/analysis/provider_reports');assert.equal(reports.status,200);assert.equal(reports.body.total,1);assert.equal(reports.body.items[0].owner_id,'report-owner');assert.equal(reports.body.items[0].source_module,'analysis');
 assert.equal((await call('/api/analysis/provider_events')).body.total,1);
 assert.equal((await call('/api/marketing/campaigns')).status,403);
 const before=count();assert.equal((await call('/api/google/ga4/report','POST',{property_id:'99999999'})).status,403);assert.equal(count(),before,'Foreign property must not reach provider transport');
 await stop();env.FOUNDLY_PLATFORM_USER_ID='other-reader';await start();assert.equal((await call('/api/analysis/provider_reports')).body.total,0);
 await stop();env.FOUNDLY_PLATFORM_USER_ID='report-owner';env.FOUNDLY_PLATFORM_ROLES='ADMIN,SUPER_ADMIN';await start();
 assert.equal((await call('/api/analysis/provider_reports')).body.total,1,'Encrypted restart retains owned provider report');
 assert.equal((await call('/api/analysis/provider_reports','POST',{title:'fake verified report'})).body.code,'provider_ingest_required');
 assert.equal((await call('/api/composition','PUT',{entitlements:['analysis'],capability_flags:{'analysis:reports':false,'analysis:events':false},expected_revision:1})).status,200);
 const revoked=count();for(const route of ['/api/google/ga4/report','/api/google/ga4/realtime'])assert.equal((await call(route,'POST',{})).body.code,'capability_disabled');assert.equal(count(),revoked,'Revoked capability must not query provider');
 assert.equal((await call('/api/composition','PUT',{entitlements:[],expected_revision:2})).status,200);
 const exported=await call('/api/analysis/owned-export');assert.equal(exported.status,200);assert.equal(exported.body.collections.provider_reports.length,1);assert.equal(exported.body.collections.provider_events.length,1);
 console.log('PASS authenticated Analytics-only GA4 fixtures, read-only reporting, capability/property denial before transport, private cache, encrypted restart and retained export');
}finally{await stop();fs.rmSync(dir,{recursive:true,force:true});}})().catch(error=>{console.error(error);process.exitCode=1;});
