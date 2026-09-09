'use strict';
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FoundlyFinanceLoading=api;})(globalThis,()=>{
  async function load(api,inputParams){
    const {resolution}=await api('/api/composition');if(!resolution.visible_modules.includes('finance'))throw Object.assign(new Error('Finance is niet beschikbaar voor deze gebruiker'),{status:403});
    const caps=new Set(resolution.capabilities),params=new URLSearchParams(inputParams),components={},result={components,entities:[],status:null,dashboard:null,reports:null};
    async function part(name,path,enabled,apply){if(!enabled){components[name]={status:'DISABLED'};return;}try{const value=await api(path);apply(value);components[name]={status:'AVAILABLE'};}catch(error){components[name]={status:'ERROR',message:error.message,status_code:error.status||null};}}
    await Promise.all([part('status','/api/finance/status',true,value=>{result.status=value;}),part('entities','/api/finance/records/legal_entities?limit=100',caps.has('finance:ledger'),value=>{result.entities=value.items||[];})]);
    if(!params.get('legal_entity_id')&&result.entities.length===1)params.set('legal_entity_id',result.entities[0].id);
    result.selected_entity_id=params.get('legal_entity_id')||'';
    await Promise.all([part('dashboard','/api/finance/dashboard?'+params,caps.has('finance:reports'),value=>{result.dashboard=value;}),part('reports','/api/finance/reports?'+params,caps.has('finance:reports'),value=>{result.reports=value;})]);
    result.loading_status=Object.values(components).some(row=>row.status==='ERROR')?'PARTIAL':'AVAILABLE';return result;
  }
  return {load};
});
