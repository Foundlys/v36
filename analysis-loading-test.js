'use strict';
const assert=require('node:assert/strict');
const {load}=require('./analysis-loading');
(async()=>{
 let calls=[],autoFailure=false;let capabilities=['analysis:kpis','analysis:events','analysis:funnel','analysis:reports'],modules=['analysis'];
 const api=async path=>{calls.push(path);if(path==='/api/composition')return {resolution:{visible_modules:modules,capabilities}};if(path==='/api/automation/status'){if(autoFailure)throw Object.assign(new Error('Fixture Automation unavailable'),{status:503});return {workflow_count:2};}if(path.startsWith('/api/analysis/dashboard'))return {kpis:{win_rate:{available:true,value:50}},funnel:{events:2,stages:[]},realtime:{events:2},observed_at:'2026-09-09T00:00:00Z'};if(path.includes('/kpis/'))return {available:false,value:null};return {};};
 let result=await load(api,new URLSearchParams(),['win_rate']);assert.equal(result.dashboard.kpis.win_rate.value,50);assert.equal(result.components.automation.status,'DISABLED');assert.ok(!calls.includes('/api/automation/status'));
 modules=['analysis','automation'];capabilities.push('automation:workflows','automation:runs');autoFailure=true;result=await load(api,new URLSearchParams(),['win_rate']);assert.equal(result.status,'PARTIAL');assert.equal(result.dashboard.kpis.win_rate.value,50);assert.equal(result.components.automation.status,'ERROR');assert.equal(result.automation,null);
 calls=[];capabilities=['analysis:kpis'];result=await load(api,new URLSearchParams(),['win_rate']);assert.equal(result.events_enabled,false);assert.equal(result.components.realtime.status,'DISABLED');assert.ok(!calls.some(path=>/dashboard|realtime|historical|funnel|automation/.test(path)));assert.equal(result.dashboard.kpis.win_rate.value,null);
 modules=[];await assert.rejects(load(api,new URLSearchParams(),['win_rate']),{status:403});
 console.log('PASS standalone Analytics loading, optional Automation failure isolation, capability-specific requests and explicit unavailable component states');
})().catch(error=>{console.error(error);process.exitCode=1;});
