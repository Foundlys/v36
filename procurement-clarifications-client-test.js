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
 querySelectorAll(selector){const tags=selector.split(',');return this.all().filter(e=>tags.includes(e.tag));}
 remove(){if(this.parentElement){const p=this.parentElement;p.children=p.children.filter(child=>child!==this);this.parentElement=null;}}
 prepend(child){this.append(child);this.children.unshift(this.children.pop());}
 focus(){this.focused=true;}
}
const find=(root,tag,label)=>root.all().find(el=>el.tag===tag&&(label===undefined||el.textContent===label));
const field=(root,label)=>find(root,'label',label).children[0];


const {BusinessDomain}=require('./business-domains'),{CapabilityResolver}=require('./capability-resolver'),service=require('./procurement-clarifications');
let state=new Map(),disk,broken=false;const ctx={tenant_id:'clarifications',dealer_id:'default'},admin={id:'admin',roles:['SUPER_ADMIN']},owner={id:'owner',roles:['MANAGER']},collaborator={id:'colleague',roles:['MANAGER']},unassigned={id:'unassigned',roles:['MANAGER']},stranger={id:'stranger',roles:['VIEWER']},members=[admin,owner,collaborator,unassigned,stranger],inactive=new Set();
const adapter={bucket(c,s){const key=JSON.stringify([c,s]);if(!state.has(key))state.set(key,[]);return state.get(key);},persist(){if(broken)throw Error('disk failure');disk=JSON.stringify([...state]);},audit(){},publish(){},memberActive(c,id){return members.some(m=>m.id===id)&&!inactive.has(id);},memberPrincipal(c,id){return members.find(m=>m.id===id);},draftMember(c,id){return {display_name:id};},draftCollaborators(c,q){return members.filter(m=>m.id.includes(q)).map(m=>({id:m.id,display_name:m.id}));}};
const resolver=new CapabilityResolver(adapter);resolver.configure(ctx,admin,{entitlements:['procurement'],expected_revision:0});let core=new BusinessDomain('procurement',adapter,resolver);
const supplier=core.save(ctx,owner,'suppliers',{name:'PRIVATE supplier'}).record,rfq=core.save(ctx,owner,'rfqs',{title:'PRIVATE request',currency:'EUR',lines:[{item_id:'A',description:'Item',quantity:2}]}).record;

const sourcing=require('./procurement-sourcing'),zero=require('./procurement-zero'),crypto=require('node:crypto'),calls=[];let actor=owner,loseCreate=true,loseReply=true;
async function request(route,options={}){const input=options.body?JSON.parse(options.body):{},key=options.headers?.['idempotency-key'];calls.push({route,input,key});let value;
 if(route==='/api/zero/turn'){value=zero.execute(core,ctx,actor,input.client_context.procurement_action,{message:input.message,conversation_id:input.conversation_id,turn_id:input.turn_id});const op=input.client_context.procurement_action.operation;if(op==='CLARIFY'&&loseCreate){loseCreate=false;throw Error('Lost question response');}if(op==='REPLY'&&loseReply){loseReply=false;throw Error('Lost entry response');}return value;}
 const url=new URL(route,'https://foundly.invalid'),parts=url.pathname.split('/').filter(Boolean);
 if(route.includes('/comparison'))return sourcing.compareBids(core,ctx,actor,rfq.id);
 if(parts[2]==='suppliers')return core.list(ctx,actor,'suppliers',Object.fromEntries(url.searchParams));
 if(parts[2]==='rfqs')return service.list(core,ctx,actor,rfq.id,Object.fromEntries(url.searchParams));
 if(parts[2]==='clarifications'&&parts[3]==='collaborators')return service.collaborators(core,ctx,actor,Object.fromEntries(url.searchParams));
 if(parts.length===3){value=service.create(core,ctx,actor,input,{idempotency_key:key});if(loseCreate){loseCreate=false;throw Error('Lost question response');}return value;}
 if(parts.length===4)return service.read(core,ctx,actor,parts[3]);
 if(parts[4]==='entries'){value=service.change(core,ctx,actor,parts[3],input,{idempotency_key:key});if(loseReply){loseReply=false;throw Error('Lost entry response');}return value;}
 if(parts[4]==='collaborators')return service.share(core,ctx,actor,parts[3],input,{idempotency_key:key});
 throw Error('Unexpected request '+route);
}
const sandbox={crypto,URL,URLSearchParams,document:{createElement:tag=>new Element(tag)}};vm.createContext(sandbox);for(const file of ['procurement-clarifications-client.js','procurement-zero-client.js'])vm.runInContext(fs.readFileSync(file,'utf8'),sandbox);let view,active=true;
(async()=>{const host=sandbox.FoundlyProcurementTransport.create({document:sandbox.document,request,isActive:()=>active,build:call=>{view=sandbox.FoundlyProcurementClarifications.create({document:sandbox.document,request:call,rfqId:rfq.id,isActive:()=>active});return view;}});await host.ready;if(process.argv.includes('--zero')){find(host,'select').value='zero';await find(host,'select').fire('change');}
 let form=find(view,'form');await find(form,'button','Leveranciers laden').fire('click');field(form,'Leverancier').value=supplier.id;await field(form,'Leverancier').fire('change');field(form,'Medebewerkers zoeken').value='coll';await find(form,'button','Zoeken').fire('click');field(form,collaborator.id).checked=true;await field(form,collaborator.id).fire('change');field(form,'Vraag aan leverancier').value='<img src=x onerror=alert(1)> PRIVATE question';field(form,'Reden').value='Explicit question';field(form,'Ik bevestig deze vraag en medebewerkers').checked=true;await form.fire('input');assert.equal(view.canLeave(),false);await form.fire('submit');assert.equal(core.bucket(ctx,'supplier_clarifications').length,1);assert.equal(view.canLeave(),false);await form.fire('submit');const creates=calls.filter(c=>c.route==='/api/procurement/clarifications'||c.input.client_context?.procurement_action?.operation==='CLARIFY');assert.deepEqual(creates[0],creates[1]);assert.equal(view.canLeave(),true);assert.equal(core.bucket(ctx,'supplier_clarifications')[0].entries.length,1);assert.ok(view.all().some(n=>n.textContent.includes('<img src=x')));assert.equal(view.all().some(n=>n.tag==='img'),false);
 actor=collaborator;form=find(view,'form');field(form,'Soort bijdrage').value='USER_REPORTED_SUPPLIER_RESPONSE';field(form,'Bijdrage').value='PRIVATE reported delivery next week';field(form,'Bronverwijzing bij leveranciersreactie').value='Manual call reference';field(form,'Reden').value='Record report';field(form,'Ik bevestig deze bijdrage').checked=true;await form.fire('input');await form.fire('submit');assert.equal(core.bucket(ctx,'supplier_clarifications')[0].entries.length,2);await form.fire('submit');const writes=calls.filter(c=>c.route.endsWith('/entries')||c.input.client_context?.procurement_action?.operation==='REPLY');assert.deepEqual(writes[0],writes[1]);assert.equal(core.bucket(ctx,'supplier_clarifications')[0].entries[1].attribution,'USER_REPORTED_UNVERIFIED');assert.equal(view.canLeave(),true);
 active=false;const count=calls.length;await find(view,'form').fire('submit');assert.equal(calls.length,count);assert.equal(core.bucket(ctx,'orders').length,0);
 console.log('PASS supplier-clarification '+(process.argv.includes('--zero')?'ZERO':'native')+' production controls: supplier/member selection, explicit literal question and reported response, separate confirmation, exact lost-response retry, no duplicate, dirty/detached guards; synthetic DOM only');
})().catch(e=>{console.error(e);process.exitCode=1;});
