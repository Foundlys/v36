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
async function enroll(username,roles=['MANAGER'],permissions=[]){const invited=await call('/api/identity/users','POST',{username,display_name:username,roles,permissions,confirm:true,reason:'Authorized HTTP identity fixture'});assert.equal(invited.status,201,JSON.stringify(invited.body));const password='Identity fixture '+crypto.randomBytes(20).toString('hex');const enrolled=await memberRequest('','/api/identity/enroll','POST',{invite_token:invited.body.invite_token,password});assert.equal(enrolled.status,201,JSON.stringify(enrolled.body));return {member:enrolled.body.member,password,invite_token:invited.body.invite_token};}
async function login(account){const result=await memberRequest('','/api/identity/login','POST',{username:account.member.username,password:account.password});assert.equal(result.status,200,JSON.stringify(result.body));const header=result.headers.get('set-cookie');for(const flag of ['HttpOnly','Secure','SameSite=Strict','Path=/'])assert.ok(header.includes(flag));assert.ok(!JSON.stringify(result.body).includes('session_token'));return header.split(';')[0];}
(async()=>{try{
 await start();assert.equal((await call('/api/composition','PUT',{entitlements:['marketing'],expected_revision:0})).status,200);
 const author=await enroll('creative.author.fixture',['MARKETING']),first=await enroll('creative.first.fixture',['MANAGER'],['marketing:approve']),second=await enroll('creative.second.fixture',['MANAGER'],['marketing:approve']),unassigned=await enroll('creative.unassigned.fixture',['VIEWER'],['marketing:approve']);
 const authorCookie=await login(author),firstCookie=await login(first),secondCookie=await login(second),otherCookie=await login(unassigned);
 let result=await memberRequest(authorCookie,'/api/marketing/creatives','POST',{title:'Actual review fixture',content:'Internal reviewed copy, no provider delivery.'});assert.equal(result.status,201,JSON.stringify(result.body));const source=result.body.record;
 const prepare={expected_revision:source.revision,approval_steps:[first.member.id,second.member.id],reason:'Review this exact content',confirm:true},createHeaders={'idempotency-key':'creative-http-request'};
 result=await memberRequest(authorCookie,'/api/marketing/creatives/'+source.id+'/reviews','POST',prepare,createHeaders);assert.equal(result.status,201,JSON.stringify(result.body));let row=result.body.record;
 const replay=await memberRequest(authorCookie,'/api/marketing/creatives/'+source.id+'/reviews','POST',prepare,createHeaders);assert.equal(replay.body.record.id,row.id);assert.equal(replay.body.deduplicated,true);
 const workspace=await memberRequest(authorCookie,'/api/workspaces/marketing');assert.ok(workspace.body.workspace.sections.includes('CREATIVE_REVIEWS'));assert.ok(workspace.body.workspace.domain_entities.includes('creative_reviews'));
 assert.equal((await memberRequest(otherCookie,'/api/marketing/creative_reviews/'+row.id)).status,404);assert.equal((await memberRequest(firstCookie,'/api/marketing/creative_reviews/'+row.id)).status,200);
 const decision={expected_revision:row.revision,decision:'APPROVE',reason:'Reviewed first stage',confirm:true};
 result=await memberRequest(secondCookie,'/api/marketing/creative_reviews/'+row.id+'/approve','POST',decision,{'idempotency-key':'out-of-order'});assert.equal(result.status,403);
 result=await memberRequest(authorCookie,'/api/marketing/creative_reviews/'+row.id+'/approve','POST',decision,{'idempotency-key':'self-refused'});assert.equal(result.status,403);
 result=await memberRequest(firstCookie,'/api/marketing/creative_reviews/'+row.id+'/approve','POST',decision,{'idempotency-key':'first-decision'});assert.equal(result.status,200,JSON.stringify(result.body));row=result.body.record;assert.equal(row.status,'APPROVAL_REQUIRED');
 await stop();await start();assert.deepEqual((await memberRequest(firstCookie,'/api/marketing/creative_reviews/'+row.id)).body.record,row);
 result=await memberRequest(secondCookie,'/api/marketing/creative_reviews/'+row.id+'/approve','POST',{expected_revision:row.revision,decision:'APPROVE',reason:'Reviewed final stage',confirm:true},{'idempotency-key':'second-decision'});assert.equal(result.status,200,JSON.stringify(result.body));row=result.body.record;assert.equal(row.status,'APPROVED_INTERNAL');assert.equal(result.body.publication_executed,false);
 const approved=(await memberRequest(authorCookie,'/api/marketing/creatives/'+source.id)).body.record;assert.equal(approved.status,'APPROVED_INTERNAL');assert.equal(approved.delivery_state,'NOT_PUBLISHED');assert.equal(approved.content,source.content);
 assert.equal((await memberRequest(authorCookie,'/api/marketing/creatives/'+source.id,'PUT',{content:'Unreviewed replacement',expected_revision:approved.revision})).status,422);
 await stop();await start();assert.deepEqual((await memberRequest(authorCookie,'/api/marketing/creatives/'+source.id)).body.record,approved);
 const secret='Only the current owner may read this source fixture';result=await memberRequest(authorCookie,'/api/marketing/creatives','POST',{title:'Private review source',content:secret});const privateSource=result.body.record;
 result=await memberRequest(authorCookie,'/api/marketing/creatives/'+privateSource.id+'/reviews','POST',{...prepare,expected_revision:privateSource.revision,approval_steps:[unassigned.member.id]},{'idempotency-key':'private-source-review'});assert.equal(result.status,201);const privateReview=result.body.record;
 assert.equal((await memberRequest(otherCookie,'/api/marketing/creative_reviews/'+privateReview.id)).status,404,'Being named does not grant source access');
 assert.equal((await call('/api/marketing/creatives/'+privateSource.id,'PUT',{owner_id:unassigned.member.id,expected_revision:privateSource.revision})).status,200);
 assert.equal((await memberRequest(authorCookie,'/api/marketing/creative_reviews/'+privateReview.id)).status,404);const data=await memberRequest(authorCookie,'/api/workspaces/data/snapshot');assert.equal(data.status,200,JSON.stringify(data.body));assert.ok(!JSON.stringify(data.body).includes(secret),'Shared Data cannot expose a review copy after source ownership changes');
 const current=(await call('/api/composition')).body.profile;assert.equal((await call('/api/composition','PUT',{entitlements:['marketing'],capability_flags:{'marketing:campaigns':false},expected_revision:current.revision})).status,200);assert.equal((await memberRequest(firstCookie,'/api/marketing/creative_reviews/'+row.id)).status,403);
 result=await call('/api/marketing/owned-export');assert.equal(result.status,200);assert.ok(result.body.collections.creative_reviews.some(item=>item.id===row.id));
 console.log('PASS real-session Marketing sequential review, current source visibility, no self/out-of-order approval, encrypted mid-review/final restart, immutable approved content, NOT_PUBLISHED state, private Data projection and retained export');
}finally{await stop();fs.rmSync(dir,{recursive:true,force:true});}})().catch(error=>{console.error(error);process.exitCode=1;});
