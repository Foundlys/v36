'use strict';

const {spawn}=require('child_process');
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const assert=require('assert');

const PORT=20700+Math.floor(Math.random()*200),base=`http://127.0.0.1:${PORT}`,dataDir=fs.mkdtempSync('/tmp/foundly-crm-standalone-');
const token='foundly-crm-standalone-admin-token-2026-secure',encryption='foundly-crm-standalone-encryption-key-2026-secure',webhookSecret='foundly-crm-webhook-signature-key-2026-secure';
const auth={authorization:`Bearer ${token}`};
const serverEnv={...process.env,NODE_ENV:'production',PORT:String(PORT),FOUNDLY_CRM_DATA_DIR:dataDir,FOUNDLY_CRM_PUBLIC_BASE_URL:'https://crm.foundly.example.test',FOUNDLY_CRM_ADMIN_TOKEN:token,FOUNDLY_CRM_ENCRYPTION_KEY:encryption,FOUNDLY_CRM_WEBHOOK_SECRET:webhookSecret,FOUNDLY_CRM_TENANT_ID:'tenant-standalone',FOUNDLY_CRM_BUSINESS_ID:'business-standalone',FOUNDLY_CRM_USER_ID:'crm-admin',FOUNDLY_CRM_ROLES:'ADMIN'};
let child,logs='';const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function start(){logs='';child=spawn(process.execPath,['crm-standalone.js'],{cwd:__dirname,env:serverEnv,stdio:['ignore','pipe','pipe']});child.stdout.on('data',chunk=>logs+=chunk);child.stderr.on('data',chunk=>logs+=chunk);for(let i=0;i<80;i++){try{if((await fetch(`${base}/api/health`)).ok)return}catch{}await wait(60)}throw new Error(`standalone start timeout\n${logs}`)}
async function stop(){if(!child)return;child.kill('SIGTERM');for(let i=0;i<50&&child.exitCode===null;i++)await wait(40);child=null}
async function call(route,options={},withAuth=true){const headers={...(withAuth?auth:{}),...(options.body?{'content-type':'application/json'}:{}),...(options.headers||{})},response=await fetch(base+route,{redirect:'manual',...options,headers}),text=await response.text();let body;try{body=JSON.parse(text)}catch{body=text}return {response,body,text}}

(async()=>{try{
  await start();
  let result=await call('/api/health',{},false);assert.equal(result.response.status,200);assert.equal(result.body.service,'foundly-crm');assert.equal(result.body.standalone,true);
  result=await call('/api/ready',{},false);assert.equal(result.response.status,200);assert.equal(result.body.ready,true);assert.deepEqual(result.body.failed,[]);
  result=await call('/crm',{},false);assert.equal(result.response.status,401);assert((result.response.headers.get('www-authenticate')||'').startsWith('Bearer'));
  result=await call('/crm');assert.equal(result.response.status,200);assert(result.text.includes('Foundly CRM'));assert(!result.text.includes('<script>'));
  for(const asset of ['/crm.css','/crm-script.js']){result=await call(asset);assert.equal(result.response.status,200)}
  result=await call('/api/crm/schema');assert.equal(Object.keys(result.body.entities).length,38);assert.equal(result.body.standalone,true);
  result=await call('/api/crm/analytics');assert.equal(result.body.no_fake_data,true);assert.equal(result.body.metrics.pipeline_value.available,false);
  result=await call('/api/crm/status');assert.match(result.body.change_token,/^[a-f0-9]{24}$/);const emptyChangeToken=result.body.change_token;
  result=await call('/api/zero/status');assert.equal(result.response.status,200);assert.equal(result.body.enabled,false);assert.equal(result.body.optional,true);

  result=await call('/api/crm/provision',{method:'POST',headers:{'idempotency-key':'standalone-provision-0001'},body:JSON.stringify({business_name:'Northstar Services',country:'NL',industry:'professional_services',segment:'enterprise'})});assert.equal(result.response.status,201);assert.equal(result.body.created_business_records,0);assert.equal(result.body.no_demo_data,true);const pipeline=result.body.pipeline,stages=result.body.stages;
  const leadPayload={name:'Ada Sensitive Customer',email:'ada@example.test',status:'qualified',score:82,source_id:'website',next_action_at:new Date(Date.now()+3600000).toISOString()};result=await call('/api/crm/leads',{method:'POST',headers:{'idempotency-key':'standalone-lead-0001'},body:JSON.stringify(leadPayload)});assert.equal(result.response.status,201);const lead=result.body.record;
  const replay=await call('/api/crm/leads',{method:'POST',headers:{'idempotency-key':'standalone-lead-0001'},body:JSON.stringify(leadPayload)});assert.equal(replay.body.record.id,lead.id);assert.equal(replay.body.record.idempotent_replay,true);
  result=await call('/api/crm/deals',{method:'POST',headers:{'idempotency-key':'standalone-deal-0001'},body:JSON.stringify({title:'Real persisted opportunity',lead_id:lead.id,pipeline_id:pipeline.id,stage_id:stages[0].id,status:'OPEN',probability:stages[0].probability,value:12500,margin:1800})});const deal=result.body.record;assert.equal(result.response.status,201);
  result=await call('/api/crm/vehicles',{method:'POST',headers:{'idempotency-key':'standalone-vehicle-0001'},body:JSON.stringify({name:'Persisted inventory vehicle',stock_number:'STANDALONE-101'})});const vehicle=result.body.record;assert.equal(result.response.status,201);result=await call('/api/crm/inventory_relations',{method:'POST',headers:{'idempotency-key':'standalone-inventory-relation-0001'},body:JSON.stringify({inventory_id:vehicle.id,lead_id:lead.id,match_score:88,reasons:['expliciete interesse']})});assert.equal(result.response.status,201);result=await call(`/api/crm/inventory/${vehicle.id}/customer-matches`);assert.equal(result.body.matches.items.length,1);assert.equal(result.body.matches.items[0].customer.id,lead.id);assert.equal(result.body.matches.no_fake_data,true);
  result=await call(`/api/crm/deals/${deal.id}/stage`,{method:'PATCH',headers:{'if-match':`"${deal.revision}"`,'idempotency-key':'standalone-move-0001','x-foundly-event-id':'standalone-stage-event-0001'},body:JSON.stringify({stage_id:stages[1].id})});assert.equal(result.body.deal.stage_id,stages[1].id);
  result=await call(`/api/crm/pipelines/${pipeline.id}/board`);assert.equal(result.body.board.stages[1].deals.length,1);
  result=await call('/api/crm/priority-leads');assert.equal(result.body.total,1);assert.equal(result.body.items[0].lead.id,lead.id);
  result=await call('/api/crm/analytics');assert.equal(result.body.metrics.pipeline_value.value,12500);assert.equal(result.body.metrics.pipeline_value.available,true);
  const rangeFrom=new Date(Date.now()-86400000).toISOString(),rangeTo=new Date(Date.now()+86400000).toISOString();result=await call(`/api/crm/analytics?from=${encodeURIComponent(rangeFrom)}&to=${encodeURIComponent(rangeTo)}&compare=true&filter.owner_id=crm-admin`);assert.equal(result.body.comparison.available,true);assert.equal(result.body.filters.owner_id,'crm-admin');assert.equal(result.body.metrics.pipeline_value.value,12500);
  result=await call('/api/crm/dashboard?preset=OPERATIONS&force_preset=1');assert.equal(result.body.dashboard.preset,'OPERATIONS');

  await call('/api/crm/automations',{method:'POST',headers:{'idempotency-key':'standalone-automation-0001'},body:JSON.stringify({name:'Signed webhook follow-up',enabled:true,trigger:{type:'webhook'},actions:[{type:'task',title:'Review signed inbound event'},{type:'email'}]})});
  const webhookBody=JSON.stringify({type:'webhook',entity:'leads',record_id:lead.id}),timestamp=String(Math.floor(Date.now()/1000)),delivery='standalone-delivery-0001',signature='sha256='+crypto.createHmac('sha256',webhookSecret).update(`${timestamp}.${webhookBody}`).digest('hex');
  result=await call('/api/crm/webhooks/inbound',{method:'POST',headers:{'x-foundly-timestamp':timestamp,'x-foundly-signature':'sha256=invalid','x-foundly-delivery-id':delivery},body:webhookBody},false);assert.equal(result.response.status,401);assert.equal(result.response.headers.get('www-authenticate'),null);
  result=await call('/api/crm/webhooks/inbound',{method:'POST',headers:{'x-foundly-timestamp':timestamp,'x-foundly-signature':signature,'x-foundly-delivery-id':delivery},body:webhookBody},false);assert.equal(result.response.status,202);assert.equal(result.body.verified_signature,true);assert(result.body.executions[0].actions.some(action=>action.status==='EXECUTED_INTERNAL'));assert(result.body.executions[0].actions.some(action=>action.status==='AWAITING_EXPLICIT_AUTHORIZATION'&&action.external_write===false));
  result=await call('/api/crm/webhooks/inbound',{method:'POST',headers:{'x-foundly-timestamp':timestamp,'x-foundly-signature':signature,'x-foundly-delivery-id':delivery},body:webhookBody},false);assert.equal(result.body.replayed,true);

  const encryptedPath=path.join(dataDir,'foundly-crm.enc.json'),raw=fs.readFileSync(encryptedPath,'utf8');assert(!raw.includes('Ada Sensitive Customer'));assert(!raw.includes('ada@example.test'));assert(!raw.includes(token));assert(!raw.includes(encryption));assert(JSON.parse(raw).algorithm==='aes-256-gcm');
  await stop();await start();result=await call(`/api/crm/leads/${lead.id}`);assert.equal(result.body.record.email,'ada@example.test');result=await call('/api/crm/status');assert.equal(result.body.data_encrypted_at_rest,true);assert.equal(result.body.standalone,true);assert.notEqual(result.body.change_token,emptyChangeToken);assert(result.body.changes>0);
  const standaloneSource=fs.readFileSync(path.join(__dirname,'crm-standalone.js'),'utf8'),dockerfile=fs.readFileSync(path.join(__dirname,'Dockerfile.crm'),'utf8'),railway=JSON.parse(fs.readFileSync(path.join(__dirname,'railway.crm.json'),'utf8'));assert(!standaloneSource.includes("require('./neural-runtime')"));assert(!standaloneSource.includes("require('./server')"));assert(dockerfile.includes('USER node'));assert(dockerfile.includes('CMD ["node", "crm-standalone.js"]'));assert(!dockerfile.includes('neural-runtime'));assert.equal(railway.deploy.healthcheckPath,'/api/health');
  console.log(JSON.stringify({ok:true,standalone_crm:'pass',health_ready:'pass',api_auth:'pass',encrypted_at_rest:'pass',formal_api:'pass',customer_data_persistence:'pass',inventory_customer_matches:'pass',pipeline_drag_contract:'pass',analytics_real_data:'pass',analytics_filters_comparison:'pass',dashboard_presets:'pass',audited_live_change_token:'pass',signed_webhook:'pass',webhook_replay:'pass',external_write_gate:'pass',zero_optional:'pass',no_neural_dependency:'pass',standalone_packaging_contract:'pass'},null,2));
}catch(error){console.error(logs);console.error(error);process.exitCode=1}finally{await stop()}})();
