'use strict';
// Lose one successful native PUT response after the actual encrypted commit.
const {ServerResponse}=require('node:http'),end=ServerResponse.prototype.end;let dropped=false;
ServerResponse.prototype.end=function(...args){if(!dropped&&this.req?.headers['x-native-draft-drop-reply']==='isolated-http-fixture'&&/^\/api\/automation\/drafts\/[A-Za-z0-9_-]+$/.test(this.req.url)&&this.req.method==='PUT'&&this.statusCode===200){let body;try{body=JSON.parse(String(args[0]));}catch{}if(body?.record?.status==='DRAFT'){dropped=true;this.destroy();return this;}}return end.apply(this,args);};
