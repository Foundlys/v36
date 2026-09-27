'use strict';
const {fixture:page}=require('./automation-page-fixture'),{fixture:native}=require('./workflow-result-fixture'),clone=value=>JSON.parse(JSON.stringify(value));
function fixture(options={}){
 const f=page(),n=options.native||native(options),storage=options.storage||f.storage,calls=[];let loss=false,storageFailed=false,cleanupFailed=false,alter=null,denial=false,held=null;f.nodes.contextContent=f.content;
 f.context.sessionStorage={getItem:key=>{if(storageFailed)throw Error('Storage unavailable');return storage.get(key)??null;},setItem:(key,value)=>{if(storageFailed)throw Error('Storage unavailable');storage.set(key,String(value));},removeItem:key=>{if(storageFailed||cleanupFailed)throw Error('Cleanup unavailable');storage.delete(key);}};
 f.context.fetch=async(route,options={})=>{
  calls.push({route,options:clone(options)});if(denial)return {ok:false,status:403,json:async()=>({code:'capability_disabled',error:'PRIVATE_DENIED'})};let response;if(f.transport)response=await f.transport(route,options);else{
   const body=options.body?JSON.parse(options.body):{};
   if(route.startsWith('/api/automation/runs?'))response=n.core.queryAutomationRuns(n.ctx,n.actor,Object.fromEntries(new URL('http://fixture'+route).searchParams));
   else if(route==='/api/composition')response={resolution:{capabilities:['automation:workflows','automation:runs']}};
   else if(route==='/api/automation/result-requests/recover')response=n.core.recoverAutomationResultRequest(n.ctx,n.actor,body);
   else if(route.endsWith('/recovery'))response=options.method==='POST'?n.core.recoverAutomation(n.ctx,n.actor,n.run.run_id,body):n.core.previewAutomationRecovery(n.ctx,n.actor,n.run.run_id);
   else throw Error('Unexpected result fixture route '+route);
  }
  if(held&&route.endsWith(held.suffix)&&(!held.method||held.method===(options.method||'GET'))){const gate=held;held=null;gate.started();await gate.promise;}
  if(loss&&route.endsWith('/recovery')&&options.method==='POST'){loss=false;throw Error('PRIVATE_LOST_RESPONSE');}
  return {ok:true,status:200,json:async()=>alter?alter(clone(response),route,options):clone(response)};
 };
 const control=key=>f.content.all().find(node=>node.getAttribute?.('data-result-action')===key),box=()=>control('prepare')?.closest('fieldset'),reason=()=>box()?.all().find(node=>node.tag==='input'&&node.type!=='checkbox'),checked=()=>box()?.all().find(node=>node.type==='checkbox');
 return Object.assign(f,{native:n,core:n.core,ctx:n.ctx,actor:n.actor,workflow:n.workflow,run:n.run,calls,storage,control,box,reason,checked,effects:n.effects,lose:()=>loss=true,deny:()=>denial=true,failStorage:()=>storageFailed=true,failCleanup:()=>cleanupFailed=true,alter:fn=>alter=fn,async recover(){await control('prepare').fire('click');reason().value='Private exact reviewed result';checked().checked=true;await control('confirm').fire('click');},hold(suffix,method){let release,started;const promise=new Promise(resolve=>release=resolve);release.started=new Promise(resolve=>started=resolve);held={suffix,method,promise,started};return release;}});
}
module.exports={fixture};
