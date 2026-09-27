'use strict';
// Isolated test preload. Retained source input is explicitly labelled, not live mail.
require('../test-communication-message-fixture');
const http=require('node:http'),end=http.ServerResponse.prototype.end;
http.ServerResponse.prototype.end=function(...args){if(this.req?.headers['x-reply-drop-reply']==='isolated-reply-fixture'&&this.req.method==='POST'&&/^\/api\/(?:zero\/turn|communication\/messages\/[^/]+\/drafts)$/.test(this.req.url)&&this.statusCode>=200&&this.statusCode<300){this.destroy();return this;}return end.apply(this,args);};
