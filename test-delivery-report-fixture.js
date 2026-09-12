'use strict';
// Only loaded explicitly by an isolated test child; never by the application.
require('./test-mailbox-fixture');
const fs=require('node:fs'),net=require('node:net'),imap=require('./communication-imap'),original=imap.createReader;
const listen=net.Server.prototype.listen;net.Server.prototype.listen=function(...args){this.once('listening',()=>{if(process.send)process.send({fixture_port:this.address().port});});return listen.apply(this,args);};
imap.createReader=()=>{const reader=original();return async(config,options)=>{const value=await reader(config,options),fixture=JSON.parse(fs.readFileSync(process.env.FOUNDLY_IMAP_FIXTURE,'utf8'));if(fixture.report){const raw=Buffer.from(fixture.report,'base64'),item=value.items.find(row=>row.uid===1);if(item&&item.unavailable===null)Object.assign(item,{raw,size:raw.length});}return value;};};
