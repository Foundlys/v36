'use strict';
const crypto=require('node:crypto'),{scopedMutation}=require('./scoped-mutation'),{assertCorePermission}=require('./core-access-contracts'),{smtpConfigurationState}=require('./communication-provider-state');
const SCOPE='communication:mail_authentication',hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fail=(code,statusCode=409)=>{throw Object.assign(new Error('Mailverificatie is niet beschikbaar'),{code,statusCode});};
class MailAuthentication{
 constructor(core,{configuration,allowedHosts=()=>[],authenticate=require('./communication-smtp').createTransport()}={}){this.core=core;this.configuration=configuration;this.allowedHosts=allowedHosts;this.authenticate=authenticate;}
 authorize(ctx,actor){this.core.scope(ctx,actor,'write');this.core.resolver.assertCapability(ctx,actor,'communication:inbox','write');assertCorePermission(actor,'connectors:manage');}
 status(ctx){
  const config=this.configuration(ctx),configured=Object.values(config).every(Boolean),base=smtpConfigurationState(configured),proof=this.core.adapter.bucket(ctx,SCOPE)[0],now=Date.now();
  if(!configured)return base;
  const verified=proof?.status==='AUTHENTICATED'&&proof.config_hash===hash(config)&&Number.isSafeInteger(proof.verified_at_ms)&&proof.verified_at_ms<=now&&now-proof.verified_at_ms<15*60*1000;
  return {...base,authenticated:verified,authentication_verified:verified,tls_verified:verified,authentication_observed_at:verified?new Date(proof.verified_at_ms).toISOString():null,status:verified?'smtp_geauthenticeerd_inbox_niet_geverifieerd':base.status,blocker:verified?'MAIL_RECEIVE_AND_DELIVERY_RECONCILIATION_REQUIRED':'EXPLICIT_SMTP_AUTHENTICATION_REQUIRED',mailbox_access_verified:false,connected:false,send_verified:false};
 }
 async probe(ctx,actor){
  this.authorize(ctx,actor);const config=this.configuration(ctx);require('./communication-smtp').configuration(config);const fingerprint=hash(config),rows=this.core.adapter.bucket(ctx,SCOPE),now=Date.now();
  if(rows[0]?.status==='VERIFYING'&&now-rows[0].started_at_ms<30000)fail('mail_authentication_busy');
  const attempt=crypto.randomUUID(),actorId=actor.id;
  scopedMutation(this.core.adapter,ctx,[SCOPE,'platform:audit'],()=>{rows.splice(0,rows.length,{attempt_id:attempt,actor_id:actorId,config_hash:fingerprint,status:'VERIFYING',started_at_ms:now,schema_version:1});this.core.adapter.audit(ctx,actor,'SMTP_AUTHENTICATION_STARTED','communication:mail_authentication',attempt,{external_send:false});});
  const authorize=()=>{this.authorize(ctx,actor);if(hash(this.configuration(ctx))!==fingerprint)fail('mail_authentication_configuration_changed');if(rows[0]?.attempt_id!==attempt)fail('mail_authentication_attempt_changed');};
  try{
   const result=await this.authenticate(config,{allowedHosts:this.allowedHosts(),authorize});authorize();
   if(result.authenticated!==true||result.authentication_verified!==true||result.tls_verified!==true||result.external_send!==false||result.send_verified!==false)fail('mail_authentication_evidence_invalid',502);
   scopedMutation(this.core.adapter,ctx,[SCOPE,'platform:audit'],()=>{rows[0]={...rows[0],status:'AUTHENTICATED',verified_at_ms:Date.now(),transport:'SMTP_SUBMISSION',port:config.port};this.core.adapter.audit(ctx,actor,'SMTP_AUTHENTICATION_VERIFIED','communication:mail_authentication',attempt,{external_send:false,mailbox_access_verified:false});});
   return {ok:true,connector:{id:'email',...this.status(ctx)},external_send:false};
  }catch(error){
   // Finalizing this attempt cannot authorize business effects. A rejected or
   // interrupted verification never restores an older authenticated status.
   if(rows[0]?.attempt_id===attempt){try{scopedMutation(this.core.adapter,ctx,[SCOPE],()=>{rows[0]={...rows[0],status:'FAILED',failed_at_ms:Date.now(),error_code:/^(?:smtp_|mail_authentication_|composition_|core_|identity_)/.test(error.code||'')?error.code:'mail_authentication_failed'};});}catch{}}
   throw error;
  }
 }
}
module.exports={MailAuthentication,SCOPE};
