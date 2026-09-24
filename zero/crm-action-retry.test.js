'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{fixture}=require('../zero-evaluation/crm-action-fixture'),{locales}=require('../foundly-i18n');
test('CRM archive retries its exact committed request across all locales',async()=>{
 const f=await fixture();f.lose();await assert.rejects(f.context.archiveRecord(f.record.id),/Lost committed action response/);const before=f.calls.length;for(const locale of locales)f.i.setLocale(locale);assert.equal(f.calls.length,before);await f.context.archiveRecord(f.record.id);assert.deepEqual(f.writes[1],f.writes[0]);assert.equal(f.confirmations(),1);assert.equal(f.native.core.list(f.native.ctx,f.native.actor,'leads').total,0);assert.equal(f.native.core.collection(f.native.ctx,'audit_events').filter(row=>row.action==='DELETE').length,1);
});
test('CRM archive blocks overlapping submission while its reply is pending',async()=>{
 const f=await fixture(),release=f.hold(),pending=f.context.archiveRecord(f.record.id);await release.started;await Promise.allSettled([f.context.archiveRecord(f.record.id)]);release();await pending;assert.equal(f.writes.length,1);assert.equal(f.confirmations(),1);
});
test('CRM stage drag retries its exact committed target and event without duplicate effects',async()=>{
 const f=await fixture();f.lose();await f.drop();const before=f.calls.length;for(const locale of locales)f.i.setLocale(locale);assert.equal(f.calls.length,before);await f.drop();assert.deepEqual(f.writes[1],f.writes[0]);assert.equal(f.native.core.list(f.native.ctx,f.native.actor,'tasks').total,1);assert.equal(f.native.core.get(f.native.ctx,f.native.actor,'deals',f.deal.id).stage_history.length,1);
});
test('CRM stage drag blocks overlapping drops while its reply is pending',async()=>{
 const f=await fixture(),release=f.hold(),pending=f.drop();await release.started;await f.drop();release();await pending;assert.equal(f.writes.length,1);
});
test('CRM archive retains a visible retry after the archived source disappears and entity selection changes',async()=>{
 const f=await fixture();f.lose();await assert.rejects(f.context.archiveRecord(f.record.id));await f.context.loadRecords();const notice=f.nodes.recordActionNotice,button=notice.querySelector('button');assert.ok(button);assert.ok(notice.textContent.includes(f.record.name));const other=f.native.core.create(f.native.ctx,f.native.actor,'contacts',{name:'Different literal contact'});f.nodes.recordEntity.value='contacts';await f.context.loadRecords();await f.context.archiveRecord(other.id);assert.equal(f.writes.length,1);const calls=f.calls.length;for(const locale of locales){f.i.setLocale(locale);assert.ok(button.textContent.length>0);assert.ok(notice.textContent.includes(f.record.name));assert.equal(notice.querySelector('button'),button);}assert.equal(f.calls.length,calls);await button.onclick();assert.deepEqual(f.writes[1],f.writes[0]);assert.equal(f.native.core.list(f.native.ctx,f.native.actor,'contacts').total,1);assert.equal(notice.querySelector('button'),null);
});
test('CRM stage retains its original target when a pending move is retried after source refresh',async()=>{
 const f=await fixture();f.lose();await f.drop();const button=f.nodes.pipelineActionNotice.querySelector('button');assert.ok(button);await f.context.loadPipelineBoard(f.pipeline.id);await button.onclick();assert.deepEqual(f.writes[1],f.writes[0]);assert.equal(f.native.core.list(f.native.ctx,f.native.actor,'tasks').total,1);assert.equal(f.native.core.get(f.native.ctx,f.native.actor,'deals',f.deal.id).revision,2);
});
test('CRM pending stage move cannot be replaced by a drop onto a different target',async()=>{
 const f=await fixture();f.lose();await f.drop();await f.drop(f.first.id);assert.equal(f.writes.length,1);await f.nodes.pipelineActionNotice.querySelector('button').onclick();assert.deepEqual(f.writes[1],f.writes[0]);assert.equal(f.native.core.get(f.native.ctx,f.native.actor,'deals',f.deal.id).stage_id,f.next.id);
});
test('CRM malformed archive and stage success replies stay unconfirmed until their exact request is replayed',async()=>{
 for(const kind of ['archive','stage']){const f=await fixture();f.malformed();if(kind==='archive')await assert.rejects(f.context.archiveRecord(f.record.id),/response unavailable/);else await f.drop();const host=f.nodes[kind==='archive'?'recordActionNotice':'pipelineActionNotice'];assert.ok(host.querySelector('button'));await host.querySelector('button').onclick();assert.deepEqual(f.writes[1],f.writes[0]);assert.equal(host.querySelector('button'),null);}
});
test('CRM confirmed action remains confirmed when its subsequent source refresh fails',async()=>{
 for(const kind of ['archive','stage']){const f=await fixture();f.errors.set(kind==='archive'?'/api/crm/status':'/api/crm/pipelines/'+f.pipeline.id+'/board',503);if(kind==='archive')await f.context.archiveRecord(f.record.id);else await f.drop();const host=f.nodes[kind==='archive'?'recordActionNotice':'pipelineActionNotice'];assert.equal(host.querySelector('button'),null);assert.ok(host.textContent.includes('could not refresh'));assert.equal(f.writes.length,1);}
});
test('CRM action denial clears frozen private requests and detached retry buttons cannot resubmit',async()=>{
 for(const kind of ['archive','stage']){const f=await fixture();f.lose();if(kind==='archive')await assert.rejects(f.context.archiveRecord(f.record.id));else await f.drop();const host=f.nodes[kind==='archive'?'recordActionNotice':'pipelineActionNotice'],button=host.querySelector('button');f.native.actor.roles=[];await assert.rejects(f.context.loadStatus());assert.equal(host.textContent,'');await button.onclick();assert.equal(f.writes.length,1);assert.equal(f.nodes.pipelineBoard.textContent,'');assert.equal(f.nodes.recordRows.textContent,'');}
});
test('CRM late committed action replies cannot restore private notices after access is denied',async()=>{
 for(const kind of ['archive','stage']){const f=await fixture(),release=f.hold(),pending=kind==='archive'?f.context.archiveRecord(f.record.id):f.drop();await release.started;f.native.actor.roles=[];await assert.rejects(f.context.loadStatus());release();await pending;assert.equal(f.nodes.recordActionNotice.textContent,'');assert.equal(f.nodes.pipelineActionNotice.textContent,'');assert.equal(f.nodes.recordRows.textContent,'');assert.equal(f.nodes.pipelineBoard.textContent,'');}
});
test('CRM definitive archive revision rejection permits a corrected fresh request',async()=>{
 const f=await fixture();f.native.core.update(f.native.ctx,f.native.actor,'leads',f.record.id,{name:'Literal newer version'});await assert.rejects(f.context.archiveRecord(f.record.id),e=>e.status===409);assert.equal(f.nodes.recordActionNotice.querySelector('button'),null);await f.context.loadRecords();await f.context.archiveRecord(f.record.id);assert.notEqual(f.writes[1].options.headers['idempotency-key'],f.writes[0].options.headers['idempotency-key']);assert.equal(f.writes[1].options.headers['if-match'],'"2"');assert.equal(f.native.core.list(f.native.ctx,f.native.actor,'leads').total,0);
});
