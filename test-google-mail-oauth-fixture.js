'use strict';
// Test-only preload. Application runtime never imports this module.
require('./test-mail-auth-fixture');
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
require('./communication-google-oauth-transport').createTransport=()=>async(kind,input,{authorize})=>{
 const path=process.env.FOUNDLY_GOOGLE_MAIL_OAUTH_FIXTURE;if(!path)throw Error('Explicit OAuth fixture path required');const fixture=JSON.parse(fs.readFileSync(path,'utf8'));assert.equal(fixture.fixture,'GOOGLE_MAIL_OAUTH_NOT_LIVE');authorize();fs.appendFileSync(path+'.calls',JSON.stringify({kind,grant_type:input.grant_type||null})+'\n');fs.writeFileSync(path+'.started','ISOLATED_OAUTH_NO_ACCOUNT');
 if(fixture.wait){for(let n=0;n<250&&!fs.existsSync(path+'.release');n++)await new Promise(resolve=>setTimeout(resolve,20));assert.ok(fs.existsSync(path+'.release'),'OAuth fixture release required');}authorize();
 const body=kind==='TOKEN'?{access_token:input.grant_type==='refresh_token'?'ISOLATED_REFRESHED_HTTP_ACCESS':'ISOLATED_HTTP_ACCESS',refresh_token:'ISOLATED_HTTP_REFRESH',expires_in:input.grant_type==='refresh_token'?3600:60,scope:fixture.no_mail_scope?'openid email':'https://mail.google.com/ openid email profile',token_type:'Bearer'}:{sub:fixture.changed_subject?'OTHER_SUBJECT':'ISOLATED_HTTP_SUBJECT',email:'oauth.fixture@example.test',email_verified:true};
 return {status:200,body,tls_verified:true,host:kind==='TOKEN'?'oauth2.googleapis.com':'openidconnect.googleapis.com',observed_at:new Date().toISOString(),body_sha256:crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex')};
};
