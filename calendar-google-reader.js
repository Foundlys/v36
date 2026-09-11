'use strict';
// The existing Google token source is reused; this reader only requests Calendar event pages.
function createReader({access, fetcher = (...args) => fetch(...args)}) {
  return async (ctx, actor, url, check) => {
    const target = new URL(url);
    if (target.origin !== 'https://www.googleapis.com' || !/^\/calendar\/v3\/calendars\/[^/]+\/events$/.test(target.pathname)) throw Error('Invalid Calendar endpoint');
    check();
    const token = await access(ctx, check);
    check();
    const response = await fetcher(url, {method: 'GET', headers: {authorization: `Bearer ${token}`}, redirect: 'error', signal: AbortSignal.timeout(20000)});
    check();
    if (!response.ok) { await response.body?.cancel(); throw Object.assign(Error('Google Calendar is niet volledig leesbaar'), {code: 'calendar_external_provider_failed', statusCode: 502}); }
    const reader = response.body.getReader(); let bytes = 0; const chunks = [];
    try {
      while (true) {
        const {value, done} = await reader.read(); check();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 4 * 1024 * 1024) throw Object.assign(Error('Externe agendapagina is te groot'), {code: 'calendar_external_page_capacity', statusCode: 507});
        chunks.push(Buffer.from(value));
      }
      return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  };
}
module.exports = {createReader};
