'use strict';
// Configuration alone never proves authentication or message delivery.
// Native email overlays only its current, independently recorded auth evidence.
function smtpConfiguration(credentials={},readEnv=()=> ''){
 const host=readEnv('SMTP_HOST')||credentials.smtp_host||credentials.host||'',port=readEnv('SMTP_PORT')||credentials.smtp_port||credentials.port||'',user=readEnv('SMTP_USER')||credentials.smtp_user||credentials.username||'',password=readEnv('SMTP_PASSWORD')||credentials.smtp_password||credentials.password||'';
 const method=readEnv('SMTP_AUTH_METHOD')||credentials.smtp_auth_method||'';
 return method==='XOAUTH2'?{host,port,username:user,auth_method:method,access_token:readEnv('SMTP_ACCESS_TOKEN')||credentials.smtp_access_token||'',access_token_expires_at:readEnv('SMTP_ACCESS_TOKEN_EXPIRES_AT')||credentials.smtp_access_token_expires_at||''}:{host,port,username:user,password,...(method?{auth_method:method}:{})};
}
function configurationReady(config){try{require('./communication-smtp').configuration(config);return true;}catch{return false;}}
function smtpConfigured(credentials={},readEnv=()=> ''){return configurationReady(smtpConfiguration(credentials,readEnv));}
function imapConfiguration(credentials={}){const base={host:credentials.imap_host,port:credentials.imap_port,username:credentials.imap_user},method=credentials.imap_auth_method;return method==='XOAUTH2'?{...base,auth_method:method,access_token:credentials.imap_access_token,access_token_expires_at:credentials.imap_access_token_expires_at}:{...base,password:credentials.imap_password,...(method?{auth_method:method}:{})};}
function smtpConfigurationState(configured){
 return {configured:Boolean(configured),connected:false,authenticated:false,authentication_verified:false,send_verified:false,socket_probe:'NOT_RUN',status:configured?'geconfigureerd_niet_geverifieerd':'niet_geconfigureerd',blocker:configured?'AUTHENTICATED_MAIL_ADAPTER_REQUIRED':'MAIL_CONFIGURATION_REQUIRED',error:null};
}
module.exports={smtpConfigurationState,smtpConfigured,smtpConfiguration,imapConfiguration,configurationReady};
