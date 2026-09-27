'use strict';
const {fixture:page}=require('./workspace-page-fixture');
function fixture(){
 const f=page(),base=f.context.fetch;let held=null,started,remaining=0;
 const response={ok:true,workspace_id:'data',section:'SCHEMAS',status:'AVAILABLE',items:[{title:'Literal source <img>',record_type:'Literal private schema',records_available:1234,confidence:null,updated_at:'2026-09-25T06:00:00Z',custom_field:'CONNECTED'}],source:'OBSERVED_RECORD_SCHEMAS'};
 f.context.fetch=async(route,options={})=>{
  if(!route.includes('/sections/'))return base(route,options);f.calls.push({route,options});const data=JSON.stringify(response),status=response.httpStatus||200;
  if(held&&remaining-->0){started();await held;}
  return {ok:status>=200&&status<300,status,json:async()=>JSON.parse(data)};
 };
 f.ui.state.activeSection='SCHEMAS';
 return {...f,response,show:()=>f.ui.renderEvidenceSection('SCHEMAS',f.nodes.contextContent),holdEvidence(){remaining=1;let release;held=new Promise(resolve=>release=resolve);release.started=new Promise(resolve=>started=resolve);return release;}};
}
module.exports={fixture};
