'use strict';
// Explicit test fault: the domain write succeeds, then its response is lost.
// Never imported by the application entry point.
require('./test-readiness-fetch-mock');
const fs=require('node:fs'),{FoundlyPlatformCore}=require('./platform-core');
const original=FoundlyPlatformCore.prototype.createAutomationRecord;
FoundlyPlatformCore.prototype.createAutomationRecord=function(ctx,actor,entity,input,options){
  const result=original.call(this,ctx,actor,entity,input,options);
  const marker=process.env.FOUNDLY_RETRY_FAULT_MARKER;
  if(input.title==='Retry result-loss fixture'&&marker&&fs.existsSync(marker)){
    fs.unlinkSync(marker);
    throw Object.assign(new Error('Injected result loss after persisted task'),{code:'ETIMEDOUT'});
  }
  return result;
};
