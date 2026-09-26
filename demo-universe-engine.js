'use strict';
const L=require('./demo-universe-law'),Automotive=require('./automotive-demo-universe'),{scopedMutation}=require('./scoped-mutation'),{canManage}=require('./capability-resolver'),{ENTITY_CAPABILITIES}=require('./module-access-contracts');
const SCOPE='demo:universes',AUDIT='demo:universe-audit',MANIFESTS='demo:manifests';
const clone=value=>JSON.parse(JSON.stringify(value)),fail=(code,statusCode=422)=>{throw Object.assign(Error(code),{code,statusCode});};
const keys=(v,names)=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!names.includes(k)))fail('demo_request_invalid');};
function hasBusinessData(ctx,stores){
  const prefix=ctx.tenant_id+':'+ctx.dealer_id+':',metadata=/^(?:identity:|composition:|demo:|platform:audit$|platform:migrations$|finance:migrations$|finance:audit_events$)/;
  for(const [kind,store] of Object.entries(stores))for(const [name,value] of store){
    if(!name.startsWith(prefix)||value===null||Array.isArray(value)&&!value.length)continue;
    if(kind==='records'&&metadata.test(name.slice(prefix.length)))continue;
    return true;
  }
  return false;
}
class DemoUniverseEngine{
  constructor({adapter,resolver,crm,domains,identities,memory,build=Automotive.build}){Object.assign(this,{adapter,resolver,crm,domains,identities,memory,build});this.cache=new Map();}
  authorize(ctx,actor){
    if(!ctx||!actor?.id||!canManage(actor))fail('demo_manage_forbidden',403);
    // This flag selects an explicitly isolated synthetic tenant. It conveys no
    // native module/identity/object permissions and does not grant any roles.
    if(this.adapter.isDemoScope?.(ctx)!==true)fail('demo_isolated_scope_required',403);
    const profile=this.resolver.profile(ctx);if(!profile)fail('demo_composition_required',409);return profile;
  }
  rows(ctx){return this.adapter.bucket(ctx,SCOPE);}
  manifest(options){const key=L.hash(options);if(!this.cache.has(key)){const m=this.build(options);L.validate(m);if(this.cache.size>=4)this.cache.delete(this.cache.keys().next().value);this.cache.set(key,m);}return this.cache.get(key);}
  reservedManifest(ctx,row){
    const retained=this.adapter.bucket(ctx,MANIFESTS).find(m=>m.fingerprint===row.plan_fingerprint);
    // Legacy reservations can only recover with their exact original generator.
    // New reservations retain the complete confirmed graph across upgrades.
    const manifest=retained||this.manifest(row.options);L.validate(manifest);
    if(manifest.fingerprint!==row.plan_fingerprint||manifest.nodes.length!==row.node_count)fail('demo_reserved_manifest_changed',409);
    return manifest;
  }
  options(input){const options={seed:input.seed,as_of:input.as_of,vehicle_count:input.vehicle_count??200,history_months:input.history_months??18};if(typeof options.as_of!=='string'||Date.parse(options.as_of)>(this.adapter.now?.()||new Date()).getTime())fail('demo_future_reference_time');return options;}
  preview(ctx,actor,input){keys(input,['seed','as_of','vehicle_count','history_months']);const profile=this.authorize(ctx,actor),options=this.options(input),m=this.manifest(options),proof=L.validate(m);return {schema_version:L.VERSION,request_context:{tenant_id:ctx.tenant_id,dealer_id:ctx.dealer_id,actor_id:actor.id},options,plan_fingerprint:m.fingerprint,profile_revision:profile.revision,industry_id:m.industry_id,counts:proof.counts,node_count:proof.node_count,classification:'SYNTHETIC_DEMO',native_permissions_required:true,external_effects:false,full_acceptance:false};}
  start(ctx,actor,input,requestId){
    keys(input,['seed','as_of','vehicle_count','history_months','plan_fingerprint','expected_profile_revision','confirm','reason']);const profile=this.authorize(ctx,actor);
    if(typeof requestId!=='string'||!/^[A-Za-z0-9_.:-]{8,160}$/.test(requestId)||input.confirm!==true||typeof input.reason!=='string'||!input.reason.trim()||input.reason.length>1000)fail('demo_confirmation_required');
    const options=this.options(input),m=this.manifest(options);if(profile.industry_id!==m.industry_id||input.expected_profile_revision!==profile.revision||input.plan_fingerprint!==m.fingerprint)fail('demo_plan_changed',409);
    const requestHash=L.hash({actor_id:actor.id,input}),prior=this.rows(ctx).find(r=>r.request_id===requestId);
    if(prior){if(prior.owner_id!==actor.id||prior.request_hash!==requestHash)fail('demo_request_conflict',409);return this.get(ctx,actor,prior.id);}
    if(this.rows(ctx).length)fail('demo_universe_already_reserved',409);
    if(this.adapter.hasBusinessData?.(ctx)!==false)fail('demo_empty_tenant_required',409);
    const row={id:'demo-'+L.hash([ctx.tenant_id,ctx.dealer_id,actor.id,requestId]).slice(0,32),tenant_id:ctx.tenant_id,dealer_id:ctx.dealer_id,owner_id:actor.id,request_id:requestId,request_hash:requestHash,options,plan_fingerprint:m.fingerprint,classification:'SYNTHETIC_DEMO',cursor:0,node_count:m.nodes.length,status:'READY',revision:1,bindings:{},created_at:(this.adapter.now?.()||new Date()).toISOString(),last_error:null};
    scopedMutation(this.adapter,ctx,[SCOPE,AUDIT,MANIFESTS],()=>{this.adapter.bucket(ctx,MANIFESTS).push(clone(m));this.rows(ctx).push(row);this.audit(ctx,actor,row,'START',{reason:input.reason.trim()});});return this.get(ctx,actor,row.id);
  }
  owned(ctx,actor,id){this.authorize(ctx,actor);const row=this.rows(ctx).find(r=>r.id===id&&r.tenant_id===ctx.tenant_id&&r.dealer_id===ctx.dealer_id&&r.owner_id===actor.id);if(!row)fail('demo_universe_missing',404);return row;}
  audit(ctx,actor,row,operation,details){this.adapter.bucket(ctx,AUDIT).push({universe_id:row.id,actor_id:actor.id,operation,revision:row.revision,at:(this.adapter.now?.()||new Date()).toISOString(),...details});}
  get(ctx,actor,id){const row=this.owned(ctx,actor,id);return {id:row.id,request_context:{tenant_id:ctx.tenant_id,dealer_id:ctx.dealer_id,actor_id:actor.id},plan_fingerprint:row.plan_fingerprint,options:clone(row.options),status:row.status,revision:row.revision,applied_nodes:row.cursor,total_nodes:row.node_count,last_error:row.last_error,classification:'SYNTHETIC_DEMO',native_data_currently_verified:false,full_acceptance:false,external_effects:false};}
  access(ctx,actor,node,operation){
    if(['identity.invite','memory.create'].includes(node.contract))return;
    this.resolver.assertModule(ctx,actor,node.module,operation);const cap=ENTITY_CAPABILITIES[node.module]?.[node.entity];if(!cap)fail('demo_contract_unavailable');this.resolver.assertCapability(ctx,actor,cap,operation);
  }
  read(ctx,actor,node,id){
    this.access(ctx,actor,node,'read');
    if(node.contract==='crm.create')return this.crm.get(ctx,actor,node.entity,id);
    if(node.contract==='domain.create')return this.domains[node.module].get(ctx,actor,node.entity,id);
    if(node.contract==='identity.invite'){const row=this.identities.list(ctx,actor).items.find(r=>r.id===id);if(!row)fail('demo_native_record_missing',404);return row;}
    if(node.contract==='memory.create')return this.memory.get(ctx,actor,id);
    fail('demo_contract_unavailable');
  }
  write(ctx,actor,node,input,key){
    this.access(ctx,actor,node,'write');
    if(node.contract==='crm.create')return this.crm.create(ctx,actor,node.entity,{...input,provenance:clone(node.provenance)},{idempotencyKey:key});
    if(node.contract==='domain.create')return this.domains[node.module].save(ctx,actor,node.entity,input,{idempotency_key:key,provenance_classification:'SYNTHETIC_DEMO'}).record;
    if(node.contract==='identity.invite')return this.identities.invite(ctx,actor,input,key).member;
    if(node.contract==='memory.create')return this.memory.create(ctx,actor,input,{idempotencyKey:key});
    fail('demo_contract_unavailable');
  }
  advance(ctx,actor,id,input){
    keys(input,['expected_cursor','expected_profile_revision','limit','confirm','reason']);let row=this.owned(ctx,actor,id);const profile=this.authorize(ctx,actor),m=this.reservedManifest(ctx,row);
    if(input.confirm!==true||typeof input.reason!=='string'||!input.reason.trim()||input.reason.length>1000||!Number.isSafeInteger(input.limit)||input.limit<1||input.limit>100)fail('demo_confirmation_required');
    if(input.expected_cursor!==row.cursor||input.expected_profile_revision!==profile.revision||profile.industry_id!==m.industry_id||m.fingerprint!==row.plan_fingerprint)fail('demo_plan_changed',409);
    const nodeMap=new Map(m.nodes.map(n=>[n.id,n])),end=Math.min(row.cursor+input.limit,m.nodes.length),bindings=clone(row.bindings),applied=[];let cursor=row.cursor;
    for(;cursor<end;){
      const node=m.nodes[cursor];
      try{
        this.authorize(ctx,actor);
        for(const ref of node.depends_on){const binding=bindings[ref];if(!binding)fail('demo_dependency_not_applied',409);const actual=this.read(ctx,actor,nodeMap.get(ref),binding.id);if(actual.revision!==binding.revision||L.hash(actual)!==binding.record_hash)fail('demo_dependency_changed',409);}
        const nativeInput=L.resolveInput(node.input,bindings),key='demo:'+L.hash([row.id,node.id]).slice(0,48),result=this.write(ctx,actor,node,nativeInput,key),record=this.read(ctx,actor,node,result.id);
        if(!record?.id||!Number.isSafeInteger(record.revision)||record.revision<1)fail('demo_native_ack_invalid',502);if(record.revision!==result.revision)fail('demo_native_source_changed',409);
        const binding={id:record.id,revision:record.revision,record_hash:L.hash(record),module:node.module,entity:node.entity,input_hash:L.hash(nativeInput)};
        bindings[node.id]=binding;cursor++;applied.push({node_id:node.id,native_id:record.id,native_revision:record.revision});
      }catch(error){
        // A native effect may already be durable when receipt persistence fails.
        // The next explicit attempt uses exactly the same native request key.
        // Never persist a guessed NOT_APPLIED or advance past an uncertain step.
        throw error;
      }
    }
    if(applied.length)scopedMutation(this.adapter,ctx,[SCOPE,AUDIT],()=>{row.bindings=bindings;row.cursor=cursor;row.revision++;row.status=cursor===m.nodes.length?'SEEDED':'SEEDING';row.last_error=null;for(const item of applied)this.audit(ctx,actor,row,'APPLIED',item);});
    return this.get(ctx,actor,id);
  }
}
module.exports={DemoUniverseEngine,SCOPE,AUDIT,MANIFESTS,hasBusinessData};
