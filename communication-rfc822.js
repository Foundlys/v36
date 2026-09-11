'use strict';
// Decode bounded retained mail into inert text. Original bytes stay separate;
// unsupported or malformed content is unavailable, never silently truncated.
const {address}=require('./communication-send-reviews');
const fail=()=>{throw Object.assign(Error('Berichtinhoud niet beschikbaar'),{code:'mail_content_unavailable'});};
const safe=value=>{if(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(value))fail();return value;};
function decode(bytes,charset='utf-8'){
 charset=charset.toLowerCase();if(!['utf-8','utf8','us-ascii','ascii','iso-8859-1','windows-1252'].includes(charset)||['us-ascii','ascii'].includes(charset)&&bytes.some(byte=>byte>127))fail();try{return safe(new TextDecoder(charset==='utf8'?'utf-8':charset,{fatal:true,ignoreBOM:true}).decode(bytes));}catch{fail();}
}
function base64(value){if(!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value))fail();const bytes=Buffer.from(value,'base64');if(bytes.toString('base64')!==value)fail();return bytes;}
function quoted(value,header=false){if(header)value=value.replace(/_/g,' ');else value=value.replace(/=\r\n/g,'');if(/=(?![0-9A-Fa-f]{2})/.test(value))fail();const result=[];for(let i=0;i<value.length;i++){if(value[i]==='='){result.push(parseInt(value.slice(i+1,i+3),16));i+=2;}else{const n=value.charCodeAt(i);if(n>255)fail();result.push(n);}}return Buffer.from(result);}
function words(value){
 const joined=value.replace(/(=\?[^?\s]+\?[bqBQ]\?[^?]*\?=)[ \t]+(?==\?)/g,'$1');
 const result=joined.replace(/=\?([^?\s]+)\?([bqBQ])\?([^?]*)\?=/g,(_all,charset,encoding,data)=>decode(encoding.toUpperCase()==='B'?base64(data):quoted(data,true),charset));if(result.includes('=?')||result.length>4000)fail();return safe(result);
}
function headers(bytes){
 const end=bytes.indexOf('\r\n\r\n');if(end<0||end>32768)fail();const raw=decode(bytes.subarray(0,end)),lines=raw.split('\r\n'),map=new Map();let name=null,count=0;
 for(const line of lines){if(line.length>998||/[\r\n]/.test(line))fail();if(/^[ \t]/.test(line)){if(!name)fail();const values=map.get(name);values[values.length-1]+=' '+line.trim();continue;}const match=line.match(/^([!-9;-~]+):[ \t]*(.*)$/);if(!match||++count>200)fail();name=match[1].toLowerCase();const values=map.get(name)||[];values.push(match[2]);map.set(name,values);}
 return {map,body:bytes.subarray(end+4)};
}
function one(map,name,fallback=null){const values=map.get(name);if(!values)return fallback;if(values.length!==1)fail();return values[0];}
function typed(value,defaultType){if(value===null)return {type:defaultType,params:{}};const match=value.match(/^([A-Za-z0-9!#$&^_.+-]+(?:\/[A-Za-z0-9!#$&^_.+-]+)?)(.*)$/);if(!match)fail();const params={},rest=match[2],pattern=/;\s*([A-Za-z0-9!#$&^_.+*-]+)\s*=\s*(?:"((?:[^"\\]|\\.)*)"|([^;\s]+))\s*/g;let end=0;for(const item of rest.matchAll(pattern)){if(item.index!==end||Object.hasOwn(params,item[1].toLowerCase()))fail();params[item[1].toLowerCase()]=(item[2]??item[3]).replace(/\\(.)/g,'$1');end=item.index+item[0].length;}if(end!==rest.length)fail();return {type:match[1].toLowerCase(),params};}
function messageIds(value){if(value===null)return [];const ids=[...value.matchAll(/<([^<>\s]+)>/g)];if(ids.length>100||ids.some(item=>!require('./communication-threads').validId(item[0]))||value.replace(/<[^<>\s]+>/g,'').trim())fail();return ids.map(item=>item[0]);}
function mailboxes(value){if(value===null)return null;const tokens=[];let current='',quoted=false,escaped=false,angle=false;for(const char of value){if(escaped){current+=char;escaped=false;continue;}if(char==='\\'&&quoted){current+=char;escaped=true;continue;}if(char==='"')quoted=!quoted;if(!quoted){if(char==='<'){if(angle)fail();angle=true;}if(char==='>'){if(!angle)fail();angle=false;}if(char===','&&!angle){tokens.push(current);current='';continue;}}current+=char;}if(quoted||angle||escaped)fail();tokens.push(current);if(tokens.length>100)fail();return tokens.map(token=>{const match=token.trim().match(/^(?:[^<>]*<([^<>]+)>|([^<>]+))$/),value=match?.[1]||match?.[2];if(!address(value))fail();return value;});}
function parse(raw){
 const result={title:null,subject_available:false,from:null,to:null,cc:null,reply_to:null,reply_to_available:false,authored_at:null,message_id:null,in_reply_to:[],references:[],thread_headers_available:false,content:null,content_available:false,content_complete:false,content_media_type:null,content_rendering:'INERT_TEXT',attachments:[],attachments_complete:false,unavailable_reason:'MALFORMED_OR_UNSUPPORTED_MIME'};
 if(!Buffer.isBuffer(raw)||raw.length>262144)return result;
 let root;try{root=headers(raw);}catch{return result;}
 const optional=operation=>{try{return operation();}catch{return null;}};
 const title=optional(()=>words(one(root.map,'subject','')));if(title!==null&&title.length<=1000){result.title=title;result.subject_available=true;}
 const from=optional(()=>mailboxes(one(root.map,'from')));result.from=from?.length===1?from[0]:null;result.to=optional(()=>mailboxes(one(root.map,'to')));result.cc=optional(()=>mailboxes(one(root.map,'cc','')));if(!root.map.has('cc'))result.cc=[];const replyTo=optional(()=>mailboxes(one(root.map,'reply-to')));result.reply_to=replyTo?.length===1?replyTo[0]:null;result.reply_to_available=!root.map.has('reply-to')||replyTo?.length===1;
 const date=oneSafe(root.map,'date');if(typeof date==='string'&&/(?:[+-][0-9]{4}|GMT)\s*$/i.test(date)&&Number.isFinite(Date.parse(date)))result.authored_at=new Date(date).toISOString();
 try{const ids=messageIds(one(root.map,'message-id'));if(ids.length>1)fail();result.message_id=ids[0]||null;result.in_reply_to=messageIds(one(root.map,'in-reply-to'));result.references=messageIds(one(root.map,'references'));result.thread_headers_available=true;}catch{}
 let partCount=0;
 function entity(parts,depth=0){
  if(depth>6||++partCount>30)fail();const type=typed(one(parts.map,'content-type'),'text/plain'),disposition=typed(one(parts.map,'content-disposition'),'inline'),encoding=one(parts.map,'content-transfer-encoding','7bit').toLowerCase();
  if(type.type.startsWith('multipart/')){
   if(!['7bit','8bit','binary'].includes(encoding))fail();const boundary=type.params.boundary;if(!boundary||boundary.length>70||/[^\x20-\x7e]/.test(boundary))fail();const lines=parts.body.toString('latin1').split('\r\n'),chunks=[];let current=null,closed=false;
   for(const line of lines){if(line==='--'+boundary||line==='--'+boundary+'--'){if(current!==null)chunks.push(Buffer.from(current.join('\r\n'),'latin1'));if(line==='--'+boundary+'--'){closed=true;break;}current=[];}else if(current!==null)current.push(line);}
   if(!closed||!chunks.length||chunks.length>30)fail();const children=chunks.map(chunk=>entity(headers(chunk),depth+1));if(type.type==='multipart/alternative')return children.find(child=>child.media_type==='text/plain'&&child.text!==null)||children.find(child=>child.text!==null)||children[0];
   const texts=children.filter(child=>child.text!==null);return {text:texts.length?texts.map(child=>child.text).join('\n\n'):null,media_type:texts.some(child=>child.media_type==='text/html')?'text/html':'text/plain',attachments:children.flatMap(child=>child.attachments),complete:children.every(child=>child.complete)};
  }
  let bytes;if(encoding==='base64')bytes=base64(parts.body.toString('latin1').replace(/[\r\n\t ]/g,''));else if(encoding==='quoted-printable')bytes=quoted(parts.body.toString('latin1'));else if(['7bit','8bit','binary'].includes(encoding)){if(encoding==='7bit'&&parts.body.some(byte=>byte>127))fail();bytes=parts.body;}else fail();
  if(disposition.type==='attachment'||!['text/plain','text/html'].includes(type.type))return {text:null,media_type:null,attachments:[{name:optional(()=>words(disposition.params.filename||type.params.name||''))||null,media_type:type.type,size_bytes:bytes.length,sha256:require('node:crypto').createHash('sha256').update(bytes).digest('hex'),download_available:false}],complete:true};
  const value=decode(bytes,type.params.charset||'us-ascii');return {text:value,media_type:type.type,attachments:[],complete:true};
 }
 try{const decoded=entity(root);result.attachments=decoded.attachments;result.attachments_complete=decoded.complete;if(decoded.text!==null&&decoded.text.length<=12000){result.content=decoded.text;result.content_available=true;result.content_complete=decoded.complete;result.content_media_type=decoded.media_type;result.unavailable_reason=null;}else result.unavailable_reason=decoded.text===null?'NO_SUPPORTED_INLINE_BODY':'BODY_EXCEEDS_DISPLAY_LIMIT';}catch{}
 return result;
}
function oneSafe(map,name){try{return one(map,name);}catch{return null;}}
module.exports={parse,words,mailboxes,messageIds};
