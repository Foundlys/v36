'use strict';
// Isolated failure injection at the existing encrypted atomic rename. This
// preload is never enabled by the production server or an ordinary API header.
const fs=require('node:fs'),http=require('node:http');
let fail=false;
const emit=http.Server.prototype.emit,rename=fs.renameSync;
http.Server.prototype.emit=function(event,...args){
 if(event==='request'){
  const [req,res]=args;
  if(req.method==='POST'&&/^\/api\/demo-universe\/runs\/demo-[a-f0-9]{32}\/advance$/.test(req.url)&&req.headers['x-demo-fail-persist']==='isolated-demo-fixture'){
   fail=true;res.once('finish',()=>{fail=false;});res.once('close',()=>{fail=false;});
  }
 }
 return emit.call(this,event,...args);
};
fs.renameSync=function(from,to,...args){
 if(fail&&String(to).endsWith('/foundly-core-state.json')){fail=false;throw Object.assign(Error('Isolated final demo commit failure'),{code:'EVALUATION_PERSIST_FAILED',statusCode:507});}
 return rename.call(this,from,to,...args);
};
