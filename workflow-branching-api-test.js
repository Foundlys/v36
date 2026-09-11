'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {spawn}=require('node:child_process'),{once}=require('node:events');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'foundly-workflow-branching-'));
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
const condition={enabled:true,mode:'any',children:[{field:'inputs.score',operator:'gte',value_type:'number',value:'5'},{field:'inputs.flag',operator:'eq',value_type:'boolean',value:'true'}]},task=title=>({type:'create_task',values:{title}});
const draft={name:'HTTP branch fixture',version:1,trigger_type:'custom_event',automatic:false,approval_required:true,steps:[{type:'branch',condition,then_steps:[task('HTTP true first'),{type:'delay',values:{seconds:'1'}},task('HTTP true second')],else_steps:[task('HTTP false')]}]};
(async()=>{try{
 await start();assert.equal((await call('/api/composition','PUT',{entitlements:['automation'],expected_revision:0})).status,200);let saved=await call('/api/automation/drafts/branch-http-fixture','PUT',{draft,expected_revision:0});assert.equal(saved.status,200,JSON.stringify(saved.body));assert.equal((await call('/api/automation/status')).body.workflow_count,0);
 await stop();await start();const record=(await call('/api/automation/drafts')).body.items[0];assert.deepEqual(record.draft,draft);const spec=(await call('/api/automation/status')).body.editor_contract,definition=compile(record.draft,spec),created=await call('/api/automation/workflows','POST',definition);assert.equal(created.status,201,JSON.stringify(created.body));const route='/api/automation/workflows/'+created.body.id+'/runs';
 const event={event_id:'http-branch:true'},options={inputs:{score:7,flag:false}};let run=(await call(route,'POST',{event,options})).body;assert.equal(run.status,'AWAITING_APPROVAL');assert.equal((await call('/api/automation/tasks')).body.total,0);const approval={run_id:run.run_id,request_signature:run.request_signature,reference:'http-branch:review',reason:'Review this exact branch input'};
 assert.equal((await call(route,'POST',{event,options:{inputs:{score:2},approval}})).status,409);run=(await call(route,'POST',{event,options:{...options,approval}})).body;assert.equal(run.status,'WAITING_TIME');assert.equal((await call('/api/automation/tasks')).body.total,1);
 await stop();await start();await new Promise(resolve=>setTimeout(resolve,Math.max(0,Date.parse(run.next_wakeup_at)-Date.now()+10)));run=(await call(route,'POST',{event,options})).body;assert.equal(run.status,'SUCCEEDED');assert.equal(run.steps[3].status,'SKIPPED_CONDITION');assert.equal((await call('/api/automation/tasks')).body.total,2);assert.equal((await call(route,'POST',{event,options})).body.replayed,true);
 const falseEvent={event_id:'http-branch:false'},falseOptions={inputs:{score:1}};run=(await call(route,'POST',{event:falseEvent,options:falseOptions})).body;assert.equal(run.status,'AWAITING_APPROVAL');assert.ok(run.steps.slice(0,3).every(step=>step.status==='SKIPPED_CONDITION'));
 run=(await call(route,'POST',{event:falseEvent,options:{...falseOptions,approval:{...approval,run_id:run.run_id,request_signature:run.request_signature}}})).body;assert.equal(run.status,'SUCCEEDED');assert.equal((await call('/api/automation/tasks')).body.total,3);
 for(const when of [{not:false},{not:null},{not:[]},{not:{field:'inputs.x',operator:'exists'},any:[]}]){const rejected=await call('/api/automation/workflows','POST',{name:'Reject malformed else guard',trigger:'custom_event',actions:[{type:'create_task',when}]});assert.equal(rejected.status,422);assert.equal(rejected.body.code,'automation_condition_invalid');}
 assert.equal((await call('/api/automation/tasks')).body.total,3);await stop();env.FOUNDLY_PLATFORM_ROLES='VIEWER';await start();assert.equal((await call('/api/automation/drafts/branch-http-fixture','PUT',{draft,expected_revision:1})).status,403);assert.equal((await call(route,'POST',{event:{event_id:'viewer:branch'},options})).status,403);
 console.log('PASS native HTTP private branch drafts and encrypted reload, exact version/approval, true/else exclusivity, delay/restart/replay, malformed negation denial and viewer write/run denial without duplicate tasks');
}finally{await stop();fs.rmSync(dir,{recursive:true,force:true});}})().catch(error=>{console.error(error);process.exitCode=1;});
