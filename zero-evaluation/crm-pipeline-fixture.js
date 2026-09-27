'use strict';
const {fixture:page,CrmView}=require('./crm-dashboard-fixture'),{fixture:storage}=require('./crm-save-fixture');
function fixture(){
 const f=page(),native=storage();native.actor.roles=['MANAGER'];const form=f.nodes.pipelineForm,name=new CrmView('input'),submit=new CrmView('button');name.setAttribute('name','name');submit.setAttribute('type','submit');form.elements={name};form.append(name,submit);const query=form.querySelector.bind(form);form.querySelector=selector=>selector==='button[type="submit"]'?submit:selector==='input[name="name"]'?name:query(selector);f.context.FoundlyCrmPipelineEditor=require('../crm-pipeline-editor');f.context.requestAnimationFrame=()=>{};f.context.openPipelineDialog();name.value='Literal private pipeline';
 let malformed=false,lose=false,gate=null,started=()=>{};const writes=[];
 f.context.fetch=async(path,options={})=>{f.calls.push({path,options});let status=200,data;try{
  if(f.errors.has(path))throw Object.assign(Error('Private error'),{statusCode:f.errors.get(path),code:'crm_forbidden'});
  if(options.method==='POST'){writes.push({path,options});data={record:native.core.create(native.ctx,native.actor,path.split('/')[3],JSON.parse(options.body),{idempotencyKey:options.headers['idempotency-key']})};if(gate){started();await gate;gate=null;}if(lose){lose=false;throw Object.assign(Error('Lost committed pipeline reply'),{transport:true});}if(malformed&&path.endsWith('/'+malformed)){malformed=false;data={};}}
  else if(path.endsWith('/board'))data={board:native.core.pipelineBoard(native.ctx,native.actor,path.split('/')[4])};else if(path==='/api/crm/status')data={records:native.core.list(native.ctx,native.actor,'pipelines').total,change_token:'literal_change'};else data=native.core.list(native.ctx,native.actor,path.split('/')[3].split('?')[0]);
 }catch(error){if(error.transport)throw error;status=error.statusCode||500;data={code:error.code,error:error.message};}return {ok:status<400,status,text:async()=>JSON.stringify(data)};};
 return {...f,native,writes,form,submit:()=>f.context.createPipeline({preventDefault(){},currentTarget:form}),malformed:(entity='pipelines')=>malformed=entity,lose:()=>lose=true,hold(){let release;gate=new Promise(resolve=>release=resolve);release.started=new Promise(resolve=>started=resolve);return release;}};
}
module.exports={fixture};
