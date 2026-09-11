'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
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
const {BusinessDomain}=require('./business-domains'),{CapabilityResolver}=require('./capability-resolver'),{CalendarExternal}=require('./calendar-external');
const ctx={tenant_id:'external-screen',dealer_id:'default'},actor={id:'admin',roles:['ADMIN','SUPER_ADMIN']};let state=new Map(),reads=0,hold=null;
const adapter={bucket(c,s){const k=JSON.stringify([c,s]);if(!state.has(k))state.set(k,[]);return state.get(k);},persist(){},audit(){},publish(){}};
const resolver=new CapabilityResolver(adapter);resolver.configure(ctx,actor,{entitlements:['calendar'],expected_revision:0});const core=new BusinessDomain('calendar',adapter,resolver),cal=core.save(ctx,actor,'calendars',{name:'Local <img>',timezone:'Europe/Amsterdam'}).record;
const service=new CalendarExternal(core,{accountBinding:()=> 'account',read:async()=>{reads++;if(hold)await hold;return {kind:'calendar#events',timeZone:'Europe/Amsterdam',accessRole:'owner',items:[]};}});core.external=service;
let active=true;const request=async(url,options={})=>options.method==='POST'?service.reconcile(ctx,actor,JSON.parse(options.body)):service.status(ctx,actor,new URL(url,'https://fixture').searchParams.get('calendar_id'));
const sandbox={document:{createElement:tag=>new Element(tag)}};vm.createContext(sandbox);vm.runInContext(fs.readFileSync('calendar-external-client.js','utf8'),sandbox);
(async()=>{const box=sandbox.FoundlyCalendarExternal.create({document:sandbox.document,request,calendars:[cal],isActive:()=>active});
 const calendar=field(box,'Native agenda');calendar.value=cal.id;await calendar.fire('input');
 const submit=find(box,'button','Gekozen externe leesvenster verversen');await submit.fire('click');assert.equal(reads,0);
 await find(box,'button','Externe dekking bekijken').fire('click');assert.equal(reads,0,'Passive status does not request a provider');
 field(box,'Venster begin met UTC-offset').value='2026-09-20T00:00:00Z';field(box,'Venster einde met UTC-offset').value='2026-09-21T00:00:00Z';field(box,'Reden voor verversen').value='Explicit selected window';const confirmation=field(box,'Ik bevestig deze agenda en dit leesvenster','checkbox');confirmation.checked=true;
 await submit.fire('click');assert.equal(reads,1);assert.equal(service.status(ctx,actor,cal.id).revision,1);assert.equal(confirmation.checked,false);
 confirmation.checked=true;await field(box,'Venster einde met UTC-offset').fire('input');assert.equal(confirmation.checked,false);await submit.fire('click');assert.equal(reads,1);
 let release;hold=new Promise(r=>release=r);confirmation.checked=true;const pending=submit.fire('click');await Promise.resolve();active=false;const before=find(box,'output').textContent;release();await pending;assert.equal(find(box,'output').textContent,before,'Detached response cannot update the screen');
 console.log('PASS Calendar external screen: passive status, explicit current window/confirmation, changed-input invalidation, native reconciliation and detached response refusal; synthetic DOM');
})().catch(e=>{console.error(e);process.exitCode=1;});
