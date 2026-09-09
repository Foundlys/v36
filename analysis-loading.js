'use strict';
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FoundlyAnalysisLoading=api;})(globalThis,()=>{
  async function load(api,params,kpiIds){
    const {resolution}=await api('/api/composition');
    if(!resolution.visible_modules.includes('analysis'))throw Object.assign(new Error('Analytics is niet beschikbaar voor deze gebruiker'),{status:403});
    const caps=new Set(resolution.capabilities),components={},dashboard={kpis:{}},result={dashboard,components,platform:null,connectors:null,automation:null,events_enabled:caps.has('analysis:events'),cohorts_enabled:caps.has('analysis:events')&&caps.has('analysis:reports')};
    async function fetchPart(name,path,enabled,apply){if(!enabled){components[name]={status:'DISABLED'};return;}try{const value=await api(path);apply(value);components[name]={status:'AVAILABLE'};}catch(error){components[name]={status:'ERROR',message:error.message,status_code:error.status||null};}}
    const operations=[fetchPart('platform','/api/platform/status',true,value=>{result.platform=value;}),fetchPart('connectors','/api/platform/connectors',true,value=>{result.connectors=value;}),fetchPart('automation','/api/automation/status',resolution.visible_modules.includes('automation')&&caps.has('automation:workflows')&&caps.has('automation:runs'),value=>{result.automation=value;})];
    if(['kpis','events','funnel','reports'].every(name=>caps.has('analysis:'+name))){
      operations.push(fetchPart('dashboard','/api/analysis/dashboard?'+params,true,value=>Object.assign(dashboard,value)));
    }else{
      operations.push(fetchPart('realtime','/api/analysis/realtime?'+params,caps.has('analysis:events'),value=>{dashboard.realtime=value;}),fetchPart('historical','/api/analysis/historical?'+params,caps.has('analysis:events'),value=>{dashboard.historical=value;}),fetchPart('funnel','/api/analysis/funnel?'+params,caps.has('analysis:funnel'),value=>{dashboard.funnel=value;}));
      for(const id of kpiIds)operations.push(fetchPart('kpi:'+id,'/api/analysis/kpis/'+encodeURIComponent(id)+'?'+params,caps.has('analysis:kpis'),value=>{dashboard.kpis[id]=value;}));
    }
    await Promise.all(operations);
    if(components.dashboard)for(const name of ['realtime','historical','funnel',...kpiIds.map(id=>'kpi:'+id)])components[name]=components.dashboard;
    result.status=Object.values(components).some(row=>row.status==='ERROR')?'PARTIAL':'AVAILABLE';
    result.observed_at=dashboard.observed_at||dashboard.realtime?.observed_at||dashboard.historical?.observed_at||null;
    return result;
  }
  return {load};
});
