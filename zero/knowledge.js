'use strict';
const crypto=require('node:crypto');
const C=require('./contracts');
const {scopedMutation}=require('../scoped-mutation');
const {words}=require('./memory');
const BUCKET='zero:knowledge-refresh',AUDIT='zero:knowledge-refresh-audit';
const CATEGORIES=['REGULATION','BUSINESS_RULE','PROVIDER_API','INDUSTRY','TERMINOLOGY','BENCHMARK','OPERATING_PATTERN','DOCUMENTATION'];
class KnowledgeRefresh{
 constructor({adapter,now=()=>new Date()}){this.adapter=adapter;this.now=now;}
 rows(c){return this.adapter.bucket(c,BUCKET);}
 owned(c,a,id){C.scope(c,a);C.permit(a,'knowledge:read');const r=this.rows(c).find(r=>C.sameScope(r,c)&&r.owner_id===a.id&&r.id===id);if(!r)C.fail('zero_knowledge_missing',404);return r;}
 audit(c,a,r,operation,reason){const rows=this.adapter.bucket(c,AUDIT);rows.push({id:crypto.randomUUID(),...C.scope(c,a),knowledge_id:r.id,revision:r.revision,content_hash:r.content_hash,operation,reason,at:this.now().toISOString()});if(rows.length>4000)rows.splice(0,rows.length-4000);}
 stage(c,a,input){
  const identity=C.scope(c,a);C.permit(a,'knowledge:write');C.keys(input,['topic','category','text','sources','jurisdiction','authority','effective_from','effective_until','expires_at','supersedes']);
  const topic=C.identifier(input.topic,200),text=C.string(input.text,12000);if(!CATEGORIES.includes(input.category))C.fail('zero_knowledge_category_invalid');
  if(!Array.isArray(input.sources)||!input.sources.length||input.sources.length>10)C.fail('zero_knowledge_sources_required');
  const at=this.now().toISOString(),sources=input.sources.map(s=>{
   C.keys(s,['url','title','source_type','retrieved_at','published_at']);let url;try{url=new URL(s.url);}catch{C.fail('zero_knowledge_source_invalid');}
   if(!['https:','http:'].includes(url.protocol)||url.username||url.password||url.href.length>2000)C.fail('zero_knowledge_source_invalid');
   if(!['PRIMARY','SECONDARY','CUSTOMER_PROVIDED'].includes(s.source_type))C.fail('zero_knowledge_source_type_invalid');
   const retrieved=C.date(s.retrieved_at),published=C.date(s.published_at);if(!retrieved||retrieved>at||published&&published>at)C.fail('zero_knowledge_source_date_invalid');
   return {url:url.href,title:C.string(s.title,500),source_type:s.source_type,retrieved_at:retrieved,published_at:published,classification_basis:'OPERATOR_DECLARED'};
  });
  const expires=C.date(input.expires_at),from=C.date(input.effective_from),until=C.date(input.effective_until);
  if(!expires||expires<=at||Date.parse(expires)-this.now().getTime()>366*86400000||until&&from&&until<=from)C.fail('zero_knowledge_validity_invalid');
  const data={topic,category:input.category,text,sources,jurisdiction:input.jurisdiction?C.string(input.jurisdiction,120):null,authority:input.authority?C.string(input.authority,300):null,effective_from:from,effective_until:until,expires_at:expires};
  let prior;if(input.supersedes){prior=this.owned(c,a,input.supersedes);if(prior.topic!==topic||prior.category!==input.category)C.fail('zero_knowledge_version_scope',409);}
  if(this.rows(c).filter(r=>r.owner_id===a.id&&C.sameScope(r,c)).length>=500)C.fail('zero_knowledge_capacity',429);
  const row={id:crypto.randomUUID(),...identity,...data,version:prior?prior.version+1:1,revision:1,supersedes:prior?.id||null,state:'QUARANTINED',created_at:at,content_hash:C.hash(data),verification_state:'UNVERIFIED',source_class:'EXTERNAL_REFERENCE',customer_truth:false,executable:false};
  return scopedMutation(this.adapter,c,[BUCKET,AUDIT],()=>{this.rows(c).push(row);this.audit(c,a,row,'STAGE','Explicit evidence submission');return C.clone(row);});
 }
 evaluate(row){
  const gaps=[];
  if(row.category==='REGULATION'){
   for(const field of ['jurisdiction','authority','effective_from'])if(!row[field])gaps.push(field.toUpperCase()+'_MISSING');
   if(!row.sources.some(s=>s.source_type==='PRIMARY'))gaps.push('PRIMARY_AUTHORITY_MISSING');
  }
  if(row.expires_at<=this.now().toISOString())gaps.push('EVIDENCE_EXPIRED');
  if(row.sources.some(s=>Date.parse(s.retrieved_at)<this.now().getTime()-90*86400000))gaps.push('SOURCE_RETRIEVAL_STALE');
  return {passed:gaps.length===0,gaps,method:'METADATA_AND_FRESHNESS_ONLY',factual_accuracy_verified:false};
 }
 transition(c,a,id,input){
  const row=this.owned(c,a,id);C.permit(a,'learning:write');C.keys(input,['operation','expected_revision','content_hash','confirm','reason']);
  if(input.expected_revision!==row.revision||input.content_hash!==row.content_hash)C.fail('zero_knowledge_revision_conflict',409);
  const op=input.operation,reason=C.string(input.reason,1000);if(!['EVALUATE','VERIFY','ACTIVATE','RETIRE','ROLLBACK'].includes(op))C.fail('zero_knowledge_operation_invalid');
  if(op!=='EVALUATE'&&input.confirm!==true)C.fail('zero_knowledge_confirmation_required',422);
  let previous;
  if(op==='EVALUATE'&&row.state!=='QUARANTINED'||op==='VERIFY'&&row.state!=='EVALUATED'||op==='ACTIVATE'&&row.state!=='REVIEWED'||op==='ROLLBACK'&&row.state!=='ACTIVE')C.fail('zero_knowledge_transition_invalid',409);
  const assessment=this.evaluate(row);
  if(['VERIFY','ACTIVATE'].includes(op)&&!assessment.passed)C.fail('zero_knowledge_evidence_incomplete',422);
  if(op==='ROLLBACK'){
   if(!row.supersedes)C.fail('zero_knowledge_rollback_missing',409);previous=this.owned(c,a,row.supersedes);
   if(previous.state!=='SUPERSEDED'||previous.verification_state!=='OPERATOR_ATTESTED'||!this.evaluate(previous).passed)C.fail('zero_knowledge_rollback_unavailable',409);
  }
  return scopedMutation(this.adapter,c,[BUCKET,AUDIT],()=>{
   const at=this.now().toISOString();row.revision++;
   if(op==='EVALUATE'){row.assessment=assessment;row.state=assessment.passed?'EVALUATED':'QUARANTINED';}
   if(op==='VERIFY'){row.state='REVIEWED';row.verification_state='OPERATOR_ATTESTED';row.review={reviewer_id:a.id,at,reason,content_hash:row.content_hash};}
   if(op==='ACTIVATE'){
    for(const other of this.rows(c))if(C.sameScope(other,c)&&other.owner_id===a.id&&other.topic===row.topic&&other.category===row.category&&other.state==='ACTIVE'){
     if(other.id!==row.supersedes)C.fail('zero_knowledge_active_conflict',409);other.state='SUPERSEDED';other.revision++;this.audit(c,a,other,'SUPERSEDE',reason);
    }
    row.state='ACTIVE';row.activated_at=at;
   }
   if(op==='RETIRE'){row.state='RETIRED';row.retired_at=at;}
   if(op==='ROLLBACK'){row.state='ROLLED_BACK';previous.state='ACTIVE';previous.revision++;this.audit(c,a,previous,'RESTORE_PREVIOUS_VERSION',reason);}
   this.audit(c,a,row,op,reason);return C.clone(row);
  });
 }
 list(c,a,{q='',active=false}={}){
  C.scope(c,a);C.permit(a,'knowledge:read');C.string(q,1000,false);const needle=words(q),at=this.now().toISOString();
  const items=this.rows(c).filter(r=>C.sameScope(r,c)&&r.owner_id===a.id).filter(r=>!active||r.state==='ACTIVE'&&r.expires_at>at&&(!r.effective_from||r.effective_from<=at)&&(!r.effective_until||r.effective_until>at)).filter(r=>!needle.size||[...needle].some(w=>words(r.topic+' '+r.text).has(w))).map(r=>({...C.clone(r),freshness:r.expires_at<=at?'STALE':'WITHIN_VALIDITY'}));
  return {items:items.slice(-100),total:items.length,private_to_operator:true,automatic_learning:false,legal_advice:false};
 }
 due(c,a){return this.list(c,a).items.filter(r=>['ACTIVE','REVIEWED'].includes(r.state)&&Date.parse(r.expires_at)-this.now().getTime()<7*86400000).map(r=>({id:r.id,topic:r.topic,category:r.category,due_at:r.expires_at,reason:r.expires_at<=this.now().toISOString()?'EXPIRED':'REVIEW_DUE'}));}
}
module.exports={KnowledgeRefresh,BUCKET,AUDIT,CATEGORIES};
