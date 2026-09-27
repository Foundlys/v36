'use strict';
// Isolated native record failures before/after the real encrypted side effect.
const {FoundlyPlatformCore}=require('../platform-core'),create=FoundlyPlatformCore.prototype.createAutomationRecord;
FoundlyPlatformCore.prototype.createAutomationRecord=function(...args){if(args[3]?.title==='Fixture absent result')throw Object.assign(Error('Isolated before-effect failure'),{code:'EIO'});const record=create.apply(this,args);if(args[3]?.title==='Fixture present result')throw Object.assign(Error('Isolated after-effect response failure'),{code:'EIO'});return record;};
const {ServerResponse}=require('node:http'),end=ServerResponse.prototype.end;let dropped=false;
ServerResponse.prototype.end=function(...args){if(!dropped&&this.req?.headers['x-workflow-result-drop-reply']==='isolated-http-fixture'&&this.req.url?.endsWith('/recovery')&&this.req.method==='POST'&&this.statusCode===200){let body;try{body=JSON.parse(String(args[0]));}catch{}if(body?.recovery_acknowledgement){dropped=true;this.destroy();return this;}}return end.apply(this,args);};
