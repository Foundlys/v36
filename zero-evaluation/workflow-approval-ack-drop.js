'use strict';
// Isolated fault after the native grant/run reservation has been persisted.
const {ServerResponse}=require('node:http'),end=ServerResponse.prototype.end;let dropped=false;
ServerResponse.prototype.end=function(...args){if(!dropped&&this.req?.headers['x-workflow-approval-drop-reply']==='isolated-http-fixture'&&this.req.url?.endsWith('/runs')&&this.req.method==='POST'&&this.statusCode===202){let body;try{body=JSON.parse(String(args[0]));}catch{}if(body?.approval_acknowledgement){dropped=true;this.destroy();return this;}}return end.apply(this,args);};
