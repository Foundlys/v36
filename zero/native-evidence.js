'use strict';
const C=require('./contracts');
const MAX_BYTES=7000;
// Keep business dates/revisions/amounts significant. Only the native read's
// observation timestamps change between otherwise identical source reads.
function stable(value){if(Array.isArray(value))return value.map(stable);if(!value||typeof value!=='object')return value;return Object.fromEntries(Object.entries(value).filter(([k])=>k!=='observed_at').map(([k,v])=>[k,stable(v)]));}
const ROWS=new Set(['items','workflows','runs','activity_feed','stalled_deals','campaigns','pipeline_stages','lead_trend','source_performance','owner_performance','excluded_sources','issues','trial_balance']);
const pointer=parts=>'/'+parts.map(s=>String(s).replaceAll('~','~0').replaceAll('/','~1')).join('/');
const bytes=value=>Buffer.byteLength(JSON.stringify(value));

// This is a source projection, never a model summary. Whole rows and fields
// are kept or withheld; text, negations, monetary units and record IDs are not
// cut. The full authorized response stays bound by its hash, including rows
// omitted from the model input. Native pagination remains independently visible.
function project(source,sourceClass){
 C.object(source);
 const result=C.clone(source),meta={schema_version:1,source_class:sourceClass,source_snapshot_hash:C.hash(stable(source)),max_bytes:MAX_BYTES,representation:'COMPLETE_NATIVE_RESPONSE',native_response_may_be_paginated:true,omitted:[]};
 result.zero_evidence_projection=meta;
 if(bytes(result)<=MAX_BYTES)return result;
 meta.representation='BOUNDED_NATIVE_RESPONSE';
 const samples=[];
 function strip(value,path=[]){
  if(!value||typeof value!=='object'||Array.isArray(value))return;
  for(const [key,item]of Object.entries(value)){
   if(key==='zero_evidence_projection')continue;
   const parts=[...path,key];
   if(Array.isArray(item)&&ROWS.has(key)&&item.length){
    const omission={path:pointer(parts),reason:'CONTEXT_BUDGET',native_returned_records:item.length,retained_records:0};
    meta.omitted.push(omission);value[key]=[];samples.push({parent:value,key,items:item,omission,top:parts[0]});
   }else strip(item,parts);
  }
 }
 strip(result);
 // Many currency groups or unusually large nested aggregates can exceed the
 // budget even with no detail rows. Withhold a whole field explicitly instead
 // of silently truncating a currency group or inventing a smaller total.
 const removed=new Set();
 for(const key of Object.keys(result).filter(k=>k!=='zero_evidence_projection').sort((a,b)=>bytes(result[b])-bytes(result[a]))){
  if(bytes(result)<=MAX_BYTES)break;
  delete result[key];removed.add(key);
  const path=pointer([key]);meta.omitted=meta.omitted.filter(x=>x.path!==path&&!x.path.startsWith(path+'/'));
  meta.omitted.push({path,reason:'CONTEXT_BUDGET',whole_field_withheld:true});
 }
 const eligible=samples.filter(s=>!removed.has(s.top));
 // A bounded, deterministic prefix sample from each available collection.
 // Never skip a large first row and imply the later rows were a full prefix.
 let progressed=true;
 while(progressed){
  progressed=false;
  for(const s of eligible){
   if(s.blocked||s.omission.retained_records===s.items.length)continue;
   const row=s.items[s.omission.retained_records];s.parent[s.key].push(row);s.omission.retained_records++;
   if(bytes(result)>MAX_BYTES){s.parent[s.key].pop();s.omission.retained_records--;s.blocked=true;}
   else progressed=true;
  }
 }
 meta.omitted=meta.omitted.filter(x=>x.whole_field_withheld||x.retained_records<x.native_returned_records);
 if(bytes(result)>MAX_BYTES)C.fail('zero_native_projection_budget',500);
 return result;
}
module.exports={project,stable,MAX_BYTES};
