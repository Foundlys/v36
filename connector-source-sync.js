'use strict';
const crypto=require('node:crypto'),{scopedMutation}=require('./scoped-mutation');
const RECEIPTS='platform:connector_import_receipts',MAX_BYTES=2*1024*1024,MAX_ITEMS=1000;
const fail=(code,statusCode=409)=>{throw Object.assign(new Error(code),{code,statusCode});};
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const canonical=value=>Array.isArray(value)?value.map(canonical):object(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const clone=value=>JSON.parse(JSON.stringify(value));
async function readPayload(response){
 const declared=Number(response.headers?.get('content-length'));if(Number.isFinite(declared)&&declared>MAX_BYTES){await response.body?.cancel?.().catch(()=>{});fail('connector_sync_payload_too_large',413);}
 let bytes;
 if(response.body?.getReader){const reader=response.body.getReader(),chunks=[];let size=0;try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_BYTES){await reader.cancel();fail('connector_sync_payload_too_large',413);}chunks.push(Buffer.from(value));}bytes=Buffer.concat(chunks);}finally{reader.releaseLock();}}
 else{bytes=Buffer.from(await response.text());if(bytes.length>MAX_BYTES)fail('connector_sync_payload_too_large',413);}
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{fail('connector_sync_payload_invalid',422);}
}
function pageItems(payload){
 let list=payload;if(!Array.isArray(list)){if(!object(payload))fail('connector_sync_mapping_required',422);const candidates=['data','items','results'].filter(key=>Array.isArray(payload[key]));if(candidates.length!==1)fail('connector_sync_mapping_required',422);list=payload[candidates[0]];}
 if(list.length>MAX_ITEMS)fail('connector_sync_page_too_large',413);
 let nodes=0;const validate=(value,depth=0)=>{if(++nodes>100000||depth>32)fail('connector_sync_payload_too_complex',413);if(typeof value==='number'&&(!Number.isFinite(value)||Number.isInteger(value)&&!Number.isSafeInteger(value)))fail('connector_sync_number_unrepresentable',422);if(value&&typeof value==='object')for(const item of Object.values(value))validate(item,depth+1);};
 for(const item of list){if(!object(item))fail('connector_sync_mapping_required',422);validate(item);}return list;
}
class ConnectorSourceSync{
 constructor(adapter,{authorize,configuration,fetchPage,sanitize=value=>value,capacity=5000,now=()=>new Date().toISOString()}){Object.assign(this,{adapter,authorize,configuration,fetchPage,sanitize,capacity,now});this.pending=new Map();}
 receipt(ctx,actor,id,key,fingerprint){const prior=this.adapter.bucket(ctx,RECEIPTS).find(row=>row.actor_id===actor.id&&row.connector_id===id&&row.request_id===key);if(prior&&prior.request_fingerprint!==fingerprint)fail('connector_sync_request_conflict');return prior?clone(prior.result):null;}
 async sync(ctx,actor,id,input={},requestId){
  this.authorize(ctx,actor,id);if(!object(input))fail('connector_sync_request_invalid',400);
  if(Object.hasOwn(input,'expected_revision')&&(!Number.isSafeInteger(input.expected_revision)||input.expected_revision<0))fail('connector_sync_request_invalid',400);
  const key=requestId===undefined?crypto.randomUUID():requestId;if(typeof key!=='string'||!/^[A-Za-z0-9_.:-]{1,160}$/.test(key))fail('connector_sync_request_invalid',400);
  const fingerprint=hash({id,expected_revision:input.expected_revision??null}),prior=this.receipt(ctx,actor,id,key,fingerprint);if(prior)return prior;
  const pendingKey=hash([ctx.tenant_id,ctx.dealer_id,actor.id,id,key]),pending=this.pending.get(pendingKey);
  if(pending){if(pending.fingerprint!==fingerprint)fail('connector_sync_request_conflict');const result=await pending.promise;this.authorize(ctx,actor,id);return clone(result);}
  const promise=this.execute(ctx,actor,id,input,key,fingerprint);this.pending.set(pendingKey,{fingerprint,promise});try{return clone(await promise);}finally{this.pending.delete(pendingKey);}
 }
 async execute(ctx,actor,id,input,key,fingerprint){
  const config=this.configuration(ctx,id);if(Object.hasOwn(input,'expected_revision')&&input.expected_revision!==config.revision)fail('connector_revision_conflict');
  const beforeRequest=()=>{this.authorize(ctx,actor,id);if(this.configuration(ctx,id).fingerprint!==config.fingerprint)fail('connector_sync_configuration_changed');};
  const payload=await this.fetchPage(ctx,id,config,beforeRequest);this.authorize(ctx,actor,id);
  if(this.configuration(ctx,id).fingerprint!==config.fingerprint)fail('connector_sync_configuration_changed');
  const list=pageItems(payload),unique=new Map();
  for(const original of list){const item=this.sanitize(original),contentHash=hash(item),rawId=item.external_id??item.id??item.resource_name,external=typeof rawId==='string'&&rawId||Number.isSafeInteger(rawId)?String(rawId):'content:'+contentHash,identity='source-observation:'+hash([id,external]);const old=unique.get(identity);if(old&&old.contentHash!==contentHash)fail('connector_sync_ambiguous_identity',422);unique.set(identity,{item,external,contentHash});}
  // Recheck before the synchronous commit, including any receipt accepted by a
  // parallel caller. A provider response never authorizes a customer mutation.
  this.authorize(ctx,actor,id);const replay=this.receipt(ctx,actor,id,key,fingerprint);if(replay)return replay;
  const rows=this.adapter.bucket(ctx,'data'),receipts=this.adapter.bucket(ctx,RECEIPTS),at=this.now(),prepared=[];let created=0,updated=0,unchanged=0;
  for(const [identity,{item,external,contentHash}]of unique){const index=rows.findIndex(row=>row.connector_id===id&&row.external_id===identity),old=index<0?null:rows[index];if(old&&old.entity_type!=='connector_source_observation')fail('connector_sync_source_identity_conflict');if(!old)created++;else if(old.source_payload_hash===contentHash)unchanged++;else updated++;
   prepared.push({index,row:{id:identity,external_id:identity,tenant_id:ctx.tenant_id,dealer_id:ctx.dealer_id,provider:id,connector_id:id,_source:id,entity_type:'connector_source_observation',source_external_id:external,source_payload:clone(item),source_payload_hash:contentHash,name:typeof item.name==='string'?item.name:external,created_at:old?.created_at||at,updated_at:at,ingested_at:at,provenance:{source_id:id,source_kind:'external_provider',method:'bounded_provider_api_import',provider_verified:true,authority:'PROVIDER_RESPONSE_NOT_CUSTOMER_TRUTH',observed_at:null,fetched_at:at,ingested_at:at,secret_redaction_applied:true}}});
  }
  if(rows.length+created>this.capacity||receipts.length>=200000)fail('connector_sync_storage_capacity',507);
  const result={ok:true,id,request_id:key,proof_id:hash([ctx.tenant_id,ctx.dealer_id,actor.id,id,key]),configuration_revision:config.revision,ingested:unique.size,received:list.length,duplicate_items:list.length-unique.size,created,updated,unchanged,target:'data',source_class:'EXTERNAL_PROVIDER_OBSERVATIONS',source_complete:false,customer_objects_changed:false,observed_at:at};
  return scopedMutation(this.adapter,ctx,['data',RECEIPTS,'platform:audit','activity:system'],()=>{
   for(const {index,row}of prepared){if(index<0)rows.push(row);else rows[index]=row;}
   receipts.push({actor_id:actor.id,connector_id:id,request_id:key,request_fingerprint:fingerprint,configuration_fingerprint:config.fingerprint,result:clone(result)});
   this.adapter.audit(ctx,actor,'CONNECTOR_SOURCE_IMPORTED','connector_source_observation',result.proof_id,{connector_id:id,ingested:result.ingested,created,updated,unchanged,customer_objects_changed:false});this.adapter.activity(ctx,{connector:id,ingested:result.ingested,target:'data',proof_id:result.proof_id,source_complete:false,customer_objects_changed:false});return result;
  });
 }
 latest(ctx,id){const row=this.adapter.bucket(ctx,RECEIPTS).findLast(row=>row.connector_id===id);if(!row||row.configuration_fingerprint!==this.configuration(ctx,id).fingerprint)return null;return {observed_at:row.result.observed_at,ingested:row.result.ingested,proof_id:row.result.proof_id};}
}
module.exports={ConnectorSourceSync,RECEIPTS,readPayload,hash,pageItems};
