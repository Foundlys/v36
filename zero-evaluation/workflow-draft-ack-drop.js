'use strict';
// Drop one actual successful ZERO private-draft SAVE response after native persistence.
const {ServerResponse}=require('node:http'),end=ServerResponse.prototype.end;let dropped=false;
ServerResponse.prototype.end=function(...args){if(!dropped&&this.req?.headers['x-zero-draft-drop-reply']==='isolated-http-fixture'&&this.req.url==='/api/zero/turn'&&this.req.method==='POST'&&this.statusCode>=200&&this.statusCode<300){let body;try{body=JSON.parse(String(args[0]));}catch{}if(body?.automation_action_reference?.operation==='SAVE'){dropped=true;this.destroy();return this;}}return end.apply(this,args);};
