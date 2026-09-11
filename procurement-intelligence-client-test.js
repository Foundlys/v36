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


const {BusinessDomain}=require('./business-domains'),{CapabilityResolver}=require('./capability-resolver'),economics=require('./procurement-economics'),outcomes=require('./procurement-outcomes'),reviews=require('./procurement-reviews');
let state=new Map(),disk,broken=false;const ctx={tenant_id:'procurement-economics',dealer_id:'default'},admin={id:'admin',roles:['SUPER_ADMIN']},buyer={id:'buyer',roles:['VIEWER'],permissions:['procurement:read','procurement:write','procurement:export']},other={id:'other',roles:['VIEWER'],permissions:['procurement:write']},adapter={bucket(c,s){const key=JSON.stringify([c,s]);if(!state.has(key))state.set(key,[]);return state.get(key);},persist(){if(broken)throw Error('disk failure');disk=JSON.stringify([...state]);},audit(){},publish(){}};
const resolver=new CapabilityResolver(adapter);resolver.configure(ctx,admin,{entitlements:['procurement'],expected_revision:0});let core=new BusinessDomain('procurement',adapter,resolver);
core.save(ctx,admin,'approval_policies',{name:'Review',status:'OPEN',currency:'EUR',minimum_value_cents:0,approval_steps:[admin.id]});const supplier=core.save(ctx,buyer,'suppliers',{name:'Supplier'}).record,rfq=core.save(ctx,buyer,'rfqs',{title:'Two units',currency:'EUR',lines:[{item_id:'A',description:'Units',quantity:2}]}).record,bid=core.save(ctx,buyer,'bids',{title:'Bid',currency:'EUR',rfq_id:rfq.id,rfq_revision:1,supplier_id:supplier.id,evidence_reference:'Fixture offer',lines:[{item_id:'A',quantity:2,unit_price_cents:1000}]}).record;
const allocations=[{bid_id:bid.id,item_id:'A',quantity:2}],query={allocation_mode:'FULL',scenarios:[{id:'a',label:'Missing costs',allocations,costs:{shipping_cents:0}}]};let result=economics.compare(core,ctx,buyer,rfq.id,query);assert.equal(result.scenarios[0].recorded_bid_cents,2000);assert.equal(result.scenarios[0].landed_cost_cents,null);assert.deepEqual(result.lowest_assumed_cost_scenario_ids,[]);
const complete={...query,scenarios:[{id:'a',label:'Explicit zero costs',allocations,costs:{shipping_cents:0,tax_cents:0,fees_cents:0,handling_cents:0},expected_value_cents:1000},{id:'b',label:'Explicit extra shipping',allocations,costs:{shipping_cents:500,tax_cents:0,fees_cents:0,handling_cents:0},expected_value_cents:1000}]};result=economics.compare(core,ctx,buyer,rfq.id,complete);assert.equal(result.scenarios[0].scenario_margin_cents,-1000);assert.deepEqual(result.lowest_assumed_cost_scenario_ids,['a']);assert.equal(result.source_records_modified,false);assert.throws(()=>economics.compare(core,ctx,buyer,rfq.id,{...complete,expected_source_hash:'stale'}),{code:'procurement_economics_source_changed'});assert.throws(()=>economics.compare(core,ctx,buyer,rfq.id,{...complete,scenarios:[{...complete.scenarios[0],costs:{shipping_cents:null}}]}),{code:'procurement_economics_amount_invalid'});

const sourcing=require('./procurement-sourcing'),zero=require('./procurement-zero'),crypto=require('node:crypto'),calls=[];let lostSnapshot=true,lostReport=true;
async function request(route,options={}){
 const input=options.body?JSON.parse(options.body):{},key=options.headers?.['idempotency-key'];calls.push({route,input,key});let result;
 if(route==='/api/zero/turn'){result=zero.execute(core,ctx,buyer,input.client_context.procurement_action,{message:input.message,conversation_id:input.conversation_id,turn_id:input.turn_id});if(input.client_context.procurement_action.operation==='SNAPSHOT'&&lostSnapshot){lostSnapshot=false;throw Error('Lost snapshot response');}if(input.client_context.procurement_action.operation==='OBSERVE'&&lostReport){lostReport=false;throw Error('Lost observation response');}return result;}
 if(route.endsWith('/comparison'))return sourcing.compareBids(core,ctx,buyer,rfq.id);
 if(route.endsWith('/economics-preview'))return economics.compare(core,ctx,buyer,rfq.id,input);
 if(route.endsWith('/economics-snapshots')){result=economics.snapshot(core,ctx,buyer,rfq.id,input,{idempotency_key:key});if(lostSnapshot){lostSnapshot=false;throw Error('Lost snapshot response');}return result;}
 if(route.startsWith('/api/procurement/economics_snapshots'))return core.list(ctx,buyer,'economics_snapshots');
 if(route.endsWith('/outcomes'))return outcomes.supplier(core,ctx,buyer,supplier.id);
 if(route.endsWith('/outcome-observations')){result=outcomes.record(core,ctx,buyer,input,{idempotency_key:key});if(lostReport){lostReport=false;throw Error('Lost observation response');}return result;}
 throw Error('Unexpected path '+route);
}
const sandbox={crypto,URL,Intl,document:{createElement:tag=>new Element(tag)}};vm.createContext(sandbox);for(const file of ['procurement-intelligence-client.js','procurement-zero-client.js'])vm.runInContext(fs.readFileSync(file,'utf8'),sandbox);
let active=true,view;const make=options=>sandbox.FoundlyProcurementTransport.create({document:sandbox.document,request,isActive:()=>active,build:call=>{view=sandbox.FoundlyProcurementIntelligence.create({document:sandbox.document,request:call,isActive:()=>active,...options});return view;}});
(async()=>{
 let host=make({rfqId:rfq.id});await host.ready;if(process.argv.includes('--zero')){find(host,'select').value='zero';await find(host,'select').fire('change');}
 const form=find(view,'form');field(form,'Units — Bid — aantal').value='2';for(const title of ['Vervoer','Belastingen','Overige vergoedingen','Verwerking'])field(form,title+' (EUR)').value='0';await form.fire('input');assert.equal(view.canLeave(),false);await form.fire('submit');assert.ok(view.all().some(n=>n.textContent.includes('totaal')&&n.textContent.includes('20,00')));assert.equal(core.bucket(ctx,'economics_snapshots').length,0);
 let confirmForm=view.all().filter(n=>n.tag==='form')[1];field(confirmForm,'Reden bewaren').value='Explicit current costs';field(confirmForm,'Ik bevestig deze aannames').checked=true;await confirmForm.fire('submit');assert.equal(core.bucket(ctx,'economics_snapshots').length,1);assert.equal(view.canLeave(),false);await confirmForm.fire('submit');assert.deepEqual(calls.at(-1),calls.at(-2));assert.equal(core.bucket(ctx,'economics_snapshots').length,1);assert.equal(view.canLeave(),true);
 const snapshot=core.bucket(ctx,'economics_snapshots')[0];let p=reviews.previewAward(core,ctx,buyer,rfq.id,bid.id),award=reviews.prepareAward(core,ctx,buyer,rfq.id,{bid_id:bid.id,preview_fingerprint:p.preview_fingerprint,reason:'Native award',confirm:true},{idempotency_key:'award-client'}).record;award=reviews.reviewAward(core,ctx,admin,award.id,{expected_revision:1,decision:'APPROVE',reason:'Reviewed',confirm:true},{idempotency_key:'review-client'}).record;
 host=make({award});await host.ready;if(process.argv.includes('--zero')){find(host,'select').value='zero';await find(host,'select').fire('change');}const reportForm=find(view,'form');field(reportForm,'A geleverd').value='2';field(reportForm,'A afgekeurd').value='0';field(reportForm,'Afgesproken levering (UTC)').value='2026-08-01T00:00';field(reportForm,'Waargenomen levering; leeg indien niets geleverd (UTC)').value='2026-07-31T00:00';field(reportForm,'Waargenomen op (UTC)').value='2026-08-02T00:00';field(reportForm,'Gerapporteerde totale kosten (EUR)').value='25,00';field(reportForm,'Bronverwijzing').value='PRIVATE explicit manual report';field(reportForm,'Reden vastleggen').value='Observed cost';field(reportForm,'Ik bevestig deze gerapporteerde waarneming').checked=true;
 await find(reportForm,'button','Bewaarde scenario’s laden').fire('click');field(reportForm,'Vergelijken met bewaard kostenscenario (optioneel)').value=snapshot.id+':'+snapshot.comparison.scenarios[0].id;await reportForm.fire('input');assert.equal(view.canLeave(),false);await reportForm.fire('submit');assert.equal(core.bucket(ctx,'outcome_observations').length,1);await reportForm.fire('submit');const writes=calls.filter(c=>c.route.endsWith('/outcome-observations')||c.input.client_context?.procurement_action?.operation==='OBSERVE');assert.deepEqual(writes[0],writes[1]);assert.equal(core.bucket(ctx,'outcome_observations')[0].observation.economic_reference.reported_forecast_error_cents,500);assert.equal(view.canLeave(),true);
 active=false;const count=calls.length;await find(view,'form').fire('submit');assert.equal(calls.length,count);assert.equal(core.bucket(ctx,'orders').length,0);
 console.log('PASS Procurement intelligence '+(process.argv.includes('--zero')?'ZERO':'native')+' client: explicit quantity/cost inputs, missing-vs-zero semantics, separate confirmation, exact lost-response retry, retained scenario/observation linkage, dirty/detached guards; synthetic DOM, no browser proof');
})().catch(e=>{console.error(e);process.exitCode=1;});
