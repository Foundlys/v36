'use strict';
// Exact private proof shares the existing native pipeline transaction and limits.
const crypto=require('node:crypto');
const FIELDS=['request_id','request_fingerprint','operation','source_id','target_id','expected_revision','expected_pipeline_revision'];
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v),id=v=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,99}$/.test(v),key=v=>typeof v==='string'&&v.trim().length>0&&v.length<=200&&!/[\u0000-\u001f\u007f]/.test(v),digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v),integer=v=>Number.isSafeInteger(v)&&v>=0,clone=v=>JSON.parse(JSON.stringify(v)),hash=v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
const fail=(code,message,statusCode=422)=>{throw Object.assign(Error(message),{code,statusCode});};
const context=(ctx,actor)=>({tenant_id:ctx.tenant_id,dealer_id:ctx.dealer_id,actor_id:actor.id}),reference=e=>({request_id:e.key,request_fingerprint:e.fingerprint,...Object.fromEntries(FIELDS.slice(2).map(k=>[k,e[k]]))});
function metadata(kind,sourceId,targetId,input,requestKey){return {request_id:requestKey,request_fingerprint:hash({kind,target:kind==='SAVE'?sourceId:targetId,input}),operation:kind,source_id:sourceId,target_id:targetId,expected_revision:input.expected_revision,expected_pipeline_revision:kind==='MOVE'?input.pipeline_revision:null};}
function capacity(rows,next=null){if(rows.length>=100000||Buffer.byteLength(JSON.stringify(rows.filter(r=>r.request_kind==='SALES_PIPELINE')))+(next?Buffer.byteLength(JSON.stringify(next)):0)>=32*1024*1024)fail('pipeline_operation_capacity','De bewaarlimiet voor bordacties is bereikt',507);}
function scope(domain,ctx,actor,operation){domain.scope(ctx,actor,'write');domain.resolver.assertCapability(ctx,actor,'sales:pipeline',operation==='SAVE'?'write':'read');if(operation==='MOVE')domain.resolver.assertCapability(ctx,actor,'sales:opportunities','write');}
function manage(domain,actor,row){if(row&&row.owner_id!==actor.id&&!domain.visible({owner_id:null},actor))fail('pipeline_manage_forbidden','Geen beheerrecht voor deze pipeline',403);}
function acknowledgement(ctx,actor,e){return {request:reference(e),request_context:context(ctx,actor),result_id:e.record_id,result_revision:e.result_revision,result_snapshot_sha256:e.result_snapshot_sha256,basis_snapshot_sha256:e.basis_snapshot_sha256,external_send:false,source_records_modified:true};}
function store(domain,ctx,actor,meta,source,row,reason){const entry={id:crypto.randomUUID(),request_kind:'SALES_PIPELINE',request_version:1,state:'APPLIED',key:meta.request_id,fingerprint:meta.request_fingerprint,...Object.fromEntries(FIELDS.slice(2).map(k=>[k,meta[k]])),...context(ctx,actor),owner_id:actor.id,kind:meta.operation,target:meta.operation==='SAVE'?meta.source_id:meta.target_id,entity:row.owned_entity,record_id:row.id,source_owner_id:source?.owner_id||actor.id,result_owner_id:row.owner_id,result_revision:row.revision,result_snapshot:clone(row),result_snapshot_sha256:hash(row),basis_snapshot:meta.operation==='MOVE'?clone(source):null,basis_snapshot_sha256:meta.operation==='MOVE'?hash(source):null,reason:reason||null,created_at:new Date().toISOString()},rows=domain.adapter.bucket(ctx,require('./sales-pipeline').OPERATIONS);capacity(rows,entry);rows.push(entry);return acknowledgement(ctx,actor,entry);}
function existing(domain,ctx,actor,meta){if(!key(meta.request_id))fail('pipeline_idempotency_required','Gebruik een unieke actie-ID');const rows=domain.adapter.bucket(ctx,require('./sales-pipeline').OPERATIONS),entry=rows.find(r=>r.key===meta.request_id&&r.actor_id===actor.id);if(entry?.state==='ABANDONED')fail('pipeline_request_abandoned','Deze bordactie is afgesloten zonder uitvoering',409);if(entry&&entry.fingerprint!==meta.request_fingerprint)fail('pipeline_operation_conflict','Deze actie-ID hoort bij andere invoer',409);if(!entry)capacity(rows);return entry;}
function recover(domain,ctx,actor,input){
 const invalid=()=>fail('pipeline_recovery_unverifiable','De eerdere bordactie kan niet worden geverifieerd',409);
 domain.scope(ctx,actor,'write');
 if(!object(input)||Object.keys(input).length!==FIELDS.length+1||Object.keys(input).some(k=>![...FIELDS,'confirm'].includes(k))||input.confirm!==true||!key(input.request_id)||!digest(input.request_fingerprint)||!['SAVE','MOVE'].includes(input.operation)||!integer(input.expected_revision)||(input.operation==='SAVE'?(input.source_id===null?input.expected_revision!==0:!id(input.source_id)||input.expected_revision<1)||input.target_id!==null||input.expected_pipeline_revision!==null:!id(input.source_id)||!id(input.target_id)||input.expected_revision<1||!integer(input.expected_pipeline_revision)||input.expected_pipeline_revision<1))fail('pipeline_recovery_invalid','Bevestig de exacte eerdere bordactie',422);
 scope(domain,ctx,actor,input.operation);
 const rows=domain.adapter.bucket(ctx,require('./sales-pipeline').OPERATIONS),entry=rows.find(e=>e.key===input.request_id&&e.actor_id===actor.id),source=input.source_id===null?null:domain.get(ctx,actor,'pipelines',input.source_id),envelope={...Object.fromEntries(FIELDS.map(k=>[k,input[k]])),request_context:context(ctx,actor),external_send:false,source_records_modified:false},absent=()=>({...envelope,state:'NOT_APPLIED',record:null,result_snapshot:null,result_revision:null,result_snapshot_sha256:null,result_is_current:null,basis_snapshot:null,basis_snapshot_sha256:null,source:null});
 if(input.operation==='SAVE')manage(domain,actor,source);
 const target=input.operation==='MOVE'?domain.get(ctx,actor,'opportunities',input.target_id):null;
 if(entry){
  if(entry.request_kind!=='SALES_PIPELINE'||entry.request_version!==1||!['APPLIED','ABANDONED'].includes(entry.state)||entry.tenant_id!==ctx.tenant_id||entry.dealer_id!==ctx.dealer_id)invalid();
  if(FIELDS.some(k=>reference(entry)[k]!==input[k]))fail('pipeline_operation_conflict','Deze aanvraag hoort bij andere herstelgegevens',409);
  if(source&&source.owner_id!==entry.source_owner_id||entry.state==='ABANDONED'&&target&&target.owner_id!==entry.target_owner_id)fail('pipeline_recovery_owner_changed','Het eigenaarschap van de oorspronkelijke bron is gewijzigd',403);
  if(entry.state==='ABANDONED')return absent();
 }
 if(!entry){
  if(rows.some(e=>e.key===input.request_id&&e.fingerprint===input.request_fingerprint&&e.actor_id!==actor.id))invalid();
  const closure={request_kind:'SALES_PIPELINE',request_version:1,state:'ABANDONED',key:input.request_id,fingerprint:input.request_fingerprint,...Object.fromEntries(FIELDS.slice(2).map(k=>[k,input[k]])),...context(ctx,actor),source_owner_id:source?.owner_id||actor.id,target_owner_id:target?.owner_id||null};capacity(rows,closure);
  return domain.mutate(ctx,()=>{rows.push(closure);domain.adapter.audit(ctx,actor,'PIPELINE_REQUEST_ABANDONED','sales:'+ (input.operation==='SAVE'?'pipelines':'opportunities'),input.target_id||input.source_id,{request_id:input.request_id,operation:input.operation,expected_revision:input.expected_revision});return absent();});
 }
 const nativeRow=(r,entity)=>object(r)&&id(r.id)&&id(r.owner_id)&&r.tenant_id===ctx.tenant_id&&r.dealer_id===ctx.dealer_id&&r.owned_entity===entity&&r.source_module==='sales'&&integer(r.revision)&&r.revision>0&&typeof r.created_at==='string'&&Number.isFinite(Date.parse(r.created_at))&&typeof r.updated_at==='string'&&Number.isFinite(Date.parse(r.updated_at));
 const entity=input.operation==='SAVE'?'pipelines':'opportunities',saved=entry.result_snapshot;
 if(entry.kind!==input.operation||entry.target!==(input.operation==='SAVE'?input.source_id:input.target_id)||entry.entity!==entity||!nativeRow(saved,entity)||saved.id!==entry.record_id||saved.owner_id!==entry.result_owner_id||saved.revision!==entry.result_revision||saved.revision!==input.expected_revision+1||!digest(entry.result_snapshot_sha256)||hash(saved)!==entry.result_snapshot_sha256)invalid();
 const record=domain.get(ctx,actor,entity,entry.record_id);
 if(record.owner_id!==entry.result_owner_id)fail('pipeline_recovery_owner_changed','Het eigenaarschap van het oorspronkelijke resultaat is gewijzigd',403);
 if(!nativeRow(record,entity)||record.revision<saved.revision||record.revision===saved.revision&&hash(record)!==entry.result_snapshot_sha256)invalid();
 if(input.operation==='SAVE'){
  manage(domain,actor,record);
  if(input.source_id!==null&&saved.id!==input.source_id||entry.basis_snapshot!==null||entry.basis_snapshot_sha256!==null)invalid();
 }else{
  const basis=entry.basis_snapshot,stage=basis?.stages?.find(s=>s.id===saved.stage_id);
  if(!nativeRow(basis,'pipelines')||basis.id!==input.source_id||basis.owner_id!==entry.source_owner_id||basis.revision!==input.expected_pipeline_revision||!digest(entry.basis_snapshot_sha256)||hash(basis)!==entry.basis_snapshot_sha256||saved.id!==input.target_id||saved.pipeline_id!==input.source_id||!stage||stage.probability!==saved.probability||!nativeRow(source,'pipelines')||source.revision<basis.revision||source.revision===basis.revision&&hash(source)!==entry.basis_snapshot_sha256)invalid();
  // A newer opportunity can reference a different pipeline; that current link
  // must still be readable before its full native record is returned.
  if(record.pipeline_id&&record.pipeline_id!==input.source_id)domain.get(ctx,actor,'pipelines',record.pipeline_id);
 }
 return {...envelope,state:'APPLIED',record,result_snapshot:clone(saved),result_revision:entry.result_revision,result_snapshot_sha256:entry.result_snapshot_sha256,result_is_current:record.revision===saved.revision,basis_snapshot:clone(entry.basis_snapshot),basis_snapshot_sha256:entry.basis_snapshot_sha256,source};
}
function replay(domain,ctx,actor,meta,entry){const proof=recover(domain,ctx,actor,{...meta,confirm:true});if(!proof.result_is_current)fail('pipeline_result_changed','Het record is na deze actie gewijzigd; laad de actuele toestand',409);return {record:proof.record,request_acknowledgement:acknowledgement(ctx,actor,entry),deduplicated:true,outcome:'APPLIED_INTERNAL'};}
module.exports={context,metadata,existing,store,recover,replay};
