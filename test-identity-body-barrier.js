'use strict';
// Test-only observation barrier: signal once the application awaits a body,
// after authenticating and entering that request's identity context.
require('./test-readiness-fetch-mock');
const fs=require('node:fs'),http=require('node:http');
const original=http.IncomingMessage.prototype.on;
http.IncomingMessage.prototype.on=function(event,listener){
  const result=original.call(this,event,listener);
  if(event==='end'&&this.headers?.['x-identity-fixture-barrier']==='body'&&/at body \(/.test(new Error().stack||'')&&process.env.FOUNDLY_IDENTITY_BODY_BARRIER)fs.writeFileSync(process.env.FOUNDLY_IDENTITY_BODY_BARRIER,'application-awaiting-request-body');
  return result;
};
