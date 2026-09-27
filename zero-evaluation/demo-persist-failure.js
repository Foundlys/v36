'use strict';
// Isolated failure injection at the existing encrypted atomic rename. This
// preload is never enabled by the production server or an ordinary API header.
const fs=require('node:fs'),http=require('node:http'),{AsyncLocalStorage}=require('node:async_hooks');
const requestFault=new AsyncLocalStorage();
const emit=http.Server.prototype.emit,rename=fs.renameSync;
http.Server.prototype.emit=function(event,...args){
 if(event==='request'){
  const [req]=args;
  if(req.method==='POST'&&/^\/api\/demo-universe\/runs\/demo-[a-f0-9]{32}\/advance$/.test(req.url)&&req.headers['x-demo-fail-persist']==='isolated-demo-fixture'){
   return requestFault.run({pending:true},()=>emit.call(this,event,...args));
  }
 }
 return emit.call(this,event,...args);
};
fs.renameSync=function(from,to,...args){
 // Authentication/background persistence can precede the demo transaction.
 // Inject only at this request's actual final atomic commit, never consume the
 // fault in an unrelated best-effort write or another response's close event.
 const fault=requestFault.getStore();
 if(fault?.pending&&String(to).endsWith('/foundly-core-state.json')&&new Error().stack.includes('core-state-transaction.js')){fault.pending=false;throw Object.assign(Error('Isolated final demo commit failure'),{code:'EVALUATION_PERSIST_FAILED',statusCode:507});}
 return rename.call(this,from,to,...args);
};
