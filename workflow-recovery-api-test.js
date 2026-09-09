'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {spawn}=require('node:child_process'),{once}=require('node:events');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'foundly-workflow-recovery-'));
const port=28200+Math.floor(Math.random()*700),base=`http://127.0.0.1:${port}`,token=crypto.randomBytes(32).toString('hex');
const env={...process.env,NODE_ENV:'production',NODE_OPTIONS:'',PORT:String(port),FOUNDLY_ADMIN_TOKEN:token,FOUNDLY_ADMIN_PASSWORD:'',FOUNDLY_ENCRYPTION_KEY:crypto.randomBytes(32).toString('hex'),FOUNDLY_DATA_DIR:dir,FOUNDLY_TENANT_ID:'recovery-fixture',FOUNDLY_DEALER_ID:'default',FOUNDLY_PLATFORM_USER_ID:'recovery-owner',FOUNDLY_PLATFORM_ROLES:'ADMIN,SUPER_ADMIN',FOUNDLY_PUBLIC_BASE_URL:'https://foundly.example.test',FOUNDLY_WORKER_INTERVAL_MS:'99999999',OPENAI_API_KEY:'',FOUNDLY_AI_API_KEY:''};
let child,logs='';
async function start(){
 child=spawn(process.execPath,['--require','./test-workflow-recovery-fault.js','server.js'],{cwd:__dirname,env,stdio:['ignore','pipe','pipe']});
 for(const stream of [child.stdout,child.stderr])stream.on('data',b=>{logs=(logs+b).slice(-10000);});
 for(let n=0;n<80;n++){if(child.exitCode!==null)throw new Error('Fixture server exited: '+logs);try{if((await fetch(base+'/api/health')).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}
 throw new Error('Fixture server start timeout');
}
async function stop(){if(child?.exitCode===null){const closed=once(child,'exit');child.kill('SIGTERM');await closed;}}
async function call(route,method='GET',body){const response=await fetch(base+route,{method,redirect:'manual',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});const text=await response.text();let data;try{data=JSON.parse(text);}catch{data=text;}return {status:response.status,body:data,headers:response.headers};}

env.FOUNDLY_RECOVERY_FAULT_MARKER=path.join(dir,'crash-once');fs.writeFileSync(env.FOUNDLY_RECOVERY_FAULT_MARKER,'one controlled crash');
(async()=>{try{
 await start();assert.equal((await call('/api/composition','PUT',{entitlements:['automation'],expected_revision:0})).status,200);
 const flow=await call('/api/automation/workflows','POST',{name:'Exact crash recovery fixture',trigger:'custom_event',actions:[{type:'create_task',title:'Crash after durable task fixture'},{type:'create_document',title:'Document after explicit continuation',content:'Reviewed content'}]});assert.equal(flow.status,201);
 const route=`/api/automation/workflows/${flow.body.id}/runs`,event={event_id:'recovery-http:one',event_version:1};
 await assert.rejects(()=>call(route,'POST',{event}));if(child.exitCode===null)await once(child,'exit');assert.equal(child.exitCode,86,'The fixture genuinely stopped the server child after the encrypted side-effect commit');
 await start();let run=(await call('/api/automation/status')).body.runs[0];assert.equal(run.status,'RUNNING');assert.equal(run.steps[0].status,'RUNNING');const originalTask=(await call('/api/automation/tasks')).body.items[0];assert.equal((await call(route,'POST',{event})).body.code,'automation_outcome_indeterminate');
 const recoveryRoute=`/api/automation/runs/${run.run_id}/recovery`,preview=await call(recoveryRoute);assert.equal(preview.status,200,JSON.stringify(preview.body));assert.equal(preview.body.evidence.record_id,originalTask.id);assert.equal((await call('/api/automation/documents')).body.total,0);
 const command={preview_fingerprint:preview.body.preview_fingerprint,confirm:true,reason:'Reviewed exact durable task after interrupted result capture'};
 assert.equal((await call(recoveryRoute,'POST',{...command,preview_fingerprint:'forged'})).status,409);assert.equal((await call(recoveryRoute,'POST',{...command,record_id:'invented'})).status,422);
 await stop();env.FOUNDLY_PLATFORM_USER_ID='foreign-admin';await start();assert.equal((await call(recoveryRoute)).status,403);assert.equal((await call(recoveryRoute,'POST',command)).status,403);
 await stop();env.FOUNDLY_PLATFORM_USER_ID='recovery-owner';await start();
 const recovered=await call(recoveryRoute,'POST',command);assert.equal(recovered.status,200,JSON.stringify(recovered.body));assert.equal(recovered.body.status,'RECOVERY_READY');assert.equal((await call(recoveryRoute,'POST',command)).body.deduplicated,true);assert.equal((await call('/api/automation/documents')).body.total,0,'Recovery does not execute a following step');
 await stop();await start();run=(await call(route,'POST',{event})).body;assert.equal(run.status,'SUCCEEDED');assert.equal(run.recoveries.length,1);assert.equal(run.outputs[0].record_id,originalTask.id);assert.equal((await call('/api/automation/tasks')).body.total,1);assert.equal((await call('/api/automation/documents')).body.total,1);assert.equal((await call(route,'POST',{event})).body.replayed,true);
 assert.equal((await call('/api/composition','PUT',{entitlements:[],expected_revision:1})).status,200);const exported=(await call('/api/automation/export')).body;assert.equal(exported.collections.automation_runs[0].recoveries[0].evidence.record_id,originalTask.id);
 console.log('PASS real server-child crash after encrypted commit, verified stored outcome, forged/foreign recovery denial, explicit continuation without duplicate records, restart and retained recovery evidence');
}finally{await stop();fs.rmSync(dir,{recursive:true,force:true});}})().catch(error=>{console.error(error);process.exitCode=1;});
