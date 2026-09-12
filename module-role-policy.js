'use strict';
// The manifest and resolver share this existing module-role policy. Domain
// engines retain their own record-level permission checks.
const ROLE_IDS=Object.freeze(['ADMIN','FOUNDER','SUPER_ADMIN','MANAGER','FINANCE_ADMIN','APPROVER','ANALYST','VIEWER','SALES','ACCOUNTANT','MARKETING']);
const FIXED=Object.freeze({
  ADMIN:['*'],FOUNDER:['*'],SUPER_ADMIN:['*'],
  FINANCE_ADMIN:['finance:read','finance:write','finance:approve','finance:export'],
  APPROVER:['finance:read','finance:approve'],ANALYST:['analysis:read','finance:read'],
  SALES:['crm:read','crm:write','sales:read','sales:write','calendar:read','calendar:write','communication:read','communication:write'],
  ACCOUNTANT:['finance:read','finance:write','finance:export'],
  MARKETING:['crm:read','crm:write','marketing:read','marketing:write','analysis:read']
});
for(const row of Object.values(FIXED))Object.freeze(row);
function roleGrants(role,moduleIds){
  role=String(role).toUpperCase();
  if(role==='MANAGER')return moduleIds.filter(id=>id!=='finance').flatMap(id=>[`${id}:read`,`${id}:write`,`${id}:export`]);
  if(role==='VIEWER')return moduleIds.map(id=>`${id}:read`);
  return Object.hasOwn(FIXED,role)?FIXED[role]:[];
}
function roleContract(moduleId,moduleIds){return Object.fromEntries(ROLE_IDS.map(role=>[role,roleGrants(role,moduleIds).filter(grant=>grant==='*'||grant.startsWith(moduleId+':'))]).filter(([,grants])=>grants.length));}
module.exports={ROLE_IDS,roleGrants,roleContract};
