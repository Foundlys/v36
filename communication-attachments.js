'use strict';

// Retained draft attachments use the existing encrypted, tenant-scoped adapter.
// Only bounded UTF-8 .txt files are accepted. No parsing, execution, automatic
// Knowledge ingestion, external URL fetch or malware-scan claim is involved.
const crypto=require('node:crypto');
const SCOPE='communication:draft_attachment_content',MAX_BYTES=65536,MAX_CURRENT=10,MAX_RETAINED=20,MAX_TENANT_BYTES=8*1024*1024;
const clone=value=>JSON.parse(JSON.stringify(value));
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
const fail=(code,message,statusCode=422)=>{throw Object.assign(new Error(message),{code,statusCode});};
function validate(input){
 if(typeof input.name!=='string'||!/^[A-Za-z0-9][A-Za-z0-9 _()-]{0,115}\.txt$/i.test(input.name))fail('attachment_name_invalid','Kies een .txt-bestand met een eenvoudige bestandsnaam');
 if(typeof input.content_base64!=='string'||input.content_base64.length>4*Math.ceil(MAX_BYTES/3)||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(input.content_base64))fail('attachment_content_invalid','De tekstbijlage is ongeldig of groter dan 64 KiB');
 const bytes=Buffer.from(input.content_base64,'base64');
 if(bytes.length>MAX_BYTES||bytes.toString('base64')!==input.content_base64)fail('attachment_content_invalid','De tekstbijlage is ongeldig of groter dan 64 KiB');
 let text;try{text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);}catch{fail('attachment_text_invalid','Bijlagen moeten geldige UTF-8-tekst bevatten');}
 if(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(text))fail('attachment_text_invalid','Deze tekst bevat niet-ondersteunde besturingscodes');
 return {bytes,sha256:digest(bytes)};
}
function metadata(row){return {id:row.id,name:row.name,media_type:'text/plain',size_bytes:row.size_bytes,sha256:row.sha256,content_kind:'UNTRUSTED_USER_ATTACHMENT',validation:'UTF8_TEXT_ONLY',malware_scan:'NOT_PERFORMED'};}
function authorize(core,ctx,actor,id,operation='read'){
 core.scope(ctx,actor,operation);core.resolver.assertCapability(ctx,actor,'communication:drafts',operation);return core.get(ctx,actor,'drafts',id);
}
function retained(core,ctx,id,attachmentId){
 const matches=core.adapter.bucket(ctx,SCOPE).filter(row=>row.draft_id===id&&row.id===attachmentId),row=matches[0];
 if(matches.length!==1)fail('attachment_unavailable','De bewaarde bijlage is niet beschikbaar',409);
 let checked;try{checked=validate(row);}catch{fail('attachment_unavailable','De bewaarde bijlage is niet verifieerbaar',409);}
 if(checked.sha256!==row.sha256||checked.bytes.length!==row.size_bytes)fail('attachment_unavailable','De bewaarde bijlage is niet verifieerbaar',409);
 return row;
}
function references(core,ctx,id,refs=[]){
 if(!Array.isArray(refs)||refs.length>MAX_CURRENT||refs.some(ref=>!ref||typeof ref.id!=='string')||new Set(refs.map(ref=>ref.id)).size!==refs.length)fail('attachment_unavailable','De bijlageverwijzingen zijn niet verifieerbaar',409);
 return refs.map(ref=>{if(ref.validation==='SIGNATURE_AND_LOCAL_CLAMAV')return require('./communication-binary-attachments').reference(core,ctx,id,ref);const row=retained(core,ctx,id,ref.id),meta=metadata(row);if(JSON.stringify(meta)!==JSON.stringify(ref))fail('attachment_unavailable','De bijlageverwijzingen zijn gewijzigd',409);return meta;});
}
function list(core,ctx,actor,id){
 const draft=authorize(core,ctx,actor,id);let canWrite=false;try{core.scope(ctx,actor,'write');core.resolver.assertCapability(ctx,actor,'communication:drafts','write');canWrite=true;}catch(error){if(error.statusCode!==403)throw error;}
 return {items:references(core,ctx,id,draft.attachments),current_revision:draft.revision??null,can_write:canWrite,accepted_media_types:['text/plain','application/pdf','image/png','image/jpeg'],accepted_extensions:['.txt','.pdf','.png','.jpg','.jpeg'],max_bytes:MAX_BYTES,max_binary_bytes:require('./communication-binary-attachments').MAX_BYTES,binary_requires_local_scan:true,max_current:MAX_CURRENT,external_send:false};
}
function read(core,ctx,actor,id,attachmentId){
 authorize(core,ctx,actor,id);const binary=require('./communication-binary-attachments');if(core.adapter.bucket(ctx,binary.SCOPE).some(row=>row.draft_id===id&&row.id===attachmentId)){const row=binary.retained(core,ctx,id,attachmentId);return {attachment:{...binary.metadata(row),content_base64:row.content_base64},external_send:false};}const row=retained(core,ctx,id,attachmentId);
 return {attachment:{...metadata(row),content_base64:row.content_base64},external_send:false};
}
function change(core,ctx,actor,id,input,options,kind,execute){
 const draft=authorize(core,ctx,actor,id,'write'),fields=kind==='ATTACH'?['name','content_base64','expected_revision']:['attachment_id','expected_revision'];
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!fields.includes(key)))fail('attachment_action_invalid','Ongeldige bijlageactie');
 if(typeof options.idempotency_key!=='string'||!options.idempotency_key||options.idempotency_key.length>200)fail('draft_idempotency_required','Een unieke actie-ID is verplicht');
 const key=digest(JSON.stringify([kind,options.idempotency_key])),fingerprint=digest(JSON.stringify({id,input})),receipts=core.adapter.bucket(ctx,'communication:draft_operations'),seen=receipts.find(row=>row.key===key&&row.actor_id===actor.id);
 if(seen){if(seen.fingerprint!==fingerprint)fail('draft_action_conflict','Deze actiesleutel heeft andere inhoud',409);return {record:draft,receipt:clone(seen.receipt),deduplicated:true,external_send:false};}
 if(input.expected_revision!==(draft.revision??null)||draft.revision!=null&&(!Number.isSafeInteger(draft.revision)||draft.revision<1||draft.revision>=Number.MAX_SAFE_INTEGER))fail('record_revision_conflict','Het concept is intussen gewijzigd',409);
 if(receipts.length>=25000)fail('draft_operation_capacity','De limiet voor bewaarde conceptacties is bereikt',507);
 const result=core.mutate(ctx,()=>{
  const refs=execute(draft),record=core.saveOwned(ctx,actor,'drafts',{}, {id,expected_revision:draft.revision,draft_attachments:refs,edit_token:options.edit_token}).record;
  const receipt={kind,draft_id:id,result_revision:record.revision,actor_id:actor.id,at:record.updated_at};receipts.push({key,actor_id:actor.id,fingerprint,receipt});
  core.adapter.audit(ctx,actor,kind,'communication:drafts',id,{result_revision:record.revision,attachment_ids:refs.map(ref=>ref.id)});
  return {record,receipt,deduplicated:false,external_send:false};
 });try{core.flush(ctx,actor);}catch{result.event_delivery='QUEUED_RETRY';}return result;
}
function attach(core,ctx,actor,id,input,options={}){
 return change(core,ctx,actor,id,input,options,'ATTACH',draft=>{
  const checked=validate(input),refs=references(core,ctx,id,draft.attachments),rows=core.adapter.bucket(ctx,SCOPE);
  const duplicate=rows.find(row=>row.draft_id===id&&row.name===input.name&&row.sha256===checked.sha256);
  if(duplicate&&refs.some(ref=>ref.id===duplicate.id)){retained(core,ctx,id,duplicate.id);return refs;}
  if(refs.reduce((sum,row)=>sum+row.size_bytes,0)+checked.bytes.length>require('./communication-binary-attachments').MAX_CURRENT_BYTES)fail('attachment_capacity','De totale omvang van conceptbijlagen is te groot',507);
  if(refs.length>=MAX_CURRENT)fail('attachment_capacity','Een concept kan maximaal tien bijlagen bevatten',507);
  if(duplicate)return [...refs,metadata(retained(core,ctx,id,duplicate.id))];
  if(rows.some(row=>!Number.isSafeInteger(row.size_bytes)||row.size_bytes<0||row.size_bytes>MAX_BYTES))fail('attachment_unavailable','Het bewaarde opslaggebruik is niet verifieerbaar',409);
  if(rows.filter(row=>row.draft_id===id).length>=MAX_RETAINED||rows.length>=2000||rows.reduce((sum,row)=>sum+row.size_bytes,0)+checked.bytes.length>MAX_TENANT_BYTES)fail('attachment_capacity','De limiet voor bewaarde bijlagen is bereikt; historische bijlagen worden niet verwijderd',507);
  const row={id:crypto.randomUUID(),draft_id:id,name:input.name,content_base64:input.content_base64,size_bytes:checked.bytes.length,sha256:checked.sha256,created_at:new Date().toISOString(),created_by:actor.id,schema_version:1};rows.push(row);return [...refs,metadata(row)];
 });
}
function detach(core,ctx,actor,id,input,options={}){
 return change(core,ctx,actor,id,input,options,'DETACH',draft=>{
  const refs=references(core,ctx,id,draft.attachments);if(typeof input.attachment_id!=='string'||!refs.some(ref=>ref.id===input.attachment_id))fail('attachment_not_found','Deze bijlage staat niet in het huidige concept',404);
  return refs.filter(ref=>ref.id!==input.attachment_id);
 });
}
function exportOwned(core,ctx,drafts){
 const allowed=new Set(drafts.map(row=>row.id));
 return core.adapter.bucket(ctx,SCOPE).filter(row=>allowed.has(row.draft_id)).map(row=>{retained(core,ctx,row.draft_id,row.id);return clone(row);});
}
async function upload(core,ctx,actor,id,input,options={}){return /\.txt$/i.test(input?.name||'')?attach(core,ctx,actor,id,input,options):require('./communication-binary-attachments').attach(core,ctx,actor,id,input,options);}
function assertSendable(core,ctx,id,refs){for(const ref of refs||[])if(ref.validation==='SIGNATURE_AND_LOCAL_CLAMAV')require('./communication-binary-attachments').reference(core,ctx,id,ref,{fresh:true});}
module.exports={upload,assertSendable,SCOPE,validate,metadata,references,list,read,attach,detach,exportOwned};
