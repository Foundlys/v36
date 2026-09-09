'use strict';
const crypto=require('node:crypto');
const clone=value=>JSON.parse(JSON.stringify(value));
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fail=(code,message,statusCode=422)=>{throw Object.assign(new Error(message),{code,statusCode});};
const email=value=>typeof value==='string'&&value.length<=320&&/^\S+@\S+\.\S+$/.test(value);
function sourceHash(row){return hash({id:row.id,revision:row.revision,title:row.title,content:row.content,from:row.from,reply_to:row.reply_to,to:row.to,thread_id:row.thread_id});}
function preview(core,ctx,actor,id,mode){
 core.scope(ctx,actor);core.resolver.assertCapability(ctx,actor,'communication:drafts','write');
 if(!['REPLY','FORWARD'].includes(mode))fail('message_draft_mode_invalid','Kies beantwoorden of doorsturen');
 const source=core.get(ctx,actor,'messages',id);
 if(!Number.isSafeInteger(source.revision)||source.revision<1||typeof source.title!=='string'||typeof source.content!=='string'||source.deleted_at)fail('message_source_unavailable','De bron van het bericht is onvolledig',409);
 const sender=source.reply_to??source.from,to=mode==='REPLY'?(email(sender)?[sender]:null):[];
 return {mode,source_id:source.id,source_revision:source.revision,source_hash:sourceHash(source),title:`${mode==='REPLY'?'Re:':'Fwd:'} ${source.title}`.slice(0,1000),suggested_to:to,recipient_available:mode==='FORWARD'||to!==null,source_excerpt:source.content.slice(0,2000),source_excerpt_truncated:source.content.length>2000,source_content_kind:'UNTRUSTED_RETAINED_MESSAGE',quoted_content_copied:false,external_send:false};
}
function readable(core,ctx,actor,row){
 if(core.id!=='communication'||row.owned_entity!=='drafts'||!row.source_message_ref)return true;
 try{const ref=row.source_message_ref;if(typeof ref.id!=='string'||!Number.isSafeInteger(ref.revision)||!['REPLY','FORWARD'].includes(ref.mode))return false;const source=core.get(ctx,actor,'messages',ref.id);return !source.deleted_at;}
 catch(error){if([401,403,404].includes(error.statusCode))return false;throw error;}
}
function accessPredicate(core,ctx,actor,{exporting=false}={}){
 let sources=new Set();
 try{if(!exporting)core.resolver.assertCapability(ctx,actor,'communication:inbox');sources=new Set(core.bucket(ctx,'messages').filter(row=>!row.deleted_at&&core.visible(row,actor)).map(row=>row.id));}
 catch(error){if(![401,403].includes(error.statusCode))throw error;}
 return row=>row.owned_entity!=='drafts'||!row.source_message_ref||Boolean(typeof row.source_message_ref.id==='string'&&Number.isSafeInteger(row.source_message_ref.revision)&&['REPLY','FORWARD'].includes(row.source_message_ref.mode)&&sources.has(row.source_message_ref.id));
}
function create(core,ctx,actor,id,input,options={}){
 core.scope(ctx,actor,'write');core.resolver.assertCapability(ctx,actor,'communication:drafts','write');
 const fields=['mode','source_revision','source_hash','title','content','to'];
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!fields.includes(key)))fail('message_draft_input_invalid','Ongeldige conceptaanvraag');
 const proposed=preview(core,ctx,actor,id,input.mode);
 if(input.source_revision!==proposed.source_revision||input.source_hash!==proposed.source_hash)fail('message_source_changed','Het bronbericht is gewijzigd; bekijk het opnieuw',409);
 require('./communication-drafts').validateInput(input);
 if(!Array.isArray(input.to)||!input.to.length)fail('message_draft_recipient_required','Kies een ontvanger voor dit concept');
 if(input.mode==='REPLY'&&(!proposed.recipient_available||JSON.stringify(input.to)!==JSON.stringify(proposed.suggested_to)))fail('message_reply_recipient_unavailable','De afzender is niet verifieerbaar of wijkt af; bekijk het bericht opnieuw');
 if(typeof options.idempotency_key!=='string'||!options.idempotency_key||options.idempotency_key.length>200)fail('draft_idempotency_required','Een unieke actie-ID is verplicht');
 const key=hash(['MESSAGE_DRAFT',options.idempotency_key]),fingerprint=hash({id,input}),receipts=core.adapter.bucket(ctx,'communication:draft_operations'),seen=receipts.find(row=>row.key===key&&row.actor_id===actor.id);
 if(seen){if(seen.fingerprint!==fingerprint)fail('draft_action_conflict','Deze actiesleutel hoort bij een andere aanvraag',409);return {record:core.get(ctx,actor,'drafts',seen.record_id),deduplicated:true,external_send:false};}
 if(receipts.length>=25000)fail('draft_operation_capacity','De limiet voor bewaarde conceptacties is bereikt',507);
 const result=core.mutate(ctx,()=>{
  const saved=core.saveOwned(ctx,actor,'drafts',{title:input.title,content:input.content,to:input.to,status:'DRAFT'}).record;
  const row=core.bucket(ctx,'drafts').find(row=>row.id===saved.id);
  row.source_message_ref={id,revision:proposed.source_revision,hash:proposed.source_hash,mode:input.mode};
  receipts.push({key,actor_id:actor.id,fingerprint,record_id:row.id});
  return {record:clone(row),deduplicated:false,external_send:false,quoted_content_copied:false};
 });try{core.flush(ctx,actor);}catch{result.event_delivery='QUEUED_RETRY';}return result;
}
module.exports={preview,create,readable,accessPredicate};
