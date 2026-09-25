'use strict';
// Actual controller/resolver/domain engine; a minimal DOM with controlled HTTP.
const {fixture:workspaceFixture}=require('./workspace-page-fixture'),{BusinessDomain,DEFINITIONS}=require('../business-domains'),{CapabilityResolver}=require('../capability-resolver');
const clone=value=>JSON.parse(JSON.stringify(value));
async function fixture({workspaceId='sales',entity='opportunities',start=true,industry='GENERAL'}={}){
 const f=workspaceFixture({workspaceId}),buckets=new Map(),ctx={tenant_id:'domain_ui_fixture',dealer_id:'default'},actor={id:'domain_fixture_owner',roles:['SUPER_ADMIN']},calls=[],overrides=new Map(),gates=[];
 const adapter={bucket(c,scope){const key=JSON.stringify([c,scope]);if(!buckets.has(key))buckets.set(key,[]);return buckets.get(key);},persist(){},audit(){},publish(){}},resolver=new CapabilityResolver(adapter);resolver.configure(ctx,actor,{industry_id:industry,entitlements:[workspaceId],expected_revision:0});const core=new BusinessDomain(workspaceId,adapter,resolver);
 let lost=false,denied=false;f.ui.state.activeSection=entity.toUpperCase();f.ui.state.workspace={id:workspaceId,short_label:'Literal domain',domain_required_fields:DEFINITIONS[workspaceId].required};f.context.FoundlyCalendarRecurrence=require('../calendar-recurrence');
 f.context.fetch=async(route,options={})=>{
  const method=options.method||'GET',input=options.body?JSON.parse(options.body):undefined,key=options.headers?.['idempotency-key'];calls.push({route,method,input,key});let value,status=200;
  try{
   if(denied)throw Object.assign(Error('PRIVATE_DOMAIN_DENIAL'),{statusCode:403,code:'domain_forbidden'});
   if(overrides.has(method+' '+route))value=clone(overrides.get(method+' '+route));
   else{const url=new URL(route,'https://fixture.test'),parts=url.pathname.split('/').slice(3),[collection,id]=parts;
    if(url.pathname==='/api/'+workspaceId+'/schema')value={ok:true,module_id:workspaceId,entities:DEFINITIONS[workspaceId].entities,required_fields:DEFINITIONS[workspaceId].required,industry_fields:require('../industry-field-contract').fieldContract(resolver,ctx,actor,workspaceId)};
    else if(method==='GET')value={ok:true,...(id?{record:core.get(ctx,actor,collection,decodeURIComponent(id))}:core.list(ctx,actor,collection,Object.fromEntries(url.searchParams)))};
    else{const {expected_revision,...payload}=input;value={ok:true,...core.save(ctx,actor,collection,payload,{id:id?decodeURIComponent(id):undefined,expected_revision,idempotency_key:key})};}
   }
  }catch(error){status=error.statusCode||500;value={code:error.code||'fixture_error',error:error.message};}
  value=clone(value);const gate=gates.find(g=>!g.used&&g.route===route&&g.method===method);if(gate){gate.used=true;gate.started();await gate.promise;}
  if(lost&&['POST','PUT'].includes(method)&&status<400){lost=false;throw Error('Controlled response loss after native domain mutation');}
  return {ok:status<400,status,json:async()=>clone(value)};
 };
 const content=f.nodes.contextContent,render=()=>f.ui.renderDomainSection(entity,content),form=()=>content.querySelector('form'),field=name=>form()?.querySelectorAll('input,select,textarea').find(n=>n.name===name),edit=()=>content.querySelector('tbody')?.querySelector('button');
 function hold(route,method='GET'){let release,started;const promise=new Promise(resolve=>release=resolve);release.started=new Promise(resolve=>started=resolve);gates.push({route,method,promise,started,used:false});return release;}
 if(start)await render();return {...f,calls,ctx,actor,adapter,resolver,core,content,render,form,field,edit,overrides,hold,lose(){lost=true;},deny(){denied=true;},writes:()=>calls.filter(c=>['POST','PUT'].includes(c.method))};
}
module.exports={fixture};
