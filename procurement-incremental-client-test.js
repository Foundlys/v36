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
 querySelector(tag){return this.all().find(child=>tag.startsWith('.')?child.className===tag.slice(1):child.tag===tag);}
 remove(){if(this.parentElement){const p=this.parentElement;p.children=p.children.filter(child=>child!==this);this.parentElement=null;}}
 prepend(child){this.append(child);this.children.unshift(this.children.pop());}
 focus(){this.focused=true;}
}
const find=(root,tag,label)=>root.all().find(el=>el.tag===tag&&(label===undefined||el.textContent===label));
const field=(root,label)=>find(root,'label',label).children[0];


const {BusinessDomain}=require('./business-domains'),{CapabilityResolver}=require('./capability-resolver'),incremental=require('./procurement-incremental-allocations'),reviews=require('./procurement-reviews');
let state=new Map(),disk,broken=false;const ctx={tenant_id:'incremental-fixture',dealer_id:'default'},admin={id:'admin',roles:['SUPER_ADMIN']},buyer={id:'buyer',roles:['MANAGER']},first={id:'first',roles:['VIEWER'],permissions:['procurement:approve']},second={id:'second',roles:['VIEWER'],permissions:['procurement:approve']};
const adapter={bucket(c,s){const k=JSON.stringify([c,s]);if(!state.has(k))state.set(k,[]);return state.get(k);},persist(){if(broken)throw Error('persistence failure');disk=JSON.stringify([...state]);},publish(){},audit(){}};
const resolver=new CapabilityResolver(adapter);resolver.configure(ctx,admin,{entitlements:['procurement'],expected_revision:0});let core=new BusinessDomain('procurement',adapter,resolver);
const low=core.save(ctx,admin,'approval_policies',{name:'Small',status:'OPEN',currency:'EUR',minimum_value_cents:0,approval_steps:[first.id]}).record,high=core.save(ctx,admin,'approval_policies',{name:'Cumulative',status:'OPEN',currency:'EUR',minimum_value_cents:5000,approval_steps:[first.id,second.id]}).record;
const supplier=core.save(ctx,buyer,'suppliers',{name:'Fixture supplier'}).record,rfq=core.save(ctx,buyer,'rfqs',{title:'Ten units',currency:'EUR',lines:[{item_id:'A',description:'Units',quantity:10}]}).record,bid=core.save(ctx,buyer,'bids',{title:'Six available units',bid_scope:'PARTIAL',currency:'EUR',rfq_id:rfq.id,rfq_revision:1,supplier_id:supplier.id,evidence_reference:'Partial quantity supplied in fixture',lines:[{item_id:'A',quantity:6,unit_price_cents:1000}]}).record;

let allocations=[{bid_id:bid.id,item_id:'A',quantity:4}],preview=incremental.preview(core,ctx,buyer,rfq.id,allocations),prior=reviews.prepareAward(core,ctx,buyer,rfq.id,{allocations,allocation_mode:'INCREMENTAL',preview_fingerprint:preview.preview_fingerprint,confirm:true,reason:'Earlier approved scope'},{idempotency_key:'first'}).record;reviews.reviewAward(core,ctx,first,prior.id,{expected_revision:1,decision:'APPROVE',confirm:true,reason:'Approved first scope'},{idempotency_key:'first-review'});
allocations=[{bid_id:bid.id,item_id:'A',quantity:2}];let lose=true;const calls=[],request=async(path,options)=>{const input=JSON.parse(options.body);calls.push({path,input,key:options.headers?.['idempotency-key']});if(path.endsWith('/incremental-allocation-preview'))return incremental.preview(core,ctx,buyer,rfq.id,input.allocations);const result=reviews.prepareAward(core,ctx,buyer,rfq.id,input,{idempotency_key:options.headers['idempotency-key']});if(lose){lose=false;throw Error('Lost response');}return result;};
const crypto=require('node:crypto'),sandbox={crypto,request,node:(tag,className='',text='')=>{const el=new Element(tag);el.className=className;el.textContent=text;return el;},friendlyError:e=>e.message};vm.createContext(sandbox);const source=fs.readFileSync('foundly-workspace.js','utf8'),start=source.indexOf('  async function prepareProcurementAward('),end=source.indexOf('  function appendAwardReview(',start);vm.runInContext(source.slice(start,end),sandbox);
(async()=>{const host=new Element('div');await sandbox.prepareProcurementAward({rfq_id:rfq.id},null,host,allocations,'INCREMENTAL');assert.equal(core.bucket(ctx,'awards').length,1);assert.ok(host.all().some(n=>n.textContent.includes('cumulatieve beoordelingsgrondslag: 60.00 EUR')));assert.ok(host.all().some(n=>n.textContent.includes('hierna resterend 4')));const form=find(host,'form');find(host,'textarea').value='Explicit remaining amount';await form.fire('submit');assert.equal(core.bucket(ctx,'awards').length,2);assert.equal(calls.at(-1).input.allocation_mode,'INCREMENTAL');await form.fire('submit');assert.deepEqual(calls.at(-1),calls.at(-2));assert.equal(core.bucket(ctx,'awards').length,2);assert.equal(core.bucket(ctx,'orders').length,0);
 console.log('PASS Procurement production allocation confirmation: explicit incremental route, displayed prior/cumulative value and remaining quantity, separate submit and exact lost-response retry without duplicate proposal/order; synthetic DOM');
})().catch(e=>{console.error(e);process.exitCode=1;});
