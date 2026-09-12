'use strict';
const assert=require('node:assert/strict');
const {load}=require('./finance-loading');
(async()=>{
 let caps=['finance:reports'],calls=[],failEntities=false;const api=async path=>{calls.push(path);if(path==='/api/composition')return {resolution:{visible_modules:['finance'],capabilities:caps}};if(path.startsWith('/api/finance/records/legal_entities')){if(failEntities)throw Object.assign(new Error('Fixture entity lookup failed'),{status:503});return {items:[{id:'entity-a',name:'Fixture entity'}]};}if(path.startsWith('/api/finance/reports'))return {general_ledger:{entries:[]},observed_at:'2026-09-09T00:00:00Z'};return {};};
 let result=await load(api,new URLSearchParams({legal_entity_id:'existing-filter'}));assert.equal(result.components.entities.status,'DISABLED');assert.equal(result.components.reports.status,'AVAILABLE');assert.equal(result.selected_entity_id,'existing-filter');assert.ok(!calls.some(path=>path.includes('/records/')));assert.ok(calls.some(path=>path.includes('legal_entity_id=existing-filter')));
 caps=['finance:reports','finance:ledger'];failEntities=true;result=await load(api,new URLSearchParams({legal_entity_id:'retained-filter'}));assert.equal(result.loading_status,'PARTIAL');assert.equal(result.components.reports.status,'AVAILABLE');assert.equal(result.selected_entity_id,'retained-filter');
 failEntities=false;result=await load(api,new URLSearchParams());assert.equal(result.selected_entity_id,'entity-a');
 calls=[];caps=['finance:ledger'];result=await load(api,new URLSearchParams());assert.equal(result.components.reports.status,'DISABLED');assert.equal(result.reports,null);assert.ok(!calls.some(path=>/reports|dashboard/.test(path)));
 console.log('PASS Finance report loading without ledger lookup, failure isolation, preserved entity filters and explicit disabled report state');
})().catch(error=>{console.error(error);process.exitCode=1;});
