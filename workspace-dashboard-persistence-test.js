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
async function call(route,method='GET',body){const response=await fetch(base+route,{method,redirect:'manual',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});const text=await response.text();let data;try{data=JSON.parse(text);}catch{data=text;}return {status:response.status,body:data,headers:response.headers};}

(async()=>{try{
 await start();assert.equal((await call('/api/composition','PUT',{entitlements:['procurement'],expected_revision:0})).status,200);
 const route='/api/workspaces/procurement/dashboard',initial=(await call(route)).body.dashboard;
 let result=await call(route,'PUT',{...initial,scope:'PERSONAL',name:'Preserved dashboard fixture'});assert.equal(result.status,201);const saved=result.body.dashboard;
 const teamRoute=route+'?scope=TEAM&team_id=fixture-team',teamSaved=(await call(teamRoute,'PUT',{...initial,scope:'TEAM',team_id:'fixture-team',name:'Independent team dashboard'})).body.dashboard;
 const marker=path.join(dir,'fixture-dashboard-write-failure');fs.writeFileSync(marker,'isolated test only');
 result=await call(route,'PUT',{...saved,name:'Rejected changed dashboard'});assert.ok(result.status>=400);
 assert.deepEqual((await call(route)).body.dashboard,saved,'Failed persistence must restore the prior in-memory dashboard');
 fs.unlinkSync(marker);await stop();await start();assert.deepEqual((await call(route)).body.dashboard,saved,'A later process flush must not commit the rejected change');
 fs.writeFileSync(marker,'isolated test only');result=await call(route,'DELETE');assert.ok(result.status>=400);
 assert.deepEqual((await call(route)).body.dashboard,saved,'Failed reset must retain the dashboard');fs.unlinkSync(marker);
 await stop();await start();assert.deepEqual((await call(route)).body.dashboard,saved);assert.deepEqual((await call(teamRoute)).body.dashboard,teamSaved);
 result=await call(route,'DELETE');assert.equal(result.status,200);assert.equal(result.body.removed,true);assert.equal((await call(route)).body.persisted,false);assert.equal((await call(route,'DELETE')).body.removed,false);
 await stop();await start();assert.equal((await call(route)).body.persisted,false);assert.deepEqual((await call(teamRoute)).body.dashboard,teamSaved,'Personal reset cannot delete another dashboard scope');
 console.log('PASS dashboard failed write/reset rollback and encrypted restart without later committing rejected state');
}finally{const marker=path.join(dir,'fixture-dashboard-write-failure');if(fs.existsSync(marker))fs.unlinkSync(marker);await stop();fs.rmSync(dir,{recursive:true,force:true});}})().catch(error=>{console.error(error);process.exitCode=1;});
