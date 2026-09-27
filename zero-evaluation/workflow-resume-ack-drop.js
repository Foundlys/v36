'use strict';
// Isolated response loss after the native resume reservation and result persist.
const {ServerResponse}=require('node:http'),end=ServerResponse.prototype.end;let dropped=false;
ServerResponse.prototype.end=function(...args){if(!dropped&&this.req?.headers['x-workflow-resume-drop-reply']==='isolated-http-fixture'&&this.req.url?.endsWith('/resume-confirmation')&&this.req.method==='POST'&&this.statusCode===202){let body;try{body=JSON.parse(String(args[0]));}catch{}if(body?.resume_acknowledgement){dropped=true;this.destroy();return this;}}return end.apply(this,args);};
