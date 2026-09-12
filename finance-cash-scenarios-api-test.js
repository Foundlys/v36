'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {spawn}=require('node:child_process'),{once}=require('node:events');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'foundly-finance-scenarios-'));
const port=44900+Math.floor(Math.random()*200),base=`http://127.0.0.1:${port}`,token=crypto.randomBytes(32).toString('hex');
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
 await start();assert.equal((await call('/api/composition','PUT',{entitlements:['finance'],expected_revision:0})).status,200);const viewer=await enroll('forecastviewer',['VIEWER']);let cookie=await login(viewer);
 const entity=(await call('/api/finance/legal-entities','POST',{name:'Cash fixture',legal_form:'BV',currency:'USD'})).body;
 assert.ok(entity.id,JSON.stringify(entity));const forecast=(await call('/api/finance/cash-forecasts','POST',{legal_entity_id:entity.id,as_of:'2026-09-01',horizon_days:30,opening_cash_cents:10000,assumptions:['PRIVATE-CASH-PLAN'],entries:[{date:'2026-09-10',amount_cents:-1000},{date:'2026-12-01',amount_cents:-7000}]})).body;assert.ok(forecast.id,JSON.stringify(forecast));
 const route='/api/finance/forecast-scenarios';let x=await memberRequest(cookie,route,'POST',{forecast_id:forecast.id});assert.equal(x.status,200,JSON.stringify(x.body));assert.equal(x.body.baseline.closing_cash_cents,9000);assert.equal(x.body.currency,'USD');const sourceHash=x.body.source_hash;
 const input={forecast_id:forecast.id,expected_source_hash:sourceHash,changes:{entries:[{entry_index:1,date:'2026-09-20T00:00:00Z'}]}};x=await memberRequest(cookie,route,'POST',input);assert.equal(x.status,200,JSON.stringify(x.body));assert.equal(x.body.scenario.closing_cash_cents,2000);assert.equal(x.body.financial_action,false);
 assert.equal((await memberRequest(cookie,route,'POST',{...input,expected_source_hash:'stale'})).status,409);
 assert.equal((await memberRequest(cookie,'/api/finance/reports?legal_entity_id='+entity.id)).body.cash_forecast.closing_cash_cents,9000);
 assert.equal((await memberRequest(cookie,'/api/finance/dashboard?legal_entity_id='+entity.id)).body.widgets.find(w=>w.id==='cash_forecast').closing_cash_cents,9000);
 assert.equal((await memberRequest(cookie,'/api/finance/records/journal_entries')).body.total,0);assert.equal((await memberRequest(cookie,'/api/finance/records/payments')).body.total,0);
 await stop();await start();cookie=await login(viewer);assert.equal((await memberRequest(cookie,route,'POST',input)).body.source_hash,sourceHash);
 const zeroInput={message:'Finance selected action',conversation_id:'finance-current-zero',turn_id:'current-source',client_context:{finance_action:{operation:'SCENARIO',input}}};
 const zero=await memberRequest(cookie,'/api/zero/turn','POST',zeroInput);assert.equal(zero.status,200,JSON.stringify(zero.body));assert.equal(zero.body.finance_data.scenario.closing_cash_cents,2000);assert.equal((await memberRequest(cookie,'/api/zero/turn','POST',zeroInput)).body.revalidated,true);
 assert.equal((await memberRequest(cookie,'/api/zero/turn','POST',{...zeroInput,client_context:{finance_action:{operation:'SCENARIO',input:{...input,changes:{opening_cash_cents:99}}}}})).status,409);
 const retained=await memberRequest(cookie,'/api/zero/conversation/'+zeroInput.conversation_id);assert.equal(retained.status,200);assert.ok(!JSON.stringify(retained.body).includes(sourceHash));assert.ok(!JSON.stringify(retained.body).includes('PRIVATE-CASH-PLAN'));
 const encrypted=JSON.parse(fs.readFileSync(path.join(dir,'foundly-core-state.json'),'utf8')),envelope=encrypted.decisions.payload,decipher=crypto.createDecipheriv('aes-256-gcm',crypto.createHash('sha256').update(env.FOUNDLY_ENCRYPTION_KEY).digest(),Buffer.from(envelope.iv,'base64'));decipher.setAuthTag(Buffer.from(envelope.tag,'base64'));const plain=Buffer.concat([decipher.update(Buffer.from(envelope.data,'base64')),decipher.final()]).toString('utf8');assert.ok(!plain.includes('PRIVATE-CASH-PLAN'));assert.ok(!plain.includes(sourceHash));
 const denied=await duringBody(cookie,route,'POST',input,async()=>{assert.equal((await call('/api/composition','PUT',{entitlements:['finance'],capability_flags:{'finance:reports':false},expected_revision:1})).status,200);});assert.equal(denied.status,403,JSON.stringify(denied.body));
 assert.equal((await memberRequest(cookie,route,'POST',input)).status,403);
 console.log('PASS Finance scenario HTTP: Finance-only viewer reads and explicit source-bound scenarios, horizon-correct reports/dashboard, exact currency, no postings/payments, encrypted restart and current capability after body wait');
}catch(e){console.error(e);process.exitCode=1;}finally{await stop();fs.rmSync(dir,{recursive:true,force:true});}})();
