'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {create,locales}=require('../foundly-i18n'),catalog=require('../foundly-locales');
test('explicit catalogs preserve all supported locales, parameters, pluralisation and unknown-value semantics',()=>{
 const keys=Object.keys(catalog.messages['nl-NL']);for(const locale of locales){const i=create(locale);assert.deepEqual(Object.keys(catalog.messages[locale]),keys);for(const key of keys){const parameters=text=>[...new Set(String(text).match(/\{[a-z_][a-z_0-9]*\}/g)||[])].sort();const original=parameters(catalog.messages['nl-NL'][key]);assert.deepEqual(parameters(catalog.messages[locale][key]),original,key+' parameters in '+locale);const params=Object.fromEntries(original.map(name=>[name.slice(1,-1),'<customer text>']));assert.ok(i.t(key,{...params,count:2,time:'12:00',date:'DATE',zone:'UTC'}));}assert.equal(i.number(null),i.t('common.unknown'));assert.equal(i.currency(0,null),i.t('common.unknown'));assert.equal(i.number('1234'),i.t('common.unknown'));assert.equal(i.date(null),i.t('common.unknown'));assert.match(i.t('common.record_count',{count:2}),/2/);assert.equal(i.missingKeys().length,0);}
 const en=create('en-GB');assert.equal(en.number(1234.5),'1,234.5');assert.equal(create('de-DE').number(1234.5),'1.234,5');assert.equal(en.currency(12.5,'GBP'),'£12.50');assert.equal(en.date('2026-01-01T00:00:00Z',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}),'31/12/2025');
 assert.equal(en.t('common.record_count',{count:1}),'1 record');assert.equal(en.t('common.record_count',{count:0}),'0 records');assert.throws(()=>en.t('zero.time'),/parameter_required/);assert.throws(()=>en.setLocale('xx-XX'),/locale_unsupported/);assert.equal(en.t('absent'),'⟦absent:en-GB⟧');assert.deepEqual(en.missingKeys(),['absent']);
});
class Element{
 constructor(tag='div'){Object.assign(this,{tag,attrs:{},handlers:{},children:[],value:'',textContent:'',validity:{},disabled:false});}
 setAttribute(k,v){this.attrs[k]=String(v);}getAttribute(k){return this.attrs[k]??null;}removeAttribute(k){delete this.attrs[k];}
 matches(selector){return selector.split(',').some(s=>Object.hasOwn(this.attrs,s.trim().slice(1,-1)));}
 addEventListener(k,f){(this.handlers[k]??=[]).push(f);}async fire(k,event={}){for(const f of this.handlers[k]||[])await f({preventDefault(){},target:this,...event});}
 append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this.children=nodes;}after(node){this.following=node;}setCustomValidity(text){this.validationMessage=text;}
}
function browserFixture(locale='fr-FR',fetch=async()=>({ok:false,status:401,json:async()=>({code:'identity_credentials_invalid',error:'RAW_DUTCH_SECRET'})}),path='/login'){
 const nodes={},document=new Element('document');document.documentElement={lang:'nl'};document.createElement=tag=>new Element(tag);document.getElementById=id=>nodes[id]??=new Element();document.querySelectorAll=selector=>Object.values(nodes).filter(n=>n.matches(selector));document.dispatchEvent=event=>document.fire(event.type,event);
 for(const id of ['identityForm','identityUsername','identityPassword','identitySubmit','identityNotice','identityLocale','identityTitle','identityDescription','usernameLabel'])document.getElementById(id);
 const customer=document.getElementById('customer');customer.textContent='Aanmelden';
 const context={document,navigator:{languages:[locale]},location:{pathname:path,hash:'',assign(value){this.redirect=value;}},history:{replaceState(){}},fetch,URLSearchParams,Intl,CustomEvent:class{constructor(type,options){this.type=type;Object.assign(this,options);}}};
 vm.createContext(context);for(const file of ['foundly-static-copy.js','foundly-locales.js','foundly-i18n.js'])vm.runInContext(fs.readFileSync(require.resolve('../'+file),'utf8'),context);
 return {context,nodes,loadLogin(){vm.runInContext(fs.readFileSync(require.resolve('../identity-login.js'),'utf8'),context);}};
}
test('actual login handlers localize errors in eight locales without displaying backend text or changing customer data',async()=>{
 for(const locale of locales){const f=browserFixture(locale);f.loadLogin();f.nodes.identityUsername.value='alice';f.nodes.identityPassword.value='private';await f.nodes.identityForm.fire('submit');assert.equal(f.nodes.identityNotice.textContent,catalog.messages[locale]['identity.credentials_invalid']);assert.equal(f.nodes.customer.textContent,'Aanmelden');assert.equal(f.context.location.redirect,undefined);assert.equal(f.context.document.documentElement.lang,locale);assert.equal(f.nodes.identitySubmit.disabled,false);}
});
test('login-selected interface language is persisted only after successful sign-in, independently of conversation language',async()=>{
 const requests=[],f=browserFixture('nl-NL',async(path,init)=>{requests.push({path,body:JSON.parse(init.body)});return {ok:true,json:async()=>({})};});f.loadLogin();f.nodes.identityLocale.value='sv-SE';await f.nodes.identityLocale.fire('change');assert.equal(requests.length,0);await f.nodes.identityForm.fire('submit');assert.deepEqual(requests.map(r=>r.path),['/api/identity/login','/api/zero/preferences']);assert.deepEqual(requests[1].body,{ui_locale:'sv-SE'});assert.equal(f.context.location.redirect,'/');
});
test('late initial preference reads cannot overwrite a newer explicit locale choice',async()=>{
 let release;const f=browserFixture('nl-NL',()=>new Promise(r=>release=r),'/');f.context.FoundlyI18n.setLocale('fr-FR');release({ok:true,json:async()=>({preferences:{ui_locale:'de-DE'}})});await f.context.FoundlyI18n.ready;assert.equal(f.context.FoundlyI18n.locale,'fr-FR');
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
test('actual financial, CRM and vehicle presentation preserves calendar dates and does not fabricate zero from missing values',()=>{
 const extract=(file,name)=>{const source=fs.readFileSync(require.resolve('../'+file),'utf8'),start=source.indexOf('function '+name+'('),end=source.indexOf('\nfunction ',start+1);assert.ok(start>=0&&end>start);return source.slice(start,end);};
 const context={FoundlyI18n:create('en-GB'),Intl:{...Intl,NumberFormat:Intl.NumberFormat,DateTimeFormat:function(locale,options){return new Intl.DateTimeFormat(locale,{timeZone:'America/New_York',...options});}}};vm.createContext(context);
 vm.runInContext(extract('finance-script.js','money')+extract('finance-script.js','formatDate'),context);assert.equal(context.money(123450),'€1,235');assert.equal(context.formatDate('2026-01-01'),'1 Jan 2026');
 vm.runInContext(extract('crm-script.js','formatMetric'),context);assert.equal(context.formatMetric({available:true,value:null,unit:'currency'}).available,false);assert.equal(context.formatMetric({available:true,value:0,unit:'currency'}).available,true);
 vm.runInContext(extract('automotive-script.js','formatEur')+extract('automotive-script.js','formatNumber'),context);for(const value of [null,undefined,'',false,' '])assert.equal(context.formatEur(value),'Unknown');assert.equal(context.formatNumber(0),'0');context.FoundlyI18n.setLocale('de-DE');assert.equal(context.formatNumber(1234.5),'1.234,5');
});
