'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {spawn}=require('node:child_process'),{once}=require('node:events');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'foundly-static-read-'));
const port=35800+Math.floor(Math.random()*700),base=`http://127.0.0.1:${port}`,token=crypto.randomBytes(32).toString('hex');
const env={...process.env,NODE_ENV:'production',NODE_OPTIONS:'',PORT:String(port),FOUNDLY_ADMIN_TOKEN:token,FOUNDLY_ADMIN_PASSWORD:'',FOUNDLY_ENCRYPTION_KEY:crypto.randomBytes(32).toString('hex'),FOUNDLY_DATA_DIR:dir,FOUNDLY_TENANT_ID:'static-read-fixture',FOUNDLY_DEALER_ID:'default',FOUNDLY_PLATFORM_USER_ID:'authoring-owner',FOUNDLY_PLATFORM_ROLES:'ADMIN,SUPER_ADMIN',FOUNDLY_PUBLIC_BASE_URL:'https://foundly.example.test',FOUNDLY_WORKER_INTERVAL_MS:'99999999',OPENAI_API_KEY:'',FOUNDLY_AI_API_KEY:''};
let child,logs='';
async function start(){
 child=spawn(process.execPath,['--require','./test-readiness-fetch-mock.js','--require','./test-static-read-fault.js','server.js'],{cwd:__dirname,env,stdio:['ignore','pipe','pipe']});
 for(const stream of [child.stdout,child.stderr])stream.on('data',b=>{logs=(logs+b).slice(-10000);});
 for(let n=0;n<80;n++){if(child.exitCode!==null)throw new Error('Fixture server exited: '+logs);try{if((await fetch(base+'/api/health')).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}
 throw new Error('Fixture server start timeout');
}
async function stop(){if(child?.exitCode===null){const closed=once(child,'exit');child.kill('SIGTERM');await closed;}}
async function call(route,method='GET',body){const response=await fetch(base+route,{method,redirect:'manual',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});const text=await response.text();let data;try{data=JSON.parse(text);}catch{data=text;}return {status:response.status,body:data,headers:response.headers};}

(async()=>{try{
 await start();assert.equal((await call('/api/composition','PUT',{entitlements:['analysis'],expected_revision:0})).status,200);const profile=(await call('/api/composition')).body.profile;
 for(const route of ['/analysis','/analysis-cohorts-client.js'])assert.equal((await call(route)).status,200);
 const marker=path.join(dir,'fixture-static-read-failure');fs.writeFileSync(marker,'isolated fixture');
 for(const route of ['/analysis','/analysis-cohorts-client.js']){const failure=await call(route);assert.equal(failure.status,503);assert.ok(!String(failure.body).includes(dir));assert.equal(child.exitCode,null);}
 const results=await Promise.all([call('/analysis'),call('/analysis-cohorts-client.js'),call('/api/composition')]);assert.deepEqual(results.map(x=>x.status),[503,503,200]);assert.deepEqual(results[2].body.profile,profile);assert.equal(child.exitCode,null);
 fs.unlinkSync(marker);for(const route of ['/analysis','/analysis-cohorts-client.js'])assert.equal((await call(route)).status,200);
 const response=await fetch(base+'/analysis',{headers:{authorization:`Bearer ${token}`}});await response.body.cancel();assert.equal((await call('/api/composition')).status,200);
 await stop();await start();assert.deepEqual((await call('/api/composition')).body.profile,profile);
 console.log('PASS static HTML/asset read failures return unavailable without crashing the server, concurrent API isolation, recovery, client cancellation and retained configuration');
}finally{const marker=path.join(dir,'fixture-static-read-failure');if(fs.existsSync(marker))fs.unlinkSync(marker);await stop();fs.rmSync(dir,{recursive:true,force:true});}})().catch(error=>{console.error(error.message);console.error(logs);process.exitCode=1;});
