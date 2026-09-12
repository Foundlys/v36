'use strict';

// Explicit authentication and approved-submission transport primitives.
// Authentication-only calls never issue MAIL/RCPT/DATA.
// RFC 8314, RFC 3207 and RFC 4954; TLS certificate/hostname verification is
// mandatory and pre-STARTTLS capabilities are discarded. Configuration reads
// and ordinary connector status pages never open this connection.
const net=require('node:net'),tls=require('node:tls'),dns=require('node:dns').promises;
const {publicV6,sameAddress}=require('./communication-addresses'),sasl=require('./communication-sasl');
const failure=(code,statusCode=502)=>Object.assign(new Error('SMTP-verificatie is niet geslaagd'),{code,statusCode});
function configuration(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw failure('smtp_configuration_invalid',422);
 const host=input.host,port=Number(input.port);
 if(typeof host!=='string'||host.length>253||!host.includes('.')||!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(host)||net.isIP(host)||![465,587].includes(port))throw failure('smtp_configuration_invalid',422);
 return {host:host.toLowerCase(),port,...sasl.credentials(input)};
}
function publicV4(address){
 if(net.isIP(address)!==4)return false;const [a,b,c]=address.split('.').map(Number);
 return !(a===0||a===10||a===127||a>=224||a===100&&b>=64&&b<=127||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&(b===168||b===0&&(c===0||c===2)||b===88&&c===99)||a===198&&(b===18||b===19||b===51&&c===100)||a===203&&b===0&&c===113);
}
async function destination(host,lookup,allowedHosts=[]){
 if(allowedHosts.length&&!allowedHosts.some(value=>value===host||value.startsWith('*.')&&host.endsWith(value.slice(1))&&host!==value.slice(2)))throw failure('smtp_host_not_allowed',403);
 const rows=await lookup(host,{all:true,verbatim:true});
 // Validate every answer, then pin one literal address and its family. Mixed
 // public/private answers cannot use the unselected family as a bypass.
 if(!Array.isArray(rows)||!rows.length||rows.length>64||rows.some(row=>!row||![4,6].includes(row.family)||net.isIP(row.address)!==row.family||!(row.family===4?publicV4(row.address):publicV6(row.address))))throw failure('smtp_destination_unavailable',403);
 return (rows.find(row=>row.family===4)||rows[0]).address;
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
 const exchange=async function(input,{allowedHosts=[],authorize=()=>{},beforeData}={},message=null){
  const config=configuration(input),currentAuthority=authorize;authorize=()=>{currentAuthority();sasl.current(config);};if(message){require('./communication-mime').validateWire(message);if(typeof beforeData!=='function')throw failure('smtp_durable_boundary_required',422);}let socket,reader,timer,dataStarted=false,knownOutcome=null;
  const outcome=(state,extra={})=>({state,provider_acceptance:state==='ACCEPTED_BY_PROVIDER'?true:state==='UNKNOWN'?null:false,delivery_verified:false,external_send:dataStarted,observed_at:new Date().toISOString(),...extra});
  const connect=(factory,options,event)=>new Promise((resolve,reject)=>{
   const active=socket=factory(options);const fail=()=>{active.removeListener(event,ready);reject(failure('smtp_tls_or_connection_failed'));};const ready=()=>{active.removeListener('error',fail);resolve(active);};active.once('error',fail);active.once(event,ready);
  });
  let timedOut=false;const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{timedOut=true;socket?.destroy();reject(failure('smtp_timeout'));},timeoutMs);});
  const work=async()=>{
   authorize();const address=await destination(config.host,lookup,allowedHosts);if(timedOut)throw failure('smtp_timeout');authorize();
   const family=net.isIP(address),options={host:config.host,port:config.port,family,autoSelectFamily:false,lookup:(_host,_options,callback)=>callback(null,address,family)},tlsOptions={servername:config.host,minVersion:'TLSv1.2',rejectUnauthorized:true};
   await connect(config.port===465?connectTls:connectTcp,{...options,...(config.port===465?tlsOptions:{})},config.port===465?'secureConnect':'connect');
   if(!sameAddress(socket.remoteAddress,address))throw failure('smtp_destination_changed',403);
   if(config.port===465&&!socket.authorized)throw failure('smtp_certificate_invalid');reader=new Replies(socket);
   const greeting=await reader.next();if(greeting.code!==220)throw failure('smtp_greeting_rejected');
   let hello=await reader.command('EHLO foundly-client.invalid',[250]);
   if(config.port===587){
    if(!hello.lines.slice(1).some(line=>/^STARTTLS(?:\s|$)/i.test(line)))throw failure('smtp_tls_required');
    await reader.command('STARTTLS',[220]);reader.detach();socket.pause();const previous=socket;
    await connect(connectTls,{socket:previous,...tlsOptions},'secureConnect');if(!socket.authorized||!sameAddress(socket.remoteAddress,address))throw failure('smtp_certificate_invalid');reader=new Replies(socket);socket.resume();
    hello=await reader.command('EHLO foundly-client.invalid',[250]);
   }
   const method=config.auth_method||'PLAIN';
   if(!hello.lines.slice(1).some(line=>/^AUTH[ =]/i.test(line)&&line.replace(/^AUTH[ =]/i,'').split(/\s+/).some(value=>value.toUpperCase()===method)))throw failure('smtp_auth_method_unavailable');
   authorize();const encoded=sasl.initial(config);let auth=await reader.command('AUTH '+method+' '+encoded,[235,334]);
   if(auth.code===334){
    authorize();
    // XOAUTH2 challenges after the initial response signal failure. Acknowledge
    // with an empty response, never repeat the token or fall back to a password.
    if(method==='XOAUTH2'){try{await reader.command('',[535,454,235]);}catch{}throw failure('smtp_authentication_failed');}
    if(auth.lines.length!==1||auth.lines[0]!=='')throw failure('smtp_authentication_failed');
    auth=await reader.command(encoded,[235]);
   }
   if(auth.code!==235)throw failure('smtp_authentication_failed');authorize();
   if(message){
    const sizes=hello.lines.slice(1).map(line=>line.match(/^SIZE(?: ([0-9]+))?$/i)).filter(Boolean),size=sizes[0]?.[1];
    if(size&&Number(size)>0&&Buffer.byteLength(message.data)>Number(size))throw failure('smtp_message_too_large',422);
    authorize();await reader.command('MAIL FROM:<'+message.from+'>'+(sizes.length?' SIZE='+Buffer.byteLength(message.data):''),[250]);
    for(const recipient of message.to){authorize();await reader.command('RCPT TO:<'+recipient+'>',[250,251]);}
    authorize();await reader.command('DATA',[354]);authorize();
    if(reader.buffer||reader.lines.length||reader.queue.length||reader.failed)throw failure('smtp_unsolicited_response');
    // The caller synchronously persists the in-flight boundary before bytes.
    // A crash after this callback has an unknown outcome and cannot auto-retry.
    const boundary=beforeData();if(boundary&&typeof boundary.then==='function')throw failure('smtp_durable_boundary_invalid',422);authorize();
    const response=reader.next();dataStarted=true;socket.write(message.data.replace(/(^|\r\n)\./g,'$1..')+'.\r\n');
    const receipt=await response;
    if(receipt.code===250)knownOutcome=outcome('ACCEPTED_BY_PROVIDER',{smtp_code:250,receipt_sha256:require('node:crypto').createHash('sha256').update(JSON.stringify(receipt)).digest('hex'),tls_verified:true,authentication_verified:true});
    else if(receipt.code>=400)knownOutcome=outcome('REJECTED_BY_PROVIDER',{smtp_code:receipt.code});
    else throw failure('smtp_submission_response_invalid');
    return knownOutcome;
   }
   // A failed QUIT does not invalidate a successful authenticated exchange.
   try{await reader.command('QUIT',[221]);}catch{}
   return {authenticated:true,authentication_verified:true,tls_verified:true,transport:'SMTP_SUBMISSION',auth_method:method+'_OVER_VERIFIED_TLS',port:config.port,observed_at:new Date().toISOString(),send_verified:false,mailbox_access_verified:false,external_send:false};
  };
  try{return await Promise.race([work(),deadline]);}catch(error){if(message)return knownOutcome||outcome(dataStarted?'UNKNOWN':'NOT_SUBMITTED',{error_code:/^(smtp_|mail_|send_|composition_|core_|identity_)/.test(error?.code||'')?error.code:'smtp_submission_failed'});if(error?.code?.startsWith('smtp_')||[401,403,409].includes(error?.statusCode))throw error;throw failure('smtp_verification_failed');}
  finally{clearTimeout(timer);socket?.destroy();}
 };
 const authenticate=(input,options)=>exchange(input,options);authenticate.submit=(input,message,options)=>exchange(input,options,message);return authenticate;
}
module.exports={createTransport,configuration,publicV4,destination};
