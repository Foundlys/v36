'use strict';

// Commercial identity is independent of historical storage/engine aliases.
const {ENTITY_CAPABILITIES,METHOD_CAPABILITIES}=require('./module-access-contracts');
const VERSION = 'foundly-module-contract/1.0.0';
const DEFINITIONS = {
  procurement: ['Inkoop', 'inkoop', ['sourcing', 'suppliers', 'opportunities', 'approvals'], ['AUTOMOTIVE_MARKETPLACE']],
  sales: ['Verkoop', 'verkoop', ['opportunities', 'pipeline', 'forecast', 'quotes'], ['INTERNAL']],
  crm: ['CRM', 'crm', ['contacts', 'companies', 'leads', 'relationships'], ['INTERNAL']],
  marketing: ['Marketing', 'social_media', ['campaigns', 'audiences', 'attribution'], ['MARKETING', 'MEASUREMENT']],
  finance: ['Finance', 'finance', ['ledger', 'invoices', 'payments', 'reports'], ['FINANCE']],
  analysis: ['Analytics', 'analysis', ['kpis', 'events', 'funnel', 'reports'], ['MEASUREMENT', 'INTERNAL']],
  calendar: ['Agenda', 'agenda', ['events', 'availability', 'conflicts'], ['CALENDAR']],
  communication: ['Communicatie', 'communicatie', ['inbox', 'drafts', 'threads'], ['COMMUNICATION']],
  automation: ['Automation', 'automatisering', ['workflows', 'runs', 'approvals'], ['INTERNAL']]
};
const RESPONSIBILITIES = {
  procurement:['owned opportunity and supplier records','internal quote/order approval','permission-filtered export'],
  sales:['owned pipeline and opportunity records','currency-separated forecast','internal quote/order approval','permission-filtered export'],
  crm:['owned customer records and relationships','permission-filtered activity and analytics','audited export'],
  marketing:['owned campaigns and audience records','unpublished creative preparation','permission-filtered export'],
  finance:['legal entities and balanced journals','invoice lifecycle and reports','audited export'],
  analysis:['versioned canonical event queries','permission-filtered KPI and funnel calculations','audited export'],
  calendar:['owned events and availability','timezone-aware conflict checks','permission-filtered export'],
  communication:['owned drafts and templates','consent records','permission-filtered export; external delivery requires provider authorization'],
  automation:['owned tasks and documents','durable workflow runs and approval gates','audited export']
};
const API_CONTRACTS={crm:{export:'/api/crm/export/:entity',schema:'/api/crm/schema'},finance:{export:'/api/finance/exports',schema:'/api/finance/schema'},analysis:{export:'/api/analysis/owned-export',schema:'/api/platform/schema'},automation:{export:'/api/automation/export',schema:'/api/platform/schema'}};
const EVENT_CONTRACTS={crm:['lead_created','lead_qualified','crm_record_created','deal_changed','deal_created','deal_won','deal_lost','crm_record_changed','crm_record_archived','task_created','task_completed','contact_created','company_created','appointment_scheduled','quote_created'],finance:['invoice_draft_created','invoice_approved','invoice_created','invoice_paid','payment_sent','journal_posted','collection_action_created','bank_transaction_imported','period_closed'],analysis:['analysis.record.created.v1','analysis.record.updated.v1'],automation:['automation.workflow.created.v1','automation.tasks.created.v1','automation.documents.created.v1','automation.run.updated.v1']};
const CORE_SERVICES = Object.freeze(['identity', 'authorization', 'persistence', 'audit', 'events', 'connectors', 'sources', 'knowledge', 'learning', 'zero', 'data']);
const TOOL_MODULES = Object.freeze({
  procurement_summary:'procurement',sales_pipeline:'sales',calendar_agenda:'calendar',communication_drafts:'communication',marketing_campaigns:'marketing',
  create_lead: 'crm', create_task: 'automation', create_appointment: 'calendar',
  draft_message: 'communication', create_report: 'analysis',
  crm_priority_leads: 'crm', crm_pipeline_summary: 'crm', crm_customer_360: 'crm',
  crm_inventory_customer_matches: 'crm', analysis_kpi: 'analysis', analysis_funnel: 'analysis',
  analysis_campaign_outcome: 'analysis', finance_report: 'finance',
  automation_status: 'automation', automation_run: 'automation',
  automotive_search: 'procurement', automotive_comparables: 'procurement',
  automotive_economics: 'procurement', automotive_candidate_analysis: 'procurement', automotive_today: 'procurement'
});
const WRITE_TOOLS=Object.freeze(['create_lead','create_task','create_appointment','create_report','draft_message','automation_run']);
const TOOL_CAPABILITIES = Object.freeze({
  procurement_summary:'procurement:opportunities',sales_pipeline:'sales:pipeline',calendar_agenda:'calendar:events',communication_drafts:'communication:drafts',marketing_campaigns:'marketing:campaigns',
  create_lead:'crm:leads',crm_priority_leads:'crm:leads',crm_pipeline_summary:'crm:relationships',crm_customer_360:'crm:relationships',crm_inventory_customer_matches:'crm:relationships',
  create_task:'automation:workflows',create_appointment:'calendar:events',draft_message:'communication:drafts',create_report:'analysis:reports',
  analysis_kpi:'analysis:kpis',analysis_funnel:'analysis:funnel',analysis_campaign_outcome:'analysis:reports',finance_report:'finance:reports',
  automation_status:'automation:runs',automation_run:'automation:workflows',
  automotive_search:'procurement:sourcing',automotive_comparables:'procurement:sourcing',automotive_economics:'procurement:opportunities',automotive_candidate_analysis:'procurement:opportunities',automotive_today:'procurement:opportunities'
});
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
const MODULES = freeze(Object.fromEntries(Object.entries(DEFINITIONS).map(([id, [label, engine, capabilities, categories]]) => [id, {
  module_id: id, display_name: label, version: '1.0.0', schema_version: VERSION,
  status: 'ACCEPTANCE_PENDING', standalone: 'UNVERIFIED', sellable: false,
  runtime_responsibilities: RESPONSIBILITIES[id], capability_entities:ENTITY_CAPABILITIES[id],capability_operations:METHOD_CAPABILITIES[id]||{},
  core_required: true, required_core_services: ['identity', 'authorization', 'persistence', 'audit', 'events'],
  optional_dependencies: id==='automation'?['crm','finance','analysis','communication']:id==='communication'?['calendar']:[], provided_capabilities: capabilities.map(c => `${id}:${c}`), consumed_capabilities: id==='automation'?['crm:relationships','finance:invoices','analysis:kpis','communication:drafts']:id==='communication'?['calendar:events']:[],
  published_events: EVENT_CONTRACTS[id] || [`${id}.record.created.v1`, `${id}.record.updated.v1`,...(['procurement','sales'].includes(id)?[`${id}.record.approved.v1`]:[])], subscribed_events: [],
  api_contracts: [{ version: 1, prefix: `/api/${id}`, export: API_CONTRACTS[id]?.export||`/api/${id}/export`, schema:API_CONTRACTS[id]?.schema||`/api/${id}/schema`,auth:'EXISTING_CORE_AUTHORIZATION',tenant_context:'SERVER_TRUSTED',capability_policy:'CURRENT_PROFILE_ON_EVERY_ENTRYPOINT' }], route: `/${id}`, legacy_engine: engine,
  zero_tools: Object.keys(TOOL_MODULES).filter(tool => TOOL_MODULES[tool] === id),
  source_categories: categories, connector_categories: categories,
  dashboard_presets: [`${id}:default`], widgets: capabilities,
  permissions: ['read', 'write', 'export', 'manage','approve'].map(p => `${id}:${p}`), roles: ['ADMIN', 'MANAGER', 'VIEWER'],
  data_domains: [id], retention_policy: 'RETAIN_UNTIL_EXPLICIT_AUTHORIZED_POLICY',
  disable_policy: 'HIDDEN_RETAINED_EXPORTABLE', reactivation_policy: 'RESTORE_WITH_CURRENT_PERMISSIONS',
  health_endpoint: `/api/composition/modules/${id}/health`, ready_endpoint: `/api/composition/modules/${id}/ready`,
  migration_version: 1, feature_flags: capabilities.map(cap=>`${id}:${cap}`), entitlement_key: `module:${id}`,
  audit_categories: [`${id}:read`, `${id}:write`, `${id}:export`],
  industry_extension_points: ['fields', 'objects', 'workflows', 'dashboards', 'kpis', 'tools', 'connectors'],
  competitive_status: 'BELOW_PARITY', competitive_ledger_version:require(`./competitive-ledgers/${id}.json`).version, competitive_ledger:`competitive-ledgers/${id}.json`
}])));
const ALIASES = freeze({...Object.fromEntries(Object.entries(MODULES).flatMap(([id, m]) => [[id, id], [m.legacy_engine, id]])),rapportages:'analysis',google_ads:'marketing',social:'marketing',google:'marketing'});
const BUNDLES = freeze({ COMPLETE: Object.keys(MODULES), OPERATIONS: ['crm', 'calendar', 'communication', 'automation'], ...Object.fromEntries(Object.keys(MODULES).map(id => [id.toUpperCase(), [id]])) });
const INDUSTRIES = freeze({
  GENERAL: { industry_id: 'GENERAL', production: true, extensions: {} },
  AUTOMOTIVE: { industry_id: 'AUTOMOTIVE', production: true, route: '/automotive', extensions: {
    procurement: { objects: ['vehicle', 'listing'], tools: Object.keys(TOOL_MODULES).filter(t => t.startsWith('automotive_')), connectors: ['rdw', 'mobile_de', 'marktplaats', 'autoscout24', 'vwe', 'autotelex', 'rdc'], fields: ['vin', 'registration', 'mileage'], field_schema:{vin:{type:'string'},registration:{type:'string'},mileage:{type:'number'}}, kpis: ['buy_score', 'acquisition_economics'] },
    crm: { fields: ['vehicle_interest'], objects: ['vehicle_customer_relationship'] },
    sales: { fields: ['vehicle_id'], kpis: ['days_in_stock'] },
    analysis: { kpis: ['inventory_velocity', 'vehicle_margin'] }
  } }
});
function moduleId(value) { return ALIASES[String(value || '').toLowerCase()] || null; }
function routeModule(pathname) {
  const pieces = pathname.split('/').filter(Boolean);
  if(pieces[0]==='api'&&pieces[1]==='tax')return 'finance';
  if(pieces[0]==='api'&&pieces[1]==='google')return pieces[2]==='calendar'?'calendar':['ga4'].includes(pieces[2])?'analysis':['ads','search-console'].includes(pieces[2])?'marketing':null;
  if(pieces[0]==='api'&&['meta','measurement'].includes(pieces[1]))return 'marketing';
  if(pieces[0]==='api'&&['email','whatsapp'].includes(pieces[1]))return 'communication';
  const part = pieces[0] === 'api' ? (['workspaces', 'module', 'engine'].includes(pieces[1]) ? pieces[2] : pieces[1]) : pieces[0];
  return moduleId(part);
}
module.exports = { VERSION, MODULES, CORE_SERVICES, TOOL_MODULES, TOOL_CAPABILITIES, WRITE_TOOLS, BUNDLES, INDUSTRIES, moduleId, routeModule, freeze };
