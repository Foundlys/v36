'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
class Element{
 constructor(tag){Object.assign(this,{tag,children:[],handlers:{},dataset:{},value:'',checked:false,textContent:'',isConnected:true});}
 append(...children){for(const child of children){if(child.parentElement)child.remove();child.parentElement=this;this.children.push(child);if(this.tag==='select'&&this.children.length===1)this.value=child.value;}}
 replaceChildren(...children){for(const child of this.children)child.parentElement=null;this.children=[];this.append(...children);}
 setAttribute(key,value){this[key]=value;}
 addEventListener(name,handler){(this.handlers[name]??=[]).push(handler);}
 async fire(name){for(const handler of this.handlers[name]||[])await handler({preventDefault(){}});}
 all(){return [this,...this.children.flatMap(child=>child.all())];}
 querySelector(tag){return this.all().find(child=>child.tag===tag);}
 remove(){if(this.parentElement){const p=this.parentElement;p.children=p.children.filter(child=>child!==this);this.parentElement=null;}}
 focus(){this.focused=true;}
}
const find=(root,tag,label)=>root.all().find(el=>el.tag===tag&&(label===undefined||el.textContent===label));
const field=(root,label)=>find(root,'label',label).children[0];
const {FoundlyPlatformCore}=require('./platform-core'),{CapabilityResolver}=require('./capability-resolver'),{WorkflowDrafts}=require('./workflow-drafts'),zero=require('./workflow-zero');let rows=new Map(),effects=0,busy=false,lose=false,hold=null,release;
const ctx={tenant_id:'zero-run-ui',dealer_id:'default'},actor={id:'owner',roles:['ADMIN','SUPER_ADMIN']},adapter={bucket(c,s){const k=JSON.stringify([c,s]);if(!rows.has(k))rows.set(k,[]);return rows.get(k);},persist(){},audit(){},executeAutomationAction(){effects++;return {executed:true};}},resolver=new CapabilityResolver(adapter);resolver.configure(ctx,actor,{entitlements:['automation'],expected_revision:0});const core=new FoundlyPlatformCore(adapter),drafts=new WorkflowDrafts(adapter,resolver),workflow=core.defineAutomation(ctx,actor,{name:'<img src=x> run fixture',trigger:'custom_event',actions:[{type:'create_task',title:'Conditional task',when:{field:'inputs.flag',operator:'eq',value:true}}]});
let payload={event:{event_id:'zero-ui:one'},options:{inputs:{flag:true}}},calls=[];const inputHost=new Element('form'),sandbox={document:{createElement:tag=>new Element(tag)},crypto};vm.createContext(sandbox);vm.runInContext(fs.readFileSync(require.resolve('./workflow-run-zero-client.js'),'utf8'),sandbox);
const box=sandbox.FoundlyWorkflowRunZero.create({document:sandbox.document,workflow,inputHost,getInput:()=>JSON.parse(JSON.stringify(payload)),canRequest:()=>!busy,onBusy:v=>{busy=v;},zeroRequest:async(action,turn)=>{const a=JSON.parse(JSON.stringify(action));calls.push({action:a,turn});const result=zero.execute(drafts,core,ctx,actor,a,{message:'Exact selected run',conversation_id:'zero-run-ui-conversation',turn_id:turn});if(hold)await hold;if(lose&&a.operation==='RUN_SUBMIT'){lose=false;throw Error('Lost response after run journal');}return result.automation_data;}});
(async()=>{
 const prepare=find(box,'button','Uitvoering met ZERO voorbereiden'),submit=find(box,'button','Bevestig uitvoering via ZERO'),reason=field(box,'Reden voor deze uitvoering');await prepare.fire('click');assert.equal(submit.disabled,false);assert.equal(effects,0);assert.ok(find(box,'pre').textContent.includes('<img src=x>'));assert.equal(find(box,'pre').children.length,0);assert.equal(busy,false);await submit.fire('click');assert.equal(calls.length,1);reason.value='Reviewed exact typed values';lose=true;await submit.fire('click');assert.equal(effects,1);assert.equal(submit.disabled,false);const turn=calls.at(-1).turn;await submit.fire('click');assert.equal(calls.at(-1).turn,turn);assert.equal(effects,1);assert.ok(find(box,'output').textContent.includes('SUCCEEDED'));
 payload.event.event_id='zero-ui:changed';await prepare.fire('click');payload.options.inputs.flag=false;const before=calls.length;await submit.fire('click');assert.equal(calls.length,before);assert.equal(submit.disabled,true);assert.equal(effects,1);
 await prepare.fire('click');await inputHost.fire('input');assert.equal(submit.disabled,true);assert.equal(find(box,'pre').textContent,'');
 hold=new Promise(resolve=>release=resolve);const pending=prepare.fire('click');assert.equal(busy,true);const pendingCount=calls.length;await prepare.fire('click');assert.equal(calls.length,pendingCount);await inputHost.fire('change');release();await pending;hold=null;assert.equal(busy,false);assert.equal(submit.disabled,true);
 hold=new Promise(resolve=>release=resolve);const detached=prepare.fire('click');box.isConnected=false;release();await detached;hold=null;assert.equal(submit.disabled,true);assert.equal(effects,1);assert.equal(core.automationStatus(ctx,actor).run_count,1);
 console.log('PASS actual ZERO run UI preview/confirmation/native handlers, no preview actions, same-turn uncertain-response retry, typed-input drift and pending/detached denial, literal results and no duplicated run effects; NOT browser evidence');
})().catch(e=>{console.error(e);process.exitCode=1;});
