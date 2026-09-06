'use strict';

// Runtime availability is distinct from product/competitive acceptance. No probe
// calls optional modules or external providers, and no business record is written.
function moduleReadiness({module,resolution,storage,production,encrypted,authenticated,probe}) {
  const enabled=resolution.enabled_modules.includes(module.module_id);
  const authorized=resolution.visible_modules.includes(module.module_id);
  let operational=false,error=null;
  if(enabled&&authorized){try{operational=probe()===true;if(!operational)error='module_contract_unavailable';}catch(failure){error=String(failure.code||'module_probe_failed').replace(/[^a-zA-Z0-9_:-]/g,'').slice(0,100);}}
  const checks={enabled,authorized,authentication:Boolean(authenticated),operational_contract:operational,storage_writable:storage.writable===true,encryption:!production||encrypted===true,persistent_mount:!production||(storage.configured_path===true&&storage.separate_mount===true)};
  const ready=Object.values(checks).every(Boolean);
  return {ok:ready,module_id:module.module_id,schema_version:'foundly-module-runtime/1.0.0',alive:typeof probe==='function',ready,checks,error,readiness_scope:module.runtime_responsibilities,optional_dependencies_required:false,external_provider_status:'NOT_PROBED',product_acceptance:{status:module.status,standalone:module.standalone,sellable:module.sellable,competitive_status:module.competitive_status},observed_at:new Date().toISOString()};
}
module.exports={moduleReadiness};
