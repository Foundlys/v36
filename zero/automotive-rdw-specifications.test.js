'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { FoundlyAutomotiveCore, normalizeRdwRecord } = require('../automotive-core');
const fetchedAt = '2026-09-26T18:30:00.000Z';
const base = { kenteken: 'TEST01', merk: 'BMW', handelsbenaming: '320', vermogen_massarijklaar: '0.09', cilinderinhoud: '1998' };
const petrol = { kenteken: 'TEST01', brandstof_volgnummer: '1', brandstof_omschrijving: 'Benzine', nettomaximumvermogen: '135', emissie_co2_gecombineerd_wltp: '142' };

test('RDW power-to-mass is never engine kW; separately joined combustion power retains its source', () => {
  assert.equal(normalizeRdwRecord(base, { fetchedAt }).vehicle.power_kw, null);
  const actual = normalizeRdwRecord(base, { fetchedAt, fuelRecords: [petrol] });
  assert.equal(actual.vehicle.power_kw, 135);
  assert.equal(actual.vehicle.fuel, 'PETROL');
  assert.equal(actual.vehicle.co2_g_km, 142);
  assert.equal(actual.provenance.field_sources['vehicle.power_kw'].dataset_id, '8ys7-d773');
  assert.equal(actual.provenance.field_sources['vehicle.power_kw'].field, 'nettomaximumvermogen');
  assert.equal(actual.raw_source_manifests.length, 2);
  assert.equal(normalizeRdwRecord(base, { fetchedAt, fuelRecords: [{ ...petrol, nettomaximumvermogen: '135.000' }] }).vehicle.power_kw, 135, 'RDW JSON decimal points are not thousands separators');
});

test('RDW hybrid combustion and continuous electric powers are retained separately and never added', () => {
  const actual = normalizeRdwRecord(base, { fetchedAt, fuelRecords: [
    { ...petrol, klasse_hybride_elektrisch_voertuig: 'OVC-HEV', emis_co2_gewogen_gecombineerd_wltp: '32' },
    { kenteken: 'TEST01', brandstof_volgnummer: '2', brandstof_omschrijving: 'Elektriciteit', nominaal_continu_maximumvermogen: '65', klasse_hybride_elektrisch_voertuig: 'OVC-HEV' }
  ] });
  assert.equal(actual.vehicle.fuel, 'PLUGIN_HYBRID');
  assert.equal(actual.vehicle.power_kw, null, 'component power is not a verified hybrid system output');
  assert.equal(actual.vehicle.hybrid_ev.combustion_max_power_kw, 135);
  assert.equal(actual.vehicle.hybrid_ev.electric_continuous_power_kw, 65);
  assert.equal(actual.vehicle.hybrid_ev.system_power_kw, null);
  assert.equal(actual.vehicle.co2_g_km, 32, 'published weighted hybrid WLTP supersedes unweighted combined emissions');
});

test('foreign registrations, conflicting fuel rows and blank quantities cannot supply trusted power', () => {
  assert.equal(normalizeRdwRecord(base, { fetchedAt, fuelRecords: [{ ...petrol, kenteken: 'OTHER1' }] }).vehicle.power_kw, null);
  assert.equal(normalizeRdwRecord(base, { fetchedAt, fuelRecords: [petrol, { ...petrol, nettomaximumvermogen: '190' }] }).vehicle.power_kw, null);
  assert.equal(normalizeRdwRecord(base, { fetchedAt, fuelRecords: [{ ...petrol, nettomaximumvermogen: '' }] }).vehicle.power_kw, null);
});

test('one bounded fuel request enriches a whole RDW page and joins only exact registrations', async () => {
  const calls = [];
  const core = new FoundlyAutomotiveCore({ bucket: () => [], persist: () => {}, now: () => new Date(fetchedAt), fetch: async url => {
    const parsed = new URL(url); calls.push(parsed);
    return new Response(JSON.stringify(parsed.pathname.includes('8ys7-d773') ? [petrol, { ...petrol, kenteken: 'OTHER1' }] : [base, { ...base, kenteken: 'TEST02' }]), { status: 200 });
  } });
  const batch = await core.searchRdw({ make: 'BMW', limit: 2 }, { tenant_id: 'test', dealer_id: 'test' });
  assert.equal(calls.length, 2, 'there must be no per-vehicle fuel request');
  assert.equal(calls[1].searchParams.get('$where'), "kenteken in('TEST01','TEST02')");
  assert.equal(calls[1].searchParams.get('$limit'), '800');
  assert.equal(core.normalize('rdw', batch.records[0], fetchedAt).vehicle.power_kw, 135);
  assert.equal(core.normalize('rdw', batch.records[1], fetchedAt).vehicle.power_kw, null);
  assert.equal(batch.pagination.source_complete, false, 'bounded make/model searches are not full registry coverage');
});

test('an unavailable fuel source leaves useful base records and explicit incomplete specifications', async () => {
  const core = new FoundlyAutomotiveCore({ bucket: () => [], persist: () => {}, fetch: async url => {
    const fuel = new URL(url).pathname.includes('8ys7-d773');
    return new Response(JSON.stringify(fuel ? { error: 'unavailable' } : [base]), { status: fuel ? 503 : 200 });
  } });
  const batch = await core.searchRdw({ make: 'BMW' }, { tenant_id: 'test', dealer_id: 'test' });
  assert.equal(batch.records.length, 1);
  const actual = core.normalize('rdw', batch.records[0], fetchedAt);
  assert.equal(actual.vehicle.power_kw, null);
  assert.equal(actual.provenance.fuel_enrichment.state, 'UNAVAILABLE');
});
