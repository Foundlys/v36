'use strict';
const crypto=require('node:crypto');
const C=require('./contracts');
const {scopedMutation}=require('../scoped-mutation');
const BUCKET='zero:stack-evidence';
const KINDS=['SYSTEM','API','SCHEMA','OBJECT','IDENTITY','ROLE','PERMISSION','CONNECTOR','INTEGRATION','EVENT','WORKFLOW','DEPENDENCY','SOURCE_OF_TRUTH','SYNC_DIRECTION','BUSINESS_PROCESS','RISK','TECHNICAL_DEBT'];

class StackDiscovery{
  constructor({adapter,observe,now=()=>new Date()}){this.adapter=adapter;this.observe=observe;this.now=now;}
  declare(ctx,actor,input){
    C.scope(ctx,actor);C.permit(actor,'connectors:manage');
    C.keys(input,['kind','subject','predicate','value','source_reference','observed_at','expires_at','confirm','reason']);
    if(input.confirm!==true)C.fail('zero_stack_confirmation_required',422);
    if(!KINDS.includes(input.kind))C.fail('zero_stack_kind_invalid');
    const subject=C.identifier(input.subject),predicate=C.identifier(input.predicate),reason=C.string(input.reason,500);
    if(!['string','number','boolean','object'].includes(typeof input.value)||input.value===null||Buffer.byteLength(JSON.stringify(input.value))>12000)C.fail('zero_stack_value_invalid');
    // Customer declarations are evidence of what the customer confirmed, not a
    // claim that a provider API, schema or production connection was verified.
    const source=C.string(input.source_reference,1000),at=this.now().toISOString();
    if(/(?:password|token|secret|api[_-]?key)\s*[=:]/i.test(JSON.stringify(input)))C.fail('zero_stack_secret_forbidden');
    const observed=C.date(input.observed_at,at),expires=C.date(input.expires_at,new Date(this.now().getTime()+30*86400000).toISOString());
    if(observed>at||expires<=at||Date.parse(expires)-this.now().getTime()>365*86400000)C.fail('zero_stack_date_invalid');
    const row={id:crypto.randomUUID(),...C.scope(ctx,actor),kind:input.kind,subject,predicate,value:C.clone(input.value),
      evidence_state:'CUSTOMER_CONFIRMED',source_reference:source,observed_at:observed,expires_at:expires,
      recorded_at:at,reason,confirmed_by:actor.id,provider_verified:false,untrusted_data:true};
    const rows=this.adapter.bucket(ctx,BUCKET);if(rows.filter(x=>C.sameScope(x,ctx)&&x.owner_id===actor.id).length>=2000)C.fail('zero_stack_capacity',429);
    return scopedMutation(this.adapter,ctx,[BUCKET],()=>{rows.push(row);return C.clone(row);});
  }
  snapshot(ctx,actor){
    C.scope(ctx,actor);C.permit(actor,'platform:read');const at=this.now().toISOString();
    const native=this.observe(ctx,actor),facts=[],uncertainties=[],risks=[];
    if(native?.then)C.fail('zero_stack_async_observation_unsupported');
    for(const row of native.facts||[]){
      if(!C.sameScope(row,ctx))continue;
      if(!['PROVEN','CUSTOMER_CONFIRMED','INFERRED','UNKNOWN','BLOCKED'].includes(row.evidence_state))C.fail('zero_stack_evidence_invalid');
      if(row.evidence_state==='PROVEN'&&!row.source_reference)C.fail('zero_stack_provenance_required');
      facts.push(C.clone(row));
    }
    // Saved declarations are private to their submitting operator. Sharing a
    // topology requires an explicit later governance contract, not admin leakage.
    const canReadDeclarations=require('../core-access-contracts').coreAllowed(actor,'connectors:manage');
    for(const row of this.adapter.bucket(ctx,BUCKET))if(canReadDeclarations&&C.sameScope(row,ctx)&&row.owner_id===actor.id){
      const stale=row.expires_at<=at;
      facts.push({...C.clone(row),evidence_state:stale?'UNKNOWN':row.evidence_state,freshness:stale?'STALE':'WITHIN_VALIDITY'});
      if(stale)uncertainties.push({subject:row.subject,reason:'STALE_METADATA',evidence_id:row.id,action:'RECONFIRM_SOURCE'});
    }
    for(const row of facts){
      if(['UNKNOWN','BLOCKED','INFERRED'].includes(row.evidence_state))uncertainties.push({subject:row.subject,reason:row.reason||row.evidence_state,evidence_id:row.id||null,action:'VERIFY_AUTHORIZED_SOURCE'});
      if(row.evidence_state==='BLOCKED')risks.push({subject:row.subject,severity:'HIGH',reason:row.reason||'DISCOVERY_BLOCKED',automatic_resolution:false});
    }
    const groups=new Map();for(const row of facts){
      if(['UNKNOWN','BLOCKED'].includes(row.evidence_state))continue;
      const key=row.kind+'\u001f'+row.subject.normalize('NFKC').toLowerCase()+'\u001f'+row.predicate;
      if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);
    }
    const conflicts=[...groups.values()].filter(rows=>new Set(rows.map(x=>C.hash(x.value))).size>1)
      .map(rows=>({subject:rows[0].subject,predicate:rows[0].predicate,kind:rows[0].kind,
        evidence_ids:rows.map(x=>x.id),state:'HUMAN_REQUIRED',automatic_resolution:false,
        risk:rows[0].kind==='SOURCE_OF_TRUTH'?'CONFLICTING_AUTHORITY':'CONFLICTING_METADATA'}));
    return{ok:true,schema_version:'foundly-stack-discovery/1.0.0',tenant_id:ctx.tenant_id,dealer_id:ctx.dealer_id,
      observed_at:at,read_only:true,facts,conflicts,uncertainties,risks,
      known:facts.filter(x=>['PROVEN','CUSTOMER_CONFIRMED'].includes(x.evidence_state)).map(x=>x.id),
      can_resolve_automatically:[],human_required:conflicts.length>0||risks.length>0,
      completeness:'PARTIAL_AUTHORIZED_OBSERVATIONS',discovery_does_not_authorize_execution:true,
      digital_twin:'RUN_3_PERSISTENT_TWIN_NOT_CLAIMED'};
  }
}
function nativeFacts(ctx,actor,{resolution,connectors=[],now=new Date().toISOString()}){
  const facts=[],add=(kind,subject,predicate,value,state='PROVEN',extra={})=>facts.push({id:C.hash([kind,subject,predicate,value]).slice(0,32),...C.scope(ctx,actor),
    kind,subject,predicate,value,evidence_state:state,source_reference:'FOUNDLY_CURRENT_AUTHORIZED_RUNTIME',observed_at:now,...extra});
  add('SYSTEM','foundly','composition_revision',resolution.revision);
  for(const module of resolution.visible_modules)add('SYSTEM','foundly:'+module,'enabled',true);
  for(const capability of resolution.capabilities)add('PERMISSION','foundly:'+actor.id,'capability:'+capability,true);
  for(const role of actor.roles||[])add('ROLE','foundly:'+actor.id,'role:'+role,true);
  for(const connector of connectors){
    add('CONNECTOR',connector.id,'configuration_present',true);
    add('SYSTEM',connector.id,'connection_verified',null,'UNKNOWN',{reason:'CREDENTIAL_PRESENCE_IS_NOT_CONNECTION_PROOF'});
    if(connector.expired)add('CONNECTOR',connector.id,'authorization',null,'BLOCKED',{reason:'EXPIRED_AUTHORIZATION'});
    for(const predicate of ['schemas','webhook_behavior','source_of_truth','sync_direction'])add('SYSTEM',connector.id,predicate,null,'UNKNOWN',{reason:'NO_CURRENT_AUTHORIZED_PROVIDER_OBSERVATION'});
  }
  return{facts};
}
module.exports={StackDiscovery,nativeFacts,KINDS};
