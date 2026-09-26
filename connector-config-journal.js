'use strict';
const crypto=require('node:crypto');
const fail=(code,statusCode=409)=>{throw Object.assign(new Error(code),{code,statusCode});};
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
function canonical(value){if(Array.isArray(value))return value.map(canonical);if(object(value))return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));return value;}
const digest=value=>crypto.createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
function revision(config){const value=Object.hasOwn(config,'_revision')?config._revision:0;if(!Number.isSafeInteger(value)||value<0)fail('connector_configuration_unreadable',503);return value;}
// A receipt and its configuration are committed in the same encrypted atomic
// file. Deletion keeps a tombstone so a lost-response retry cannot resurrect it.
function create({read,write,lock}){
 function mutate(ctx,id,change){return lock(ctx,id,()=>{const old=read(ctx,id),prior=revision(old);if(prior===Number.MAX_SAFE_INTEGER)fail('connector_revision_exhausted');const next=change(old);next._revision=prior+1;write(ctx,id,next);return next;});}
 function save(ctx,id,actor,input,key){
  if(!object(input))fail('connector_configuration_invalid',400);
  const credentials=input.credentials??{},overrides=input.profile_overrides??{};
  if(!object(credentials)||!object(overrides))fail('connector_configuration_invalid',400);
  if(Object.entries(credentials).some(([name,value])=>!name||['__proto__','prototype','constructor'].includes(name)||typeof value!=='string'||value.length>65536))fail('connector_configuration_invalid',400);
  const guarded=key!==undefined||Object.hasOwn(input,'expected_revision');
  if(guarded&&(!/^[A-Za-z0-9_.:-]{1,160}$/.test(key||'')||!Number.isSafeInteger(input.expected_revision)||input.expected_revision<0))fail('connector_request_invalid',400);
  const fingerprint=digest({credentials,profile_overrides:overrides,expected_revision:input.expected_revision}),receiptKey=guarded?digest([String(actor.id),key]):null;
  return lock(ctx,id,()=>{
   const old=read(ctx,id),prior=revision(old),receipts=Object.hasOwn(old,'_write_receipts')?old._write_receipts:{};
   if(!object(receipts))fail('connector_configuration_unreadable',503);
   if(guarded&&Object.hasOwn(receipts,receiptKey)){const receipt=receipts[receiptKey];if(receipt.fingerprint!==fingerprint)fail('connector_request_conflict');return receipt.result;}
   if(guarded&&input.expected_revision!==prior)fail('connector_revision_conflict');
   if(prior===Number.MAX_SAFE_INTEGER)fail('connector_revision_exhausted');
   // Never evict a receipt and silently re-execute its request later.
   if(guarded&&Object.keys(receipts).length>=1024)fail('connector_receipt_capacity');
   const result={ok:true,id,revision:prior+1,...(guarded?{request_id:key}:{})};
   write(ctx,id,{...old,credentials:{...(old.credentials||{}),...credentials},profile_overrides:{...(old.profile_overrides||{}),...overrides},_revision:prior+1,_write_receipts:{...receipts,...(guarded?{[receiptKey]:{fingerprint,result}}:{})}});
   return result;
  });
 }
 return {save,mutate,remove:(ctx,id)=>mutate(ctx,id,old=>({_write_receipts:old._write_receipts||{}}))};
}
module.exports={create,revision};
