'use strict';
const PUBLIC_CACHE = 'foundly-public-install-v1';
const OFFLINE = '/foundly-offline.html';
const PUBLIC_FILES = [OFFLINE, '/identity-login.css', '/foundly-locales.js', '/foundly-static-copy.js', '/foundly-i18n.js', '/foundly-app-192.png', '/foundly-app-512.png', '/foundly-app-180.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(PUBLIC_CACHE).then(cache => cache.addAll(PUBLIC_FILES)));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) if (name.startsWith('foundly-public-install-') && name !== PUBLIC_CACHE) await caches.delete(name);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  // All API reads, writes, downloads and customer pages stay network-only.
  // No background replay, synthetic success or cached signed-in session data.
  if (request.mode === 'navigate' && !url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request).catch(async () => {
      const cached = await (await caches.open(PUBLIC_CACHE)).match(OFFLINE);
      return cached ? new Response(await cached.text(), { status: 503, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'" } }) : Response.error();
    }));
  } else if (PUBLIC_FILES.includes(url.pathname) && !url.search) {
    event.respondWith(fetch(request).catch(async () => (await (await caches.open(PUBLIC_CACHE)).match(url.pathname)) || Response.error()));
  }
});
