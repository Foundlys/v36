'use strict';
// Isolated HTTP fixture: destroy a successful native ZERO run reply only after
// the actual run and its effects have been durably processed.
const {ServerResponse}=require('node:http'),end=ServerResponse.prototype.end;let dropped=false;
ServerResponse.prototype.end=function(...args){if(!dropped&&this.req?.headers['x-workflow-run-drop-reply']==='isolated-http-fixture'&&this.req.url==='/api/zero/turn'&&this.req.method==='POST'&&this.statusCode===200){let body;try{body=JSON.parse(String(args[0]));}catch{}if(body?.automation_data?.run?.run_id){dropped=true;this.destroy();return this;}}return end.apply(this,args);};
