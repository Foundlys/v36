'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'foundly-drafts-api-test-'));
const port = 27800 + Math.floor(Math.random() * 900);
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
 await start();assert.equal((await request('/api/composition','PUT',{entitlements:['automation'],expected_revision:0})).status,200);
 const draft={name:'Private unfinished workflow',version:'1',trigger_type:'custom_event',automatic:true,event_name:'fixture.unfinished',steps:[{type:'create_task',values:{title:''},condition:{enabled:false}}]},input={draft,expected_revision:0};
 const response=await request('/api/automation/drafts/fixture-draft','PUT',input);assert.equal(response.status,200,JSON.stringify(response.body));assert.equal(response.body.executable,false);
 assert.equal((await request('/api/automation/status')).body.workflows.length,0);
 assert.equal((await request('/api/automation/tasks')).body.total,0);
 assert.ok(!(JSON.stringify((await request('/api/workspaces/data/snapshot')).body)).includes('Private unfinished workflow'));
 const asset=await fetch(base+'/workflow-draft-session.js',{headers:{authorization:'Bearer '+token}});assert.equal(asset.status,200);assert.ok((await asset.text()).includes('FoundlyWorkflowDraftSession'));
 await stop();await start();assert.deepEqual((await request('/api/automation/drafts')).body.items[0].draft,draft);assert.equal((await request('/api/automation/drafts/fixture-draft','PUT',input)).body.deduplicated,true);
 assert.equal((await request('/api/automation/drafts/fixture-draft','PUT',{draft:{...draft,name:'Conflict'},expected_revision:0})).status,409);
 await stop();env.FOUNDLY_PLATFORM_USER_ID='other-draft-owner';await start();assert.equal((await request('/api/automation/drafts')).body.items.length,0);assert.equal((await request('/api/automation/drafts/fixture-draft','PUT',input)).status,404);
 await stop();delete env.FOUNDLY_PLATFORM_USER_ID;env.FOUNDLY_PLATFORM_ROLES='VIEWER';await start();assert.equal((await request('/api/automation/drafts/fixture-draft','PUT',{draft,expected_revision:1})).status,403);
 await stop();env.FOUNDLY_PLATFORM_ROLES='ADMIN,SUPER_ADMIN';await start();assert.equal((await request('/api/composition','PUT',{entitlements:['automation'],enabled_modules:[],expected_revision:1})).status,200);assert.equal((await request('/api/automation/drafts')).status,403);assert.equal((await request('/api/automation/drafts/export')).body.items.length,1);
 console.log('PASS authenticated unfinished drafts, no workflow activation, private Data projection, assets, encrypted restart, exact replay, CAS conflict, foreign-owner denial and retained export');
}finally{await stop();fs.rmSync(dir,{recursive:true,force:true});}})().catch(error=>{console.error(error);process.exitCode=1;});
