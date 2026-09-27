'use strict';
// Isolated native HTTP fixture: discard only the selected successful write
// response, after the real handler has already encrypted and committed it.
const http=require('node:http'),emit=http.Server.prototype.emit;
http.Server.prototype.emit=function(event,req,res,...rest){
 if(event==='request'&&req.method==='PUT'&&req.url==='/api/connector-runtime/config/email'&&req.headers['x-zero-connector-drop-reply']==='isolated-http-fixture'){
  const end=res.end;res.end=function(...args){if(this.statusCode===200){this.socket.destroy();return this;}return end.apply(this,args);};
 }
 return emit.call(this,event,req,res,...rest);
};
