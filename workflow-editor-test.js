'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const {FoundlyPlatformCore}=require('./platform-core');
const {WorkflowDrafts}=require('./workflow-drafts');
const {CapabilityResolver}=require('./capability-resolver');
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
const ctx={tenant_id:'editor-conditions',dealer_id:'default'},actor={id:'editor-owner',roles:['ADMIN','SUPER_ADMIN']};let state=new Map(),disk,core;
const adapter={bucket(c,s){const key=JSON.stringify([c,s]);if(!state.has(key))state.set(key,[]);return state.get(key);},persist(){disk=JSON.stringify([...state]);},audit(){},executeAutomationAction(c,a,action,run){const record=core.createAutomationRecord(c,a,'tasks',{title:action.title},{idempotencyKey:run.idempotency_key});return {executed:true,record_id:record.id};}};
const resolver=new CapabilityResolver(adapter);resolver.configure(ctx,actor,{entitlements:['automation'],expected_revision:0});core=new FoundlyPlatformCore(adapter);let drafts=new WorkflowDrafts(adapter,resolver);
const spec=core.automationStatus(ctx,actor).editor_contract,requests=[];let saved=0;
const sandbox={document:{createElement:tag=>new Element(tag)},crypto,setTimeout:()=>1,clearTimeout(){},FoundlyWorkflowAuthoring:require('./workflow-authoring'),FoundlyWorkflowDraftSession:require('./workflow-draft-session')};vm.createContext(sandbox);vm.runInContext(fs.readFileSync(require.resolve('./workflow-editor.js'),'utf8'),sandbox);
async function request(route,options){const body=JSON.parse(options.body);requests.push({route,body});if(route.includes('/drafts/'))return drafts.save(ctx,actor,route.split('/').at(-1),body);return core.defineAutomation(ctx,actor,body);}
const create=initial=>sandbox.FoundlyWorkflowEditor.create({document:sandbox.document,spec,request,onSaved:()=>{saved++;},draft:initial});
(async()=>{
 const form=create();field(form,'Workflownaam').value='Editor grouped workflow';field(form,'Taaktitel').value='Literal <script> retained title';
 const enabled=field(form,'Alleen uitvoeren wanneer de conditie waar is');enabled.checked=true;await enabled.fire('change');
 const kind=field(form,'Soort voorwaarde');kind.value='all';await kind.fire('change');
 const rootBox=kind.parentElement.parentElement,group=rootBox.children[3],childHost=group.children[0];let first=childHost.children[0];
 field(first,'Conditieveld, bijvoorbeeld inputs.priority').value='inputs.score';field(first,'Vergelijking').value='gte';field(first,'Waardetype').value='number';field(first,'Vergelijkingswaarde').value='5';
 await group.children[1].fire('click');let second=childHost.children[1];field(second,'Soort voorwaarde').value='any';await field(second,'Soort voorwaarde').fire('change');
 const innerGroup=second.children[3],inner=innerGroup.children[0].children[0];field(inner,'Conditieveld, bijvoorbeeld inputs.priority').value='inputs.flag';field(inner,'Vergelijking').value='eq';field(inner,'Waardetype').value='boolean';field(inner,'Vergelijkingswaarde').value='true';
 await innerGroup.children[1].fire('click');const alternative=innerGroup.children[0].children[1];field(alternative,'Conditieveld, bijvoorbeeld inputs.priority').value='inputs.kind';field(alternative,'Vergelijking').value='in';field(alternative,'Vergelijkingswaarde').value='a\nb';
 await form.fire('submit');assert.equal(saved,1,find(form,'output').textContent);assert.equal(core.automationRecords(ctx,actor,'tasks').total,0,'Editor save never starts manual workflow');
 const when={all:[{field:'inputs.score',operator:'gte',value:5},{any:[{field:'inputs.flag',operator:'eq',value:true},{field:'inputs.kind',operator:'in',value:['a','b']}]}]};
 const workflow=core.automationStatus(ctx,actor).workflows[0];assert.deepEqual(workflow.actions[0].when,when);assert.equal(requests.length,2);assert.equal(requests[0].body.draft.steps[0].condition.mode,'all');
 state=new Map(JSON.parse(disk));core=new FoundlyPlatformCore(adapter);drafts=new WorkflowDrafts(adapter,resolver);const retained=drafts.list(ctx,actor).items[0];const reopened=create(retained);await reopened.fire('submit');assert.equal(saved,2,find(reopened,'output').textContent);assert.deepEqual(requests.at(-1).body.actions[0].when,when);assert.equal(core.automationStatus(ctx,actor).workflow_count,1);
 for(const [id,inputs,expected] of [['no',{score:7,kind:'c'},false],['yes',{score:7,kind:'b'},true],['low',{score:1,flag:true},false]]){
   const event={event_id:`editor:${id}`},run=core.runAutomation(ctx,actor,workflow.id,event,{inputs});assert.equal(run.steps[0].status,expected?'SUCCEEDED':'SKIPPED_CONDITION');assert.equal(core.runAutomation(ctx,actor,workflow.id,event,{inputs}).replayed,true);
 }
 assert.equal(core.automationRecords(ctx,actor,'tasks').total,1);assert.equal(core.automationRecords(ctx,actor,'tasks').items[0].title,'Literal <script> retained title');
 const grouped=field(reopened,'Soort voorwaarde').parentElement.parentElement.children[3].children[0];await grouped.children[1].children.find(el=>el.tag==='button'&&el.textContent==='Voorwaarde verwijderen').fire('click');await find(reopened,'button','Concept nu bewaren').fire('click');await Promise.resolve();assert.equal(requests.at(-1).body.draft.steps[0].condition.children.length,1);
 // Malformed stored controls cannot be silently treated as a disabled condition.
 for(const condition of [false,null,{enabled:true,mode:'unknown'},{enabled:true,mode:'any',children:[null]}])assert.throws(()=>create({...retained,draft:{...retained.draft,steps:[{type:'create_task',values:{title:'x'},condition}]}}),{code:'workflow_draft_invalid'});
 const bad=create();field(bad,'Workflownaam').value='Invalid comparison';field(bad,'Taaktitel').value='No task';const active=field(bad,'Alleen uitvoeren wanneer de conditie waar is');active.checked=true;await active.fire('change');field(bad,'Conditieveld, bijvoorbeeld inputs.priority').value='inputs.x';field(bad,'Vergelijking').value='in';const count=requests.length;await bad.fire('submit');assert.equal(requests.length,count);assert.ok(find(bad,'output').textContent.includes('1 tot 100'));
 const zero=require('./workflow-zero'),zeroCalls=[];let lose=false,pendingPreview=null,releasePreview;
 const zeroRequest=async(action,turn)=>{zeroCalls.push({action:JSON.parse(JSON.stringify(action)),turn});const result=zero.execute(drafts,core,ctx,actor,JSON.parse(JSON.stringify(action)),{message:'Explicit draft action',conversation_id:'editor-zero-conversation',turn_id:turn});if(pendingPreview&&action.operation==='PREVIEW'){const pending=pendingPreview;pendingPreview=null;await pending;}if(lose&&action.operation==='SAVE'){lose=false;throw Error('Fixture lost saved response');}return result.automation_data;};
 const zeroForm=sandbox.FoundlyWorkflowEditor.create({document:sandbox.document,spec,request,onSaved:()=>{throw Error('ZERO draft must not publish');},draft:drafts.list(ctx,actor).items[0],zeroRequest});
 const prepare=find(zeroForm,'button','Concept met ZERO voorbereiden'),confirm=find(zeroForm,'button','Bevestig concept bewaren via ZERO'),why=field(zeroForm,'Reden om dit concept via ZERO te bewaren');why.value='Save my exact workflow draft';
 await prepare.fire('click');assert.equal(confirm.disabled,false,find(zeroForm,'output').textContent);assert.equal(zeroCalls.at(-1).action.operation,'PREVIEW');assert.ok(find(zeroForm,'pre').textContent.includes('Voorwaarde:'));
 lose=true;await confirm.fire('click');assert.equal(confirm.disabled,false);const retryKey=zeroCalls.at(-1).turn;await confirm.fire('click');assert.equal(zeroCalls.at(-1).turn,retryKey);assert.equal(confirm.disabled,true);assert.ok(find(zeroForm,'output').textContent.includes('geen workflow'));assert.equal(core.automationStatus(ctx,actor).workflow_count,1);
 pendingPreview=new Promise(resolve=>releasePreview=resolve);const stalePreview=prepare.fire('click');while(!releasePreview||zeroCalls.at(-1).action.operation!=='PREVIEW')await Promise.resolve();field(zeroForm,'Workflownaam').value='Changed during preview';await zeroForm.fire('input');releasePreview();await stalePreview;assert.equal(confirm.disabled,true);assert.equal(find(zeroForm,'pre').textContent,'');
 console.log('PASS explicit ZERO preparation/save through actual editor handlers, native revision adoption, lost-response same-turn replay, no publish and stale preview invalidation');
 const branchForm=create();field(branchForm,'Workflownaam').value='Actual branch editor';const actionType=field(branchForm,'Actie');actionType.value='branch';await actionType.fire('change');
 field(branchForm,'Conditieveld, bijvoorbeeld inputs.priority').value='inputs.branch';field(branchForm,'Vergelijking').value='eq';field(branchForm,'Waardetype').value='boolean';field(branchForm,'Vergelijkingswaarde').value='true';
 for(const [label,title] of [['Als de voorwaarde waar is','UI true branch'],['Anders','UI false branch']]){
   const box=find(branchForm,'legend',label).parentElement;await box.children.find(el=>el.tag==='button'&&el.textContent==='Stap toevoegen').fire('click');field(box,'Taaktitel').value=title;
 }
 const beforeBranches=core.automationRecords(ctx,actor,'tasks').total;await branchForm.fire('submit');const branchFlow=core.automationStatus(ctx,actor).workflows.find(row=>row.name==='Actual branch editor');assert.ok(branchFlow,find(branchForm,'output').textContent);assert.ok(branchFlow.actions[1].when.not);assert.equal(core.automationRecords(ctx,actor,'tasks').total,beforeBranches);
 state=new Map(JSON.parse(disk));core=new FoundlyPlatformCore(adapter);drafts=new WorkflowDrafts(adapter,resolver);const branchRecord=drafts.list(ctx,actor).items.find(row=>row.draft.name==='Actual branch editor');assert.equal(branchRecord.draft.steps[0].type,'branch');const reopenedBranch=create(branchRecord);assert.ok(find(reopenedBranch,'legend','Anders'));await reopenedBranch.fire('submit');
 for(const flag of [true,false]){const run=core.runAutomation(ctx,actor,branchFlow.id,{event_id:'ui-branch:'+flag},{inputs:{branch:flag}});assert.equal(run.status,'SUCCEEDED');assert.equal(run.steps.filter(step=>step.status==='SUCCEEDED').length,1);}
 assert.equal(core.automationRecords(ctx,actor,'tasks').total,beforeBranches+2);
 console.log('PASS actual branch editor controls preserve separate true/else paths through private reload, version compilation and mutually exclusive engine execution');
 console.log('PASS actual editor handlers build nested groups, preserve private drafts through reload, compile/persist/execute exact conditions, skip false groups, retain literal text, remove explicitly and reject malformed controls without writes');
})().catch(error=>{console.error(error);process.exitCode=1;});
