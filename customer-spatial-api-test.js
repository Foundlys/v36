'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {spawn}=require('node:child_process'),{once}=require('node:events');
const M=require('./customer-spatial-model');
const port=28000+Math.floor(Math.random()*900),base=`http://127.0.0.1:${port}`,dir=fs.mkdtempSync(path.join(os.tmpdir(),'foundly-spatial-api-')),token=crypto.randomBytes(32).toString('hex');
const child=spawn(process.execPath,['server.js'],{cwd:__dirname,env:{PATH:process.env.PATH,NODE_ENV:'production',PORT:String(port),FOUNDLY_ADMIN_TOKEN:token,FOUNDLY_ENCRYPTION_KEY:crypto.randomBytes(32).toString('hex'),FOUNDLY_DATA_DIR:dir,FOUNDLY_TENANT_ID:'spatial-api-test',FOUNDLY_DEALER_ID:'fixture-business',FOUNDLY_PLATFORM_ROLES:'ADMIN,SUPER_ADMIN',FOUNDLY_PLATFORM_USER_ID:'spatial-tester',FOUNDLY_CRM_ROLES:'ADMIN',FOUNDLY_PUBLIC_BASE_URL:'https://example.test',FOUNDLY_WORKER_INTERVAL_MS:'99999999'},stdio:['ignore','pipe','pipe']});
let logs='';for(const stream of [child.stdout,child.stderr])stream.on('data',b=>logs=(logs+b).slice(-3000));
async function request(route,body){const r=await fetch(base+route,{method:body?'PUT':'GET',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:body?JSON.stringify(body):undefined});assert.equal(r.status,200,route);return r.json();}
async function current(){const [c,n,k]=await Promise.all(['/api/composition','/api/workspaces','/api/composition/catalog'].map(p=>request(p)));return M.buildGraph({resolution:c.resolution,navigation:n,catalog:k.modules});}
(async()=>{
 for(let i=0;i<100;i++){try{if((await fetch(base+'/api/health')).ok)break;}catch{}if(child.exitCode!==null)throw Error(logs);await new Promise(r=>setTimeout(r,80));}
 for(const file of ['customer-spatial-model.js','customer-spatial-scene.js','customer-spatial-runtime.js','customer-spatial.css']){
  assert.equal((await fetch(base+'/'+file)).status,401,'assets retain production auth');
  const r=await fetch(base+'/'+file,{headers:{authorization:`Bearer ${token}`}});assert.equal(r.status,200);assert.equal(await r.text(),fs.readFileSync(path.join(__dirname,file),'utf8'));
 }
 assert.equal((await current()).nodes.filter(n=>n.kind==='module').length,9);
 const r=(await request('/api/composition')).resolution;
 await request('/api/composition',{industry_id:'GENERAL',entitlements:['calendar','communication'],enabled_modules:['calendar','communication'],capability_flags:{'communication:inbox':false,'calendar:conflicts':false},expected_revision:r.revision});
 const graph=await current();assert.deepEqual(graph.nodes.filter(n=>n.kind==='module').map(n=>n.label),['AGENDA','MAIL']);assert.ok(!graph.nodes.some(n=>n.capability==='communication:inbox'||n.capability==='calendar:conflicts'));
 const denied=await fetch(base+'/api/communication/inbox',{headers:{authorization:`Bearer ${token}`}});assert.equal(denied.status,403,'backend capability gate unchanged');
 const revision=(await request('/api/composition')).resolution.revision;
 await request('/api/composition',{industry_id:'GENERAL',entitlements:['calendar','communication'],enabled_modules:['calendar'],expected_revision:revision});
 assert.deepEqual((await current()).nodes.filter(n=>n.kind==='module').map(n=>n.label),['AGENDA']);
 console.log('PASS spatial actual HTTP assets, production authentication, tenant-scoped graph, disabled capabilities, entitlement revocation and existing API denial. Isolated fixtures; no live provider claim.');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{if(child.exitCode===null){const done=once(child,'exit');child.kill('SIGTERM');await done;}});
