'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {browserFixture,Element}=require('../zero-evaluation/dom-fixture'),{locales}=require('../foundly-i18n');
const model=require('../customer-spatial-model'),scene=require('../customer-spatial-scene'),{resolve}=require('../capability-resolver'),{MODULES}=require('../module-catalog'),{WORKSPACE_DEFINITIONS}=require('../workspace-system');
// DOM state/ownership fixture, not WebGL or browser rendering evidence.
class ViewElement extends Element{
  constructor(tag){super(tag);this.style={setProperty(key,value){this[key]=value}};const classes=new Set();this.classList={add(...names){names.forEach(name=>classes.add(name))},remove(...names){names.forEach(name=>classes.delete(name))},contains(name){return classes.has(name)}};}
  get dataset(){return new Proxy({}, {get:(_,key)=>this.getAttribute('data-'+String(key).replace(/[A-Z]/g,c=>'-'+c.toLowerCase())),set:(_,key,value)=>{this.setAttribute('data-'+String(key).replace(/[A-Z]/g,c=>'-'+c.toLowerCase()),value);return true}});}
  prepend(...nodes){const old=this.childNodes.slice();this.replaceChildren(...nodes,...old);}
  removeEventListener(type,fn){this.handlers[type]=(this.handlers[type]||[]).filter(handler=>handler!==fn);}
  closest(selector){if(selector==='a[data-spatial-node]')return this.tag==='a'&&this.dataset.spatialNode?this:this.parentNode?.closest?.(selector)||null;return super.closest(selector);}
  getBoundingClientRect(){return {width:1440,height:800};}
  setPointerCapture(){}focus(){this.ownerDocument.activeElement=this;}
  remove(){if(this.parentNode){const parent=this.parentNode;parent.replaceChildren(...parent.childNodes.filter(node=>node!==this))}this.isConnected=false;}
}
function fixture(){
  const f=browserFixture('nl-NL'),document=f.context.document,root=f.context,events=new ViewElement('window'),scope={tenant_id:'locale-spatial',dealer_id:'native-dealer'};
  const create=tag=>{const node=new ViewElement(tag);node.ownerDocument=document;return node};document.createElement=create;document.createElementNS=(_,tag)=>create(tag);document.body=f.nodes.body=create('body');
  root.window=root;root.FoundlySpatialModel=model;root.addEventListener=events.addEventListener.bind(events);root.removeEventListener=events.removeEventListener.bind(events);
  let resolution=resolve(scope,{roles:['ADMIN']},{...scope,industry_id:'GENERAL',entitlements:Object.keys(MODULES),enabled_modules:Object.keys(MODULES),revision:1}),denied=false,assigned=null;const requests=[];
  Object.assign(root,{setInterval:()=>1,clearInterval(){},requestAnimationFrame:fn=>{root.nextFrame=fn;return 1},cancelAnimationFrame(){},console,fetch:async route=>{requests.push(route);return {ok:!denied,status:denied?403:200,json:async()=>route==='/api/composition'?{resolution}:route==='/api/workspaces'?{tenant:scope,workspaces:Object.values(WORKSPACE_DEFINITIONS)}:route==='/api/composition/catalog'?{modules:Object.values(MODULES)}:route==='/api/events'?{events:[{message:'Geen recente activiteit. <literal customer event>'}]}:{sources:[{source_id:'instagram',connection_status:'CONNECTED',runtime_enabled:true}]}}}});
  root.location.assign=value=>assigned=value;
  for(const file of ['customer-spatial-scene.js','customer-spatial-runtime.js'])vm.runInContext(fs.readFileSync(require.resolve('../'+file),'utf8'),root);
  const runtime=new root.FoundlyCustomerSpatialRuntime(create('canvas'));
  return {...f,runtime,requests,root,i:root.FoundlyI18n,assigned:()=>assigned,revoke(){resolution={...resolution,revision:2,visible_modules:['calendar'],enabled_modules:['calendar'],entitlements:['calendar'],capabilities:['calendar:events']}},deny(){denied=true}};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
test('active spatial dashboard changes eight locales without changing canonical graph, pose, links, focus, search or source requests',async()=>{
  const f=fixture();await settle();const r=f.runtime;r.setPaused(true);r.rotation.manual(.3,-.2);r.renderPose();
  const canonical=JSON.stringify(r.graph),pose=JSON.stringify(r.rotation),geometry=JSON.stringify(r.scene.graph),positions=r.nodes.map(n=>n.host.style.transform),faces=r.nodes.map(n=>n.face),links=r.sidebar.children.slice(),count=f.requests.length;
  const search=r.chrome.all().find(n=>n.tag==='input');search.value='Inkoop';await search.fire('input');const searchLink=r.searchResults.children[0];assert.ok(searchLink);search.focus();
  const captions=[];const original=r.scene.setLabels.bind(r.scene);r.scene.setLabels=(labels,subtitle)=>{captions.push({labels,subtitle});return original(labels,subtitle)};
  for(const locale of locales){
    f.i.setLocale(locale);assert.equal(f.requests.length,count);assert.equal(JSON.stringify(r.graph),canonical);assert.equal(JSON.stringify(r.rotation),pose);assert.equal(JSON.stringify(r.scene.graph),geometry);
    assert.deepEqual(r.nodes.map(n=>n.host.style.transform),positions);assert.deepEqual(r.nodes.map(n=>n.face),faces);assert.deepEqual(r.sidebar.children,links);assert.equal(f.root.document.activeElement,search);assert.equal(search.value,'Inkoop');assert.equal(r.searchResults.children[0],searchLink);
    assert.equal(r.toggle.textContent,f.i.t('spatial.resume'));assert.equal(r.indicator.textContent,f.i.t('spatial.paused'));assert.equal(search.getAttribute('placeholder'),f.i.t('spatial.search_placeholder'));assert.equal(searchLink.textContent,f.i.t('spatial.module.inkoop'));
    const face=r.nodes.find(n=>n.node.id==='inkoop').face,sidebar=links.find(n=>n.dataset.spatialNode==='inkoop');assert.equal(face.textContent,f.i.t('spatial.module.inkoop'));assert.equal(sidebar.textContent,f.i.t('spatial.module.inkoop'));assert.equal(sidebar.children[0].tag,'svg');assert.equal(sidebar.href,'/procurement');
    const event=r.nodes.find(n=>n.node.id==='agenda:events').face;assert.equal(event.textContent,f.i.t('spatial.cap.calendar_events'));assert.equal(event.getAttribute('aria-label'),f.i.t('spatial.node_label',{label:f.i.t('spatial.cap.calendar_events'),module:f.i.t('spatial.module.agenda')}));
    const instagram=r.nodes.find(n=>n.node.id==='social:instagram');assert.equal(instagram.face.textContent,'Instagram');assert.equal(instagram.face.href,'/marketing?section=SOCIAL');assert.equal(captions.at(-1).labels.get('inkoop'),f.i.t('spatial.module.inkoop'));assert.equal(captions.at(-1).subtitle,f.i.t('spatial.motion'));assert.deepEqual(Array.from(f.i.missingKeys()),[]);
  }
  search.value=f.i.t('spatial.module.finance');await search.fire('input');assert.ok(r.searchResults.children.some(n=>n.dataset.spatialNode==='finance'));assert.equal(f.requests.length,count);
  const bell=r.chrome.all().find(n=>n.className==='reference-bell');await bell.fire('click');const eventText=r.notice.children[0];assert.equal(eventText.textContent,'Geen recente activiteit. <literal customer event>');const eventRequests=f.requests.length;f.i.setLocale('fr-FR');assert.equal(r.notice.children[0],eventText);assert.equal(eventText.textContent,'Geen recente activiteit. <literal customer event>');assert.equal(f.requests.length,eventRequests);
  r.destroy();const captionsBefore=captions.length;f.i.setLocale('de-DE');assert.equal(captions.length,captionsBefore);
});
test('localized spatial links retain native current-permission revalidation and failed reads clear formerly visible modules',async()=>{
  const f=fixture();await settle();f.i.setLocale('fr-FR');const r=f.runtime,link=r.nodes.find(n=>n.node.id==='inkoop').face;f.revoke();await r.world.fire('click',{target:link});assert.equal(f.assigned(),null);assert.deepEqual(Array.from(r.graph.nodes.filter(n=>n.kind==='module'),n=>n.id),['agenda']);assert.equal(r.status.textContent,f.i.t('spatial.revoked'));
  const agenda=r.nodes.find(n=>n.node.id==='agenda').face;await r.world.fire('click',{target:agenda});assert.equal(f.assigned(),'/calendar');f.deny();await r.refresh();assert.equal(r.graph.nodes.length,0);assert.equal(r.sidebar.children.length,1);assert.equal(r.status.textContent,f.i.t('spatial.unavailable'));const count=f.requests.length;
  f.i.setLocale('sv-SE');assert.equal(f.requests.length,count);assert.equal(r.graph.nodes.length,0);assert.equal(r.status.textContent,f.i.t('spatial.unavailable'));r.destroy();
});
test('scene relabeling replaces only text textures, preserves all geometry references and rolls back a failed allocation',()=>{
  const positions=[[1,2,3],[4,5,6]],deleted=[],renderer=Object.create(scene.Scene.prototype),oldTextures=[{id:'old-core'},{id:'old-module'}],labels=[{id:'core',kind:'core',label:'FOUNDLY',subtitle:'Original',position:positions[0],texture:oldTextures[0]},{id:'inkoop',kind:'module',label:'INKOOP',position:positions[1],texture:oldTextures[1]}];
  Object.assign(renderer,{available:true,labels,textures:oldTextures,graph:{nodes:[{id:'inkoop',position:positions[1]}],paths:[{from:'core',to:'inkoop'}]},buffers:['geometry-buffer'],lineBuffer:{id:'lines'},pointBuffer:{id:'points'},gl:{deleteTexture:texture=>deleted.push(texture)},texture(node){const texture={id:node.label};this.textures.push(texture);return {texture,width:160,height:102}}});
  const graph=renderer.graph,geometry=JSON.stringify(graph),buffers=renderer.buffers,lineBuffer=renderer.lineBuffer,pointBuffer=renderer.pointBuffer;
  renderer.setLabels(new Map([['inkoop','PROCUREMENT']]),'INTELLIGENCE IN MOTION');assert.equal(renderer.graph,graph);assert.equal(JSON.stringify(renderer.graph),geometry);assert.equal(renderer.buffers,buffers);assert.equal(renderer.lineBuffer,lineBuffer);assert.equal(renderer.pointBuffer,pointBuffer);assert.equal(renderer.labels[0].position,positions[0]);assert.equal(renderer.labels[1].position,positions[1]);assert.equal(renderer.labels[1].label,'PROCUREMENT');assert.deepEqual(deleted,oldTextures);
  const stableLabels=renderer.labels,stableTextures=renderer.textures;let created=0;renderer.texture=function(node){const texture={id:'partial'};this.textures.push(texture);if(++created===2)throw Error('allocation_failed');return {texture}};
  assert.throws(()=>renderer.setLabels(new Map([['inkoop','ACHATS']]),'L’INTELLIGENCE EN MOUVEMENT'),/allocation_failed/);assert.equal(renderer.labels,stableLabels);assert.equal(renderer.textures,stableTextures);assert.equal(renderer.graph,graph);assert.ok(stableTextures.every(texture=>!deleted.includes(texture)));assert.equal(deleted.filter(texture=>texture.id==='partial').length,2);
});
