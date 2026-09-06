'use strict';
function authorizeDashboard(actor,scope,qualifier,operation='read'){
  const roles=(actor.roles||[]).map(value=>String(value).toUpperCase()),admin=roles.some(role=>['ADMIN','FOUNDER','SUPER_ADMIN'].includes(role));
  const fail=code=>{throw Object.assign(new Error('Dashboard is niet beschikbaar voor deze gebruiker'),{statusCode:403,code});};
  if(!['PERSONAL','TEAM','ROLE','PRESET'].includes(scope))fail('dashboard_scope_invalid');
  if(scope==='PERSONAL')return;
  if(scope==='PRESET'){if(operation!=='read'&&!admin)fail('dashboard_preset_forbidden');return;}
  if(!qualifier)fail('dashboard_scope_qualifier_required');
  if(scope==='TEAM'&&!admin&&(!(actor.team_ids||[]).includes(qualifier)||operation!=='read'&&!roles.includes('MANAGER')))fail('dashboard_team_forbidden');
  if(scope==='ROLE'&&!admin&&(operation!=='read'||!roles.includes(String(qualifier).toUpperCase())))fail('dashboard_role_forbidden');
}
module.exports={authorizeDashboard};
