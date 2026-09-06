'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'foundly-composition-test-'));
const port = 23100 + Math.floor(Math.random() * 900);
const base = `http://127.0.0.1:${port}`;
// Isolated fixtures only; never production credentials.
const token = crypto.randomBytes(32).toString('hex');
const env = { ...process.env, PORT: String(port), NODE_ENV: 'production', FOUNDLY_ADMIN_TOKEN: token, FOUNDLY_ADMIN_PASSWORD: '', FOUNDLY_ENCRYPTION_KEY: crypto.randomBytes(32).toString('hex'), FOUNDLY_DATA_DIR: dir, FOUNDLY_TENANT_ID: 'fixture-composition', FOUNDLY_DEALER_ID: 'fixture-business', FOUNDLY_PLATFORM_ROLES: 'ADMIN,SUPER_ADMIN', FOUNDLY_CRM_ROLES: 'ADMIN', FOUNDLY_PUBLIC_BASE_URL: 'https://foundly.example.test', OPENAI_API_KEY: '', FOUNDLY_AI_API_KEY: '', FOUNDLY_WORKER_INTERVAL_MS: '99999999' };
let child, logs = '';
async function start() {
  child = spawn(process.execPath, ['server.js'], { cwd: __dirname, env, stdio: ['ignore', 'pipe', 'pipe'] });
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
(async () => {
  try {
    await start();
    assert.equal((await fetch(base + '/api/composition')).status, 401);
    assert.equal((await request('/api/composition')).body.resolution.legacy_compatibility, true);
    const config = await request('/api/composition', 'PUT', { entitlements: ['crm'], enabled_modules: ['crm'], industry_id: 'GENERAL', expected_revision: 0 });
    assert.equal(config.status, 200, JSON.stringify(config.body));
    const nav = (await request('/api/workspaces')).body.workspaces.map(w => w.id);
    assert.ok(nav.includes('crm')); assert.ok(!nav.includes('finance')); assert.ok(!nav.includes('automotive'));
    for (const route of ['/api/finance/status', '/api/analysis/status', '/api/workspaces/finance/dashboard', '/api/module/inkoop/summary', '/finance', '/finance.html', '/api/automotive/status']) {
      const response = await fetch(base + route, { headers: { authorization: `Bearer ${token}` } });
      assert.equal(response.status, 403, route);
    }
    for (const alias of ['zero', 'jarvis']) {
      const tools = (await request(`/api/${alias}/tools`)).body.tools;
      assert.ok(tools.some(t => t.tool_id === 'crm_customer_360'));
      assert.ok(!tools.some(t => t.tool_id === 'finance_report'));
    }
    assert.equal((await request('/api/crm/status')).status, 200);
    await stop(); await start();
    assert.deepEqual((await request('/api/composition')).body.resolution.enabled_modules, ['crm']);
    assert.equal((await request('/api/finance/status')).status, 403);
    assert.equal((await request('/api/composition', 'PUT', { bundle: 'COMPLETE', expected_revision: 0 })).status, 409);
    assert.equal((await request('/api/composition', 'PUT', { entitlements: ['crm', 'finance'], expected_revision: 1 })).status, 200);
    assert.equal((await request('/api/finance/status')).status, 200);
    assert.equal((await request('/api/composition','PUT',{entitlements:['automation'],expected_revision:2})).status,200);
    const wf=(await request('/api/automation/workflows','POST',{name:'Standalone automation',trigger:'custom_event',actions:[{type:'create_task',title:'First independent task'},{type:'create_task',title:'Second independent task'},{type:'create_document',title:'Internal draft'}]})).body;
    const executed=await request(`/api/automation/workflows/${wf.id}/runs`,'POST',{event:{event_id:'standalone-fixture-event'}});
    assert.equal(executed.body.status,'SUCCEEDED',JSON.stringify(executed.body));
    assert.equal((await request('/api/automation/tasks')).body.total,2);
    assert.equal((await request('/api/automation/documents')).body.total,1);
    assert.equal((await request('/api/crm/tasks')).status,403);
    for(const route of ['/api/engine/finance/status','/api/engine/rapportages/status','/api/google/calendar/events','/api/google/ads/customers','/api/meta/pages'])assert.equal((await request(route)).status,403,route);
    const invalid=await fetch(base+'/api/google/oauth/callback?state=invalid',{redirect:'manual'});assert.equal(invalid.status,302,'OAuth state boundary remains intact');
    await stop();await start();assert.equal((await request('/api/automation/tasks')).body.total,2);
    assert.equal((await request('/api/composition','PUT',{entitlements:['crm'],capability_flags:{'crm:leads':false},expected_revision:3})).status,200);
    assert.equal((await request('/api/crm/leads')).status,403);
    assert.equal((await request('/api/crm/contacts')).status,200);
    assert.ok(!(await request('/api/zero/tools')).body.tools.some(t=>t.tool_id==='create_lead'));
    assert.equal((await request('/api/zero/turn','POST',{message:'Welke leads hebben prioriteit?',conversation_id:'flagged-crm-conversation',turn_id:'flagged-crm-turn'})).status,403,'ZERO must enforce disabled lead capability at execution');
    const privateContact=await request('/api/crm/contacts','POST',{name:'Private fixture contact',owner_id:'private-fixture-owner'});assert.equal(privateContact.status,201);
    assert.equal((await request('/api/workspaces/crm/dashboard','PUT',{scope:'TEAM',team_id:'private-team',name:'Private team layout',widgets:[]})).status,201);
    await stop();env.FOUNDLY_PLATFORM_ROLES='VIEWER';env.FOUNDLY_PLATFORM_USER_ID='viewer-fixture';await start();
    assert.equal((await request('/api/crm/contacts')).body.total,0,'Canonical viewer cannot inherit CRM ADMIN read-all');
    assert.equal((await request(`/api/crm/contacts/${privateContact.body.record.id}`)).status,404);
    assert.ok(!(await request('/api/module/crm/data')).body.records.some(row=>row.id===privateContact.body.record.id),'Legacy module query must use the CRM public read contract');
    assert.ok((await request('/api/workspaces')).body.workspaces.some(w=>w.id==='crm'));
    for(const method of ['GET','DELETE'])assert.equal((await request('/api/workspaces/crm/dashboard?scope=TEAM&team_id=private-team',method)).status,403);
    assert.equal((await request('/api/workspaces/crm/dashboard?scope=ROLE&role=ADMIN')).status,403);
    assert.equal((await request('/api/workspaces/crm/dashboard','PUT',{scope:'ROLE',role:'VIEWER',widgets:[]})).status,403);
    assert.equal((await request('/api/crm/contacts','POST',{name:'Forbidden write'})).status,403,'Canonical role cannot inherit separate CRM ADMIN for writes');
    assert.equal((await request('/api/composition/preview','POST',{bundle:'COMPLETE',expected_revision:4})).status,403);
    assert.equal((await request('/api/composition','PUT',{bundle:'COMPLETE',expected_revision:4})).status,403);
    await stop();env.FOUNDLY_PLATFORM_ROLES='ADMIN,SUPER_ADMIN';await start();
    assert.equal((await request('/api/composition','PUT',{entitlements:['calendar'],expected_revision:4})).status,200);
    const calendar=(await request('/api/calendar/calendars','POST',{name:'HTTP fixture calendar',timezone:'Europe/Amsterdam'})).body.record;
    assert.equal((await request('/api/calendar/availability','POST',{title:'HTTP fixture availability',calendar_id:calendar.id,start_at:'2026-11-02T09:00:00+01:00',end_at:'2026-11-02T11:00:00+01:00',timezone:'Europe/Amsterdam'})).status,201);
    const query=new URLSearchParams({from:'2026-11-02T09:00:00+01:00',to:'2026-11-02T11:00:00+01:00'}),slot=(await request(`/api/calendar/scheduling/slots?${query}`)).body.items[0],booking={...slot,title:'HTTP fixture booking',confirm:true};
    assert.equal((await request('/api/calendar/scheduling/book','POST',booking,{'idempotency-key':'http-booking-fixture'})).status,201);
    assert.equal((await request('/api/calendar/scheduling/book','POST',booking,{'idempotency-key':'http-booking-fixture'})).body.deduplicated,true);
    await stop();await start();assert.equal((await request('/api/calendar/events')).body.total,1);
    for(const callback of ['/api/connect/meta/callback','/api/google/oauth/callback','/api/connect/linkedin/callback','/api/connect/tiktok/callback','/api/connect/wix/callback'])assert.equal((await fetch(base+callback+'?state=invalid',{redirect:'manual'})).status,302,callback);
    console.log('PASS authenticated composition API, route aliases, ZERO tools, revocation, encrypted restart and reenablement');
  } finally { await stop(); fs.rmSync(dir, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });
