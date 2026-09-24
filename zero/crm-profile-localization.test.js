'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),crypto=require('node:crypto');
const {FoundlyCrmCore}=require('../crm-core'),{create,locales}=require('../foundly-i18n'),{defaults}=require('../crm-pipeline-editor'),{fixture}=require('../zero-evaluation/fixture');
const profile={business_name:'Aanmelden <literal name>',country:'NL',industry:'professional_services',segment:'enterprise'};
function storage(){let rows=new Map(),disk='[]';const adapter={bucket(ctx,scope){const key=ctx.tenant_id+':'+ctx.dealer_id+':'+scope;if(!rows.has(key))rows.set(key,[]);return rows.get(key);},persist(){disk=JSON.stringify([...rows]);}};return {adapter,restart(){rows=new Map(JSON.parse(disk));},size:()=>rows.size};}
test('native CRM profile defaults use the explicit locale and preserve canonical stages, customer names and persisted edits on replay',()=>{
 for(const locale of locales){
  const store=storage(),ctx={tenant_id:'locale-profile',dealer_id:'default'},actor={id:'profile-manager',roles:['MANAGER']};let core=new FoundlyCrmCore(store.adapter);
  const input={...profile,defaults_locale:locale},options={idempotencyKey:'profile-language-'+locale},result=core.provisionProfile(ctx,actor,input,options),expected=defaults(create(locale));
  assert.equal(result.profile.defaults_locale,locale);assert.equal(result.profile.crm_config.locale,'nl-NL');assert.equal(result.profile.business_name,profile.business_name);assert.deepEqual(result.stages.map(row=>({name:row.name,probability:row.probability,status:row.status})),expected);
  assert.equal(core.list(ctx,actor,'leads').total,0);const changed=core.update(ctx,actor,'stages',result.stages[0].id,{name:'Handmatige klantfase'},{});assert.equal(changed.status,'OPEN');store.restart();core=new FoundlyCrmCore(store.adapter);
  const replay=core.provisionProfile(ctx,actor,input,options);assert.equal(replay.idempotent_replay,true);assert.equal(replay.pipeline.id,result.pipeline.id);assert.equal(core.list(ctx,actor,'stages').total,6);assert.equal(core.get(ctx,actor,'stages',changed.id).name,'Handmatige klantfase');
  assert.throws(()=>core.provisionProfile(ctx,actor,{...input,defaults_locale:locale==='nl-NL'?'en-GB':'nl-NL'},options),error=>error.code==='crm_idempotency_conflict');
  actor.roles=['VIEWER'];assert.throws(()=>core.provisionProfile(ctx,actor,input,options),error=>error.code==='crm_forbidden');
 }
 const store=storage(),core=new FoundlyCrmCore(store.adapter),ctx={tenant_id:'invalid-locale',dealer_id:'default'},actor={id:'manager',roles:['MANAGER']};
 assert.throws(()=>core.provisionProfile(ctx,actor,{...profile,defaults_locale:'xx-XX'}),error=>error.code==='crm_profile_locale_invalid');assert.equal(store.size(),0);
 const overridden=core.provisionProfile(ctx,actor,{...profile,locale:'en-GB',crm_config:{locale:'de-DE'}});assert.equal(overridden.profile.crm_config.locale,'de-DE');assert.equal(overridden.stages[0].name,create('de-DE').t('crm.pipeline.new'));
 const regional=core.provisionProfile(ctx,actor,{...profile,locale:'en-US'},{idempotencyKey:'regional-locale-preserved'});assert.equal(regional.profile.crm_config.locale,'en-US');assert.equal(regional.stages[0].name,'New');
 const separate=core.provisionProfile(ctx,actor,{...profile,crm_config:{locale:'pt-BR'},defaults_locale:'sv-SE'},{idempotencyKey:'separate-locale-settings'});assert.equal(separate.profile.crm_config.locale,'pt-BR');assert.equal(separate.stages[0].name,create('sv-SE').t('crm.pipeline.new'));
});

function controller(locale,afterWrite=()=>{}){
 const store=storage(),core=new FoundlyCrmCore(store.adapter),ctx={tenant_id:'profile-client',dealer_id:'default'},actor={id:'manager',roles:['MANAGER']},state={},i18n=create(locale),calls=[],inputs=Object.entries(profile).map(([name,value])=>({name,value,disabled:false})),submit={disabled:false};let formReads=0;
 const form={children:[],append(node){this.children.push(node);},querySelector:()=>submit,querySelectorAll:()=>inputs,reset(){for(const field of inputs)field.value='';}};
 const document={createElement:()=>({textContent:'',setAttribute(){}})};
 const sandbox={state,document,FoundlyI18n:i18n,crypto,FormData:class{constructor(){formReads++;}entries(){return inputs.filter(node=>!node.disabled).map(node=>[node.name,node.value]);}},loadStatus:async()=>{},api:async(path,options)=>{assert.equal(path,'/api/crm/provision');calls.push({body:options.body,key:options.headers['idempotency-key']});const result=core.provisionProfile(ctx,actor,JSON.parse(options.body),{idempotencyKey:options.headers['idempotency-key']});await afterWrite(result);return result;}};
 const source=fs.readFileSync(require.resolve('../crm-script'),'utf8'),start=source.indexOf('async function provision('),end=source.indexOf('\n\nfunction runUiCommands',start);assert.ok(start>=0&&end>start);vm.createContext(sandbox);vm.runInContext(source.slice(start,end),sandbox);
 return {state,i18n,calls,inputs,actor,core,ctx,formReads:()=>formReads,submit:()=>sandbox.provision({currentTarget:form,preventDefault(){}})};
}
test('actual CRM profile form snapshots the interface locale and handles a lost committed response without duplicate configuration',async()=>{
 for(const locale of locales){
  let lose=true;const f=controller(locale,()=>{if(lose){lose=false;throw Error('simulated lost response');}});await assert.rejects(f.submit(),/lost response/);assert.ok(f.inputs.every(node=>node.disabled));assert.equal(f.state.provisionBusy,false);
  f.i18n.setLocale(locale==='sv-SE'?'de-DE':'sv-SE');f.inputs[0].value='Changed after submission';await f.submit();assert.equal(f.formReads(),1);assert.deepEqual(f.calls[0],f.calls[1]);assert.equal(JSON.parse(f.calls[1].body).defaults_locale,locale);assert.equal(f.core.list(f.ctx,f.actor,'pipelines').total,1);assert.equal(f.core.list(f.ctx,f.actor,'stages').total,6);assert.equal(f.state.provisionRequest,null);assert.ok(f.inputs.every(node=>!node.disabled&&node.value===''));assert.ok(f.state.provisionNotice.textContent.includes(profile.business_name));
 }
});
test('CRM profile form rejects overlapping submits and keeps retries subject to current permissions',async()=>{
 let release;const gate=new Promise(resolve=>release=resolve);let first=true;const f=controller('fr-FR',async()=>{if(first){first=false;await gate;throw Error('lost response');}});const pending=f.submit();await f.submit();assert.equal(f.calls.length,1);release();await assert.rejects(pending,/lost response/);
 f.actor.roles=['VIEWER'];await assert.rejects(f.submit(),error=>error.code==='crm_forbidden');assert.notEqual(f.state.provisionRequest,null);f.actor.roles=['MANAGER'];await f.submit();assert.equal(f.core.list(f.ctx,f.actor,'pipelines').total,1);assert.equal(f.core.list(f.ctx,f.actor,'stages').total,6);
});
test('native CRM HTTP profile locale is validated, persisted and replayed independently of conversation language',async()=>{
 const f=await fixture();try{
  await f.request('/api/zero/preferences','PUT',{ui_locale:'fr-FR',language:'de-DE'});
  const payload={...profile,defaults_locale:'fr-FR'},headers={'idempotency-key':'profile-locale-http'};let r=await f.request('/api/crm/provision','POST',payload,null,headers);assert.equal(r.status,201);assert.equal(r.body.stages[0].name,'Nouveau');assert.equal(r.body.profile.crm_config.locale,'nl-NL');assert.equal(r.body.profile.defaults_locale,'fr-FR');const pipeline=r.body.pipeline.id;
  await f.request('/api/zero/preferences','PUT',{ui_locale:'sv-SE'});r=await f.request('/api/crm/provision','POST',payload,null,headers);assert.equal(r.status,201);assert.equal(r.body.idempotent_replay,true);assert.equal(r.body.pipeline.id,pipeline);assert.equal(r.body.stages[0].name,'Nouveau');
  r=await f.request('/api/crm/provision','POST',{...profile,defaults_locale:'unsupported'});assert.equal(r.status,400);assert.equal(r.body.code,'crm_profile_locale_invalid');assert.equal((await f.request('/api/zero/preferences')).body.preferences.language,'de-DE');
 }finally{await f.close();}
});
