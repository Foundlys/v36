'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{fixture}=require('../zero-evaluation/demo-controls-fixture');
const writes=f=>f.calls.filter(c=>c.path==='/api/demo-universe/runs'||c.path.endsWith('/advance'));
async function confirm(f){f.field('reason').value='Literal demo purpose';await f.field('reason').fire('input');f.field('confirm').checked=true;}
test('demo loading requires current preview/confirmation, pauses after the acknowledged batch and resumes only on explicit choice',async()=>{
 const f=await fixture();assert.equal(writes(f).length,0);assert.equal(f.button('start').disabled,true);await f.button('preview').fire('click');await f.button('start').fire('click');assert.equal(writes(f).length,0);
 await confirm(f);f.lose('/api/demo-universe/runs');await f.button('start').fire('click');assert.equal(writes(f).length,1);assert.equal(f.button('continue').disabled,true);
 await f.button('check').fire('click');assert.equal(writes(f).length,1);const row=f.n.engine.session(f.n.ctx,f.n.actor).universe;assert.equal(row.applied_nodes,0);await confirm(f);
 const barrier=f.hold('/api/demo-universe/runs/'+row.id+'/advance'),running=f.button('continue').fire('click');await barrier.started;await f.button('pause').fire('click');barrier();await running;
 const saved=f.n.engine.session(f.n.ctx,f.n.actor).universe;assert.ok(saved.applied_nodes>0&&saved.applied_nodes<saved.total_nodes);assert.equal(writes(f).length,2);
 await f.reopen();assert.equal(writes(f).length,2);assert.equal(f.field('confirm').checked,undefined);await confirm(f);await f.button('continue').fire('click');const complete=f.n.engine.session(f.n.ctx,f.n.actor).universe;assert.equal(complete.status,'SEEDED');assert.equal(f.button('continue').disabled,true);assert.equal(f.n.adapter.bucket(f.n.ctx,'crm:companies').length,2);
});
test('a lost advance reply never auto-replays; status recovery uses the actual server cursor before a new continuation',async()=>{
 const f=await fixture();await f.button('preview').fire('click');await confirm(f);f.lose('/api/demo-universe/runs');await f.button('start').fire('click');await f.button('check').fire('click');const row=f.n.engine.session(f.n.ctx,f.n.actor).universe;
 await confirm(f);f.lose('/api/demo-universe/runs/'+row.id+'/advance');await f.button('continue').fire('click');const cursor=f.n.engine.session(f.n.ctx,f.n.actor).universe.applied_nodes;assert.ok(cursor>0);const count=writes(f).length;await new Promise(setImmediate);assert.equal(writes(f).length,count);assert.equal(f.button('continue').disabled,true);
 await f.button('check').fire('click');assert.equal(writes(f).length,count);await confirm(f);await f.button('continue').fire('click');assert.equal(writes(f)[count].body.expected_cursor,cursor);assert.equal(f.n.engine.session(f.n.ctx,f.n.actor).universe.status,'SEEDED');
});
test('changed input invalidates preview; malformed/foreign observations and revoked authority cannot authorize writes or leak raw errors',async()=>{
 const f=await fixture();await f.button('preview').fire('click');f.field('vehicle_count').value='201';await f.field('vehicle_count').fire('input');assert.equal(f.button('start').disabled,true);
 f.alter(data=>{if(data.request_context)data.request_context.actor_id='other';});await f.button('check').fire('click');assert.equal(writes(f).length,0);assert.equal(f.button('start').disabled,true);
 f.alter(null);await f.button('check').fire('click');f.deny();await f.button('preview').fire('click');assert.ok(!f.box.textContent.includes('PRIVATE_RAW_DENIAL'));assert.equal(f.box.all().filter(e=>e.tag==='input').length,0);assert.equal(writes(f).length,0);
});
test('locale changes preserve literal purpose, preview and confirmation without requests or writes in all eight locales',async()=>{
 const f=await fixture();await f.button('preview').fire('click');await confirm(f);const calls=f.calls.length;
 for(const locale of require('../foundly-locales').locales){f.context.FoundlyI18n.setLocale(locale);await new Promise(setImmediate);assert.equal(f.field('reason').value,'Literal demo purpose');assert.equal(f.field('confirm').checked,true);assert.equal(f.button('preview').textContent,f.context.FoundlyI18n.t('demo.controls.preview'));assert.equal(f.context.FoundlyI18n.missingKeys().length,0);assert.equal(f.calls.length,calls);}
});
test('leaving a pending view prevents another automatic batch and unavailable scope clears old controls',async()=>{
 const f=await fixture();await f.button('preview').fire('click');await confirm(f);f.lose('/api/demo-universe/runs');await f.button('start').fire('click');await f.button('check').fire('click');const row=f.n.engine.session(f.n.ctx,f.n.actor).universe;
 await confirm(f);const barrier=f.hold('/api/demo-universe/runs/'+row.id+'/advance'),pending=f.button('continue').fire('click');await barrier.started;const count=writes(f).length;await f.reopen();barrier();await pending;assert.equal(writes(f).length,count);assert.equal(f.button('continue').disabled,false);
 f.n.setIsolated(false);await f.button('check').fire('click');assert.equal(f.box.all().filter(e=>e.tag==='input').length,0);assert.equal(f.button('continue').disabled,true);assert.equal(writes(f).length,count);
});
