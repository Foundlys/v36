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
 await start();assert.equal((await call('/api/composition','PUT',{entitlements:['calendar'],expected_revision:0})).status,200);
 const alice=await enroll('reminder.alice.fixture'),bob=await enroll('reminder.bob.fixture');let aliceCookie=await login(alice),bobCookie=await login(bob);
 const create=async(cookie,title,extra={})=>{const result=await memberRequest(cookie,'/api/calendar/reminders','POST',{title,due_at:'2026-01-01T00:00:00Z',...extra});assert.equal(result.status,201,JSON.stringify(result.body));return result.body.record;};
 const a=await create(aliceCookie,'Revoked planner must remain pending'),b=await create(bobCookie,'Active planner reminder');
 assert.equal((await call('/api/identity/users/'+alice.member.id,'PUT',{roles:['VIEWER'],expected_revision:alice.member.revision,confirm:true,reason:'Revoke scheduling rights before tick'})).status,200);
 let tick=await call('/api/workers/tick','POST',{});assert.equal(tick.status,200);let notifications=(await call('/api/calendar/notifications')).body.items;
 assert.ok(!notifications.some(row=>row.title===a.title),'A service scheduler must not execute a reminder after the author loses write rights');assert.equal(notifications.filter(row=>row.title===b.title).length,1,'An unrelated active author must still run');
 assert.equal((await call('/api/calendar/reminders/'+a.id)).body.record.status,'DRAFT');
 const suspended=await create(bobCookie,'Suspended planner must remain pending');assert.equal((await call('/api/identity/users/'+bob.member.id,'PUT',{status:'SUSPENDED',expected_revision:bob.member.revision,confirm:true,reason:'Suspend planner'})).status,200);await call('/api/workers/tick','POST',{});assert.ok(!(await call('/api/calendar/notifications')).body.items.some(row=>row.title===suspended.title));
 assert.equal((await call('/api/identity/users/'+bob.member.id,'PUT',{status:'ACTIVE',expected_revision:bob.member.revision+1,confirm:true,reason:'Restore planner'})).status,200);bobCookie=await login(bob);aliceCookie=await login(alice);
 const delegated=await create(bobCookie,'Explicit reminder for another recipient',{owner_id:alice.member.id});await call('/api/workers/tick','POST',{});const own=(await memberRequest(aliceCookie,'/api/calendar/notifications')).body.items;assert.equal(own.filter(row=>row.title===delegated.title).length,1,'Recipient ownership must not replace the author execution identity');assert.ok(!own.some(row=>row.title===a.title));
 await stop();await start();await call('/api/workers/tick','POST',{});notifications=(await call('/api/calendar/notifications')).body.items;assert.equal(notifications.filter(row=>row.title===delegated.title).length,1);assert.equal(notifications.filter(row=>row.title===b.title).length,1);assert.ok(!notifications.some(row=>row.title===a.title));
 console.log('PASS real reminder author revocation/suspension, unrelated active author execution, explicit recipient delegation and encrypted restart without duplicate notifications or scheduler privilege expansion');
}finally{await stop();fs.rmSync(dir,{recursive:true,force:true});}})().catch(error=>{console.error(error);process.exitCode=1;});
