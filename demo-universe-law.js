'use strict';

// A demo is a reproducible input to the normal application contracts, never a
// provider implementation or a second set of permission/storage rules.
const crypto=require('node:crypto');
const VERSION='foundly-demo-universe/1';
const PROVENANCE_CLASSES=Object.freeze(['LIVE_PROVIDER','PUBLIC_VERIFIED','DERIVED_ESTIMATED','SYNTHETIC_DEMO']);
const LABEL='[SYNTHETIC DEMO]';
const CONTRACTS=Object.freeze({
  'crm.create':{module:'crm',entities:['companies','teams','roles','people','contacts','leads','opportunities','deals','activities','tasks','appointments','notes','calls','emails','messages','products','vehicles','inventory_relations','campaigns']},
  'domain.create':{modules:{procurement:['suppliers','opportunities','quotes','orders','documents','tasks'],sales:['opportunities','quotes','orders','activities','tasks'],marketing:['campaigns','audiences','creatives'],calendar:['calendars','events'],communication:['drafts','templates','preferences']}},
  'event.ingest':{module:'analysis',entities:['events']},
  'document.create':{module:'data',entities:['documents']},
  'workflow.save':{module:'automation',entities:['workflows']},
  'finance.draft':{module:'finance',entities:['invoice_drafts']},
  'finance.create':{module:'finance',entities:['legal_entities','fiscal_periods','accounts']},
  'finance.action':{module:'finance',entities:['invoices','payments']},
  'commerce.action':{module:'sales',entities:['commerce_products','commerce_inventory','commerce_orders']},
  'memory.create':{module:'knowledge',entities:['memories']},
  'identity.invite':{module:'identity',entities:['members']}
});
const fail=(code,statusCode=422)=>{throw Object.assign(Error(code),{code,statusCode});};
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_.:-]{1,160}$/.test(v)&&!['__proto__','prototype','constructor'].includes(v);
const date=v=>typeof v==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
function canonical(value){
  if(value===null||['string','boolean'].includes(typeof value))return JSON.stringify(value);
  if(typeof value==='number'){if(!Number.isFinite(value))fail('demo_number_invalid');return JSON.stringify(value);}
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  if(!object(value)||Object.getPrototypeOf(value)!==Object.prototype&&Object.getPrototypeOf(value)!==null)fail('demo_value_invalid');
  return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}';
}
const hash=value=>crypto.createHash('sha256').update(canonical(value)).digest('hex');
function keys(value,allowed){if(!object(value)||Object.keys(value).some(k=>!allowed.includes(k)))fail('demo_shape_invalid');}
function contract(node){
  const spec=CONTRACTS[node.contract];if(!spec||!(spec.modules?.[node.module]||spec.module===node.module&&spec.entities||[]).includes(node.entity))fail('demo_contract_unavailable');
  return spec;
}
function references(value,found=[],depth=0){
  if(depth>20)fail('demo_input_depth');
  if(Array.isArray(value)){for(const v of value)references(v,found,depth+1);}
  else if(object(value)){
    if(Object.hasOwn(value,'$ref')){keys(value,['$ref']);if(!id(value.$ref))fail('demo_reference_invalid');found.push(value.$ref);}
    else for(const [k,v] of Object.entries(value)){
      if(['__proto__','prototype','constructor'].includes(k))fail('demo_input_key_invalid');
      if(/(?:password|access_token|refresh_token|secret|api_key|cookie|authorization)$/i.test(k))fail('demo_secret_forbidden');
      if(['provider_verified','_provider_verified','connected','live','external_send'].includes(k)&&v!==false)fail('demo_live_claim_forbidden');
      references(v,found,depth+1);
    }
  }else if(!['string','number','boolean'].includes(typeof value)&&value!==null)fail('demo_value_invalid');
  return found;
}
function provenance(scenarioId,nodeId){return {classification:'SYNTHETIC_DEMO',generator:VERSION,scenario_id:scenarioId,source_reference:'demo://'+scenarioId+'/'+nodeId,provider_verified:false,customer_truth:false};}
function validateProvenance(value,scenarioId,nodeId){if(canonical(value)!==canonical(provenance(scenarioId,nodeId)))fail('demo_provenance_invalid');}
function validate(manifest){
  keys(manifest,['schema_version','scenario_id','seed','as_of','history_start','industry_id','company','locations','personas','nodes','scenarios','derived','fingerprint']);
  if(manifest.schema_version!==VERSION||!id(manifest.scenario_id)||!id(manifest.seed)||!date(manifest.as_of)||!date(manifest.history_start)||manifest.history_start>=manifest.as_of||!['GENERAL','AUTOMOTIVE','ECOMMERCE'].includes(manifest.industry_id))fail('demo_manifest_invalid');
  keys(manifest.company,['name','classification']);if(manifest.company.classification!=='SYNTHETIC_DEMO'||typeof manifest.company.name!=='string'||!manifest.company.name.startsWith(LABEL))fail('demo_company_invalid');
  if(!Array.isArray(manifest.locations)||!manifest.locations.length||manifest.locations.length>30||!Array.isArray(manifest.personas)||!manifest.personas.length||manifest.personas.length>100)fail('demo_organization_invalid');
  const locations=new Set();for(const row of manifest.locations){keys(row,['id','name','country','timezone','classification']);if(!id(row.id)||locations.has(row.id)||typeof row.name!=='string'||!row.name.startsWith(LABEL)||!/^[A-Z]{2}$/.test(row.country)||typeof row.timezone!=='string'||row.classification!=='SYNTHETIC_DEMO')fail('demo_location_invalid');try{new Intl.DateTimeFormat('en',{timeZone:row.timezone});}catch{fail('demo_location_invalid');}locations.add(row.id);}
  const personas=new Set();for(const row of manifest.personas){keys(row,['id','name','role','location_id','classification']);if(!id(row.id)||personas.has(row.id)||typeof row.name!=='string'||!row.name.startsWith(LABEL)||![...require('./module-role-policy').ROLE_IDS,'FINANCE'].includes(row.role)||!locations.has(row.location_id)||row.classification!=='SYNTHETIC_DEMO')fail('demo_persona_invalid');personas.add(row.id);}
  if(!Array.isArray(manifest.nodes)||!manifest.nodes.length||manifest.nodes.length>20000)fail('demo_node_capacity');
  const seen=new Map(),counts={};
  for(const n of manifest.nodes){
    keys(n,['id','kind','contract','module','entity','occurred_at','location_id','persona_id','input','depends_on','provenance']);contract(n);
    if(!id(n.id)||seen.has(n.id)||!id(n.kind)||!date(n.occurred_at)||n.occurred_at<manifest.history_start||n.occurred_at>manifest.as_of||!locations.has(n.location_id)||!personas.has(n.persona_id)||!object(n.input)||!Array.isArray(n.depends_on)||n.depends_on.length>100||new Set(n.depends_on).size!==n.depends_on.length)fail('demo_node_invalid');
    if(['id','tenant_id','dealer_id','revision','created_at','updated_at','created_by','updated_by','provenance'].some(k=>Object.hasOwn(n.input,k)))fail('demo_reserved_input');
    validateProvenance(n.provenance,manifest.scenario_id,n.id);
    for(const ref of [...n.depends_on,...references(n.input)])if(!seen.has(ref)||!n.depends_on.includes(ref)||seen.get(ref).occurred_at>n.occurred_at)fail('demo_dependency_invalid');
    const labels=['name','display_name','title','content','description','text','reason'].filter(k=>typeof n.input[k]==='string');if(!labels.some(k=>n.input[k].startsWith(LABEL)))fail('demo_visible_label_required');
    if(n.contract==='commerce.action'){
      keys(n.input,['operation','values','reason']);
      const entities={PRODUCT_SAVE:'commerce_products',STOCK_RECEIVE:'commerce_inventory',ORDER_RESERVE:'commerce_orders',ORDER_CANCEL:'commerce_orders',ORDER_FULFILL:'commerce_orders',ORDER_RETURN:'commerce_orders'};
      if(entities[n.input.operation]!==n.entity||!object(n.input.values)||['confirm','reason'].some(k=>Object.hasOwn(n.input.values,k))||typeof n.input.reason!=='string'||!n.input.reason.startsWith(LABEL))fail('demo_commerce_action_invalid');
    }
    if(n.contract==='finance.action'){
      keys(n.input,['operation','values','reason']);
      const entities={INVOICE_CREATE:'invoices',COMMERCE_INVOICE_CREATE:'invoices',CREDIT_NOTE_CREATE:'invoices',INVOICE_POST:'invoices',PAYMENT_RECORD:'payments'};
      if(entities[n.input.operation]!==n.entity||!object(n.input.values)||typeof n.input.reason!=='string'||!n.input.reason.startsWith(LABEL)||n.input.reason.length>500||['confirm','reason','request_id','expected_source_hash'].some(k=>Object.hasOwn(n.input.values,k)))fail('demo_finance_action_invalid');
    }
    if(canonical(n.input).length>50000)fail('demo_input_capacity');
    if(n.contract==='workflow.save'&&(n.input.automatic!==false||n.input.approval_required!==true||n.input.trigger_type!=='custom_event'))fail('demo_workflow_must_require_explicit_execution');
    if(n.contract==='identity.invite'&&(n.input.confirm!==true||!n.input.username?.endsWith('.demo')))fail('demo_identity_invalid');
    seen.set(n.id,n);counts[n.kind]=(counts[n.kind]||0)+1;
  }
  if(!Array.isArray(manifest.scenarios)||!manifest.scenarios.length||manifest.scenarios.length>100||!Array.isArray(manifest.derived)||manifest.derived.length>1000)fail('demo_scenarios_invalid');
  const scenarioIds=new Set();for(const s of manifest.scenarios){keys(s,['id','kind','description','source_ids','expectations']);if(!id(s.id)||scenarioIds.has(s.id)||!['NORMAL','ANOMALY','OPERATIONAL_FAILURE'].includes(s.kind)||typeof s.description!=='string'||!s.description.startsWith(LABEL)||!Array.isArray(s.source_ids)||!s.source_ids.length||s.source_ids.some(id=>!seen.has(id))||!object(s.expectations))fail('demo_scenario_invalid');for(const ref of references(s.expectations))if(!s.source_ids.includes(ref))fail('demo_scenario_reference_invalid');scenarioIds.add(s.id);}
  for(const row of manifest.derived){keys(row,['id','classification','metric','value','currency','period_start','period_end','source_ids','formula']);if(!id(row.id)||row.classification!=='DERIVED_ESTIMATED'||!id(row.metric)||!Number.isFinite(row.value)||!(row.currency===null||/^[A-Z]{3}$/.test(row.currency))||!date(row.period_start)||!date(row.period_end)||row.period_start<manifest.history_start||row.period_end>manifest.as_of||row.period_start>=row.period_end||!Array.isArray(row.source_ids)||!row.source_ids.length||row.source_ids.some(id=>!seen.has(id))||typeof row.formula!=='string'||row.formula.length>500)fail('demo_derived_invalid');}
  const {fingerprint,...body}=manifest;if(fingerprint!==hash(body))fail('demo_manifest_fingerprint_invalid');
  return {valid:true,fingerprint,counts,node_count:seen.size,classification:'SYNTHETIC_DEMO',provider_verified:false,live_provider_evidence:false,executable_without_confirmation:false};
}
function seal(body){const manifest={...body,fingerprint:hash(body)};validate(manifest);return manifest;}
function resolveInput(input,bindings){
  if(Array.isArray(input))return input.map(v=>resolveInput(v,bindings));
  if(object(input)){if(Object.hasOwn(input,'$ref')){keys(input,['$ref']);const value=Object.hasOwn(bindings,input.$ref)?bindings[input.$ref]:null;if(!value||typeof value.id!=='string'||!id(value.id))fail('demo_binding_unavailable',409);return value.id;}return Object.fromEntries(Object.entries(input).map(([k,v])=>[k,resolveInput(v,bindings)]));}
  return input;
}
module.exports={VERSION,PROVENANCE_CLASSES,LABEL,CONTRACTS,hash,canonical,provenance,validate,seal,resolveInput,references};
