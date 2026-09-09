'use strict';

// Explicit SMTP authentication only: this module never issues MAIL/RCPT/DATA.
// RFC 8314, RFC 3207 and RFC 4954; TLS certificate/hostname verification is
// mandatory and pre-STARTTLS capabilities are discarded. Configuration reads
// and ordinary connector status pages never open this connection.
const net=require('node:net'),tls=require('node:tls'),dns=require('node:dns').promises;
const failure=(code,statusCode=502)=>Object.assign(new Error('SMTP-verificatie is niet geslaagd'),{code,statusCode});
function configuration(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw failure('smtp_configuration_invalid',422);
 const host=input.host,port=Number(input.port),username=input.username,password=input.password;
 if(typeof host!=='string'||host.length>253||!host.includes('.')||!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(host)||net.isIP(host)||![465,587].includes(port)||typeof username!=='string'||!username||username.length>512||typeof password!=='string'||!password||password.length>1024||/[\x00\r\n]/.test(username+password))throw failure('smtp_configuration_invalid',422);
 return {host:host.toLowerCase(),port,username,password};
}
function publicV4(address){
 if(net.isIP(address)!==4)return false;const [a,b,c]=address.split('.').map(Number);
 return !(a===0||a===10||a===127||a>=224||a===100&&b>=64&&b<=127||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&(b===168||b===0&&(c===0||c===2)||b===88&&c===99)||a===198&&(b===18||b===19||b===51&&c===100)||a===203&&b===0&&c===113);
}
async function destination(host,lookup,allowedHosts=[]){
 if(allowedHosts.length&&!allowedHosts.some(value=>value===host||value.startsWith('*.')&&host.endsWith(value.slice(1))&&host!==value.slice(2)))throw failure('smtp_host_not_allowed',403);
 const rows=await lookup(host,{all:true,verbatim:true});const v4=rows.filter(row=>row.family===4);
 // This bounded adapter currently requires a public IPv4 answer. The selected
 // address is pinned into socket lookup; no second DNS resolution can rebind it.
 if(!v4.length||v4.some(row=>!publicV4(row.address)))throw failure('smtp_destination_unavailable',403);
 return v4[0].address;
}
class Replies{
 constructor(socket){
  this.socket=socket;this.buffer='';this.lines=[];this.queue=[];this.pending=null;this.failed=null;this.total=0;
  this.onData=chunk=>{
   this.total+=chunk.length;if(this.total>65536)return this.fail(failure('smtp_response_too_large'));
   const text=chunk.toString('ascii');if([...chunk].some(byte=>byte>127||byte===0))return this.fail(failure('smtp_response_invalid'));
   this.buffer+=text;
   for(;;){const end=this.buffer.indexOf('\r\n');if(end<0){if(this.buffer.length>510)this.fail(failure('smtp_response_too_large'));break;}
    const line=this.buffer.slice(0,end);this.buffer=this.buffer.slice(end+2);const match=line.match(/^([2-5][0-9]{2})([- ])(.*)$/);
    if(line.length>510||!match||this.lines.length>=100||this.lines.length&&match[1]!==this.lines[0].slice(0,3))return this.fail(failure('smtp_response_invalid'));
    this.lines.push(line);if(match[2]===' '){const reply={code:Number(match[1]),lines:this.lines.map(row=>row.slice(4))};this.lines=[];if(this.pending){const {resolve}=this.pending;this.pending=null;resolve(reply);}else{this.queue.push(reply);if(this.queue.length>1)return this.fail(failure('smtp_unsolicited_response'));}}
   }
  };
  this.onError=()=>this.fail(failure('smtp_connection_failed'));this.onClose=()=>this.fail(failure('smtp_connection_closed'));
  socket.on('data',this.onData);socket.on('error',this.onError);socket.on('close',this.onClose);
 }
 fail(error){if(this.failed)return;this.failed=error;if(this.pending){const {reject}=this.pending;this.pending=null;reject(error);}this.socket.destroy();}
 next(){if(this.failed)return Promise.reject(this.failed);if(this.pending)return Promise.reject(failure('smtp_concurrent_command'));if(this.queue.length)return Promise.resolve(this.queue.shift());return new Promise((resolve,reject)=>{this.pending={resolve,reject};});}
 async command(command,codes){if(this.buffer||this.lines.length||this.queue.length)throw failure('smtp_unsolicited_response');const response=this.next();this.socket.write(command+'\r\n');const reply=await response;if(!codes.includes(reply.code))throw failure(command.startsWith('AUTH')?'smtp_authentication_failed':'smtp_command_rejected');return reply;}
 detach(){if(this.buffer||this.lines.length||this.queue.length||this.pending)throw failure('smtp_unsolicited_response');this.socket.removeListener('data',this.onData);this.socket.removeListener('error',this.onError);this.socket.removeListener('close',this.onClose);}
}
function createTransport({lookup=dns.lookup.bind(dns),connectTcp=net.connect,connectTls=tls.connect,timeoutMs=15000}={}){
 return async function authenticate(input,{allowedHosts=[],authorize=()=>{}}={}){
  const config=configuration(input);let socket,reader,timer;
  const connect=(factory,options,event)=>new Promise((resolve,reject)=>{
   const active=socket=factory(options);const fail=()=>{active.removeListener(event,ready);reject(failure('smtp_tls_or_connection_failed'));};const ready=()=>{active.removeListener('error',fail);resolve(active);};active.once('error',fail);active.once(event,ready);
  });
  let timedOut=false;const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{timedOut=true;socket?.destroy();reject(failure('smtp_timeout'));},timeoutMs);});
  const work=async()=>{
   authorize();const address=await destination(config.host,lookup,allowedHosts);if(timedOut)throw failure('smtp_timeout');authorize();
   const options={host:config.host,port:config.port,family:4,autoSelectFamily:false,lookup:(_host,_options,callback)=>callback(null,address,4)},tlsOptions={servername:config.host,minVersion:'TLSv1.2',rejectUnauthorized:true};
   await connect(config.port===465?connectTls:connectTcp,{...options,...(config.port===465?tlsOptions:{})},config.port===465?'secureConnect':'connect');
   if(socket.remoteAddress!==address)throw failure('smtp_destination_changed',403);
   if(config.port===465&&!socket.authorized)throw failure('smtp_certificate_invalid');reader=new Replies(socket);
   const greeting=await reader.next();if(greeting.code!==220)throw failure('smtp_greeting_rejected');
   let hello=await reader.command('EHLO foundly-client.invalid',[250]);
   if(config.port===587){
    if(!hello.lines.slice(1).some(line=>/^STARTTLS(?:\s|$)/i.test(line)))throw failure('smtp_tls_required');
    await reader.command('STARTTLS',[220]);reader.detach();socket.pause();const previous=socket;
    await connect(connectTls,{socket:previous,...tlsOptions},'secureConnect');if(!socket.authorized)throw failure('smtp_certificate_invalid');reader=new Replies(socket);socket.resume();
    hello=await reader.command('EHLO foundly-client.invalid',[250]);
   }
   if(!hello.lines.slice(1).some(line=>/^AUTH[ =]/i.test(line)&&line.replace(/^AUTH[ =]/i,'').split(/\s+/).some(method=>method.toUpperCase()==='PLAIN')))throw failure('smtp_auth_method_unavailable');
   authorize();const encoded=Buffer.from('\0'+config.username+'\0'+config.password).toString('base64');let auth=await reader.command('AUTH PLAIN '+encoded,[235,334]);
   if(auth.code===334){authorize();auth=await reader.command(encoded,[235]);}
   if(auth.code!==235)throw failure('smtp_authentication_failed');authorize();
   // A failed QUIT does not invalidate a successful authenticated exchange.
   try{await reader.command('QUIT',[221]);}catch{}
   return {authenticated:true,authentication_verified:true,tls_verified:true,transport:'SMTP_SUBMISSION',auth_method:'PLAIN_OVER_VERIFIED_TLS',port:config.port,observed_at:new Date().toISOString(),send_verified:false,mailbox_access_verified:false,external_send:false};
  };
  try{return await Promise.race([work(),deadline]);}catch(error){if(error?.code?.startsWith('smtp_')||[401,403,409].includes(error?.statusCode))throw error;throw failure('smtp_verification_failed');}
  finally{clearTimeout(timer);socket?.destroy();}
 };
}
module.exports={createTransport,configuration,publicV4};
