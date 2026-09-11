'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {spawn}=require('node:child_process'),{once}=require('node:events');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'foundly-calendar-external-'));
const port=43800+Math.floor(Math.random()*300),base=`http://127.0.0.1:${port}`,token=crypto.randomBytes(32).toString('hex');
const env={...process.env,NODE_ENV:'production',NODE_OPTIONS:'',PORT:String(port),FOUNDLY_ADMIN_TOKEN:token,FOUNDLY_ADMIN_PASSWORD:'',FOUNDLY_ENCRYPTION_KEY:crypto.randomBytes(32).toString('hex'),FOUNDLY_DATA_DIR:dir,FOUNDLY_TENANT_ID:'identity-fixture',FOUNDLY_DEALER_ID:'default',FOUNDLY_PLATFORM_USER_ID:'identity-bootstrap',FOUNDLY_PLATFORM_ROLES:'ADMIN,SUPER_ADMIN',FOUNDLY_PUBLIC_BASE_URL:'https://foundly.example.test',FOUNDLY_WORKER_INTERVAL_MS:'99999999',OPENAI_API_KEY:'',FOUNDLY_AI_API_KEY:'',SMTP_HOST:'',SMTP_PORT:'',SMTP_USER:'',SMTP_PASSWORD:''};
let child,logs='';
async function start(){
 child=spawn(process.execPath,['--require','./test-identity-body-barrier.js','--require','./test-calendar-external-fetch-mock.js','server.js'],{cwd:__dirname,env,stdio:['ignore','pipe','pipe']});
 for(const stream of [child.stdout,child.stderr])stream.on('data',b=>{logs=(logs+b).slice(-10000);});
 for(let n=0;n<80;n++){if(child.exitCode!==null)throw new Error('Fixture server exited: '+logs);try{if((await fetch(base+'/api/health')).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}
 throw new Error('Fixture server start timeout');
}
async function stop(){if(child?.exitCode===null){const closed=once(child,'exit');child.kill('SIGTERM');await closed;}}
async function call(route,method='GET',body){const response=await fetch(base+route,{method,redirect:'manual',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});const text=await response.text();let data;try{data=JSON.parse(text);}catch{data=text;}return {status:response.status,body:data,headers:response.headers};}

env.FOUNDLY_IDENTITY_BODY_BARRIER=path.join(dir,'body-barrier');
const canonicalOrigin='https://foundly.example.test';
async function memberRequest(cookie,route,method='GET',body,extra={}){const response=await fetch(base+route,{method,headers:{cookie,'content-type':'application/json',origin:canonicalOrigin,...extra},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:response.status,body:await response.json().catch(e=>{throw Error(route+": "+response.status+" "+e.message);}),headers:response.headers};}
async function enroll(username,roles=['MANAGER']){const invited=await call('/api/identity/users','POST',{username,display_name:username,roles,confirm:true,reason:'Authorized HTTP identity fixture'});assert.equal(invited.status,201,JSON.stringify(invited.body));const password='Identity fixture '+crypto.randomBytes(20).toString('hex');const enrolled=await memberRequest('','/api/identity/enroll','POST',{invite_token:invited.body.invite_token,password});assert.equal(enrolled.status,201,JSON.stringify(enrolled.body));return {member:enrolled.body.member,password,invite_token:invited.body.invite_token};}
async function login(account){const result=await memberRequest('','/api/identity/login','POST',{username:account.member.username,password:account.password});assert.equal(result.status,200,JSON.stringify(result.body));const header=result.headers.get('set-cookie');for(const flag of ['HttpOnly','Secure','SameSite=Strict','Path=/'])assert.ok(header.includes(flag));assert.ok(!JSON.stringify(result.body).includes('session_token'));return header.split(';')[0];}
async function duringBody(cookie,route,method,input,mutate,headers={}){
 const http=require('node:http'),payload=JSON.stringify(input);if(fs.existsSync(env.FOUNDLY_IDENTITY_BODY_BARRIER))fs.unlinkSync(env.FOUNDLY_IDENTITY_BODY_BARRIER);
 let pendingRequest;const pendingResponse=new Promise((resolve,reject)=>{pendingRequest=http.request(base+route,{method,headers:{cookie,origin:canonicalOrigin,'content-type':'application/json','content-length':Buffer.byteLength(payload),'x-identity-fixture-barrier':'body',...headers}},response=>{let text='';response.on('data',b=>text+=b);response.on('end',()=>resolve({status:response.statusCode,body:JSON.parse(text)}));});pendingRequest.on('error',reject);pendingRequest.write(payload.slice(0,5));});pendingResponse.catch(()=>{});
 try{
  for(let n=0;n<50&&!fs.existsSync(env.FOUNDLY_IDENTITY_BODY_BARRIER);n++)await new Promise(resolve=>setTimeout(resolve,20));assert.ok(fs.existsSync(env.FOUNDLY_IDENTITY_BODY_BARRIER),'The application is awaiting the authenticated request body');
  await mutate();pendingRequest.end(payload.slice(5));return await pendingResponse;
 }finally{pendingRequest.destroy();}
}

function seedGoogle(){const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',crypto.createHash('sha256').update(env.FOUNDLY_ENCRYPTION_KEY).digest(),iv),data=Buffer.concat([cipher.update(JSON.stringify({refresh_token:'isolated-calendar-refresh',access_token:'isolated-calendar-token',expires_at:Date.now()+3600000,account:{sub:'fixture'}})),cipher.final()]);const hash=crypto.createHash('sha256').update('identity-fixture:default').digest('hex').slice(0,32);fs.writeFileSync(path.join(dir,'google-'+hash+'.json'),JSON.stringify({encrypted:true,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:data.toString('base64')}));}
(async()=>{try{
 seedGoogle();await start();assert.equal((await call('/api/composition','PUT',{entitlements:['calendar'],expected_revision:0})).status,200);
 const owner=await enroll('externalowner',['ADMIN','SUPER_ADMIN']),other=await enroll('externalother',['VIEWER']);let cookie=await login(owner);const otherCookie=await login(other),cal=(await memberRequest(cookie,'/api/calendar/calendars','POST',{name:'Local calendar',timezone:'Europe/Amsterdam'})).body.record;
 const route='/api/calendar/external-calendar',input={calendar_id:cal.id,expected_calendar_revision:1,expected_revision:0,provider_calendar_id:'primary',from:'2026-09-20T00:00:00Z',to:'2026-09-22T00:00:00Z',confirm:true,reason:'Explicit isolated fixture read'};
 let x=await memberRequest(cookie,route+'?calendar_id='+cal.id);assert.equal(x.body.coverage,'NOT_CONFIGURED');
 assert.equal((await memberRequest(otherCookie,route+'/reconcile','POST',input)).status,403);
 x=await memberRequest(cookie,route+'/reconcile','POST',input);assert.equal(x.status,200,JSON.stringify(x.body));assert.equal(x.body.busy_count,1);assert.equal(x.body.provider_write,false);
 assert.equal((await memberRequest(cookie,route+'/reconcile','POST',input)).status,409);
 const native={title:'Overlap',calendar_id:cal.id,start_at:'2026-09-20T08:30:00Z',end_at:'2026-09-20T09:30:00Z',timezone:'Europe/Amsterdam'};
 assert.equal((await memberRequest(cookie,'/api/calendar/events','POST',native)).status,409);
 assert.equal((await memberRequest(cookie,'/api/calendar/events')).body.total,0);
 fs.writeFileSync(path.join(dir,'calendar-mode'),'fail');assert.equal((await memberRequest(cookie,route+'/reconcile','POST',{...input,expected_revision:1})).status,502);assert.equal((await memberRequest(cookie,route+'?calendar_id='+cal.id)).body.revision,1);
 fs.writeFileSync(path.join(dir,'calendar-mode'),'wait');const pending=memberRequest(cookie,route+'/reconcile','POST',{...input,expected_revision:1});pending.catch(()=>{});for(let i=0;i<200&&!fs.existsSync(path.join(dir,'calendar-wait'));i++)await new Promise(r=>setTimeout(r,10));assert.ok(fs.existsSync(path.join(dir,'calendar-wait')));
 assert.equal((await call('/api/identity/users/'+owner.member.id,'PUT',{roles:['VIEWER'],expected_revision:owner.member.revision,confirm:true,reason:'Revoke while reading provider'})).status,200);fs.writeFileSync(path.join(dir,'calendar-release'),'release');assert.ok([401,403].includes((await pending).status));
 assert.equal((await call('/api/identity/users/'+owner.member.id,'PUT',{roles:['ADMIN','SUPER_ADMIN'],expected_revision:owner.member.revision+1,confirm:true,reason:'Restore fixture'})).status,200);cookie=await login(owner);
 fs.writeFileSync(path.join(dir,'calendar-mode'),'normal');await stop();await start();cookie=await login(owner);assert.equal((await memberRequest(cookie,route+'?calendar_id='+cal.id)).body.revision,1);
 const changed=await duringBody(cookie,route+'/reconcile','POST',{...input,expected_revision:1},async()=>{assert.equal((await call('/api/calendar/calendars/'+cal.id,'PUT',{name:'Changed',expected_revision:1})).status,200);});assert.equal(changed.status,409);
 const raw=fs.readFileSync(path.join(dir,'foundly-core-state.json'),'utf8');assert.ok(!raw.includes('PRIVATE PROVIDER TITLE'));assert.ok(!raw.includes('external-one'));
 assert.equal((await memberRequest(cookie,route+'?calendar_id='+cal.id)).body.coverage,'UNAVAILABLE');
 console.log('PASS Calendar external HTTP: authenticated paginated read, native conflict, CAS, partial failure preservation, body/provider-wait authority and source changes, encrypted restart; fixture provider only');
}catch(e){console.error(e);process.exitCode=1;}finally{await stop();fs.rmSync(dir,{recursive:true,force:true});}})();
