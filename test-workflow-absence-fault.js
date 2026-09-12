'use strict';
// Isolated child crash after durable RUNNING journal, before owned record creation.
require('./test-readiness-fetch-mock');
const fs=require('node:fs'),{FoundlyPlatformCore}=require('./platform-core');
const original=FoundlyPlatformCore.prototype.createAutomationRecord;
FoundlyPlatformCore.prototype.createAutomationRecord=function(...args){
 const marker=process.env.FOUNDLY_ABSENCE_FAULT_MARKER;
 if(args[3]?.title==='Crash before owned task fixture'&&marker&&fs.existsSync(marker)){fs.unlinkSync(marker);process.exit(87);}
 return original.apply(this,args);
};
