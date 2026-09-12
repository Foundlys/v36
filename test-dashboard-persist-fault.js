'use strict';
// Loaded only by the isolated HTTP regression child, never by the application.
const fs=require('node:fs'),path=require('node:path');
const rename=fs.renameSync;
fs.renameSync=function(from,to){
  const dir=process.env.FOUNDLY_DATA_DIR;
  if(dir&&path.resolve(to)===path.join(path.resolve(dir),'foundly-core-state.json')&&fs.existsSync(path.join(dir,'fixture-dashboard-write-failure'))){
    throw Object.assign(new Error('Isolated dashboard persistence failure'),{code:'EIO'});
  }
  return rename.apply(this,arguments);
};
