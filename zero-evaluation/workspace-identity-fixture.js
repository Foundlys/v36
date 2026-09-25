'use strict';
// Actual controller and identity engine; controlled HTTP and a minimal DOM.
// Native authentication, encrypted storage and actual dropped replies have separate API tests.
const {fixture:workspaceFixture}=require('./workspace-page-fixture'),{TenantIdentities}=require('../tenant-identities');
const clone=value=>JSON.parse(JSON.stringify(value));
async function fixture({start=true,shared,storage}={}){
 const f=workspaceFixture({workspaceId:'settings'}),buckets=shared?.buckets||new Map(),ctx={tenant_id:'identity_ui_fixture',dealer_id:'default'},actor={id:'identity_fixture_admin',roles:['SUPER_ADMIN'],permissions:[],team_ids:[]},calls=[],overrides=new Map(),gates=[];
 const adapter={bucket(c,scope){const key=JSON.stringify([c,scope]);if(!buckets.has(key))buckets.set(key,[]);return buckets.get(key);},persist(){},audit(c,a,operation){adapter.bucket(c,'platform:audit').push({actor:a.id,operation});},encrypted:()=>true,composed:()=>true},identities=new TenantIdentities(adapter);
 const session=()=>({authenticated:true,tenant_id:ctx.tenant_id,dealer_id:ctx.dealer_id,public_origin:'https://identity.fixture.test',authentication_method:'BOOTSTRAP_ADMIN',principal:clone(actor),can_manage:actor.roles.includes('SUPER_ADMIN')});
 const saved=storage||new Map();f.context.sessionStorage={getItem:key=>saved.get(key)||null,setItem:(key,value)=>saved.set(key,String(value)),removeItem:key=>saved.delete(key)};f.context.location.assign=value=>{f.context.location.redirect=value;};
 let lost=false,denied=false;f.ui.state.activeSection='USERS';f.ui.state.workspace={id:'settings',short_label:'Literal settings'};
 const invitation=result=>result.invite_token?{...result,enrollment_url:session().public_origin+'/login#invite='+result.invite_token}:result;
 f.context.fetch=async(route,options={})=>{
  const method=options.method||'GET',input=options.body?JSON.parse(options.body):undefined,key=options.headers?.['idempotency-key'];calls.push({route,method,input,key});let value,status=200,m;
  try{
   if(denied)throw Object.assign(Error('PRIVATE_IDENTITY_DENIAL'),{statusCode:403,code:'identity_manage_forbidden'});
   if(overrides.has(method+' '+route))value=clone(overrides.get(method+' '+route));
   else if(route==='/api/identity/session')value=session();
   else if(route==='/api/identity/users'&&method==='GET')value=identities.list(ctx,actor);
   else if(route==='/api/identity/users'&&method==='POST')value=invitation(identities.invite(ctx,actor,input,key));
   else if((m=route.match(/^\/api\/identity\/requests\/([^/]+)(\/recover)?$/)))value=invitation(m[2]?identities.recover(ctx,actor,decodeURIComponent(m[1]),input):identities.request(ctx,actor,decodeURIComponent(m[1])));
   else if((m=route.match(/^\/api\/identity\/users\/([^/]+)(\/reissue)?$/)))value=invitation(m[2]?identities.reissue(ctx,actor,decodeURIComponent(m[1]),input,key):identities.update(ctx,actor,decodeURIComponent(m[1]),input,key));
   else if(route==='/api/identity/logout')value={ok:true};
   else throw Error('Unexpected fixture route '+route);
  }catch(error){status=error.statusCode||500;value={code:error.code||'fixture_error',error:error.message};}
  value=clone(value);const gate=gates.find(g=>!g.used&&g.route===route&&g.method===method);if(gate){gate.used=true;gate.started();await gate.promise;}
  if(lost&&['POST','PUT'].includes(method)&&status<400){lost=false;throw Error('Controlled loss after native mutation');}
  return {ok:status<400,status,json:async()=>clone(value)};
 };
 const content=f.nodes.contextContent,render=()=>f.ui.renderIdentityUsers(f.ui.state.activeSection,content),form=()=>content.querySelector('form');
 const field=(name,target=form())=>target?.querySelectorAll('input,select').find(n=>n.name===name),action=(name,target=content)=>target?.querySelectorAll('button').find(n=>n.getAttribute('data-identity-action')===name);
 function fill(target=form()){const inputs=target.querySelectorAll('input');(field('username',target)||inputs[0]).value='literal.person';(field('display_name',target)||inputs[1]).value='Literal private person';(field('reason',target)||inputs[inputs.length-2]).value='Reviewed identity access';(field('confirm',target)||inputs[inputs.length-1]).checked=true;}
 function hold(route,method='GET'){let release,started;const promise=new Promise(resolve=>release=resolve);release.started=new Promise(resolve=>started=resolve);gates.push({route,method,promise,started,used:false});return release;}
 if(start)await render();
 return {...f,calls,buckets,ctx,actor,adapter,identities,session,saved,overrides,content,render,form,field,fill,action,hold,lose(){lost=true;},deny(){denied=true;},writes:()=>calls.filter(c=>['POST','PUT'].includes(c.method))};
}
module.exports={fixture};
