'use strict';
const L=require('./demo-universe-law'),Automotive=require('./automotive-demo-universe'),{scopedMutation}=require('./scoped-mutation'),{canManage}=require('./capability-resolver'),{ENTITY_CAPABILITIES}=require('./module-access-contracts');
const SCOPE='demo:universes',AUDIT='demo:universe-audit',MANIFESTS='demo:manifests',FinanceActions=require('./demo-finance-actions');
const ADVANCE_WORK_BUDGET_MS=1000;
const clone=value=>JSON.parse(JSON.stringify(value)),fail=(code,statusCode=422)=>{throw Object.assign(Error(code),{code,statusCode});};
const keys=(v,names)=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!names.includes(k)))fail('demo_request_invalid');};
function nativeRevision(node,record){
  // These native Finance configuration rows have no revision field. Their
  // entire current record hash remains mandatory; do not invent revision 1.
  if(node.contract==='finance.create'&&['fiscal_periods','accounts'].includes(node.entity)&&record?.revision===undefined)return null;
  if(node.contract==='finance.action'&&node.entity==='payments'&&record?.revision===undefined)return null;
  if(!Number.isSafeInteger(record?.revision)||record.revision<1)fail('demo_native_ack_invalid',502);
  return record.revision;
}
function freezeGraph(root){
  const pending=[root],seen=new WeakSet();
  while(pending.length){const value=pending.pop();if(!value||typeof value!=='object'||seen.has(value))continue;seen.add(value);pending.push(...Object.values(value).filter(v=>v&&typeof v==='object'));Object.freeze(value);}
  return root;
}
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
  constructor({adapter,resolver,crm,domains,identities,memory,finance,build=null,clock=()=>performance.now()}){Object.assign(this,{adapter,resolver,crm,domains,identities,memory,finance,build,clock});this.cache=new Map();this.validatedManifests=new WeakSet();}
  authorize(ctx,actor){
    if(!ctx||!actor?.id||!canManage(actor))fail('demo_manage_forbidden',403);
    // This flag selects an explicitly isolated synthetic tenant. It conveys no
    // native module/identity/object permissions and does not grant any roles.
    if(this.adapter.isDemoScope?.(ctx)!==true)fail('demo_isolated_scope_required',403);
    const profile=this.resolver.profile(ctx);if(!profile)fail('demo_composition_required',409);return profile;
  }
  rows(ctx){return this.adapter.bucket(ctx,SCOPE);}
  manifest(options){const key=L.hash(options);if(!this.cache.has(key)){const build=this.build||(options.industry_id==='ECOMMERCE'?require('./ecommerce-demo-universe').build:Automotive.build),m=build(options);L.validate(m);if(this.cache.size>=4)this.cache.delete(this.cache.keys().next().value);this.cache.set(key,m);}return this.cache.get(key);}
  reservedManifest(ctx,row){
    const retained=this.adapter.bucket(ctx,MANIFESTS).find(m=>m.fingerprint===row.plan_fingerprint);
    // Legacy reservations can only recover with their exact original generator.
    // New reservations retain the complete confirmed graph across upgrades.
    const manifest=retained||this.manifest(row.options);
    // Reuse validation only for this exact, deeply immutable graph. Restarts,
    // replaced graphs and transaction rollbacks create new objects and must
    // pass the complete Law again. Never cache current grants or native data.
    if(!this.validatedManifests.has(manifest)){L.validate(manifest);freezeGraph(manifest);this.validatedManifests.add(manifest);}
    if(manifest.fingerprint!==row.plan_fingerprint||manifest.nodes.length!==row.node_count)fail('demo_reserved_manifest_changed',409);
    return manifest;
  }
  options(input,industry){
    if(!['AUTOMOTIVE','ECOMMERCE'].includes(industry))fail('demo_industry_unavailable',409);
    if(industry==='ECOMMERCE'?input.vehicle_count!==undefined:['product_count','order_count','customer_count'].some(k=>input[k]!==undefined))fail('demo_request_invalid');
    const options={seed:input.seed,as_of:input.as_of,history_months:input.history_months??18,...(industry==='ECOMMERCE'?{industry_id:industry,product_count:input.product_count??120,order_count:input.order_count??360,customer_count:input.customer_count??300}:{vehicle_count:input.vehicle_count??200})};
    if(typeof options.as_of!=='string'||Date.parse(options.as_of)>(this.adapter.now?.()||new Date()).getTime())fail('demo_future_reference_time');return options;
  }
  session(ctx,actor){
    if(!ctx?.tenant_id||!ctx?.dealer_id||!actor?.id)fail('demo_manage_forbidden',403);
    const request_context={tenant_id:ctx.tenant_id,dealer_id:ctx.dealer_id,actor_id:actor.id};
    // Ordinary workspaces can discover that demo controls are unavailable.
    // They receive no reservation, profile or other owner's seed metadata.
    if(!canManage(actor)||this.adapter.isDemoScope?.(ctx)!==true)return {available:false,request_context};
    const profile=this.authorize(ctx,actor),supported=['AUTOMOTIVE','ECOMMERCE'].includes(profile.industry_id),rows=this.rows(ctx),owned=rows.find(r=>r.owner_id===actor.id&&r.tenant_id===ctx.tenant_id&&r.dealer_id===ctx.dealer_id);
    const blocked_reason=!supported?'INDUSTRY_UNAVAILABLE':rows.length&&!owned?'RESERVATION_UNAVAILABLE':!rows.length&&this.adapter.hasBusinessData?.(ctx)!==false?'EXISTING_DATA':null;
    const defaults={seed:'foundly-demo-'+profile.industry_id.toLowerCase()+'-v1',as_of:(this.adapter.now?.()||new Date()).toISOString(),history_months:18,...(profile.industry_id==='ECOMMERCE'?{product_count:120,order_count:360,customer_count:300}:{vehicle_count:200})};
    return {available:true,request_context,industry_id:profile.industry_id,profile_revision:profile.revision,can_start:!blocked_reason&&!rows.length,blocked_reason,defaults,universe:owned?this.get(ctx,actor,owned.id):null,classification:'SYNTHETIC_DEMO',external_effects:false,full_acceptance:false};
  }
  preview(ctx,actor,input){keys(input,['seed','as_of','vehicle_count','history_months','product_count','order_count','customer_count']);const profile=this.authorize(ctx,actor),options=this.options(input,profile.industry_id),m=this.manifest(options),proof=L.validate(m);return {schema_version:L.VERSION,request_context:{tenant_id:ctx.tenant_id,dealer_id:ctx.dealer_id,actor_id:actor.id},options,plan_fingerprint:m.fingerprint,profile_revision:profile.revision,industry_id:m.industry_id,counts:proof.counts,node_count:proof.node_count,classification:'SYNTHETIC_DEMO',native_permissions_required:true,external_effects:false,full_acceptance:false};}
  start(ctx,actor,input,requestId){
    keys(input,['seed','as_of','vehicle_count','history_months','product_count','order_count','customer_count','plan_fingerprint','expected_profile_revision','confirm','reason']);const profile=this.authorize(ctx,actor);
    if(typeof requestId!=='string'||!/^[A-Za-z0-9_.:-]{8,160}$/.test(requestId)||input.confirm!==true||typeof input.reason!=='string'||!input.reason.trim()||input.reason.length>1000)fail('demo_confirmation_required');
    const options=this.options(input,profile.industry_id),m=this.manifest(options);if(profile.industry_id!==m.industry_id||input.expected_profile_revision!==profile.revision||input.plan_fingerprint!==m.fingerprint)fail('demo_plan_changed',409);
    const requestHash=L.hash({actor_id:actor.id,input}),prior=this.rows(ctx).find(r=>r.request_id===requestId);
    if(prior){if(prior.owner_id!==actor.id||prior.request_hash!==requestHash)fail('demo_request_conflict',409);return this.get(ctx,actor,prior.id);}
    if(this.rows(ctx).length)fail('demo_universe_already_reserved',409);
    if(this.adapter.hasBusinessData?.(ctx)!==false)fail('demo_empty_tenant_required',409);
    const row={id:'demo-'+L.hash([ctx.tenant_id,ctx.dealer_id,actor.id,requestId]).slice(0,32),tenant_id:ctx.tenant_id,dealer_id:ctx.dealer_id,owner_id:actor.id,request_id:requestId,request_hash:requestHash,options,plan_fingerprint:m.fingerprint,classification:'SYNTHETIC_DEMO',cursor:0,node_count:m.nodes.length,status:'READY',revision:1,bindings:{},created_at:(this.adapter.now?.()||new Date()).toISOString(),last_error:null};
    scopedMutation(this.adapter,ctx,[SCOPE,AUDIT,MANIFESTS],()=>{this.adapter.bucket(ctx,MANIFESTS).push(clone(m));this.rows(ctx).push(row);this.audit(ctx,actor,row,'START',{reason:input.reason.trim()});});return this.get(ctx,actor,row.id);
  }
  owned(ctx,actor,id){this.authorize(ctx,actor);const row=this.rows(ctx).find(r=>r.id===id&&r.tenant_id===ctx.tenant_id&&r.dealer_id===ctx.dealer_id&&r.owner_id===actor.id);if(!row)fail('demo_universe_missing',404);return row;}
  audit(ctx,actor,row,operation,details){this.adapter.bucket(ctx,AUDIT).push({universe_id:row.id,actor_id:actor.id,operation,revision:row.revision,at:(this.adapter.now?.()||new Date()).toISOString(),...details});}
  get(ctx,actor,id){const row=this.owned(ctx,actor,id);return {id:row.id,request_id:row.request_id,request_context:{tenant_id:ctx.tenant_id,dealer_id:ctx.dealer_id,actor_id:actor.id},profile_revision:this.resolver.profile(ctx).revision,plan_fingerprint:row.plan_fingerprint,options:clone(row.options),status:row.status,revision:row.revision,applied_nodes:row.cursor,total_nodes:row.node_count,last_error:row.last_error,classification:'SYNTHETIC_DEMO',native_data_currently_verified:false,full_acceptance:false,external_effects:false};}
  access(ctx,actor,node,operation){
    if(['identity.invite','memory.create'].includes(node.contract))return;
    this.resolver.assertModule(ctx,actor,node.module,operation);const cap=ENTITY_CAPABILITIES[node.module]?.[node.entity];if(!cap)fail('demo_contract_unavailable');this.resolver.assertCapability(ctx,actor,cap,operation);
  }
  read(ctx,actor,node,id){
    this.access(ctx,actor,node,'read');
    if(node.contract==='crm.create')return this.crm.get(ctx,actor,node.entity,id);
    if(node.contract==='domain.create')return this.domains[node.module].get(ctx,actor,node.entity,id);
    if(node.contract==='commerce.action')return require('./sales-commerce').read(this.domains.sales,ctx,actor,node.entity,id);
    if(['finance.create','finance.action'].includes(node.contract)){
      let cursor=0;
      do{const page=this.finance.list(ctx,actor,node.entity,{limit:200,cursor}),record=page.items.find(r=>r.id===id);if(record)return record;if(page.next_cursor===null)break;if(!Number.isSafeInteger(page.next_cursor)||page.next_cursor<=cursor||page.next_cursor>20000)fail('demo_native_read_capacity',409);cursor=page.next_cursor;}while(true);
      fail('demo_native_record_missing',404);
    }
    if(node.contract==='identity.invite'){const row=this.identities.list(ctx,actor).items.find(r=>r.id===id);if(!row)fail('demo_native_record_missing',404);return row;}
    if(node.contract==='memory.create')return this.memory.get(ctx,actor,id);
    fail('demo_contract_unavailable');
  }
  write(ctx,actor,node,input,key){
    this.access(ctx,actor,node,'write');
    if(node.contract==='crm.create')return this.crm.create(ctx,actor,node.entity,{...input,provenance:clone(node.provenance)},{idempotencyKey:key});
    if(node.contract==='domain.create')return this.domains[node.module].save(ctx,actor,node.entity,input,{idempotency_key:key,provenance_classification:'SYNTHETIC_DEMO'}).record;
    if(node.contract==='finance.create'){
      const method={legal_entities:'createLegalEntity',fiscal_periods:'createPeriod',accounts:'createAccount'}[node.entity];
      if(!method||!this.finance)fail('demo_contract_unavailable');
      return this.finance[method](ctx,actor,input,{idempotencyKey:key});
    }
    if(node.contract==='commerce.action'){
      const result=require('./sales-commerce').execute(this.domains.sales,ctx,actor,input.operation,{...input.values,confirm:true,reason:input.reason},{idempotency_key:key,demo_provenance:{classification:'SYNTHETIC_DEMO',source_reference:node.provenance.source_reference}});
      if(!result.result_is_current)fail('demo_native_source_changed',409);
      return result.record;
    }
    if(node.contract==='identity.invite')return this.identities.invite(ctx,actor,input,key).member;
    if(node.contract==='memory.create')return this.memory.create(ctx,actor,input,{idempotencyKey:key});
    fail('demo_contract_unavailable');
  }
  advance(ctx,actor,id,input){
    this.authorize(ctx,actor);
    if(typeof this.adapter.atomicMutation!=='function')return this.advanceChunk(ctx,actor,id,input);
    const started=this.clock(),result=this.adapter.atomicMutation(ctx,actor,()=>this.advanceChunk(ctx,actor,id,input));
    result.batch.elapsed_ms=Math.round(this.clock()-started);result.batch.atomic_durable_commit=true;return result;
  }
  advanceChunk(ctx,actor,id,input){
    const started=this.clock();
    keys(input,['expected_cursor','expected_profile_revision','limit','confirm','reason']);let row=this.owned(ctx,actor,id);const profile=this.authorize(ctx,actor),m=this.reservedManifest(ctx,row);
    if(input.confirm!==true||typeof input.reason!=='string'||!input.reason.trim()||input.reason.length>1000||!Number.isSafeInteger(input.limit)||input.limit<1||input.limit>100)fail('demo_confirmation_required');
    if(input.expected_cursor!==row.cursor||input.expected_profile_revision!==profile.revision||profile.industry_id!==m.industry_id||m.fingerprint!==row.plan_fingerprint)fail('demo_plan_changed',409);
    const nodeMap=new Map(m.nodes.map(n=>[n.id,n])),end=Math.min(row.cursor+input.limit,m.nodes.length),bindings=clone(row.bindings),applied=[];let cursor=row.cursor;
    const checkpoint=()=>{
      if(!applied.length)return;
      scopedMutation(this.adapter,ctx,[SCOPE,AUDIT],()=>{row.bindings=clone(bindings);row.cursor=cursor;row.revision++;row.status=cursor===m.nodes.length?'SEEDED':'SEEDING';row.last_error=null;for(const item of applied)this.audit(ctx,actor,row,'APPLIED',item);});
      applied.length=0;
    };
    for(;cursor<end;){
      const node=m.nodes[cursor];
      try{
        // Inventory/order commands change existing native sources. Retain the
        // preceding cursor before them and their acknowledgement before the
        // next command, so later mutations cannot invalidate a batch replay.
        if(['commerce.action','finance.action'].includes(node.contract))checkpoint();
        this.authorize(ctx,actor);
        const nativeInput=L.resolveInput(node.input,bindings),key='demo:'+L.hash([row.id,node.id]).slice(0,48),preparation=node.contract==='finance.action'?FinanceActions.retained(this,ctx,actor,row,node,nativeInput,key):null;
        for(const ref of node.depends_on){const binding=bindings[ref];if(!binding)fail('demo_dependency_not_applied',409);const dependency=nodeMap.get(ref),actual=this.read(ctx,actor,dependency,binding.id);if(nativeRevision(dependency,actual)!==binding.revision||L.hash(actual)!==binding.record_hash){if(!preparation||!FinanceActions.mutableDependency(node,ref))fail('demo_dependency_changed',409);}}
        let result;
        if(node.contract==='finance.action'){this.access(ctx,actor,node,'write');result=FinanceActions.execute(this,ctx,actor,row,node,nativeInput,key,preparation);}
        else result=this.write(ctx,actor,node,nativeInput,key);
        const record=this.read(ctx,actor,node,result?.id);
        if(!record?.id)fail('demo_native_ack_invalid',502);const revision=nativeRevision(node,record);if(revision!==nativeRevision(node,result)||node.contract==='finance.action'&&L.hash(record)!==L.hash(result))fail('demo_native_source_changed',409);
        const binding={id:record.id,revision,record_hash:L.hash(record),module:node.module,entity:node.entity,input_hash:L.hash(nativeInput)};
        bindings[node.id]=binding;cursor++;applied.push({node_id:node.id,native_id:record.id,native_revision:record.revision});
        if(['commerce.action','finance.action'].includes(node.contract))checkpoint();
        // limit is an upper bound, not a promised batch length. Finish one
        // native command, retain its actual cursor, then yield so slower disks
        // and busy hosts do not turn a large batch into a long blocked request.
        // A single command/persist is never interrupted or reported half done.
        if(this.clock()-started>=ADVANCE_WORK_BUDGET_MS)break;
      }catch(error){
        // A native effect may already be durable when receipt persistence fails.
        // The next explicit attempt uses exactly the same native request key.
        // Never persist a guessed NOT_APPLIED or advance past an uncertain step.
        throw error;
      }
    }
    checkpoint();
    return {...this.get(ctx,actor,id),batch:{applied_nodes:cursor-input.expected_cursor,requested_limit:input.limit,work_budget_ms:ADVANCE_WORK_BUDGET_MS,elapsed_ms:Math.round(this.clock()-started),yield_reason:cursor===m.nodes.length?'COMPLETE':cursor<end?'WORK_BUDGET':'LIMIT'}};
  }
}
module.exports={DemoUniverseEngine,SCOPE,AUDIT,MANIFESTS,hasBusinessData,ADVANCE_WORK_BUDGET_MS};
