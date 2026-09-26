'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {locales}=require('../foundly-i18n'),{fixture:baseFixture,ViewElement}=require('../zero-evaluation/zero-presentation-fixture');
const source=fs.readFileSync(require.resolve('../index-script.js'),'utf8');
function fixture(search){
  const f=baseFixture('en-GB'),timers=[],opened=[],toasts=[],history=[],calls={status:0,events:0};f.nodes.toast=new ViewElement();
  f.context.window=f.context;Object.assign(f.context.location,{search,pathname:'/',hash:'#literal-fragment'});
  Object.assign(f.context,{URLSearchParams,MODULES:{integraties:{},data:{},crm:{}},setTimeout:(fn,ms)=>timers.push({fn,ms}),openModule:id=>opened.push(id),loadSystemStatus:async()=>{calls.status++},refreshEvents:()=>calls.events++,toast:value=>{toasts.push(value);f.context.zeroRenderText(f.nodes.toast,value)},history:{replaceState:(state,title,url)=>history.push(url)}});
  vm.runInContext(source.slice(source.indexOf('function scheduleOAuthFeedback('),source.indexOf('// Real operating-system event stream.')),f.context);
  return {...f,timers,opened,toasts,history,calls,run:async ms=>{for(const timer of timers.filter(timer=>timer.ms===ms))await timer.fn()}};
}
test('callback query parameters never prove a connection or ingested count; feedback is localised without repeating reads',async()=>{
  const f=fixture('?google=connected&bootstrap=999999&message=PRIVATE_RAW_SECRET&open=integraties&keep=literal');
  f.context.__foundlyConnectorStatus={available:true,connectors:[{id:'google_ads',configured:true,connected:false,probe_ok:false}]};
  await f.run(150);assert.deepEqual(f.opened,['integraties']);await f.run(300);assert.equal(f.calls.status,1);assert.equal(f.calls.events,1);assert.equal(f.toasts.length,1);
  for(const locale of locales){f.i.setLocale(locale);assert.equal(f.nodes.toast.textContent,f.i.t('callback.unconfirmed',{name:'GOOGLE'}));assert.ok(!f.nodes.toast.textContent.includes('999999'));assert.ok(!f.nodes.toast.textContent.includes('PRIVATE_RAW'));assert.equal(f.calls.status,1);assert.equal(f.calls.events,1);assert.equal(f.i.missingKeys().length,0);}
  await f.run(1200);assert.deepEqual(f.history,['/?open=integraties&keep=literal#literal-fragment']);
});
test('only current strictly verified unique service observations can produce confirmed connection feedback',async()=>{
  const f=fixture('?google=connected');f.context.__foundlyConnectorStatus={available:true,connectors:[{id:'google_ads',connected:true,probe_ok:true},{id:'google_ads',connected:true,probe_ok:true},{id:'ga4',connected:true,probe_ok:true},{id:'search_console',connected:'true',probe_ok:true},{id:'google_calendar',connected:true,probe_ok:false},{id:'unrelated',connected:true,probe_ok:true}]};await f.run(300);
  for(const locale of locales){f.i.setLocale(locale);assert.equal(f.nodes.toast.textContent,f.i.t('callback.verified',{name:'GOOGLE',count:2}));assert.equal(f.calls.status,1);}
  for(const observed of [null,{available:false,connectors:[{id:'google_ads',connected:true,probe_ok:true}]},{available:true,connectors:null}]){const denied=fixture('?google=connected');denied.context.__foundlyConnectorStatus=observed;await denied.run(300);assert.equal(denied.nodes.toast.textContent,denied.i.t('callback.unconfirmed',{name:'GOOGLE'}));}
});
test('failed refreshes cannot reuse cached positive connection evidence',async()=>{
  const f=fixture('?google=connected');f.context.__foundlyConnectorStatus={available:true,connectors:[{id:'google_ads',connected:true,probe_ok:true}]};f.context.loadSystemStatus=async()=>{throw Error('denied')};await f.run(300);assert.equal(f.nodes.toast.textContent,f.i.t('callback.unconfirmed',{name:'GOOGLE'}));
  const conflict=fixture('?google=connected');conflict.context.__foundlyConnectorStatus={available:true,connectors:[{id:'google_ads',connected:true,probe_ok:true},{id:'google_ads',connected:false,probe_ok:false}]};await conflict.run(300);assert.equal(conflict.nodes.toast.textContent,conflict.i.t('callback.unconfirmed',{name:'GOOGLE'}));
});
test('error callbacks preserve uncertainty, omit raw URL messages and do not overwrite navigation performed after scheduling',async()=>{
  const f=fixture('?meta=error&message=PRIVATE_RAW_SECRET&bootstrap=120');f.context.__foundlyConnectorStatus={available:true,connectors:[{id:'meta',connected:true,probe_ok:true}]};await f.run(300);assert.equal(f.nodes.toast.textContent,f.i.t('callback.unconfirmed',{name:'META'}));
  f.context.location.search='?open=data&keep=new';await f.run(1200);assert.equal(f.history.length,0);
  const arbitrary=fixture('?open=constructor&google=unexpected');await arbitrary.run(150);await arbitrary.run(300);assert.equal(arbitrary.opened.length,0);assert.equal(arbitrary.calls.status,0);assert.equal(arbitrary.toasts.length,0);
});
