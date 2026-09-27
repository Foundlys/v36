'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{page}=require('../zero-evaluation/sales-hierarchy-page-fixture');
const locales=['nl-NL','en-GB','de-DE','fr-FR','es-ES','da-DK','nb-NO','sv-SE'];
test('hierarchy locale changes preserve literal draft, confirmation and DOM with no requests; navigation respects draft',async()=>{
 const f=await page();await f.render();await f.fill();const title=f.field('title'),save=f.control('save'),calls=f.forecastCalls.length;
 for(const locale of locales){f.i.setLocale(locale);assert.equal(f.field('title'),title);assert.equal(title.value,'Literal private hierarchy draft');assert.equal(f.field('node_owners').value,f.actor.id);assert.equal(f.field('confirm').checked,true);assert.equal(save.textContent,f.i.t('sales.hierarchy.save'));assert.equal(f.forecastCalls.length,calls);}
 await f.tab('OPPORTUNITIES').fire('click');assert.equal(f.ui.state.activeSection,'FORECAST_HIERARCHIES');assert.equal(f.field('title'),title);
});
test('lost hierarchy reply recovers metadata only despite changed unsent input',async()=>{
 const f=await page();await f.render();await f.fill();f.loseHierarchy();await f.submit();f.field('title').value='Never replay this changed definition';await f.submit();assert.equal(f.writes().length,1);assert.equal(f.recoveries().length,1);assert.equal(f.core.bucket(f.ctx,'forecast_hierarchies')[0].title,'Literal private hierarchy draft');assert.deepEqual(Object.keys(f.recoveries()[0].input).sort(),['confirm','definition_fingerprint','request_fingerprint','request_id']);
});
test('fresh hierarchy page restores opaque recovery metadata without persisting definition or replaying PUT',async()=>{
 const f=await page();await f.render();await f.fill();f.loseHierarchy();await f.submit();const saved=JSON.stringify([...f.saved]);assert.ok(saved.includes('definition_fingerprint'));assert.ok(!saved.includes('Literal private'));assert.ok(!saved.includes('owner_ids'));
 const next=await page({shared:{buckets:f.buckets},storage:f.saved});await next.render();assert.ok(next.control('recover'));await next.control('recover').fire('click');assert.equal(next.writes().length,0);assert.equal(next.recoveries().length,1);assert.equal(next.core.bucket(next.ctx,'forecast_hierarchies').length,1);
});
