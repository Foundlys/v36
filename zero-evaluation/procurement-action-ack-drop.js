'use strict';
// Isolated test preload: destroy only an explicitly opted-in successful action reply.
const http=require('node:http'),end=http.ServerResponse.prototype.end;
http.ServerResponse.prototype.end=function(...args){if(this.req?.headers['x-procurement-drop-reply']==='isolated-action-fixture'&&this.req.method==='POST'&&/^\/api\/(?:zero\/turn|procurement\/(?:rfqs\/[^/]+\/awards|orders\/[^/]+\/approvals|awards\/[^/]+\/(?:approve|cancel)|clarifications(?:\/[^/]+\/(?:entries|collaborators))?))$/.test(this.req.url)&&this.statusCode>=200&&this.statusCode<300){this.destroy();return this;}return end.apply(this,args);};
