'use strict';
// Native encrypted persistence remains active; only its final rename can fail.
const fs=require('node:fs'),path=require('node:path'),rename=fs.renameSync,marker=process.env.FOUNDLY_IDENTITY_FAIL_FILE;
if(!marker)throw Error('Isolated identity fault marker is required');
fs.renameSync=function(from,to,...args){if(path.basename(to)==='foundly-core-state.json'&&fs.existsSync(marker))throw Object.assign(Error('Isolated identity persistence failure'),{code:'EIO'});return rename.call(this,from,to,...args);};
