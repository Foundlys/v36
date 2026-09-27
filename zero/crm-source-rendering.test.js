'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {fixture,CrmView}=require('../zero-evaluation/crm-dashboard-fixture');
const {locales}=require('../foundly-i18n');
test('CRM record source labels and dates follow all locales while literal content and action nodes survive',async()=>{
 const f=fixture();f.records.items[0].name='Literal <img> customer';await f.context.loadRecords();const row=f.nodes.recordRows.querySelector('tr'),edit=f.nodes.recordRows.querySelector('[data-edit]'),before=f.calls.length;
 assert.ok(row);assert.ok(edit);assert.equal(row.querySelector('strong').children.length,0);
 for(const locale of locales){f.i.setLocale(locale);assert.equal(f.nodes.recordRows.querySelector('tr'),row);assert.equal(f.nodes.recordRows.querySelector('[data-edit]'),edit);assert.equal(edit.textContent,f.i.t('crm.source.edit'));assert.ok(row.textContent.includes('Literal <img> customer'));assert.ok(row.textContent.includes(new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short',timeZone:'UTC'}).format(new Date(f.records.items[0].updated_at))));assert.equal(f.calls.length,before);}
});
test('CRM pipeline preserves unknown probabilities, missing money and explicit currencies without inventing euros',async()=>{
 const f=fixture(),stage=f.board.board.stages[0];stage.deals=[{id:'missing',title:'Literal missing',revision:1},{id:'zero',title:'Literal zero',revision:1,value:0,currency:'USD',probability:0},{id:'foreign',title:'Literal foreign',revision:1,value:12.34,currency:'GBP',probability:12.5}];stage.value=12.34;
 await f.context.loadPipelineBoard('literal_pipeline');const cards=f.nodes.pipelineBoard.querySelectorAll('.deal-card'),before=f.calls.length;assert.equal(cards.length,3);
 for(const locale of locales){f.i.setLocale(locale);assert.ok(cards[0].textContent.includes(f.i.t('common.unknown')));assert.ok(!cards[0].textContent.includes('%'));assert.ok(!f.nodes.pipelineBoard.textContent.includes('€'));assert.ok(cards[1].textContent.includes(new Intl.NumberFormat(locale,{style:'currency',currency:'USD',maximumFractionDigits:2}).format(0)));assert.ok(cards[1].textContent.includes(new Intl.NumberFormat(locale,{style:'percent',maximumFractionDigits:1}).format(0)));assert.ok(cards[2].textContent.includes(new Intl.NumberFormat(locale,{style:'percent',maximumFractionDigits:1}).format(.125)));assert.equal(f.nodes.pipelineBoard.querySelectorAll('.deal-card')[0],cards[0]);assert.equal(f.calls.length,before);assert.equal(f.i.missingKeys().length,0);}
});
test('CRM customer missing collections remain unavailable while observed empty and known counts stay distinct',async()=>{
 const f=fixture(),data=f.customer.customer;delete data.deals;delete data.history;delete data.consents;data.tasks=Array.from({length:1234},()=>({}));data.timeline=[{timeline_type:'tasks',title:'Literal <script> timeline',created_at:'2026-09-24T12:00:00Z'}];await f.context.openCustomer('literal_record');const node=f.nodes.customer360,before=f.calls.length;assert.ok(node.querySelector('section'));
 for(const locale of locales){f.i.setLocale(locale);assert.ok(node.textContent.includes(f.i.t('common.no_data')));assert.ok(node.textContent.includes(new Intl.NumberFormat(locale).format(1234)));assert.ok(!node.textContent.includes('NaN'));assert.ok(node.textContent.includes('Literal <script> timeline'));assert.equal(node.querySelector('script'),null);assert.equal(f.calls.length,before);assert.equal(f.i.missingKeys().length,0);}
});
test('CRM automation rendering translates known vocabulary and retains literal custom values',async()=>{
 const f=fixture();f.automations.items[0].trigger={type:'stage_change'};f.automations.items[0].actions=[{type:'task'},{type:'Literal <img> custom action'}];await f.context.loadAutomations();const node=f.nodes.automationList.querySelector('article'),before=f.calls.length;assert.ok(node);
 for(const locale of locales){f.i.setLocale(locale);assert.ok(node.textContent.includes(f.i.t('crm.source.trigger.stage_change')));assert.ok(node.textContent.includes(f.i.t('crm.source.action.task')));assert.ok(node.textContent.includes(f.i.t('crm.source.enabled')));assert.ok(node.textContent.includes('Literal <img> custom action'));assert.equal(node.querySelector('img'),null);assert.equal(f.calls.length,before);}
});
test('CRM record editor labels switch locale without resetting fields or changing its original entity',async()=>{
 const f=fixture(),form=f.nodes.recordForm;form.elements=Object.fromEntries(['name','id','revision'].map(k=>[k,new CrmView('input')]));form.append(...Object.values(form.elements));f.context.openRecordDialog(null,'tasks');form.elements.name.value='Literal authored task';const before=f.calls.length;
 for(const locale of locales){f.i.setLocale(locale);assert.ok(f.nodes.dialogTitle.textContent.includes(f.i.t('crm.source.new')));assert.ok(f.nodes.dialogTitle.textContent.includes(f.i.t('crm.source.entity.tasks')));assert.equal(form.elements.name.getAttribute('placeholder'),f.i.t('crm.source.field.title'));assert.equal(form.elements.name.value,'Literal authored task');assert.equal(form.elements.name.dataset.field,'title');assert.equal(f.calls.length,before);}
});
test('CRM empty views and missing pipeline collections retain explicit localized states',async()=>{
 const f=fixture();f.records.items=[];f.automations.items=[];f.board.board.stages[0].deals=null;await f.context.loadRecords();await f.context.loadAutomations();await f.context.loadPipelineBoard('literal_pipeline');const before=f.calls.length;
 for(const locale of locales){f.i.setLocale(locale);assert.equal(f.nodes.recordEmpty.textContent,f.i.t('crm.source.records_empty'));assert.equal(f.nodes.automationList.textContent,f.i.t('crm.source.automations_empty'));assert.ok(f.nodes.pipelineBoard.textContent.includes(f.i.t('common.no_data')));assert.equal(f.calls.length,before);}
});
test('CRM source record counts remain readable across locale changes without double formatting',async()=>{
 const f=fixture();await f.context.loadStatus();await f.context.loadDashboard();
 for(const locale of locales){f.i.setLocale(locale);const expected=new Intl.NumberFormat(locale).format(1234);assert.ok(f.nodes.crmConnection.textContent.includes(expected));assert.ok(!f.nodes.widgetGrid.textContent.includes('NaN'));assert.ok(!f.nodes.crmConnection.textContent.includes('NaN'));}
});
test('CRM schema observation distinguishes missing counts and policy from recorded schema across locales',async()=>{
 const f=fixture();await f.context.loadSchema();for(const locale of locales){f.i.setLocale(locale);assert.ok(f.nodes.schemaSummary.textContent.includes(f.i.t('common.unknown')));assert.ok(!f.nodes.schemaSummary.textContent.includes('0'));}
 const g=fixture(),native=g.context.fetch;g.context.fetch=(path,options)=>path==='/api/crm/schema'?Promise.resolve({ok:true,status:200,text:async()=>JSON.stringify({entities:{leads:{}},dashboard_widget_types:['KPI'],contracts:{external_writes:'never_without_explicit_authorization_and_connector'}})}):native(path,options);await g.context.loadSchema();const before=g.calls.length;
 for(const locale of locales){g.i.setLocale(locale);assert.ok(g.nodes.schemaSummary.textContent.includes(g.i.t('crm.source.schema_external_policy')));assert.ok(g.nodes.schemaSummary.textContent.includes(g.i.t('crm.dashboard.type.KPI')));assert.equal(g.calls.length,before);}
});
test('native CRM customer profile excludes linked companies outside current record access',()=>{
 const {fixture:storage}=require('../zero-evaluation/crm-save-fixture'),f=storage(),manager={id:'manager',roles:['MANAGER']};const company=f.core.create(f.ctx,manager,'companies',{name:'PRIVATE other company',owner_id:'other_owner'}),lead=f.core.create(f.ctx,manager,'leads',{name:'Readable lead',owner_id:f.actor.id,company_id:company.id});const view=f.core.customer360(f.ctx,f.actor,lead.id);assert.equal(view.subject.id,lead.id);assert.equal(view.companies.length,0);assert.ok(!JSON.stringify(view).includes('PRIVATE other company'));
 const allowed=f.core.customer360(f.ctx,manager,lead.id);assert.equal(allowed.companies[0].name,company.name);
});
