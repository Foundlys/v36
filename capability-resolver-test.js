'use strict';
const assert = require('node:assert/strict');
const { CapabilityResolver, resolve } = require('./capability-resolver');
const { MODULES, BUNDLES, INDUSTRIES, routeModule } = require('./module-catalog');
const ctx = { tenant_id: 'fixture-a', dealer_id: 'default' };
const other = { tenant_id: 'fixture-b', dealer_id: 'default' };
const admin = { id: 'owner', roles: ['SUPER_ADMIN'] };
const viewer = { id: 'reader', roles: ['VIEWER'] };
let database = new Map(), persisted, audits = [];
const adapter = {
  bucket(c, name) { const key = JSON.stringify([c.tenant_id, c.dealer_id, name]); if (!database.has(key)) database.set(key, []); return database.get(key); },
  persist() { persisted = JSON.stringify([...database]); },
  audit(...args) { audits.push(args); }
};
const core = new CapabilityResolver(adapter);
assert.equal(Object.keys(MODULES).length, 9);
assert.equal(core.resolve(ctx, admin).legacy_compatibility, true);
assert.equal(core.resolve(ctx, admin).enabled_modules.length, 9);
for (const id of Object.keys(MODULES)) {
  const revision = core.profile(ctx)?.revision || 0;
  const input = { entitlements: [id], enabled_modules: [id], industry_id: 'GENERAL', expected_revision: revision };
  const result = core.configure(ctx, admin, input);
  assert.equal(result.created, true);
  assert.deepEqual(core.resolve(ctx, admin).enabled_modules, [id]);
  assert.deepEqual(core.resolve(ctx, viewer).routes, [`/${id}`]);
  assert.equal(core.configure(ctx, admin, input).created, false);
  for (const disabled of Object.keys(MODULES).filter(x => x !== id)) {
    assert.throws(() => core.assertModule(ctx, admin, disabled), { code: 'module_disabled' });
    core.assertModule(ctx, admin, disabled, 'export');
  }
  assert.throws(() => core.assertModule(ctx, viewer, id, 'write'), { code: 'composition_forbidden' });
  assert.equal(core.resolve(other, admin).legacy_compatibility, true);
  database = new Map(JSON.parse(persisted));
  assert.deepEqual(new CapabilityResolver(adapter).resolve(ctx, admin).enabled_modules, [id]);
}
for (const ids of [['crm', 'analysis'], ['crm', 'automation'], ['crm', 'finance'], ['crm', 'communication', 'calendar'], ['sales', 'crm'], ['marketing', 'crm', 'analysis'], ['procurement', 'analysis'], ['procurement', 'crm', 'analysis'], ['finance'], ['automation', 'communication'], BUNDLES.COMPLETE]) {
  core.configure(ctx, admin, { entitlements: ids, industry_id: 'AUTOMOTIVE', expected_revision: core.profile(ctx).revision });
  assert.deepEqual(core.resolve(ctx, admin).enabled_modules, [...ids].sort());
}
const before = persisted;
assert.throws(() => core.configure(ctx, viewer, { bundle: 'COMPLETE' }), { code: 'composition_forbidden' });
assert.throws(() => core.configure(ctx, { id: 'tenant-admin', roles: ['ADMIN'] }, { bundle: 'COMPLETE' }), { code: 'composition_forbidden' });
assert.throws(() => core.configure(ctx, admin, { bundle: 'COMPLETE', tenant_id: other.tenant_id }), { code: 'composition_tenant_mismatch' });
assert.throws(() => core.configure(ctx, admin, { entitlements: ['crm'], enabled_modules: ['finance'] }), { code: 'module_not_entitled' });
assert.throws(() => core.configure(ctx, admin, { entitlements: ['unknown'] }), { code: 'module_unknown' });
assert.throws(() => core.configure(ctx, admin, { entitlements: ['crm'], expected_revision: -1 }), { code: 'composition_revision_conflict' });
assert.equal(persisted, before);
const revision = core.profile(ctx).revision;
adapter.bucket(ctx, 'fixture:crm-business-data').push({ id: 'retained-record' });
core.configure(ctx, admin, { entitlements: ['crm'], enabled_modules: [], expected_revision: revision });
assert.equal(adapter.bucket(ctx, 'fixture:crm-business-data').length, 1);
core.configure(ctx, admin, { entitlements: ['crm'], enabled_modules: ['crm'], expected_revision: revision + 1 });
assert.equal(adapter.bucket(ctx, 'fixture:crm-business-data')[0].id, 'retained-record');
assert.throws(() => core.assertTool(ctx, admin, 'finance_report'), { code: 'module_disabled' });
assert.throws(() => resolve(other, admin, core.profile(ctx)), { code: 'composition_tenant_mismatch' });
assert.equal(routeModule('/api/workspaces/finance/snapshot'), 'finance');
assert.equal(routeModule('/api/module/inkoop/query'), 'procurement');
// Explicitly test-only: never registered in the production industry catalog.
const industries = { ...INDUSTRIES, REAL_ESTATE_DEMO: { industry_id: 'REAL_ESTATE_DEMO', production: false, extensions: { crm: { objects: ['property_customer_relationship'] }, procurement: { objects: ['property_opportunity'] }, analysis: { kpis: ['property_yield'] } } } };
const profile = { ...core.profile(ctx), industry_id: 'REAL_ESTATE_DEMO', entitlements: ['crm', 'procurement', 'analysis'], enabled_modules: ['crm', 'procurement', 'analysis'] };
assert.throws(() => resolve(ctx, admin, profile, { industries }), { code: 'industry_unavailable' });
const second = resolve(ctx, admin, profile, { industries, allowTestIndustries: true });
assert.equal(Object.keys(second.industry_extensions).length, 3);
assert.equal(second.tools.some(t => t.startsWith('automotive_')), false);
assert.ok(audits.length > 20);
console.log('PASS composition contract: nine isolated profiles, combinations, authorization, concurrency, restart, retention and test-only industry');
