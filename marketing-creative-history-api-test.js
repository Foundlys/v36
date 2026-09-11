'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {spawn}=require('node:child_process'),{once}=require('node:events');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'foundly-marketing-history-'));
const port=45500+Math.floor(Math.random()*200),base=`http://127.0.0.1:${port}`,token=crypto.randomBytes(32).toString('hex');
const env={...process.env,NODE_ENV:'production',NODE_OPTIONS:'',PORT:String(port),FOUNDLY_ADMIN_TOKEN:token,FOUNDLY_ADMIN_PASSWORD:'',FOUNDLY_ENCRYPTION_KEY:crypto.randomBytes(32).toString('hex'),FOUNDLY_DATA_DIR:dir,FOUNDLY_TENANT_ID:'identity-fixture',FOUNDLY_DEALER_ID:'default',FOUNDLY_PLATFORM_USER_ID:'identity-bootstrap',FOUNDLY_PLATFORM_ROLES:'ADMIN,SUPER_ADMIN',FOUNDLY_PUBLIC_BASE_URL:'https://foundly.example.test',FOUNDLY_WORKER_INTERVAL_MS:'99999999',OPENAI_API_KEY:'',FOUNDLY_AI_API_KEY:'',SMTP_HOST:'',SMTP_PORT:'',SMTP_USER:'',SMTP_PASSWORD:''};
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

(async()=>{try{
 await start();assert.equal((await call('/api/composition','PUT',{entitlements:['marketing'],expected_revision:0})).status,200);const owner=await enroll('creativeauthor',['MARKETING']),other=await enroll('creativeother',['MARKETING']);let cookie=await login(owner),otherCookie=await login(other);
 const created=await memberRequest(cookie,'/api/marketing/creatives','POST',{title:'PRIVATE creative',content:'PRIVATE initial content'});assert.equal(created.status,201,JSON.stringify(created.body));let record=created.body.record;const route='/api/marketing/creatives/'+record.id;
 const first=(await memberRequest(cookie,route+'/revisions')).body.items[0];assert.equal(first.creative_revision,1);
 const fields={fields:{content:'PRIVATE next content'},expected_revision:1,reason:'Explicit revision',confirm:true},headers={'idempotency-key':'http-creative-version'};
 const zeroInput={message:'Gekozen Marketing-actie',conversation_id:'creative-history-zero',turn_id:'explicit-version',client_context:{marketing_action:{operation:'VERSION',input:{creative_id:record.id,...fields}}}};
 let saved=await memberRequest(cookie,'/api/zero/turn','POST',zeroInput);if(saved.body.marketing_data)saved.body=saved.body.marketing_data;assert.equal(saved.status,200,JSON.stringify(saved.body));assert.equal(saved.body.record.revision,2);
 assert.equal((await memberRequest(cookie,'/api/zero/turn','POST',zeroInput)).body.revalidated,true);
 const retained=await memberRequest(cookie,'/api/zero/conversation/'+zeroInput.conversation_id);assert.equal(retained.status,200);assert.ok(!JSON.stringify(retained.body).includes('PRIVATE'));
 const restore={expected_revision:2,reason:'Restore chosen original',confirm:true},restoreRoute=route+'/revisions/'+first.id+'/restore',restoreHeaders={'idempotency-key':'http-creative-restore'};saved=await memberRequest(cookie,restoreRoute,'POST',restore,restoreHeaders);assert.equal(saved.status,200,JSON.stringify(saved.body));assert.equal(saved.body.record.content,'PRIVATE initial content');assert.equal(saved.body.record.delivery_state,'NOT_PUBLISHED');
 assert.equal((await memberRequest(otherCookie,route+'/revisions')).status,404);assert.equal((await memberRequest(otherCookie,'/api/marketing/creative_revisions/'+first.id)).status,404);assert.equal((await memberRequest(otherCookie,'/api/marketing/creative_revisions')).body.total,0);
 await stop();await start();cookie=await login(owner);assert.equal((await memberRequest(cookie,restoreRoute,'POST',restore,restoreHeaders)).body.deduplicated,true);assert.equal((await memberRequest(cookie,route+'/revisions')).body.total,3);
 const response=await fetch(base+'/marketing-creative-history-client.js',{headers:{cookie}});assert.equal(response.status,200);assert.equal(await response.text(),fs.readFileSync(path.join(__dirname,'marketing-creative-history-client.js'),'utf8'));
 const denied=await duringBody(cookie,route+'/version','POST',{...fields,expected_revision:3},async()=>{assert.equal((await call(route,'PUT',{owner_id:other.member.id,expected_revision:3})).status,200);},{'idempotency-key':'pending-creative-version'});assert.equal(denied.status,404,JSON.stringify(denied.body));assert.equal((await memberRequest(cookie,'/api/marketing/creative_revisions/'+first.id)).status,404);otherCookie=await login(other);assert.equal((await memberRequest(otherCookie,'/api/marketing/creative_revisions/'+first.id)).status,200);
 assert.ok(!JSON.stringify((await memberRequest(cookie,'/api/marketing/owned-export')).body).includes('PRIVATE initial content'));assert.ok(!fs.readFileSync(path.join(dir,'foundly-core-state.json'),'utf8').includes('PRIVATE initial content'));
 console.log('PASS Marketing history HTTP: real owner roles, explicit revision/restore, private history list/detail/export, current owner after body wait, exact encrypted restart/retry and served production component');
}catch(e){console.error(e);process.exitCode=1;}finally{await stop();fs.rmSync(dir,{recursive:true,force:true});}})();
