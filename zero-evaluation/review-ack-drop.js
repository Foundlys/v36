'use strict';
// Explicit isolated fixture: destroy a fully committed review reply only.
const http=require('node:http'),end=http.ServerResponse.prototype.end;
http.ServerResponse.prototype.end=function(...args){if(this.req?.headers['x-zero-review-drop-reply']==='isolated-review-fixture'&&this.req.method==='POST'&&(/^\/api\/marketing\/(?:creatives\/[^/]+\/reviews|creative_reviews\/[^/]+\/(?:approve|withdraw))$/.test(this.req.url)||this.req.url==='/api/zero/turn')&&this.statusCode>=200&&this.statusCode<300){this.destroy();return this;}return end.apply(this,args);};
