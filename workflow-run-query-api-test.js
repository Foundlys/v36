'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'foundly-run-query-api-test-'));
const port = 28900 + Math.floor(Math.random() * 900);
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
 const workflow=await request('/api/automation/workflows','POST',{name:'Run search API fixture',trigger:'custom_event',actions:[{type:'create_task',title:'A durable searched action'}]});assert.equal(workflow.status,201);
 for(let i=0;i<4;i++)assert.equal((await request('/api/automation/workflows/'+workflow.body.id+'/runs','POST',{event:{event_id:'query-api-event-'+i}})).body.status,'SUCCEEDED');
 const page=await request('/api/automation/runs?limit=2');assert.equal(page.status,200);assert.equal(page.body.total,4);assert.equal(page.body.next_offset,2);assert.equal((await request('/api/automation/runs?limit=2&offset=2')).body.items.length,2);
 assert.equal((await request('/api/automation/runs?status=succeeded&q=CREATE_TASK')).body.total,4);assert.equal((await request('/api/automation/runs?event_id=query-api-event-1')).body.total,1);assert.equal((await request('/api/automation/runs?limit=500')).status,422);
 const tasks=(await request('/api/automation/tasks')).body.total;assert.equal(tasks,4);
 await stop();await start();assert.equal((await request('/api/automation/runs')).body.total,4);assert.equal((await request('/api/automation/tasks')).body.total,tasks);
 assert.equal((await request('/api/composition','PUT',{entitlements:['automation'],expected_revision:1,capability_flags:{'automation:workflows':false}})).status,200);assert.equal((await request('/api/automation/runs')).body.total,4);assert.equal((await request('/api/automation/workflows')).status,403);
 assert.equal((await request('/api/composition','PUT',{entitlements:['automation'],expected_revision:2,capability_flags:{'automation:runs':false}})).status,200);assert.equal((await request('/api/automation/runs')).status,403);const definitions=await request('/api/automation/workflows');assert.equal(definitions.status,200);assert.ok(!Object.hasOwn(definitions.body,'runs'));
 assert.equal((await request('/api/composition','PUT',{entitlements:['automation'],expected_revision:3})).status,200);
 await stop();env.FOUNDLY_PLATFORM_USER_ID='unrelated-reader';env.FOUNDLY_PLATFORM_ROLES='VIEWER';await start();assert.equal((await request('/api/automation/runs?q=query-api')).body.total,0);assert.equal((await request('/api/automation/workflows')).body.workflows.length,0);
 console.log('PASS authenticated run search and paging, preserved task counts, encrypted restart, independent workflow/run capabilities and private history');
}finally{await stop();fs.rmSync(dir,{recursive:true,force:true});}})().catch(error=>{console.error(error);process.exitCode=1;});
