'use strict';
// Explicit isolated test preload; never imported by runtime application code.
require('./test-masterbuild-fetch-mock');
const fs=require('node:fs');
require('./communication-smtp').createTransport=()=>async(config,{authorize})=>{
 const path=process.env.FOUNDLY_SMTP_AUTH_FIXTURE;if(!path)throw Error('Explicit SMTP fixture path required');const fixture=JSON.parse(fs.readFileSync(path,'utf8'));if(fixture.fixture!=='AUTHENTICATION_CONTRACT_NOT_LIVE')throw Error('Explicit SMTP fixture marker required');authorize();
 if(fixture.expected_auth_method){require('node:assert/strict').equal(config.auth_method,fixture.expected_auth_method);require('node:assert/strict').equal(config.password,undefined);require('./communication-sasl').credentials(config);}
 fs.writeFileSync(path+'.started','AUTHENTICATION_FIXTURE_NO_MAIL_SENT');
 if(fixture.wait){for(let n=0;n<250&&!fs.existsSync(path+'.release');n++)await new Promise(resolve=>setTimeout(resolve,20));if(!fs.existsSync(path+'.release'))throw Error('Fixture release timeout');}
 authorize();if(fixture.reject)throw Object.assign(new Error('Fixture rejected'),{code:'smtp_authentication_failed',statusCode:502});
 return {authenticated:true,authentication_verified:true,tls_verified:true,external_send:false,send_verified:false,mailbox_access_verified:false};
};
