'use strict';
const {canManage}=require('./capability-resolver');
const PUBLIC_IDENTITY_PATHS=new Set(['/api/identity/login','/api/identity/enroll','/api/identity/session']);
function cookieToken(req,name){const matches=String(req.headers.cookie||'').split(';').map(value=>value.trim()).filter(value=>value.startsWith(name+'='));return matches.length===1?matches[0].slice(name.length+1):'';}
function assertIdentityOrigin(req,origin){if(!origin||req.headers.origin!==origin)throw Object.assign(new Error('Aanmelden en sessiewijzigingen vereisen de eigen Foundly-origin'),{code:'identity_origin_forbidden',statusCode:403});}
function createIdentityApi({identities,context,principal,authorized,readBody,sendJson,origin,production}){
  const cookieName=production?'__Host-foundly_session':'foundly_session';
  const cookie=(token,seconds)=>`${cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${seconds}${production?'; Secure':''}`;
  async function handle(req,res,url){
    if(!url.pathname.startsWith('/api/identity/'))return false;
    const ctx=context();
    try{
      if(['/api/identity/login','/api/identity/enroll'].includes(url.pathname)&&req.method==='POST'){
        assertIdentityOrigin(req,origin());const input=await readBody(req);
        if(url.pathname==='/api/identity/enroll')return sendJson(res,201,await identities.enroll(ctx,input));
        const result=await identities.login(ctx,input);res.setHeader('set-cookie',cookie(result.session_token,result.expires_in));return sendJson(res,200,{member:result.member,expires_in:result.expires_in});
      }
      if(url.pathname==='/api/identity/session'&&req.method==='GET'){
        if(!authorized(req))return sendJson(res,200,{authenticated:false});
        const actor=principal();return sendJson(res,200,{authenticated:true,authentication_method:!req.headers.authorization&&identities.sessionMember(ctx,cookieToken(req,cookieName))?'MEMBER_SESSION':production?'BOOTSTRAP_ADMIN':'DEVELOPMENT_OR_ADMIN',principal:{id:actor.id,roles:actor.roles,permissions:actor.permissions||[],team_ids:actor.team_ids||[]},can_manage:canManage(actor)});
      }
      if(!authorized(req))return sendJson(res,401,{code:'identity_auth_required',error:'Authenticatie vereist'});
      if(url.pathname==='/api/identity/logout'&&req.method==='POST'){assertIdentityOrigin(req,origin());identities.logout(ctx,cookieToken(req,cookieName));res.setHeader('set-cookie',cookie('',0));return sendJson(res,200,{ok:true});}
      if(url.pathname==='/api/identity/users'&&req.method==='GET')return sendJson(res,200,identities.list(ctx,principal()));
      if(url.pathname==='/api/identity/users'&&req.method==='POST'){if(!origin())throw Object.assign(new Error('Een geldige openbare Foundly-origin is verplicht'),{code:'identity_origin_required',statusCode:503});const result=identities.invite(ctx,principal(),await readBody(req));return sendJson(res,201,{...result,enrollment_url:origin()+'/login#invite='+result.invite_token});}
      const member=url.pathname.match(/^\/api\/identity\/users\/([^/]{1,300})(?:\/(reissue))?$/);
      if(member){const id=decodeURIComponent(member[1]);if(!/^[A-Za-z0-9_.:-]{1,200}$/.test(id))return sendJson(res,400,{code:'identity_id_invalid'});if(member[2]&&req.method==='POST'){if(!origin())throw Object.assign(new Error('Een geldige openbare Foundly-origin is verplicht'),{code:'identity_origin_required',statusCode:503});const result=identities.reissue(ctx,principal(),id,await readBody(req));return sendJson(res,200,{...result,enrollment_url:origin()+'/login#invite='+result.invite_token});}if(!member[2]&&req.method==='PUT')return sendJson(res,200,identities.update(ctx,principal(),id,await readBody(req)));}
      return sendJson(res,404,{code:'identity_route_missing',error:'Identiteitsroute niet gevonden'});
    }catch(error){return sendJson(res,error.statusCode||500,{code:error.code||'identity_operation_failed',error:error.statusCode?error.message:'Identiteitsactie kon niet worden voltooid'});}
  }
  return {handle,cookieName,token:req=>cookieToken(req,cookieName)};
}
module.exports={createIdentityApi,PUBLIC_IDENTITY_PATHS,cookieToken,assertIdentityOrigin};
