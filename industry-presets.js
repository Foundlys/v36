'use strict';
// Manifests contribute declarative starting points, never executable handlers or
// new data sources. Existing workflow/dashboard APIs retain all write authority.
const {MODULES}=require('./module-catalog');
const {allowed,requirePermission}=require('./capability-resolver');
const {ENTITY_CAPABILITIES}=require('./module-access-contracts');
const {WORKSPACE_DEFINITIONS,normalizeDashboard}=require('./workspace-system');
const {compile}=require('./workflow-authoring');
const clone=value=>JSON.parse(JSON.stringify(value));
const invalid=()=>{throw Object.assign(new Error('Ongeldig branchesjabloon'),{code:'industry_preset_invalid',statusCode:422});};
function industryPresets(resolver,ctx,actor,moduleId,editorContract){
  if(!Object.hasOwn(MODULES,moduleId))throw Object.assign(new Error('Onbekende module'),{code:'module_unknown',statusCode:404});
  requirePermission(actor,`${moduleId}:read`);resolver.assertModule(ctx,actor,moduleId);
  const resolution=resolver.resolve(ctx,actor),extension=resolution.industry_extensions[moduleId]||{},caps=new Set(resolution.capabilities),items=[],unavailable=[];
  const seen=new Set();
  for(const [kind,rows] of [['dashboard',extension.dashboard_presets||[]],['workflow',extension.workflow_templates||[]]]){
    if(!Array.isArray(rows)||rows.length>40)invalid();
    for(const input of rows){
      const id=input?.id;
      try{
        if(!/^[a-z][a-z0-9_:-]{0,99}$/.test(id||'')||seen.has(id)||!Number.isSafeInteger(input.version)||input.version<1||typeof input.name!=='string'||!input.name.trim()||input.name.length>160)invalid();
        seen.add(id);
        const required=input.required_capabilities||[];
        if(!Array.isArray(required)||required.length>40||required.some(cap=>!Object.values(MODULES).some(m=>m.provided_capabilities.includes(cap))))invalid();
        if(required.some(cap=>!caps.has(cap)))continue;
        let prepared;
        if(kind==='workflow'){
          if(moduleId!=='automation'||!editorContract)invalid();
          if(!caps.has('automation:workflows')||!caps.has('automation:approvals'))continue;
          // Opening a template must not subscribe a workflow to live events.
          if(input.draft?.automatic!==false||input.draft?.approval_required!==true||input.draft?.trigger_type!=='custom_event')invalid();
          if(!Array.isArray(input.draft.steps)||input.draft.steps.some(step=>!step||typeof step!=='object'))invalid();
          compile(input.draft,editorContract);
          prepared={draft:clone(input.draft)};
        }else{
          const metrics=input.metrics;
          if(!Array.isArray(metrics)||!metrics.length||metrics.length>40||new Set(metrics).size!==metrics.length)invalid();
          const definitions=WORKSPACE_DEFINITIONS[moduleId]?.default_widgets||[];
          const widgets=metrics.map(metric=>{const widget=definitions.find(row=>row.metric===metric);if(!widget)invalid();return clone(widget);});
          // Native entity metrics have an explicit capability; complex engine
          // metrics conservatively require every capability of that engine.
          const needed=metrics.flatMap(metric=>ENTITY_CAPABILITIES[moduleId]?.[metric]?[ENTITY_CAPABILITIES[moduleId][metric]]:MODULES[moduleId].provided_capabilities);
          if(needed.some(cap=>!caps.has(cap)))continue;
          prepared={dashboard:normalizeDashboard(moduleId,{name:input.name,scope:'PERSONAL',widgets},actor.id)};
        }
        items.push({id,version:input.version,name:input.name,industry_id:resolution.industry_id,module_id:moduleId,kind,executable:false,can_prepare:kind==='dashboard'||allowed(actor,'automation:write'),...prepared});
      }catch(error){if(!['industry_preset_invalid','workflow_draft_invalid','dashboard_widget_invalid'].includes(error.code))throw error;unavailable.push({id:typeof id==='string'?id.slice(0,100):null,kind,status:'INVALID_CONFIGURATION'});}
    }
  }
  return {industry_id:resolution.industry_id,module_id:moduleId,items,unavailable,status:unavailable.length?'PARTIAL':items.length?'AVAILABLE':'NO_AVAILABLE_PRESETS',persistent_changes:false};
}
module.exports={industryPresets};
