'use strict';
// Isolated fixture only: drop one HTTP response after the real identity commit.
const http=require('node:http'),end=http.ServerResponse.prototype.end;let dropped=false;
http.ServerResponse.prototype.end=function(...args){if(!dropped&&this.req?.headers['x-zero-identity-drop-reply']==='isolated-http-fixture'&&this.req.url==='/api/identity/users'&&this.req.method==='POST'&&this.statusCode===201){dropped=true;this.destroy();return this;}return end.apply(this,args);};
