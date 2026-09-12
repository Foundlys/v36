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
 await start();assert.equal((await call('/api/composition','PUT',{entitlements:['crm'],expected_revision:0})).status,200);
 const account=await enroll('crm.replay.fixture');let cookie=await login(account);const marker='Private CRM replay fixture';assert.equal((await call('/api/crm/leads','POST',{name:marker,owner_id:'another-owner',score:90})).status,201);
 const input={message:'Welke leads hebben prioriteit?',conversation_id:crypto.randomUUID(),turn_id:crypto.randomUUID(),preferred_module:'crm'};const first=await memberRequest(cookie,'/api/zero/turn','POST',input);assert.equal(first.status,200,JSON.stringify(first.body));assert.ok(JSON.stringify(first.body).includes(marker));assert.ok(!JSON.stringify((await memberRequest(cookie,'/api/zero/conversation/'+input.conversation_id)).body).includes(marker),'Source content must not enter persisted conversation output');
 assert.equal((await call('/api/identity/users/'+account.member.id,'PUT',{roles:['VIEWER'],expected_revision:account.member.revision,confirm:true,reason:'Revoke broad CRM read rights'})).status,200);cookie=await login(account);assert.equal((await memberRequest(cookie,'/api/crm/leads')).body.total,0);
 const replay=await memberRequest(cookie,'/api/zero/turn','POST',input);assert.equal(replay.status,200);assert.ok(!JSON.stringify(replay.body).includes(marker),'A ZERO replay must not bypass the current CRM source visibility');
 assert.equal(replay.body.revalidated,true);assert.ok(!JSON.stringify((await memberRequest(cookie,'/api/zero/conversation/'+input.conversation_id)).body).includes(marker));
 assert.equal((await memberRequest(cookie,'/api/zero/turn','POST',{...input,message:'Wat is mijn pipelinewaarde?'})).status,409,'A turn is bound to its original question');
 const own=await call('/api/crm/leads','POST',{name:'Initially visible CRM lead',owner_id:account.member.id,score:80});assert.equal(own.status,201);const ownInput={...input,turn_id:crypto.randomUUID()};assert.ok(JSON.stringify((await memberRequest(cookie,'/api/zero/turn','POST',ownInput)).body).includes('Initially visible CRM lead'));
 assert.equal((await call('/api/crm/leads/'+own.body.record.id,'PUT',{owner_id:'reassigned-owner'})).status,200);assert.equal((await memberRequest(cookie,'/api/crm/leads')).body.total,0);assert.ok(!JSON.stringify((await memberRequest(cookie,'/api/zero/turn','POST',ownInput)).body).includes('Initially visible CRM lead'),'Source ownership changes invalidate cached visibility without a role change');
 await stop();await start();const afterRestart=await memberRequest(cookie,'/api/zero/turn','POST',input);assert.equal(afterRestart.status,200);assert.equal(afterRestart.body.revalidated,true);assert.ok(!JSON.stringify(afterRestart.body).includes(marker));assert.ok(!JSON.stringify((await memberRequest(cookie,'/api/zero/conversation/'+input.conversation_id)).body).includes(marker));
 const stranger=await enroll('crm.replay.stranger'),strangerCookie=await login(stranger);assert.equal((await memberRequest(strangerCookie,'/api/zero/turn','POST',input)).status,403);
 assert.equal((await call('/api/composition','PUT',{entitlements:['crm'],expected_revision:1,capability_flags:{'crm:leads':false}})).status,200);assert.equal((await memberRequest(cookie,'/api/zero/turn','POST',input)).status,403);
 assert.equal((await call('/api/tasks')).body.tasks.length,0);
 console.log('PASS actual CRM ZERO replay rechecks role/source ownership and capabilities after encrypted restart, keeps source-free conversation history, binds question, isolates owners and creates no business actions');
}finally{await stop();fs.rmSync(dir,{recursive:true,force:true});}})().catch(error=>{console.error(error);process.exitCode=1;});
