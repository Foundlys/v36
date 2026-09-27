'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{page:controls}=require('../zero-evaluation/calendar-scheduling-page-fixture');
async function page(hours,step=5){
 const f=await controls(),from='2026-10-02T08:00:00.000Z',to=new Date(Date.parse(from)+hours*3600000).toISOString();f.core.bucket(f.ctx,'availability')[0].end_at=to;let observation;const fetch=f.context.fetch;f.context.fetch=async(route,options)=>{const r=await fetch(route,options);if(route.startsWith('/api/calendar/scheduling/slots?')){const json=r.json;return {...r,json:async()=>{observation=await json();return observation;}};}return r;};await f.render();await f.fill({from,to,duration_minutes:'5',step_minutes:String(step),title:'Literal PRIVATE appointment'});return {...f,form:f.content.querySelector('form'),reads:()=>f.schedulingCalls.filter(c=>c.operation==='SLOTS').length,observation:()=>observation,notice:()=>f.content.querySelector('output'),buttons:()=>f.content.all().filter(n=>n.getAttribute?.('data-calendar-scheduling-action')==='book')};
}
test('actual scheduling page distinguishes unknown capped totals and retains literal inputs during eight-locale status changes',async()=>{
 const f=await page(72),first=f.form;assert.equal(f.observation().total,null);assert.equal(f.buttons().length,50);for(const locale of ['nl-NL','en-GB','de-DE','fr-FR','es-ES','da-DK','nb-NO','sv-SE']){f.i.setLocale(locale);assert.equal(f.notice().textContent,f.i.t('calendar.scheduling.partial',{count:f.i.number(50)}));assert.equal(f.form===first,true,'Locale change must preserve the actual input form');assert.equal(f.field('title').value,'Literal PRIVATE appointment');}assert.equal(f.reads(),1);
});
test('actual scheduling page reports the fifty shown slots when the native source total is complete',async()=>{
 const f=await page(5);assert.equal(f.observation().total,60);assert.equal(f.observation().truncated,false);assert.equal(f.buttons().length,50);assert.equal(f.notice().textContent,f.i.t('calendar.scheduling.limited_known',{count:f.i.number(50),total:f.i.number(60)}));
});
