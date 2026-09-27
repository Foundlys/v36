'use strict';
const {fixture:page}=require('./automation-page-fixture'),{FoundlyPlatformCore}=require('../platform-core');
const clone=value=>JSON.parse(JSON.stringify(value));
function fixture(options={}){
 const f=page(),ctx=options.ctx||{tenant_id:'activation-client',dealer_id:'default'},actor=options.actor||{id:'activation-owner',roles:['ADMIN']},rows=new Map(),storage=options.storage||f.storage,calls=[];let loss=false,storageFailed=false,cleanupFailed=false,alter=null,denial=false,held=null;
 f.nodes.contextContent=f.content;
 const core=options.core||new FoundlyPlatformCore({bucket(c,s){const key=JSON.stringify([c,s]);if(!rows.has(key))rows.set(key,[]);return rows.get(key);},persist(){}}),workflow=options.workflow||core.defineAutomation(ctx,actor,{name:'Private literal activation workflow',trigger:'custom_event',actions:[{type:'notify',message:'Literal private notification'}]});
 f.context.sessionStorage={getItem:key=>{if(storageFailed)throw Error('Storage unavailable');return storage.get(key)??null;},setItem:(key,value)=>{if(storageFailed)throw Error('Storage unavailable');storage.set(key,String(value));},removeItem:key=>{if(storageFailed||cleanupFailed)throw Error('Cleanup unavailable');storage.delete(key);}};
 f.context.fetch=async(route,options={})=>{
  calls.push({route,options:clone(options)});if(denial)return {ok:false,status:403,json:async()=>({code:'capability_disabled',error:'PRIVATE_DENIED'})};let response;
  if(f.transport)response=await f.transport(route,options);else{
   const body=options.body?JSON.parse(options.body):{};
   if(route==='/api/automation/workflows')response=core.automationDefinitions(ctx,actor);
   else if(route==='/api/automation/drafts')response={items:[],request_context:{...ctx,actor_id:actor.id}};
   else if(route.endsWith('/activation'))response=core.setAutomationActivation(ctx,actor,workflow.id,body);
   else if(route==='/api/automation/activation-requests/recover')response=core.recoverAutomationActivationRequest(ctx,actor,body);
   else throw Error('Unexpected activation fixture route '+route);
  }
  if(held&&route.endsWith(held.suffix)){const gate=held;held=null;gate.started();await gate.promise;}
  if(loss&&route.endsWith('/activation')&&options.method==='PUT'){loss=false;throw Error('PRIVATE_LOST_RESPONSE');}
  return {ok:true,status:200,json:async()=>alter?alter(clone(response),route):clone(response)};
 };
 const control=key=>f.content.all().find(n=>n.getAttribute?.('data-activation-action')===key),box=()=>control('activate')?.closest('form'),reason=()=>box()?.all().find(n=>n.tag==='input'&&n.type!=='checkbox'),confirm=()=>box()?.all().find(n=>n.tag==='input'&&n.type==='checkbox');
 return Object.assign(f,{core,ctx,actor,workflow,calls,storage,control,box,reason,confirm,current:()=>core.automationDefinitions(ctx,actor).workflows.find(row=>row.id===workflow.id),lose:()=>loss=true,deny:()=>denial=true,failStorage:()=>storageFailed=true,failCleanup:()=>cleanupFailed=true,alter:fn=>alter=fn,async choose(key='activate'){reason().value='Private exact activation reason';confirm().checked=true;await box().fire('submit',{submitter:control(key)});},hold(suffix){let release,started;const promise=new Promise(resolve=>release=resolve);release.started=new Promise(resolve=>started=resolve);held={suffix,promise,started};return release;}});
}
module.exports={fixture};
