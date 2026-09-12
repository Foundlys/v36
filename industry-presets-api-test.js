'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {spawn}=require('node:child_process'),{once}=require('node:events');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'foundly-industry-presets-'));
const port=32400+Math.floor(Math.random()*700),base=`http://127.0.0.1:${port}`,token=crypto.randomBytes(32).toString('hex');
const env={...process.env,NODE_ENV:'production',NODE_OPTIONS:'',PORT:String(port),FOUNDLY_ADMIN_TOKEN:token,FOUNDLY_ADMIN_PASSWORD:'',FOUNDLY_ENCRYPTION_KEY:crypto.randomBytes(32).toString('hex'),FOUNDLY_DATA_DIR:dir,FOUNDLY_TENANT_ID:'industry-presets-fixture',FOUNDLY_DEALER_ID:'default',FOUNDLY_PLATFORM_USER_ID:'authoring-owner',FOUNDLY_PLATFORM_ROLES:'ADMIN,SUPER_ADMIN',FOUNDLY_PUBLIC_BASE_URL:'https://foundly.example.test',FOUNDLY_WORKER_INTERVAL_MS:'99999999',OPENAI_API_KEY:'',FOUNDLY_AI_API_KEY:''};
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
 await start();
 const configure=async(modules,industry='AUTOMOTIVE',flags={})=>{const current=(await call('/api/composition')).body;const result=await call('/api/composition','PUT',{entitlements:modules,industry_id:industry,capability_flags:flags,expected_revision:current.profile?.revision||0});assert.equal(result.status,200,JSON.stringify(result.body));};
 const presets=module=>call('/api/composition/industry-presets?module='+module);
 await configure(['procurement']);
 assert.equal((await fetch(base+'/api/composition/industry-presets?module=procurement')).status,401);
 let data=await presets('procurement');assert.equal(data.status,200,JSON.stringify(data.body));assert.equal(data.body.items.length,1);assert.equal(data.body.persistent_changes,false);
 const template=data.body.items[0];assert.equal((await call('/api/workspaces/procurement')).body.workspace.industry_dashboard_presets,true);
 assert.equal((await call('/api/workspaces/procurement/dashboard')).body.persisted,false);
 const saved=await call('/api/workspaces/procurement/dashboard','PUT',template.dashboard);assert.equal(saved.status,201,JSON.stringify(saved.body));assert.deepEqual(saved.body.dashboard.widgets.map(w=>w.metric),['rfqs','bids','awards','suppliers']);
 assert.equal((await presets('automation')).status,403);assert.equal((await presets('constructor')).status,404);
 await configure(['procurement'],'AUTOMOTIVE',{'procurement:approvals':false});assert.equal((await presets('procurement')).body.items.length,0);
 await configure(['procurement'],'GENERAL');assert.equal((await presets('procurement')).body.items.length,0);assert.equal((await call('/api/workspaces/procurement')).body.workspace.industry_dashboard_presets,false);
 assert.deepEqual((await call('/api/workspaces/procurement/dashboard')).body.dashboard,saved.body.dashboard,'Industry switch retains the owned dashboard');
 await stop();await start();assert.deepEqual((await call('/api/workspaces/procurement/dashboard')).body.dashboard,saved.body.dashboard);
 await configure(['automation']);data=await presets('automation');assert.equal(data.status,200,JSON.stringify(data.body));assert.equal(data.body.items[0].draft.automatic,false);
 assert.equal((await call('/api/automation/workflows')).body.workflow_count,0);assert.equal((await call('/api/automation/tasks')).body.total,0);
 const draft=data.body.items[0].draft,definition=compile(draft,(await call('/api/automation/workflows')).body.editor_contract);
 const created=await call('/api/automation/workflows','POST',definition);assert.equal(created.status,201,JSON.stringify(created.body));
 const route='/api/automation/workflows/'+created.body.id+'/runs',event={event_id:'industry-template:manual-review',event_version:1};
 let run=(await call(route,'POST',{event})).body;assert.equal(run.status,'AWAITING_APPROVAL');assert.equal((await call('/api/automation/tasks')).body.total,0);
 await stop();await start();run=(await call(route,'POST',{event,options:{approval:{run_id:run.run_id,request_signature:run.request_signature,reference:'industry-template-approval',reason:'Reviewed this manual template and its task'}}})).body;assert.equal(run.status,'SUCCEEDED',JSON.stringify(run));assert.equal((await call('/api/automation/tasks')).body.total,1);
 assert.equal((await call(route,'POST',{event})).body.replayed,true);assert.equal((await call('/api/automation/tasks')).body.total,1);
 await configure(['automation'],'GENERAL');assert.equal((await presets('automation')).body.items.length,0);assert.equal((await call('/api/automation/workflows')).body.workflow_count,1);
 await configure(['automation'],'AUTOMOTIVE',{'automation:workflows':false});assert.equal((await presets('automation')).body.items.length,0);
 await configure(['automation']);await stop();env.FOUNDLY_PLATFORM_ROLES='VIEWER';await start();assert.equal((await presets('automation')).body.items[0].can_prepare,false);assert.equal((await call('/api/automation/workflows','POST',{...definition,version:2})).status,403);
 console.log('PASS authenticated industry preset discovery, optional modules, capability revocation, owned dashboard save/restart/industry-switch retention, manual workflow approval and exactly-once task through encrypted restart; browser acceptance remains unproven');
}finally{await stop();fs.rmSync(dir,{recursive:true,force:true});}})().catch(error=>{console.error(error);process.exitCode=1;});
