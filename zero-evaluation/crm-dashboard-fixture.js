'use strict';
// Production dashboard controller with bootstrap deferred; no browser/layout proof.
const fs=require('node:fs'),vm=require('node:vm');
const {browserFixture}=require('./dom-fixture'),{View}=require('./analysis-page-fixture');
const source=fs.readFileSync(require.resolve('../crm-script.js'),'utf8');
class CrmView extends View{
 matches(selector){return selector.split(',').some(part=>{const s=part.trim();if(s.startsWith('.'))return s.slice(1).split('.').every(c=>(this.className||'').split(/\s+/).includes(c)||this.classList.contains(c));if(s.startsWith('[')){const match=s.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);return match&&this.getAttribute(match[1])!==null&&(match[2]===undefined||this.getAttribute(match[1])===match[2]);}return s===this.tag;});}
 querySelector(selector){return this.all().find(node=>node.matches(selector))||null;}
 closest(selector){return this.matches(selector)?this:this.parentNode?.closest?.(selector)||null;}
}
function fixture(){
 const f=browserFixture('en-GB'),calls=[],errors=new Map();let denied=false,held=null,holdRoute='',remaining=0,requestId=0,started=()=>{};
 for(const id of new Set([...source.matchAll(/\$\('#([^']+)'/g)].map(m=>m[1].split(' ')[0]).concat(['view-dashboard'])))f.nodes[id]=new CrmView();
 f.nodes.dashboardPreset.value='SALES';f.nodes['view-dashboard'].className='view active';f.nodes['view-dashboard'].id='view-dashboard';f.context.document.createElement=tag=>new CrmView(tag);f.context.document.querySelectorAll=selector=>[...new Set(Object.values(f.nodes).flatMap(n=>n.all()))].filter(n=>n.matches(selector));f.context.document.querySelector=selector=>selector.startsWith('#')?f.nodes[selector.slice(1)]||null:f.context.document.querySelectorAll(selector)[0]||null;
 const dashboard={dashboard:{id:'literal_dashboard',name:'Literal dashboard',revision:1,persisted:true,share_mode:'PRIVATE',filters:{},widgets:[{id:'literal_metric',type:'KPI',metric:'leads',x:0,y:0,w:4,h:2},{id:'literal_leads',type:'TABLE',metric:'priority_leads',x:4,y:0,w:8,h:4}]}},summary={analytics:{metrics:{leads:{available:true,value:1234,unit:'count',source_count:1234}},comparison:{metrics:{}},source_performance:[],owner_performance:[],pipeline_stages:[],trends:{lead_trend:[]},campaigns:[],stalled_deals:[],activity_feed:[]},priority_leads:{items:[{lead:{name:'Literal private <img> lead'},priority_score:77}]}},status={records:1234,change_token:'literal_change'};
 const response=route=>route.startsWith('/api/crm/dashboard')?dashboard:route.startsWith('/api/crm/summary')?summary:route==='/api/crm/status'?status:{};
 f.context.fetch=async(route,options)=>{calls.push({route,options});const code=denied?403:errors.get(route)||200,data=JSON.stringify(code===200?response(route):{code:'crm_forbidden',error:'RAW_PRIVATE_ERROR'});if(held&&route.startsWith(holdRoute)&&remaining-->0){started();await held;}return {ok:code===200,status:code,text:async()=>data};};
 Object.assign(f.context,{window:f.context,URLSearchParams,crypto:{randomUUID:()=> 'crm-dashboard-key-'+(++requestId)},setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){}});
 vm.runInContext(source.replace(/\ninit\(\);\s*$/,''),f.context);
 return {...f,i:f.context.FoundlyI18n,calls,errors,dashboard,summary,status,deny:()=>denied=true,allow:()=>denied=false,setEditing(value){vm.runInContext('state.editing='+Boolean(value),f.context);f.context.renderDashboard();},currentDashboard(){return JSON.parse(vm.runInContext('JSON.stringify(state.dashboard)',f.context));},hold(route){holdRoute=route;remaining=1;let release;held=new Promise(resolve=>release=resolve);release.started=new Promise(resolve=>started=resolve);return release;}};
}
module.exports={fixture,CrmView};
