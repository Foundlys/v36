'use strict';
// Explicit isolated HTTP/restart fixture. Never imported by runtime code.
require('./test-identity-body-barrier');
const fs=require('node:fs'),crypto=require('node:crypto');
require('./communication-smtp').createTransport=()=>{
 const authenticate=async()=>{throw Error('Authentication fixture not enabled here');};
 authenticate.submit=async(config,message,{authorize,beforeData})=>{
  const path=process.env.FOUNDLY_SMTP_SUBMISSION_FIXTURE;if(!path)throw Error('Explicit submission fixture path required');const fixture=JSON.parse(fs.readFileSync(path,'utf8'));if(fixture.fixture!=='SUBMISSION_CONTRACT_NOT_LIVE')throw Error('Explicit submission fixture marker required');
  fs.appendFileSync(path+'.calls','fixture\n');authorize();fs.writeFileSync(path+'.started','TRANSPORT_FIXTURE_ONLY');
  const wait=async suffix=>{fs.writeFileSync(path+suffix+'.started','FIXTURE_WAIT');for(let n=0;n<250&&!fs.existsSync(path+suffix+'.release');n++)await new Promise(resolve=>setTimeout(resolve,20));if(!fs.existsSync(path+suffix+'.release'))throw Error('Fixture release timeout');};
  if(fixture.before_wait)await wait('.before');if(fixture.crash_before_data)process.exit(87);authorize();beforeData();authorize();fs.appendFileSync(path+'.offered',crypto.createHash('sha256').update(message.data).digest('hex')+'\n');
  if(fixture.crash_after_data)process.exit(88);if(fixture.after_wait)await wait('.after');if(fixture.unknown)return {state:'UNKNOWN',provider_acceptance:null,external_send:true,delivery_verified:false};
  return {state:'ACCEPTED_BY_PROVIDER',provider_acceptance:true,external_send:true,tls_verified:true,authentication_verified:true,smtp_code:250,receipt_sha256:crypto.createHash('sha256').update('EXPLICIT_FIXTURE_ACCEPTANCE').digest('hex')};
 };return authenticate;
};
// Crash only in this test preload, after the actual encrypted receipt commit.
const recovery=require('./communication-submission-recovery'),retain=recovery.retain;
recovery.retain=(...args)=>{const receipt=retain(...args),path=process.env.FOUNDLY_SMTP_SUBMISSION_FIXTURE,fixture=JSON.parse(fs.readFileSync(path,'utf8'));if(fixture.crash_after_receipt)process.exit(89);return receipt;};
// Fail only the first message materialization in an explicitly selected case.
const {BusinessDomain}=require('./business-domains'),mutate=BusinessDomain.prototype.mutate;
BusinessDomain.prototype.mutate=function(ctx,callback){return mutate.call(this,ctx,()=>{const before=this.id==='communication'?this.bucket(ctx,'messages').length:0,result=callback(),path=process.env.FOUNDLY_SMTP_SUBMISSION_FIXTURE,fixture=path?JSON.parse(fs.readFileSync(path,'utf8')):{};if(this.id==='communication'&&fixture.fail_materialization_once&&this.bucket(ctx,'messages').length>before&&!fs.existsSync(path+'.materialization.failed')){fs.writeFileSync(path+'.materialization.failed','ISOLATED_PERSIST_FAILURE');throw Error('Isolated message materialization failure');}return result;});};
