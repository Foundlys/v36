'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const {spawn} = require('node:child_process');
const {once} = require('node:events');
const assert = require('node:assert/strict');

// Real HTTP, identity, composition, encryption and persistence. No model/provider
// responses are substituted here. Individual contract tests declare their fakes.
async function fixture(overrides = {}) {
  const root = path.resolve(__dirname, '..');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'foundly-zero-eval-'));
  const port = 33000 + crypto.randomInt(15000);
  const base = `http://127.0.0.1:${port}`;
  const token = crypto.randomBytes(32).toString('hex');
  const origin = 'https://foundly.example.test';
  const env = {...process.env, NODE_ENV:'production', NODE_OPTIONS:'', PORT:String(port),
    FOUNDLY_DATA_DIR:dir, FOUNDLY_ADMIN_TOKEN:token, FOUNDLY_ADMIN_PASSWORD:'',
    FOUNDLY_ENCRYPTION_KEY:crypto.randomBytes(32).toString('hex'),
    FOUNDLY_TENANT_ID:'zero-evaluation', FOUNDLY_DEALER_ID:'default',
    FOUNDLY_PLATFORM_USER_ID:'evaluation-bootstrap', FOUNDLY_PLATFORM_ROLES:'ADMIN,SUPER_ADMIN',
    FOUNDLY_PUBLIC_BASE_URL:origin, FOUNDLY_WORKER_INTERVAL_MS:'99999999',
    OPENAI_API_KEY:'', FOUNDLY_AI_API_KEY:'', ANTHROPIC_API_KEY:'',
    FOUNDLY_ZERO_MODEL_REGISTRY:'', ...overrides};
  let child, logs = '';
  async function start() {
    child = spawn(process.execPath, ['server.js'], {cwd:root, env, stdio:['ignore','pipe','pipe']});
    for (const stream of [child.stdout, child.stderr]) stream.on('data', b => { logs = (logs + b).slice(-8000); });
    for (let n = 0; n < 100; n++) {
      if (child.exitCode !== null) throw Error('Fixture exited: ' + logs);
      try { if ((await fetch(base + '/api/health')).ok) return; } catch {}
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw Error('Fixture startup timeout: ' + logs);
  }
  async function stop() {
    if (child?.exitCode === null) { const exit = once(child, 'exit'); child.kill('SIGTERM'); await exit; }
  }
  async function request(route, method = 'GET', body, cookie = null, headers = {}) {
    const response = await fetch(base + route, {method, redirect:'manual',
      headers:{...(cookie === null ? {authorization:`Bearer ${token}`} : {cookie}), origin,
        'content-type':'application/json', ...headers},
      ...(body === undefined ? {} : {body:JSON.stringify(body)}), signal:AbortSignal.timeout(15000)});
    const text = await response.text(); let data;
    try { data = JSON.parse(text); } catch { data = text; }
    return {status:response.status, body:data, headers:response.headers};
  }
  async function enroll(username, roles = ['MANAGER']) {
    const invited = await request('/api/identity/users', 'POST', {username, display_name:username, roles,
      confirm:true, reason:'Isolated Run 2 acceptance fixture'});
    assert.equal(invited.status, 201, JSON.stringify(invited.body));
    const password = 'Zero fixture ' + crypto.randomBytes(20).toString('hex');
    const enrolled = await request('/api/identity/enroll', 'POST', {invite_token:invited.body.invite_token, password}, '');
    assert.equal(enrolled.status, 201, JSON.stringify(enrolled.body));
    const account = {member:enrolled.body.member, password};
    account.cookie = await login(account);
    return account;
  }
  async function login(account) {
    const response = await request('/api/identity/login', 'POST', {username:account.member.username, password:account.password}, '');
    assert.equal(response.status, 200, JSON.stringify(response.body));
    return response.headers.get('set-cookie').split(';')[0];
  }
  await start();
  return {base, dir, env, request, enroll, login, start, stop,
    async close() { await stop(); fs.rmSync(dir, {recursive:true, force:true}); }};
}
module.exports = {fixture};
