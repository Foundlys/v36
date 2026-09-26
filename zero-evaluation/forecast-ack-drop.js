'use strict';
// Isolated fault hook; the real handler persists before the reply is destroyed.
const http=require('node:http'),end=http.ServerResponse.prototype.end;
http.ServerResponse.prototype.end=function(...args){if(this.req?.headers['x-zero-forecast-drop-reply']==='isolated-forecast-fixture'&&this.req.method==='POST'&&this.req.url==='/api/sales/forecast/snapshots'&&this.statusCode>=200&&this.statusCode<300){this.destroy();return this;}return end.apply(this,args);};
