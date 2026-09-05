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
async function request(route, method = 'GET', body) {
  const response = await fetch(base + route, { method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
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
    console.log('PASS authenticated composition API, route aliases, ZERO tools, revocation, encrypted restart and reenablement');
  } finally { await stop(); fs.rmSync(dir, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });
