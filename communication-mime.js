'use strict';
const crypto=require('node:crypto'),{address}=require('./communication-send-reviews'),attachments=require('./communication-attachments');
const fail=()=>{throw Object.assign(new Error('De exacte berichtinhoud kan niet veilig worden samengesteld'),{code:'mail_content_invalid',statusCode:422});};
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
function text(value,max,header=false){if(typeof value!=='string'||value.length>max||Buffer.from(value).toString('utf8')!==value||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(value)||header&&/[\r\n]/.test(value))fail();return value;}
function subject(value){
 text(value,1000,true);const words=[];let chunk='';for(const char of value){if(Buffer.byteLength(chunk+char)>39){words.push(chunk);chunk='';}chunk+=char;}if(chunk)words.push(chunk);
 return words.map(word=>'=?UTF-8?B?'+Buffer.from(word).toString('base64')+'?=').join('\r\n ');
}
const encoded=bytes=>bytes.toString('base64').match(/.{1,76}/g)?.join('\r\n')||'';
function compose(plan,{attempt_id,created_at,files=[]}){
 if(!plan||!address(plan.from)||!Array.isArray(plan.snapshot?.to)||!plan.snapshot.to.length||plan.snapshot.to.length>100||plan.snapshot.to.some(value=>!address(value))||new Set(plan.snapshot.to).size!==plan.snapshot.to.length||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(attempt_id)||!Number.isFinite(Date.parse(created_at))||new Date(created_at).toISOString()!==created_at)fail();
 const snapshot=plan.snapshot;if(snapshot.cc!==undefined&&!Array.isArray(snapshot.cc))fail();const recipients=[...snapshot.to,...(snapshot.cc||[])];if(recipients.length>100||recipients.some(value=>!address(value))||new Set(recipients).size!==recipients.length)fail();require('./communication-drafts').validateInput(snapshot);text(snapshot.content,12000);if(!Array.isArray(snapshot.attachments)||snapshot.attachments.length>10||files.length!==snapshot.attachments.length)fail();
 const parts=[['Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: base64','',encoded(Buffer.from(snapshot.content.replace(/\r\n|\r|\n/g,'\r\n')))].join('\r\n')];
 for(let i=0;i<files.length;i++){
  const file=files[i],ref=snapshot.attachments[i],checked=ref.validation==='SIGNATURE_AND_LOCAL_CLAMAV'?require('./communication-binary-attachments').validate(file):attachments.validate(file);if(file.id!==ref.id||file.name!==ref.name||checked.sha256!==ref.sha256||checked.bytes.length!==ref.size_bytes)fail();
  // Octet-stream attachments preserve the approved original UTF-8 file bytes,
  // including line endings. They are not rendered as inline message content.
  parts.push(['Content-Type: application/octet-stream','Content-Disposition: attachment;',' filename="'+file.name+'"','Content-Transfer-Encoding: base64','',encoded(checked.bytes)].join('\r\n'));
 }
 const messageId='<'+attempt_id+'@'+plan.from.split('@')[1]+'>',boundary='foundly_'+attempt_id;
 const headers=['Date: '+new Date(created_at).toUTCString().replace('GMT','+0000'),'Message-ID: '+messageId,'From: <'+plan.from+'>','To: '+snapshot.to.map(value=>'<'+value+'>').join(',\r\n '),'Subject: '+subject(snapshot.title),'MIME-Version: 1.0'];
 if(snapshot.cc?.length)headers.push('Cc: '+snapshot.cc.map(value=>'<'+value+'>').join(',\r\n '));
 const reply=snapshot.reply_context;if(reply){if(!['REPLY','REPLY_ALL','FORWARD'].includes(reply.mode)||!reply.headers||typeof reply.headers.available!=='boolean'||!Array.isArray(reply.headers.in_reply_to)||!Array.isArray(reply.headers.references)||[reply.headers.in_reply_to,reply.headers.references].some(ids=>ids.length>100||ids.some(value=>!require('./communication-threads').validId(value)))||(!reply.headers.available||reply.mode==='FORWARD')&&(reply.headers.in_reply_to.length||reply.headers.references.length))fail();for(const [name,ids] of [['In-Reply-To',reply.headers.in_reply_to],['References',reply.headers.references]])if(ids.length)headers.push(name+': '+ids.join('\r\n '));}
 const body=parts.length===1?parts[0]:'Content-Type: multipart/mixed; boundary="'+boundary+'"\r\n\r\n--'+boundary+'\r\n'+parts.join('\r\n--'+boundary+'\r\n')+'\r\n--'+boundary+'--';
 const data=headers.join('\r\n')+'\r\n'+body+'\r\n';validateWire({from:plan.from,to:recipients,data});
 return {from:plan.from,to:recipients,data,message_id:messageId,sha256:hash(data),size_bytes:Buffer.byteLength(data)};
}
function validateWire(message){if(!message||!address(message.from)||!Array.isArray(message.to)||message.to.length<1||message.to.length>100||message.to.some(value=>!address(value))||new Set(message.to).size!==message.to.length||typeof message.data!=='string'||message.data.length>1024*1024||!message.data.endsWith('\r\n')||/[^\x09\x0a\x0d\x20-\x7e]/.test(message.data)||/[\r\n]/.test(message.data.replace(/\r\n/g,''))||message.data.split('\r\n').some(line=>line.length>998))fail();}
function validateContent(snapshot){subject(snapshot.title);text(snapshot.content,12000);}
module.exports={compose,validateWire,validateContent};
