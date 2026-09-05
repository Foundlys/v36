'use strict';

// A section selects its own evidence; it must not recycle the overview KPIs.
function sectionModel(workspace,section,snapshot) {
  const rows=snapshot.rows||[],details=snapshot.details||{};
  const result=(items,source,extra={})=>({workspace_id:workspace,section,status:'AVAILABLE',items,source,...extra});
  if(section==='SOURCES'||section==='FRESHNESS')return result(snapshot.sources||[],'CANONICAL_SOURCE_REGISTRY');
  if(section==='CONNECTORS'||section==='SYNC')return result(snapshot.connectors||[],'CANONICAL_CONNECTOR_REGISTRY');
  if(workspace==='marketing'){
    const matching={META:row=>row.provider==='meta'||row.source==='meta','GOOGLE ADS':row=>['google_ads','google'].includes(row.provider||row.source),SOCIAL:row=>['meta','instagram','linkedin','tiktok'].includes(row.provider||row.source),LEADS:row=>/lead/.test(row.event_name||''),ATTRIBUTION:row=>row.campaign_id&&row.utm_source,CONVERSIONS:row=>/conversion|deal_won|invoice_paid/.test(row.event_name||''),MEASUREMENT:()=>true};
    if(matching[section])return result(rows.filter(matching[section]),'CANONICAL_EVENTS',{scope:'LATEST_PERMISSION_FILTERED_EVENTS'});
  }
  if(workspace==='communication'){
    const matching={INBOX:row=>row.direction==='INBOUND',EMAIL:row=>/email|mail/.test(row.provider||row.source||row.type||''),WHATSAPP:row=>/whatsapp/.test(row.provider||row.source||row.type||''),NOTIFICATIONS:row=>row.type==='notification'};
    if(matching[section])return result(rows.filter(matching[section]),'COMMUNICATION_RECORDS');
    if(section==='VOICE')return result((snapshot.connectors||[]).filter(row=>/voice|realtime/.test(row.connector_id)),'VOICE_CONNECTOR_STATUS');
    if(section==='CALENDAR')return result([],'OPTIONAL_CALENDAR',{status:snapshot.metrics?.appointments?.available?'OPEN_MODULE':'MODULE_UNAVAILABLE',route:'/calendar'});
    if(section==='AUTOMATIONS')return result([],'OPTIONAL_AUTOMATION',{status:'OPEN_MODULE',route:'/automation'});
  }
  if(workspace==='knowledge'){
    const matching={EVIDENCE:row=>(row.evidence||[]).length||(row.sources||[]).length,INSIGHTS:row=>row.type==='DERIVED_INSIGHT',DOCUMENTS:row=>row.type==='RAW_SOURCE',MEMORY:row=>row.type==='USER_PREFERENCE',CONFIDENCE:row=>Number.isFinite(row.confidence),VALIDITY:row=>row.expires_at||row.last_verified_at,SUPERSESSION:row=>row.superseded_by||row.supersedes,SEARCH:()=>true};
    if(matching[section])return result(rows.filter(matching[section]),'PERMISSION_FILTERED_KNOWLEDGE');
  }
  if(workspace==='learning'){
    const matching={RECOMMENDATIONS:()=>true,OUTCOMES:row=>row.outcome_metrics||row.outcome,FEEDBACK:row=>row.feedback,LESSONS:row=>row.lesson||row.text||row.description,SUCCESS:row=>String(row.outcome_metrics?.status||row.outcome).toUpperCase()==='SUCCESS',FAILURES:row=>['FAILED','FAILURE'].includes(String(row.outcome_metrics?.status||row.outcome).toUpperCase()),CALIBRATION:row=>row.confidence!==undefined,'RULE VERSIONS':row=>row.rule_version,'MODEL VERSIONS':row=>row.model_version};
    if(matching[section])return result(rows.filter(matching[section]),'PERSISTED_LEARNING_OUTCOMES');
  }
  if(workspace==='data'){
    if(section==='DATASETS')return result(rows,'CANONICAL_RECORDS');
    if(section==='LINEAGE')return result(rows.map(row=>({internal_id:row.internal_id,record_type:row.record_type,source:row.source,provenance:row.provenance})),'RECORD_PROVENANCE');
    if(section==='SCHEMAS')return result([...new Set(rows.map(row=>row.record_type).filter(Boolean))].map(type=>({record_type:type,versions:[...new Set(rows.filter(row=>row.record_type===type).map(row=>row.schema_version||row.version))]})),'OBSERVED_RECORD_SCHEMAS');
    if(section==='CONFLICTS')return result(rows.filter(row=>row.sync_state==='CONFLICT'),'CANONICAL_RECORD_CONFLICTS');
    if(section==='RETENTION')return result(details.retention?[details.retention]:[],'CORE_RETENTION_POLICY');
    if(section==='QUALITY')return result(rows.filter(row=>row.validation_errors?.length||row.sync_state==='ERROR'),'RECORD_VALIDATION_ERRORS');
    if(section==='EXPORTS')return result([],'PERMISSION_FILTERED_EXPORT',{status:'USE_WORKSPACE_EXPORT'});
  }
  if(workspace==='settings'){
    if(section==='TENANT')return result([snapshot.tenant,details.tenant_profile].filter(Boolean),'ACTIVE_TENANT_CONFIGURATION');
    if(section==='ROLES'||section==='USERS')return result([{active_roles:snapshot.metrics?.role_model?.value,user_directory:'NOT_IMPLEMENTED',identity_model:'SERVICE_AUTHENTICATION'}],'SERVER_PRINCIPAL');
    if(section==='SECURITY')return result(details.readiness?[{authentication:details.readiness.authentication,encryption:details.readiness.encryption,public_base_url:details.readiness.public_base_url}]:[],'RUNTIME_CHECKS');
    if(section==='PERSISTENCE')return result(details.readiness?.persistence?[details.readiness.persistence]:[],'RUNTIME_STORAGE_CHECK');
    if(section==='ZERO')return result(details.zero_preferences?[details.zero_preferences]:[],'CURRENT_ZERO_PREFERENCES');
  }
  return result([],'NO_SECTION_IMPLEMENTATION',{status:'NOT_IMPLEMENTED',reason:'Dit onderdeel heeft nog geen volledig aangesloten gegevenscontract.'});
}
module.exports={sectionModel};
