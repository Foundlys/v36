'use strict';
// RFC 3464 reports are untrusted statements, not authenticated delivery proof.
const crypto=require('node:crypto'),mime=require('./communication-rfc822');
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
const fail=()=>{throw Error('Unsupported or ambiguous delivery report');};
function field(map,name,required=false){const values=map.get(name);if(!values){if(required)fail();return null;}if(values.length!==1)fail();return values[0].trim();}
function address(value){const match=value?.match(/^rfc822\s*;\s*([^\s;]+)$/i);if(!match||!require('./communication-send-reviews').address(match[1]))fail();return match[1];}
function key(value){const at=value.lastIndexOf('@');return value.slice(0,at)+'@'+value.slice(at+1).toLowerCase();}
function parse(raw){
 const unavailable={available:false,reason:'MALFORMED_OR_UNSUPPORTED_DSN',sender_identity_verified:false,delivery_verified:false};
 try{
  if(!Buffer.isBuffer(raw)||raw.length>262144)fail();
  const root=mime.headers(raw),type=mime.typed(field(root.map,'content-type'),'text/plain');
  if(type.type!=='multipart/report'||type.params['report-type']?.toLowerCase()!=='delivery-status')return {...unavailable,reason:'NOT_DELIVERY_STATUS_REPORT'};
  const boundary=type.params.boundary,encoding=field(root.map,'content-transfer-encoding')||'7bit';
  if(!boundary||boundary.length>70||/[^\x20-\x7e]/.test(boundary)||!['7bit','8bit','binary'].includes(encoding.toLowerCase()))fail();
  const chunks=[];let current=null,closed=false;
  for(const line of root.body.toString('latin1').split('\r\n')){
   const delimiter=line.replace(/[ \t]+$/,'');
   if(delimiter==='--'+boundary||delimiter==='--'+boundary+'--'){
    if(current!==null)chunks.push(Buffer.from(current.join('\r\n'),'latin1'));
    if(delimiter==='--'+boundary+'--'){closed=true;break;}current=[];
   }else if(current!==null)current.push(line);
  }
  if(!closed||chunks.length<2||chunks.length>3)fail();
  const part=mime.headers(chunks[1]);if(mime.typed(field(part.map,'content-type'),'text/plain').type!=='message/delivery-status'||!['7bit','8bit'].includes((field(part.map,'content-transfer-encoding')||'7bit').toLowerCase()))fail();
  if(part.body.length>65536||part.body.some(b=>b>126||b<32&&![9,10,13].includes(b)))fail();
  const blocks=part.body.toString('ascii').replace(/(?:\r\n)+$/,'').split('\r\n\r\n');if(blocks.length<2||blocks.length>101)fail();
  const maps=blocks.map(block=>mime.headers(Buffer.from(block+'\r\n\r\n')).map),reporting=field(maps[0],'reporting-mta',true);
  if(!/^[A-Za-z0-9-]+\s*;\s*\S[^\r\n]*$/.test(reporting))fail();
  const recipients=maps.slice(1).map(map=>{
   const final_recipient=address(field(map,'final-recipient',true)),original=field(map,'original-recipient'),action=field(map,'action',true).toLowerCase(),status=field(map,'status',true);
   if(!['failed','delayed','delivered','relayed','expanded'].includes(action)||!/^([245])\.[0-9]{1,3}\.[0-9]{1,3}$/.test(status)||status[0]!==({failed:'5',delayed:'4',delivered:'2',relayed:'2',expanded:'2'})[action])fail();
   return {final_recipient,original_recipient:original===null?null:address(original),action,status,diagnostic:field(map,'diagnostic-code'),last_attempt:field(map,'last-attempt-date'),reported_only:true};
  });
  const keys=recipients.map(row=>key(row.original_recipient||row.final_recipient));if(new Set(keys).size!==keys.length)fail();
  let original_message_id=null;
  if(chunks[2]){
   const returned=mime.headers(chunks[2]),returnedType=mime.typed(field(returned.map,'content-type'),'text/plain').type;
   if(!['text/rfc822-headers','message/rfc822'].includes(returnedType)||!['7bit','8bit'].includes((field(returned.map,'content-transfer-encoding')||'7bit').toLowerCase()))fail();
   const body=returned.body,originalHeaders=mime.headers(body.indexOf('\r\n\r\n')>=0?body:Buffer.concat([body,Buffer.from('\r\n\r\n')]));
   const ids=mime.messageIds(field(originalHeaders.map,'message-id'));if(ids.length!==1)fail();original_message_id=ids[0];
  }
  return {available:true,source_sha256:digest(raw),reporting_mta:reporting,original_message_id,recipients,sender_identity_verified:false,delivery_verified:false,verification:'UNTRUSTED_DSN_REPORT',reason:null};
 }catch{return unavailable;}
}
function inspect(core,ctx,actor,id){
 core.scope(ctx,actor);core.resolver.assertCapability(ctx,actor,'communication:inbox');
 const record=core.get(ctx,actor,'messages',id),base={source_message_id:id,source_revision:record.revision,external_send:false,provider_updated:false,delivery_verified:false,correlation:{status:'UNAVAILABLE',outbound_id:null}};
 if(!Number.isSafeInteger(record.revision)||record.revision<1||record.direction!=='INBOUND'||record.provenance?.source!=='IMAP_READ_ONLY'||record.provider_currently_draft===true)return {...base,report:{available:false,reason:'NO_RETAINED_IMAP_SOURCE'}};
 const items=core.adapter.bucket(ctx,'communication:mailbox_items').filter(row=>row.message_id===id);
 if(items.length!==1)return {...base,report:{available:false,reason:'SOURCE_UNAVAILABLE'}};
 const item=items[0],raw=typeof item.raw_base64==='string'?Buffer.from(item.raw_base64,'base64'):null;
 if(!raw||raw.length>262144||raw.length!==item.retained_bytes||raw.toString('base64')!==item.raw_base64||digest(raw)!==item.raw_sha256||record.provenance.source_sha256!==item.raw_sha256||item.is_provider_draft||item.mailbox_id!==record.mailbox_id||item.uid!==record.provider_uid||item.uidvalidity!==record.provider_uidvalidity)return {...base,report:{available:false,reason:'SOURCE_INTEGRITY_UNAVAILABLE'}};
 const report=parse(raw);base.report=report;if(!report.available)return base;
 if(!report.original_message_id)return {...base,correlation:{status:'NO_ORIGINAL_MESSAGE_ID',outbound_id:null}};
 const messages=core.bucket(ctx,'messages');if(messages.length>25000)return {...base,correlation:{status:'CAPACITY_UNAVAILABLE',outbound_id:null}};
 const matches=[];
 for(const row of messages){if(row.direction!=='OUTBOUND'||row.internet_message_id!==report.original_message_id)continue;try{const current=core.get(ctx,actor,'messages',row.id);if(current.source_draft_id)core.get(ctx,actor,'drafts',current.source_draft_id);matches.push(current);}catch(error){if(![401,403,404,409].includes(error.statusCode))throw error;}}
 if(matches.length!==1)return {...base,correlation:{status:matches.length?'AMBIGUOUS_ACCESSIBLE_SUBMISSIONS':'NO_ACCESSIBLE_SUBMISSION',outbound_id:null}};
 const outbound=matches[0],attempts=core.adapter.bucket(ctx,'communication:submissions').filter(row=>row.id===outbound.submission_id),attempt=attempts[0];
 if(attempts.length!==1||attempt.status!=='ACCEPTED_BY_PROVIDER'||outbound.status!=='ACCEPTED_BY_PROVIDER'||attempt.message_id!==report.original_message_id||attempt.draft_id!==outbound.source_draft_id||typeof attempt.mime_data!=='string'||Buffer.byteLength(attempt.mime_data)>9*1024*1024||digest(attempt.mime_data)!==attempt.payload_sha256||attempt.payload_sha256!==outbound.payload_sha256)return {...base,correlation:{status:'SUBMISSION_INTEGRITY_UNAVAILABLE',outbound_id:null}};
 // Compare the original immutable MIME envelope recipients, not editable display fields.
 let sent;try{const head=mime.headers(Buffer.from(attempt.mime_data)),ids=mime.messageIds(field(head.map,'message-id',true));sent={message_id:ids.length===1?ids[0]:null,to:mime.mailboxes(field(head.map,'to',true)),cc:head.map.has('cc')?mime.mailboxes(field(head.map,'cc')):[]};}catch{}if(!sent||sent.message_id!==attempt.message_id||!Array.isArray(sent.to)||!Array.isArray(sent.cc))return {...base,correlation:{status:'SUBMISSION_RECIPIENTS_UNAVAILABLE',outbound_id:null}};
 const recipients=[...sent.to,...sent.cc].map(key),matched=report.recipients.map(row=>({...row,recipient_match:recipients.includes(key(row.original_recipient||row.final_recipient))}));
 const reported=new Set(matched.filter(row=>row.recipient_match).map(row=>key(row.original_recipient||row.final_recipient)));
 return {...base,report:{...report,recipients:matched},correlation:{status:matched.every(row=>row.recipient_match)?'EXACT_MESSAGE_ID_AND_REPORTED_RECIPIENTS':'RECIPIENT_MISMATCH',outbound_id:outbound.id,outbound_revision:outbound.revision,submission_id:attempt.id,payload_sha256:attempt.payload_sha256,unreported_recipients:recipients.filter(value=>!reported.has(value)),coverage:'ACCESSIBLE_RETAINED_SUBMISSION_ONLY',sender_identity_verified:false,delivery_verified:false,changes_submission_status:false}};
}
module.exports={parse,inspect};
