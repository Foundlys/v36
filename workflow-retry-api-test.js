'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {spawn}=require('node:child_process'),{once}=require('node:events');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'foundly-workflow-retry-'));
const port=28200+Math.floor(Math.random()*700),base=`http://127.0.0.1:${port}`,token=crypto.randomBytes(32).toString('hex');
const env={...process.env,NODE_ENV:'production',NODE_OPTIONS:'',PORT:String(port),FOUNDLY_ADMIN_TOKEN:token,FOUNDLY_ADMIN_PASSWORD:'',FOUNDLY_ENCRYPTION_KEY:crypto.randomBytes(32).toString('hex'),FOUNDLY_DATA_DIR:dir,FOUNDLY_TENANT_ID:'retry-fixture',FOUNDLY_DEALER_ID:'default',FOUNDLY_PLATFORM_USER_ID:'retry-owner',FOUNDLY_PLATFORM_ROLES:'ADMIN,SUPER_ADMIN',FOUNDLY_PUBLIC_BASE_URL:'https://foundly.example.test',FOUNDLY_WORKER_INTERVAL_MS:'99999999',OPENAI_API_KEY:'',FOUNDLY_AI_API_KEY:''};
let child,logs='';
async function start(){
 child=spawn(process.execPath,['--require','./test-workflow-retry-fault.js','server.js'],{cwd:__dirname,env,stdio:['ignore','pipe','pipe']});
 for(const stream of [child.stdout,child.stderr])stream.on('data',b=>{logs=(logs+b).slice(-10000);});
 for(let n=0;n<80;n++){if(child.exitCode!==null)throw new Error('Fixture server exited: '+logs);try{if((await fetch(base+'/api/health')).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}
 throw new Error('Fixture server start timeout');
}
async function stop(){if(child?.exitCode===null){const closed=once(child,'exit');child.kill('SIGTERM');await closed;}}
async function call(route,method='GET',body){const response=await fetch(base+route,{method,redirect:'manual',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});const text=await response.text();let data;try{data=JSON.parse(text);}catch{data=text;}return {status:response.status,body:data,headers:response.headers};}
env.FOUNDLY_RETRY_FAULT_MARKER=path.join(dir,'retry-fault');fs.writeFileSync(env.FOUNDLY_RETRY_FAULT_MARKER,'one controlled fixture fault');
(async()=>{try{
 await start();assert.equal((await call('/api/composition','PUT',{entitlements:['automation'],expected_revision:0})).status,200);
 const policy=(await call('/api/automation/status')).body;assert.deepEqual(policy.retryable_actions.sort(),['create_document','create_task']);
 const flow=await call('/api/automation/workflows','POST',{name:'Durable result-loss recovery fixture',trigger:{type:'schedule',automatic:true,at:new Date(Date.now()-1000).toISOString()},actions:[{type:'create_task',title:'Retry result-loss fixture',retry:{max_attempts:2,initial_delay_seconds:1}}]});assert.equal(flow.status,201,JSON.stringify(flow.body));
 assert.equal((await call('/api/workers/tick','POST',{})).status,200);
 const waiting=(await call('/api/automation/status')).body.runs[0];assert.equal(waiting.status,'WAITING_RETRY');assert.equal(waiting.steps[0].attempts,1);
 const first=(await call('/api/automation/tasks')).body;assert.equal(first.total,1);
 await stop();env.FOUNDLY_PLATFORM_USER_ID='foreign-owner';await start();
 await new Promise(resolve=>setTimeout(resolve,Math.max(0,Date.parse(waiting.next_wakeup_at)-Date.now()+20)));
 assert.equal((await call('/api/workers/tick','POST',{})).status,200);assert.equal((await call('/api/automation/status')).body.runs[0].status,'WAITING_RETRY');
 await stop();env.FOUNDLY_PLATFORM_USER_ID='retry-owner';await start();
 assert.equal((await call('/api/workers/tick','POST',{})).status,200);
 const done=(await call('/api/automation/status')).body.runs[0];assert.equal(done.status,'SUCCEEDED');assert.equal(done.steps[0].attempts,2);
 const final=(await call('/api/automation/tasks')).body;assert.equal(final.total,1);assert.equal(final.items[0].id,first.items[0].id);
 await stop();await start();assert.equal((await call('/api/workers/tick','POST',{})).status,200);assert.equal((await call('/api/automation/tasks')).body.total,1);
 const invalid=await call('/api/automation/workflows','POST',{name:'Unsafe retry fixture',trigger:'custom_event',actions:[{type:'webhook',retry:{max_attempts:2,initial_delay_seconds:1}}]});assert.equal(invalid.status,422);assert.equal(invalid.body.code,'automation_retry_contract_missing');
 assert.equal((await call('/api/composition','PUT',{entitlements:[],expected_revision:1})).status,200);
 const exported=(await call('/api/automation/export')).body;assert.equal(exported.collections.automation_tasks.length,1);assert.equal(exported.collections.automation_runs[0].steps[0].attempts,2);
 console.log('PASS authenticated owner-bound retry after encrypted restart, lost response without duplicate tasks, immutable history, unsafe retry denial and retained export');
}finally{await stop();fs.rmSync(dir,{recursive:true,force:true});}})().catch(error=>{console.error(error);process.exitCode=1;});
