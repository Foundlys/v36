'use strict';
// Destroy one actual successful publication response after native persistence.
const {ServerResponse}=require('node:http'),end=ServerResponse.prototype.end;let dropped=false;
ServerResponse.prototype.end=function(...args){if(!dropped&&this.req?.headers['x-workflow-publish-drop-reply']==='isolated-http-fixture'&&this.req.url==='/api/automation/workflows'&&this.req.method==='POST'&&this.statusCode===201){let body;try{body=JSON.parse(String(args[0]));}catch{}if(body?.immutable_version===true){dropped=true;this.destroy();return this;}}return end.apply(this,args);};
