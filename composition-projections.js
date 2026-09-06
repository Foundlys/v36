'use strict';
const {MODULES}=require('./module-catalog');
const {ENTITY_CAPABILITIES}=require('./module-access-contracts');
function projectedWorkspace(workspace,resolution){
  if(!MODULES[workspace.id]||resolution.legacy_compatibility)return workspace;
  const allowed=new Set(resolution.capabilities),aliases={customers:'contacts',activity:'activities',forecast:'deals',communication:'messages',analytics:'deals',dashboards:'dashboard_views','sales invoices':'invoices','purchase invoices':'invoices',bank:'bank_transactions',reconciliation:'reconciliations',receivables:'invoices',payables:'invoices',vat:'vat_codes',close:'closing_periods',forecasts:'cash_forecasts',funnels:'funnel'};
  const visible=section=>{const name=section.toLowerCase(),entity=aliases[name]||name.replaceAll(' ','_'),cap=ENTITY_CAPABILITIES[workspace.id]?.[entity];return !cap||allowed.has(cap);};
  return {...workspace,sections:workspace.sections.filter(visible),domain_entities:workspace.domain_entities?.filter(visible),capabilities:MODULES[workspace.id].provided_capabilities.filter(cap=>allowed.has(cap)),capability_aware:true};
}
function hasPartialComposition(id,resolution){return Boolean(MODULES[id]&&!resolution.legacy_compatibility&&MODULES[id].provided_capabilities.some(cap=>!resolution.capabilities.includes(cap)));}
function partialSnapshot(id,resolution,queries){
  const enabled=new Set(resolution.capabilities),rows=[],collections={},metrics={};
  const candidates={crm:['contacts','companies','leads','deals'],finance:['invoices','payments','journal_entries','budgets']}[id]||[];
  for(const entity of candidates){const cap=ENTITY_CAPABILITIES[id][entity];if(!enabled.has(cap))continue;const data=queries.list(entity);rows.push(...data.items.map(row=>({...row,entity_type:entity})));collections[entity]={total:data.total,available:true};}
  if(id==='analysis'){
    if(enabled.has('analysis:events'))rows.push(...queries.events().items);
    if(enabled.has('analysis:kpis'))for(const [key,value] of Object.entries(queries.kpis()))metrics[key]={id:key,value:value.available?value.value:null,available:Boolean(value.available),unit:value.unit,source:'FOUNDLY_CANONICAL_EVENTS',synthetic:false};
  }
  if(id==='automation'&&enabled.has('automation:runs'))rows.push(...queries.runs());
  return {rows,metrics,details:{collections,capabilities:[...enabled].filter(cap=>cap.startsWith(`${id}:`)),disabled_capabilities:MODULES[id].provided_capabilities.filter(cap=>!enabled.has(cap)),partial_configuration:true},no_fake_data:true};
}
module.exports={projectedWorkspace,hasPartialComposition,partialSnapshot};
