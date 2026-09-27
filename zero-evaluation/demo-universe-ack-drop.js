'use strict';
// Isolated transport-failure fixture. Not loaded by the production server.
const http=require('node:http'),end=http.ServerResponse.prototype.end;
http.ServerResponse.prototype.end=function(...args){if(this.req?.headers['x-demo-drop-reply']==='isolated-demo-fixture'&&this.req.method==='POST'&&(/^\/api\/demo-universe\/runs\/demo-[a-f0-9]{32}\/advance$/.test(this.req.url)&&this.statusCode===200||this.req.url==='/api/demo-universe/runs'&&this.statusCode===201)){this.destroy();return this;}return end.apply(this,args);};
