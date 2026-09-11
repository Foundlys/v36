'use strict';
// Explicit mechanisms only. Provider token acquisition/refresh is separate;
// configuration never proves a legitimate grant or successful authentication.
const fail=code=>{throw Object.assign(new Error('Mailauthenticatie is niet beschikbaar'),{code,statusCode:422});};
function credentials(input){
 const method=input.auth_method===undefined||input.auth_method===''?'PLAIN':input.auth_method,username=input.username;
 if(!['PLAIN','XOAUTH2'].includes(method)||typeof username!=='string'||!username||Buffer.byteLength(username)>512||/[\x00-\x1f\x7f]/.test(username))fail('smtp_configuration_invalid');
 if(method==='PLAIN'){
  if(typeof input.password!=='string'||!input.password||Buffer.byteLength(input.password)>1024||/[\x00\r\n]/.test(input.password))fail('smtp_configuration_invalid');
  return {username,password:input.password,...(input.auth_method?{auth_method:method}:{})};
 }
 const token=input.access_token,expiry=input.access_token_expires_at;
 if(typeof token!=='string'||token.length>4096||!/^[-a-zA-Z0-9._~+/]+=*$/.test(token)||typeof expiry!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(expiry)||!Number.isFinite(Date.parse(expiry))||new Date(expiry).toISOString()!==expiry)fail('smtp_configuration_invalid');
 const result={username,auth_method:method,access_token:token,access_token_expires_at:expiry};current(result);return result;
}
function current(config){if(config.auth_method==='XOAUTH2'&&!(Date.parse(config.access_token_expires_at)>Date.now()))fail('smtp_access_token_expired');}
function initial(config){current(config);return Buffer.from(config.auth_method==='XOAUTH2'?'user='+config.username+'\x01auth=Bearer '+config.access_token+'\x01\x01':'\0'+config.username+'\0'+config.password).toString('base64');}
module.exports={credentials,current,initial};
