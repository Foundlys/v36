'use strict';
// Actual encrypted native commit, then a physically lost selected HTTP reply.
const http=require('node:http'),emit=http.Server.prototype.emit;
http.Server.prototype.emit=function(event,req,res,...rest){
 if(event==='request'&&req.method==='POST'&&/^\/api\/(?:sales\/commerce\/|zero\/turn$)/.test(req.url)&&req.headers['x-fixture-commerce-drop']==='committed-reply'){
  const end=res.end;res.end=function(...args){if([200,201].includes(this.statusCode)){this.socket.destroy();return this;}return end.apply(this,args);};
 }
 return emit.call(this,event,req,res,...rest);
};
