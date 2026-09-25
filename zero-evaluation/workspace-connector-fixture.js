'use strict';
// Real shared controller with isolated request observations and a minimal DOM.
// No live provider request or real credential is used by this fixture.
const {fixture:page}=require('./workspace-page-fixture');
function fixture(){
 const f=page({workspaceId:'connectors'}),base=f.context.fetch;let pending=null,path='',started,remaining=0;
 const connector=id=>({connector_id:id,name:'Literal private '+id+' <img>',provider:'Literal provider',connection_state:'CONFIGURED',configuration_state:'CONFIGURED',authentication_state:'NOT_VERIFIED',probe_state:'NOT_RUN',sync_state:'NOT_RUN',records:0,last_probe:null,latency:null,freshness:'UNKNOWN',capabilities:[],industries:[],auth_type:'API_KEY',setup_action:'CONFIGURE_SECURELY',credential_contract:{accepts_tenant_encrypted_configuration:true,fields:[{key:'api_key',label:'Literal native field',secret:true}],environment_variable_status:[]},callback_contract:{required:false}});
 const responses={alpha:{connector:connector('alpha')},beta:{connector:connector('beta')},config:{ok:true,revision:0,configured:true,credential_fields:[]},save:null,probe:{ok:true,connector:{connected:false}},sync:{ok:true,id:'alpha',ingested:0}};
 f.context.fetch=async(route,options={})=>{
  const id=route.split('/').at(-1);let body;
  if(route.startsWith('/api/connector-registry/'))body=responses[id];
  else if(route.startsWith('/api/connector-runtime/config/'))body=options.method?(responses.save||{ok:true,id,revision:JSON.parse(options.body).expected_revision+1,request_id:options.headers?.['idempotency-key']}):responses.config;
  else if(route.startsWith('/api/connector-runtime/test/'))body=responses.probe;
  else if(route.startsWith('/api/connector-runtime/sync/'))body=responses.sync;
  else return base(route,options);
  f.calls.push({route,options});const data=JSON.stringify(body),status=responses.status||200;
  if(pending&&route===path&&remaining-->0){started();await pending;}
  return {ok:status>=200&&status<300,status,json:async()=>JSON.parse(data)};
 };
 return {...f,responses,form:()=>f.nodes.connectorDetail.querySelector('form'),holdConnector(route){path=route;remaining=1;let release;pending=new Promise(resolve=>release=resolve);release.started=new Promise(resolve=>started=resolve);return release;}};
}
module.exports={fixture};
