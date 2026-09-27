'use strict';
// Isolated fixture: destroy an explicitly opted-in successful template action reply.
const http=require('node:http'),end=http.ServerResponse.prototype.end;
http.ServerResponse.prototype.end=function(...args){if(this.req?.headers['x-template-drop-reply']==='isolated-template-fixture'&&this.req.method==='POST'&&/^\/api\/(?:zero\/turn|communication\/templates\/[^/]+\/drafts)$/.test(this.req.url)&&this.statusCode>=200&&this.statusCode<300){this.destroy();return this;}return end.apply(this,args);};
