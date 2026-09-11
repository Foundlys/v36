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
const {FoundlyPlatformCore}=require('./platform-core'),{WorkflowDrafts}=require('./workflow-drafts'),{CapabilityResolver}=require('./capability-resolver'),zero=require('./workflow-zero');
let state=new Map(),disk,core;const ctx={tenant_id:'generator-ui',dealer_id:'default'},actor={id:'owner',roles:['ADMIN','SUPER_ADMIN']};
const adapter={bucket(c,s){const k=JSON.stringify([c,s]);if(!state.has(k))state.set(k,[]);return state.get(k);},persist(){disk=JSON.stringify([...state]);},audit(){},executeAutomationAction(c,a,action,run){const row=core.createAutomationRecord(c,a,'tasks',{title:action.title},{idempotencyKey:run.idempotency_key});return {executed:true,record_id:row.id};}};
const resolver=new CapabilityResolver(adapter);resolver.configure(ctx,actor,{entitlements:['automation'],expected_revision:0});core=new FoundlyPlatformCore(adapter);let drafts=new WorkflowDrafts(adapter,resolver);const spec=core.automationStatus(ctx,actor).editor_contract;
const sandbox={document:{createElement:tag=>new Element(tag)},crypto,FoundlyWorkflowAuthoring:require('./workflow-authoring')};vm.createContext(sandbox);vm.runInContext(fs.readFileSync(require.resolve('./workflow-generator.js'),'utf8'),sandbox);
const draft={name:'UI inferred workflow',version:1,trigger_type:'custom_event',automatic:false,approval_required:false,steps:[{type:'branch',condition:{enabled:true,field:'inputs.go',operator:'eq',value_type:'boolean',value:'true'},then_steps:[{type:'create_task',values:{title:'<script>literal title</script>'}}],else_steps:[{type:'create_task',values:{title:'Else task'}}]}]};
let output=JSON.stringify({draft}),lose=false,hold=null,release,calls=[],record;
const zeroRequest=async(action,turn)=>{const a=JSON.parse(JSON.stringify(action));calls.push({action:a,turn});const meta={message:'Explicit workflow description',conversation_id:'generator-ui-conversation',turn_id:turn};const result=a.operation==='GENERATE'?await zero.generate(drafts,core,ctx,actor,a,meta,async()=>{if(hold)await hold;return output;}):zero.execute(drafts,core,ctx,actor,a,meta);if(lose&&a.operation==='SAVE'){lose=false;throw Error('Lost response after native commit');}return result.automation_data;};
const create=()=>sandbox.FoundlyWorkflowGenerator.create({document:sandbox.document,spec,zeroRequest,onSaved:r=>{record=r;}});
(async()=>{
 const form=create(),prompt=field(form,'Gewenste workflow'),prepare=find(form,'button','Voorstel uit beschrijving maken'),save=find(form,'button','Bevestig voorstel als privéconcept'),reason=field(form,'Reden om dit voorstel als concept te bewaren'),notice=find(form,'output');
 await prepare.fire('click');assert.equal(calls.length,0);prompt.value='Maak een workflow als inputs.go true taak literal anders else';await prepare.fire('click');assert.equal(save.disabled,false,notice.textContent);assert.equal(drafts.list(ctx,actor).items.length,0);assert.equal(core.automationStatus(ctx,actor).workflow_count,0);assert.ok(find(form,'pre').textContent.includes('NIET'));assert.ok(find(form,'pre').textContent.includes('<script>literal title</script>'));assert.equal(find(form,'pre').children.length,0);
 await save.fire('click');assert.equal(calls.length,1);reason.value='Review exact branches';lose=true;await save.fire('click');assert.equal(save.disabled,false);const replayTurn=calls.at(-1).turn;await save.fire('click');assert.equal(calls.at(-1).turn,replayTurn);assert.equal(save.disabled,true);assert.ok(record);assert.equal(drafts.list(ctx,actor).items.length,1);assert.equal(core.automationStatus(ctx,actor).workflow_count,0);
 state=new Map(JSON.parse(disk));core=new FoundlyPlatformCore(adapter);drafts=new WorkflowDrafts(adapter,resolver);const retained=drafts.list(ctx,actor).items[0],definition=require('./workflow-authoring').compile(retained.draft,spec),wf=core.defineAutomation(ctx,actor,definition);for(const go of [true,false])assert.equal(core.runAutomation(ctx,actor,wf.id,{event_id:'generator:'+go},{inputs:{go}}).status,'SUCCEEDED');assert.equal(core.automationRecords(ctx,actor,'tasks').total,2);
 hold=new Promise(r=>release=r);const pending=prepare.fire('click');while(calls.at(-1).action.operation!=='GENERATE')await Promise.resolve();prompt.value='Changed while waiting';await prompt.fire('input');release();await pending;hold=null;assert.equal(save.disabled,true);assert.equal(find(form,'pre').textContent,'');
 output=JSON.stringify({questions:['Welke trigger bedoel je?']});await prepare.fire('click');assert.equal(save.disabled,true);assert.ok(notice.textContent.includes('Welke trigger'));
 output='';await prepare.fire('click');assert.equal(save.disabled,true);assert.ok(notice.textContent.includes('niet beschikbaar'));
 output=JSON.stringify({draft});await prepare.fire('click');prompt.value='Changed after proposal';await prompt.fire('input');assert.equal(save.disabled,true);const count=calls.length;await save.fire('click');assert.equal(calls.length,count);
 const detached=create();field(detached,'Gewenste workflow').value='Make workflow';hold=new Promise(r=>release=r);const detachedPending=find(detached,'button','Voorstel uit beschrijving maken').fire('click');detached.isConnected=false;release();await detachedPending;hold=null;assert.equal(find(detached,'button','Bevestig voorstel als privéconcept').disabled,true);
 console.log('PASS actual description/review/confirmation UI handlers through native private save, same-turn lost-response retry, retained branch execution, text-only review, missing/changed/detached/provider states without implicit publication; NOT browser evidence');
})().catch(e=>{console.error(e);process.exitCode=1;});
