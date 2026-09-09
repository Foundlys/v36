'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'foundly-finance-loading-test-'));
const port = 31400 + Math.floor(Math.random() * 900);
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
const {load}=require('./finance-loading');
(async()=>{try{
 await start();assert.equal((await request('/api/composition','PUT',{entitlements:['finance'],expected_revision:0})).status,200);
 const entity=await request('/api/finance/legal-entities','POST',{name:'Explicit loader fixture',legal_form:'BV'});assert.equal(entity.status,201);
 const calls=[],api=async route=>{calls.push(route);const result=await request(route);if(result.status>=400)throw Object.assign(new Error(result.body.error||result.body.code),{status:result.status});return result.body;};
 let result=await load(api,new URLSearchParams());assert.equal(result.components.reports.status,'AVAILABLE');assert.equal(result.selected_entity_id,entity.body.id);
 const asset=await fetch(base+'/finance-loading.js',{headers:{authorization:'Bearer '+token}});assert.equal(asset.status,200);assert.ok((await asset.text()).includes('FoundlyFinanceLoading'));
 assert.equal((await request('/api/composition','PUT',{entitlements:['finance'],expected_revision:1,capability_flags:{'finance:ledger':false}})).status,200);calls.length=0;result=await load(api,new URLSearchParams({legal_entity_id:entity.body.id}));assert.equal(result.components.entities.status,'DISABLED');assert.equal(result.components.reports.status,'AVAILABLE');assert.equal(result.selected_entity_id,entity.body.id);assert.ok(!calls.some(route=>route.includes('/records/')));
 await stop();await start();result=await load(api,new URLSearchParams({legal_entity_id:entity.body.id}));assert.equal(result.components.reports.status,'AVAILABLE');assert.equal(result.reports.general_ledger.entries.length,0);
 assert.equal((await request('/api/composition','PUT',{entitlements:['finance'],expected_revision:2,capability_flags:{'finance:reports':false}})).status,200);calls.length=0;result=await load(api,new URLSearchParams());assert.equal(result.components.entities.status,'AVAILABLE');assert.equal(result.components.reports.status,'DISABLED');assert.ok(!calls.some(route=>/reports|dashboard/.test(route)));
 console.log('PASS real Finance-only loader, independent ledger/report capabilities, stable entity filter, delivered asset and encrypted restart without accounting-engine changes');
}finally{await stop();fs.rmSync(dir,{recursive:true,force:true});}})().catch(error=>{console.error(error);process.exitCode=1;});
