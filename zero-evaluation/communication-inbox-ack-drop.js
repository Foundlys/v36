'use strict';
// Isolated test preload; deterministic retained mail is explicitly not live provider mail.
require('../test-communication-message-fixture');
const http=require('node:http'),end=http.ServerResponse.prototype.end;
http.ServerResponse.prototype.end=function(...args){if(this.req?.headers['x-inbox-drop-reply']==='isolated-inbox-fixture'&&this.req.method==='PUT'&&/^\/api\/communication\/messages\/[^/]+\/inbox-state$/.test(this.req.url)&&this.statusCode>=200&&this.statusCode<300){this.destroy();return this;}return end.apply(this,args);};
