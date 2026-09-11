'use strict';
const crypto = require('node:crypto');
const time = require('./calendar-time');
const language = require('./calendar-language');
const {scopedMutation} = require('./scoped-mutation');
const SCOPE = 'calendar:external_observations';
const MAX_AGE = 15 * 60 * 1000;
const fail = (code, message, statusCode = 422) => { throw Object.assign(Error(message), {code, statusCode}); };
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const validId = value => typeof value === 'string' && value.length > 0 && value.length <= 512 && !/[\x00-\x20]/.test(value);
const iso = value => new Date(value).toISOString();

function window(input) {
  const from = time.timestamp(input.from), to = time.timestamp(input.to);
  if (to <= from || to - from > 31 * 86400000 || from % 1000 || to % 1000)
    fail('calendar_external_window_invalid', 'Kies een tijdvenster van maximaal 31 dagen, op hele seconden');
  return {from: iso(from), to: iso(to)};
}
function instant(value, zone) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('calendar_external_event_invalid', 'Een externe afspraak heeft geen geldige tijd');
  if (value.date && value.dateTime) fail('calendar_external_event_invalid', 'Tegenstrijdige externe datumvelden');
  if (value.dateTime) return iso(time.timestamp(value.dateTime));
  if (typeof value.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.date)) fail('calendar_external_event_invalid', 'Een externe afspraak heeft geen geldige datum');
  return language.localInstant(value.date + 'T00:00', zone);
}
function normalize(row, zone, bounds) {
  if (!row || !validId(row.id) || !['confirmed', 'tentative', 'cancelled'].includes(row.status)) fail('calendar_external_event_invalid', 'Onvolledige externe afspraak');
  if (row.status === 'cancelled') return null;
  if (row.recurrence !== undefined) fail('calendar_external_recurrence_unexpanded', 'Herhalingen zijn niet volledig uitgewerkt');
  if (row.transparency !== undefined && !['opaque', 'transparent'].includes(row.transparency)) fail('calendar_external_event_invalid', 'Onbekende externe beschikbaarheid');
  const start_at = instant(row.start, zone), end_at = instant(row.end, zone);
  if (Boolean(row.start.date) !== Boolean(row.end.date) || time.timestamp(end_at) <= time.timestamp(start_at)) fail('calendar_external_event_invalid', 'Ongeldige externe afspraakduur');
  if (row.transparency === 'transparent') return null;
  if (time.timestamp(start_at) >= time.timestamp(bounds.to) || time.timestamp(end_at) <= time.timestamp(bounds.from)) return null;
  // Only occupancy is retained. Titles, locations, attendees and provider IDs are not copied.
  return {source_hash: hash(row.id), start_at, end_at};
}

class CalendarExternal {
  constructor(core, {accountBinding = () => null, read, now = () => Date.now()} = {}) {
    this.core = core; this.accountBinding = accountBinding; this.read = read; this.now = now;
  }
  rows(ctx) { return this.core.adapter.bucket(ctx, SCOPE); }
  authorize(ctx, actor, writing = false) {
    this.core.scope(ctx, actor, writing ? 'write' : 'read');
    this.core.resolver.assertCapability(ctx, actor, 'calendar:availability', writing ? 'write' : 'read');
    if (writing) require('./core-access-contracts').assertCorePermission(actor, 'connectors:manage');
  }
  selection(ctx, actor, input) {
    this.authorize(ctx, actor, true);
    const calendar = this.core.get(ctx, actor, 'calendars', input.calendar_id);
    if (calendar.revision !== input.expected_calendar_revision || ['ARCHIVED', 'CANCELLED'].includes(calendar.status)) fail('calendar_selection_changed', 'De gekozen agenda is gewijzigd', 409);
    const previous = this.rows(ctx).find(row => row.calendar_id === calendar.id);
    if ((previous?.revision || 0) !== input.expected_revision) fail('calendar_external_revision_changed', 'De externe agendawaarneming is gewijzigd', 409);
    const account = this.accountBinding(ctx);
    if (!account) fail('calendar_external_account_unavailable', 'Het Google-account is niet beschikbaar', 503);
    return {calendar, previous, account};
  }
  status(ctx, actor, calendarId) {
    this.authorize(ctx, actor);
    const calendar = this.core.get(ctx, actor, 'calendars', calendarId);
    const row = this.rows(ctx).find(item => item.calendar_id === calendar.id);
    if (!row) return {calendar_id: calendar.id, revision: 0, coverage: 'NOT_CONFIGURED', live_provider_acceptance: 'UNVERIFIED'};
    let current = true;
    try { this.busy(ctx, calendar.id, [{start_at: row.from, end_at: row.to}]); } catch { current = false; }
    return {calendar_id: calendar.id, revision: row.revision, provider: 'google_calendar', provider_calendar_id: row.provider_calendar_id,
      from: row.from, to: row.to, observed_at: row.observed_at, coverage: current ? 'RETAINED_COMPLETE_WINDOW' : 'UNAVAILABLE',
      busy_count: current ? row.busy.length : null, provider_write: false, live_provider_acceptance: 'UNVERIFIED'};
  }
  busy(ctx, calendarId, ranges) {
    const row = this.rows(ctx).find(item => item.calendar_id === calendarId);
    if (!row) return {items: [], revision: null, coverage: 'NOT_CONFIGURED'};
    const cal = this.core.bucket(ctx, 'calendars').find(item => item.id === calendarId);
    const age = this.now() - Date.parse(row.observed_at);
    if (!cal || cal.revision !== row.calendar_revision || cal.owner_id !== row.owner_id || ['ARCHIVED', 'CANCELLED'].includes(cal.status) ||
      this.accountBinding(ctx) !== row.account_binding || !Number.isFinite(age) || age < 0 || age > MAX_AGE ||
      !Array.isArray(row.busy) || hash(row.busy) !== row.content_hash ||
      ranges.some(range => time.timestamp(range.start_at) < time.timestamp(row.from) || time.timestamp(range.end_at) > time.timestamp(row.to)))
      fail('calendar_external_coverage_unavailable', 'Ververs eerst de externe agendadekking voor dit volledige tijdvenster', 409);
    return {items: row.busy, revision: row.revision, coverage: 'RETAINED_COMPLETE_WINDOW', observed_at: row.observed_at};
  }
  async reconcile(ctx, actor, input) {
    if (!language.keys(input, ['calendar_id', 'expected_calendar_revision', 'expected_revision', 'provider_calendar_id', 'from', 'to', 'confirm', 'reason']) ||
      input.confirm !== true || typeof input.reason !== 'string' || !input.reason.trim() || input.reason.length > 500 ||
      !validId(input.provider_calendar_id) || !Number.isSafeInteger(input.expected_revision) || input.expected_revision < 0 ||
      !Number.isSafeInteger(input.expected_calendar_revision) || input.expected_calendar_revision < 1)
      fail('calendar_external_confirmation_required', 'Bevestig de gekozen agenda en het exacte tijdvenster');
    const bounds = window(input), original = this.selection(ctx, actor, input), actorId = actor.id;
    const check = () => {
      if (actor.id !== actorId) fail('calendar_actor_changed', 'De gebruiker is gewijzigd', 403);
      const current = this.selection(ctx, actor, input);
      if (current.account !== original.account) fail('calendar_external_account_changed', 'Het Google-account is gewijzigd', 409);
      return current;
    };
    if (typeof this.read !== 'function') fail('calendar_external_provider_unavailable', 'De agendaprovider is niet beschikbaar', 503);
    const base = 'https://www.googleapis.com/calendar/v3/calendars/' + encodeURIComponent(input.provider_calendar_id) + '/events';
    const seen = new Set(), ids = new Set(), busy = [];
    let pageToken, zone, pages = 0, records = 0, bytes = 0;
    do {
      check();
      const url = new URL(base);
      for (const [key, value] of Object.entries({singleEvents: 'true', showDeleted: 'true', timeMin: bounds.from, timeMax: bounds.to, maxResults: '2500', ...(pageToken ? {pageToken} : {})})) url.searchParams.set(key, value);
      const page = await this.read(ctx, actor, url.toString(), check);
      check();
      if (!page || page.kind !== 'calendar#events' || !Array.isArray(page.items) || !['reader', 'writer', 'writerWithoutPrivateAccess', 'owner', 'freeBusyReader'].includes(page.accessRole)) fail('calendar_external_page_invalid', 'De externe agenda is niet volledig leesbaar');
      time.timezone(page.timeZone);
      if (zone && zone !== page.timeZone) fail('calendar_external_page_changed', 'De externe tijdzone veranderde tijdens het lezen', 409);
      zone = page.timeZone;
      records += page.items.length; bytes += Buffer.byteLength(JSON.stringify(page)); pages++;
      if (records > 10000 || bytes > 8 * 1024 * 1024 || pages > 20) fail('calendar_external_capacity', 'Het volledige agendavenster overschrijdt de leeslimiet', 507);
      for (const item of page.items) {
        if (ids.has(item?.id)) fail('calendar_external_duplicate', 'Dubbele externe afspraak tijdens het lezen; probeer opnieuw', 409);
        ids.add(item?.id);
        const normalized = normalize(item, zone, bounds); if (normalized) busy.push(normalized);
      }
      pageToken = page.nextPageToken;
      if (pageToken !== undefined && !validId(pageToken)) fail('calendar_external_page_invalid', 'Ongeldige externe paginering');
      if (pageToken && (seen.has(pageToken) || pages >= 20)) fail('calendar_external_pagination_incomplete', 'De externe paginering is niet volledig', 409);
      if (pageToken) seen.add(pageToken);
    } while (pageToken);
    check();
    busy.sort((a, b) => a.start_at.localeCompare(b.start_at) || a.source_hash.localeCompare(b.source_hash));
    scopedMutation(this.core.adapter, ctx, [SCOPE, 'platform:audit'], () => {
      const {calendar, previous, account} = check();
      const rows = this.rows(ctx);
      if (!previous && rows.length >= 1000) fail('calendar_external_capacity', 'De limiet voor gekoppelde agenda’s is bereikt', 507);
      const observation = {calendar_id: calendar.id, calendar_revision: calendar.revision, owner_id: calendar.owner_id, account_binding: account,
        provider_calendar_id: input.provider_calendar_id, ...bounds, observed_at: iso(this.now()), revision: (previous?.revision || 0) + 1,
        busy, content_hash: hash(busy), page_count: pages, source_count: records, provider_timezone: zone};
      if (previous) rows[rows.indexOf(previous)] = observation; else rows.push(observation);
      this.core.adapter.audit(ctx, actor, 'RECONCILE', 'calendar', calendar.id, {revision: observation.revision, provider_write: false});
    });
    return this.status(ctx, actor, input.calendar_id);
  }
}
module.exports = {CalendarExternal, SCOPE, MAX_AGE, window, normalize};
