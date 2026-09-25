'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{fixture}=require('../zero-evaluation/workflow-editor-fixture');
test('retired editor controls and an already scheduled autosave dispatch no native or ZERO requests',async()=>{
 const f=fixture();f.valid();await f.box.fire('input');const timers=[...f.timers.values()];f.retire();for(const timer of timers)await timer();await f.button('Concept nu bewaren').fire('click');await f.button('Bewaar invoer als nieuw concept').fire('click');await f.button('Concept met ZERO voorbereiden').fire('click');await f.box.fire('submit');await new Promise(resolve=>setImmediate(resolve));assert.equal(f.calls.length,0);assert.equal(f.saved.length,0);assert.equal(f.records().length,0);
});
test('a late native draft reply cannot publish or call saved after the owning editor retires',async()=>{
 const f=fixture();f.valid();const release=f.hold(),pending=f.box.fire('submit');await release.started;const notice=f.notice().textContent;f.retire();release();await pending;assert.equal(f.calls.filter(c=>c.operation==='PUBLISH').length,0);assert.equal(f.saved.length,0);assert.equal(f.notice().textContent,notice);assert.equal(f.records().length,1);assert.equal(f.core.automationStatus(f.ctx,f.actor).workflow_count,0);
});
test('changed input during a publication prerequisite must be reviewed again before publication',async()=>{
 const f=fixture();f.valid();const release=f.hold(),pending=f.box.fire('submit');await release.started;f.field('Workflownaam').value='Changed while draft acknowledgement waited';await f.box.fire('input');release();await pending;assert.equal(f.calls.filter(c=>c.operation==='PUBLISH').length,0);assert.equal(f.saved.length,0);assert.equal(f.box.dataset.unsaved,'true');assert.equal(f.core.automationStatus(f.ctx,f.actor).workflow_count,0);
});
test('saving as a new draft cannot replace ownership of a pending native editor save',async()=>{
 const f=fixture();f.valid();await f.box.fire('input');const release=f.hold(),pending=f.button('Concept nu bewaren').fire('click');await release.started;const count=f.calls.length;await f.button('Bewaar invoer als nieuw concept').fire('click');assert.equal(f.calls.length,count);release();await pending;await new Promise(resolve=>setImmediate(resolve));assert.equal(f.records().length,1);assert.equal(f.box.dataset.unsaved,'false');
});
test('malformed native prerequisite acknowledgement never permits workflow publication and exact retry can recover it',async()=>{
 const f=fixture();f.valid();f.alter((result,operation)=>{if(operation==='DRAFT')result.record.draft.name='Unattributed replacement';return result;});await f.box.fire('submit');assert.equal(f.calls.filter(c=>c.operation==='PUBLISH').length,0);assert.equal(f.saved.length,0);const original=f.calls[0];f.alter(null);await f.box.fire('submit');assert.deepEqual(f.calls[1],original);assert.equal(f.saved.length,1);assert.equal(f.records().length,1);assert.equal(f.counts().effects,0);
});
test('a genuine native conflict preserves another editor and permits an explicitly separate new draft',async()=>{
 const f=fixture();f.valid();await f.button('Concept nu bewaren').fire('click');const row=f.records()[0];f.drafts.save(f.ctx,f.actor,row.id,{draft:{...row.draft,name:'Other editor retained revision'},expected_revision:row.revision});f.field('Workflownaam').value='My separate conflict copy';await f.box.fire('input');await f.button('Concept nu bewaren').fire('click');const count=f.calls.length;await f.button('Bewaar invoer als nieuw concept').fire('click');assert.equal(f.calls.length,count+1);assert.equal(f.records().length,2);assert.equal(f.records().find(r=>r.id===row.id).draft.name,'Other editor retained revision');assert.equal(f.records().find(r=>r.id!==row.id).draft.name,'My separate conflict copy');assert.equal(f.core.automationStatus(f.ctx,f.actor).workflow_count,0);
});
test('an uncertain private draft cannot be forked into a duplicate with the save-as-new control',async()=>{
 const f=fixture();f.valid();f.lose('DRAFT');await f.button('Concept nu bewaren').fire('click');const count=f.calls.length;await f.button('Bewaar invoer als nieuw concept').fire('click');assert.equal(f.calls.length,count);assert.equal(f.records().length,1);await f.button('Concept nu bewaren').fire('click');assert.deepEqual(f.calls[1],f.calls[0]);assert.equal(f.records()[0].revision,1);
});
