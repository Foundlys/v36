'use strict';
// Actual controller and native resolver; controlled HTTP observations, no browser proof.
const {fixture:workspaceFixture}=require('./workspace-page-fixture'),{CapabilityResolver,canManage}=require('../capability-resolver'),{MODULES,BUNDLES,INDUSTRIES}=require('../module-catalog');
const clone=value=>JSON.parse(JSON.stringify(value));
async function fixture({start=true}={}){
 const f=workspaceFixture({workspaceId:'settings'}),buckets=new Map(),ctx={tenant_id:'composer_fixture',dealer_id:'default'},actor={id:'composer_owner',roles:['SUPER_ADMIN']},calls=[];
 const adapter={bucket(c,scope){if(!buckets.has(scope))buckets.set(scope,[]);return buckets.get(scope);},audit(c,a,operation){adapter.bucket(c,'platform:audit').push({operation,actor:a.id});},persist(){}};
 const resolver=new CapabilityResolver(adapter);resolver.configure(ctx,actor,{industry_id:'GENERAL',entitlements:['crm'],enabled_modules:['crm'],expected_revision:0});
 const catalog={ok:true,modules:clone(Object.values(MODULES)),bundles:clone(BUNDLES),industries:clone(INDUSTRIES)},overrides=new Map(),gates=[];let lost=false,denied=false;
 f.ui.state.activeSection='CAPABILITIES';f.ui.state.workspace={id:'settings',short_label:'Literal settings'};
 f.context.fetch=async(route,options={})=>{
  const method=options.method||'GET',input=options.body?JSON.parse(options.body):undefined;calls.push({route,method,input});let value,status=200;
  try{
   if(denied)throw Object.assign(Error('PRIVATE_DENIAL'),{statusCode:403,code:'composition_forbidden'});
   if(overrides.has(method+' '+route))value=clone(overrides.get(method+' '+route));
   else if(route==='/api/composition/catalog')value=catalog;
   else if(route==='/api/composition/preview')value=resolver.preview(ctx,actor,input);
   else if(route==='/api/composition'&&method==='PUT')value=resolver.configure(ctx,actor,input);
   else if(route==='/api/composition')value={ok:true,resolution:resolver.resolve(ctx,actor),profile:resolver.profile(ctx),can_manage:canManage(actor)};
   else if(route==='/api/workspaces')value={workspaces:[{id:'settings',route:'/settings',label:'Literal settings'}]};
   else throw Error('Unexpected fixture route '+route);
  }catch(error){status=error.statusCode||500;value={ok:false,code:error.code||'fixture_failure',error:error.message};}
  value=clone(value);const gate=gates.find(g=>!g.used&&g.route===route&&g.method===method);if(gate){gate.used=true;gate.started();await gate.promise;}
  if(lost&&method==='PUT'){lost=false;throw Error('Lost committed composition response');}
  return {ok:status<400,status,json:async()=>clone(value)};
 };
 const content=f.nodes.contextContent,render=()=>f.ui.renderComposer(content);
 const form=()=>content.querySelector('form'),preview=()=>form()?.querySelectorAll('button').find(n=>n.type==='submit'),apply=()=>form()?.querySelectorAll('button').find(n=>n.type==='button'),fieldsets=()=>form()?.querySelectorAll('fieldset')||[],industry=()=>form()?.querySelectorAll('select')[0];
 function hold(route,method='GET'){let release,started;const promise=new Promise(resolve=>release=resolve);release.started=new Promise(resolve=>started=resolve);gates.push({route,method,promise,started,used:false});return release;}
 if(start)await render();
 return {...f,calls,ctx,actor,resolver,adapter,catalog,overrides,content,render,form,preview,apply,fieldsets,industry,hold,lose(){lost=true;},deny(){denied=true;},allow(){denied=false;},writes:()=>calls.filter(c=>c.method==='PUT')};
}
module.exports={fixture};
