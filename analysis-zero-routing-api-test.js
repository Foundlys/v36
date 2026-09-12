'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {spawn}=require('node:child_process'),{once}=require('node:events');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'foundly-tenant-identity-'));
const port=28200+Math.floor(Math.random()*700),base=`http://127.0.0.1:${port}`,token=crypto.randomBytes(32).toString('hex');
const env={...process.env,NODE_ENV:'production',NODE_OPTIONS:'',PORT:String(port),FOUNDLY_ADMIN_TOKEN:token,FOUNDLY_ADMIN_PASSWORD:'',FOUNDLY_ENCRYPTION_KEY:crypto.randomBytes(32).toString('hex'),FOUNDLY_DATA_DIR:dir,FOUNDLY_TENANT_ID:'identity-fixture',FOUNDLY_DEALER_ID:'default',FOUNDLY_PLATFORM_USER_ID:'identity-bootstrap',FOUNDLY_PLATFORM_ROLES:'ADMIN,SUPER_ADMIN',FOUNDLY_PUBLIC_BASE_URL:'https://foundly.example.test',FOUNDLY_WORKER_INTERVAL_MS:'99999999',OPENAI_API_KEY:'',FOUNDLY_AI_API_KEY:''};
let child,logs='';
async function start(){
 child=spawn(process.execPath,['--require','./test-identity-body-barrier.js','server.js'],{cwd:__dirname,env,stdio:['ignore','pipe','pipe']});
 for(const stream of [child.stdout,child.stderr])stream.on('data',b=>{logs=(logs+b).slice(-10000);});
 for(let n=0;n<80;n++){if(child.exitCode!==null)throw new Error('Fixture server exited: '+logs);try{if((await fetch(base+'/api/health')).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}
 throw new Error('Fixture server start timeout');
}
async function stop(){if(child?.exitCode===null){const closed=once(child,'exit');child.kill('SIGTERM');await closed;}}
async function call(route,method='GET',body){const response=await fetch(base+route,{method,redirect:'manual',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});const text=await response.text();let data;try{data=JSON.parse(text);}catch{data=text;}return {status:response.status,body:data,headers:response.headers};}

env.FOUNDLY_IDENTITY_BODY_BARRIER=path.join(dir,'body-barrier');
const canonicalOrigin='https://foundly.example.test';
async function memberRequest(cookie,route,method='GET',body,extra={}){const response=await fetch(base+route,{method,headers:{cookie,'content-type':'application/json',origin:canonicalOrigin,...extra},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:response.status,body:await response.json(),headers:response.headers};}
async function enroll(username,roles=['MANAGER']){const invited=await call('/api/identity/users','POST',{username,display_name:username,roles,confirm:true,reason:'Authorized HTTP identity fixture'});assert.equal(invited.status,201,JSON.stringify(invited.body));const password='Identity fixture '+crypto.randomBytes(20).toString('hex');const enrolled=await memberRequest('','/api/identity/enroll','POST',{invite_token:invited.body.invite_token,password});assert.equal(enrolled.status,201,JSON.stringify(enrolled.body));return {member:enrolled.body.member,password,invite_token:invited.body.invite_token};}
async function login(account){const result=await memberRequest('','/api/identity/login','POST',{username:account.member.username,password:account.password});assert.equal(result.status,200,JSON.stringify(result.body));const header=result.headers.get('set-cookie');for(const flag of ['HttpOnly','Secure','SameSite=Strict','Path=/'])assert.ok(header.includes(flag));assert.ok(!JSON.stringify(result.body).includes('session_token'));return header.split(';')[0];}
(async()=>{try{
 await start();assert.equal((await call('/api/composition','PUT',{entitlements:['analysis'],expected_revision:0})).status,200);
 const account=await enroll('analysis.routing.fixture'),cookie=await login(account),input={message:'Wat is de conversie?',preferred_module:'analysis',conversation_id:crypto.randomUUID(),turn_id:crypto.randomUUID()};const result=await memberRequest(cookie,'/api/zero/turn','POST',input);assert.equal(result.status,200,'Analysis-only ZERO must not require CRM');assert.ok(result.body.plan.tools.includes('analysis_kpi'));
 assert.equal(result.body.analysis_data.value,null);assert.equal(result.body.analysis_data.available,false);
 const next=async(preferred_module)=>memberRequest(cookie,'/api/zero/turn','POST',{...input,turn_id:crypto.randomUUID(),preferred_module});
 assert.ok((await next(undefined)).body.plan.tools.includes('analysis_kpi'));assert.equal((await next('crm')).status,403,'An explicitly disabled module must not be silently substituted');
 assert.equal((await call('/api/composition','PUT',{entitlements:['analysis','crm'],expected_revision:1})).status,200);assert.ok((await next('analysis')).body.plan.tools.includes('analysis_kpi'));assert.ok((await next('crm')).body.plan.tools.includes('crm_pipeline_summary'));
 assert.equal((await call('/api/composition','PUT',{entitlements:['analysis','crm'],capability_flags:{'analysis:kpis':false},expected_revision:2})).status,200);assert.equal((await next('analysis')).status,403,'A revoked KPI capability must not fall back to CRM');
 await stop();await start();assert.equal((await next('analysis')).status,403);assert.ok((await next('crm')).body.plan.tools.includes('crm_pipeline_summary'));
 console.log('PASS Analysis-only ZERO routes KPI questions without CRM, respects explicit module choice when both exist, preserves null missing data and current capability denial after encrypted restart');
}finally{await stop();fs.rmSync(dir,{recursive:true,force:true});}})().catch(error=>{console.error(error);process.exitCode=1;});
