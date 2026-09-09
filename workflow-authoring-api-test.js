'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {spawn}=require('node:child_process'),{once}=require('node:events');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'foundly-workflow-authoring-'));
const port=28200+Math.floor(Math.random()*700),base=`http://127.0.0.1:${port}`,token=crypto.randomBytes(32).toString('hex');
const env={...process.env,NODE_ENV:'production',NODE_OPTIONS:'',PORT:String(port),FOUNDLY_ADMIN_TOKEN:token,FOUNDLY_ADMIN_PASSWORD:'',FOUNDLY_ENCRYPTION_KEY:crypto.randomBytes(32).toString('hex'),FOUNDLY_DATA_DIR:dir,FOUNDLY_TENANT_ID:'authoring-fixture',FOUNDLY_DEALER_ID:'default',FOUNDLY_PLATFORM_USER_ID:'authoring-owner',FOUNDLY_PLATFORM_ROLES:'ADMIN,SUPER_ADMIN',FOUNDLY_PUBLIC_BASE_URL:'https://foundly.example.test',FOUNDLY_WORKER_INTERVAL_MS:'99999999',OPENAI_API_KEY:'',FOUNDLY_AI_API_KEY:''};
let child,logs='';
async function start(){
 child=spawn(process.execPath,['--require','./test-readiness-fetch-mock.js','server.js'],{cwd:__dirname,env,stdio:['ignore','pipe','pipe']});
 for(const stream of [child.stdout,child.stderr])stream.on('data',b=>{logs=(logs+b).slice(-10000);});
 for(let n=0;n<80;n++){if(child.exitCode!==null)throw new Error('Fixture server exited: '+logs);try{if((await fetch(base+'/api/health')).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}
 throw new Error('Fixture server start timeout');
}
async function stop(){if(child?.exitCode===null){const closed=once(child,'exit');child.kill('SIGTERM');await closed;}}
async function call(route,method='GET',body){const response=await fetch(base+route,{method,redirect:'manual',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});const text=await response.text();let data;try{data=JSON.parse(text);}catch{data=text;}return {status:response.status,body:data,headers:response.headers};}

const {compile}=require('./workflow-authoring');
(async()=>{try{
 await start();assert.equal((await call('/api/composition','PUT',{entitlements:['automation'],expected_revision:0})).status,200);
 for(const route of ['/workflow-authoring.js','/workflow-editor.js']){assert.equal((await fetch(base+route)).status,401);const asset=await call(route);assert.equal(asset.status,200);assert.ok(asset.body.includes('FoundlyWorkflow'));}
 const page=await call('/automation');assert.equal(page.status,200);assert.ok(page.body.indexOf('/workflow-authoring.js')<page.body.indexOf('/workflow-editor.js'));assert.ok(page.body.indexOf('/workflow-editor.js')<page.body.indexOf('/foundly-workspace.js'));
 const status=(await call('/api/automation/status')).body;assert.equal(status.can_manage,true);
 const definition=compile({name:'HTTP authoring fixture',version:1,trigger_type:'custom_event',approval_required:true,steps:[{type:'create_task',values:{title:'Authoring task'},condition:{enabled:true,field:'inputs.score',operator:'gte',value_type:'number',value:'5'}},{type:'delay',values:{seconds:1}},{type:'create_document',values:{title:'Authoring document',content:'Exact reviewed content'}}]},status.editor_contract);
 const created=await call('/api/automation/workflows','POST',definition);assert.equal(created.status,201,JSON.stringify(created.body));const route=`/api/automation/workflows/${created.body.id}/runs`,event={event_id:'authoring-http:one',event_version:1},options={inputs:{score:7}};
 let run=(await call(route,'POST',{event,options})).body;assert.equal(run.status,'AWAITING_APPROVAL');assert.equal((await call('/api/automation/tasks')).body.total,0);
 const approval={run_id:run.run_id,request_signature:run.request_signature,reference:'authoring-http:approval',reason:'Review all steps and exact input'};
 assert.equal((await call(route,'POST',{event,options:{inputs:{score:8},approval}})).status,409);
 run=(await call(route,'POST',{event,options:{...options,approval}})).body;assert.equal(run.status,'WAITING_TIME');const originalTask=(await call('/api/automation/tasks')).body.items[0];
 await stop();await start();await new Promise(resolve=>setTimeout(resolve,Math.max(0,Date.parse(run.next_wakeup_at)-Date.now()+10)));
 run=(await call(route,'POST',{event,options})).body;assert.equal(run.status,'SUCCEEDED');assert.deepEqual(run.steps.map(s=>s.status),['SUCCEEDED','SUCCEEDED','SUCCEEDED']);assert.equal((await call('/api/automation/tasks')).body.items[0].id,originalTask.id);assert.equal((await call('/api/automation/documents')).body.items[0].content,'Exact reviewed content');
 assert.equal((await call(route,'POST',{event,options})).body.replayed,true);assert.equal((await call('/api/automation/tasks')).body.total,1);
 assert.equal((await call('/api/automation/workflows','POST',{...definition,actions:[{type:'create_task',title:'Conflicting version'}]})).status,409);
 assert.equal((await call('/api/automation/workflows','POST',{...definition,version:2})).status,201);assert.equal((await call('/api/automation/status')).body.workflow_count,2);
 const activationRoute=`/api/automation/workflows/${created.body.id}/activation`,activate={active:true,confirm:true,expected_revision:0,reason:'Choose the reviewed original version'};
 assert.equal((await call(activationRoute,'PUT',activate)).status,200);assert.equal((await call(activationRoute,'PUT',activate)).body.deduplicated,true);
 assert.equal((await call(activationRoute,'PUT',{...activate,active:false,expected_revision:0})).status,409);
 assert.equal((await call(activationRoute,'PUT',{...activate,active:false,expected_revision:1})).status,200);
 await stop();await start();assert.equal((await call('/api/automation/status')).body.workflows.filter(w=>w.effective_enabled).length,0);assert.equal((await call(route,'POST',{event,options})).status,409);
 assert.equal((await call(activationRoute,'PUT',{...activate,expected_revision:2})).status,200);assert.equal((await call(route,'POST',{event,options})).body.replayed,true);
 const activated=(await call('/api/automation/status')).body;assert.equal(activated.workflows.filter(w=>w.effective_enabled).length,1);assert.equal(activated.workflows.find(w=>w.effective_enabled).id,created.body.id);
 await stop();env.FOUNDLY_PLATFORM_ROLES='VIEWER';await start();assert.equal((await call('/api/automation/status')).body.can_manage,false);assert.equal((await call(activationRoute,'PUT',{...activate,active:false,expected_revision:3})).status,403);assert.equal((await call('/api/automation/workflows','POST',{...definition,version:3})).status,403);
 console.log('PASS authenticated authoring assets, compiled multistep API, exact approval, delay, encrypted restart, preserved versions, no duplicate side effects and viewer write denial, CAS activation, encrypted pause/resume and preserved history');
}finally{await stop();fs.rmSync(dir,{recursive:true,force:true});}})().catch(error=>{console.error(error);process.exitCode=1;});
