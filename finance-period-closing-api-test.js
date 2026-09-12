'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {spawn}=require('node:child_process'),{once}=require('node:events');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'foundly-finance-closing-'));
const port=45200+Math.floor(Math.random()*200),base=`http://127.0.0.1:${port}`,token=crypto.randomBytes(32).toString('hex');
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
 await start();assert.equal((await call('/api/composition','PUT',{entitlements:['finance'],expected_revision:0})).status,200);const manager=await enroll('closeadmin',['FINANCE_ADMIN']),viewer=await enroll('closeviewer',['VIEWER']);let cookie=await login(manager),viewCookie=await login(viewer);
 const entity=(await call('/api/finance/legal-entities','POST',{name:'Period fixture',legal_form:'BV'})).body,period=(await call('/api/finance/periods','POST',{legal_entity_id:entity.id,start_date:'2026-09-01',end_date:'2026-09-30'})).body;assert.ok(period.id,JSON.stringify(period));
 const route='/api/finance/periods/'+period.id;let review=(await memberRequest(viewCookie,route+'/close-preview')).body;assert.equal(review.ready,true,JSON.stringify(review));
 const input={reason:'Explicit current close review',expected_source_hash:review.source_hash,confirm:true,request_id:'http-close-0001'};
 assert.equal((await memberRequest(viewCookie,route+'/close','POST',input)).status,403);
 assert.equal((await memberRequest(cookie,route+'/close','POST',{reason:'Missing confirmation'})).status,422);
 const changed=await duringBody(cookie,route+'/close','POST',input,async()=>{assert.equal((await call('/api/finance/accounts','POST',{legal_entity_id:entity.id,code:'1000',name:'Bank',type:'ASSET',system_role:'BANK'})).status,201);});assert.equal(changed.status,409,JSON.stringify(changed.body));
 review=(await memberRequest(cookie,route+'/close-preview')).body;input.expected_source_hash=review.source_hash;
 const zeroInput={message:'Current Finance close',conversation_id:'finance-close-zero',turn_id:'close-current',client_context:{finance_action:{operation:'CLOSE',input:{period_id:period.id,...input}}}};
 let closed=await memberRequest(cookie,'/api/zero/turn','POST',zeroInput);if(closed.body.finance_data)closed.body=closed.body.finance_data;assert.equal(closed.status,200,JSON.stringify(closed.body));assert.equal(closed.body.period.status,'CLOSED');const closingId=closed.body.closing.id;
 assert.equal((await memberRequest(cookie,'/api/finance/records/journal_entries')).body.total,0);
 for(const asset of ['finance-period-closing-client.js','finance-cash-scenarios-client.js']){const response=await fetch(base+'/'+asset,{headers:{cookie}});assert.equal(response.status,200);assert.equal(await response.text(),fs.readFileSync(path.join(__dirname,asset),'utf8'));}
 await stop();await start();cookie=await login(manager);closed=await memberRequest(cookie,'/api/zero/turn','POST',zeroInput);if(closed.body.finance_data)closed.body=closed.body.finance_data;assert.equal(closed.status,200,JSON.stringify(closed.body));assert.equal(closed.body.deduplicated,true);assert.equal(closed.body.closing.id,closingId);assert.equal((await memberRequest(cookie,'/api/finance/records/closing_periods')).body.total,1);
 const denied=await duringBody(cookie,route+'/close','POST',input,async()=>{assert.equal((await call('/api/composition','PUT',{entitlements:['finance'],capability_flags:{'finance:payments':false},expected_revision:1})).status,200);});assert.equal(denied.status,403,JSON.stringify(denied.body));
 console.log('PASS Finance close HTTP: real viewer/admin roles, explicit review/confirmation, source changes during body wait, encrypted replay without duplicate close/postings, protected client assets and current capability on retry');
}catch(e){console.error(e);process.exitCode=1;}finally{await stop();fs.rmSync(dir,{recursive:true,force:true});}})();
