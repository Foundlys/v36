'use strict';
// Production action handlers, real native CRM effects, and a minimal DOM.
const {fixture:pageFixture,CrmView}=require('./crm-dashboard-fixture'),{fixture:storage}=require('./crm-save-fixture');
async function fixture(){
 const f=pageFixture(),native=storage(),c=native.core,ctx=native.ctx,a=native.actor;a.roles=['MANAGER'];let lose=false,malformed=false,held=null,remaining=0,started=()=>{},confirmations=0;
 const writes=[],errors=new Map(),pipeline=c.create(ctx,a,'pipelines',{name:'Literal pipeline'}),first=c.create(ctx,a,'stages',{name:'Literal first stage',pipeline_id:pipeline.id}),next=c.create(ctx,a,'stages',{name:'Literal next stage',pipeline_id:pipeline.id}),deal=c.create(ctx,a,'deals',{title:'Literal private deal',pipeline_id:pipeline.id,stage_id:first.id}),record=c.create(ctx,a,'leads',{name:'Literal private record'});
 c.create(ctx,a,'automations',{name:'Literal automation',trigger:{type:'stage_change'},actions:[{type:'task',title:'Literal follow-up'}]});
 f.context.confirm=()=>{confirmations++;return true;};
 f.context.fetch=async(route,options={})=>{f.calls.push({route,options});let status=200,data;try{
  if(errors.has(route))throw Object.assign(Error('PRIVATE error'),{statusCode:errors.get(route),code:'crm_request_failed'});
  if(['PATCH','DELETE'].includes(options.method)){
   writes.push({route,options});const match=route.match(/^\/api\/crm\/([^/]+)\/([^/]+)(?:\/stage)?$/),request={idempotencyKey:options.headers['idempotency-key'],eventId:options.headers['x-foundly-event-id'],expectedRevision:Number(options.headers['if-match'].replaceAll('"',''))};
   data=options.method==='DELETE'?c.remove(ctx,a,match[1],match[2],request):{deal:c.moveDeal(ctx,a,match[2],JSON.parse(options.body).stage_id,request)};
   if(held&&remaining-->0){started();await held;}if(lose){lose=false;throw Object.assign(Error('Lost committed action response'),{transport:true});}if(malformed){malformed=false;data={};}
  }else if(route.endsWith('/board'))data={board:c.pipelineBoard(ctx,a,route.split('/')[4])};
  else if(route==='/api/crm/status')data={records:c.list(ctx,a,'leads').total,change_token:'literal_version'};
  else if(route.startsWith('/api/crm/'))data=c.list(ctx,a,route.split('/')[3].split('?')[0]);else data={};
 }catch(error){if(error.transport)throw error;status=error.statusCode||500;data={code:error.code,error:error.message};}return {ok:status<400,status,text:async()=>JSON.stringify(data)};};
 f.nodes.recordEntity.value='leads';await f.context.loadRecords();await f.context.loadPipelineBoard(pipeline.id);
 // The legacy controller uses innerHTML; this fixture does not parse HTML. Mount
 // only those legacy drag targets from the same native board to exercise its handlers.
 if(!f.nodes.pipelineBoard.querySelector('.stage')){for(const row of c.pipelineBoard(ctx,a,pipeline.id).stages){const section=new CrmView('section');section.className='stage';section.dataset.stage=row.id;f.nodes.pipelineBoard.append(section);for(const source of row.deals){const card=new CrmView('article');card.className='deal-card';card.dataset.deal=source.id;card.dataset.revision=String(source.revision);section.append(card);}}f.context.bindPipelineDrag();}
 return {...f,native,writes,errors,pipeline,first,next,deal,record,confirmations:()=>confirmations,lose(){lose=true;},malformed(){malformed=true;},hold(){remaining=1;let release;held=new Promise(resolve=>release=resolve);release.started=new Promise(resolve=>started=resolve);return release;},drop(stageId=next.id,source=deal){const stage=f.nodes.pipelineBoard.all().find(node=>node.className==='stage'&&node.dataset.stage===stageId);return stage.ondrop({preventDefault(){},dataTransfer:{getData:()=>JSON.stringify({id:source.id,revision:String(source.revision)})}});}};
}
module.exports={fixture};
