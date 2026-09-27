'use strict';
// Isolated fixture only: lose a fully committed member or filter response.
const http=require('node:http'),end=http.ServerResponse.prototype.end;
http.ServerResponse.prototype.end=function(...args){if(this.req?.headers['x-zero-audience-drop-reply']==='isolated-audience-fixture'&&this.req.method==='POST'&&(/^\/api\/marketing\/audiences\/[^/]+\/(?:members|filters)$/.test(this.req.url)||this.req.url==='/api/zero/turn')&&this.statusCode>=200&&this.statusCode<300){this.destroy();return this;}return end.apply(this,args);};
