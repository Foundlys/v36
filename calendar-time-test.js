'use strict';
const assert=require('node:assert/strict');
const {timestamp}=require('./calendar-time'),{occurrences}=require('./business-domains');
for(const value of ['2026-02-30T10:00:00Z','2026-02-29T10:00:00+01:00','2026-04-31T10:00:00Z','2026-01-01T24:00:00Z','2026-01-01T10:60:00Z','2026-01-01T10:00:60Z','2026-01-01T10:00:00.1234Z','2026-01-01T10:00:00+25:00'])assert.throws(()=>timestamp(value),{code:'date_invalid'},value);
for(const value of [null,[],{},'2026-01-01T10:00:00','2026-01-01'])assert.throws(()=>timestamp(value),{code:'date_offset_required'});
assert.equal(timestamp('2028-02-29T10:00:00.123+05:45'),Date.parse('2028-02-29T04:15:00.123Z'));
const repeat=(start_at,end_at,timezone,recurrence={frequency:'DAILY',count:2})=>occurrences({start_at,end_at,timezone,recurrence});
assert.throws(()=>repeat('2026-04-04T01:45:00+11:00','2026-04-04T02:00:00+11:00','Australia/Lord_Howe'),{code:'recurrence_dst_ambiguous'});
assert.throws(()=>repeat('2026-10-03T02:15:00+10:30','2026-10-03T02:45:00+10:30','Australia/Lord_Howe'),{code:'recurrence_dst_gap'});
assert.throws(()=>repeat('2026-10-24T02:30:00+02:00','2026-10-24T03:00:00+02:00','Europe/Amsterdam'),{code:'recurrence_dst_ambiguous'});
assert.throws(()=>repeat('2011-12-29T10:00:00-10:00','2011-12-29T11:00:00-10:00','Pacific/Apia'),{code:'recurrence_dst_gap'});
const southern=repeat('2026-04-04T10:00:00.123+11:00','2026-04-04T11:00:00.123+11:00','Australia/Lord_Howe');assert.equal(southern[1].start_at,'2026-04-04T23:30:00.123Z');assert.equal(Date.parse(southern[1].end_at)-Date.parse(southern[1].start_at),3600000);
const fractional=repeat('2026-06-01T10:00:00.123Z','2026-06-01T11:00:00.123Z','UTC');assert.equal(fractional[1].start_at,'2026-06-02T10:00:00.123Z');
const weekly=repeat('2026-10-18T10:00:00+02:00','2026-10-18T11:00:00+02:00','Europe/Amsterdam',{frequency:'WEEKLY',count:2,interval:2});assert.equal(weekly[1].start_at,'2026-11-01T09:00:00.000Z');
// An explicitly offset one-off time is valid even during a repeated local hour.
for(const offset of ['+11:00','+10:30'])assert.equal(repeat('2026-04-05T01:35:00'+offset,'2026-04-05T01:45:00'+offset,'Australia/Lord_Howe',null).length,1);
assert.throws(()=>repeat('2026-01-01T10:00:00Z','2026-01-01T09:00:00Z','UTC',null),{code:'date_order_invalid'});
console.log('PASS strict civil timestamps, leap dates, half-hour/full-hour ambiguity and gaps, skipped civil day, exact milliseconds, weekly intervals and elapsed duration; explicit one-off offsets remain valid');
