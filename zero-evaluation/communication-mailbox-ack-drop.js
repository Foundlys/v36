'use strict';
// Explicit isolated read-only IMAP fixture; no live provider or SMTP activity.
require('../test-mailbox-fixture');
const http=require('node:http'),end=http.ServerResponse.prototype.end;
http.ServerResponse.prototype.end=function(...args){if(this.req?.headers['x-mailbox-drop-reply']==='isolated-mailbox-fixture'&&this.req.method==='POST'&&this.req.url==='/api/communication/mailboxes/sync'&&this.statusCode>=200&&this.statusCode<300){this.destroy();return this;}return end.apply(this,args);};
