'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const model=require('./customer-spatial-model'),{resolve}=require('./capability-resolver'),{MODULES}=require('./module-catalog'),{WORKSPACE_DEFINITIONS}=require('./workspace-system');
class Element {
 constructor(tag){this.tagName=tag;this.children=[];this.style={setProperty(k,v){this[k]=v}};this.dataset={};this.attributes={};this.listeners={};this.classList={add(){},remove(){}};}
 append(...children){children.forEach(child=>{child.parent=this;this.children.push(child)});}
 replaceChildren(...children){this.children.forEach(c=>c.parent=null);this.children=[];this.append(...children);}
 setAttribute(k,v){this.attributes[k]=v;}
 addEventListener(k,fn){(this.listeners[k]||=[]).push(fn);}
 removeEventListener(k,fn){this.listeners[k]=(this.listeners[k]||[]).filter(x=>x!==fn);}
 async fire(type,values={}){for(const fn of this.listeners[type]||[])await fn({target:this,preventDefault(){},...values});}
 closest(selector){if(this.tagName==='a'&&(selector==='a'||this.dataset.spatialNode))return this;return this.parent?.closest(selector)||null;}
 getBoundingClientRect(){return {width:1440,height:800};}
 setPointerCapture(){} remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);}
 all(){return [this,...this.children.flatMap(n=>n.all())];}
}
const scope={tenant_id:'ui-fixture',dealer_id:'fixture-business'},catalog=Object.values(MODULES),navigation={tenant:scope,workspaces:Object.values(WORKSPACE_DEFINITIONS)};
let resolution=resolve(scope,{roles:['ADMIN']},{...scope,industry_id:'GENERAL',entitlements:Object.keys(MODULES),enabled_modules:Object.keys(MODULES),revision:1}),denied=false,assigned=null;
const document=new Element('document');document.body=new Element('body');document.createElement=tag=>new Element(tag);document.createElementNS=(ns,tag)=>new Element(tag);document.getElementById=()=>null;
const window=new Element('window');window.FoundlySpatialModel=model;
const context={window,document,location:{assign:href=>{assigned=href}},fetch:async route=>({ok:!denied,status:denied?403:200,json:async()=>route==='/api/composition'?{resolution}:route==='/api/workspaces'?navigation:route==='/api/composition/catalog'?{modules:catalog}:{sources:[]}}),setInterval:()=>1,clearInterval(){},requestAnimationFrame:fn=>{context.nextFrame=fn;return 1},cancelAnimationFrame(){},console};
vm.createContext(context);vm.runInContext(fs.readFileSync(require.resolve('./customer-spatial-scene'),'utf8'),context);vm.runInContext(fs.readFileSync(require.resolve('./customer-spatial-runtime'),'utf8'),context);
const settle=()=>new Promise(r=>setImmediate(r));
(async()=>{
 const runtime=new window.FoundlyCustomerSpatialRuntime(new Element('canvas'));await settle();
 assert.equal(runtime.graph.nodes.filter(n=>n.kind==='module').length,9);assert.equal(runtime.rotation.running,true);
 context.nextFrame(0);context.nextFrame(50);const moving=runtime.world.dataset.orientation;
 await runtime.toggle.fire('click');assert.equal(runtime.indicator.textContent,'Rotatie gepauzeerd · sleep om te bekijken');assert.equal(runtime.toggle.attributes['aria-pressed'],'true');
 for(let i=1;i<60;i++)context.nextFrame(i*1000);assert.equal(runtime.world.dataset.orientation,moving,'pause fixes entire 3D pose');
 await runtime.viewport.fire('keydown',{key:'ArrowRight'});assert.notEqual(runtime.world.dataset.orientation,moving);
 const frozenNodes=JSON.stringify(runtime.nodes.map(n=>n.host.style.transform));await runtime.refresh();
 assert.equal(JSON.stringify(runtime.nodes.map(n=>n.host.style.transform)),frozenNodes,'same configuration refresh preserves paused node positions');
 const manual=runtime.world.dataset.orientation;await runtime.toggle.fire('click');context.nextFrame(61000);assert.equal(runtime.world.dataset.orientation,manual,'resume does not jump to an elapsed auto angle');context.nextFrame(61050);assert.notEqual(runtime.world.dataset.orientation,manual);
 await runtime.world.fire('focusin');assert.equal(runtime.rotation.running,false);
 const link=runtime.world.all().find(n=>n.dataset.spatialNode==='inkoop');
 resolution={...resolution,revision:2,visible_modules:['calendar'],enabled_modules:['calendar'],entitlements:['calendar'],capabilities:['calendar:events']};
 await runtime.world.fire('click',{target:link});assert.equal(assigned,null,'revoked link revalidated before navigation');assert.deepEqual(Array.from(runtime.graph.nodes.filter(n=>n.kind==='module'),n=>n.id),['agenda']);
 const agenda=runtime.world.all().find(n=>n.dataset.spatialNode==='agenda');await runtime.world.fire('click',{target:agenda});assert.equal(assigned,'/calendar');
 denied=true;await runtime.refresh();assert.equal(runtime.graph.nodes.length,0,'failed authorization leaves no stale modules');assert.ok(runtime.status.textContent.includes('niet beschikbaar'));
 runtime.destroy();assert.equal(runtime.available,false);
 window.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}});
 const reduced=new window.FoundlyCustomerSpatialRuntime(new Element('canvas'));await settle();assert.equal(reduced.rotation.running,false,'reduced-motion preference pauses default rotation');reduced.destroy();
 console.log('PASS spatial interaction handlers: pause/resume/manual continuity, keyboard freeze, live click revalidation, revoked and failed access, teardown. DOM-unit evidence only; no browser rendering claim.');
})().catch(e=>{console.error(e);process.exitCode=1});
