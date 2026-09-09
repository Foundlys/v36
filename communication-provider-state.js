'use strict';
// Configuration alone never proves authentication or message delivery.
// Native email overlays only its current, independently recorded auth evidence.
function smtpConfiguration(credentials={},readEnv=()=> ''){
 const host=readEnv('SMTP_HOST')||credentials.smtp_host||credentials.host||'',port=readEnv('SMTP_PORT')||credentials.smtp_port||credentials.port||'',user=readEnv('SMTP_USER')||credentials.smtp_user||credentials.username||'',password=readEnv('SMTP_PASSWORD')||credentials.smtp_password||credentials.password||'';
 return {host,port,username:user,password};
}
function smtpConfigured(credentials={},readEnv=()=> ''){return Object.values(smtpConfiguration(credentials,readEnv)).every(Boolean);}
function smtpConfigurationState(configured){
 return {configured:Boolean(configured),connected:false,authenticated:false,authentication_verified:false,send_verified:false,socket_probe:'NOT_RUN',status:configured?'geconfigureerd_niet_geverifieerd':'niet_geconfigureerd',blocker:configured?'AUTHENTICATED_MAIL_ADAPTER_REQUIRED':'MAIL_CONFIGURATION_REQUIRED',error:null};
}
module.exports={smtpConfigurationState,smtpConfigured,smtpConfiguration};
