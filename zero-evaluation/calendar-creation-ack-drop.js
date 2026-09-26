'use strict';
const http=require('node:http'),end=http.ServerResponse.prototype.end;
http.ServerResponse.prototype.end=function(...args){if(this.req?.headers['x-zero-calendar-drop-reply']==='isolated-calendar-fixture'&&this.req.method==='POST'&&['/api/calendar/event-preparation/create','/api/zero/turn'].includes(this.req.url)&&this.statusCode>=200&&this.statusCode<300){this.destroy();return this;}return end.apply(this,args);};
