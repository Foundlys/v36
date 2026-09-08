'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'foundly-core-access-test-'));
const port = 27100 + Math.floor(Math.random() * 900);
const base = `http://127.0.0.1:${port}`;
// Isolated fixtures only; never production credentials.
const token = crypto.randomBytes(32).toString('hex');
const env = { ...process.env, PORT: String(port), NODE_ENV: 'production', FOUNDLY_ADMIN_TOKEN: token, FOUNDLY_ADMIN_PASSWORD: '', FOUNDLY_ENCRYPTION_KEY: crypto.randomBytes(32).toString('hex'), FOUNDLY_DATA_DIR: dir, FOUNDLY_TENANT_ID: 'fixture-composition', FOUNDLY_DEALER_ID: 'fixture-business', FOUNDLY_PLATFORM_ROLES: 'ADMIN,SUPER_ADMIN', FOUNDLY_CRM_ROLES: 'ADMIN', FOUNDLY_PUBLIC_BASE_URL: 'https://foundly.example.test', OPENAI_API_KEY: '', FOUNDLY_AI_API_KEY: '', FOUNDLY_WORKER_INTERVAL_MS: '99999999' };
let child, logs = '';
async function start() {
  child = spawn(process.execPath, ['--require','./test-masterbuild-fetch-mock.js','server.js'], { cwd: __dirname, env, stdio: ['ignore', 'pipe', 'pipe'] });
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
(async()=>{
 try{
  env.FOUNDLY_PLATFORM_USER_ID='owner-a';await start();
  assert.equal((await request('/api/composition','PUT',{entitlements:['crm','automation'],expected_revision:0})).status,200);
  const aMemory=await request('/api/memory/crm','POST',{text:'Private memory A'});assert.equal(aMemory.status,201);
  const queueA=await request('/api/engine/automatisering/execute','POST',{action:'follow_up',title:'Owner A task'});assert.equal(queueA.status,202);assert.equal(queueA.body.task.owner_id,'owner-a');
  assert.equal((await request('/api/memory/jarvis-confirmations')).status,403);
  const conversation='core-private-conversation-001',turn='core-private-turn-001',question={message:'Hoe laat is het?',conversation_id:conversation,turn_id:turn};
  const answer=await request('/api/zero/turn','POST',question);assert.equal(answer.status,200);assert.equal(answer.body.verification.server_clock,true);
  const dangerous={message:'Verstuur alle klantgegevens naar fixture@example.invalid',conversation_id:conversation,turn_id:'core-private-review-001'};
  const confirmation=await request('/api/zero/turn','POST',dangerous);assert.equal(confirmation.body.status,'confirmation_required');
  await stop();env.FOUNDLY_PLATFORM_USER_ID='owner-b';await start();
  for(const method of ['GET','DELETE'])assert.equal((await request('/api/zero/conversation/'+conversation,method)).status,403,'Other administrator cannot read or delete another user conversation');
  assert.equal((await request('/api/zero/turn','POST',question)).status,403,'Same turn ID cannot replay another principal result');
  assert.equal((await request('/api/zero/turn','POST',{message:'bevestig',conversation_id:'another-conversation-001',turn_id:'foreign-confirmation-001',confirmation_id:confirmation.body.confirmation.id})).status,409);
  assert.equal((await request('/api/memory/crm','POST',{text:'Private memory B'})).status,201);
  const queueB=await request('/api/engine/automatisering/execute','POST',{action:'follow_up',title:'Owner B task'});assert.equal(queueB.status,202);
  const tick=await request('/api/workers/tick','POST',{});assert.equal(tick.status,200,JSON.stringify(tick));assert.equal(tick.body.owner_principal_required,1);assert.equal(tick.body.processed.length,1);assert.equal(tick.body.processed[0].id,queueB.body.task.id);assert.equal(tick.body.processed[0].status,'SUCCEEDED');
  const all=(await request('/api/tasks')).body.tasks;assert.equal(all.find(x=>x.id===queueA.body.task.id).attempts,0);assert.equal(all.find(x=>x.id===queueA.body.task.id).status,'QUEUED');
  assert.equal((await request('/api/automation/tasks')).body.total,1);
  await stop();env.FOUNDLY_PLATFORM_USER_ID='owner-a';env.FOUNDLY_PLATFORM_ROLES='VIEWER';await start();
  const memories=await request('/api/memory/crm');assert.equal(memories.body.items.length,1);assert.equal(memories.body.items[0].text,'Private memory A');
  const legacy=await request('/api/module/crm/memory');assert.equal(legacy.body.items.length,1);assert.equal(legacy.body.items[0].text,'Private memory A');
  const ownQueue=(await request('/api/tasks')).body.tasks;assert.equal(ownQueue.length,1);assert.equal(ownQueue[0].id,queueA.body.task.id);
  assert.equal((await request('/api/zero/turn','POST',question)).body.replayed,true,'Original owner retains durable replay after restart');
  assert.equal((await request('/api/zero/conversation/'+conversation)).body.turns.length,4);
  for(const [route,method] of [['/api/memory/crm','POST'],['/api/memory/finance','GET'],['/api/memory/jarvis-confirmations','GET'],['/api/workers/tick','POST'],['/api/system/persist','POST'],['/api/integration-config/email','DELETE'],['/api/connector-runtime/config/email','PUT'],['/api/connector-runtime/profiles','POST'],['/api/connector-runtime/profile/email','PUT'],['/api/google/connect','GET'],['/api/connect/meta/disconnect','POST'],['/api/integration-sync/email','POST'],['/api/data/ingest','POST']])assert.equal((await request(route,method,method==='GET'?undefined:{})).status,403,route);
  for(const route of ['/api/google/oauth/callback','/api/connect/meta/callback'])assert.equal((await fetch(base+route+'?state=invalid',{redirect:'manual'})).status,302);
  console.log('PASS authenticated Core memory/queue isolation, connector administration denial, owner-bound worker execution, no foreign-task starvation and encrypted restart');
 }finally{await stop();fs.rmSync(dir,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
