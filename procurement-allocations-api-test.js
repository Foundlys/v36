'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'foundly-allocation-api-test-'));
const port = 25400 + Math.floor(Math.random() * 900);
const base = `http://127.0.0.1:${port}`;
// Isolated fixtures only; never production credentials.
const token = crypto.randomBytes(32).toString('hex');
const env = { ...process.env, PORT: String(port), NODE_ENV: 'production', FOUNDLY_ADMIN_TOKEN: token, FOUNDLY_ADMIN_PASSWORD: '', FOUNDLY_ENCRYPTION_KEY: crypto.randomBytes(32).toString('hex'), FOUNDLY_DATA_DIR: dir, FOUNDLY_TENANT_ID: 'fixture-composition', FOUNDLY_DEALER_ID: 'fixture-business', FOUNDLY_PLATFORM_ROLES: 'ADMIN,SUPER_ADMIN', FOUNDLY_CRM_ROLES: 'ADMIN', FOUNDLY_PUBLIC_BASE_URL: 'https://foundly.example.test', OPENAI_API_KEY: '', FOUNDLY_AI_API_KEY: '', FOUNDLY_WORKER_INTERVAL_MS: '99999999' };
let child, logs = '';
async function start() {
  child = spawn(process.execPath, [...(env.FOUNDLY_CONTEXT_ACL_TEST?['--require','./test-composition-context-mock.js']:[]),'server.js'], { cwd: __dirname, env, stdio: ['ignore', 'pipe', 'pipe'] });
  for (const stream of [child.stdout, child.stderr]) stream.on('data', b => { logs = (logs + b).slice(-16000); });
  for (let attempt = 0; attempt < 80; attempt++) {
    if (child.exitCode !== null) throw new Error(`Server exited: ${logs}`);
    try { if ((await fetch(`${base}/api/health`)).ok) return; } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('Server start timeout');
}
async function stop() { if (child?.exitCode === null) { const closed = once(child, 'exit'); child.kill('SIGTERM'); await closed; } }
async function request(route, method = 'GET', body, extraHeaders={}) {
  const response = await fetch(base + route, { method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json',...extraHeaders }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, body: await response.json() };
}
(async()=>{try{
 await start();assert.equal((await request('/api/composition','PUT',{entitlements:['procurement'],expected_revision:0})).status,200);
 const actor=(await request('/api/identity/session')).body.principal;
 async function create(entity,input){const result=await request('/api/procurement/'+entity,'POST',input);assert.equal(result.status,201,JSON.stringify(result.body));return result.body.record;}
 await create('approval_policies',{name:'Explicit fixture reviewer policy',currency:'EUR',status:'OPEN',minimum_value_cents:0,approval_steps:[actor.id],allow_self_approval:true});
 const suppliers=await Promise.all(['Supplier A','Supplier B'].map(name=>create('suppliers',{name})));
 const rfq=await create('rfqs',{title:'API allocation fixture',currency:'EUR',lines:[{item_id:'A',description:'Article fixture',quantity:10}]});
 const bids=await Promise.all(suppliers.map((supplier,i)=>create('bids',{title:'Bid '+i,rfq_id:rfq.id,rfq_revision:rfq.revision,supplier_id:supplier.id,currency:'EUR',evidence_reference:'Manual fixture source '+i,lines:[{item_id:'A',quantity:10,unit_price_cents:1000+i*100}]})));
 const allocations=bids.map(bid=>({bid_id:bid.id,item_id:'A',quantity:5})),basePath='/api/procurement/rfqs/'+rfq.id;
 const preview=await request(basePath+'/allocation-preview','POST',{allocations});assert.equal(preview.status,200,JSON.stringify(preview.body));assert.equal(preview.body.value_cents,10500);
 const input={allocations,preview_fingerprint:preview.body.preview_fingerprint,confirm:true,reason:'Explicit fixture allocation verified'};
 const response=await request(basePath+'/awards','POST',input,{'idempotency-key':'allocate-fixture'});assert.equal(response.status,201,JSON.stringify(response.body));const record=response.body.record;
 await stop();await start();
 const restored=await request('/api/procurement/awards/'+record.id);assert.deepEqual(restored.body.record.allocation_lines,record.allocation_lines);
 assert.equal((await request(basePath+'/awards','POST',input,{'idempotency-key':'allocate-fixture'})).body.deduplicated,true);
 const review={confirm:true,expected_revision:1,decision:'APPROVE',reason:'Combined source prices reviewed'};
 const approved=await request('/api/procurement/awards/'+record.id+'/approve','POST',review,{'idempotency-key':'review-allocation'});assert.equal(approved.status,200,JSON.stringify(approved.body));assert.equal(approved.body.record.status,'APPROVED_INTERNAL');assert.equal(approved.body.external_commitment,false);
 assert.equal((await request('/api/procurement/orders')).body.total,0);
 assert.equal((await request(basePath+'/awards','POST',input,{'idempotency-key':'duplicate-plan'})).status,409);
 await stop();await start();assert.equal((await request('/api/procurement/awards/'+record.id)).body.record.status,'APPROVED_INTERNAL');
 assert.equal((await request('/api/composition','PUT',{entitlements:['procurement'],expected_revision:1,capability_flags:{'procurement:sourcing':false}})).status,200);
 assert.equal((await request(basePath+'/allocation-preview','POST',{allocations})).status,403);
 console.log('PASS authenticated allocation preview and approval, exact durable lines, encrypted restart, idempotent replay, duplicate plan denial, no supplier order and capability revocation');
}finally{await stop();fs.rmSync(dir,{recursive:true,force:true});}})().catch(error=>{console.error(error);process.exitCode=1;});
