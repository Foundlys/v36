'use strict';
const crypto=require('node:crypto');
const clone=value=>JSON.parse(JSON.stringify(value));
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fail=(code,message,statusCode=422)=>{throw Object.assign(new Error(message),{code,statusCode});};
const email=value=>typeof value==='string'&&value.length<=320&&/^\S+@\S+\.\S+$/.test(value);
function sourceHash(row,version=1){if(version===2)return hash({legacy:sourceHash(row),cc:row.cc,reply_to_available:row.reply_to_available,internet_message_id:row.internet_message_id,in_reply_to:row.in_reply_to,references:row.references,thread_headers_available:row.thread_headers_available});return hash({id:row.id,revision:row.revision,title:row.title,content:row.content,from:row.from,reply_to:row.reply_to,to:row.to,thread_id:row.thread_id});}
function replyAll(source,getAccount,ctx){
 const address=require('./communication-send-reviews').address,account=getAccount?.(ctx),from=account?.provider==='email'&&address(account.from)?account.from:null;
 if(!from)return {suggested_to:null,suggested_cc:null,recipient_available:false,recipient_unavailable_reason:'REPLY_IDENTITY_UNAVAILABLE',reply_from:null,recipient_binding:null};
 const sender=source.reply_to_available===false?null:source.reply_to??source.from;
 if(!address(sender)||!Array.isArray(source.to)||!Array.isArray(source.cc)||source.to.length+source.cc.length>200||[...source.to,...source.cc].some(value=>!address(value)))return {suggested_to:null,suggested_cc:null,recipient_available:false,recipient_unavailable_reason:'SOURCE_RECIPIENTS_UNAVAILABLE',reply_from:from,recipient_binding:null};
 // Only visible To/Cc are candidates. Never copy or infer blind recipients.
 // Preserve local-part case; only DNS names are case-insensitive.
 const canonical=value=>{const split=value.lastIndexOf('@');return value.slice(0,split)+'@'+value.slice(split+1).toLowerCase();},seen=new Set([canonical(from)]),to=[],cc=[];
 for(const value of [sender])if(!seen.has(canonical(value))){seen.add(canonical(value));to.push(value);}
 for(const value of [...source.to,...source.cc])if(!seen.has(canonical(value))){seen.add(canonical(value));cc.push(value);}
 if(!to.length&&cc.length)to.push(cc.shift());
 const available=to.length>0&&to.length+cc.length<=100;
 return {suggested_to:available?to:null,suggested_cc:available?cc:null,recipient_available:available,recipient_unavailable_reason:available?null:'RECIPIENT_SET_UNAVAILABLE',reply_from:from,recipient_binding:available?hash({source_hash:sourceHash(source,2),from,to,cc}):null,blind_recipients_included:false};
}
function preview(core,ctx,actor,id,mode,getAccount){
 core.scope(ctx,actor);core.resolver.assertCapability(ctx,actor,'communication:drafts','write');
 if(!['REPLY','REPLY_ALL','FORWARD'].includes(mode))fail('message_draft_mode_invalid','Kies beantwoorden, allen beantwoorden of doorsturen');
 const source=core.get(ctx,actor,'messages',id);
 if(!Number.isSafeInteger(source.revision)||source.revision<1||typeof source.title!=='string'||typeof source.content!=='string'||source.deleted_at)fail('message_source_unavailable','De bron van het bericht is onvolledig',409);
 const sender=source.reply_to_available===false?null:source.reply_to??source.from,to=mode==='REPLY'?(email(sender)?[sender]:null):[],all=mode==='REPLY_ALL'?replyAll(source,getAccount,ctx):{};
 return {mode,source_id:source.id,source_revision:source.revision,source_hash:sourceHash(source,mode==='REPLY_ALL'?2:1),title:`${mode==='FORWARD'?'Fwd:':'Re:'} ${source.title}`.slice(0,1000),suggested_to:to,recipient_available:mode==='FORWARD'||to!==null,...all,threading:mode!=='FORWARD'?require('./communication-threads').replyHeaders(source):{available:true,in_reply_to:[],references:[]},source_excerpt:source.content.slice(0,2000),source_excerpt_truncated:source.content.length>2000,source_content_kind:'UNTRUSTED_RETAINED_MESSAGE',quoted_content_copied:false,external_send:false};
}
function readable(core,ctx,actor,row){
 if(core.id!=='communication'||row.owned_entity!=='drafts'||!row.source_message_ref)return true;
 try{const ref=row.source_message_ref;if(typeof ref.id!=='string'||!Number.isSafeInteger(ref.revision)||!['REPLY','REPLY_ALL','FORWARD'].includes(ref.mode))return false;const source=core.get(ctx,actor,'messages',ref.id);return !source.deleted_at;}
 catch(error){if([401,403,404].includes(error.statusCode))return false;throw error;}
}
function accessPredicate(core,ctx,actor,{exporting=false}={}){
 let sources=new Set();
 try{if(!exporting)core.resolver.assertCapability(ctx,actor,'communication:inbox');sources=new Set(core.bucket(ctx,'messages').filter(row=>!row.deleted_at&&row.provider_currently_draft!==true&&core.visible(row,actor)).map(row=>row.id));}
 catch(error){if(![401,403].includes(error.statusCode))throw error;}
 return row=>row.owned_entity!=='drafts'||!row.source_message_ref||Boolean(typeof row.source_message_ref.id==='string'&&Number.isSafeInteger(row.source_message_ref.revision)&&['REPLY','REPLY_ALL','FORWARD'].includes(row.source_message_ref.mode)&&sources.has(row.source_message_ref.id));
}
function create(core,ctx,actor,id,input,options={},getAccount){
 core.scope(ctx,actor,'write');core.resolver.assertCapability(ctx,actor,'communication:drafts','write');
 const fields=['mode','source_revision','source_hash','title','content','to','cc','recipient_binding'];
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!fields.includes(key)))fail('message_draft_input_invalid','Ongeldige conceptaanvraag');
 const proposed=preview(core,ctx,actor,id,input.mode,getAccount);
 if(input.source_revision!==proposed.source_revision||input.source_hash!==proposed.source_hash)fail('message_source_changed','Het bronbericht is gewijzigd; bekijk het opnieuw',409);
 require('./communication-drafts').validateInput(input);
 if(!Array.isArray(input.to)||!input.to.length)fail('message_draft_recipient_required','Kies een ontvanger voor dit concept');
 if(input.mode==='REPLY'&&(!proposed.recipient_available||JSON.stringify(input.to)!==JSON.stringify(proposed.suggested_to)))fail('message_reply_recipient_unavailable','De afzender is niet verifieerbaar of wijkt af; bekijk het bericht opnieuw');
 if(input.mode==='REPLY_ALL'&&(!proposed.recipient_available||input.recipient_binding!==proposed.recipient_binding||JSON.stringify(input.to)!==JSON.stringify(proposed.suggested_to)||JSON.stringify(input.cc)!==JSON.stringify(proposed.suggested_cc)))fail('message_reply_recipient_unavailable','De actuele ontvangers of afzender zijn gewijzigd of niet beschikbaar');
 if(input.mode==='REPLY'&&input.cc?.length)fail('message_reply_recipient_unavailable','Kies allen beantwoorden om kopieontvangers op te nemen');
 if(typeof options.idempotency_key!=='string'||!options.idempotency_key||options.idempotency_key.length>200)fail('draft_idempotency_required','Een unieke actie-ID is verplicht');
 const key=hash(['MESSAGE_DRAFT',options.idempotency_key]),fingerprint=hash({id,input}),receipts=core.adapter.bucket(ctx,'communication:draft_operations'),seen=receipts.find(row=>row.key===key&&row.actor_id===actor.id);
 if(seen){if(seen.fingerprint!==fingerprint)fail('draft_action_conflict','Deze actiesleutel hoort bij een andere aanvraag',409);return {record:core.get(ctx,actor,'drafts',seen.record_id),deduplicated:true,external_send:false};}
 if(receipts.length>=25000)fail('draft_operation_capacity','De limiet voor bewaarde conceptacties is bereikt',507);
 const result=core.mutate(ctx,()=>{
  const saved=core.saveOwned(ctx,actor,'drafts',{title:input.title,content:input.content,to:input.to,...(input.cc!==undefined?{cc:input.cc}:{}),status:'DRAFT'}).record;
  const row=core.bucket(ctx,'drafts').find(row=>row.id===saved.id);
  row.source_message_ref={id,revision:proposed.source_revision,hash:proposed.source_hash,mode:input.mode,...(input.mode==='REPLY_ALL'?{hash_version:2,reply_from:proposed.reply_from}:{})};
  receipts.push({key,actor_id:actor.id,fingerprint,record_id:row.id});
  return {record:clone(row),deduplicated:false,external_send:false,quoted_content_copied:false};
 });try{core.flush(ctx,actor);}catch{result.event_delivery='QUEUED_RETRY';}return result;
}
module.exports={preview,create,readable,accessPredicate,sourceHash};
