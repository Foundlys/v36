'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
class Element{
 get firstChild(){return this.children[0]||null;}
 constructor(tag){Object.assign(this,{tag,children:[],handlers:{},dataset:{},value:'',checked:false,textContent:'',isConnected:true});}
 append(...children){for(const child of children){if(child.parentElement)child.remove();child.parentElement=this;child.isConnected=this.isConnected;this.children.push(child);if(this.tag==='select'&&this.children.length===1)this.value=child.value;}}
 replaceChildren(...children){for(const child of this.children){child.parentElement=null;for(const node of child.all())node.isConnected=false;}this.children=[];this.append(...children);}
 setAttribute(key,value){this[key]=value;}
 addEventListener(name,handler){(this.handlers[name]??=[]).push(handler);}
 async fire(name,extra={}){for(const handler of this.handlers[name]||[])await handler({preventDefault(){},...extra});}
 all(){return [this,...this.children.flatMap(child=>child.all())];}
 querySelector(tag){return this.all().find(child=>child.tag===tag);}
 remove(){if(this.parentElement){const p=this.parentElement;p.children=p.children.filter(child=>child!==this);this.parentElement=null;}}
 prepend(child){this.append(child);this.children.unshift(this.children.pop());}
 focus(){this.focused=true;}
}
const find=(root,tag,label)=>root.all().find(el=>el.tag===tag&&(label===undefined||el.textContent===label));
const field=(root,label)=>find(root,'label',label).children[0];


const crypto=require('node:crypto'),{BusinessDomain}=require('./business-domains'),{CapabilityResolver}=require('./capability-resolver'),history=require('./marketing-creative-history');let state=new Map(),lose=false;
const ctx={tenant_id:'creative-screen',dealer_id:'default'},actor={id:'author',roles:['MARKETING']},admin={id:'admin',roles:['SUPER_ADMIN']},adapter={bucket(c,s){if(!state.has(s))state.set(s,[]);return state.get(s);},persist(){},audit(){},publish(){}};const resolver=new CapabilityResolver(adapter);resolver.configure(ctx,admin,{entitlements:['marketing'],expected_revision:0});const core=new BusinessDomain('marketing',adapter,resolver),source=core.save(ctx,actor,'creatives',{title:'<img>',content:'Original'}).record;let calls=[],active=true;
const request=async(route,options={})=>{const url=new URL(route,'https://fixture'),parts=url.pathname.split('/').filter(Boolean);if(!options.method)return parts.length===4?{record:core.get(ctx,actor,'creatives',parts[3])}:history.history(core,ctx,actor,parts[3],Object.fromEntries(url.searchParams));const input=JSON.parse(options.body),key=options.headers['idempotency-key'];calls.push({route,input,key});const result=history.save(core,ctx,actor,parts[3],input,{idempotency_key:key},parts[4]==='revisions'?parts[5]:null);if(lose){lose=false;throw Error('Lost response');}return result;};
const sandbox={crypto,document:{createElement:tag=>new Element(tag)}};vm.createContext(sandbox);vm.runInContext(fs.readFileSync('marketing-creative-history-client.js','utf8'),sandbox);
(async()=>{const box=sandbox.FoundlyMarketingCreativeHistory.create({document:sandbox.document,request,id:source.id,isActive:()=>active});await box.ready;field(box,'Creatieve inhoud').value='New source';await field(box,'Creatieve inhoud').fire('input');assert.equal(box.canLeave(),false);field(box,'Reden voor deze revisie').value='Explicit version';field(box,'Ik bevestig deze creatieve revisie').checked=true;lose=true;const submit=find(box,'button','Bevestigde revisie opslaan / resultaat verifiëren');await submit.fire('click');assert.equal(core.get(ctx,actor,'creatives',source.id).revision,2);await find(box,'button','Invoer wissen en actuele bron laden').fire('click');assert.equal(box.canLeave(),false);await submit.fire('click');assert.deepEqual(calls[0],calls[1]);assert.equal(core.get(ctx,actor,'creatives',source.id).revision,2);assert.equal(box.canLeave(),true);
 const original=box.all().find(n=>n.tag==='article'&&n.children[0].textContent.startsWith('Revisie 1'));await find(original,'button','Deze revisie voorbereiden').fire('click');assert.equal(core.get(ctx,actor,'creatives',source.id).revision,2);assert.equal(field(box,'Creatieve inhoud').value,'Original');assert.equal(field(box,'Creatieve inhoud').readOnly,true);field(box,'Reden voor deze revisie').value='Restore original';field(box,'Ik bevestig deze creatieve revisie').checked=true;await submit.fire('click');assert.equal(core.get(ctx,actor,'creatives',source.id).revision,3);assert.equal(core.get(ctx,actor,'creatives',source.id).content,'Original');assert.equal(find(box,'img'),undefined);
 active=false;await submit.fire('click');assert.equal(calls.length,3);
 console.log('PASS Marketing creative production controls: native version/restore, separate confirmation, preserved dirty/uncertain input, exact retry without duplicate revision, literal snapshots and detached refusal; synthetic DOM');
})().catch(e=>{console.error(e);process.exitCode=1;});
