'use strict';
const {fixture:page}=require('./automation-page-fixture'),{FoundlyPlatformCore}=require('../platform-core');
const clone=value=>JSON.parse(JSON.stringify(value));
function fixture(options={}){
 const f=page(),ctx=options.ctx||{tenant_id:'approval-client',dealer_id:'default'},actor=options.actor||{id:'approval-owner',roles:['ADMIN']},rows=new Map(),storage=options.storage||f.storage,calls=[];let clock=Date.parse('2026-01-01T00:00:00Z'),effects=0,loss=false,storageFailed=false,cleanupFailed=false,alter=null,denial=false,held=null;
 f.nodes.contextContent=f.content;
 const core=options.core||new FoundlyPlatformCore({now:()=>new Date(clock),bucket(c,s){const key=JSON.stringify([c,s]);if(!rows.has(key))rows.set(key,[]);return rows.get(key);},persist(){},executeAutomationAction(c,a,action,run){effects++;const record=core.createAutomationRecord(c,a,'documents',{title:action.title||'Approval result',content:action.content||'Private approved line one\nPrivate approved line two'},{idempotencyKey:run.idempotency_key});return {executed:true,record_id:record.id};}});
 const workflow=options.workflow||core.defineAutomation(ctx,actor,{name:'Private exact approval workflow',trigger:'custom_event',actions:[{type:'create_document',title:'First approved document',content:'Private approved line one\nPrivate approved line two'},{type:'delay',seconds:1},{type:'create_document',title:'Second approved document'}],approval_required:true}),run=options.run||core.runAutomation(ctx,actor,workflow.id,{event_id:'approval-client-event',event_version:1},{inputs:{private:'Literal approval input'}});
 f.context.sessionStorage={getItem:key=>{if(storageFailed)throw Error('Storage unavailable');return storage.get(key)??null;},setItem:(key,value)=>{if(storageFailed)throw Error('Storage unavailable');storage.set(key,String(value));},removeItem:key=>{if(storageFailed||cleanupFailed)throw Error('Cleanup unavailable');storage.delete(key);}};
 f.context.fetch=async(route,options={})=>{
  calls.push({route,options:clone(options)});if(denial)return {ok:false,status:403,json:async()=>({code:'capability_disabled',error:'PRIVATE_DENIED'})};let response;if(f.transport)response=await f.transport(route,options);else{
   const body=options.body?JSON.parse(options.body):{};
   if(route.startsWith('/api/automation/runs?'))response=core.queryAutomationRuns(ctx,actor,Object.fromEntries(new URL('http://fixture'+route).searchParams));
   else if(route==='/api/composition')response={resolution:{capabilities:['automation:workflows','automation:runs','automation:approvals']}};
   else if(route.endsWith('/approval-preview'))response=core.previewAutomationApproval(ctx,actor,run.run_id);
   else if(route==='/api/automation/approval-requests/recover')response=core.recoverAutomationApprovalRequest(ctx,actor,body);
   else if(route.endsWith('/runs'))response=core.runAutomation(ctx,actor,workflow.id,body.event,body.options);
   else throw Error('Unexpected approval fixture route '+route);
  }
  if(held&&route.endsWith(held.suffix)){const gate=held;held=null;gate.started();await gate.promise;}
  if(loss&&route.endsWith('/runs')&&options.method==='POST'){loss=false;throw Error('PRIVATE_LOST_RESPONSE');}
  return {ok:true,status:200,json:async()=>alter?alter(clone(response),route):clone(response)};
 };
 const control=key=>f.content.all().find(n=>n.getAttribute?.('data-approval-action')===key),box=()=>control('prepare')?.closest('fieldset'),reason=()=>box()?.all().find(n=>n.tag==='input');
 return Object.assign(f,{core,ctx,actor,workflow,run,calls,storage,control,box,reason,effects:()=>effects,advance:()=>clock+=2000,lose:()=>loss=true,deny:()=>denial=true,failStorage:()=>storageFailed=true,failCleanup:()=>cleanupFailed=true,alter:fn=>alter=fn,async approve(){await control('prepare').fire('click');reason().value='Private exact reviewed approval';await control('confirm').fire('click');},hold(suffix){let release,started;const promise=new Promise(resolve=>release=resolve);release.started=new Promise(resolve=>started=resolve);held={suffix,promise,started};return release;}});
}
module.exports={fixture};
