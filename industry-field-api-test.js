'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'foundly-industry-fields-test-'));
const port = 24200 + Math.floor(Math.random() * 900);
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
 await start();
 assert.equal((await request('/api/composition','PUT',{entitlements:['procurement'],industry_id:'AUTOMOTIVE',expected_revision:0})).status,200);
 const schema=await request('/api/procurement/schema');assert.equal(schema.status,200);assert.equal(schema.body.industry_fields.industry_id,'AUTOMOTIVE');assert.equal(schema.body.industry_fields.fields.find(f=>f.name==='mileage').type,'number');
 assert.equal((await request('/api/sales/schema')).status,403);
 const saved=await request('/api/procurement/opportunities','POST',{title:'Field persistence fixture',industry_fields:{vin:'fixture-vin',mileage:12000}});assert.equal(saved.status,201,JSON.stringify(saved.body));const record=saved.body.record;
 assert.equal(record.industry_field_pack_id,'AUTOMOTIVE');
 assert.equal((await request('/api/procurement/opportunities','POST',{title:'Invalid type',industry_fields:{mileage:'12000'}})).status,422);
 await stop();await start();
 const read=await request('/api/procurement/opportunities/'+record.id);assert.equal(read.body.record.industry_fields.mileage,12000);
 const revised=await request('/api/procurement/opportunities/'+record.id,'PUT',{expected_revision:record.revision,industry_fields:{mileage:13000}});assert.equal(revised.status,200);assert.equal(revised.body.record.industry_fields.vin,'fixture-vin');
 assert.equal((await request('/api/composition','PUT',{entitlements:['procurement'],industry_id:'GENERAL',expected_revision:1})).status,200);
 assert.deepEqual((await request('/api/procurement/schema')).body.industry_fields.fields,[]);
 const kept=await request('/api/procurement/opportunities/'+record.id,'PUT',{expected_revision:revised.body.record.revision,title:'Preserved across pack change'});assert.equal(kept.status,200);assert.equal(kept.body.record.industry_fields.mileage,13000);
 assert.equal((await request('/api/procurement/opportunities/'+record.id,'PUT',{expected_revision:kept.body.record.revision,industry_fields:{}})).body.code,'industry_pack_conflict');
 assert.equal((await request('/api/procurement/opportunities','POST',{title:'No active pack',industry_fields:{vin:'fixture'}})).status,422);
 const query='?from=2026-01-01T00:00:00Z&to=2027-01-01T00:00:00Z';
 assert.equal((await request('/api/analysis/industry-kpis'+query)).status,403);
 assert.equal((await request('/api/composition','PUT',{entitlements:['analysis'],industry_id:'GENERAL',expected_revision:2})).status,200);
 const emptyKpis=await request('/api/analysis/industry-kpis'+query);assert.equal(emptyKpis.status,200);assert.deepEqual(emptyKpis.body.items,[]);assert.equal(emptyKpis.body.status,'NO_REGISTERED_KPIS');
 assert.equal((await request('/api/analysis/industry-kpis?from=invalid')).status,422);
 assert.equal((await request('/api/composition','PUT',{entitlements:['analysis'],industry_id:'GENERAL',expected_revision:3,capability_flags:{'analysis:events':false}})).status,200);
 assert.equal((await request('/api/analysis/industry-kpis'+query)).status,403);
 console.log('PASS industry schema API, typed fields, encrypted restart, partial field updates, module boundaries and retained pack provenance');
}finally{await stop();fs.rmSync(dir,{recursive:true,force:true});}})().catch(error=>{console.error(error);process.exitCode=1;});
