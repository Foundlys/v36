'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{fixture}=require('../zero-evaluation/workflow-inspector-fixture'),{locales}=require('../foundly-i18n');
test('native retained-run explanations follow eight locales without replacing the selected step, literal workflow name or causing writes',async()=>{
 const f=fixture(),before=f.counts();await f.button().fire('click');const select=f.select(),requests=f.calls.length;assert.ok(select);for(const locale of locales){f.i.setLocale(locale);assert.equal(f.button().textContent,f.i.t('workflow.inspector.inspect'));assert.ok(f.select()===select);assert.equal(select.value,'1');assert.ok(f.box.textContent.includes('Literal <img> workflow'));assert.ok(f.box.textContent.includes(f.i.t('workflow.inspector.and')));assert.ok(f.box.textContent.includes(f.i.number(1234)));assert.ok(!f.box.textContent.includes('Do not expose unused inputs'));assert.equal(f.calls.length,requests);assert.equal(f.i.missingKeys().length,0);}assert.deepEqual(f.counts(),before);assert.ok(f.box.querySelector('img')===null);
});
test('current inspection errors remove private observations and expose only localized safe copy',async()=>{
 const f=fixture();await f.button().fire('click');f.deny();await f.button().fire('click');assert.ok(f.box.querySelector('h4')===null);assert.ok(!f.box.textContent.includes('RAW_PRIVATE_PROVIDER_FAILURE'));for(const locale of locales){f.i.setLocale(locale);assert.equal(f.box.querySelector('output').textContent,f.i.t('common.access_denied'));}
});
test('malformed or contradictory retained condition evidence is rejected before it can imply truth, completion or execution',async()=>{
 const f=fixture(),valid=f.core.inspectAutomationRun(f.ctx,f.actor,f.run.run_id),before=f.counts();
 for(const mutate of [data=>data.selected.condition.matched='false',data=>data.selected.attempts='1',data=>data.selected.condition.children[0].actual.present='false',data=>data.selected.condition.children[0].actual.value='true',data=>data.request_signature='f'.repeat(64),data=>data.steps[1].status='SUCCEEDED',data=>data.outcome_reverified=true]){const data=JSON.parse(JSON.stringify(valid));mutate(data);f.override(data);await f.button().fire('click');assert.ok(f.box.querySelector('h4')===null,'Contradictory data must not produce a retained-run summary');assert.ok(f.select()===null);}
 assert.deepEqual(f.counts(),before);
});
test('a requested step must match the reply, and retired inspection controls issue no new read',async()=>{
 const f=fixture();await f.button().fire('click');const old=f.core.inspectAutomationRun(f.ctx,f.actor,f.run.run_id);f.override(old);f.select().value='0';await f.select().fire('change');assert.ok(f.box.querySelector('h4')===null);const calls=f.calls.length;f.retire();await f.button().fire('click');assert.equal(f.calls.length,calls);
});
test('rapid step changes keep only the newest requested result while locales change and old controls retire',async()=>{
 const f=fixture(),before=f.counts();await f.button().fire('click');const oldSelect=f.select(),release=f.hold();oldSelect.value='0';const pending=oldSelect.fire('change');await release.started;assert.ok(f.box.querySelector('h4')===null);f.i.setLocale('fr-FR');oldSelect.value='1';await oldSelect.fire('change');const current=f.select();assert.equal(current.value,'1');const requests=f.calls.length;release();await pending;assert.equal(f.select(),current);assert.equal(f.select().value,'1');assert.ok(f.box.textContent.includes(f.i.t('workflow.inspector.and')));oldSelect.value='0';await oldSelect.fire('change');assert.equal(f.calls.length,requests);assert.deepEqual(f.counts(),before);
});
test('current access denial clears observations and an earlier successful read cannot restore them',async()=>{
 const f=fixture(),before=f.counts();await f.button().fire('click');const select=f.select(),release=f.hold();select.value='0';const pending=select.fire('change');await release.started;f.deny();select.value='1';await select.fire('change');assert.ok(f.select()===null);assert.ok(f.box.querySelector('h4')===null);release();await pending;f.i.setLocale('de-DE');assert.equal(f.box.querySelector('output').textContent,f.i.t('common.access_denied'));assert.ok(!f.box.textContent.includes('Literal <img> workflow'));assert.deepEqual(f.counts(),before);
});
test('navigation away and back creates an independent read view and suppresses the earlier pending result',async()=>{
 const f=fixture(),before=f.counts(),release=f.hold();const pending=f.button().fire('click');await release.started;f.retire();const next=f.reopen();await next.querySelector('button').fire('click');const selection=next.querySelector('select');release();await pending;assert.ok(f.box.querySelector('h4')===null);assert.ok(next.querySelector('select')===selection);assert.equal(selection.value,'1');f.i.setLocale('sv-SE');assert.equal(next.querySelector('button').textContent,f.i.t('workflow.inspector.inspect'));assert.deepEqual(f.counts(),before);
});
test('missing results and mismatched run, workflow and version identities remain unverified',async()=>{
 const f=fixture(),before=f.counts(),valid=f.core.inspectAutomationRun(f.ctx,f.actor,f.run.run_id);
 for(const data of [null,{}, {...valid,selected:null},{...valid,run_id:'another_run'},{...valid,workflow_id:'another_workflow'},{...valid,workflow_version:valid.workflow_version+1}]){f.override(data);await f.button().fire('click');assert.ok(f.box.querySelector('h4')===null);assert.ok(f.select()===null);assert.equal(f.box.querySelector('output').textContent,f.i.t('workflow.inspector.invalid'));}
 assert.deepEqual(f.counts(),before);
});
test('provider failures and expired sessions use safe localized feedback without a fabricated result',async()=>{
 const f=fixture(),before=f.counts();for(const status of [500,401]){f.deny(status);await f.button().fire('click');for(const locale of locales){f.i.setLocale(locale);assert.equal(f.box.querySelector('output').textContent,f.i.t(status===401?'identity.auth_required':'workflow.inspector.failed'));assert.ok(!f.box.textContent.includes('RAW_PRIVATE'));}assert.ok(f.select()===null);}assert.deepEqual(f.counts(),before);
});
test('retained action diagnostics remain in native state and are not exposed as user-facing errors or retried by inspection',async()=>{
 const f=fixture({failing:true}),before=f.counts(),native=f.core.inspectAutomationRun(f.ctx,f.actor,f.run.run_id);assert.equal(native.selected.status,'FAILED');assert.equal(native.selected.error,'RAW_PRIVATE_ACTION_DIAGNOSTIC');await f.button().fire('click');for(const locale of locales){f.i.setLocale(locale);assert.ok(f.box.textContent.includes(f.i.t('workflow.inspector.error')));assert.ok(!f.box.textContent.includes('RAW_PRIVATE_ACTION_DIAGNOSTIC'));assert.ok(f.box.textContent.includes(f.i.t('workflow.inspector.output.none')));}assert.equal(f.core.inspectAutomationRun(f.ctx,f.actor,f.run.run_id).selected.error,native.selected.error);assert.deepEqual(f.counts(),before);
});
test('an unknown recorded outcome remains unknown while missing inputs and genuine zero retain distinct meanings',async()=>{
 const f=fixture(),valid=f.core.inspectAutomationRun(f.ctx,f.actor,f.run.run_id),before=f.counts();valid.selected.recorded_output='UNKNOWN';f.override(valid);await f.button().fire('click');for(const locale of locales){f.i.setLocale(locale);assert.ok(f.box.textContent.includes(f.i.t('workflow.inspector.output.unknown')));assert.ok(f.box.textContent.includes(f.i.t('workflow.inspector.missing')));assert.ok(f.box.textContent.includes(f.i.number(0)));assert.ok(!f.box.textContent.includes(f.i.t('workflow.inspector.output.reported_executed')));}assert.deepEqual(f.counts(),before);
});
test('small nonzero condition operands remain distinct from zero in every locale',async()=>{
 const f=fixture({score:0.00001,threshold:0.000001}),before=f.counts();await f.button().fire('click');for(const locale of locales){f.i.setLocale(locale);const actual=f.i.number(0.00001,{maximumSignificantDigits:21}),expected=f.i.number(0.000001,{maximumSignificantDigits:21});assert.ok(f.box.textContent.includes(actual));assert.ok(f.box.textContent.includes(expected));}assert.deepEqual(f.counts(),before);
});
