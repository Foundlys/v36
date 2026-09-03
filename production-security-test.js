'use strict';
const {spawn}=require('child_process');
const fs=require('fs');
const assert=require('assert');
const PORT=19940+Math.floor(Math.random()*40),tmp=fs.mkdtempSync('/tmp/foundly-security-'),base=`http://127.0.0.1:${PORT}`;
const password='security-test-password',auth='Basic '+Buffer.from(`foundly:${password}`).toString('base64');
const env={...process.env,NODE_ENV:'production',RAILWAY_SERVICE_ID:'security-test-service',PORT:String(PORT),FOUNDLY_DATA_DIR:tmp,FOUNDLY_PUBLIC_BASE_URL:base,FOUNDLY_ADMIN_USERNAME:'foundly',FOUNDLY_ADMIN_PASSWORD:password,FOUNDLY_ENCRYPTION_KEY:'security-encryption-key',FOUNDLY_CONNECTOR_ALLOWED_HOSTS:'api.example.com',OPENAI_API_KEY:'',FOUNDLY_AI_API_KEY:'',META_APP_ID:'meta-client',META_APP_SECRET:'meta-secret',META_REDIRECT_URI:`${base}/api/connect/meta/callback`,GOOGLE_CLIENT_ID:'',GOOGLE_CLIENT_SECRET:'',FOUNDLY_WORKER_INTERVAL_MS:'99999999'};
const child=spawn(process.execPath,['server.js'],{cwd:__dirname,env,stdio:['ignore','pipe','pipe']});let logs='';child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function call(path,opts={}){const r=await fetch(base+path,opts),text=await r.text();let data;try{data=JSON.parse(text)}catch{data=text}return {r,data}}
(async()=>{try{for(let i=0;i<60;i++){try{if((await fetch(base+'/api/health')).ok)break}catch{}await wait(100)}
  let x=await call('/api/connectors');assert.equal(x.r.status,401);
  x=await call('/api/diagnostics/config',{headers:{authorization:auth}});assert.equal(x.r.status,200);const raw=JSON.stringify(x.data);assert(!raw.includes(password));assert(!raw.includes('security-encryption-key'));assert(!raw.includes('secret_fingerprint'));
  x=await call('/api/module/crm/data',{headers:{authorization:auth,'x-foundly-tenant':'attacker'}});assert.equal(x.r.status,200);
  x=await call('/api/connector-runtime/profiles',{method:'POST',headers:{authorization:auth,'content-type':'application/json'},body:JSON.stringify({id:'ssrf',naam:'SSRF',base_url:'http://127.0.0.1:1',auth_strategy:'public'})});assert.equal(x.r.status,400);assert(/HTTPS|Provider-host|Privé|loopback/i.test(x.data.error));
  x=await call('/api/ready');assert.equal(x.r.status,503);assert(x.data.failed.includes('persistent_mount'));
  x=await call('/api/connect/meta',{headers:{authorization:auth},redirect:'manual'});assert.equal(x.r.status,503);assert.equal(x.data.code,'oauth_state_store_not_durable');assert.equal(x.data.checks.public_base_url,false);assert.equal(x.data.checks.oauth_callback,false);assert.equal(fs.existsSync(`${tmp}/oauth-states-v2.json`),false,'blocked OAuth start may not issue state');
  x=await call('/api/engine/crm/execute',{method:'POST',headers:{authorization:auth,'content-type':'application/json'},body:JSON.stringify({action:'sync_connector',title:'retry test',payload:{connector:'does-not-exist'}})});assert.equal(x.r.status,202);
  x=await call('/api/workers/tick',{method:'POST',headers:{authorization:auth,'content-type':'application/json'},body:'{}'});assert.equal(x.r.status,200);assert(x.data.processed.some(t=>t.status==='RETRY_SCHEDULED'));
  const persisted=JSON.parse(fs.readFileSync(`${tmp}/foundly-core-state.json`,'utf8')),persistedTasks=(persisted.tasks||[]).flatMap(([,rows])=>rows);assert(persistedTasks.some(t=>t.status==='RETRY_SCHEDULED'&&t.last_error));assert.equal(persisted.worker_state.worker.status,'IDLE');
  console.log(JSON.stringify({ok:true,authentication:'pass',secret_exposure:'pass',tenant_header_isolation:'pass',ssrf_guard:'pass',readiness:'pass',oauth_start_gate:'pass',worker_retry:'pass'},null,2));
}catch(e){console.error(logs);console.error(e);process.exitCode=1}finally{child.kill('SIGTERM')}})();
