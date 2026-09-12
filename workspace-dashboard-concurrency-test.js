'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {spawn}=require('node:child_process'),{once}=require('node:events');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'foundly-dashboard-atomic-'));
const port=33500+Math.floor(Math.random()*700),base=`http://127.0.0.1:${port}`,token=crypto.randomBytes(32).toString('hex');
const env={...process.env,NODE_ENV:'production',NODE_OPTIONS:'',PORT:String(port),FOUNDLY_ADMIN_TOKEN:token,FOUNDLY_ADMIN_PASSWORD:'',FOUNDLY_ENCRYPTION_KEY:crypto.randomBytes(32).toString('hex'),FOUNDLY_DATA_DIR:dir,FOUNDLY_TENANT_ID:'dashboard-atomic-fixture',FOUNDLY_DEALER_ID:'default',FOUNDLY_PLATFORM_USER_ID:'authoring-owner',FOUNDLY_PLATFORM_ROLES:'ADMIN,SUPER_ADMIN',FOUNDLY_PUBLIC_BASE_URL:'https://foundly.example.test',FOUNDLY_WORKER_INTERVAL_MS:'99999999',OPENAI_API_KEY:'',FOUNDLY_AI_API_KEY:''};
let child,logs='';
async function start(){
 child=spawn(process.execPath,['--require','./test-readiness-fetch-mock.js','--require','./test-dashboard-persist-fault.js','server.js'],{cwd:__dirname,env,stdio:['ignore','pipe','pipe']});
 for(const stream of [child.stdout,child.stderr])stream.on('data',b=>{logs=(logs+b).slice(-10000);});
 for(let n=0;n<80;n++){if(child.exitCode!==null)throw new Error('Fixture server exited: '+logs);try{if((await fetch(base+'/api/health')).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}
 throw new Error('Fixture server start timeout');
}
async function stop(){if(child?.exitCode===null){const closed=once(child,'exit');child.kill('SIGTERM');await closed;}}
async function call(route,method='GET',body,extraHeaders={}){const response=await fetch(base+route,{method,redirect:'manual',headers:{authorization:`Bearer ${token}`,'content-type':'application/json',...extraHeaders},...(body===undefined?{}:{body:JSON.stringify(body)})});const text=await response.text();let data;try{data=JSON.parse(text);}catch{data=text;}return {status:response.status,body:data,headers:response.headers};}

(async()=>{try{
 await start();assert.equal((await call('/api/composition','PUT',{entitlements:['procurement'],expected_revision:0})).status,200);
 const page=(await call('/procurement')).body;assert.ok(page.indexOf('/workspace-dashboard-session.js')<page.indexOf('/foundly-workspace.js'));const asset=await call('/workspace-dashboard-session.js');assert.equal(asset.status,200);assert.ok(asset.body.includes('FoundlyDashboardSession'));assert.equal((await fetch(base+'/workspace-dashboard-session.js')).status,401);
 const route='/api/workspaces/procurement/dashboard',initial=(await call(route)).body.dashboard;
 let result=await call(route,'PUT',{...initial,scope:'PERSONAL',name:'Original'});assert.equal(result.status,201);let saved=result.body.dashboard;
 result=await call(route,'PUT',{...saved,name:'Blind overwrite'});assert.equal(result.status,428,'Existing layouts must reject writes without a revision precondition');
 const match=revision=>({'if-match':String(revision)});
 for(const header of ['*','W/"1"','1,2','-1','1junk'])assert.equal((await call(route,'PUT',saved,{'if-match':header})).status,422);
 const competing=await Promise.all(['First editor','Second editor'].map(name=>call(route,'PUT',{...saved,name},match(saved.revision))));
 assert.deepEqual(competing.map(r=>r.status).sort(),[200,409]);saved=competing.find(r=>r.status===200).body.dashboard;
 assert.deepEqual((await call(route)).body.dashboard,saved);
 assert.equal((await call(route,'DELETE')).status,428);
 assert.equal((await call(route,'DELETE',undefined,match(saved.revision-1))).status,409);
 const marker=path.join(dir,'fixture-dashboard-write-failure');fs.writeFileSync(marker,'isolated test only');
 result=await call(route,'DELETE',undefined,match(saved.revision));assert.ok(result.status>=500);fs.unlinkSync(marker);
 assert.deepEqual((await call(route)).body.dashboard,saved);
 result=await call(route,'DELETE',undefined,match(saved.revision));assert.equal(result.status,200);assert.equal(result.body.removed,true);const resetRevision=result.body.default_dashboard.revision;assert.equal(resetRevision,saved.revision+1);
 const reset=(await call(route)).body;assert.equal(reset.persisted,false);assert.equal(reset.dashboard.revision,resetRevision);
 assert.equal((await call(route,'PUT',saved,match(saved.revision))).status,409,'Stale save cannot resurrect the reset layout');
 assert.equal((await call(route,'PUT',saved)).status,428,'Reset cannot reopen the unconditional create path');
 await stop();await start();assert.equal((await call(route)).body.dashboard.revision,resetRevision);
 assert.equal((await call(route,'PUT',saved,match(saved.revision))).status,409);
 result=await call(route,'DELETE',undefined,match(resetRevision));assert.equal(result.status,200);assert.equal(result.body.removed,false);assert.equal(result.body.default_dashboard.revision,resetRevision);
 result=await call(route,'PUT',{...reset.dashboard,scope:'PERSONAL',name:'Recreated explicitly'},match(resetRevision));assert.equal(result.status,201);assert.equal(result.body.dashboard.revision,resetRevision+1);saved=result.body.dashboard;
 assert.equal((await call(route,'DELETE',undefined,match(resetRevision))).status,409,'A stale reset cannot erase the recreated layout');
 const teamRoute=route+'?scope=TEAM&team_id=independent';assert.equal((await call(teamRoute)).body.dashboard.revision,0);
 const creates=await Promise.all(['A','B'].map(name=>call(teamRoute,'PUT',{scope:'TEAM',team_id:'independent',name,widgets:[]},match(0))));assert.deepEqual(creates.map(r=>r.status).sort(),[201,409]);
 await stop();await start();assert.deepEqual((await call(route)).body.dashboard,saved);
 console.log('PASS simultaneous dashboard writes/create conflicts, required preconditions, monotonic reset/recreate revisions, stale reset denial, failure rollback, scope isolation and encrypted restart');
}finally{const marker=path.join(dir,'fixture-dashboard-write-failure');if(fs.existsSync(marker))fs.unlinkSync(marker);await stop();fs.rmSync(dir,{recursive:true,force:true});}})().catch(error=>{console.error(error);process.exitCode=1;});
