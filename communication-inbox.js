'use strict';
const crypto=require('node:crypto');
const SCOPE='communication:inbox_state';
const clone=value=>JSON.parse(JSON.stringify(value)),hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fail=(code,message,statusCode=422)=>{throw Object.assign(new Error(message),{code,statusCode});};
function authorize(core,ctx,actor,operation='read'){core.scope(ctx,actor,operation);core.resolver.assertCapability(ctx,actor,'communication:inbox',operation);}
function stateView(row,sourceRevision){return row?{read:row.source_revision===sourceRevision?row.read:null,archived:row.archived,revision:row.revision,updated_at:row.updated_at}:{read:null,archived:false,revision:0,updated_at:null};}
function stateMap(core,ctx,actor){
 const map=new Map();for(const row of core.adapter.bucket(ctx,SCOPE).filter(row=>row.owner_id===actor.id)){
  if(map.has(row.message_id)||![true,false,null].includes(row.read)||typeof row.archived!=='boolean'||!Number.isSafeInteger(row.revision)||row.revision<1||!Number.isSafeInteger(row.source_revision)||row.source_revision<1)fail('inbox_state_unavailable','De persoonlijke inboxstatus is niet verifieerbaar',409);
  map.set(row.message_id,row);
 }return map;
}
function canWrite(core,ctx,actor){try{authorize(core,ctx,actor,'write');return true;}catch(error){if(error.statusCode===403)return false;throw error;}}
function messageTime(row){try{const value=row.received_at||row.sent_at;if(typeof value!=='string')return null;return new Date(require('./calendar-time').timestamp(value)).toISOString();}catch{return null;}}
function normalize(query){
 if(!query||typeof query!=='object'||Array.isArray(query)||Object.keys(query).some(key=>!['q','read','folder','direction','limit','offset'].includes(key)))fail('inbox_query_invalid','Ongeldige inboxfilter');
 const q=query.q??'',read=query.read??'all',folder=query.folder??'inbox',direction=query.direction??'all',limit=Number(query.limit??25),offset=Number(query.offset??0);
 if(typeof q!=='string'||q.length>100||!['all','read','unread','unknown'].includes(read)||!['inbox','archived','all'].includes(folder)||!['all','INBOUND','OUTBOUND'].includes(direction)||!Number.isSafeInteger(limit)||limit<1||limit>100||!Number.isSafeInteger(offset)||offset<0||offset>25000)fail('inbox_query_invalid','Kies geldige inboxfilters en een pagina van maximaal honderd berichten');
 return {q:q.trim().toLowerCase(),read,folder,direction,limit,offset};
}
function list(core,ctx,actor,query={}){
 authorize(core,ctx,actor);const filter=normalize(query),states=stateMap(core,ctx,actor),retained=core.bucket(ctx,'messages');if(retained.length>25000)fail('inbox_capacity','De bewaarde inbox is te groot voor deze zoekopdracht',507);
 const matched=[];let observed=0;
 for(const row of retained){
  if(row.deleted_at||row.provider_currently_draft===true||row.status==='ARCHIVED'||!core.visible(row,actor))continue;observed++;const local=stateView(states.get(row.id),row.revision);
  if(filter.folder!=='all'&&local.archived!==(filter.folder==='archived')||filter.read!=='all'&&local.read!==({read:true,unread:false,unknown:null})[filter.read]||filter.direction!=='all'&&row.direction!==filter.direction)continue;
  if(filter.q&&![row.title,row.content,row.from,...(Array.isArray(row.to)?row.to:[])].some(value=>typeof value==='string'&&value.toLowerCase().includes(filter.q)))continue;
  matched.push({row,local,time:messageTime(row)});
 }
 matched.sort((a,b)=>String(b.time||'').localeCompare(String(a.time||''))||String(a.row.id).localeCompare(String(b.row.id)));
 return {items:matched.slice(filter.offset,filter.offset+filter.limit).map(({row,local,time})=>({id:row.id,title:typeof row.title==='string'?row.title.slice(0,300):null,from:typeof row.from==='string'?row.from.slice(0,320):null,to:Array.isArray(row.to)?row.to.filter(value=>typeof value==='string').slice(0,100):[],direction:['INBOUND','OUTBOUND'].includes(row.direction)?row.direction:null,message_revision:Number.isSafeInteger(row.revision)?row.revision:null,received_or_sent_at:time,local_state:local})),total_retained_matching:matched.length,total_retained_visible:observed,external_mailbox_total:null,external_mailbox_complete:false,coverage:'AUTHORIZED_RETAINED_RECORDS_ONLY',local_state_scope:'CURRENT_USER_ONLY',limit:filter.limit,offset:filter.offset,next_offset:filter.offset+filter.limit<matched.length?filter.offset+filter.limit:null,can_write:canWrite(core,ctx,actor),provider_updated:false};
}
function detail(core,ctx,actor,id){
  authorize(core,ctx,actor);const row=core.get(ctx,actor,'messages',id);if(row.deleted_at)fail('record_not_found','Bericht niet gevonden',404);
 let canDraft=false;try{core.scope(ctx,actor,'write');core.resolver.assertCapability(ctx,actor,'communication:drafts','write');canDraft=true;}catch(error){if(error.statusCode!==403)throw error;}
 let canThreads=false;try{core.resolver.assertCapability(ctx,actor,'communication:threads');canThreads=true;}catch(error){if(error.statusCode!==403)throw error;}
 return {record:row,can_view_conversation:canThreads,local_state:stateView(stateMap(core,ctx,actor).get(id),row.revision),can_write:canWrite(core,ctx,actor)&&Number.isSafeInteger(row.revision)&&row.revision>0,can_prepare_draft:canDraft,content_kind:'UNTRUSTED_RETAINED_MESSAGE',provider_updated:false};
}
function update(core,ctx,actor,id,input,options={}){
 authorize(core,ctx,actor,'write');const source=core.get(ctx,actor,'messages',id);if(source.deleted_at)fail('record_not_found','Bericht niet gevonden',404);
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!['read','archived','expected_revision','expected_message_revision'].includes(key))||!['read','archived'].some(key=>Object.hasOwn(input,key))||['read','archived'].some(key=>Object.hasOwn(input,key)&&typeof input[key]!=='boolean'))fail('inbox_state_invalid','Kies een geldige persoonlijke lees- of archiefstatus');
 const states=stateMap(core,ctx,actor),prior=states.get(id),local=stateView(prior,source.revision),operations=core.adapter.bucket(ctx,'communication:draft_operations');
 if(typeof options.idempotency_key!=='string'||!options.idempotency_key||options.idempotency_key.length>200)fail('inbox_idempotency_required','Een unieke actie-ID is verplicht');
 const key=hash(['INBOX_STATE',options.idempotency_key]),fingerprint=hash({id,input}),seen=operations.find(row=>row.key===key&&row.actor_id===actor.id);
 if(seen){if(seen.fingerprint!==fingerprint)fail('inbox_action_conflict','Deze actiesleutel heeft andere inhoud',409);return {local_state:local,receipt:clone(seen.receipt),deduplicated:true,provider_updated:false};}
 if(!Number.isSafeInteger(source.revision)||source.revision<1||source.revision!==input.expected_message_revision||local.revision!==input.expected_revision||local.revision>=Number.MAX_SAFE_INTEGER)fail('inbox_revision_conflict','Het bericht of de persoonlijke status is gewijzigd',409);
 const rows=core.adapter.bucket(ctx,SCOPE);if(rows.length>=25000&&!prior||operations.length>=25000)fail('inbox_capacity','De limiet voor bewaarde inboxacties is bereikt',507);
 const result=core.mutate(ctx,()=>{
  const now=new Date().toISOString(),row={id:prior?.id||crypto.randomUUID(),message_id:id,owner_id:actor.id,read:Object.hasOwn(input,'read')?input.read:local.read,archived:Object.hasOwn(input,'archived')?input.archived:local.archived,revision:local.revision+1,source_revision:source.revision,updated_at:now,created_at:prior?.created_at||now,owned_entity:'inbox_state',schema_version:1};
  if(prior)rows[rows.indexOf(prior)]=row;else rows.push(row);const receipt={message_id:id,result_revision:row.revision,source_revision:source.revision,at:now};operations.push({key,actor_id:actor.id,fingerprint,receipt});
  core.recordEvent(ctx,actor,'inbox_state',row,'updated');return {local_state:stateView(row,source.revision),receipt,deduplicated:false,provider_updated:false};
 });try{core.flush(ctx,actor);}catch{result.event_delivery='QUEUED_RETRY';}return result;
}
function exportOwned(core,ctx,actor,messages){const visible=new Set(messages.filter(row=>!row.deleted_at&&row.provider_currently_draft!==true).map(row=>row.id));return [...stateMap(core,ctx,actor).values()].filter(row=>visible.has(row.message_id)).map(clone);}
module.exports={SCOPE,list,detail,update,exportOwned};
