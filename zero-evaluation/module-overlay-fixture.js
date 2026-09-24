'use strict';
// Minimal DOM/controller fixture. Does not prove browser layout or provider connectivity.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {fixture:baseFixture,ViewElement,extract}=require('./zero-presentation-fixture');
const source=fs.readFileSync(require.resolve('../index-script.js'),'utf8');
const moduleDeclaration=source.slice(source.indexOf('const MODULES='),source.indexOf(' const CROSS='));
const modules=vm.runInNewContext(moduleDeclaration+';MODULES');
function fixture(){
  const f=baseFixture('en-GB'),requests=[],focus=[],queries=[],prompts=[];
  const nodes=()=>[...new Set(Object.values(f.nodes).flatMap(node=>node.all()))];
  const get=id=>nodes().find(node=>node.id===id)||f.nodes[id]||null;
  f.context.$=selector=>get(selector.slice(1));
  f.context.document.querySelector=selector=>selector.startsWith('#')?get(selector.slice(1)):null;
  f.context.document.querySelectorAll=selector=>nodes().filter(node=>node.matches(selector));
  f.context.focusOn=id=>focus.push(id);f.context.location.assign=path=>{f.context.location.redirect=path};
  f.context.prompt=message=>{prompts.push(message);return null};
  const snapshot={external_sources:{connected:[{id:'literal_provider',name:'Geen geverifieerde externe bron <literal provider>',connected:true,probe_ok:true}],configured:[],total_connected:1,total_configured:0},foundly_data_layer:{records:1234},local_persistence:{writable:true,separate_mount:false},historical_internal_data:{records:1000,memory_records:234},derived_intelligence:{records:0,decision_records:0}};
  const response=path=>({ok:true,status:200,json:async()=>path.startsWith('/api/engine/')?{sources:snapshot}:{sources:[{source_id:'rdw',connection_status:'CONNECTED'},{source_id:'ecb_fx',connection_status:'CONFIGURED'}]}});
  f.context.fetch=async(path,options)=>{requests.push({path,options});return response(path)};
  Object.assign(f.context,{refreshGooglePanel:async()=>{},runWebSearch:async()=>{},disconnectGooglePanel:async()=>{},renderIntegrations:async()=>{},integrationSelfCheck:async()=>{},addRuntimeConnector:async()=>{},handleIntegrationClick:async()=>{}});
  vm.runInContext(moduleDeclaration+'\n'+['dashboardCount','dashboardNumber'].map(extract).join('\n')+'\n'+source.slice(source.indexOf('const AUTOMOTIVE_SOURCE_GROUPS='),source.indexOf('\nfunction zeroCopy(')),f.context);
  f.context.askModule=(id,q)=>queries.push({id,q});
  return {...f,requests,focus,queries,prompts,snapshot,response,get,all:nodes};
}
function value(f,key){const p=f.nodes.layerBody.all().find(node=>Object.values(JSON.parse(node.getAttribute('data-i18n-text')||'{}')).includes(key));assert.ok(p,key);const keys=JSON.parse(p.getAttribute('data-i18n-text'));const slot=Number(Object.entries(keys).find(([,k])=>k===key)[0]);return p.childNodes[slot+2];}
module.exports={fixture,modules,value};
