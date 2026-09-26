'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{fixture}=require('../zero-evaluation/crm-objects-fixture');
test('CRM object explicit refresh rechecks current access and clears a dirty private editor on denial',async()=>{
 const f=await fixture();await f.button('Record bewerken').fire('click');const input=f.field('Private literal title'),form=input.closest('form');input.value='Private authored correction';await form.fire('input');const before=f.calls.length;f.deny();await f.box.refresh();assert.ok(f.calls.length>before);assert.ok(!f.box.textContent.includes('Private literal'));assert.equal(f.box.all().filter(n=>n.tag==='input'&&String(n.value).includes('Private')).length,0);
});
test('CRM object uncertain save retries the original body after draft fields change',async()=>{
 const f=await fixture();await f.button('Record bewerken').fire('click');const input=f.field('Private literal title'),form=input.closest('form');input.value='Original committed correction';await form.fire('input');f.lose();await form.fire('submit');input.value='Must not replace unconfirmed request';await form.fire('submit');assert.equal(f.writes.length,2);assert.deepEqual(f.writes[1],f.writes[0]);assert.equal(f.core.listRecords(f.ctx,f.actor,f.definition.id).items[0].revision,2);
});
test('CRM object new money field does not invent a source currency',async()=>{
 const f=await fixture();await f.button('Nieuw objectrecord').fire('click');assert.equal(f.field('Private literal amount (valutacode)').value,'');
});
test('CRM object late export cannot release private source after a newer denied refresh',async()=>{
 const f=await fixture(),release=f.hold('/export'),pending=f.button('Objecten exporteren').fire('click');await release.started;f.deny();await f.box.refresh();release();await pending;assert.equal(f.exported.length,0);
});
test('CRM object successful refresh also retires a private editor when the current catalog no longer permits its source',async()=>{
 const f=await fixture();await f.button('Record bewerken').fire('click');const input=f.field('Private literal title');input.value='Private correction';await input.closest('form').fire('input');f.actor.id='other_actor';f.actor.roles=['SALES'];await f.box.refresh();assert.ok(!f.box.textContent.includes('Private literal'));assert.equal(f.box.all().filter(n=>n.tag==='input'&&String(n.value).includes('Private')).length,0);
});
test('native CRM object access changes replay the exact authorized request without revising access twice',async()=>{
 const f=await fixture(),input={team_id:'literal_team',expected_revision:f.record.revision,confirm:true,reason:'Literal access reason'},first=f.core.setAccess(f.ctx,f.actor,'records',f.record.id,input),replay=f.core.setAccess(f.ctx,f.actor,'records',f.record.id,input);assert.equal(replay.deduplicated,true);assert.equal(replay.revision,first.revision);assert.equal(replay.team_id,first.team_id);
});
test('native CRM object linked-source history retains explicit grants through source rechecks',()=>{
 const {FoundlyCrmCore}=require('../crm-core'),{CrmObjects}=require('../crm-objects'),{CapabilityResolver}=require('../capability-resolver'),state=new Map(),ctx={tenant_id:'objects_grants',dealer_id:'default'},actor={id:'explicit_object_actor',roles:[],permissions:['crm:read','crm:write','crm:manage','crm:read_all','crm:write_all']};const adapter={bucket(c,s){const key=JSON.stringify([c,s]);if(!state.has(key))state.set(key,[]);return state.get(key);},persist(){},audit(){}},resolver=new CapabilityResolver(adapter);resolver.configure(ctx,{id:'bootstrap',roles:['ADMIN','SUPER_ADMIN']},{entitlements:['crm'],expected_revision:0});const native=new FoundlyCrmCore(adapter);adapter.readRelated=(c,a,e,id)=>native.get(c,a,e,id);const objects=new CrmObjects(adapter,resolver),lead=native.create(ctx,actor,'leads',{name:'Explicit grant lead'});objects.saveDefinition(ctx,actor,'explicit-definition',{definition:{key:'explicit_fields',name:'Explicit fields',version:1,record_entity:'leads',fields:[{key:'title',label:'Title',type:'TEXT',required:true}]},expected_revision:0});objects.saveRecord(ctx,actor,'explicit-record',{object_id:'explicit-definition',schema_revision:1,expected_revision:0,native_record_id:lead.id,values:{title:'Literal explicit value'}});assert.equal(objects.history(ctx,actor,'explicit-record').items[0].values.title,'Literal explicit value');
});
