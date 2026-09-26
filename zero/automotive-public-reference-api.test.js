'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { fixture } = require('../zero-evaluation/fixture');

test('real HTTP reference pages use the retained public data and current identity/composition boundaries', async () => {
  const s = await fixture();
  try {
    const route = '/api/automotive/reference?make=BYD&kind=TECHNICAL_REPRESENTATIVE&limit=2';
    assert.equal((await s.request(route, 'GET', undefined, '')).status, 401);
    assert.equal((await s.request('/api/composition', 'PUT', { industry_id: 'AUTOMOTIVE', entitlements: ['procurement'], expected_revision: 0 })).status, 200);
    const viewer = await s.enroll('public.reference.reader', ['VIEWER']);
    const result = await s.request(route, 'GET', undefined, viewer.cookie);
    assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.equal(result.body.results.length, 2); assert.ok(result.body.total > 2); assert.equal(result.body.next_offset, 2);
    assert.equal(result.body.live_inventory_verified, false); assert.equal(result.body.source_scope, 'PUBLIC_REFERENCE_NOT_CUSTOMER_TRUTH');
    for (const row of result.body.results) { assert.equal(row.make, 'BYD'); assert.equal(row.provenance.customer_truth, false); assert.ok(row.provenance.url); }
    assert.equal((await s.request('/api/automotive/reference?limit=101', 'GET', undefined, viewer.cookie)).status, 400);
    const coverage = await s.request('/api/automotive/reference/coverage', 'GET', undefined, viewer.cookie);
    assert.equal(coverage.status, 200); assert.equal(coverage.body.coverage.records, 214175);
    assert.equal(coverage.body.coverage.coverage.PUBLIC_LISTING_OBSERVATION.live_api_connected, false);
    assert.equal((await s.request('/api/composition', 'PUT', { industry_id: 'AUTOMOTIVE', entitlements: ['procurement'], capability_flags: { 'procurement:sourcing': false }, expected_revision: 1 })).status, 200);
    for (const url of [route, '/api/automotive/reference/coverage']) {
      const denied = await s.request(url, 'GET', undefined, viewer.cookie); assert.equal(denied.status, 403); assert.equal(denied.body.code, 'capability_disabled');
    }
    assert.equal((await s.request('/api/composition', 'PUT', { industry_id: 'GENERAL', entitlements: ['procurement'], expected_revision: 2 })).status, 200);
    assert.equal((await s.request(route, 'GET', undefined, viewer.cookie)).body.code, 'industry_disabled');
  } finally { await s.close(); }
});
