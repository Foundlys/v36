'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{fixture}=require('../zero-evaluation/crm-save-fixture');
function setup(){const f=fixture();f.actor.roles=['MANAGER'];const p=f.core.create(f.ctx,f.actor,'pipelines',{name:'Literal pipeline'}),s=f.core.create(f.ctx,f.actor,'stages',{name:'Literal stage',pipeline_id:p.id});return {...f,p,s,deal(data){return f.core.create(f.ctx,f.actor,'deals',{title:'Literal deal',pipeline_id:p.id,stage_id:s.id,...data});},board(){return f.core.pipelineBoard(f.ctx,f.actor,p.id);}};}
test('native CRM pipeline does not sum different currencies or treat missing values as observed zero',()=>{
 const f=setup();f.deal({value:12.34,currency:'USD'});f.deal({value:20,currency:'GBP'});let stage=f.board().stages[0];assert.equal(stage.value,null);assert.equal(stage.currency,null);assert.deepEqual(stage.value_groups,[{currency:'GBP',value:20},{currency:'USD',value:12.34}]);f.deal({});stage=f.board().stages[0];assert.equal(stage.value,null);assert.equal(stage.missing_value_count,1);
});
test('native CRM pipeline retains observed zero and explicit currency independently from missing values',()=>{
 const f=setup();f.deal({value:0,currency:'USD'});let stage=f.board().stages[0];assert.equal(stage.value,0);assert.equal(stage.currency,'USD');assert.equal(stage.missing_value_count,0);f.deal({});stage=f.board().stages[0];assert.equal(stage.value,null);assert.equal(stage.missing_value_count,1);
});
test('native CRM bounded pipeline reports incomplete source coverage instead of complete totals',()=>{
 const f=setup();for(let i=0;i<201;i++)f.deal({value:1,currency:'USD'});const board=f.board();assert.equal(board.coverage.deals.total,201);assert.equal(board.coverage.deals.returned,200);assert.equal(board.coverage.complete,false);assert.equal(board.stages[0].value,null);assert.equal(board.stages[0].totals_complete,false);
});
