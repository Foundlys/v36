'use strict';
// Isolated HTTP fixture preload. Observe the actual native server's bound port;
// do not substitute request handling, identity checks or persistence behavior.
if(typeof process.send!=='function')throw Error('Fixture listening observer requires IPC');
const http=require('node:http'),listen=http.Server.prototype.listen;
http.Server.prototype.listen=function(...args){
  this.once('listening',()=>{const address=this.address();if(address&&typeof address==='object')process.send({type:'zero-fixture-listening',port:address.port});});
  return Reflect.apply(listen,this,args);
};
