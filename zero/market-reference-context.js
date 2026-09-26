'use strict';
const {query: nativeQuery} = require('../market-reference');
function marketReferenceRows({context, actor, query, composition, domains}) {
  if (typeof query !== 'string' || !/\b(trends?|markt|market|nieuwste|nieuwe modellen|new models|omzet|forecast|prognose|verwachtingen|valuation|waardeverwachting)\b/i.test(query)) return [];
  let industry;
  try { industry = composition.resolve(context, actor).industry_id; } catch (error) { if (error.statusCode === 403) return []; throw error; }
  const automotive = industry === 'AUTOMOTIVE';
  if (!automotive && industry !== 'ECOMMERCE' && !/\b(e-?commerce|webwinkel|detailhandel|retail|online.?omzet)\b/i.test(query)) return [];
  const module = automotive ? 'procurement' : 'sales', capability = automotive ? 'procurement:sourcing' : 'sales:forecast';
  try { composition.assertCapability(context, actor, capability, 'read'); } catch (error) { if (error.statusCode === 403) return []; throw error; }
  try {
    const make = automotive && query.match(/\b(BMW|Volkswagen)\b/i)?.[1];
    const models = automotive && /\b(modellen|models?|modelle|modèles|modelos)\b/i.test(query);
    const result = nativeQuery(domains[module], context, actor, {industry: automotive ? 'AUTOMOTIVE' : 'ECOMMERCE', ...(make ? {q: make} : {}), ...(models ? {kind: 'MODEL_ANNOUNCEMENT'} : {}), limit: 8});
    composition.assertCapability(context, actor, capability, 'read');
    return result.results.map(row => ({...row, module}));
  } catch (error) {
    if (error.code !== 'market_reference_integrity') throw error;
    composition.assertCapability(context, actor, capability, 'read');
    return [{id: 'market-reference-unavailable', module, record_kind: 'SOURCE_STATUS', status: 'UNAVAILABLE', provenance: {source_class: 'EXTERNAL_REFERENCE', customer_truth: false, executable: false}, interpretation: 'Market sources unavailable. Do not invent current trends or use an unverified growth assumption.'}];
  }
}
module.exports = {marketReferenceRows};
