'use strict';
const crypto = require('node:crypto');
const time = require('./calendar-time');
const language = require('./calendar-language');
const {scopedMutation} = require('./scoped-mutation');
const SCOPE = 'calendar:external_observations';
const HISTORY = 'calendar:external_history';
const ATTEMPTS = 'calendar:external_attempts';
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
  if (value.dateTime) { if(typeof value.dateTime!=='string')fail('calendar_external_event_invalid','Ongeldige externe tijd'); if(/(?:Z|[+-]\d{2}:\d{2})$/.test(value.dateTime))return iso(time.timestamp(value.dateTime)); return language.localInstant(value.dateTime,time.timezone(value.timeZone||zone)); }
  if (typeof value.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.date)) fail('calendar_external_event_invalid', 'Een externe afspraak heeft geen geldige datum');
  return language.localInstant(value.date + 'T00:00', zone);
}
function normalize(row, zone, bounds) {
  if (!row || !validId(row.id) || !['confirmed', 'tentative', 'cancelled'].includes(row.status)) fail('calendar_external_event_invalid', 'Onvolledige externe afspraak');
  if (row.status === 'cancelled') return null;
  if(row.endTimeUnspecified!==undefined&&typeof row.endTimeUnspecified!=='boolean')fail('calendar_external_event_invalid','Ongeldige externe eindtijdstatus');
  if (row.endTimeUnspecified === true) fail('calendar_external_end_unverified', 'De externe eindtijd is niet vastgesteld');
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
    if(input.account_binding!==account)fail('calendar_external_account_changed','Controleer het actuele gekozen Google-account',409);
    return {calendar, previous, account};
  }
  exportOwned(ctx,actor,calendars){const allowed=new Map(calendars.map(c=>[c.id,c.owner_id]));return [...this.core.adapter.bucket(ctx,HISTORY),...this.rows(ctx)].filter(r=>allowed.has(r.calendar_id)&&allowed.get(r.calendar_id)===r.owner_id).map(({account_binding,attempt_id,...row})=>({...JSON.parse(JSON.stringify(row)),classification:'RETAINED_PROVIDER_OCCUPANCY_NOT_LIVE'}));}
  status(ctx, actor, calendarId) {
    this.authorize(ctx, actor);
    const calendar = this.core.get(ctx, actor, 'calendars', calendarId);
    let can_reconcile=false;try{this.authorize(ctx,actor,true);can_reconcile=true;}catch(e){if(![401,403].includes(e.statusCode))throw e;}
    const row = this.rows(ctx).find(item => item.calendar_id === calendar.id);
    if (row&&row.owner_id!==calendar.owner_id)return {can_reconcile,calendar_id:calendar.id,revision:row.revision,account_binding:this.accountBinding(ctx),coverage:'UNAVAILABLE',busy_count:null,live_provider_acceptance:'UNVERIFIED'};
    if (!row) return {can_reconcile,calendar_id: calendar.id, revision: 0, account_binding:this.accountBinding(ctx), coverage: 'NOT_CONFIGURED', live_provider_acceptance: 'UNVERIFIED'};
    let current = true;
    try { this.busy(ctx, calendar.id, [{start_at: row.from, end_at: row.to}]); } catch { current = false; }
    return {can_reconcile,calendar_id: calendar.id, revision: row.revision, account_binding:this.accountBinding(ctx), last_attempt_status:row.status, last_error:row.last_error||null, provider: 'google_calendar', provider_calendar_id: row.provider_calendar_id,
      from: row.from, to: row.to, observed_at: row.observed_at, coverage:row.status==='DISABLED_BY_USER'?'DISABLED_BY_USER':current?'RETAINED_COMPLETE_WINDOW':'UNAVAILABLE',
      busy_count:row.status==='DISABLED_BY_USER'?null:current?row.busy.length:null, provider_write: false, live_provider_acceptance: 'UNVERIFIED'};
  }
  disable(ctx,actor,input,options={}) {
    if(!language.keys(input,['calendar_id','expected_calendar_revision','expected_revision','confirm','reason'])||input.confirm!==true||typeof input.reason!=='string'||!input.reason.trim()||input.reason.length>500||typeof options.idempotency_key!=='string'||!options.idempotency_key.trim()||options.idempotency_key.length>200)fail('calendar_external_confirmation_required','Bevestig het uitschakelen van deze interne agendadekking');
    this.authorize(ctx,actor,true);const calendar=this.core.get(ctx,actor,'calendars',input.calendar_id),attempts=this.core.adapter.bucket(ctx,ATTEMPTS),fingerprint=hash({operation:'DISABLE',input}),prior=attempts.find(r=>r.actor_id===actor.id&&r.key===options.idempotency_key);
    if(prior){if(prior.fingerprint!==fingerprint)fail('calendar_external_request_conflict','Deze actie-ID hoort bij andere invoer',409);return {...this.status(ctx,actor,calendar.id),deduplicated:true};}
    const row=this.rows(ctx).find(r=>r.calendar_id===calendar.id);if(!row||row.revision!==input.expected_revision||calendar.revision!==input.expected_calendar_revision)fail('calendar_external_revision_changed','De agenda is gewijzigd',409);
    scopedMutation(this.core.adapter,ctx,[SCOPE,HISTORY,ATTEMPTS,'platform:audit'],()=>{if(attempts.length>=100000||Buffer.byteLength(JSON.stringify(this.core.adapter.bucket(ctx,HISTORY)))>32*1024*1024)fail('calendar_external_capacity','De bewaarlimiet is bereikt',507);this.core.adapter.bucket(ctx,HISTORY).push(JSON.parse(JSON.stringify(row)));row.status='DISABLED_BY_USER';row.revision++;row.disabled_at=iso(this.now());attempts.push({key:options.idempotency_key,actor_id:actor.id,calendar_id:calendar.id,fingerprint,status:'COMPLETE'});this.core.adapter.audit(ctx,actor,'DISABLE_EXTERNAL_COVERAGE','calendar',calendar.id,{revision:row.revision,reason:input.reason,provider_write:false});});return this.status(ctx,actor,calendar.id);
  }
  busy(ctx, calendarId, ranges) {
    const row = this.rows(ctx).find(item => item.calendar_id === calendarId);
    if (!row) return {items: [], revision: null, coverage: 'NOT_CONFIGURED'};
    if(row.status==='DISABLED_BY_USER')return {items:[],revision:row.revision,coverage:'DISABLED_BY_USER'};
    const cal = this.core.bucket(ctx, 'calendars').find(item => item.id === calendarId);
    const age = this.now() - Date.parse(row.observed_at);
    if (row.status!=='COMPLETE' || !cal || cal.revision !== row.calendar_revision || cal.owner_id !== row.owner_id || ['ARCHIVED', 'CANCELLED'].includes(cal.status) ||
      this.accountBinding(ctx) !== row.account_binding || !Number.isFinite(age) || age < 0 || age > MAX_AGE ||
      !Array.isArray(row.busy) || hash(row.busy) !== row.content_hash ||
      ranges.some(range => time.timestamp(range.start_at) < time.timestamp(row.from) || time.timestamp(range.end_at) > time.timestamp(row.to)))
      fail('calendar_external_coverage_unavailable', 'Ververs eerst de externe agendadekking voor dit volledige tijdvenster', 409);
    return {items: row.busy, revision: row.revision, coverage: 'RETAINED_COMPLETE_WINDOW', observed_at: row.observed_at};
  }
  async reconcile(ctx, actor, input, options={}) {
    if (!language.keys(input, ['calendar_id', 'expected_calendar_revision', 'expected_revision', 'provider_calendar_id', 'from', 'to', 'confirm', 'reason', 'account_binding']) ||
      typeof options.idempotency_key!=='string'||!options.idempotency_key.trim()||options.idempotency_key.length>200||typeof input.account_binding!=='string'||
      input.confirm !== true || typeof input.reason !== 'string' || !input.reason.trim() || input.reason.length > 500 ||
      !validId(input.provider_calendar_id) || !Number.isSafeInteger(input.expected_revision) || input.expected_revision < 0 ||
      !Number.isSafeInteger(input.expected_calendar_revision) || input.expected_calendar_revision < 1)
      fail('calendar_external_confirmation_required', 'Bevestig de gekozen agenda en het exacte tijdvenster');
    this.authorize(ctx,actor,true);
    const bounds=window(input),fingerprint=hash(input),attempts=this.core.adapter.bucket(ctx,ATTEMPTS),prior=attempts.find(r=>r.actor_id===actor.id&&r.key===options.idempotency_key);
    if(prior){if(prior.fingerprint!==fingerprint)fail('calendar_external_request_conflict','Deze actie-ID hoort bij andere invoer',409);const result=this.status(ctx,actor,input.calendar_id);if(result.account_binding!==input.account_binding)fail('calendar_external_account_changed','Het Google-account is gewijzigd',409);return {...result,deduplicated:true,attempt_status:prior.status};}
    const original=this.selection(ctx,actor,input),actorId=actor.id;
    if(typeof this.read!=='function')fail('calendar_external_provider_unavailable','De agendaprovider is niet beschikbaar',503);
    if(attempts.length>=100000)fail('calendar_external_capacity','De bewaarlimiet voor leesacties is bereikt',507);
    const attemptId=crypto.randomUUID(),pendingRevision=(original.previous?.revision||0)+1;
    scopedMutation(this.core.adapter,ctx,[SCOPE,HISTORY,ATTEMPTS],()=>{
      if(Buffer.byteLength(JSON.stringify(this.core.adapter.bucket(ctx,HISTORY)))>32*1024*1024)fail('calendar_external_capacity','De bewaarlimiet voor eerdere waarnemingen is bereikt',507);
      if(original.previous)this.core.adapter.bucket(ctx,HISTORY).push(JSON.parse(JSON.stringify(original.previous)));
      const pending={...original.previous,calendar_id:original.calendar.id,calendar_revision:original.calendar.revision,owner_id:original.calendar.owner_id,account_binding:original.account,provider_calendar_id:input.provider_calendar_id,...bounds,revision:pendingRevision,status:'READING',attempt_id:attemptId,observed_at:null,busy:[]};
      const rows=this.rows(ctx);if(original.previous)rows[rows.indexOf(original.previous)]=pending;else {if(rows.length>=1000)fail('calendar_external_capacity','De limiet voor gekoppelde agenda’s is bereikt',507);rows.push(pending);}
      attempts.push({id:attemptId,key:options.idempotency_key,actor_id:actorId,calendar_id:input.calendar_id,fingerprint,status:'READING'});
    });
    const check=()=>{if(actor.id!==actorId)fail('calendar_actor_changed','De gebruiker is gewijzigd',403);const current=this.selection(ctx,actor,{...input,expected_revision:pendingRevision});if(current.previous?.attempt_id!==attemptId||current.account!==original.account)fail('calendar_external_account_changed','De agendawaarneming of het account is gewijzigd',409);return current;};
    try {
    const base = 'https://www.googleapis.com/calendar/v3/calendars/' + encodeURIComponent(input.provider_calendar_id) + '/events';
    const seen = new Set(), ids = new Set(), busy = [];
    let pageToken, zone, pages = 0, records = 0, bytes = 0;
    do {
      check();
      const url = new URL(base);
      for (const [key, value] of Object.entries({singleEvents: 'true', showDeleted: 'true', timeMin: bounds.from, timeMax: bounds.to, maxResults: '2500', ...(pageToken ? {pageToken} : {})})) url.searchParams.set(key, value);
      const page = await this.read(ctx, actor, url.toString(), check);
      check();
      if (!page || page.kind !== 'calendar#events' || !Array.isArray(page.items) || !['reader', 'writer', 'writerWithoutPrivateAccess', 'owner'].includes(page.accessRole)) fail('calendar_external_page_invalid', 'De externe agenda is niet volledig leesbaar');
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
    scopedMutation(this.core.adapter, ctx, [SCOPE, ATTEMPTS, 'platform:audit'], () => {
      const {calendar, previous, account} = check();
      const rows = this.rows(ctx);

      const observation = {calendar_id: calendar.id, calendar_revision: calendar.revision, owner_id: calendar.owner_id, account_binding: account,
        provider_calendar_id: input.provider_calendar_id, ...bounds, observed_at: iso(this.now()), revision: pendingRevision, status:'COMPLETE',attempt_id:attemptId,
        busy, content_hash: hash(busy), page_count: pages, source_count: records, provider_timezone: zone};
      const priorComplete=[...this.core.adapter.bucket(ctx,HISTORY)].reverse().find(r=>r.calendar_id===calendar.id&&r.account_binding===account&&r.provider_calendar_id===input.provider_calendar_id&&r.status==='COMPLETE'&&r.from===bounds.from&&r.to===bounds.to);
      observation.not_returned_source_hashes=(priorComplete?.busy||[]).filter(r=>!busy.some(b=>b.source_hash===r.source_hash)).map(r=>r.source_hash);observation.missing_semantics='NOT_RETURNED_IN_RESPONSE_WINDOW_NOT_DELETED';
      rows[rows.indexOf(previous)] = observation;
      attempts.find(r=>r.id===attemptId).status='COMPLETE';
      this.core.adapter.audit(ctx, actor, 'RECONCILE', 'calendar', calendar.id, {revision: observation.revision, provider_write: false});
    });
    return this.status(ctx, actor, input.calendar_id);
    } catch(error) {
      // Retain only operational failure metadata, even if requester rights disappeared.
      // A later attempt may supersede this one; never overwrite its current projection.
      scopedMutation(this.core.adapter,ctx,[SCOPE,ATTEMPTS],()=>{const attempt=attempts.find(r=>r.id===attemptId);attempt.status='FAILED';attempt.code=String(error.code||'calendar_external_read_failed').slice(0,100);const current=this.rows(ctx).find(r=>r.calendar_id===input.calendar_id);if(current?.attempt_id===attemptId){current.status='FAILED';current.last_error=attempt.code;}});
      throw error;
    }
  }
}
module.exports = {CalendarExternal, SCOPE, HISTORY, ATTEMPTS, MAX_AGE, window, normalize};
