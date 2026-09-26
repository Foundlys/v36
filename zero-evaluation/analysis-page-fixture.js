'use strict';
// Shared production-controller fixture; not rendered-browser or provider evidence.
const fs=require('node:fs'),vm=require('node:vm');
const {browserFixture,Element}=require('./dom-fixture');
const source=fs.readFileSync(require.resolve('../analysis-script.js'),'utf8');
class View extends Element{
 constructor(tag='div'){super(tag);Object.defineProperty(this,'dataset',{value:{}});const classes=new Set();this.classList={add:v=>classes.add(v),remove:v=>classes.delete(v),contains:v=>classes.has(v),toggle(v,on){if(on)classes.add(v);else classes.delete(v);}};}
 get innerHTML(){return this._html||'';}set innerHTML(value){this.replaceChildren();this._html=String(value);}
 get textContent(){return this._html||super.textContent;}set textContent(value){this._html='';super.textContent=value;}
 replaceChildren(...nodes){this._html='';for(const child of this.children)for(const node of child.all())node.isConnected=false;super.replaceChildren(...nodes);}
 querySelector(selector){return this.all().find(n=>n.tag===selector)||null;}
 click(){this.clicked=true;}
}
function fixture(){
 const f=browserFixture('en-GB'),calls=[],views=[],streams=[],downloads=[];let key=0,denied=false,hold=null,holdRoute='',holdRemaining=0,holdStarted=()=>{};const errors=new Map();
 for(const id of new Set([...source.matchAll(/\$\('#([^']+)'\)/g)].map(m=>m[1]).concat(['analysisModels','analysisActions'])))f.nodes[id]=new View();
 f.nodes.analysisWindow.value='3600';f.context.document.createElement=tag=>new View(tag);f.context.document.getElementById=id=>f.nodes[id]||null;
 const nativeWidget=()=>({setEnabled(...args){views.push(args)},selectedDefinition:()=>({id:'cohort_literal',revision:3})});
 const nativeBox=()=>Object.assign(new View('section'),nativeWidget(),{propose(){}});
 const dashboard={observed_at:'2026-09-24T12:34:00Z',kpis:{conversion_rate:{kpi:{id:'conversion_rate',name:'Conversion rate',version:1},available:true,value:12.5,unit:'PERCENT',drilldown:{source_count:1234}},pipeline_value:{kpi:{id:'pipeline_value',name:'Pipeline value',version:1},available:true,value:123456,unit:'CENTS',drilldown:{source_count:2}}},funnel:{events:1234,stages:[{stage:'ad_click',count:0},{stage:'Literal custom stage',count:1234}]},realtime:{events:1234,latest:[{event_id:'literal-private-event',event_name:'Literal event <script>',source:'Literal provider',received_at:'2026-09-24T12:34:00Z'}],freshness:{classification:'REALTIME',freshness_seconds:12}},historical:{rollups:[{date:'2026-09-24',event_name:'literal-private-event',source:'Literal provider',events:1234,last_received_at:'2026-09-24T12:34:00Z'}]}};
 const platform={persistence:{durable:false},providers:{meta:{connected:false,configured:true,authenticated:true,probe_ok:false,initial_sync_ok:false},google:{connected:true,configured:true,authenticated:true,probe_ok:true,initial_sync_ok:true}}},connectors={items:[{provider:'Literal <img> provider',state:'CONNECTED',connected:true,authenticated:true,probe_ok:true,initial_sync_ok:true,last_sync_at:'2026-09-24T12:34:00Z'}]},automation={workflow_count:1234,run_count:0,awaiting_approval:0,failed:0,execution_adapter:'Literal adapter'};
 const resolution={visible_modules:['analysis','automation'],capabilities:['analysis:kpis','analysis:funnel','analysis:reports','analysis:events','automation:workflows','automation:runs'],tools:['create_report']};
 const response=route=>route==='/api/composition'?{resolution}:route.startsWith('/api/analysis/dashboard')?dashboard:route==='/api/platform/status'?platform:route==='/api/platform/connectors'?connectors:route==='/api/automation/status'?automation:route==='/api/zero/turn'?{answer:'Literal <img> ZERO answer'}:route==='/api/platform/exports'?{count:1234,content:'Literal CSV bytes'}:{};
 f.context.fetch=async(route,options)=>{calls.push({route,options});const status=denied?403:errors.get(route)||200,data=JSON.stringify(status!==200?{code:'access_denied',error:'RAW_PRIVATE_ERROR'}:response(route));if(hold&&route.startsWith(holdRoute)&&holdRemaining-->0){holdStarted();await hold;}return {ok:status===200,status,text:async()=>data};};
 Object.assign(f.context,{window:f.context,sessionStorage:{},crypto:{randomUUID:()=> 'page-key-'+(++key)},URLSearchParams,Blob:class{constructor(parts,options){this.parts=parts;this.options=options;}},URL:{createObjectURL(blob){downloads.push(blob);return 'blob:fixture'},revokeObjectURL(){}},setTimeout:fn=>{f.scheduled=fn;return 1;},clearTimeout(){},addEventListener(){},FoundlyAnalysisLoading:require('../analysis-loading'),FoundlyCohortUI:{mount:nativeWidget},FoundlyAnalysisActions:{create:nativeBox},FoundlyAnalysisModels:{create:nativeBox},EventSource:class{constructor(route){this.route=route;this.handlers={};streams.push(this);}addEventListener(name,fn){this.handlers[name]=fn;}close(){this.closed=true;}}});
 vm.runInContext(source,f.context);
 return {...f,i:f.context.FoundlyI18n,calls,views,streams,downloads,dashboard,platform,connectors,automation,resolution,errors,deny:()=>denied=true,allow:()=>denied=false,hold(route){holdRoute=route;holdRemaining=1;let release;hold=new Promise(resolve=>release=resolve);release.started=new Promise(resolve=>holdStarted=resolve);return release;},key(name){return Object.values(f.nodes).flatMap(n=>n.all()).find(n=>n.getAttribute('data-i18n')==='analysis.page.'+name);}};
}
module.exports={fixture,View};
