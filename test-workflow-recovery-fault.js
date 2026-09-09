'use strict';
// Test-only child-process crash immediately after the real encrypted commit.
require('./test-readiness-fetch-mock');
const fs=require('node:fs'),{FoundlyPlatformCore}=require('./platform-core');
const original=FoundlyPlatformCore.prototype.createAutomationRecord;
FoundlyPlatformCore.prototype.createAutomationRecord=function(...args){
  const result=original.apply(this,args),marker=process.env.FOUNDLY_RECOVERY_FAULT_MARKER;
  if(args[3]?.title==='Crash after durable task fixture'&&marker&&fs.existsSync(marker)){fs.unlinkSync(marker);process.exit(86);}
  return result;
};
