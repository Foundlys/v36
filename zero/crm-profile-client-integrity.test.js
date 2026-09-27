'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{fixture}=require('../zero-evaluation/crm-profile-fixture'),{locales}=require('../foundly-i18n');
test('CRM malformed profile success cannot discard the frozen original request',async()=>{
 const f=fixture();f.malformed();await assert.rejects(f.submit(),/response unavailable/);const before=f.calls.length;for(const locale of locales){f.i.setLocale(locale);assert.equal(f.form.elements.business_name.value,'Literal private business');assert.equal(f.form.elements.business_name.disabled,true);assert.equal(f.calls.length,before);}await f.submit();assert.deepEqual(f.writes[1],f.writes[0]);assert.equal(f.native.core.list(f.native.ctx,f.native.actor,'pipelines').total,1);assert.equal(f.form.elements.business_name.value,'');
});
test('CRM denied profile source clears private inputs, pending request and notice',async()=>{
 const f=fixture();f.lose();await assert.rejects(f.submit());f.native.actor.roles=['VIEWER'];await assert.rejects(f.submit());assert.equal(f.form.elements.business_name.value,'');assert.ok(!f.form.textContent.includes('Literal private'));f.native.actor.roles=['MANAGER'];assert.equal(f.form.querySelector('button[type="submit"]').disabled,false);await f.submit();assert.equal(f.writes.length,2);
});
test('CRM late committed profile response cannot reset or disclose after access denial',async()=>{
 const f=fixture(),release=f.hold(),pending=f.submit();await release.started;f.native.actor.roles=[];await assert.rejects(f.context.loadStatus());release();await pending;assert.equal(f.form.elements.business_name.value,'');assert.ok(!f.form.textContent.includes('Literal private'));assert.ok(!f.form.textContent.includes('created'));assert.equal(f.writes.length,1);
});
test('CRM confirmed profile remains confirmed after source refresh fails',async()=>{
 const f=fixture();f.errors.set('/api/crm/status',503);await f.submit();const before=f.calls.length;for(const locale of locales){f.i.setLocale(locale);assert.ok(f.form.textContent.includes(f.i.t('crm.dashboard.saved_refresh_failed')));assert.equal(f.form.elements.business_name.value,'');assert.equal(f.calls.length,before);}assert.equal(f.native.core.list(f.native.ctx,f.native.actor,'stages').total,6);
});
