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


const {BusinessDomain}=require('./business-domains'),{CapabilityResolver}=require('./capability-resolver'),{FoundlyPlatformCore}=require('./platform-core'),metrics=require('./marketing-metrics');
const state=new Map(),ctx={tenant_id:'marketing-metric-fixture',dealer_id:'default'},actor={id:'reader',roles:['MARKETING'],permissions:['events:read']},admin={id:'admin',roles:['SUPER_ADMIN']},adapter={bucket(c,s){const k=JSON.stringify([c,s]);if(!state.has(k))state.set(k,[]);return state.get(k);},persist(){},audit(){},publish(){}};
const resolver=new CapabilityResolver(adapter);resolver.configure(ctx,admin,{entitlements:['marketing'],expected_revision:0});const core=new BusinessDomain('marketing',adapter,resolver),platform=new FoundlyPlatformCore(adapter),rows=platform.bucket(ctx,'raw_events'),query={from:'2026-08-01T00:00:00.000Z',to:'2026-09-01T00:00:00.000Z'};
const event=(id,name,source,properties,extra={})=>({event_id:id,event_name:name,source,occurred_at:'2026-08-15T12:00:00.000Z',received_at:'2026-08-15T12:00:01.000Z',campaign_id:'campaign',permissions:{user_ids:[actor.id]},properties,...extra});
const financial={currency:'USD',financial_outcome_id:'order-1',financial_outcome_namespace:'merchant-ledger',financial_outcome_complete:true};
rows.push(event('spend','marketing_spend','meta',{currency:'USD',metric_semantics:'DELTA',spend_cents:1000,impressions:100,clicks:10}),event('won','deal_won','crm',{...financial,value_cents:9000}),event('paid','invoice_paid','finance',{...financial,revenue_cents:12000,attributed_revenue_cents:10000}),event('provider-duplicate','invoice_paid','google',{...financial,attributed_revenue_cents:10000}),event('lead','lead_created','meta',{}, {lead_id:'lead-1'}),event('outside','invoice_paid','finance',{...financial,revenue_cents:999999},{occurred_at:query.to}),event('private','invoice_paid','finance',{...financial,revenue_cents:999999},{permissions:{user_ids:['other']}}));

let active=true,hold=null;const calls=[];const request=async(path,options)=>{const input=JSON.parse(options.body);calls.push({path,input});if(hold)await hold;return path.endsWith('/drilldown')?metrics.drilldown(core,platform,ctx,actor,input):metrics.query(core,platform,ctx,actor,input);};
const sandbox={document:{createElement:tag=>new Element(tag)}};vm.createContext(sandbox);vm.runInContext(fs.readFileSync('marketing-metrics-client.js','utf8'),sandbox);
(async()=>{const box=sandbox.FoundlyMarketingMetrics.create({document:sandbox.document,request,isActive:()=>active});await box.ready;assert.equal(calls.length,0);field(box,'Periode begin met UTC-offset').value=query.from;field(box,'Periode einde exclusief met UTC-offset').value=query.to;await find(box,'button','Gekozen periode berekenen').fire('click');assert.ok(box.all().some(n=>n.textContent.includes('US$')));await find(box,'button','Berekening naar bronrecords volgen').fire('click');assert.ok(box.all().some(n=>n.textContent.includes('DUPLICATE_TERMINAL_OBSERVATION')));assert.equal(calls[1].input.query_fingerprint,metrics.query(core,platform,ctx,actor,query).query_fingerprint);
 await field(box,'Periode begin met UTC-offset').fire('input');assert.equal(find(box,'button','Berekening naar bronrecords volgen'),undefined);
 let release;hold=new Promise(r=>release=r);const pending=find(box,'button','Gekozen periode berekenen').fire('click');await Promise.resolve();active=false;const before=find(box,'output').textContent;release();await pending;assert.equal(find(box,'output').textContent,before);
 console.log('PASS Marketing period controls: explicit query window, exact currency separation, current source-bound drilldown, edited-input invalidation and detached-response refusal; production component in synthetic DOM');
})().catch(e=>{console.error(e);process.exitCode=1;});
