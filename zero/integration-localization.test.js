'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {browserFixture,Element}=require('../zero-evaluation/dom-fixture'),{locales}=require('../foundly-i18n');
const source=fs.readFileSync(require.resolve('../index-script.js'),'utf8');
const controller=source.slice(source.indexOf('function connectorBy('),source.indexOf('const AUTOMOTIVE_SOURCE_GROUPS='));
function fixture(locale='en-GB'){
  const f=browserFixture(locale),requests=[],alerts=[],prompts=[];
  for(const id of ['integrationGrid','integrationSummary','integrationOutput','integrationSelfCheck','unsaved'])f.nodes[id]=new Element(id==='unsaved'?'input':'div');
  f.nodes.unsaved.value='Integraties laden… <literal customer draft>';
  const profile={id:'literal_id',naam:'Integraties laden… <img onerror="example">',categorie:'customer_category',auth_strategy:'api_key_header',sync:{path:'/search'},credential_fields:[{key:'api_key',label:'Literal key label'}],base_url:'https://api.example.test'};
  const status={connected:1234,total:2345,configured:2000,connectors:[{id:profile.id,connected:true,configured:true}]};
  Object.assign(f.context,{window:f.context,$:selector=>f.nodes[selector.slice(1)]||null,alert:message=>alerts.push(message),prompt:(message,value)=>{prompts.push({message,value});return null},confirm:()=>true,loadSystemStatus:async()=>{},fetch:async(url,init)=>{requests.push({url,init});return {ok:true,status:200,json:async()=>url==='/api/connector-runtime/profiles'?{profiles:[profile]}:url==='/api/connectors'?status:url.startsWith('/api/connector-runtime/profile/')?{profile}:url.startsWith('/api/connector-runtime/test/')?{connector:{...profile,connected:true}}:{ok:true}}}});
  vm.runInContext(controller,f.context);
  return {...f,requests,alerts,prompts,profile,status,i:f.context.FoundlyI18n};
}
function button(card,action){return card.all().find(node=>node.dataset[action]);}
test('actual integration cards change all eight locales in place, preserving literal data, controls and native keys',async()=>{
  const f=fixture();await f.context.renderIntegrations();
  const grid=f.nodes.integrationGrid,card=grid.children[1],connect=button(card,'connect'),profile=button(card,'profile'),count=f.requests.length;
  const literal=card.children[0].textContent;assert.equal(literal,f.profile.naam);assert.equal(card.getAttribute('data-connector'),'literal_id');
  assert.deepEqual(card.children.map(node=>node.tag),['b','span','span','div']);assert.equal(card.className,'subCard integrationCard');
  for(const locale of locales){
    f.i.setLocale(locale);assert.equal(grid.children[1],card);assert.equal(button(card,'connect'),connect);assert.equal(button(card,'profile'),profile);
    assert.equal(card.children[1].textContent,f.i.t('integrations.live'));assert.equal(profile.textContent,f.i.t('integrations.profile'));assert.equal(connect.textContent,f.i.t('integrations.connected'));
    assert.equal(card.children[0].textContent,literal);assert.equal(card.children[2].textContent,'api_key_header');assert.equal(grid.children[0].textContent,'customer category');
    assert.equal(profile.dataset.profile,'literal_id');assert.equal(f.nodes.unsaved.value,'Integraties laden… <literal customer draft>');assert.equal(f.requests.length,count);
    assert.equal(f.nodes.integrationSummary.textContent,f.i.number(1234)+'/'+f.i.number(2345)+' '+f.i.t('integrations.summary_connected')+' '+f.i.number(2000)+' '+f.i.t('integrations.summary_configured'));
    assert.equal(f.i.missingKeys().length,0);
  }
  const google=f.context.integrationCard({id:'google_ads',configured:true}),openai=f.context.integrationCard({id:'openai',configured:true}),unknown=f.context.integrationCard({id:'new',error:'Integraties laden… <literal provider detail>'});f.nodes.more=new Element();f.nodes.more.append(google,openai,unknown);
  for(const locale of locales){f.i.setLocale(locale);assert.equal(button(google,'connect').textContent,'GOOGLE OAUTH');assert.equal(button(openai,'profile').disabled,true);assert.equal(button(openai,'profile').getAttribute('title'),f.i.t('integrations.profile_managed'));assert.equal(button(openai,'sync').disabled,true);assert.equal(button(openai,'disconnect').disabled,true);assert.equal(unknown.children[1].textContent,f.i.t('integrations.unconfigured'));assert.equal(unknown.children[2].textContent,f.i.t('integrations.auth_configurable')+' · Integraties laden… <literal provider detail>');}
  await f.context.renderIntegrations();f.i.setLocale('fr-FR');assert.ok(f.nodes.integrationSummary.textContent.includes(f.i.t('integrations.summary_connected')));assert.ok(f.nodes.integrationSummary.textContent.endsWith(f.i.t('integrations.summary_configured')));
});
function googleFixture(){const f=fixture();for(const id of ['googleOutput','googleStateText','googleSearch','googleDisconnect'])f.nodes[id]=new Element(id.endsWith('Search')||id.endsWith('Disconnect')?'button':'div');return f;}
test('Google search keeps query, answer and citations literal while only its framing changes locale, including after another result',async()=>{
  const f=googleFixture(),query='Customer search query · Aanmelden',answer='BRONNEN <literal customer answer>',citations=[{title:'Aanmelden <literal title>',url:'https://example.test/a?x=BRONNEN'}];let result={text:answer,sources:citations},calls=0;
  f.context.prompt=message=>{assert.equal(message,f.i.t('google.search_prompt'));return query};f.context.fetch=async(url,init)=>{calls++;assert.equal(url,'/api/search/web');assert.equal(init.method,'POST');assert.deepEqual(JSON.parse(init.body),{query});return {ok:true,status:200,json:async()=>result}};
  await f.context.runWebSearch();const answerNode=f.nodes.googleOutput.childNodes[0],sourceNode=f.nodes.googleOutput.childNodes[2];
  for(const locale of locales){f.i.setLocale(locale);assert.equal(f.nodes.googleOutput.childNodes[0],answerNode);assert.equal(answerNode.textContent,answer);assert.equal(f.nodes.googleOutput.childNodes[2],sourceNode);assert.ok(sourceNode.textContent.includes(citations[0].url));assert.equal(f.nodes.googleOutput.childNodes[1].textContent,'\n\n'+f.i.t('google.sources')+'\n');assert.equal(calls,1);}
  result={sources:citations};await f.context.runWebSearch();await f.context.runWebSearch();assert.equal(calls,3);f.i.setLocale('de-DE');assert.equal(f.nodes.googleOutput.childNodes[0].textContent,f.i.t('google.no_answer'));assert.equal(f.nodes.googleOutput.childNodes[1].textContent,'\n\n'+f.i.t('google.sources')+'\n');assert.equal(calls,3);
});
test('Google status distinguishes configured AI from a live service and preserves unknown status on read failure',async()=>{
  const f=googleFixture();let calls=0,fail=false;
  f.context.fetch=async(url)=>{calls++;assert.equal(url,'/api/google/status');return {ok:!fail,status:fail?403:200,json:async()=>fail?{error:'RAW_SERVER_SECRET'}:{token_stored:true,services:{google_ads:true,ga4:false,search_console:false,google_calendar:false},openai_search:{configured:true}}}};
  await f.context.refreshGooglePanel();const labels=f.nodes.googleStateText.children;
  for(const locale of locales){f.i.setLocale(locale);assert.equal(labels[0].textContent,f.i.t('google.linked'));assert.equal(labels[1].textContent,f.i.t('google.live'));assert.equal(labels[2].textContent,f.i.t('google.off'));assert.equal(labels[5].textContent,f.i.t('google.configured'));assert.ok(f.nodes.googleStateText.textContent.includes(f.i.t('google.ai_search_label')));assert.equal(calls,1);}
  fail=true;await f.context.refreshGooglePanel();for(const locale of locales){f.i.setLocale(locale);assert.ok(f.nodes.googleStateText.children.every(node=>node.textContent===f.i.t('common.unknown')));assert.ok(f.nodes.googleOutput.textContent.includes(f.i.t('common.access_denied')));assert.doesNotMatch(f.nodes.googleOutput.textContent,/RAW_SERVER_SECRET/);assert.equal(calls,2);}
});
test('Google search cancellation and duplicate clicks do not dispatch and a failed disconnect does not report success',async()=>{
  const f=googleFixture();let calls=0,release;
  f.context.prompt=()=>null;f.context.fetch=async()=>{calls++;return new Promise(resolve=>release=resolve)};await f.context.runWebSearch();assert.equal(calls,0);
  f.context.prompt=()=> 'literal';const pending=f.context.runWebSearch();await f.context.runWebSearch();assert.equal(calls,1);assert.equal(f.nodes.googleSearch.disabled,true);f.i.setLocale('da-DK');assert.equal(f.nodes.googleOutput.textContent,f.i.t('google.searching'));assert.equal(calls,1);
  release({ok:false,status:429,json:async()=>({error:'RAW_SERVER_SECRET'})});await pending;assert.equal(f.nodes.googleSearch.disabled,false);assert.equal(f.nodes.googleOutput.textContent,f.i.t('common.rate_limited'));
  f.context.confirm=()=>false;await f.context.disconnectGooglePanel();assert.equal(calls,1);f.context.confirm=()=>true;f.context.fetch=async(url,init)=>{calls++;assert.equal(url,'/api/google/disconnect');assert.equal(init.method,'POST');assert.equal(init.body,'{}');return {ok:false,status:403,json:async()=>({error:'RAW_SERVER_SECRET'})}};await f.context.disconnectGooglePanel();assert.equal(calls,2);assert.ok(f.nodes.googleOutput.textContent.includes(f.i.t('common.access_denied')));assert.equal(f.nodes.googleDisconnect.disabled,false);
});
test('late Google status failure cannot overwrite a newer search result or a replaced panel',async()=>{
  const f=googleFixture();let release;
  f.context.fetch=async(url)=>url==='/api/google/status'?new Promise(resolve=>release=resolve):{ok:true,status:200,json:async()=>({text:'New literal result'})};
  const pending=f.context.refreshGooglePanel();f.context.prompt=()=> 'explicit query';await f.context.runWebSearch();release({ok:false,status:403,json:async()=>({})});await pending;assert.equal(f.nodes.googleOutput.textContent,'New literal result');
  const old=f.nodes.googleStateText;const later=f.context.refreshGooglePanel();f.nodes.googleStateText=new Element();f.nodes.googleStateText.textContent='New panel';release({ok:false,status:403,json:async()=>({})});await later;assert.equal(f.nodes.googleStateText.textContent,'New panel');assert.equal(old.textContent,f.i.t('google.loading'));
});
test('integration refresh ignores late older results and localizes denied responses without raw server details',async()=>{
  const f=fixture();let release;const normal=f.context.fetch;let first=true;
  f.context.fetch=async(url,init)=>{if(first&&url.endsWith('/profiles')){first=false;return new Promise(resolve=>release=resolve)}return normal(url,init)};
  const old=f.context.renderIntegrations();await f.context.renderIntegrations();const card=f.nodes.integrationGrid.children[1];
  release({ok:true,status:200,json:async()=>({profiles:[{id:'stale',naam:'OLD'}]})});await old;assert.equal(f.nodes.integrationGrid.children[1],card);
  f.context.fetch=async()=>({ok:false,status:403,json:async()=>({code:'constructor',error:'RAW_SERVER_SECRET'})});await f.context.renderIntegrations();
  for(const locale of locales){f.i.setLocale(locale);assert.equal(f.nodes.integrationOutput.textContent,f.i.t('integrations.failed',{reason:f.i.t('common.access_denied')}));assert.equal(f.nodes.integrationSummary.textContent,f.i.t('common.unknown'));assert.doesNotMatch(f.nodes.integrationGrid.textContent,/RAW_SERVER_SECRET|OLD/);}
});
test('native TEST has one request through duplicate clicks and a locale change, then restores the live status',async()=>{
  const f=fixture();await f.context.renderIntegrations();const b=button(f.nodes.integrationGrid.children[1],'test'),normal=f.context.fetch;let release,writes=0;
  f.context.fetch=async(url,init)=>{if(url.startsWith('/api/connector-runtime/test/')){writes++;return new Promise(resolve=>release=resolve)}return normal(url,init)};
  const event={target:b},pending=f.context.handleIntegrationClick(event);await f.context.handleIntegrationClick(event);assert.equal(writes,1);assert.equal(b.disabled,true);
  f.i.setLocale('sv-SE');assert.equal(b.textContent,f.i.t('integrations.testing'));assert.equal(writes,1);
  release({ok:true,status:200,json:async()=>({connector:{name:f.profile.naam,connected:true}})});await pending;
  assert.equal(writes,1);assert.equal(f.alerts[0],f.profile.naam+': '+f.i.t('integrations.live'));assert.equal(b.disabled,false);assert.equal(button(f.nodes.integrationGrid.children[1],'test').textContent,f.i.t('integrations.test'));
});
test('profile and creation prompts cancel at every step without mutation; completed native payloads retain original keys and values',async()=>{
  for(const locale of locales){
    for(const [method,total] of [['editConnectorProfile',4],['addRuntimeConnector',5]])for(let cancelled=0;cancelled<total;cancelled++){
      const f=fixture(locale);let at=0;f.context.prompt=()=>at++===cancelled?null:'literal';await f.context[method]('literal_id');assert.equal(f.requests.filter(r=>r.init?.method).length,0,`${locale} ${method} cancellation ${cancelled}`);
    }
    const f=fixture(locale),answers=['https://api.example.test/new','/health','/search','basic'];f.context.prompt=(message)=>{f.prompts.push(message);return answers.shift()};await f.context.editConnectorProfile('literal_id');
    const write=f.requests.find(r=>r.init?.method==='PUT');assert.equal(write.url,'/api/connector-runtime/profile/literal_id');assert.deepEqual(JSON.parse(write.init.body),{base_url:'https://api.example.test/new',health:{path:'/health'},sync:{path:'/search'},auth_strategy:'basic'});assert.ok(f.prompts[0].includes(f.i.t('integrations.base_url')));assert.ok(f.prompts[3].endsWith('(public / basic / bearer / api_key_header / oauth2_authorization_code / webhook)'));
  }
});
test('connect and disconnect retain dedicated routing, credential schemas and explicit confirmation',async()=>{
  const f=fixture('de-DE');f.context.prompt=()=> 'literal-secret-test-value';await f.context.connectConnector('literal_id');
  const saved=f.requests.find(r=>r.url==='/api/connector-runtime/config/literal_id');assert.deepEqual(JSON.parse(saved.init.body),{credentials:{api_key:'literal-secret-test-value'},profile_overrides:{}});assert.ok(f.requests.some(r=>r.url==='/api/connector-runtime/test/literal_id'&&r.init.method==='POST'));
  const before=f.requests.length;await f.context.connectConnector('meta');assert.equal(f.context.location.href,'/api/connect/meta?return_to=/?open=integraties');await f.context.connectConnector('openai');assert.equal(f.requests.length,before);assert.ok(f.alerts.at(-1).includes('OPENAI_API_KEY'));
  for(const [id,url,method] of [['google_ads','/api/google/disconnect','POST'],['instagram','/api/connect/meta/disconnect','POST'],['literal_id','/api/connector-runtime/config/literal_id','DELETE']]){
    const b=new Element('button');b.setAttribute('data-disconnect',id);f.context.confirm=()=>false;let count=f.requests.length;await f.context.handleIntegrationClick({target:b});assert.equal(f.requests.length,count);
    f.context.confirm=message=>{assert.equal(message,f.i.t('integrations.disconnect_confirm',{name:id}));return true};await f.context.handleIntegrationClick({target:b});const sent=f.requests.slice(count).find(r=>r.init?.method===method);assert.equal(sent.url,url);assert.equal(sent.init.body,method==='POST'?'{}':undefined);
  }
});
test('self-check localizes one bounded result without replaying worker execution or inventing missing counts',async()=>{
  const f=fixture();let writes=0;
  f.context.fetch=async(url,init)=>{if(init?.method)writes++;const body=url==='/api/diagnostics/config'?{version:'6.0',encryption:{configured:true}}:url==='/api/integrations/status'?{connected:1000,total:2000,configured:1500}:url==='/api/ready'?{ready:false,checks:{storage_writable:true,persistent_mount:false},failed:['mount_missing']}:url==='/api/zero/self-check'?{ok:true,failed:[]}:{processed:[],auto_sync:[]};return {ok:url!=='/api/ready',status:url==='/api/ready'?503:200,json:async()=>body}};
  await f.context.integrationSelfCheck();assert.equal(writes,1);
  for(const locale of locales){f.i.setLocale(locale);const result=f.nodes.integrationOutput.textContent;assert.ok(result.includes(f.i.t('integrations.blocked')));assert.ok(result.includes(f.i.t('integrations.unproven')));assert.ok(result.includes('mount_missing'));assert.ok(result.includes(f.i.number(1000)));assert.equal(writes,1);assert.equal(f.i.missingKeys().length,0);}
  f.context.fetch=async(url,init)=>{if(init?.method)writes++;return {ok:true,status:200,json:async()=>({})}};await f.context.integrationSelfCheck();assert.equal(writes,2);assert.ok(f.nodes.integrationOutput.textContent.includes(f.i.t('common.unknown')));assert.doesNotMatch(f.nodes.integrationOutput.textContent,/NaN|undefined/);
  f.context.fetch=async()=>({ok:false,status:403,json:async()=>({error:'RAW_SERVER_SECRET'})});await f.context.integrationSelfCheck();assert.equal(writes,2);assert.doesNotMatch(f.nodes.integrationOutput.textContent,/RAW_SERVER_SECRET/);assert.ok(f.nodes.integrationOutput.textContent.includes(f.i.t('common.access_denied')));
});
