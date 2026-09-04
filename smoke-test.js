'use strict';
const {spawn}=require('child_process');
const fs=require('fs');
const path=require('path');
const assert=require('assert');
const PORT=19300+Math.floor(Math.random()*400);
const tmp=fs.mkdtempSync('/tmp/foundly-v410-test-');
const base=`http://127.0.0.1:${PORT}`;
const commonEnv={...process.env,NODE_ENV:'test',PORT:String(PORT),FOUNDLY_DATA_DIR:tmp,FOUNDLY_ENCRYPTION_KEY:'test-encryption-key',OPENAI_API_KEY:'',FOUNDLY_AI_API_KEY:'',META_APP_ID:'123456789',META_APP_SECRET:'test-secret',META_REDIRECT_URI:`${base}/api/connect/meta/callback`,GOOGLE_CLIENT_ID:'',GOOGLE_CLIENT_SECRET:'',WHATSAPP_ACCESS_TOKEN:'',WHATSAPP_PHONE_NUMBER_ID:'',FOUNDLY_WORKER_INTERVAL_MS:'99999999'};
let child=null,logs='';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function start(){logs='';child=spawn(process.execPath,['server.js'],{cwd:__dirname,env:commonEnv,stdio:['ignore','pipe','pipe']});child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);for(let i=0;i<60;i++){try{const r=await fetch(base+'/api/health');if(r.ok)return}catch{}await wait(100)}throw new Error('server start timeout\n'+logs)}
async function stop(){if(!child)return;child.kill('SIGTERM');for(let i=0;i<30&&child.exitCode===null;i++)await wait(50);child=null}
async function req(url,opts={}){const r=await fetch(base+url,opts);const text=await r.text();let data;try{data=JSON.parse(text)}catch{data=text}return {r,data,text}}
async function main(){
  await start();
  let x=await req('/');assert.equal(x.r.status,200);assert(String(x.text).includes('Foundly OS v5.4.0'));assert.equal(x.r.headers.get('content-security-policy').includes("script-src 'self'"),true);
  x=await req('/index-script.js');assert.equal(x.r.status,200);assert((x.r.headers.get('content-type')||'').includes('application/javascript'));
  for(const asset of ['/zero-audio.js','/jarvis-audio.js','/neural-runtime.js','/speech-formatter.js']){x=await req(asset);assert.equal(x.r.status,200);assert((x.r.headers.get('content-type')||'').includes('application/javascript'))}
  x=await req('/api/health');assert.equal(x.r.status,200);assert.equal(x.data.version,'5.4.0');assert(!('data_dir'in x.data));
  x=await req('/api/diagnostics/config');assert.equal(x.r.status,200);assert.equal(x.data.version,'5.4.0');assert.equal(x.data.oauth_state.mode,'hashed_hmac_bound_persistent_transaction');assert.equal(x.data.encryption.configured,true);assert(!JSON.stringify(x.data).includes('test-secret'));assert(!JSON.stringify(x.data).includes('secret_fingerprint'));

  // Durable OAuth state: start returns only the opaque state; a callback without a code may not consume it.
  x=await req('/api/connect/meta?return_to=/?open=integraties',{redirect:'manual'});assert.equal(x.r.status,302);const loc=x.r.headers.get('location');assert(loc&&loc.includes('facebook.com'));const state=new URL(loc).searchParams.get('state');assert(state&&state.length>20&&!state.includes('.'));
  const stateFile=path.join(tmp,'oauth-states-v2.json'),stateRaw=fs.readFileSync(stateFile,'utf8');assert(!stateRaw.includes(state));
  x=await req(`/api/connect/meta/callback?state=${encodeURIComponent(state)}`,{redirect:'manual'});assert.equal(x.r.status,302);assert((x.r.headers.get('location')||'').includes('meta=error'));assert((x.r.headers.get('location')||'').includes('error_code=oauth_authorization_incomplete'));assert.equal(Object.values(JSON.parse(fs.readFileSync(stateFile,'utf8')))[0].status,'PENDING');

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
  x=await req('/api/system/persist',{method:'POST'});assert.equal(x.r.status,200);await stop();
  const coreFile=path.join(tmp,'foundly-core-state.json'),snapshot=JSON.parse(fs.readFileSync(coreFile,'utf8')),queue=snapshot.tasks.find(([k])=>k.endsWith(':queue'));assert(queue);queue[1].push({id:'crashed-worker-job',tenant_id:'default',dealer_id:'default',type:'sync_connector',payload:{connector:'self_test'},status:'RUNNING',attempts:1,max_attempts:5,created_at:new Date().toISOString(),next_attempt_at:null});snapshot.worker_state.worker={status:'RUNNING',started_at:new Date().toISOString(),pid:99999,host:'stopped-container'};fs.writeFileSync(coreFile,JSON.stringify(snapshot,null,2));await start();
  x=await req('/api/module/crm/data');assert.equal(x.r.status,200);assert(x.data.records.some(r=>r.type==='lead'&&r.email==='jan@example.com'));
  x=await req('/api/tasks');assert.equal(x.r.status,200);assert(x.data.tasks.some(t=>t.type==='follow_up'));
  const recovered=x.data.tasks.find(t=>t.id==='crashed-worker-job');assert(recovered);assert.equal(recovered.status,'RETRY_SCHEDULED');x=await req('/api/workers');assert.equal(x.r.status,200);assert.equal(x.data.runtime.status,'IDLE');assert(x.data.runtime.recovered_at);

  // All engines are real routes.
  for(const mod of ['inkoop','verkoop','data','crm','agenda','voorraad','social_media','google_ads','automatisering','communicatie','rapportages','integraties']){x=await req(`/api/engine/${mod}/status`);assert.equal(x.r.status,200);assert.equal(x.data.status,'available');assert(x.data.sources);assert.equal(x.data.sources.external_sources.total_connected,x.data.sources.external_sources.connected.filter(s=>s.probe_ok).length);assert.equal(x.data.sources.foundly_data_layer.role,'normalized_cache_and_persistence')}

  // Provenance distinguishes unverified API ingest, internal history and verified provider sync.
  x=await req('/api/data/ingest',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({source:'mobile_de',items:[{id:'car-1',price:10000}]})});assert.equal(x.r.status,202);assert.equal(x.data.provider_verified,false);
  x=await req('/api/module/inkoop/data');assert.equal(x.r.status,200);const imported=x.data.records.find(r=>r.external_id==='car-1');assert(imported);assert.equal(imported.provenance.source_id,'mobile_de');assert.equal(imported.provenance.source_kind,'external_provider');assert.equal(imported.provenance.method,'api_ingest');assert.equal(imported.provenance.provider_verified,false);assert(x.data.sources.external_sources);

  // UI contract: all primary controls wired; no fake activity stream; backend mapping fixed.
  const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8'),js=fs.readFileSync(path.join(__dirname,'index-script.js'),'utf8'),ui=html+'\n'+js;
  const required=['resetView','mic','send','close','googleConnect','googleRefresh','googleSearch','googleDisconnect','integrationRefresh','integrationSelfCheck','integrationAdd'];
  for(const id of required){assert(ui.includes(`id="${id}"`),`UI button missing ${id}`);assert(js.includes(`$('#${id}')`)||js.includes(`getElementById('${id}')`),`handler missing ${id}`)}
  for(const attr of ['data-connect','data-test','data-sync','data-profile','data-disconnect','data-quick-oauth'])assert(js.includes(attr),`integration action missing ${attr}`);
  assert(js.includes("BACKEND_MODULE={social:'social_media',google:'google_ads'}"));
  assert(js.includes('/api/zero/turn'));assert(js.includes('/api/integration-sync/'));assert(js.includes('/api/events'));x=await req('/api/jarvis/status');assert.equal(x.r.status,200);assert.equal(x.data.assistant.official_name,'ZERO');
  assert(!ui.includes('EU listings scanner verwerkt nieuwe voertuigen'),'fake event stream still present');assert(!ui.includes('eigen datastroom'));assert(!ui.includes('EIGEN DATABASE'));assert(ui.includes('FOUNDLY DATA LAYER'));assert(ui.includes('Live providerprobes'));
  assert(!/Yoo bro/i.test(ui));assert(html.includes('index-script.js'));assert(!html.includes('<script>'));assert(js.includes('UICommandBus'));assert(js.includes('semantic_vad')||js.includes('input_audio_buffer.speech_started'));
  x=await req('/api/dashboard/summary');assert.equal(x.r.status,200);assert.equal(x.data.version,'5.4.0');assert.equal(x.data.source.method,'server_aggregate');assert.equal(x.data.sources.connected_providers,x.data.sources.connected.length);assert(Number.isInteger(x.data.data_layer.total_records));
  console.log(JSON.stringify({ok:true,version:'5.4.0',oauth_state:'pass',persistence:'pass',worker_recovery:'pass',orchestration:'pass',runtime_connectors:'pass',source_contracts:'pass',provenance:'pass',ui_actions:'pass',zero_ui_contract:'pass',legacy_assistant_api:'pass',dashboard_summary:'pass',base_connectors:93},null,2));
}
main().catch(e=>{console.error(logs);console.error(e);process.exitCode=1}).finally(async()=>{await stop()});
