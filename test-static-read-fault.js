'use strict';
// Isolated test-child preload. No production hook or source mutation.
const fs=require('node:fs'),path=require('node:path'),original=fs.createReadStream;
fs.createReadStream=function(file,...options){
  const dir=process.env.FOUNDLY_DATA_DIR;
  if(dir&&['analysis.html','analysis-cohorts-client.js'].includes(path.basename(String(file)))&&fs.existsSync(path.join(dir,'fixture-static-read-failure'))){
    return original.call(this,path.join(dir,'missing-static-fixture'),...options);
  }
  return original.call(this,file,...options);
};
