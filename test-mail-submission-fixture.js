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
  if(fixture.before_wait)await wait('.before');authorize();beforeData();authorize();fs.appendFileSync(path+'.offered',crypto.createHash('sha256').update(message.data).digest('hex')+'\n');
  if(fixture.crash_after_data)process.exit(88);if(fixture.after_wait)await wait('.after');if(fixture.unknown)return {state:'UNKNOWN',provider_acceptance:null,external_send:true,delivery_verified:false};
  return {state:'ACCEPTED_BY_PROVIDER',provider_acceptance:true,external_send:true,tls_verified:true,authentication_verified:true,smtp_code:250,receipt_sha256:crypto.createHash('sha256').update('EXPLICIT_FIXTURE_ACCEPTANCE').digest('hex')};
 };return authenticate;
};
