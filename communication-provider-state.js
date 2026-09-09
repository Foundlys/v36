'use strict';
// SMTP configuration currently has no authenticated transport/receipt adapter.
// Share this projection across the native and generic connector status routes.
function smtpConfigured(credentials={},readEnv=()=> ''){
 const host=readEnv('SMTP_HOST')||credentials.smtp_host||credentials.host||'',port=readEnv('SMTP_PORT')||credentials.smtp_port||credentials.port||'',user=readEnv('SMTP_USER')||credentials.smtp_user||credentials.username||'',password=readEnv('SMTP_PASSWORD')||credentials.smtp_password||credentials.password||'';
 return Boolean(host&&port&&user&&password);
}
function smtpConfigurationState(configured){
 return {configured:Boolean(configured),connected:false,authenticated:false,authentication_verified:false,send_verified:false,socket_probe:'NOT_RUN',status:configured?'geconfigureerd_niet_geverifieerd':'niet_geconfigureerd',blocker:configured?'AUTHENTICATED_MAIL_ADAPTER_REQUIRED':'MAIL_CONFIGURATION_REQUIRED',error:null};
}
module.exports={smtpConfigurationState,smtpConfigured};
