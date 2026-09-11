'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {spawn}=require('node:child_process'),{once}=require('node:events');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'foundly-workflow-absence-'));
const port=29200+Math.floor(Math.random()*500),base=`http://127.0.0.1:${port}`,token=crypto.randomBytes(32).toString('hex');
const env={...process.env,NODE_ENV:'production',NODE_OPTIONS:'',PORT:String(port),FOUNDLY_ADMIN_TOKEN:token,FOUNDLY_ADMIN_PASSWORD:'',FOUNDLY_ENCRYPTION_KEY:crypto.randomBytes(32).toString('hex'),FOUNDLY_DATA_DIR:dir,FOUNDLY_TENANT_ID:'recovery-fixture',FOUNDLY_DEALER_ID:'default',FOUNDLY_PLATFORM_USER_ID:'recovery-owner',FOUNDLY_PLATFORM_ROLES:'ADMIN,SUPER_ADMIN',FOUNDLY_PUBLIC_BASE_URL:'https://foundly.example.test',FOUNDLY_WORKER_INTERVAL_MS:'99999999',OPENAI_API_KEY:'',FOUNDLY_AI_API_KEY:''};
let child,logs='';
async function start(){
 child=spawn(process.execPath,['--require','./test-workflow-absence-fault.js','server.js'],{cwd:__dirname,env,stdio:['ignore','pipe','pipe']});
 for(const stream of [child.stdout,child.stderr])stream.on('data',b=>{logs=(logs+b).slice(-10000);});
 for(let n=0;n<80;n++){if(child.exitCode!==null)throw new Error('Fixture server exited: '+logs);try{if((await fetch(base+'/api/health')).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}
 throw new Error('Fixture server start timeout');
}
async function stop(){if(child?.exitCode===null){const closed=once(child,'exit');child.kill('SIGTERM');await closed;}}
async function call(route,method='GET',body){const response=await fetch(base+route,{method,redirect:'manual',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});const text=await response.text();let data;try{data=JSON.parse(text);}catch{data=text;}return {status:response.status,body:data,headers:response.headers};}

env.FOUNDLY_ABSENCE_FAULT_MARKER=path.join(dir,'crash-before-once');fs.writeFileSync(env.FOUNDLY_ABSENCE_FAULT_MARKER,'one controlled before-effect crash');
(async()=>{try{
 await start();assert.equal((await call('/api/composition','PUT',{entitlements:['automation'],expected_revision:0})).status,200);const flow=await call('/api/automation/workflows','POST',{name:'Absent internal recovery fixture',trigger:'custom_event',actions:[{type:'create_task',title:'Crash before owned task fixture'},{type:'create_document',title:'Only after separate resume'}]});assert.equal(flow.status,201);
 const route='/api/automation/workflows/'+flow.body.id+'/runs',event={event_id:'absence-http:one'};await assert.rejects(()=>call(route,'POST',{event}));if(child.exitCode===null)await once(child,'exit');assert.equal(child.exitCode,87);
 await start();let run=(await call('/api/automation/status')).body.runs[0];assert.equal(run.steps[0].status,'RUNNING');assert.equal((await call('/api/automation/tasks')).body.total,0);assert.equal((await call(route,'POST',{event})).body.code,'automation_outcome_indeterminate');
 const recovery='/api/automation/runs/'+run.run_id+'/recovery',preview=await call(recovery);assert.equal(preview.status,200,JSON.stringify(preview.body));assert.equal(preview.body.action,'PREPARE_VERIFIED_ABSENT_INTERNAL_RETRY');assert.equal(preview.body.evidence.outcome,'ABSENT');assert.equal(preview.body.executes_next_step,false);assert.equal((await call('/api/automation/tasks')).body.total,0);
 const command={preview_fingerprint:preview.body.preview_fingerprint,confirm:true,reason:'Reviewed verified absence; prepare retry only'};assert.equal((await call(recovery,'POST',{...command,confirm:false})).status,422);assert.equal((await call(recovery,'POST',{...command,preview_fingerprint:'invented'})).status,409);
 await stop();env.FOUNDLY_PLATFORM_USER_ID='foreign-admin';await start();assert.equal((await call(recovery)).status,403);assert.equal((await call(recovery,'POST',command)).status,403);await stop();env.FOUNDLY_PLATFORM_USER_ID='recovery-owner';await start();
 const prepared=await call(recovery,'POST',command);assert.equal(prepared.status,200,JSON.stringify(prepared.body));assert.equal(prepared.body.status,'RECOVERY_READY');assert.equal(prepared.body.steps[0].status,'PLANNED_INTERNAL');assert.equal(prepared.body.outputs.length,0);assert.equal(prepared.body.steps[0].verified_by_recovery,undefined);assert.equal((await call(recovery,'POST',command)).body.deduplicated,true);assert.equal((await call('/api/automation/tasks')).body.total,0);assert.equal((await call('/api/automation/documents')).body.total,0);
 await stop();await start();run=(await call(route,'POST',{event})).body;assert.equal(run.status,'SUCCEEDED');assert.equal(run.steps[0].attempts,2);assert.equal(run.steps[0].recovery_retry,undefined);assert.equal((await call('/api/automation/tasks')).body.total,1);assert.equal((await call('/api/automation/documents')).body.total,1);assert.equal((await call(route,'POST',{event})).body.replayed,true);assert.equal(run.recoveries[0].evidence.outcome,'ABSENT');assert.equal(run.recoveries[0].action,'PREPARE_VERIFIED_ABSENT_INTERNAL_RETRY');
 console.log('PASS real encrypted child crash before owned side effect, verified absence without false success, explicit prepare-only recovery, foreign/forged denial, separate restart/resume and durable idempotent single effects');
}finally{await stop();fs.rmSync(dir,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1;});
