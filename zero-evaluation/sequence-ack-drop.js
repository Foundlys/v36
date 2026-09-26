'use strict';
// Test-only reply loss occurs after the real native transaction commits.
const http=require('node:http'),end=http.ServerResponse.prototype.end;
http.ServerResponse.prototype.end=function(...args){if(this.req?.headers['x-zero-sequence-drop-reply']==='isolated-sequence-fixture'&&['POST','PUT'].includes(this.req.method)&&(/^\/api\/sales\/(?:sequences\/[^/]+(?:\/start)?|sequence_runs\/[^/]+\/(?:advance|task-complete|pause|resume|cancel|outcome))$/.test(this.req.url)||this.req.url==='/api/zero/turn')&&this.statusCode>=200&&this.statusCode<300){this.destroy();return this;}return end.apply(this,args);};
