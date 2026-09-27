'use strict';
// Destroy one actual completed domain response in an isolated server fixture.
const {ServerResponse}=require('node:http'),end=ServerResponse.prototype.end;let dropped=false;
ServerResponse.prototype.end=function(...args){if(!dropped&&this.req?.headers['x-zero-domain-drop-reply']==='isolated-http-fixture'&&/^\/api\/sales\/opportunities(?:\/[^/]+)?$/.test(this.req.url)&&['POST','PUT'].includes(this.req.method)&&this.statusCode>=200&&this.statusCode<300){dropped=true;this.destroy();return this;}return end.apply(this,args);};
