'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
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
const {FoundlyPlatformCore}=require('./platform-core');let rows=new Map(),writes=0,effects=0;const ctx={tenant_id:'inspector-ui',dealer_id:'default'},actor={id:'owner',roles:['ADMIN']},core=new FoundlyPlatformCore({bucket(c,s){const k=JSON.stringify([c,s]);if(!rows.has(k))rows.set(k,[]);return rows.get(k);},persist(){writes++;},executeAutomationAction(){effects++;return {executed:true};}});
const wf=core.defineAutomation(ctx,actor,{name:'Literal <img src=x> workflow',trigger:'custom_event',approval_required:true,actions:[{type:'create_task',title:'Skipped',when:{not:{field:'inputs.flag',operator:'eq',value:true}}},{type:'create_task',title:'Waiting',when:{all:[{field:'inputs.flag',operator:'eq',value:true},{any:[{field:'inputs.missing',operator:'exists'},{field:'inputs.score',operator:'gte',value:1}]}]}}]}),run=core.runAutomation(ctx,actor,wf.id,{event_id:'inspector-ui:event'},{inputs:{flag:true,score:4}});
let pending=null,release,denied=false;const requests=[];const request=async route=>{requests.push(route);if(pending)await pending;if(denied)throw Error('Current run access denied');const url=new URL(route,'https://fixture.test');return core.inspectAutomationRun(ctx,actor,run.run_id,Object.fromEntries(url.searchParams));};
const sandbox={document:{createElement:tag=>new Element(tag)}};vm.createContext(sandbox);vm.runInContext(fs.readFileSync(require.resolve('./workflow-inspector.js'),'utf8'),sandbox);
const create=()=>sandbox.FoundlyWorkflowInspector.create({document:sandbox.document,run,request});
(async()=>{
 const box=create(),button=find(box,'button','Run en voorwaarden verklaren');const before=writes;await button.fire('click');assert.ok(box.all().some(el=>el.textContent.includes('Bewaarde runstatus: AWAITING_APPROVAL')));assert.ok(box.all().some(el=>el.textContent.includes('inputs.missing')&&el.textContent.includes('ontbreekt')));assert.ok(box.all().some(el=>el.textContent.includes('EN → waar')));assert.ok(find(box,'h4').textContent.includes('<img src=x>'));assert.equal(find(box,'h4').children.length,0);assert.equal(writes,before);assert.equal(effects,0);
 const select=field(box,'Stap voor verklaring');select.value='0';await select.fire('change');assert.ok(requests.at(-1).endsWith('?step=0'));assert.ok(box.all().some(el=>el.textContent.includes('NIET → onwaar')));assert.ok(box.all().some(el=>el.textContent.includes('Status: SKIPPED_CONDITION')));
 denied=true;await button.fire('click');assert.equal(find(box,'h4'),undefined);assert.equal(find(box,'output').textContent,'Current run access denied');denied=false;
 pending=new Promise(resolve=>release=resolve);const pendingRead=button.fire('click');box.isConnected=false;release();await pendingRead;assert.equal(find(box,'h4'),undefined);pending=null;assert.equal(writes,before);assert.equal(effects,0);
 console.log('PASS actual run-inspector UI/native handlers, selected-step conditional explanations, missing values, literal text rendering, current denial clearing and detached-read suppression with no persistence or execution; NOT browser evidence');
})().catch(e=>{console.error(e);process.exitCode=1;});
