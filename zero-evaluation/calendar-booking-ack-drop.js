'use strict';
const http=require('node:http'),end=http.ServerResponse.prototype.end;
http.ServerResponse.prototype.end=function(...args){if(this.req?.headers['x-zero-booking-drop-reply']==='isolated-booking-fixture'&&this.req.method==='POST'&&this.req.url==='/api/calendar/scheduling/book'&&this.statusCode>=200&&this.statusCode<300){this.destroy();return this;}return end.apply(this,args);};
