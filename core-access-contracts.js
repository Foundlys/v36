'use strict';
const {moduleId,MODULES}=require('./module-catalog');
const {permissions}=require('./capability-resolver');
const {ROLE_PERMISSIONS}=require('./platform-core');
function fail(code){throw Object.assign(new Error('Deze Core-actie is niet toegestaan voor de actieve gebruiker'),{statusCode:403,code});}
function coreAllowed(actor,permission){const grants=permissions(actor);for(const role of actor.roles||[])for(const value of ROLE_PERMISSIONS[String(role).toUpperCase()]||[])grants.add(value);return grants.has('*')||grants.has(permission);}
function assertCorePermission(actor,permission){if(!coreAllowed(actor,permission))fail('core_forbidden');}
function privateRowVisible(row,actor){return coreAllowed(actor,'*')||Boolean(row.owner_id&&row.owner_id===actor.id);}
function assertMemoryScope(scope,resolver,ctx,actor,operation='read'){
  if(!resolver.profile(ctx))return;
  const owner=moduleId(scope);
  if(owner){resolver.assertModule(ctx,actor,owner,operation);for(const capability of MODULES[owner].provided_capabilities)resolver.assertCapability(ctx,actor,capability,operation);return;}
  // Internal storage keys (confirmations, conversations, dashboard layouts) have
  // dedicated APIs; the generic memory route is not an alternate storage API.
  if(!['core','data','knowledge','learning'].includes(scope))fail('memory_scope_forbidden');
  assertCorePermission(actor,operation==='read'?'knowledge:read':'knowledge:write');
}
function assertCoreRoute(pathname,method,resolver,ctx,actor){
  if(!resolver.profile(ctx))return;
  const memory=pathname.match(/^\/api\/memory\/([^/]+)(?:\/search)?$/);
  if(memory)assertMemoryScope(memory[1],resolver,ctx,actor,['GET','HEAD'].includes(method)?'read':'write');
  if(pathname==='/api/workers/tick')assertCorePermission(actor,'workers:manage');
  if(pathname==='/api/system/persist')assertCorePermission(actor,'persistence:manage');
  if(/^\/api\/connector-runtime\/profiles?(?:\/|$)/.test(pathname)&&!['GET','HEAD'].includes(method))assertCorePermission(actor,'connectors:profiles:manage');
  if(pathname==='/api/data/ingest'||/^\/api\/webhook\//.test(pathname)&&!['/api/webhook/meta','/api/webhook/whatsapp'].includes(pathname))assertCorePermission(actor,'events:write');
  // Read-only access to inventories does not confer connector configuration,
  // provider authorization, probe, sync, or disconnection authority.
  if(/^\/api\/(?:integration-(?:config|test|sync)\/|connector-runtime\/(?:config|test|sync)\/)/.test(pathname)&&!['GET','HEAD'].includes(method)||/^\/api\/connector-runtime\/oauth\/[^/]+\/(?:start|connect)$/.test(pathname)||/^\/api\/connect\/[^/]+(?:\/disconnect)?$/.test(pathname)||['/api/google/connect','/api/google/oauth/start','/api/google/disconnect'].includes(pathname))assertCorePermission(actor,'connectors:manage');
}
async function processOwnedQueue(eligible,actor,composed,process){
  const owned=eligible.filter(task=>!composed||task.owner_id===actor.id),processed=[];
  for(const task of owned.slice(0,10)){
    try{processed.push(await process(task));}
    catch(error){processed.push({id:task.id,status:'FAILED',code:String(error.code||'task_processing_failed').slice(0,100)});}
  }
  return {processed,ownerBlocked:eligible.length-owned.length};
}
module.exports={coreAllowed,assertCorePermission,assertMemoryScope,assertCoreRoute,privateRowVisible,processOwnedQueue};
