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
 const account=await enroll('calendar.time.fixture'),cookie=await login(account);
 const event={title:'Retained recurrence',start_at:'2026-04-04T10:00:00.123+11:00',end_at:'2026-04-04T11:00:00.123+11:00',timezone:'Australia/Lord_Howe',recurrence:{frequency:'DAILY',count:2}};
 for(const entity of ['events','availability']){const bad=await memberRequest(cookie,'/api/calendar/'+entity,'POST',{...event,start_at:'2026-02-30T10:00:00Z',end_at:'2026-02-30T11:00:00Z'});assert.equal(bad.status,422);assert.equal(bad.body.code,'date_invalid');assert.equal((await memberRequest(cookie,'/api/calendar/'+entity)).body.total,0);}
 const reminder=await memberRequest(cookie,'/api/calendar/reminders','POST',{title:'Invalid civil date',due_at:'2026-02-30T10:00:00Z'});assert.equal(reminder.status,422);assert.equal(reminder.body.code,'date_invalid');
 const badSlots=await memberRequest(cookie,'/api/calendar/scheduling/slots?'+new URLSearchParams({from:'2026-02-30T10:00:00Z',to:'2026-03-03T10:00:00Z'}));assert.equal(badSlots.status,422);assert.equal(badSlots.body.code,'date_invalid');
 const ambiguous=await memberRequest(cookie,'/api/calendar/events','POST',{...event,start_at:'2026-04-04T01:45:00+11:00',end_at:'2026-04-04T02:00:00+11:00'});assert.equal(ambiguous.status,422);assert.equal(ambiguous.body.code,'recurrence_dst_ambiguous');
 const saved=await memberRequest(cookie,'/api/calendar/events','POST',event);assert.equal(saved.status,201,JSON.stringify(saved.body));const record=saved.body.record;
 const conflictInput={title:'Second occurrence conflict',start_at:'2026-04-05T10:15:00+10:30',end_at:'2026-04-05T10:30:00+10:30',timezone:'Australia/Lord_Howe'};
 let conflicts=await memberRequest(cookie,'/api/calendar/conflicts','POST',conflictInput);assert.equal(conflicts.status,200);assert.equal(conflicts.body.count,1);assert.deepEqual(conflicts.body.visible_ids,[record.id]);
 const before=(await memberRequest(cookie,'/api/calendar/events/'+record.id)).body.record;
 assert.equal((await memberRequest(cookie,'/api/calendar/events/'+record.id,'PUT',{start_at:'2026-02-30T10:00:00Z',end_at:'2026-02-30T11:00:00Z',expected_revision:record.revision})).status,422);assert.deepEqual((await memberRequest(cookie,'/api/calendar/events/'+record.id)).body.record,before);
 await stop();await start();conflicts=await memberRequest(cookie,'/api/calendar/conflicts','POST',conflictInput);assert.equal(conflicts.status,200);assert.equal(conflicts.body.count,1);assert.deepEqual((await memberRequest(cookie,'/api/calendar/events/'+record.id)).body.record,before);
 const page=(await call('/calendar')).body;assert.ok(page.indexOf('/calendar-recurrence.js')<page.indexOf('/foundly-workspace.js'));const asset=await call('/calendar-recurrence.js');assert.equal(asset.status,200);assert.equal((await fetch(base+'/calendar-recurrence.js')).status,401);
 const sandbox={};require('node:vm').runInNewContext(asset.body,sandbox);const frontend=sandbox.FoundlyCalendarRecurrence;
 const rule={frequency:'WEEKLY',count:3,interval:2},weeklyInput={title:'Every second week',start_at:'2026-06-01T10:00:00Z',end_at:'2026-06-01T11:00:00Z',timezone:'UTC',recurrence:rule};
 let weekly=await memberRequest(cookie,'/api/calendar/events','POST',weeklyInput);assert.equal(weekly.status,201);weekly=weekly.body.record;
 const invalid=await memberRequest(cookie,'/api/calendar/events/'+weekly.id,'PUT',{expected_revision:weekly.revision,recurrence:{...rule,until:'2027-01-01'}});assert.equal(invalid.status,422);assert.equal(invalid.body.code,'recurrence_invalid');
 const titleEdit=await memberRequest(cookie,'/api/calendar/events/'+weekly.id,'PUT',{title:'Renamed without rescheduling',recurrence:frontend.normalize(weekly.recurrence),expected_revision:weekly.revision});assert.equal(titleEdit.status,200);assert.deepEqual(titleEdit.body.record.recurrence,rule);weekly=titleEdit.body.record;
 const second={start_at:'2026-06-15T10:15:00Z',end_at:'2026-06-15T10:30:00Z',timezone:'UTC'};assert.equal((await memberRequest(cookie,'/api/calendar/conflicts','POST',second)).body.count,1);
 const removed=await memberRequest(cookie,'/api/calendar/events/'+weekly.id,'PUT',{recurrence:frontend.normalize(null),expected_revision:weekly.revision});assert.equal(removed.status,200);assert.equal(removed.body.record.recurrence,null);assert.equal((await memberRequest(cookie,'/api/calendar/conflicts','POST',second)).body.count,0);
 await stop();await start();assert.equal((await memberRequest(cookie,'/api/calendar/events/'+weekly.id)).body.record.recurrence,null);assert.equal((await memberRequest(cookie,'/api/calendar/conflicts','POST',second)).body.count,0);
 console.log('PASS authenticated calendar date rejection across writes/slots, half-hour ambiguity, retained source/revision after rejected edit, real recurrence conflicts and encrypted restart; actual protected browser contract preserves interval, rejects unsupported rules and removes recurrence durably (browser interaction unproven)');
}finally{await stop();fs.rmSync(dir,{recursive:true,force:true});}})().catch(error=>{console.error(error);process.exitCode=1;});
