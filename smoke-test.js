'use strict';
const {spawn}=require('child_process');
const fs=require('fs');
const path=require('path');
const assert=require('assert');
const PORT=19300+Math.floor(Math.random()*400);
const tmp=fs.mkdtempSync('/tmp/foundly-v410-test-');
const base=`http://127.0.0.1:${PORT}`;
const commonEnv={...process.env,PORT:String(PORT),FOUNDLY_DATA_DIR:tmp,FOUNDLY_ENCRYPTION_KEY:'test-encryption-key',OPENAI_API_KEY:'',FOUNDLY_AI_API_KEY:'',META_APP_ID:'123456789',META_APP_SECRET:'test-secret',META_REDIRECT_URI:`${base}/api/connect/meta/callback`,GOOGLE_CLIENT_ID:'',GOOGLE_CLIENT_SECRET:'',WHATSAPP_ACCESS_TOKEN:'',WHATSAPP_PHONE_NUMBER_ID:'',FOUNDLY_WORKER_INTERVAL_MS:'99999999'};
let child=null,logs='';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function start(){logs='';child=spawn(process.execPath,['server.js'],{cwd:__dirname,env:commonEnv,stdio:['ignore','pipe','pipe']});child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);for(let i=0;i<60;i++){try{const r=await fetch(base+'/api/health');if(r.ok)return}catch{}await wait(100)}throw new Error('server start timeout\n'+logs)}
async function stop(){if(!child)return;child.kill('SIGTERM');for(let i=0;i<30&&child.exitCode===null;i++)await wait(50);child=null}
async function req(url,opts={}){const r=await fetch(base+url,opts);const text=await r.text();let data;try{data=JSON.parse(text)}catch{data=text}return {r,data,text}}
async function main(){
  await start();
  let x=await req('/');assert.equal(x.r.status,200);assert(String(x.text).includes('Foundly OS v4.1'));
  x=await req('/api/health');assert.equal(x.r.status,200);assert.equal(x.data.version,'4.2.0');assert(!('data_dir'in x.data));
  x=await req('/api/diagnostics/config');assert.equal(x.r.status,200);assert.equal(x.data.version,'4.2.0');assert.equal(x.data.oauth_state.mode,'opaque_persistent_one_time');assert.equal(x.data.encryption.configured,true);assert(!JSON.stringify(x.data).includes('test-secret'));assert(!JSON.stringify(x.data).includes('secret_fingerprint'));

  // Durable OAuth state: start returns opaque state, callback consumes it once, replay is rejected.
  x=await req('/api/connect/meta?return_to=/?open=integraties',{redirect:'manual'});assert.equal(x.r.status,302);const loc=x.r.headers.get('location');assert(loc&&loc.includes('facebook.com'));const state=new URL(loc).searchParams.get('state');assert(state&&state.length>20&&!state.includes('.'));
  x=await req(`/api/connect/meta/callback?state=${encodeURIComponent(state)}`,{redirect:'manual'});assert.equal(x.r.status,302);assert((x.r.headers.get('location')||'').includes('meta=error'));assert((x.r.headers.get('location')||'').includes('Authorization%20code'));
  x=await req(`/api/connect/meta/callback?state=${encodeURIComponent(state)}`,{redirect:'manual'});assert.equal(x.r.status,302);assert((x.r.headers.get('location')||'').includes('OAuth%20state'));

  // Runtime connector full lifecycle and ingest-through-sync.
  const profile={id:'self_test',naam:'Self Test',categorie:'test',auth_strategy:'public',connection_mode:'direct',base_url:base,health:{path:'/api/ping',method:'GET'},sync:{path:'/api/ping',method:'GET'},credential_fields:[],modules:['data'],capabilities:['connect','test','sync','data_ingest']};
  x=await req('/api/connector-runtime/profiles',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(profile)});assert.equal(x.r.status,201);
  x=await req('/api/connector-runtime/test/self_test',{method:'POST'});assert.equal(x.r.status,200);assert.equal(x.data.connector.connected,true);
  x=await req('/api/integration-sync/self_test',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});assert.equal(x.r.status,200);assert.equal(x.data.ok,true);assert(x.data.ingested>=1);
  x=await req('/api/connectors');assert.equal(x.r.status,200);assert.equal(x.data.total,94);assert(x.data.connectors.some(c=>c.id==='self_test'));

  // Commands execute internal actions and expose execution metadata.
  x=await req('/api/core/command',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message:'maak follow-up taak voor klant Jan'})});assert.equal(x.r.status,200);assert.equal(x.data.ok,true);assert(x.data.actions.some(a=>a.type==='create_task'&&a.status==='executed'));assert(!x.data.actions.some(a=>a.type==='create_lead'));
  x=await req('/api/core/command',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message:'registreer nieuwe lead Jan, jan@example.com'})});assert.equal(x.r.status,200);assert(x.data.actions.some(a=>a.type==='create_lead'&&a.status==='executed'));
  x=await req('/api/workers/tick',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});assert.equal(x.r.status,200);assert.equal(x.data.ok,true);assert(x.data.processed.some(t=>t.type==='follow_up'&&t.status==='SUCCEEDED'));
  x=await req('/api/events');assert.equal(x.r.status,200);assert(x.data.events.some(e=>e.type==='command'));assert(x.data.events.some(e=>e.type==='sync'));

  // Persist core state, restart, and verify data survives.
  x=await req('/api/system/persist',{method:'POST'});assert.equal(x.r.status,200);await stop();await start();
  x=await req('/api/module/crm/data');assert.equal(x.r.status,200);assert(x.data.records.some(r=>r.type==='lead'&&r.email==='jan@example.com'));
  x=await req('/api/tasks');assert.equal(x.r.status,200);assert(x.data.tasks.some(t=>t.type==='follow_up'));

  // All engines are real routes.
  for(const mod of ['inkoop','verkoop','data','crm','agenda','voorraad','social_media','google_ads','automatisering','communicatie','rapportages','integraties']){x=await req(`/api/engine/${mod}/status`);assert.equal(x.r.status,200);assert.equal(x.data.status,'online')}

  // UI contract: all primary controls wired; no fake activity stream; backend mapping fixed.
  const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
  const required=['resetView','mic','send','close','googleConnect','googleRefresh','googleSearch','googleDisconnect','integrationRefresh','integrationSelfCheck','integrationAdd'];
  for(const id of required){assert(html.includes(`id="${id}"`),`UI button missing ${id}`);assert(html.includes(`$('#${id}')`)||html.includes(`getElementById('${id}')`),`handler missing ${id}`)}
  for(const attr of ['data-connect','data-test','data-sync','data-profile','data-disconnect','data-quick-oauth'])assert(html.includes(attr),`integration action missing ${attr}`);
  assert(html.includes("BACKEND_MODULE={social:'social_media',google:'google_ads'}"));
  assert(html.includes('/api/core/command'));assert(html.includes('/api/integration-sync/'));assert(html.includes('/api/events'));
  assert(!html.includes('EU listings scanner verwerkt nieuwe voertuigen'),'fake event stream still present');
  console.log(JSON.stringify({ok:true,version:'4.2.0',oauth_state:'pass',persistence:'pass',orchestration:'pass',runtime_connectors:'pass',ui_actions:'pass',base_connectors:93},null,2));
}
main().catch(e=>{console.error(logs);console.error(e);process.exitCode=1}).finally(async()=>{await stop()});
