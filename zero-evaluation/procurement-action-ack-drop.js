'use strict';
// Isolated test preload: destroy only the opted-in successful native action reply.
const http=require('node:http'),end=http.ServerResponse.prototype.end;
http.ServerResponse.prototype.end=function(...args){if(this.req?.headers['x-procurement-drop-reply']==='isolated-action-fixture'&&this.req.method==='POST'&&/^\/api\/procurement\/(?:rfqs\/[^/]+\/awards|awards\/[^/]+\/(?:approve|cancel))$/.test(this.req.url)&&this.statusCode>=200&&this.statusCode<300){this.destroy();return this;}return end.apply(this,args);};
