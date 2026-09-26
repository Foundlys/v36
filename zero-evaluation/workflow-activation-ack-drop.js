'use strict';
// Isolated fault after native activation and its acknowledgement are durable.
const {ServerResponse}=require('node:http'),end=ServerResponse.prototype.end;let dropped=false;
ServerResponse.prototype.end=function(...args){if(!dropped&&this.req?.headers['x-workflow-activation-drop-reply']==='isolated-http-fixture'&&this.req.url?.endsWith('/activation')&&this.req.method==='PUT'&&this.statusCode===200){let body;try{body=JSON.parse(String(args[0]));}catch{}if(body?.request_acknowledgement){dropped=true;this.destroy();return this;}}return end.apply(this,args);};
