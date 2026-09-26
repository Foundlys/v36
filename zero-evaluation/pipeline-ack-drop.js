'use strict';
// Isolated test hook: lose the HTTP reply only after native commit succeeds.
const http=require('node:http'),end=http.ServerResponse.prototype.end;
http.ServerResponse.prototype.end=function(...args){if(this.req?.headers['x-zero-pipeline-drop-reply']==='isolated-pipeline-fixture'&&['POST','PUT'].includes(this.req.method)&&/^\/api\/sales\/pipeline-board(?:\/[^/]+(?:\/move\/[^/]+)?)?$/.test(this.req.url)&&this.statusCode>=200&&this.statusCode<300){this.destroy();return this;}return end.apply(this,args);};
