'use strict';
// Isolated fixture: lose the reply only after a native journey write commits.
const http=require('node:http'),end=http.ServerResponse.prototype.end;
http.ServerResponse.prototype.end=function(...args){if(this.req?.headers['x-zero-journey-drop-reply']==='isolated-journey-fixture'&&['POST','PUT'].includes(this.req.method)&&(/^\/api\/marketing\/(?:journey_definitions\/[^/]+|audience_activations|journey_runs\/[^/]+\/(?:advance|task-complete|pause|resume|cancel))$/.test(this.req.url)||this.req.url==='/api/zero/turn')&&this.statusCode>=200&&this.statusCode<300){this.destroy();return this;}return end.apply(this,args);};
