'use strict';
// Production controller with declared native response shapes, not browser proof.
const fs=require('node:fs'),vm=require('node:vm');
const {browserFixture,Element}=require('./dom-fixture');
const source=fs.readFileSync(require.resolve('../automotive-script.js'),'utf8');
class View extends Element{
 constructor(tag='div'){super(tag);Object.defineProperty(this,'dataset',{value:{}});}
 get innerHTML(){return this._html||'';}set innerHTML(value){this.replaceChildren();this._html=String(value);}
 get textContent(){return this._html||super.textContent;}set textContent(value){this._html='';super.textContent=value;}
 replaceChildren(...nodes){this._html='';for(const child of this.children)for(const node of child.all())node.isConnected=false;super.replaceChildren(...nodes);}
 querySelector(tag){return this.all().find(node=>node.tag===tag)||null;}
 focus(){this.focused=true;}scrollIntoView(){}remove(){this.parentNode?.replaceChildren(...this.parentNode.children.filter(n=>n!==this));}
}
function fixture(){
 const f=browserFixture('en-GB'),calls=[],store=new Map(),responses=new Map();let key=0,deny=false,held=null,holdRoute='',remaining=0,started=()=>{};
 const ids=new Set([...source.matchAll(/\$\('#([^']+)'\)/g)].map(m=>m[1].split(' ')[0]));for(const id of ids)f.nodes[id]=new View(id.endsWith('Form')?'form':'div');
 f.nodes.searchButton.append(new View('span'));f.nodes.detailScore.append(new View('strong'));f.nodes.zeroForm.append(new View('button'));
 f.context.document.createElement=tag=>new View(tag);f.context.document.querySelector=selector=>selector==='#zeroForm button'?f.nodes.zeroForm.querySelector('button'):selector.startsWith('#')?f.nodes[selector.slice(1)]||null:null;
 const status={version:'6.0.0',schema_version:'1.0.0',dealer_profile:{display_name:'Literal private dealer'},providers:[{provider:'rdw',category:'VEHICLE_TRUTH',configured:true,authenticated:true,adapter_available:true,probe:'NOT_RUN',real_search:'NOT_RUN'},{provider:'mobile_de',category:'MARKETPLACE',configured:true,authenticated:true,adapter_available:true,probe:'NOT_RUN',real_search:'NOT_RUN'}]};
 const overview={observed_at:'2026-09-24T12:34:00Z',provider_health:[{connector_id:'mobile_de',provider:'mobile_de',name:'Literal <img> provider',connection_state:'AUTHENTICATED',configuration_state:'CONFIGURED',authentication_state:'AUTHENTICATED',probe_state:'NOT_RUN',sync_state:'NOT_RUN',records:0}],today_opportunities:[],top_buy_scores:[],recent_searches:[],market_movement:{available:false,reason:'NO_EVIDENCE_BACKED_MARKET_SERIES'},inventory_risk:{available:true,records:1234,at_risk:0},stale_stock:{available:true,records:0},recent_zero_recommendations:[],data_freshness:[],source_coverage:[]};
 const search={status:'completed',results:[],criteria:{},provider_executions:[]},today={opportunities:[]},analysis={};
 const results=route=>route==='/api/automotive/status'?status:route==='/api/automotive/overview'?overview:route.startsWith('/api/automotive/opportunities/today')?today:route.endsWith('/analysis')?{analysis}:route==='/api/zero/turn'?{answer:'Literal ZERO answer'}:search;
 f.context.fetch=async(route,options)=>{calls.push({route,options});const override=responses.get(route),code=deny?403:override?.status??200,payload=JSON.stringify(deny?{error:'RAW_PRIVATE_ERROR',code:'access_denied'}:override?.payload??results(route));if(held&&route.startsWith(holdRoute)&&remaining-->0){started();await held;}return {ok:code===200,status:code,text:async()=>payload};};
 Object.assign(f.context,{sessionStorage:{getItem:name=>store.get(name)||null,setItem:(name,value)=>store.set(name,value)},crypto:{randomUUID:()=> 'auto-key-'+(++key)},URL,setTimeout:()=>1,clearTimeout(){}});
 vm.runInContext(source,f.context);
 return {...f,i:f.context.FoundlyI18n,calls,status,overview,search,today,analysis,respond:(route,value)=>responses.set(route,value),clearAnalyses(){vm.runInContext('app.analyses.clear()',f.context);},deny:()=>deny=true,allow:()=>deny=false,hold(route){holdRoute=route;remaining=1;let release;held=new Promise(resolve=>release=resolve);release.started=new Promise(resolve=>started=resolve);return release;},key(name){return Object.values(f.nodes).flatMap(n=>n.all()).find(n=>n.getAttribute('data-i18n')==='automotive.status.'+name);}};
}
module.exports={fixture,View};
