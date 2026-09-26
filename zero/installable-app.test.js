'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { fixture } = require('../zero-evaluation/fixture');
const root = path.resolve(__dirname, '..');
test('installation markup is an explicit full-runtime option and preserves streamed UTF-8 and the approved style bytes', async () => {
  const {htmlLanguageStream}=require('../static-response');
  const source=Buffer.from('<!doctype html><html lang="nl"><head><title>€ · Café</title><style>.x { color: red; }</style></head><body>Behouden</body></html>');
  async function run(installable){const stream=htmlLanguageStream('fr-FR',installable),chunks=[];stream.on('data',c=>chunks.push(c));for(const byte of source)stream.write(Buffer.from([byte]));stream.end();await new Promise((resolve,reject)=>{stream.on('end',resolve);stream.on('error',reject);});return Buffer.concat(chunks).toString();}
  const independent=await run(false),full=await run(true);
  assert.ok(!independent.includes('foundly-install.js'));assert.match(full,/<head>[\s\S]*rel="manifest"/);assert.equal((full.match(/foundly-install\.js/g)||[]).length,1);
  for(const actual of [independent,full]){assert.ok(actual.includes('<title>€ · Café</title>'));assert.ok(actual.includes('<style>.x { color: red; }</style>'));assert.match(actual,/<html lang="fr-FR">/);}
});
function worker(fetcher) {
  const handlers = {}, stored = new Map(), names = new Set(['foundly-public-install-v0', 'another-app-cache']), deleted = [];
  const origin = 'https://demo.example.test', cache = { async addAll(paths) { for (const p of paths) stored.set(p, new Response(p === '/foundly-offline.html' ? '<main>Offline</main>' : 'public asset')); }, async match(p) { return stored.get(p)?.clone(); } };
  const caches = { async open(name) { names.add(name); return cache; }, async keys() { return [...names]; }, async delete(name) { deleted.push(name); return names.delete(name); } };
  const self = { location: { origin }, clients: { async claim() {} }, addEventListener(type, handler) { handlers[type] = handler; } };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'foundly-sw.js'), 'utf8'), { self, caches, fetch: fetcher, URL, Response });
  return { stored, deleted, async lifecycle(type) { let task; handlers[type]({ waitUntil(value) { task = value; } }); await task; },
    fetch(url, method = 'GET', mode = 'cors') { let result; handlers.fetch({ request: { url: new URL(url, origin).href, method, mode }, respondWith(p) { result = p; } }); return result; } };
}
test('installed app never caches API, tenant pages, downloads or mutations and reports offline navigation as unavailable', async () => {
  const w = worker(async () => { throw Error('network unavailable'); }); await w.lifecycle('install');
  for (const [url, method, mode] of [['/api/crm/people', 'GET', 'cors'], ['/api/zero/turn', 'POST', 'cors'], ['/api/finance/exports', 'GET', 'navigate'], ['/api/identity/login', 'POST', 'cors'], ['https://other.example.test/a', 'GET', 'navigate']]) assert.equal(w.fetch(url, method, mode), undefined);
  assert.ok([...w.stored.keys()].every(p => !p.startsWith('/api/') && !['/', '/crm', '/automotive', '/login'].includes(p)));
  const page = await w.fetch('/automotive', 'GET', 'navigate'); assert.equal(page.status, 503); assert.match(await page.text(), /Offline/);
  assert.equal((await w.fetch('/identity-login.css')).status, 200);
  await w.lifecycle('activate'); assert.deepEqual(w.deleted, ['foundly-public-install-v0']);
});
test('network authorization failures remain visible and no private response enters installation caches', async () => {
  const w = worker(async () => new Response('sign in again', { status: 401 })); await w.lifecycle('install');
  const keys = [...w.stored.keys()];
  const result = await w.fetch('/finance', 'GET', 'navigate'); assert.equal(result.status, 401); assert.equal(await result.text(), 'sign in again');
  assert.deepEqual([...w.stored.keys()], keys);
});
test('real HTTP exposes install metadata, icons and offline shell publicly while native demo data still requires authentication', async () => {
  const s = await fixture();
  try {
    const manifest = await s.request('/app.webmanifest', 'GET', undefined, ''); assert.equal(manifest.status, 200);
    assert.match(manifest.headers.get('content-type'), /application\/manifest\+json/); assert.equal(manifest.body.display, 'standalone'); assert.equal(manifest.body.scope, '/');
    assert.equal((await s.request(manifest.body.start_url, 'GET', undefined, '')).status, 200);
    for (const url of ['/foundly-sw.js', '/foundly-install.js', '/foundly-offline.html', '/foundly-app-180.png', '/foundly-app-192.png', '/foundly-app-512.png']) {
      const asset = await s.request(url, 'GET', undefined, ''); assert.equal(asset.status, 200, url); assert.match(asset.headers.get('content-security-policy'), /script-src 'self'/);
    }
    for (const url of ['/automotive', '/api/demo-universe/preview', '/api/automotive/reference']) assert.equal((await s.request(url, 'GET', undefined, '')).status, 401);
    const page = await s.request('/automotive'); assert.match(page.body, /rel="manifest"/); assert.match(page.body, /\/foundly-install.js/);
  } finally { await s.close(); }
});
