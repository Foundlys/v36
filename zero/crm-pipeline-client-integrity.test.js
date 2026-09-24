'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{fixture}=require('../zero-evaluation/crm-pipeline-fixture'),{locales}=require('../foundly-i18n');
test('CRM denied pipeline construction clears its private source form and prevents late stage writes',async()=>{
 const f=fixture(),release=f.hold(),pending=f.submit();await release.started;f.native.actor.roles=[];await assert.rejects(f.context.loadStatus());f.native.actor.roles=['MANAGER'];release();await pending;assert.equal(f.writes.length,1);assert.equal(f.nodes.pipelineDialog.open,false);assert.equal(f.form.elements.name.value,'');assert.equal(f.nodes.pipelineStages.textContent,'');assert.ok(!f.nodes.toast.textContent.includes('created'));assert.equal(f.native.core.list(f.native.ctx,f.native.actor,'stages').total,0);assert.equal(f.form.querySelector('button[type="submit"]').disabled,false);
});
test('CRM malformed pipeline response remains unconfirmed and retries the identical pipeline before any stage write',async()=>{
 const f=fixture();f.malformed();await assert.rejects(f.submit(),/response unavailable/);assert.equal(f.writes.length,1);const before=f.calls.length;for(const locale of locales){f.i.setLocale(locale);assert.equal(f.form.elements.name.value,'Literal private pipeline');assert.equal(f.calls.length,before);}await f.submit();assert.deepEqual(f.writes[1],f.writes[0]);assert.equal(f.native.core.list(f.native.ctx,f.native.actor,'pipelines').total,1);assert.equal(f.native.core.list(f.native.ctx,f.native.actor,'stages').total,6);
});
test('CRM completed pipeline remains confirmed if the subsequent source refresh fails',async()=>{
 const f=fixture();f.errors.set('/api/crm/pipelines?limit=200&sort=updated_at&order=desc',503);await f.submit();for(const locale of locales){f.i.setLocale(locale);assert.equal(f.nodes.toast.textContent,f.i.t('crm.dashboard.saved_refresh_failed'));}assert.equal(f.nodes.pipelineDialog.open,false);assert.equal(f.native.core.list(f.native.ctx,f.native.actor,'stages').total,6);
});
test('CRM malformed stage acknowledgement pauses construction until its exact stage request is retried',async()=>{
 const f=fixture();f.malformed('stages');await assert.rejects(f.submit(),/response unavailable/);assert.equal(f.writes.length,2);await f.submit();assert.deepEqual(f.writes[2],f.writes[0]);assert.deepEqual(f.writes[3],f.writes[1]);assert.equal(f.native.core.list(f.native.ctx,f.native.actor,'pipelines').total,1);assert.equal(f.native.core.list(f.native.ctx,f.native.actor,'stages').total,6);
});
