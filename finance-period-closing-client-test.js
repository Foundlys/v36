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


const sandbox={crypto:{randomUUID:()=> 'screen-close-key'},document:{createElement:tag=>new Element(tag)}};vm.createContext(sandbox);vm.runInContext(fs.readFileSync('finance-period-closing-client.js','utf8'),sandbox);
let active=true,lose=true,closes=[],effects=0;const period={id:'p1',name:'<img>',start_date:'2026-09-01',end_date:'2026-09-30',status:'OPEN'};
const request=async(url,options={})=>{if(url.includes('/records/'))return {items:[period],total:1,next_cursor:null};if(url.endsWith('/close-preview'))return {period,ready:true,source_hash:'a'.repeat(64),currency:'EUR',totals:{debit_cents_exact:'0',credit_cents_exact:'0'},blockers:[]};const data=JSON.parse(options.body);closes.push(data);if(effects===0)effects++;if(lose){lose=false;throw Error('lost response');}return {period:{...period,status:'CLOSED'},closing:{id:'receipt'},deduplicated:true};};
(async()=>{const box=sandbox.FoundlyFinancePeriodClosing.create({document:sandbox.document,request,isActive:()=>active});await box.ready;const select=field(box,'Fiscale periode'),reason=field(box,'Reden voor afsluiting'),confirm=field(box,'Ik bevestig deze interne periodecontrole'),submit=find(box,'button','Bevestigde periode afsluiten / resultaat verifiëren');
 await submit.fire('click');assert.equal(effects,0);select.value='p1';await select.fire('change');reason.value='Reviewed';await reason.fire('input');assert.equal(box.canLeave(),false);await find(box,'button','Periodecontrole bekijken').fire('click');assert.equal(confirm.checked,false);confirm.checked=true;await reason.fire('input');assert.equal(confirm.checked,false);confirm.checked=true;
 await submit.fire('click');assert.equal(effects,1);assert.equal(box.canLeave(),false);await find(box,'button','Selectie wissen').fire('click');assert.equal(select.value,'p1');await submit.fire('click');assert.deepEqual(closes[0],closes[1]);assert.equal(effects,1);assert.equal(box.canLeave(),true);assert.ok(find(box,'output').textContent.includes('geverifieerd'));assert.equal(find(box,'img'),undefined);
 active=false;await submit.fire('click');assert.equal(closes.length,2);
 console.log('PASS Finance close screen: separate current review and confirmation, invalidated confirmation, preserved uncertain request, exact retry, dirty/detached refusal and inert labels; synthetic DOM');
})().catch(e=>{console.error(e);process.exitCode=1;});
