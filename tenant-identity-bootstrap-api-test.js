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
 await start();assert.equal((await call('/api/composition')).body.resolution.legacy_compatibility,true);
 const refused=await call('/api/identity/users','POST',{username:'blocked.preconfiguration.fixture',display_name:'Blocked fixture',roles:['VIEWER'],confirm:true,reason:'Verify bootstrap boundary'});assert.equal(refused.status,409);assert.equal(refused.body.code,'identity_composition_required');assert.equal((await call('/api/identity/users')).status,409);assert.equal((await call('/api/composition')).body.resolution.legacy_compatibility,true);
 assert.equal((await call('/api/composition','PUT',{entitlements:['automation','communication'],expected_revision:0})).status,200);assert.equal((await call('/api/identity/users')).body.items.length,0);
 const alice=await enroll('legacy.alice.fixture'),bob=await enroll('legacy.bob.fixture'),reader=await enroll('legacy.reader.fixture',['VIEWER']);let aliceCookie=await login(alice),bobCookie=await login(bob),readerCookie=await login(reader);
 assert.equal((await memberRequest(aliceCookie,'/api/memory/core','POST',{text:'Alice-only legacy fixture'})).status,201);
 const result=await memberRequest(bobCookie,'/api/memory/core');assert.equal(result.status,200);assert.ok(!JSON.stringify(result.body).includes('Alice-only legacy fixture'),'Configured members must retain isolated memory');
 assert.equal((await memberRequest(readerCookie,'/api/memory/core','POST',{text:'Forbidden reader write'})).status,403);
 for(const [route,method] of [['/api/memory/jarvis-confirmations','GET'],['/api/memory/identity:members','GET'],['/api/workers/tick','POST'],['/api/system/persist','POST'],['/api/connector-runtime/profiles','POST'],['/api/integration-config/email','DELETE'],['/api/data/ingest','POST']])assert.equal((await memberRequest(readerCookie,route,method,method==='GET'?undefined:{})).status,403,route);
 const tools=(await memberRequest(readerCookie,'/api/zero/tools')).body.tools;for(const name of ['create_report','create_task','create_lead','draft_message','automation_run'])assert.ok(!tools.some(tool=>tool.tool_id===name),name+' must not be advertised to a read-only member');
 const conversation=crypto.randomUUID(),question={message:'Hoe laat is het?',conversation_id:conversation,turn_id:crypto.randomUUID()};assert.equal((await memberRequest(aliceCookie,'/api/zero/turn','POST',question)).status,200);
 for(const method of ['GET','DELETE'])assert.equal((await memberRequest(bobCookie,'/api/zero/conversation/'+conversation,method)).status,403);assert.equal((await memberRequest(bobCookie,'/api/zero/turn','POST',question)).status,403);
 await stop();await start();assert.ok(!JSON.stringify((await memberRequest(bobCookie,'/api/memory/core')).body).includes('Alice-only legacy fixture'));assert.equal((await memberRequest(aliceCookie,'/api/memory/core')).body.items[0].text,'Alice-only legacy fixture');
 assert.equal((await call('/api/composition')).body.resolution.legacy_compatibility,false);assert.equal((await call('/api/composition','PUT',{entitlements:['automation'],expected_revision:1})).status,200,'Authorized bootstrap can still configure the tenant');
 assert.equal((await memberRequest(readerCookie,'/api/memory/core','POST',{text:'Still forbidden'})).status,403);assert.ok(!JSON.stringify((await memberRequest(bobCookie,'/api/memory/core')).body).includes('Alice-only legacy fixture'));
 console.log('PASS real account enrollment blocked before configuration, no partial member creation, preserved bootstrap setup, then real session privacy, read-only/Core denial, ZERO filtering, conversation ownership and encrypted restart');
}finally{await stop();fs.rmSync(dir,{recursive:true,force:true});}})().catch(error=>{console.error(error);process.exitCode=1;});
