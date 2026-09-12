'use strict';
// Bounded read-only IMAP: implicit verified TLS, explicit SASL PLAIN/XOAUTH2, EXAMINE,
// UID SEARCH and BODY.PEEK. No SELECT/STORE/APPEND/EXPUNGE/provider mutation.
const sasl=require('./communication-sasl'),{sameAddress}=require('./communication-addresses'),net=require('node:net'),tls=require('node:tls'),dns=require('node:dns').promises,{destination}=require('./communication-smtp');
const MAX_MESSAGE=262144,MAX_UIDS=25000;
const fail=(code,statusCode=502)=>Object.assign(new Error('De mailbox kan niet betrouwbaar worden gelezen'),{code,statusCode});
function configuration(input){
 if(!input||Number(input.port)!==993)throw fail('imap_configuration_invalid',422);
 const checked=require('./communication-smtp').configuration({...input,port:465});return {...checked,port:993};
}
class Replies{
 constructor(socket){this.socket=socket;this.buffer=Buffer.alloc(0);this.fragments=[];this.literal=null;this.pending=null;this.queue=[];this.failed=null;this.total=0;
  socket.on('error',()=>this.fail(fail('imap_connection_failed')));socket.on('close',()=>this.fail(fail('imap_connection_closed')));
  socket.on('data',chunk=>{try{this.total+=chunk.length;if(this.total>8*1024*1024)throw fail('imap_response_too_large');this.buffer=Buffer.concat([this.buffer,chunk]);for(;;){
   if(this.literal!==null){if(this.buffer.length<this.literal)break;this.fragments.push(Buffer.from(this.buffer.subarray(0,this.literal)));this.buffer=this.buffer.subarray(this.literal);this.literal=null;}
   const end=this.buffer.indexOf('\r\n');if(end<0){if(this.buffer.length>300000)throw fail('imap_line_too_large');break;}const bytes=this.buffer.subarray(0,end);this.buffer=this.buffer.subarray(end+2);if(bytes.some(byte=>byte<32&&byte!==9||byte>126))throw fail('imap_response_invalid');const line=bytes.toString('ascii'),match=line.match(/\{([0-9]+)\}$/);
   if(match){const length=Number(match[1]);if(!Number.isSafeInteger(length)||length>MAX_MESSAGE||this.fragments.length>20)throw fail('imap_literal_too_large');this.fragments.push(line.slice(0,match.index));this.literal=length;continue;}
   this.fragments.push(line);const response=this.fragments;this.fragments=[];if(this.pending){const pending=this.pending;this.pending=null;pending.resolve(response);}else{this.queue.push(response);if(this.queue.length>1100)throw fail('imap_unsolicited_response');}
  }}catch(error){this.fail(error);}});
 }
 fail(error){if(this.failed)return;this.failed=error;if(this.pending){this.pending.reject(error);this.pending=null;}this.socket.destroy();}
 next(){if(this.failed)return Promise.reject(this.failed);if(this.pending)return Promise.reject(fail('imap_concurrent_command'));if(this.queue.length)return Promise.resolve(this.queue.shift());return new Promise((resolve,reject)=>{this.pending={resolve,reject};});}
}
function plain(parts){if(parts.some(part=>typeof part!=='string'))throw fail('imap_unexpected_literal');return parts.join('');}
const uid=value=>/^[1-9][0-9]*$/.test(String(value))&&Number.isSafeInteger(Number(value))&&Number(value)<=4294967295;
function uidSet(value){const output=[];if(!value)return output;for(const segment of value.split(',')){const pair=segment.split(':');if(pair.length>2||pair.some(part=>!uid(part)))throw fail('imap_uid_set_invalid');const min=Math.min(...pair.map(Number)),max=Math.max(...pair.map(Number));if(max-min+1>MAX_UIDS-output.length)throw fail('imap_mailbox_capacity',507);for(let n=min;n<=max;n++)output.push(n);}if(new Set(output).size!==output.length)throw fail('imap_uid_set_invalid');return output.sort((a,b)=>a-b);}
function fetchFields(parts,expected,body=false){
 const literals=parts.filter(Buffer.isBuffer);const text=parts.map(part=>Buffer.isBuffer(part)?' @LITERAL@ ':part).join(''),start=text.match(/^\* ([1-9][0-9]*) FETCH \((.*)\)$/i);if(!start)return null;
 const ids=[...start[2].matchAll(/(?:^|\s)UID ([0-9]+)(?=\s|$)/gi)];if(ids.length!==1||!uid(ids[0][1]))throw fail('imap_fetch_invalid');if(Number(ids[0][1])!==expected)return null;
 if(body){if(literals.length!==1||!/\bBODY\[\]\s+@LITERAL@/i.test(start[2]))throw fail('imap_body_unavailable');return {uid:expected,raw:Buffer.from(literals[0])};}
 const sizes=[...start[2].matchAll(/(?:^|\s)RFC822\.SIZE ([0-9]+)(?=\s|$)/gi)],flags=[...start[2].matchAll(/(?:^|\s)FLAGS \(([^()]*)\)/gi)];if(literals.length||sizes.length!==1||flags.length!==1||!Number.isSafeInteger(Number(sizes[0][1])))throw fail('imap_fetch_invalid');return {uid:expected,size:Number(sizes[0][1]),flags:flags[0][1].trim()?flags[0][1].trim().split(/\s+/):[]};
}
function createReader({lookup=dns.lookup.bind(dns),connectTls=tls.connect,timeoutMs=30000}={}){
 return async function read(input,{allowedHosts=[],authorize=()=>{},offset=0,limit=20,folder='INBOX'}={}){
  const config=configuration(input),currentAuthority=authorize;authorize=()=>{currentAuthority();sasl.current(config);};if(!Number.isSafeInteger(offset)||offset<0||offset>MAX_UIDS||!Number.isSafeInteger(limit)||limit<1||limit>20||typeof folder!=='string'||folder.length<1||folder.length>200||/[^\x20-\x7e]/.test(folder))throw fail('imap_query_invalid',422);
  let socket,reader,timer,timedOut=false,sequence=0,selectedValidity=null;const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{timedOut=true;socket?.destroy();reject(fail('imap_timeout'));},timeoutMs);});
  const work=async()=>{
   authorize();const address=await destination(config.host,lookup,allowedHosts);if(timedOut)throw fail('imap_timeout');authorize();
   const family=net.isIP(address);await new Promise((resolve,reject)=>{socket=connectTls({host:config.host,port:993,servername:config.host,minVersion:'TLSv1.2',rejectUnauthorized:true,family,autoSelectFamily:false,lookup:(_host,_options,callback)=>callback(null,address,family)});socket.once('error',()=>reject(fail('imap_tls_or_connection_failed')));socket.once('secureConnect',resolve);});
   if(!socket.authorized||!sameAddress(socket.remoteAddress,address))throw fail('imap_tls_or_destination_invalid',403);reader=new Replies(socket);if(!/^\* OK(?:\s|$)/i.test(plain(await reader.next())))throw fail('imap_greeting_invalid');
   const command=async(value,continuation)=>{authorize();const tag='F'+(++sequence),rows=[];socket.write(tag+' '+value+'\r\n');let continued=0;
    for(let n=0;n<1100;n++){const parts=await reader.next(),text=parts.map(part=>Buffer.isBuffer(part)?'@LITERAL@':part).join('');if(text.startsWith(tag+' ')){const match=plain(parts).match(new RegExp('^'+tag+' (OK|NO|BAD)(?: |$)(.*)$','i'));if(!match||match[1].toUpperCase()!=='OK')throw fail('imap_command_rejected');if(continuation)continuation.complete();return {rows,completion:match[2],tag};}
     if(/^\+(?: |$)/.test(text)){if(!continuation||++continued>2)throw fail('imap_authentication_invalid');authorize();socket.write(continuation.respond(plain(parts))+'\r\n');continue;}
     const validity=text.match(/^\* OK \[UIDVALIDITY ([0-9]+)\]/i);if(selectedValidity!==null&&validity&&Number(validity[1])!==selectedValidity)throw fail('imap_uidvalidity_changed');
     if(/^\* BYE(?: |$)/i.test(text)||!/^\* /.test(text))throw fail('imap_response_invalid');rows.push(parts);
    }throw fail('imap_response_too_large');
   };
   const capabilities=(await command('CAPABILITY')).rows.map(plain).find(line=>/^\* CAPABILITY /i.test(line))?.split(/\s+/).slice(2).map(value=>value.toUpperCase())||[];
   const method=config.auth_method||'PLAIN';
   if(!capabilities.includes('AUTH='+method)||!capabilities.some(value=>['IMAP4REV1','IMAP4REV2'].includes(value)))throw fail('imap_auth_method_unavailable');
   const immediate=method==='XOAUTH2'&&(capabilities.includes('SASL-IR')||capabilities.includes('IMAP4REV2'));let sent=immediate,authError=false;
   const authentication={respond(line){if(!sent){if(line!=='+ '&&line!=='+')throw fail('imap_authentication_invalid');sent=true;return sasl.initial(config);}if(method!=='XOAUTH2'||authError)throw fail('imap_authentication_invalid');authError=true;return '';},complete(){if(!sent||authError)throw fail('imap_authentication_invalid');}};
   await command('AUTHENTICATE '+method+(immediate?' '+sasl.initial(config):''),authentication);authorize();
   const examined=await command('EXAMINE "'+folder.replace(/[\\"]/g,'\\$&')+'"'),lines=examined.rows.map(plain),validities=lines.map(line=>line.match(/^\* OK \[UIDVALIDITY ([0-9]+)\]/i)).filter(Boolean),exists=lines.map(line=>line.match(/^\* ([0-9]+) EXISTS$/i)).filter(Boolean);
   if(!/^\[READ-ONLY\](?: |$)/i.test(examined.completion)||validities.length!==1||!uid(validities[0][1])||exists.length!==1||!Number.isSafeInteger(Number(exists[0][1])))throw fail('imap_mailbox_state_invalid');
   const uidvalidity=Number(validities[0][1]),total=Number(exists[0][1]);selectedValidity=uidvalidity;if(total>MAX_UIDS)throw fail('imap_mailbox_capacity',507);
   const searched=await command(capabilities.includes('IMAP4REV2')?'UID SEARCH RETURN (ALL COUNT) ALL':'UID SEARCH ALL'),searchLines=searched.rows.map(plain);let ids;
   if(capabilities.includes('IMAP4REV2')){const matches=searchLines.filter(line=>/^\* ESEARCH /i.test(line));if(matches.length!==1)throw fail('imap_search_incomplete');const prefix='* ESEARCH (TAG "'+searched.tag+'") UID ',line=matches[0];if(!line.toUpperCase().startsWith(prefix.toUpperCase()))throw fail('imap_search_incomplete');const tokens=line.slice(prefix.length).split(' '),fields={};if(tokens.length%2)throw fail('imap_search_incomplete');for(let i=0;i<tokens.length;i+=2){const key=tokens[i].toUpperCase();if(!['ALL','COUNT'].includes(key)||Object.hasOwn(fields,key))throw fail('imap_search_incomplete');fields[key]=tokens[i+1];}if(!/^[0-9]+$/.test(fields.COUNT||''))throw fail('imap_search_incomplete');ids=uidSet(fields.ALL);if(ids.length!==Number(fields.COUNT))throw fail('imap_search_incomplete');}
   else {const matches=searchLines.filter(line=>/^\* SEARCH(?: |$)/i.test(line));if(matches.length!==1)throw fail('imap_search_incomplete');const values=matches[0].slice(8).trim();ids=values?values.split(/\s+/).map(value=>{if(!uid(value))throw fail('imap_search_incomplete');return Number(value);}):[];if(ids.length>MAX_UIDS||new Set(ids).size!==ids.length)throw fail('imap_search_incomplete');ids.sort((a,b)=>a-b);}
   const items=[],missing=[];let mailboxChanged=ids.length!==total;const changes=rows=>rows.some(parts=>/^\* [0-9]+ (EXISTS|EXPUNGE)/i.test(parts.map(part=>Buffer.isBuffer(part)?'':part).join('')));
   for(const id of ids.slice(offset,offset+limit)){
    const fetched=await command('UID FETCH '+id+' (UID RFC822.SIZE FLAGS)');mailboxChanged ||= changes(fetched.rows);const matches=fetched.rows.map(parts=>fetchFields(parts,id)).filter(Boolean);if(matches.length!==1){missing.push(id);continue;}const item=matches[0];
    if(item.flags.some(flag=>flag.toUpperCase()==='\\DRAFT')){items.push({...item,raw:null,unavailable:'PROVIDER_DRAFT_EXCLUDED'});continue;}
    if(item.size>MAX_MESSAGE){items.push({...item,raw:null,unavailable:'MESSAGE_TOO_LARGE'});continue;}
    const bodies=await command('UID FETCH '+id+' (UID BODY.PEEK[])');mailboxChanged ||= changes(bodies.rows);const values=bodies.rows.map(parts=>fetchFields(parts,id,true)).filter(Boolean);if(values.length!==1){missing.push(id);continue;}if(values[0].raw.length!==item.size)throw fail('imap_message_size_changed');items.push({...item,raw:values[0].raw,unavailable:null});
   }
   const last=await command('NOOP');mailboxChanged ||= changes(last.rows);authorize();return {authenticated:true,tls_verified:true,read_only:true,folder,uidvalidity,total_uids_observed:ids.length,uid_set:ids,items,missing_uids:missing,offset,next_offset:offset+limit<ids.length?offset+limit:null,coverage_complete:offset===0&&offset+limit>=ids.length&&!mailboxChanged&&!missing.length,mailbox_changed:mailboxChanged,observed_at:new Date().toISOString(),provider_mutated:false};
  };
  try{return await Promise.race([work(),deadline]);}catch(error){if(/^(imap_|smtp_)/.test(error?.code||'')||[401,403,409].includes(error?.statusCode))throw error;throw fail('imap_read_failed');}finally{clearTimeout(timer);socket?.destroy();}
 };
}
module.exports={createReader,configuration,uidSet,MAX_MESSAGE};
