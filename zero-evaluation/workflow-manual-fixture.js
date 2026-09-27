'use strict';
const fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto'),{fixture:workspace,WorkspaceView}=require('./workspace-page-fixture'),{FoundlyPlatformCore}=require('../platform-core'),author=require('../workflow-authoring');
const clone=value=>JSON.parse(JSON.stringify(value));
function fixture(options={}){
 const f=workspace({workspaceId:'automation'}),ctx=options.ctx||{tenant_id:'manual-control',dealer_id:'default'},actor=options.actor||{id:'manual-owner',roles:['ADMIN','SUPER_ADMIN']},rows=new Map(),storage=options.storage||new Map(),calls=[],content=new WorkspaceView('section'),card=new WorkspaceView('article');let active=true,clock=Date.parse('2026-01-01T00:00:00Z'),effects=0,loss=false,alter=null,deny=false,hold=null,storageFailed=false;
 const transport=options.requestOverride;
 const core=options.core||new FoundlyPlatformCore({now:()=>new Date(clock),bucket(c,s){const k=JSON.stringify([c,s]);if(!rows.has(k))rows.set(k,[]);return rows.get(k);},persist(){},executeAutomationAction(c,a,action,run){effects++;const record=core.createAutomationRecord(c,a,'documents',{title:action.title||'Manual result',content:action.content||'Private content'},{idempotencyKey:run.idempotency_key});return {executed:true,record_id:record.id};}});
 const workflow=options.workflow||core.defineAutomation(ctx,actor,{name:'Private manual workflow',trigger:{type:'custom_event',automatic:false},actions:options.actions||[{type:'delay',seconds:1},{type:'create_document',title:'Private manual title',content:'Private line one\nPrivate line two'}],approval_required:false});workflow.effective_enabled=true;
 Object.assign(f.context,{crypto,TextEncoder,FoundlyWorkflowAuthoring:author,sessionStorage:{getItem:key=>{if(storageFailed)throw Error('storage fault');return storage.get(key)??null;},setItem:(key,value)=>{if(storageFailed)throw Error('storage fault');storage.set(key,String(value));},removeItem:key=>{if(storageFailed)throw Error('storage fault');storage.delete(key);}}});f.context.document.dispatchEvent=event=>{for(const handler of f.context.document.handlers[event.type]||[])handler(event);};vm.runInContext(fs.readFileSync(require.resolve('../workflow-run-zero-client.js'),'utf8'),f.context);
 f.context.fetch=async(route,options={})=>{
  calls.push({route,options:clone(options)});if(deny)return {ok:false,status:403,json:async()=>({code:'capability_disabled',error:'private denial'})};const body=options.body?JSON.parse(options.body):{};let result;
  if(transport)result=await transport(route,options);
  else if(route.endsWith('/run-preview'))result=core.previewConfirmedAutomationRun(ctx,actor,workflow.id,body);
  else if(route.endsWith('/run-confirmation'))result=core.submitConfirmedAutomationRun(ctx,actor,workflow.id,body);
  else if(route==='/api/automation/run-requests/recover')result=core.recoverAutomationRunRequest(ctx,actor,body);
  else if(route.endsWith('/runs'))result=core.runAutomation(ctx,actor,workflow.id,body.event,body.options);
  else throw Error('Unexpected fixture route '+route);
  if(hold){const gate=hold;hold=null;gate.started();await gate.promise;}
  if(loss&&(route.endsWith('/runs')||route.endsWith('/run-confirmation'))){loss=false;throw Error('private transport fault');}
  return {ok:true,status:200,json:async()=>alter?alter(clone(result),route):clone(result)};
 };
 f.nodes.manualContent=content;content.append(card);f.ui.appendManualWorkflowRun(workflow,card,content,()=>active,options.realm||{...ctx,actor_id:actor.id});
 const form=card.all().find(n=>n.tag==='form'),native=()=>card.all().find(n=>n.getAttribute?.('data-workflow-run-mode')==='native'),control=key=>native()?.all().find(n=>n.getAttribute?.('data-workflow-run-action')===key),reference=()=>form.all().find(n=>n.tag==='input');
 return {...f,ctx,actor,core,workflow,storage,calls,form,card,content,native,control,reference,effects:()=>effects,advance:()=>clock+=2000,lose:()=>loss=true,alter:fn=>alter=fn,deny:()=>deny=true,failStorage:()=>storageFailed=true,retire:()=>active=false,
 async submit(){if(native()){await control('prepare').fire('click');native().all().find(n=>n.tag==='input').value='Explicit private reviewed reason';await control('confirm').fire('click');}else await form.fire('submit');},
 async retry(){if(native())await control('confirm').fire('click');else await form.fire('submit');},
 hold(){let release,started;const promise=new Promise(resolve=>release=resolve);release.started=new Promise(resolve=>started=resolve);hold={promise,started};return release;}};
}
module.exports={fixture};
