'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'foundly-quota-api-test-'));
const port = 26600 + Math.floor(Math.random() * 900);
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
 await start();assert.equal((await request('/api/composition','PUT',{entitlements:['sales'],expected_revision:0})).status,200);
 const owner=(await request('/api/identity/session')).body.principal.id;
 const target=await request('/api/sales/quotas','POST',{name:'API quota fixture',owner_id:owner,period_start:'2026-09-01',period_end:'2026-09-30',currency:'EUR',target_cents:100000,status:'OPEN'});assert.equal(target.status,201,JSON.stringify(target.body));
 assert.ok((await request('/api/workspaces/sales')).body.workspace.domain_entities.includes('quotas'));
 const opportunity=await request('/api/sales/opportunities','POST',{title:'Won fixture',currency:'EUR',value_cents:25000,status:'WON',closed_date:'2026-09-20'});assert.equal(opportunity.status,201);
 const filters={from:'2026-09-01',to:'2026-09-30',currency:'EUR'},computed=await request('/api/sales/forecast?'+new URLSearchParams(filters));assert.equal(computed.body.quotas.items[0].attainment_percent,25);
 const input={title:'Reviewed quota fixture',filters,basis_fingerprint:computed.body.basis_fingerprint,confirm:true},snapshot=await request('/api/sales/forecast/snapshots','POST',input,{'idempotency-key':'quota-api-snapshot'});assert.equal(snapshot.status,201);
 await stop();await start();assert.equal((await request('/api/sales/quotas/'+target.body.record.id)).body.record.target_cents,100000);assert.equal((await request('/api/sales/forecast_snapshots/'+snapshot.body.record.id)).body.record.forecast.quotas.items[0].attainment_percent,25);
 assert.equal((await request('/api/sales/quotas/'+target.body.record.id,'PUT',{expected_revision:1,target_cents:200000})).status,200);
 assert.equal((await request('/api/sales/forecast/snapshots','POST',input,{'idempotency-key':'changed-target'})).status,409);
 const privateOpportunity=await request('/api/sales/opportunities','POST',{title:'Private other-owned source fixture',owner_id:'private-other-owner',currency:'EUR',value_cents:999000,status:'WON',closed_date:'2026-09-20'});assert.equal(privateOpportunity.status,201);
 const broad=await request('/api/sales/forecast?'+new URLSearchParams(filters)),broadSnapshot=await request('/api/sales/forecast/snapshots','POST',{title:'Owned broad snapshot',filters,basis_fingerprint:broad.body.basis_fingerprint,confirm:true},{'idempotency-key':'broad-api-snapshot'});assert.equal(broadSnapshot.status,201);
 await stop();env.FOUNDLY_PLATFORM_ROLES='SALES';await start();assert.equal((await request('/api/sales/quotas/'+target.body.record.id,'PUT',{expected_revision:2,target_cents:1})).status,403);
 assert.equal((await request('/api/sales/quotas')).body.total,1);
 assert.equal((await request('/api/sales/forecast_snapshots/'+broadSnapshot.body.record.id)).status,404);
 const dataSnapshot=await request('/api/workspaces/data/snapshot');assert.equal(dataSnapshot.status,200);assert.ok(!JSON.stringify(dataSnapshot.body).includes('Private other-owned source fixture'),'Shared Data must not reveal a saved snapshot whose current sources are private');
 await stop();env.FOUNDLY_PLATFORM_USER_ID='other-fixture-seller';await start();assert.equal((await request('/api/sales/quotas')).body.total,0);
 console.log('PASS authenticated quota management, workspace exposure, exact target-bound snapshots, encrypted restart, stale target denial and private seller access');
}finally{await stop();fs.rmSync(dir,{recursive:true,force:true});}})().catch(error=>{console.error(error);process.exitCode=1;});
