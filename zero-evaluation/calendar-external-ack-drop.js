'use strict';
// Isolated test hook. The complete read window is persisted before reply loss.
const http=require('node:http'),end=http.ServerResponse.prototype.end;
http.ServerResponse.prototype.end=function(...args){if(this.req?.headers['x-zero-external-drop-reply']==='isolated-calendar-fixture'&&this.req.method==='POST'&&this.req.url==='/api/calendar/external-calendar/reconcile'&&this.statusCode>=200&&this.statusCode<300){this.destroy();return this;}return end.apply(this,args);};
