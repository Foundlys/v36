'use strict';
// Drop the real completed reply only for explicitly marked isolated requests.
const {ServerResponse}=require('node:http'),end=ServerResponse.prototype.end;
ServerResponse.prototype.end=function(...args){if(this.req?.headers['x-zero-creative-drop-reply']==='isolated-creative-fixture'&&this.req.method==='POST'&&(/^\/api\/marketing\/creatives\/[^/]+\/(?:version|revisions\/[^/]+\/restore)$/.test(this.req.url)||this.req.url==='/api/zero/turn')&&this.statusCode>=200&&this.statusCode<300){this.destroy();return this;}return end.apply(this,args);};
