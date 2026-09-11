'use strict';
// Durable observations of the local verified transport. No caller-supplied
// outcome, mailbox copy or provider draft can create a receipt here.
const processObservation=require('./communication-process-observation'),crypto=require('node:crypto'),{scopedMutation}=require('./scoped-mutation');
const SCOPE='communication:submission_receipts',INSTANCE=crypto.randomUUID(),active=new Set(),hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'),clone=value=>JSON.parse(JSON.stringify(value));
const key=(ctx,id)=>JSON.stringify([ctx.tenant_id,ctx.dealer_id,id]);
const fail=code=>{throw Object.assign(new Error('Het bewaarde verzendbewijs is niet beschikbaar'),{code,statusCode:409});};
const uncertain=row=>['CONNECTING','DATA_IN_FLIGHT','UNKNOWN'].includes(row?.status);
function integrity(row){return row?.schema_version===2&&typeof row.mime_data==='string'&&Buffer.byteLength(row.mime_data)===row.payload_size_bytes&&crypto.createHash('sha256').update(row.mime_data).digest('hex')===row.payload_sha256;}
function identity(row){return {submission_id:row.id,draft_id:row.draft_id,message_id:row.message_id,payload_sha256:row.payload_sha256,payload_size_bytes:row.payload_size_bytes,basis_fingerprint:row.basis_fingerprint};}
function validate(receipt,row){try{
 if(!integrity(row)||!receipt||receipt.schema_version!==1)return false;
 const {integrity_sha256,...body}=receipt;
 if(hash(body)!==integrity_sha256||hash(body.identity)!==hash(identity(row))||!['ACCEPTED_BY_PROVIDER','REJECTED_BY_PROVIDER','NOT_SUBMITTED'].includes(body.status)||!Number.isFinite(Date.parse(body.observed_at))||Date.parse(body.observed_at)>Date.now())return false;
 if(body.status==='ACCEPTED_BY_PROVIDER')return body.smtp_code===250&&/^[a-f0-9]{64}$/.test(body.receipt_sha256||'')&&body.record?.id===row.id&&body.record.submission_id===row.id&&body.record.source_draft_id===row.draft_id&&body.record.review_id===row.review_id&&body.record.payload_sha256===row.payload_sha256&&body.record.internet_message_id===row.message_id&&body.record.owner_id===row.owner_id&&body.record.status==='ACCEPTED_BY_PROVIDER'&&body.record.delivery_verified===false&&body.record.provenance?.receipt_sha256===body.receipt_sha256;
 return body.record===null&&(body.status==='NOT_SUBMITTED'||Number.isInteger(body.smtp_code)&&body.smtp_code>=400&&body.smtp_code<=599);
 }catch{return false;}
}
function retain(core,ctx,row,{status,smtp_code,receipt_sha256,error_code,record,observed_at}){
 const rows=core.adapter.bucket(ctx,SCOPE),body={schema_version:1,identity:identity(row),status,smtp_code,receipt_sha256,error_code,record:record?clone(record):null,observed_at},receipt={...body,integrity_sha256:hash(body)};
 if(!validate(receipt,row))fail('mail_receipt_invalid');
 const prior=rows.find(value=>value?.identity?.submission_id===row.id);if(prior){if(hash(prior)!==hash(receipt))fail('mail_receipt_conflict');return prior;}
 if(rows.length>=1000||Buffer.byteLength(JSON.stringify([...rows,receipt]))>16*1024*1024)fail('mail_receipt_capacity');
 return scopedMutation(core.adapter,ctx,[SCOPE],()=>{rows.push(receipt);return receipt;});
}
function inspect(core,ctx,row){
 if(!uncertain(row))return {available:false,reason:'OUTCOME_ALREADY_RECORDED',kind:null};
 if(active.has(key(ctx,row.id)))return {available:false,reason:'TRANSPORT_STILL_ACTIVE',kind:null};
 if(row.transport_instance_id!==INSTANCE&&!processObservation.retired(row.transport_runtime))return {available:false,reason:'TRANSPORT_RETIREMENT_UNVERIFIED',kind:null};
 const rows=core.adapter.bucket(ctx,SCOPE);if(rows.length>1000||rows.some(value=>!value?.identity||typeof value.identity.submission_id!=='string'))return {available:false,reason:'DURABLE_RECEIPT_INVALID',kind:null};const receipts=rows.filter(value=>value.identity.submission_id===row.id);
 if(receipts.length){if(receipts.length!==1||!validate(receipts[0],row))return {available:false,reason:'DURABLE_RECEIPT_INVALID',kind:null};return {available:true,reason:null,kind:'DURABLE_TRANSPORT_OUTCOME',receipt:receipts[0]};}
 if(integrity(row)&&row.status==='CONNECTING'&&row.revision===1&&/^[a-f0-9-]{36}$/.test(row.transport_instance_id||'')&&row.transport_instance_id!==INSTANCE)return {available:true,reason:null,kind:'RETIRED_BEFORE_DATA'};
 return {available:false,reason:'NO_DURABLE_OUTCOME_PROOF',kind:null};
}
function project(core,ctx,row){const {receipt,...view}=inspect(core,ctx,row);return view;}
function exportOwned(core,ctx,drafts){const allowed=new Set(drafts.map(row=>row.id));return core.adapter.bucket(ctx,SCOPE).filter(row=>allowed.has(row?.identity?.draft_id)).map(clone);}
module.exports={SCOPE,INSTANCE,retain,inspect,project,exportOwned,begin:(ctx,id)=>active.add(key(ctx,id)),end:(ctx,id)=>active.delete(key(ctx,id))};
