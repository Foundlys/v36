'use strict';
function productReferenceRows({ context, actor, query, composition, crm }) {
  if (typeof query !== 'string' || !/\b(?:product|artikel|ean|barcode|gtin)\b/i.test(query)) return [];
  const codes = [...new Set(query.match(/\b\d{8,14}\b/g) || [])].slice(0, 3);
  if (!codes.length) return [];
  try { composition.assertCapability(context, actor, 'crm:relationships', 'read'); }
  catch (error) { if (error.statusCode === 403) return []; throw error; }
  const rows = [];
  try {
    for (const code of codes) {
      for (const method of ['publicProductReferences', 'publicProductPrices']) {
        const result = crm[method](context, actor, { code, limit: 3 });
        for (const record of result.results) rows.push({ ...record, module: 'crm', provenance: { ...record.provenance,
          source_class: 'EXTERNAL_REFERENCE', customer_truth: false, executable: false, snapshot_id: result.snapshot_id,
          matching_source_records: result.total, context_rows_selected: result.results.length } });
      }
    }
    composition.assertCapability(context, actor, 'crm:relationships', 'read');
    return rows;
  } catch (error) {
    if (!error.code?.startsWith('product_reference_snapshot_')) throw error;
    composition.assertCapability(context, actor, 'crm:relationships', 'read');
    return [{ id: 'public-product-reference-unavailable', module: 'crm', record_kind: 'SOURCE_STATUS', status: 'UNAVAILABLE', reason: error.code,
      provenance: { source_class: 'EXTERNAL_REFERENCE', customer_truth: false, executable: false },
      interpretation: 'Public product references are unavailable. Do not infer stock, current prices or customer transactions.' }];
  }
}
module.exports = { productReferenceRows };
