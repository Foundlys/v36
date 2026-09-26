'use strict';
const crypto = require('node:crypto');
const {scopedMutation} = require('../scoped-mutation');
const C = require('./contracts');
const RECORDS='zero:memories', AUDIT='zero:memory-audit';
const DAY=86400000;
const TTL={SESSION:DAY,TASK:30*DAY,USER:365*DAY,ORGANIZATION:90*DAY,WORKFLOW:30*DAY,SEMANTIC:90*DAY,INDUSTRY:90*DAY,OUTCOME:365*DAY};
const words = text => new Set(String(text||'').normalize('NFKC').toLocaleLowerCase().match(/[\p{L}\p{N}]{2,}/gu)||[]);

class ZeroMemory {
  constructor(adapter) {
    this.adapter=adapter;this.now=adapter.now||(()=>new Date());this.id=adapter.id||(()=>crypto.randomUUID());
  }
  bucket(ctx) { return this.adapter.bucket(ctx,RECORDS); }
  authorize(ctx,actor,row,write=false) {
    C.scope(ctx,actor);
    if(!C.sameScope(row,ctx))return false;
    if(C.PRIVATE_LAYERS.has(row.layer)&&row.owner_id!==actor.id)return false;
    if(write&&row.owner_id!==actor.id)return false;
    if(!C.PRIVATE_LAYERS.has(row.layer)){
      try{C.permit(actor,write?'knowledge:write':'knowledge:read');}catch(e){if(e.statusCode===403)return false;throw e;}
      if(row.roles?.length&&!row.roles.some(role=>(actor.roles||[]).includes(role)))return false;
    }
    if(row.capabilities?.length&&!this.adapter.authorizeCapabilities)return false;
    if(row.capabilities?.length&&!this.adapter.authorizeCapabilities(ctx,actor,row.capabilities,write?'write':'read'))return false;
    if(row.source_ref&&!this.adapter.sourceVisible?.(ctx,actor,row.source_ref))return false;
    return true;
  }
  audit(ctx,actor,operation,row) {
    const rows=this.adapter.bucket(ctx,AUDIT);
    rows.push({id:this.id(),...C.scope(ctx,actor),operation,memory_id:row.id,revision:row.revision,at:this.now().toISOString()});
    if(rows.length>2000)rows.splice(0,rows.length-2000);
  }
  create(ctx,actor,input) {
    const identity=C.scope(ctx,actor);
    C.keys(input,['layer','key','text','confidence','expires_at','effective_from','effective_until','roles','capabilities','sensitivity','session_id','task_id','workflow_id','supersedes','expected_revision']);
    const layer=String(input.layer||'').toUpperCase();
    if(!C.LAYERS.includes(layer))C.fail('zero_memory_layer_invalid');
    if(!C.PRIVATE_LAYERS.has(layer))C.permit(actor,'knowledge:write');
    const key=C.identifier(input.key), raw=C.string(input.text,12000);
    const text=this.adapter.redact?this.adapter.redact(raw):raw;
    const confidence=input.confidence===undefined?null:input.confidence;
    if(confidence!==null&&(typeof confidence!=='number'||!Number.isFinite(confidence)||confidence<0||confidence>1))C.fail('zero_confidence_invalid');
    const now=this.now(), at=now.toISOString(), expires=C.date(input.expires_at,new Date(now.getTime()+TTL[layer]).toISOString());
    const from=C.date(input.effective_from,at), until=C.date(input.effective_until);
    if(expires<=at||Date.parse(expires)-now.getTime()>TTL[layer]||until&&until<=from)C.fail('zero_memory_retention_invalid');
    const roles=input.roles===undefined?(C.PRIVATE_LAYERS.has(layer)?[]:[...identity.roles]):input.roles;
    if(!Array.isArray(roles)||roles.length>20||roles.some(x=>typeof x!=='string'||!/^[A-Z_]{2,40}$/.test(x)))C.fail('zero_memory_roles_invalid');
    if(!C.PRIVATE_LAYERS.has(layer)&&roles.length===0)C.fail('zero_memory_roles_required');
    const capabilities=input.capabilities||[];
    if(!Array.isArray(capabilities)||capabilities.length>30||capabilities.some(x=>typeof x!=='string'||x.length>120))C.fail('zero_memory_capabilities_invalid');
    const sensitivity=input.sensitivity||'INTERNAL';if(!['INTERNAL','CONFIDENTIAL','RESTRICTED'].includes(sensitivity))C.fail('zero_memory_sensitivity_invalid');
    const references={};
    for(const [field,required] of [['session_id','SESSION'],['task_id','TASK'],['workflow_id','WORKFLOW']]){
      if(input[field]!==undefined)references[field]=C.identifier(input[field]);
      if(layer===required&&!references[field])C.fail('zero_memory_reference_required');
    }
    const row={id:this.id(),...identity,roles:[...new Set(roles)],layer,key,text,confidence,sensitivity,capabilities:[...new Set(capabilities)],...references,
      created_at:at,updated_at:at,effective_from:from,effective_until:until,expires_at:expires,
      revision:1,status:'ACTIVE',supersedes:input.supersedes||null,superseded_by:null,
      provenance:{source_class:'USER_ASSERTED',method:'EXPLICIT_USER_WRITE',author_id:actor.id,observed_at:at,verified:false},
      authority:'REMEMBERED_ASSERTION_NOT_CUSTOMER_TRUTH'};
    if(!this.authorize(ctx,actor,row,true))C.fail('zero_memory_forbidden',403);
    let previous;
    if(input.supersedes){
      previous=this.bucket(ctx).find(x=>x.id===input.supersedes&&this.authorize(ctx,actor,x,true));
      if(!previous)C.fail('zero_memory_missing',404);
      if(previous.status!=='ACTIVE'||previous.revision!==input.expected_revision||previous.layer!==layer||previous.key!==key)C.fail('zero_memory_revision_conflict',409);
      if(JSON.stringify([previous.roles,previous.capabilities,previous.sensitivity,previous.session_id,previous.task_id,previous.workflow_id])!==JSON.stringify([row.roles,row.capabilities,row.sensitivity,row.session_id,row.task_id,row.workflow_id]))C.fail('zero_memory_scope_change_forbidden',409);
      row.revision=previous.revision+1;
    }
    if(this.bucket(ctx).filter(x=>C.sameScope(x,ctx)&&x.owner_id===actor.id&&x.status==='ACTIVE').length>=1000)C.fail('zero_memory_capacity',429);
    return scopedMutation(this.adapter,ctx,[RECORDS,AUDIT],()=>{
      if(previous){previous.status='SUPERSEDED';previous.superseded_by=row.id;previous.effective_until=at;}
      this.bucket(ctx).push(row);this.audit(ctx,actor,'CREATE',row);return C.clone(row);
    });
  }
  search(ctx,actor,query={}) {
    C.scope(ctx,actor);C.keys(query,['q','layers','session_id','task_id','workflow_id','limit','include_stale']);
    const needle=words(query.q), now=this.now().toISOString();
    if(query.q!==undefined)C.string(query.q,1000,false);
    if(query.layers&&(!Array.isArray(query.layers)||query.layers.some(x=>!C.LAYERS.includes(x))))C.fail('zero_memory_layer_invalid');
    if(query.include_stale!==undefined&&typeof query.include_stale!=='boolean')C.fail('zero_query_invalid');
    const rows=[];
    for(const row of this.bucket(ctx)){
      // Authorization is checked before matching, ranking, counts or conflicts.
      if(!this.authorize(ctx,actor,row)||row.status!=='ACTIVE'||query.layers&&!query.layers.includes(row.layer))continue;
      if(row.effective_from>now||row.effective_until&&row.effective_until<=now)continue;
      if(['session_id','task_id','workflow_id'].some(field=>row[field]&&row[field]!==query[field]))continue;
      const stale=row.expires_at<=now;
      if(stale&&!query.include_stale)continue;
      const hay=words(row.key+' '+row.text),matches=[...needle].filter(word=>hay.has(word)).length;
      if(needle.size&&!matches)continue;
      rows.push({...C.clone(row),freshness:stale?'STALE':'WITHIN_RETENTION',relevance:needle.size?matches/needle.size:1});
    }
    rows.sort((a,b)=>b.relevance-a.relevance||b.updated_at.localeCompare(a.updated_at)||a.id.localeCompare(b.id));
    const groups=new Map();for(const row of rows){const key=row.key.toLocaleLowerCase();if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);}
    const conflicts=[...groups].filter(([,rs])=>new Set(rs.map(r=>r.text.normalize('NFKC').toLowerCase())).size>1)
      .map(([key,rs])=>({key,memory_ids:rs.map(r=>r.id),state:'UNRESOLVED',automatic_resolution:false}));
    const limit=Math.max(1,Math.min(100,Number(query.limit)||30));
    return {items:rows.slice(0,limit),total:rows.length,conflicts,at:now,permission_filtered:true,tenant_filtered:true,
      retrieval:{lexical:true,semantic:false},remembered_facts_are_authoritative:false};
  }
  remove(ctx,actor,id,input) {
    C.scope(ctx,actor);C.keys(input,['expected_revision']);
    const row=this.bucket(ctx).find(x=>x.id===id&&this.authorize(ctx,actor,x,true));
    if(!row)C.fail('zero_memory_missing',404);
    if(row.revision!==input.expected_revision)C.fail('zero_memory_revision_conflict',409);
    const chain=new Set([row.id]);let changed=true;
    while(changed){changed=false;for(const r of this.bucket(ctx))if(this.authorize(ctx,actor,r,true)&&(chain.has(r.supersedes)||chain.has(r.superseded_by))&&!chain.has(r.id)){chain.add(r.id);changed=true;}}
    return scopedMutation(this.adapter,ctx,[RECORDS,AUDIT],()=>{
      for(const r of this.bucket(ctx))if(chain.has(r.id)){delete r.text;delete r.key;delete r.provenance;r.status='DELETED';r.deleted_at=this.now().toISOString();}
      this.audit(ctx,actor,'DELETE',row);return {deleted:true,versions_removed:chain.size};
    });
  }
}
module.exports={ZeroMemory,words,RECORDS,AUDIT};
