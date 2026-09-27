'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {locales}=require('../foundly-i18n'),catalog=require('../foundly-locales');
const {ViewElement}=require('../zero-evaluation/zero-presentation-fixture');
const {fixture,modules,value}=require('../zero-evaluation/module-overlay-fixture');
test('every module overlay and sublabel has eight-locale copy; language changes preserve the actual controls, source strings and source requests',async()=>{
  const f=fixture(),original=JSON.stringify(f.snapshot);
  for(const id of Object.keys(modules).filter(id=>id!=='crm')){
    await f.context.openModule(id);const body=f.nodes.layerBody,grid=body.firstChild,ask=f.get('ask'),answer=f.get('answer'),count=f.requests.length;
    answer.textContent='Klaar voor opdrachten. <literal model response>';
    assert.equal(grid.className,'grid');assert.equal(body.children[1].className,'subGrid');assert.equal(body.children[1].getAttribute('style'),'margin-top:10px');
    assert.deepEqual(grid.children.slice(0,3).map(node=>node.className),['card','card','card']);
    for(const locale of locales){
      f.i.setLocale(locale);assert.equal(body.firstChild,grid);assert.equal(f.get('ask'),ask);assert.equal(f.get('answer'),answer);assert.equal(answer.textContent,'Klaar voor opdrachten. <literal model response>');assert.equal(f.requests.length,count);
      assert.equal(f.nodes.layerTitle.textContent,String(f.context.moduleLabel(id)));assert.equal(ask.textContent,f.i.t('overlay.ask',{module:f.context.moduleLabel(id)}));
      assert.equal(value(f,'overlay.records').textContent,new Intl.NumberFormat(locale).format(1234));assert.equal(value(f,'overlay.configured').textContent,'0');assert.equal(value(f,'overlay.history').textContent,new Intl.NumberFormat(locale).format(1234));assert.equal(value(f,'overlay.derived').textContent,'0');assert.equal(value(f,'overlay.storage').textContent,f.i.t('overlay.writable'));
      assert.equal(value(f,'overlay.sources').textContent,f.snapshot.external_sources.connected[0].name);
      for(const [index,label]of modules[id].sub.entries()){assert.ok(catalog.staticLookup[label],label);assert.equal(body.children[1].children[index].children[0].textContent,f.i.t(catalog.staticLookup[label]));}
      assert.equal(JSON.stringify(f.snapshot),original);assert.equal(f.zero.preferences.language,'da-DK');assert.equal(f.i.missingKeys().length,0);
    }
    f.context.prompt=message=>{assert.equal(message,f.i.t('overlay.prompt',{module:f.context.moduleLabel(id)}));return null};ask.onclick();assert.equal(f.queries.length,0);
    f.context.prompt=()=> 'Literal customer question';ask.onclick();assert.deepEqual(f.queries.pop(),{id,q:'Literal customer question'});
  }
});
test('failed and denied reads clear prior source data and distinguish unknown counts from observed zero',async()=>{
  const f=fixture();await f.context.openModule('data');const old=f.nodes.layerBody.firstChild;
  f.context.fetch=async()=>({ok:false,status:403,json:async()=>({error:'PRIVATE_RAW_PROVIDER_ERROR'})});await f.context.openModule('data');assert.notEqual(f.nodes.layerBody.firstChild,old);
  for(const locale of locales){f.i.setLocale(locale);for(const key of ['records','probes','configured','history','derived','storage','sources'])assert.equal(value(f,'overlay.'+key).textContent,f.i.t('common.unknown'));assert.ok(f.nodes.layerBody.textContent.includes(f.i.t('common.access_denied')));assert.ok(!f.nodes.layerBody.textContent.includes('literal provider'));assert.ok(!f.nodes.layerBody.textContent.includes('PRIVATE_RAW'));assert.equal(f.get('ask').disabled,true);}
  f.context.fetch=async()=>f.response('/api/engine/native-data/status');Object.assign(f.snapshot,{external_sources:{connected:[],configured:[]},foundly_data_layer:{records:0},local_persistence:{writable:false},historical_internal_data:{records:0,memory_records:0},derived_intelligence:{records:0,decision_records:0}});await f.context.openModule('data');
  for(const locale of locales){f.i.setLocale(locale);for(const key of ['records','probes','configured','history','derived'])assert.equal(value(f,'overlay.'+key).textContent,'0');assert.equal(value(f,'overlay.sources').textContent,f.i.t('overlay.no_source'));assert.equal(value(f,'overlay.storage').textContent,f.i.t('overlay.unavailable'));assert.equal(f.get('ask').disabled,false);}
});
test('missing, invalid, contradictory and overflowing observations never invent usable records or verified sources',async()=>{
  const f=fixture();Object.assign(f.snapshot,{external_sources:{connected:[{id:'unverified',connected:'true',probe_ok:true}],configured:[null]},foundly_data_layer:{records:'0'},historical_internal_data:{records:0},derived_intelligence:{records:Number.MAX_SAFE_INTEGER,decision_records:1},local_persistence:{writable:'true',separate_mount:true}});await f.context.openModule('data');
  for(const key of ['records','probes','configured','history','derived','storage','sources'])assert.equal(value(f,'overlay.'+key).textContent,f.i.t('common.unknown'));
  const duplicate={id:'repeat',connected:true,probe_ok:true};f.snapshot.external_sources={connected:[duplicate,duplicate],configured:[]};await f.context.openModule('data');assert.equal(value(f,'overlay.probes').textContent,f.i.t('common.unknown'));
  f.snapshot.external_sources={connected:[],total_connected:1,configured:[],total_configured:null};await f.context.openModule('data');assert.equal(value(f,'overlay.probes').textContent,f.i.t('common.unknown'));assert.equal(value(f,'overlay.configured').textContent,f.i.t('common.unknown'));
  for(const result of [null,[],false]){f.context.fetch=async()=>({ok:true,status:200,json:async()=>result});await f.context.openModule('data');assert.equal(value(f,'overlay.records').textContent,f.i.t('common.unknown'));assert.ok(f.nodes.layerBody.textContent.includes(f.i.t('common.request_failed')));}
});
test('late replies cannot replace another module, reopen a closed overlay or overwrite an answer while status is loading',async()=>{
  const f=fixture();let release;f.context.fetch=async()=>new Promise(resolve=>release=resolve);const old=f.context.openModule('data');const answer=f.get('answer');answer.textContent='Pending model reply';f.i.setLocale('fr-FR');release(f.response('/api/engine/native-data/status'));await old;assert.equal(answer.textContent,'Pending model reply');
  f.context.fetch=async()=>new Promise(resolve=>release=resolve);const stale=f.context.openModule('data');f.context.fetch=async()=>({ok:false,status:403,json:async()=>({})});await f.context.openModule('verkoop');const newBody=f.nodes.layerBody.firstChild;release(f.response('/api/engine/native-data/status'));await stale;assert.equal(f.nodes.layerBody.firstChild,newBody);assert.equal(f.nodes.layerTitle.textContent,f.i.t('spatial.module.verkoop'));assert.equal(value(f,'overlay.records').textContent,f.i.t('common.unknown'));
  f.context.fetch=async()=>new Promise(resolve=>release=resolve);const closed=f.context.openModule('agenda'),before=f.nodes.layerBody.textContent;f.context.closeModule();release(f.response('/api/engine/native-agenda/status'));await closed;assert.equal(f.nodes.layer.classList.contains('hidden'),true);assert.equal(f.nodes.layerBody.textContent,before);assert.equal(f.focus.at(-1),null);
  f.context.fetch=async()=>new Promise(resolve=>release=resolve);const replaced=f.context.openModule('data');f.nodes.layerBody.replaceChildren(new ViewElement());f.nodes.layerBody.firstChild.textContent='Independent result';release(f.response('/api/engine/native-data/status'));await replaced;assert.equal(f.nodes.layerBody.textContent,'Independent result');
});
test('Automotive registry preserves source IDs, observes each native lifecycle, and treats missing or duplicate evidence as unknown',async()=>{
  const f=fixture();await f.context.openModule('inkoop');const box=f.nodes.layerBody.all().find(n=>n.getAttribute('data-i18n')==='overlay.group.core').parentNode;
  assert.equal(f.requests.length,2);assert.equal(f.requests[1].path,'/api/source-registry?module=automotive');
  for(const locale of locales){f.i.setLocale(locale);assert.equal(box.children[1].textContent,'RDW — '+f.i.t('overlay.source.connected'));assert.equal(box.children[2].textContent,'ECB — '+f.i.t('overlay.source.configured'));assert.equal(box.children[3].textContent,'OpenAI — '+f.i.t('common.unknown'));assert.equal(f.requests.length,2);}
  const panel=f.context.automotiveSourcePanel();f.nodes.registry=panel.card;
  for(const status of require('../foundly-registry').CONNECTOR_LIFECYCLE){panel.render([{source_id:'rdw',connection_status:status}]);for(const locale of locales){f.i.setLocale(locale);assert.equal(panel.card.children[2].children[0].children[1].children[0].textContent,f.i.t(status==='UNKNOWN'?'common.unknown':'overlay.source.'+status.toLowerCase()));}}
  for(const rows of [null,[],[{source_id:'rdw',connection_status:'CONNECTED'},{source_id:'rdw',connection_status:'ERROR'}],[{source_id:'rdw',connection_status:'PRIVATE_RAW_STATE'}]]){panel.render(rows);assert.equal(panel.card.children[2].children[0].children[1].children[0].textContent,f.i.t('common.unknown'));assert.ok(!panel.card.textContent.includes('PRIVATE_RAW'));}
});
test('CRM navigation and Google/integration buttons keep the native routes without locale-triggered execution',async()=>{
  const f=fixture();await f.context.openModule('crm');assert.equal(f.context.location.redirect,'/crm');assert.equal(f.nodes.layer.classList.contains('hidden'),true);assert.equal(f.requests.length,0);
  await f.context.openModule('google');f.get('googleConnect').onclick();assert.equal(f.context.location.href,'/api/google/connect?return_to=/?open=integraties');await f.context.openModule('integraties');
  const buttons=f.all().filter(n=>n.getAttribute('data-quick-oauth'));assert.equal(buttons.length,5);for(const locale of locales){const before=f.requests.length;f.i.setLocale(locale);assert.equal(f.requests.length,before);for(const button of buttons)assert.equal(button.textContent,f.i.t('integrations.connect_provider',{name:button.getAttribute('data-quick-oauth').toUpperCase()}));}
  for(const button of buttons){button.onclick();const provider=button.getAttribute('data-quick-oauth');assert.equal(f.context.location.href,provider==='google'?'/api/google/connect?return_to=/?open=integraties':`/api/connect/${provider}?return_to=/?open=integraties`);}
});
