'use strict';
// Isolated fault hook: the actual handler commits before its reply is lost.
const http=require('node:http'),end=http.ServerResponse.prototype.end;
http.ServerResponse.prototype.end=function(...args){if(this.req?.headers['x-zero-hierarchy-drop-reply']==='isolated-hierarchy-fixture'&&this.req.method==='PUT'&&/^\/api\/sales\/forecast\/hierarchies\/[^/?]+$/.test(this.req.url)&&this.statusCode>=200&&this.statusCode<300){this.destroy();return this;}return end.apply(this,args);};
