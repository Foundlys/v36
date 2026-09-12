'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {spawn}=require('node:child_process'),{once}=require('node:events');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'foundly-zero-workflow-'));
const port=31300+Math.floor(Math.random()*500),base=`http://127.0.0.1:${port}`,token=crypto.randomBytes(32).toString('hex');
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
async function memberRequest(cookie,route,method='GET',body,extra={}){const response=await fetch(base+route,{method,headers:{cookie,'content-type':'application/json',origin:canonicalOrigin,...extra},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:response.status,body:await response.json(),headers:response.headers};}
async function enroll(username,roles=['MANAGER']){const invited=await call('/api/identity/users','POST',{username,display_name:username,roles,confirm:true,reason:'Authorized HTTP identity fixture'});assert.equal(invited.status,201,JSON.stringify(invited.body));const password='Identity fixture '+crypto.randomBytes(20).toString('hex');const enrolled=await memberRequest('','/api/identity/enroll','POST',{invite_token:invited.body.invite_token,password});assert.equal(enrolled.status,201,JSON.stringify(enrolled.body));return {member:enrolled.body.member,password,invite_token:invited.body.invite_token};}
async function login(account){const result=await memberRequest('','/api/identity/login','POST',{username:account.member.username,password:account.password});assert.equal(result.status,200,JSON.stringify(result.body));const header=result.headers.get('set-cookie');for(const flag of ['HttpOnly','Secure','SameSite=Strict','Path=/'])assert.ok(header.includes(flag));assert.ok(!JSON.stringify(result.body).includes('session_token'));return header.split(';')[0];}
async function duringBody(cookie,route,method,input,mutate,headers={}){
 const http=require('node:http'),payload=JSON.stringify(input);if(fs.existsSync(env.FOUNDLY_IDENTITY_BODY_BARRIER))fs.unlinkSync(env.FOUNDLY_IDENTITY_BODY_BARRIER);
 let pendingRequest;const pendingResponse=new Promise((resolve,reject)=>{pendingRequest=http.request(base+route,{method,headers:{cookie,origin:canonicalOrigin,'content-type':'application/json','content-length':Buffer.byteLength(payload),'x-identity-fixture-barrier':'body',...headers}},response=>{let text='';response.on('data',b=>text+=b);response.on('end',()=>resolve({status:response.statusCode,body:JSON.parse(text)}));});pendingRequest.on('error',reject);pendingRequest.write(payload.slice(0,5));});
 try{
  for(let n=0;n<50&&!fs.existsSync(env.FOUNDLY_IDENTITY_BODY_BARRIER);n++)await new Promise(resolve=>setTimeout(resolve,20));assert.ok(fs.existsSync(env.FOUNDLY_IDENTITY_BODY_BARRIER),'The application is awaiting the authenticated request body');
  await mutate();pendingRequest.end(payload.slice(5));return await pendingResponse;
 }finally{pendingRequest.destroy();}
}

const draft={name:'PRIVATE ZERO WORKFLOW',version:1,trigger_type:'custom_event',automatic:false,steps:[{type:'create_task',values:{title:'PRIVATE ZERO TASK'},condition:{enabled:true,mode:'any',children:[{field:'inputs.flag',operator:'eq',value_type:'boolean',value:'true'}]}}]};
const make=(action,extra={})=>({message:'Voer de gekozen workflowconceptactie uit',conversation_id:crypto.randomUUID(),turn_id:crypto.randomUUID(),preferred_module:'automation',client_context:{automation_action:action},...extra});
const turn=(cookie,body)=>memberRequest(cookie,'/api/zero/turn','POST',body);
(async()=>{try{
 await start();assert.equal((await call('/api/composition','PUT',{entitlements:['automation'],expected_revision:0})).status,200);
 const owner=await enroll('workflowowner'),other=await enroll('workflowother'),reader=await enroll('workflowreader',['VIEWER']);let cookie=await login(owner),foreign=await login(other),readCookie=await login(reader);
 const status=(await memberRequest(cookie,'/api/zero/status')).body;assert.ok(status.tools.some(tool=>tool.tool_id==='automation_draft_save'));assert.ok(!(await memberRequest(readCookie,'/api/zero/status')).body.tools.some(tool=>tool.tool_id==='automation_draft_save'));
 const previewAction={operation:'PREVIEW',draft_id:'http-zero-draft',input:{draft,expected_revision:0}},previewBody=make(previewAction),preview=await turn(cookie,previewBody);assert.equal(preview.status,200,JSON.stringify(preview.body));assert.equal(preview.body.automation_data.executable,false);
 assert.equal((await memberRequest(cookie,'/api/automation/drafts')).body.items.length,0);assert.equal((await call('/api/automation/status')).body.workflow_count,0);
 const saveAction={operation:'SAVE',draft_id:'http-zero-draft',input:{draft,expected_revision:0,preview_fingerprint:preview.body.automation_data.preview_fingerprint,confirm:true,reason:'Confirmed internal draft'}},saveBody=make(saveAction);
 const wrong=await turn(cookie,make({...saveAction,input:{...saveAction.input,draft:{...draft,name:'Changed without new preview'}}}));assert.equal(wrong.status,422,JSON.stringify(wrong.body));
 const saved=await turn(cookie,saveBody);assert.equal(saved.status,200,JSON.stringify(saved.body));assert.equal(saved.body.automation_data.record.revision,1);assert.equal((await call('/api/automation/status')).body.workflow_count,0);assert.equal((await call('/api/automation/tasks')).body.total,0);
 assert.equal((await turn(cookie,saveBody)).body.replayed,true);assert.equal((await memberRequest(cookie,'/api/automation/drafts')).body.items.length,1);
 const readBody=make({operation:'READ',draft_id:'http-zero-draft',input:{}});assert.equal((await turn(foreign,readBody)).status,404);assert.equal((await turn(readCookie,make(previewAction))).status,403);
 await stop();await start();cookie=await login(owner);foreign=await login(other);assert.equal((await turn(cookie,saveBody)).body.replayed,true);const read=await turn(cookie,readBody);assert.equal(read.status,200);assert.equal(read.body.automation_data.record.draft.name,draft.name);
 // Stored conversation/audit records retain only request/source references.
 const history=await memberRequest(cookie,'/api/zero/conversation/'+saveBody.conversation_id);assert.equal(history.status,200,JSON.stringify(history.body));assert.ok(!JSON.stringify(history.body).includes('PRIVATE ZERO'));
 const stored=JSON.parse(fs.readFileSync(path.join(dir,'foundly-core-state.json'),'utf8'));assert.equal(stored.decisions.payload.encrypted,true);assert.ok(!JSON.stringify(stored).includes('PRIVATE ZERO'));const envelope=stored.decisions.payload,decipher=crypto.createDecipheriv('aes-256-gcm',crypto.createHash('sha256').update(env.FOUNDLY_ENCRYPTION_KEY).digest(),Buffer.from(envelope.iv,'base64'));decipher.setAuthTag(Buffer.from(envelope.tag,'base64'));const retainedAudit=Buffer.concat([decipher.update(Buffer.from(envelope.data,'base64')),decipher.final()]).toString('utf8');assert.ok(!retainedAudit.includes('PRIVATE ZERO')); 
 const update={draft:{...draft,name:'PRIVATE NATIVE REVISION'},expected_revision:1};assert.equal((await memberRequest(cookie,'/api/automation/drafts/http-zero-draft','PUT',update)).status,200);assert.equal((await turn(cookie,saveBody)).status,409);assert.equal((await turn(cookie,readBody)).body.automation_data.record.revision,2);
 // Revocation while the authenticated request is awaiting its body must win.
 const denied=await duringBody(cookie,'/api/zero/turn','POST',make({...previewAction,draft_id:'revoked-draft'}),async()=>{const changed=await call('/api/identity/users/'+owner.member.id,'PUT',{roles:['VIEWER'],expected_revision:owner.member.revision,confirm:true,reason:'Fixture revocation'});assert.equal(changed.status,200,JSON.stringify(changed.body));});assert.ok([401,403].includes(denied.status),JSON.stringify(denied.body));cookie=await login(owner);assert.equal((await memberRequest(cookie,'/api/automation/drafts')).body.items.length,1);
 assert.equal((await call('/api/automation/status')).body.workflow_count,0);assert.equal((await call('/api/automation/tasks')).body.total,0);
 console.log('PASS actual member ZERO private workflow preview/save/read, tool permissions, exact confirmation/replay, source-free conversation/audit, foreign owner denial, native revision conflict, encrypted restart and mid-body role revocation without workflow/task execution');
}finally{await stop();fs.rmSync(dir,{recursive:true,force:true});}})().catch(error=>{console.error(error);process.exitCode=1;});
