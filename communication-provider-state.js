'use strict';
// SMTP configuration currently has no authenticated transport/receipt adapter.
// Share this projection across the native and generic connector status routes.
function smtpConfigurationState(configured){
 return {configured:Boolean(configured),connected:false,authenticated:false,authentication_verified:false,send_verified:false,socket_probe:'NOT_RUN',status:configured?'geconfigureerd_niet_geverifieerd':'niet_geconfigureerd',blocker:configured?'AUTHENTICATED_MAIL_ADAPTER_REQUIRED':'MAIL_CONFIGURATION_REQUIRED',error:null};
}
module.exports={smtpConfigurationState};
