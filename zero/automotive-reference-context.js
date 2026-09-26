'use strict';
const { defaultCatalog } = require('../automotive-public-reference');

function referenceRows({ context, actor, query, composition, automotive, catalog = defaultCatalog() }) {
  if (typeof query !== 'string' || !query.trim()) return [];
  try {
    if (composition.resolve(context, actor).industry_id !== 'AUTOMOTIVE') return [];
    composition.assertCapability(context, actor, 'procurement:sourcing', 'read');
  } catch (error) { if (error.statusCode === 403) return []; throw error; }
  try {
  const makes = catalog.resolveMakes(query);
  if (!makes.length) return [];
  const rows = [];
  for (const make of makes) {
    const model = catalog.resolveModel(query, make);
    for (const kind of ['TECHNICAL_REPRESENTATIVE', 'PUBLIC_LISTING_OBSERVATION', 'REGISTRATION_AGGREGATE']) {
      const result = automotive.getPublicReferences(context, actor, { kind, make, ...(model && kind !== 'REGISTRATION_AGGREGATE' ? { model } : {}), limit: 3 });
      for (const record of result.results) rows.push({ ...record, module: 'procurement',
        provenance: { ...record.provenance, source_class: 'EXTERNAL_REFERENCE', customer_truth: false, executable: false,
          snapshot_id: result.snapshot_id, inventory_complete: false, live_inventory_verified: false,
          matching_source_records: result.total, context_rows_selected: result.results.length },
        interpretation: kind === 'PUBLIC_LISTING_OBSERVATION' ? 'Dated advertiser claim and asking/bid price; not a verified current offer or a completed sale.' : kind === 'REGISTRATION_AGGREGATE' ? 'Provisional 2025 new registrations; not used-car sales or demand for specific options.' : 'One representative registration per type/variant/version/fuel; do not apply its specifications to every matching car.'
      });
    }
  }
  // Native/current composition guards also run in each automotive read.
  composition.assertCapability(context, actor, 'procurement:sourcing', 'read');
  return rows;
  } catch (error) {
    if (!error.code?.startsWith('reference_snapshot_')) throw error;
    // An unavailable public snapshot must not discard unrelated private context.
    // Recheck visibility before exposing even this source status.
    composition.assertCapability(context, actor, 'procurement:sourcing', 'read');
    return [{ id: 'automotive-public-reference-unavailable', module: 'procurement', record_kind: 'SOURCE_STATUS',
      status: 'UNAVAILABLE', reason: error.code,
      provenance: { source_class: 'EXTERNAL_REFERENCE', customer_truth: false, executable: false, live_inventory_verified: false },
      interpretation: 'Public vehicle reference data could not be verified. Do not invent specifications, listings or registration figures.' }];
  }
}
module.exports = { referenceRows };
