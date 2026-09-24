'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {create,locales}=require('../foundly-i18n'),catalog=require('../foundly-locales');
test('exact native cent formatting retains large amounts, zero and negative sub-unit signs in every locale',()=>{
 const en=create('en-GB');assert.equal(en.currencyCents(9007199254740991,'EUR'),'€90,071,992,547,409.91');assert.equal(en.currencyCents('900719925474099300','USD'),'US$9,007,199,254,740,993.00');assert.equal(en.currencyCents(-1,'EUR'),'-€0.01');assert.equal(en.currencyCents(0,'EUR'),'€0.00');
 for(const locale of locales){const i=create(locale);for(const value of [null,undefined,'',false,0.5,Number.MAX_SAFE_INTEGER+1,'1e4'])assert.equal(i.currencyCents(value,'EUR'),i.t('common.unknown'));const parts=new Intl.NumberFormat(locale,{style:'currency',currency:'EUR',minimumFractionDigits:2,maximumFractionDigits:2}).formatToParts(0);const decimal=parts.find(p=>p.type==='decimal').value;assert.ok(i.currencyCents(9007199254740991,'EUR').includes(decimal+'91'));assert.ok(i.currencyCents(-1,'EUR').includes(decimal+'01'));assert.equal(i.currencyCents(1,'invalid'),i.t('common.unknown'));}
});
test('explicit catalogs preserve all supported locales, parameters, pluralisation and unknown-value semantics',()=>{
 const keys=Object.keys(catalog.messages['nl-NL']);for(const locale of locales){const i=create(locale);assert.deepEqual(Object.keys(catalog.messages[locale]),keys);for(const key of keys){const parameters=text=>[...new Set(String(text).match(/\{[a-z_][a-z_0-9]*\}/g)||[])].sort();const original=parameters(catalog.messages['nl-NL'][key]);assert.deepEqual(parameters(catalog.messages[locale][key]),original,key+' parameters in '+locale);const params=Object.fromEntries(original.map(name=>[name.slice(1,-1),'<customer text>']));assert.ok(i.t(key,{...params,count:2,time:'12:00',date:'DATE',zone:'UTC'}));}assert.equal(i.number(null),i.t('common.unknown'));assert.equal(i.currency(0,null),i.t('common.unknown'));assert.equal(i.number('1234'),i.t('common.unknown'));assert.equal(i.date(null),i.t('common.unknown'));assert.match(i.t('common.record_count',{count:2}),/2/);assert.equal(i.missingKeys().length,0);}
 const en=create('en-GB');assert.equal(en.number(1234.5),'1,234.5');assert.equal(create('de-DE').number(1234.5),'1.234,5');assert.equal(en.currency(12.5,'GBP'),'£12.50');assert.equal(en.date('2026-01-01T00:00:00Z',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}),'31/12/2025');
 assert.equal(en.t('common.record_count',{count:1}),'1 record');assert.equal(en.t('common.record_count',{count:0}),'0 records');assert.throws(()=>en.t('zero.time'),/parameter_required/);assert.throws(()=>en.setLocale('xx-XX'),/locale_unsupported/);assert.equal(en.t('absent'),'⟦absent:en-GB⟧');assert.deepEqual(en.missingKeys(),['absent']);
});
const {Element,browserFixture}=require('../zero-evaluation/dom-fixture');
test('explicit dynamic descriptors update labels and attributes without translating customer text or replacing form controls',()=>{
 const f=browserFixture('en-GB'),i=f.context.FoundlyI18n,node=f.nodes.dynamic=new Element('button'),input=f.nodes.unsaved=new Element('input'),params={count:1234};input.value='Aanmelden <unsaved customer value>';
 for(const code of ['constructor','__proto__','toString'])assert.equal(i.errorKey(code,500),'common.request_failed');
 i.renderText(node,i.message('common.record_count',params));i.renderAttribute(node,'aria-label',i.message('common.save'));params.count=99;
 assert.equal(node.textContent,'1,234 records');i.setLocale('de-DE');assert.equal(node.textContent,i.t('common.record_count',{count:1234}));assert.equal(node.getAttribute('aria-label'),i.t('common.save'));assert.equal(input.value,'Aanmelden <unsaved customer value>');
 i.renderText(node,'Aanmelden');i.renderAttribute(node,'aria-label','Customer label');i.setLocale('fr-FR');assert.equal(node.textContent,'Aanmelden');assert.equal(node.getAttribute('aria-label'),'Customer label');
 const literal={key:'common.save',params:{},toString:()=>'<literal customer object>'};i.renderText(node,literal);i.setLocale('sv-SE');assert.equal(node.textContent,'<literal customer object>');
 i.renderText(node,i.message('common.save'));node.textContent='Customer replacement';i.setLocale('es-ES');assert.equal(node.textContent,'Customer replacement');
 i.renderText(node,i.message('common.save'));assert.equal(node.textContent,i.t('common.save'));assert.throws(()=>i.renderAttribute(input,'value',i.message('common.save')),/attribute_unsupported/);assert.equal(input.value,'Aanmelden <unsaved customer value>');
 const label=f.nodes.liveLabel=new Element('label');i.renderText(label,i.message('crm.pipeline.stage_name'));label.append(input);const originalText=label.firstChild;
 for(const locale of catalog.locales){i.setLocale(locale);assert.equal(label.firstChild,originalText);assert.equal(label.firstChild.textContent,i.t('crm.pipeline.stage_name'));assert.equal(label.childNodes[1],input);assert.equal(input.value,'Aanmelden <unsaved customer value>');}
});
test('actual Finance closing controls follow eight locale changes while preserving review, confirmation and uncertain-request payload',async()=>{
 for(const locale of locales){
  const f=browserFixture(locale),i=f.context.FoundlyI18n,period={id:'period-literal',name:'Aanmelden <customer name>',start_date:'2026-09-01',end_date:'2026-09-30',status:'OPEN'},calls=[],closes=[];let lose=true;
  f.context.crypto={randomUUID:()=> 'finance-confirmation-request'};
  vm.runInContext(fs.readFileSync(require.resolve('../finance-period-closing-client'),'utf8'),f.context);
  const request=async(path,options={})=>{calls.push(path);if(path.includes('/records/'))return {items:[period],total:1,next_cursor:null};if(path.endsWith('/close-preview'))return {ready:true,source_hash:'a'.repeat(64),currency:'EUR',totals:{debit_cents_exact:'900719925474099300',credit_cents_exact:'900719925474099300'},blockers:[]};closes.push(JSON.parse(options.body));if(lose){lose=false;throw Error('RAW_BACKEND_TEXT');}return {period,closing:{id:'literal-receipt'},deduplicated:true};};
  const box=f.nodes.finance=f.context.FoundlyFinancePeriodClosing.create({document:f.context.document,request});await box.ready;
  const byKey=key=>box.all().find(node=>node.getAttribute('data-i18n')==='finance.close.'+key),select=byKey('period').children[0],reason=byKey('reason').children[0],confirm=byKey('confirm').children[0],submit=byKey('submit');
  assert.equal(byKey('title').textContent,i.t('finance.close.title'));assert.ok(select.children[1].textContent.includes(period.name));assert.equal(select.children[1].value,period.id);
  await submit.fire('click');assert.equal(closes.length,0);select.value=period.id;await select.fire('change');reason.value='Letterlijke reden <keep>';await reason.fire('input');await byKey('review').fire('click');confirm.checked=true;
  const before=calls.length;
  for(const next of locales){i.setLocale(next);assert.equal(calls.length,before);assert.equal(reason.value,'Letterlijke reden <keep>');assert.equal(confirm.checked,true);assert.equal(select.value,period.id);assert.equal(byKey('reason').children[0],reason);assert.equal(submit.textContent,i.t('finance.close.submit'));assert.ok(byKey('totals').textContent.includes('900719925474099300'));assert.ok(select.children[1].textContent.includes(i.t('finance.close.open')));}
  await submit.fire('click');assert.equal(closes.length,1);assert.equal(byKey('uncertain').textContent,i.t('finance.close.uncertain'));assert.equal(reason.value,'Letterlijke reden <keep>');
  i.setLocale(locale);assert.equal(byKey('uncertain').textContent,i.t('finance.close.uncertain'));await byKey('clear').fire('click');assert.equal(select.value,period.id);assert.equal(closes.length,1);
  await submit.fire('click');assert.deepEqual(closes[0],closes[1]);assert.equal(closes.length,2);assert.equal(closes[1].reason,'Letterlijke reden <keep>');assert.equal(byKey('verified').textContent,i.t('finance.close.verified'));assert.equal(box.canLeave(),true);assert.ok(byKey('closed').textContent.includes(period.name));assert.equal(box.all().some(node=>node.tag==='img'||node.tag==='script'),false);assert.deepEqual(Array.from(i.missingKeys()),[]);
 }
});
test('Finance locale errors hide raw backend copy and known blocker labels preserve record IDs',async()=>{
 const f=browserFixture('de-DE'),i=f.context.FoundlyI18n;f.context.crypto={randomUUID:()=> 'unused'};vm.runInContext(fs.readFileSync(require.resolve('../finance-period-closing-client'),'utf8'),f.context);
 let forbidden=false;const request=async path=>{if(path.includes('/records/'))return {items:[{id:'p1',name:'Name',start_date:'2026-01-01',end_date:'2026-01-31',status:'OPEN'}],total:1,next_cursor:null};if(forbidden)throw Object.assign(Error('RAW_DUTCH_PROVIDER'),{status:403});return {ready:false,source_hash:'b'.repeat(64),currency:'EUR',totals:{debit_cents_exact:'0',credit_cents_exact:'0'},blockers:[{code:'DRAFT_INVOICES',record_ids:['Letterlijke-id <literal>']}]};};
 const box=f.nodes.finance=f.context.FoundlyFinancePeriodClosing.create({document:f.context.document,request});await box.ready;const key=name=>box.all().find(node=>node.getAttribute('data-i18n')==='finance.close.'+name);const select=key('period').children[0];select.value='p1';await select.fire('change');await key('review').fire('click');assert.ok(key('blocker').textContent.includes(i.t('finance.close.draft_invoices')));
 i.setLocale('sv-SE');assert.ok(key('blocker').textContent.includes(i.t('finance.close.draft_invoices')));assert.ok(key('blocker').textContent.includes('Letterlijke-id <literal>'));
 forbidden=true;await key('review').fire('click');const status=box.all().find(node=>node.tag==='output');assert.equal(status.textContent,i.t('common.access_denied'));i.setLocale('en-GB');assert.equal(status.textContent,i.t('common.access_denied'));assert.ok(!box.textContent.includes('RAW_DUTCH_PROVIDER'));
});
test('actual cash scenario UI uses native outcome codes and changes locale without losing assumptions or recalculating',async()=>{
 const {FoundlyFinanceCore}=require('../finance-core'),{CapabilityResolver}=require('../capability-resolver'),{guardDomain}=require('../composition-runtime');
 for(const locale of locales){
  const f=browserFixture(locale),i=f.context.FoundlyI18n,rows=new Map(),ctx={tenant_id:'cash-localization',dealer_id:'default'},admin={id:'admin',roles:['ADMIN','SUPER_ADMIN']},reader={id:'reader',roles:['VIEWER']};let writes=0,sequence=0,deny=false;
  const adapter={bucket(ctx,key){if(!rows.has(key))rows.set(key,[]);return rows.get(key);},persist(){writes++;},id:()=> 'cash-'+(++sequence),now:()=>new Date('2026-09-22T00:00:00Z'),emit(){},audit(){}};
  const resolver=new CapabilityResolver(adapter);resolver.configure(ctx,admin,{entitlements:['finance'],expected_revision:0});const core=new FoundlyFinanceCore(adapter),finance=guardDomain(core,'finance',()=>resolver);core.migrate(ctx,admin);
  const entity=core.createLegalEntity(ctx,admin,{name:'Literal entity',legal_form:'BV',currency:'USD'}),plan=core.createCashForecast(ctx,admin,{legal_entity_id:entity.id,as_of:'2026-09-01',horizon_days:30,opening_cash_cents:10000,entries:[{date:'2026-09-10',amount_cents:-1000}]});
  const before=JSON.stringify(plan),writesBefore=writes,calls=[];vm.runInContext(fs.readFileSync(require.resolve('../finance-cash-scenarios-client'),'utf8'),f.context);
  const request=async(path,options)=>{assert.equal(path,'/api/finance/forecast-scenarios');const input=JSON.parse(options.body);calls.push(input);if(deny)throw Object.assign(Error('RAW_PRIVATE_BACKEND'),{status:403});return finance.forecastScenario(ctx,reader,input);};
  const box=f.nodes.cash=f.context.FoundlyFinanceCashScenarios.create({document:f.context.document,request,forecastId:plan.id});await box.ready;
  const key=name=>box.all().find(node=>node.getAttribute('data-i18n')==='finance.cash.'+name),opening=key('opening').children[0],horizon=key('horizon').children[0],date=key('entry_date').children[0],form=box.children.find(node=>node.tag==='div');
  opening.value='0';await form.fire('input');const literalDate=date.value;
  for(const next of locales){i.setLocale(next);assert.equal(calls.length,1);assert.equal(opening.value,'0');assert.equal(horizon.value,'30');assert.equal(date.value,literalDate);assert.equal(key('opening').children[0],opening);assert.equal(key('changed').textContent,i.t('finance.cash.changed'));}
  await key('calculate').fire('click');assert.equal(calls.length,2);assert.equal(calls[1].changes.opening_cash_cents,0);assert.match(calls[1].expected_source_hash,/^[a-f0-9]{64}$/);assert.equal(key('possible_cash_shortfall').textContent,i.t('finance.cash.possible_cash_shortfall'));assert.equal(key('no_cash_accounts').textContent,i.t('finance.cash.no_cash_accounts'));
  for(const next of locales){i.setLocale(next);assert.equal(calls.length,2);assert.equal(key('baseline').textContent,i.t('finance.cash.baseline',{amount:i.currencyCents(9000,'USD')}));assert.equal(key('scenario').textContent,i.t('finance.cash.scenario',{amount:i.currencyCents(-1000,'USD')}));assert.equal(opening.value,'0');}
  assert.equal(writes,writesBefore);assert.equal(JSON.stringify(core.collection(ctx,'cash_forecasts')[0]),before);assert.deepEqual(Array.from(i.missingKeys()),[]);
  horizon.value='0';await key('calculate').fire('click');assert.equal(calls.length,2);assert.equal(key('horizon_invalid').textContent,i.t('finance.cash.horizon_invalid'));
  deny=true;await key('reset').fire('click');assert.equal(key('opening'),undefined);assert.equal(key('baseline'),undefined);assert.equal(box.all().find(node=>node.tag==='output').textContent,i.t('common.access_denied'));assert.ok(!box.textContent.includes('RAW_PRIVATE_BACKEND'));
 }
});
test('cash editor refuses a source above its display bound without exposing partial editable assumptions',async()=>{
 const f=browserFixture('en-GB');vm.runInContext(fs.readFileSync(require.resolve('../finance-cash-scenarios-client'),'utf8'),f.context);let requests=0;
 const request=async()=>{requests++;return {source_hash:'bounded',baseline:{opening_cash_cents:0,horizon_days:30,entries:Array.from({length:201},(_,entry_index)=>({entry_index,date:'2026-09-01T00:00:00Z',amount_cents:1})),excluded_entries:[]}};};
 const box=f.nodes.cash=f.context.FoundlyFinanceCashScenarios.create({document:f.context.document,request,forecastId:'large-forecast'});await box.ready;
 assert.equal(box.all().some(node=>node.tag==='input'),false);assert.equal(box.all().some(node=>node.getAttribute('data-i18n')==='finance.cash.calculate'),false);assert.equal(box.all().find(node=>node.tag==='output').textContent,f.context.FoundlyI18n.t('finance.cash.too_many'));
 f.context.FoundlyI18n.setLocale('de-DE');assert.equal(requests,1);assert.equal(box.all().find(node=>node.tag==='output').textContent,f.context.FoundlyI18n.t('finance.cash.too_many'));
});
test('actual login handlers localize errors in eight locales without displaying backend text or changing customer data',async()=>{
 for(const locale of locales){const f=browserFixture(locale);f.loadLogin();f.nodes.identityUsername.value='alice';f.nodes.identityPassword.value='private';await f.nodes.identityForm.fire('submit');assert.equal(f.nodes.identityNotice.textContent,catalog.messages[locale]['identity.credentials_invalid']);assert.equal(f.nodes.customer.textContent,'Aanmelden');assert.equal(f.context.location.redirect,undefined);assert.equal(f.context.document.documentElement.lang,locale);assert.equal(f.nodes.identitySubmit.disabled,false);}
});
test('login-selected interface language is persisted only after successful sign-in, independently of conversation language',async()=>{
 const requests=[],f=browserFixture('nl-NL',async(path,init)=>{requests.push({path,body:JSON.parse(init.body)});return {ok:true,json:async()=>({})};});f.loadLogin();f.nodes.identityLocale.value='sv-SE';await f.nodes.identityLocale.fire('change');assert.equal(requests.length,0);await f.nodes.identityForm.fire('submit');assert.deepEqual(requests.map(r=>r.path),['/api/identity/login','/api/zero/preferences']);assert.deepEqual(requests[1].body,{ui_locale:'sv-SE'});assert.equal(f.context.location.redirect,'/');
});
test('visible sign-in errors and field validation follow subsequent locale changes without a second request',async()=>{
 let requests=0;const f=browserFixture('nl-NL',async()=>{requests++;return {ok:false,status:401,json:async()=>({code:'identity_credentials_invalid'})};});f.loadLogin();await f.nodes.identityForm.fire('submit');await f.nodes.identityPassword.fire('invalid');f.nodes.identityLocale.value='fr-FR';await f.nodes.identityLocale.fire('change');assert.equal(requests,1);assert.equal(f.nodes.identityNotice.textContent,catalog.messages['fr-FR']['identity.credentials_invalid']);assert.equal(f.nodes.identityPassword.validationMessage,catalog.messages['fr-FR']['common.required']);
});
test('ZERO greeting uses the conversation language while preserving the interface preference and literal name',()=>{
 const source=fs.readFileSync(require.resolve('../index-script.js'),'utf8'),start=source.indexOf('function greetingText('),end=source.indexOf('\nfunction ',start+1),f=browserFixture('en-GB');f.context.ZERO={preferences:{language:'de-DE',timezone:'UTC',preferred_address:'Élodie <name>'}};vm.runInContext(source.slice(start,end),f.context);const greeting=f.context.greetingText();assert.match(greeting,/Élodie <name>/);assert.match(greeting,/Wie kann ich helfen/);assert.equal(f.context.FoundlyI18n.locale,'en-GB');
});
test('late initial preference reads cannot overwrite a newer explicit locale choice',async()=>{
 let release;const f=browserFixture('nl-NL',()=>new Promise(r=>release=r),'/');f.context.FoundlyI18n.setLocale('fr-FR');release({ok:true,json:async()=>({preferences:{ui_locale:'de-DE'}})});await f.context.FoundlyI18n.ready;assert.equal(f.context.FoundlyI18n.locale,'fr-FR');
});
test('authenticated HTML preference is available synchronously before dynamic controls are created',async()=>{
 let release;const f=browserFixture('en-GB',()=>new Promise(resolve=>release=resolve),'/crm','sv-SE');assert.equal(f.context.FoundlyI18n.locale,'sv-SE');assert.equal(f.context.FoundlyI18n.t('common.save'),'Spara');release({ok:true,json:async()=>({preferences:{ui_locale:'sv-SE'}})});await f.context.FoundlyI18n.ready;assert.equal(f.context.FoundlyI18n.locale,'sv-SE');
});
test('streamed locale markup preserves UTF-8 and every unrelated byte across chunk boundaries',async()=>{
 const {Readable}=require('node:stream'),{htmlLanguageStream}=require('../static-response');
 const original='<!doctype html><html data-lang="literal" lang="nl"><body>Élodie — Ångström 🦊 <input value="DE"></body></html>',expected=Buffer.from(original.replace(' lang="nl"',' lang="de-DE"')),input=Buffer.from(original);
 for(const size of [1,2,7,65536]){const chunks=[];for(let index=0;index<input.length;index+=size)chunks.push(input.subarray(index,index+size));const output=[];for await(const chunk of Readable.from(chunks).pipe(htmlLanguageStream('de-DE')))output.push(chunk);assert.deepEqual(Buffer.concat(output),expected);}
 assert.throws(()=>htmlLanguageStream('en-GB" onclick="alert(1)'),/Invalid HTML locale/);
});
test('explicit static text bindings preserve nested inputs, canonical options and replacement customer text',()=>{
 const f=browserFixture('en-GB'),label=f.nodes.setting=new Element('label'),key=catalog.staticLookup['Man'];
 const input=new Element('input');input.value='CANONICAL_USER_DATA';const text={nodeType:3,textContent:' Man '};label.childNodes=[text,input];label.setAttribute('data-i18n-text',JSON.stringify({0:key}));
 f.context.FoundlyI18n.translate();assert.equal(text.textContent,' Male ');assert.equal(label.childNodes[1],input);assert.equal(input.value,'CANONICAL_USER_DATA');
 f.context.FoundlyI18n.setLocale('de-DE');assert.equal(text.textContent,' Männlich ');
 const customer={nodeType:3,textContent:'Man'};label.childNodes[0]=customer;f.context.FoundlyI18n.setLocale('fr-FR');assert.equal(customer.textContent,'Man','A native renderer owns replacement text even if it matches an original label');
 const html=fs.readFileSync(require.resolve('../index.html'),'utf8');for(const value of ['AUTO','LOW','BALANCED','HIGH','ULTRA'])assert.ok(html.includes('<option value="'+value+'"'),'Translated option keeps canonical value '+value);
});
test('actual ZERO telemetry follows the speech event independently of translated labels',()=>{
 const source=fs.readFileSync(require.resolve('../index-script.js'),'utf8'),start=source.indexOf('function setZeroState('),end=source.indexOf('\nfunction ',start+1),events=[];
 const context={ZERO_STATE_ALIAS:{},ZERO:{enabled:true,realtimeConnected:true,clientRealtimeReported:true},$:()=>null,document:{querySelector:()=>null},neuralRuntime:null,reportClientEvent:(...args)=>events.push(args)};vm.createContext(context);vm.runInContext(source.slice(start,end),context);
 context.setZeroState('LISTENING','Écoute…',{speech_started:true});assert.deepEqual(events,[['SPEECH_STARTED','webrtc']]);context.setZeroState('LISTENING','Other presentation text');assert.equal(events.length,1);
});
test('actual financial, CRM and vehicle presentation preserves calendar dates and does not fabricate zero from missing values',async()=>{
 const extract=(file,name)=>{const source=fs.readFileSync(require.resolve('../'+file),'utf8'),start=source.indexOf('function '+name+'('),end=source.indexOf('\nfunction ',start+1);assert.ok(start>=0&&end>start);return source.slice(start,end);};
 const context={FoundlyI18n:create('en-GB'),Intl:{...Intl,NumberFormat:Intl.NumberFormat,DateTimeFormat:function(locale,options){return new Intl.DateTimeFormat(locale,{timeZone:'America/New_York',...options});}}};vm.createContext(context);
 vm.runInContext(extract('finance-script.js','money')+extract('finance-script.js','formatDate'),context);assert.equal(context.money(123450),'€1,235');assert.equal(context.formatDate('2026-01-01'),'1 Jan 2026');
 vm.runInContext(extract('crm-script.js','formatMetric'),context);assert.equal(context.formatMetric({available:true,value:null,unit:'currency'}).available,false);assert.equal(context.formatMetric({available:true,value:0,unit:'currency'}).available,true);
 const vehicle=require('../zero-evaluation/automotive-page-fixture').fixture();await vehicle.context.loadStatus();await vehicle.context.loadToday();
 const card=value=>vehicle.context.vehicleCard({vehicle:{mileage_km:0},commercial:{gross_price_eur:value}});
 for(const value of [null,undefined,'',false,' ',true,NaN,Infinity])assert.equal(card(value).all().find(node=>node.className==='vehicle-price').textContent,'Unknown');
 assert.ok(card(0).textContent.includes('€0'));const mileage=vehicle.context.vehicleCard({vehicle:{mileage_km:1234.5}});vehicle.nodes.vehicleGrid.replaceChildren(mileage);vehicle.i.setLocale('de-DE');assert.equal(mileage.all().find(node=>node.getAttribute('data-i18n')==='automotive.search.mileage').parentNode.children[1].textContent,'1.234,5');
});
