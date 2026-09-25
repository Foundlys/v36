'use strict';
const crypto=require('node:crypto');
const {promisify}=require('node:util');
const {scopedMutation}=require('./scoped-mutation');
const {canManage}=require('./capability-resolver');
const {ROLE_IDS}=require('./module-role-policy');
const {MODULES}=require('./module-catalog');
const scrypt=promisify(crypto.scrypt),hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const clone=value=>JSON.parse(JSON.stringify(value));
const fail=(code,message,statusCode=403)=>{throw Object.assign(new Error(message),{code,statusCode});};
const SCRYPT={N:131072,r:8,p:1,maxmem:256*1024*1024};
const PUBLIC_FIELDS=['id','username','display_name','roles','permissions','team_ids','status','revision','created_at','updated_at','invite_expires_at'];
const publicMember=row=>({...Object.fromEntries(PUBLIC_FIELDS.filter(key=>row[key]!==undefined).map(key=>[key,clone(row[key])])),enrolled:Boolean(row.password_hash)});
const permissionIds=Object.values(MODULES).flatMap(module=>module.permissions);
let hashesInFlight=0;
async function passwordDigest(password,salt){
  if(typeof password!=='string'||Buffer.byteLength(password,'utf8')>1024)fail('identity_credentials_invalid','Ongeldige aanmeldgegevens',401);
  if(hashesInFlight>=2)fail('identity_busy','Aanmelden is tijdelijk bezet; probeer opnieuw',429);
  hashesInFlight++;
  try{return (await scrypt(password,salt,32,SCRYPT)).toString('hex');}finally{hashesInFlight--;}
}
function username(value){const normalized=String(value||'').trim().toLowerCase();if(!/^[a-z0-9][a-z0-9._@+-]{2,199}$/.test(normalized))fail('identity_username_invalid','Gebruik een gebruikersnaam van 3–200 geldige tekens',422);return normalized;}
function access(input){
  const roles=input.roles,permissions=input.permissions||[],teams=input.team_ids||[];
  if(!Array.isArray(roles)||!roles.length||roles.length>10||roles.some(role=>!ROLE_IDS.includes(role))||!Array.isArray(permissions)||permissions.length>50||permissions.some(permission=>!permissionIds.includes(permission))||!Array.isArray(teams)||teams.length>20||teams.some(team=>typeof team!=='string'||!/^[A-Za-z0-9_.:-]{1,100}$/.test(team)))fail('identity_access_invalid','Kies geldige rollen, modulerechten en teams',422);
  return {roles:[...new Set(roles)].sort(),permissions:[...new Set(permissions)].sort(),team_ids:[...new Set(teams)].sort()};
}
class TenantIdentities{
  constructor(adapter){this.adapter=adapter;this.dummySalt=crypto.randomBytes(16).toString('hex');this.attempts=new Map();}
  now(){return this.adapter.now?.()||new Date();}
  bucket(ctx,name){return this.adapter.bucket(ctx,`identity:${name}`);}
  mutate(ctx,fn,extra=[]){return scopedMutation(this.adapter,ctx,['identity:members','identity:sessions','platform:audit',...extra],fn);}
  audit(ctx,actor,action,target,details={}){this.adapter.audit(ctx,actor,`IDENTITY_${action}`,'identity',target,details);}
  manage(ctx,actor){if(!canManage(actor))fail('identity_manage_forbidden','Gebruikersbeheer vereist Founder- of Super Admin-rechten');if(!this.adapter.composed(ctx))fail('identity_composition_required','Configureer eerst het tenantpakket',409);if(!this.adapter.encrypted())fail('identity_encryption_required','Versleutelde opslag is verplicht voor gebruikersbeheer',503);}
  requestId(value){if(typeof value!=='string'||!/^[A-Za-z0-9_.:-]{8,160}$/.test(value))fail('identity_request_invalid','Een geldige aanvraagsleutel is vereist',422);return value;}
  receiptResult(ctx,receipt){
    if(receipt.state==='ABANDONED')return clone(receipt.result);
    const current=this.bucket(ctx,'members').find(row=>row.id===receipt.result?.member?.id);
    if(!current||current.revision!==receipt.result.member.revision)fail('identity_request_superseded','Deze bevestigde wijziging is inmiddels vervangen; laad de actuele gebruiker',409);
    if(receipt.result.invite_token&&(current.status!=='INVITED'||current.invite_digest!==hash(receipt.result.invite_token)||Date.parse(current.invite_expires_at)<=this.now().getTime()))fail('identity_request_superseded','Deze uitnodiging is niet meer geldig; laad de actuele gebruiker',409);
    return clone(receipt.result);
  }
  request(ctx,actor,requestId){
    this.manage(ctx,actor);this.requestId(requestId);
    const row=this.bucket(ctx,'mutation_receipts').find(row=>row.request_id===requestId&&row.actor_id===actor.id);
    if(!row)fail('identity_request_missing','Voor deze gebruiker is geen bevestiging gevonden',404);
    return this.receiptResult(ctx,row);
  }
  recover(ctx,actor,requestId,input){
    this.manage(ctx,actor);this.requestId(requestId);
    if(!input||Object.keys(input).some(key=>!['operation','target_id','expected_revision','confirm'].includes(key))||input.confirm!==true||!['INVITE','UPDATE_ACCESS','REISSUE_INVITE'].includes(input.operation)||(input.operation==='INVITE'?input.target_id!==null||input.expected_revision!==0:typeof input.target_id!=='string'||!/^[A-Za-z0-9_.:-]{1,200}$/.test(input.target_id)||!Number.isSafeInteger(input.expected_revision)||input.expected_revision<1))fail('identity_recovery_invalid','Bevestig welke eerdere aanvraag moet worden hersteld',422);
    const rows=this.bucket(ctx,'mutation_receipts'),actor_id=actor.id,prior=rows.find(row=>row.request_id===requestId&&row.actor_id===actor_id);
    if(prior)return this.receiptResult(ctx,prior);
    if(rows.length>=10000)fail('identity_request_capacity','De capaciteit voor herstelbare identiteitswijzigingen is bereikt',507);
    // Synchronous with every identity effect: a body still arriving on another
    // request must encounter this durable terminal key before applying a change.
    return this.mutate(ctx,()=>{const result={ok:true,status:'NOT_APPLIED',request_id:requestId,operation:input.operation,target_id:input.target_id,expected_revision:input.expected_revision,actor_id,tenant_id:ctx.tenant_id,dealer_id:ctx.dealer_id};rows.push({request_id:requestId,actor_id,state:'ABANDONED',created_at:this.now().toISOString(),result});this.audit(ctx,actor,'REQUEST_ABANDONED',requestId,{operation:input.operation});return clone(result);},['identity:mutation_receipts']);
  }
  prepareRequest(ctx,actor,operation,target,input,requestId){
    if(requestId===undefined)return null;this.requestId(requestId);
    const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
    const digest=hash(JSON.stringify({operation,target,input:canonical(input)})),actor_id=actor.id,rows=this.bucket(ctx,'mutation_receipts'),prior=rows.find(row=>row.request_id===requestId&&row.actor_id===actor_id);
    if(prior){if(prior.state==='ABANDONED')fail('identity_request_abandoned','Deze aanvraag is afgesloten zonder wijziging; gebruik na controle een nieuwe aanvraag',409);if(prior.digest!==digest)fail('identity_request_conflict','Deze aanvraagsleutel is al voor andere invoer gebruikt',409);return {replay:this.receiptResult(ctx,prior)};}
    if(rows.length>=10000)fail('identity_request_capacity','De capaciteit voor herstelbare identiteitswijzigingen is bereikt',507);
    return {request_id:requestId,actor_id,operation,digest};
  }
  commitRequest(ctx,request,change){
    return this.mutate(ctx,()=>{const result=change();if(!request)return result;
      const response={...result,ok:true,request_id:request.request_id,operation:request.operation,actor_id:request.actor_id,tenant_id:ctx.tenant_id,dealer_id:ctx.dealer_id};
      this.bucket(ctx,'mutation_receipts').push({...request,created_at:this.now().toISOString(),result:clone(response)});return response;
    },request?['identity:mutation_receipts']:[]);
  }
  list(ctx,actor){this.manage(ctx,actor);return {items:this.bucket(ctx,'members').map(publicMember),roles:[...ROLE_IDS],permissions:permissionIds,tenant_id:ctx.tenant_id};}
  invite(ctx,actor,input,requestId){
    this.manage(ctx,actor);
    if(!input||Object.keys(input).some(key=>!['username','display_name','roles','permissions','team_ids','confirm','reason'].includes(key))||input.confirm!==true||typeof input.reason!=='string'||!input.reason.trim()||input.reason.length>500)fail('identity_confirmation_required','Bevestig de nieuwe gebruiker en diens rechten met een reden',422);
    if(typeof input.username!=='string')fail('identity_username_invalid','Gebruik een geldige gebruikersnaam',422);
    if(typeof input.display_name!=='string')fail('identity_name_required','Vul een naam van maximaal 200 tekens in',422);
    const login=username(input.username),display=String(input.display_name||'').trim(),grants=access(input),rows=this.bucket(ctx,'members');
    if(!display||display.length>200)fail('identity_name_required','Vul een naam van maximaal 200 tekens in',422);
    const request=this.prepareRequest(ctx,actor,'INVITE',null,input,requestId);if(request?.replay)return request.replay;
    if(rows.some(row=>row.username===login)||this.adapter.reservedUsername?.(login))fail('identity_username_exists','Deze gebruikersnaam is niet beschikbaar',409);
    if(rows.length>=10000)fail('identity_capacity','De gebruikerslimiet is bereikt',507);
    const token=crypto.randomBytes(32).toString('hex'),now=this.now();
    return this.commitRequest(ctx,request,()=>{const row={id:`member:${crypto.randomUUID()}`,schema_version:1,tenant_id:ctx.tenant_id,dealer_id:ctx.dealer_id,username:login,display_name:display,...grants,status:'INVITED',revision:1,created_at:now.toISOString(),updated_at:now.toISOString(),invite_digest:hash(token),invite_expires_at:new Date(now.getTime()+24*3600000).toISOString(),password_hash:null,password_salt:null};rows.push(row);this.audit(ctx,actor,'INVITE',row.id,{roles:row.roles,permissions:row.permissions,reason:input.reason.trim()});return {member:publicMember(row),invite_token:token,delivered:false,expires_at:row.invite_expires_at};});
  }
  invitation(ctx,token){
    if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))fail('identity_invitation_invalid','Uitnodiging is ongeldig of verlopen',401);
    const row=this.bucket(ctx,'members').find(row=>row.status==='INVITED'&&row.invite_digest===hash(token)&&Date.parse(row.invite_expires_at)>this.now().getTime());
    if(!row)fail('identity_invitation_invalid','Uitnodiging is ongeldig of verlopen',401);return row;
  }
  async enroll(ctx,input){
    if(!this.adapter.encrypted()||!this.adapter.composed(ctx))fail('identity_unavailable','Tenantidentiteit is niet beschikbaar',503);
    const row=this.invitation(ctx,input?.invite_token),revision=row.revision;
    if(typeof input.password!=='string'||[...input.password].length<15||[...input.password].length>128)fail('identity_password_invalid','Kies een wachtwoord van 15–128 tekens',422);
    const salt=crypto.randomBytes(16).toString('hex'),digest=await passwordDigest(input.password,salt);
    // Enrollment can race suspension or another redemption while scrypt runs.
    const current=this.invitation(ctx,input.invite_token);if(current.id!==row.id||current.revision!==revision)fail('identity_invitation_changed','De uitnodiging is gewijzigd',409);
    return this.mutate(ctx,()=>{current.password_hash=digest;current.password_salt=salt;current.password_scheme='SCRYPT_N131072_R8_P1_V1';current.status='ACTIVE';current.invite_digest=null;current.invite_expires_at=null;current.revision++;current.updated_at=this.now().toISOString();this.audit(ctx,{id:row.id},'ENROLL',row.id);return {member:publicMember(current)};});
  }
  throttle(ctx,login){
    const now=this.now().getTime(),key=hash(JSON.stringify([ctx,login])),prior=this.attempts.get(key);
    if(prior&&prior.until>now&&prior.count>=10)fail('identity_rate_limited','Te veel aanmeldpogingen; probeer later opnieuw',429);
    this.attempts.set(key,{count:prior&&prior.until>now?prior.count+1:1,until:prior&&prior.until>now?prior.until:now+60000});
    if(this.attempts.size>20000)for(const [key,value]of this.attempts)if(value.until<=now)this.attempts.delete(key);
    if(this.attempts.size>20000)fail('identity_rate_limited','Aanmelden is tijdelijk begrensd',429);
  }
  async login(ctx,input){
    if(!this.adapter.encrypted()||!this.adapter.composed(ctx))fail('identity_unavailable','Tenantidentiteit is niet beschikbaar',503);
    let login;try{login=username(input?.username);}catch{fail('identity_credentials_invalid','Ongeldige aanmeldgegevens',401);}
    this.throttle(ctx,login);const row=this.bucket(ctx,'members').find(row=>row.username===login),revision=row?.revision;
    const expected=/^[a-f0-9]{64}$/.test(row?.password_hash||'')?row.password_hash:'0'.repeat(64),digest=await passwordDigest(input.password,row?.password_salt||this.dummySalt),current=this.bucket(ctx,'members').find(member=>member.id===row?.id);
    if(!crypto.timingSafeEqual(Buffer.from(digest,'hex'),Buffer.from(expected,'hex'))||!current||current.status!=='ACTIVE'||current.revision!==revision||current.password_hash!==expected||current.password_scheme!=='SCRYPT_N131072_R8_P1_V1')fail('identity_credentials_invalid','Ongeldige aanmeldgegevens',401);
    const token=crypto.randomBytes(32).toString('hex'),now=this.now(),sessions=this.bucket(ctx,'sessions');
    return this.mutate(ctx,()=>{for(let i=sessions.length-1;i>=0;i--)if(Date.parse(sessions[i].expires_at)<=now.getTime())sessions.splice(i,1);if(sessions.length>=50000)fail('identity_session_capacity','De sessielimiet is bereikt',503);sessions.push({digest:hash(token),member_id:row.id,member_revision:row.revision,created_at:now.toISOString(),expires_at:new Date(now.getTime()+8*3600000).toISOString()});this.audit(ctx,{id:row.id},'LOGIN',row.id);return {session_token:token,member:publicMember(row),expires_in:8*3600};});
  }
  sessionMember(ctx,token){
    if(!this.adapter.encrypted()||!this.adapter.composed(ctx))return null;
    if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))return null;
    const session=this.bucket(ctx,'sessions').find(row=>row.digest===hash(token)&&Date.parse(row.expires_at)>this.now().getTime());
    return session?this.bucket(ctx,'members').find(row=>row.id===session.member_id&&row.status==='ACTIVE'&&row.revision===session.member_revision)||null:null;
  }
  principal(ctx,memberId){const row=this.bucket(ctx,'members').find(row=>row.id===memberId&&row.status==='ACTIVE');if(!row)fail('identity_inactive','Deze gebruiker is niet actief',401);return {id:row.id,roles:[...row.roles],permissions:[...row.permissions],team_ids:[...row.team_ids]};}
  logout(ctx,token){const row=this.sessionMember(ctx,token);if(!row)return {ok:true};return this.mutate(ctx,()=>{const sessions=this.bucket(ctx,'sessions'),index=sessions.findIndex(row=>row.digest===hash(token));if(index>=0)sessions.splice(index,1);this.audit(ctx,{id:row.id},'LOGOUT',row.id);return {ok:true};});}
  update(ctx,actor,id,input,requestId){
    this.manage(ctx,actor);
    if(!input||Object.keys(input).some(key=>!['roles','permissions','team_ids','status','expected_revision','confirm','reason'].includes(key))||input.confirm!==true||typeof input.reason!=='string'||!input.reason.trim()||input.reason.length>500)fail('identity_confirmation_required','Bevestig de wijziging met een reden',422);
    const row=this.bucket(ctx,'members').find(row=>row.id===id);if(!row)fail('identity_missing','Gebruiker niet gevonden',404);
    const grants=access({...row,...input}),status=input.status||row.status;
    if(!['ACTIVE','SUSPENDED'].includes(status)||status==='ACTIVE'&&!row.password_hash)fail('identity_state_invalid','Alleen een ingeschreven gebruiker kan actief worden',422);
    if(!Number.isSafeInteger(input.expected_revision)||input.expected_revision<1)fail('identity_revision_conflict','Gebruiker is gewijzigd; controleer de huidige revisie',409);
    const request=this.prepareRequest(ctx,actor,'UPDATE_ACCESS',id,input,requestId);if(request?.replay)return request.replay;
    if(input.expected_revision!==row.revision)fail('identity_revision_conflict','Gebruiker is gewijzigd; controleer de huidige revisie',409);
    return this.commitRequest(ctx,request,()=>{Object.assign(row,grants,{status,revision:row.revision+1,updated_at:this.now().toISOString(),invite_digest:null,invite_expires_at:null});this.audit(ctx,actor,'UPDATE_ACCESS',row.id,{status,roles:row.roles,permissions:row.permissions,reason:input.reason.trim()});return {member:publicMember(row),sessions_revoked:true};});
  }
  reissue(ctx,actor,id,input,requestId){
    this.manage(ctx,actor);
    if(!input||Object.keys(input).some(key=>!['expected_revision','confirm','reason'].includes(key))||input.confirm!==true||!Number.isSafeInteger(input.expected_revision)||input.expected_revision<1||typeof input.reason!=='string'||!input.reason.trim()||input.reason.length>500)fail('identity_revision_conflict','Bevestig de huidige uitnodigingsrevisie met een reden',409);
    const request=this.prepareRequest(ctx,actor,'REISSUE_INVITE',id,input,requestId);if(request?.replay)return request.replay;
    const row=this.bucket(ctx,'members').find(row=>row.id===id);
    if(!row)fail('identity_missing','Gebruiker niet gevonden',404);
    if(row.password_hash)fail('identity_already_enrolled','Deze gebruiker heeft al eigen aanmeldgegevens',409);
    if(input.expected_revision!==row.revision)fail('identity_revision_conflict','Bevestig de huidige uitnodigingsrevisie met een reden',409);
    const token=crypto.randomBytes(32).toString('hex');
    return this.commitRequest(ctx,request,()=>{Object.assign(row,{status:'INVITED',invite_digest:hash(token),invite_expires_at:new Date(this.now().getTime()+24*3600000).toISOString(),revision:row.revision+1,updated_at:this.now().toISOString()});this.audit(ctx,actor,'REISSUE_INVITE',id,{reason:input.reason.trim()});return {member:publicMember(row),invite_token:token,delivered:false,expires_at:row.invite_expires_at};});
  }
}
module.exports={TenantIdentities,publicMember};
