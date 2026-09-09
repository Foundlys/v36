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
async function revokeDuringBody(account,cookie,route,method,data,changes={roles:['VIEWER']},headers={}){
 const http=require('node:http'),payload=JSON.stringify(data);if(fs.existsSync(env.FOUNDLY_IDENTITY_BODY_BARRIER))fs.unlinkSync(env.FOUNDLY_IDENTITY_BODY_BARRIER);
 let pendingRequest;const pendingResponse=new Promise((resolve,reject)=>{pendingRequest=http.request(base+route,{method,headers:{cookie,origin:canonicalOrigin,'content-type':'application/json','content-length':Buffer.byteLength(payload),'x-identity-fixture-barrier':'body',...headers}},response=>{let text='';response.on('data',b=>text+=b);response.on('end',()=>resolve({status:response.statusCode,body:JSON.parse(text)}));});pendingRequest.on('error',reject);pendingRequest.write(payload.slice(0,5));});
 try{
  for(let n=0;n<50&&!fs.existsSync(env.FOUNDLY_IDENTITY_BODY_BARRIER);n++)await new Promise(resolve=>setTimeout(resolve,20));assert.ok(fs.existsSync(env.FOUNDLY_IDENTITY_BODY_BARRIER),'The server reached the authenticated body-await boundary');
  assert.equal((await call('/api/identity/users/'+account.member.id,'PUT',{...changes,expected_revision:account.member.revision,confirm:true,reason:'Revoke CRM authority while body is pending'})).status,200);
  pendingRequest.end(payload.slice(5));const response=await pendingResponse;assert.equal(response.status,401,'CRM must recheck the current member before mutation after its body await');return response;
 }finally{pendingRequest.destroy();}
}
const collections=async()=>{const result={};for(const entity of ['leads','dashboard_views','audit_events']){const response=await call('/api/crm/'+entity);assert.equal(response.status,200,JSON.stringify(response.body));result[entity]=response.body.items;}return result;};
(async()=>{try{
 await start();assert.equal((await call('/api/composition','PUT',{entitlements:['crm'],expected_revision:0})).status,200);
 const account=await enroll('crm.revocation.fixture'),cookie=await login(account),before=await collections();
 await revokeDuringBody(account,cookie,'/api/crm/leads','POST',{name:'Revoked CRM create while body pending'});assert.deepEqual(await collections(),before,'Rejected create must leave neither a lead nor a CRM audit mutation');
 const readonly=await login(account);assert.equal((await memberRequest(readonly,'/api/crm/leads','POST',{name:'Read-only CRM denial'})).status,403);
 const editor=await enroll('crm.editor.fixture'),editorCookie=await login(editor);const created=await memberRequest(editorCookie,'/api/crm/leads','POST',{name:'Preserved lead'});assert.equal(created.status,201,JSON.stringify(created.body));assert.equal(created.body.record.owner_id,editor.member.id);const original=await collections();
 await revokeDuringBody(editor,editorCookie,'/api/crm/leads/'+created.body.record.id,'PUT',{name:'Rejected replacement'},{status:'SUSPENDED'},{'if-match':String(created.body.record.revision)});assert.deepEqual(await collections(),original,'Suspension must block the update before touching record or audit');
 const designer=await enroll('crm.dashboard.fixture'),designerCookie=await login(designer),beforeDashboard=await collections();await revokeDuringBody(designer,designerCookie,'/api/crm/dashboard','POST',{name:'Rejected private dashboard',is_default:true});assert.deepEqual(await collections(),beforeDashboard,'Special CRM routes must preserve current authority too');
 await stop();await start();assert.deepEqual(await collections(),beforeDashboard,'No rejected mutation can appear after encrypted restart');assert.equal((await memberRequest(editorCookie,'/api/crm/leads')).status,401);assert.equal((await call('/api/crm/leads')).body.items[0].name,'Preserved lead');
 console.log('PASS real CRM current principal after body await: revoked create, suspended update and dashboard denial leave record/audit state unchanged, ordinary authorized writes remain valid and encrypted restart preserves only accepted work');
}finally{await stop();fs.rmSync(dir,{recursive:true,force:true});}})().catch(error=>{console.error(error);process.exitCode=1;});
