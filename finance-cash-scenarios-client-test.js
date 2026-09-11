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

const sandbox={document:{createElement:tag=>new Element(tag)}};vm.createContext(sandbox);vm.runInContext(fs.readFileSync('finance-cash-scenarios-client.js','utf8'),sandbox);
const {calculate}=require('./finance-cash-scenarios');const plan={as_of:'2026-09-01T00:00:00Z',horizon_days:30,opening_cash_cents:10000,entries:[{date:'2026-09-10T00:00:00Z',amount_cents:-1000}]};let calls=[],hold=null,active=true;
const request=async(url,options)=>{const body=JSON.parse(options.body);calls.push(body);if(hold)await hold;const baseline=calculate(plan),scenario=calculate(plan,body.changes);return {source_hash:'exact-source',currency:'USD',baseline,scenario,delta_closing_cents:scenario.closing_cash_cents-baseline.closing_cash_cents,recommendation:'<img src=x>',recorded_outcome:{available:false,reason:'Geen boekingsbron'}};};
(async()=>{const box=sandbox.FoundlyFinanceCashScenarios.create({document:sandbox.document,request,forecastId:'plan',isActive:()=>active});await box.ready;assert.equal(calls.length,1);assert.equal(box.canLeave(),true);
 field(box,'Scenario beginsaldo in centen').value='0';await find(box,'div').fire('input');assert.equal(box.canLeave(),false);await find(box,'button','Scenario berekenen').fire('click');assert.equal(calls.at(-1).expected_source_hash,'exact-source');assert.equal(calls.at(-1).changes.opening_cash_cents,0);assert.ok(box.all().some(e=>e.textContent.includes('US$')));assert.ok(find(box,'p','<img src=x>'));assert.equal(find(box,'img'),undefined);
 await find(box,'button','Scenario-invoer wissen').fire('click');assert.equal(box.canLeave(),true);assert.equal(field(box,'Scenario beginsaldo in centen').value,'10000');
 field(box,'Scenario beginsaldo in centen').value='';await find(box,'button','Scenario berekenen').fire('click');assert.equal(calls.length,3);assert.ok(find(box,'output').textContent.includes('gehele'));
 field(box,'Scenario beginsaldo in centen').value='100';let release;hold=new Promise(r=>release=r);const pending=find(box,'button','Scenario berekenen').fire('click');await Promise.resolve();active=false;const before=find(box,'output').textContent;release();await pending;assert.equal(find(box,'output').textContent,before);
 console.log('PASS Finance scenario screen: explicit current source and whole-cent assumptions, exact currency, dirty-input protection, reset, inert text and detached-response refusal; synthetic DOM only');
})().catch(e=>{console.error(e);process.exitCode=1;});
