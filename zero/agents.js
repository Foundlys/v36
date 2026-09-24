'use strict';
const crypto=require('node:crypto');
const C=require('./contracts');
const {scopedMutation}=require('../scoped-mutation');
const BUCKET='zero:agent-plans';
const LIMITS=Object.freeze({steps:8,tool_calls:16,context_bytes:64000,duration_ms:15000,concurrency:2,attempts:1});
const STATES=new Set(['VERIFIED','PARTIAL','FAILED','CANCELLED','INTERRUPTED']);

// Evidence workers run only registered, server-owned reads. Writes continue to
// use native typed actions and their separate approval/idempotency contracts.
// A model is never allowed to register a tool, create an agent or change policy.
class AgentOrchestrator{
 constructor({adapter,tools,now=()=>new Date()}){
  this.adapter=adapter;this.now=now;this.tools=new Map();this.running=new Map();
  for(const tool of tools){
   if(!tool.id||this.tools.has(tool.id)||tool.effect!=='READ'||typeof tool.authorize!=='function'||typeof tool.read!=='function'||typeof tool.verify!=='function')C.fail('zero_agent_registry_invalid');
   this.tools.set(tool.id,Object.freeze({...tool}));
  }
 }
 rows(ctx){return this.adapter.bucket(ctx,BUCKET);}
 key(ctx,row){return C.hash([ctx.tenant_id,ctx.dealer_id,row.owner_id,row.id]);}
 allowed(ctx,actor,tool){C.scope(ctx,actor);return tool.authorize(ctx,actor)===true;}
 catalog(ctx,actor){
  C.scope(ctx,actor);return {schema_version:1,limits:LIMITS,tools:[...this.tools.values()].filter(t=>this.allowed(ctx,actor,t)).map(t=>({id:t.id,specialist:t.specialist,module:t.module,responsibility:t.responsibility,effect:'READ',approval_required:false,input_schema:{type:'object',additionalProperties:false},source_class:t.source_class})),
   native_writes:'EXISTING_TYPED_ACTION_AND_APPROVAL_CONTRACTS',agent_can_expand_permissions:false};
 }
 create(ctx,actor,input){
  const identity=C.scope(ctx,actor);C.keys(input,['objective','steps','request_id']);
  const objective=C.string(input.objective,4000),requestId=C.identifier(input.request_id,100);
  if(!Array.isArray(input.steps)||!input.steps.length||input.steps.length>LIMITS.steps)C.fail('zero_plan_steps_invalid');
  const seen=new Set(),toolIds=new Set(),steps=[];
  for(const raw of input.steps){
   C.keys(raw,['id','tool_id','depends_on']);const id=C.identifier(raw.id,80),tool=this.tools.get(raw.tool_id);
   if(!tool||!this.allowed(ctx,actor,tool))C.fail('zero_agent_tool_denied',403);
   if(seen.has(id)||toolIds.has(tool.id))C.fail('zero_plan_duplicate_step');
   const dependencies=raw.depends_on||[];
   if(!Array.isArray(dependencies)||dependencies.length>LIMITS.steps||dependencies.some(d=>!seen.has(d)))C.fail('zero_plan_dependency_invalid');
   seen.add(id);toolIds.add(tool.id);steps.push({id,tool_id:tool.id,specialist:tool.specialist,depends_on:[...new Set(dependencies)],state:'PENDING'});
  }
  const digest=C.hash({objective,steps}),rows=this.rows(ctx),previous=rows.find(r=>C.sameScope(r,ctx)&&r.owner_id===actor.id&&r.request_id===requestId);
  if(previous){if(previous.request_hash!==digest)C.fail('zero_plan_request_conflict',409);return this.get(ctx,actor,previous.id);}
  if(rows.filter(r=>C.sameScope(r,ctx)&&r.owner_id===actor.id).length>=200)C.fail('zero_plan_capacity',429);
  const at=this.now().toISOString(),row={id:crypto.randomUUID(),...identity,request_id:requestId,request_hash:digest,objective,steps,state:'PLANNED',created_at:at,expires_at:new Date(this.now().getTime()+86400000).toISOString(),limits:LIMITS,receipts:[],revision:1,read_only:true};
  return scopedMutation(this.adapter,ctx,[BUCKET],()=>{rows.push(row);return C.clone(row);});
 }
 owned(ctx,actor,id){
  C.scope(ctx,actor);const row=this.rows(ctx).find(r=>r.id===id&&C.sameScope(r,ctx)&&r.owner_id===actor.id);
  if(!row)C.fail('zero_plan_missing',404);return row;
 }
 get(ctx,actor,id){
  const row=this.owned(ctx,actor,id);
  if(row.state==='RUNNING'&&!this.running.has(this.key(ctx,row)))this.change(ctx,row,{state:'INTERRUPTED',failure_code:'PROCESS_RESTARTED',finished_at:this.now().toISOString()});
  return {...C.clone(row),source_content_retained:false};
 }
 list(ctx,actor){C.scope(ctx,actor);return {items:this.rows(ctx).filter(r=>C.sameScope(r,ctx)&&r.owner_id===actor.id).slice(-50).reverse().map(r=>this.get(ctx,actor,r.id))};}
 change(ctx,row,fields){return scopedMutation(this.adapter,ctx,[BUCKET],()=>{Object.assign(row,fields,{revision:row.revision+1});});}
 cancel(ctx,actor,id){
  const row=this.owned(ctx,actor,id);if(STATES.has(row.state))return this.get(ctx,actor,id);
  this.change(ctx,row,{state:'CANCELLED',finished_at:this.now().toISOString()});this.running.get(this.key(ctx,row))?.controller.abort();return this.get(ctx,actor,id);
 }
 async run(ctx,actor,id){
  const row=this.owned(ctx,actor,id),key=this.key(ctx,row);
  if(this.running.has(key))C.fail('zero_plan_running',409);
  if(row.state==='RUNNING')return this.get(ctx,actor,id);
  if(STATES.has(row.state))return {plan:this.get(ctx,actor,id),replayed:true,evidence:[],source_refresh_required:true};
  if(row.expires_at<=this.now().toISOString())C.fail('zero_plan_expired',409);
  const tenantKey=C.hash([ctx.tenant_id,ctx.dealer_id]);
  if([...this.running.values()].filter(r=>r.tenantKey===tenantKey).length>=LIMITS.concurrency)C.fail('zero_agent_concurrency',429);
  const controller=new AbortController(),started=performance.now(),evidence=[],receipts=[];let calls=0,bytes=0;
  const check=()=>{C.scope(ctx,actor);if(actor.id!==row.owner_id)C.fail('zero_agent_identity_changed',403);if(controller.signal.aborted||row.state==='CANCELLED')C.fail('zero_plan_cancelled',409);if(performance.now()-started>=LIMITS.duration_ms)C.fail('zero_plan_timeout',504);};
  const bounded=async(fn)=>{
   check();if(++calls>LIMITS.tool_calls)C.fail('zero_agent_tool_budget',429);
   let timer,onAbort;
   try{return await Promise.race([Promise.resolve().then(fn),new Promise((_,reject)=>{
    timer=setTimeout(()=>{controller.abort();reject(Object.assign(Error('Plan deadline exceeded'),{code:'zero_plan_timeout',statusCode:504}));},Math.max(1,LIMITS.duration_ms-(performance.now()-started)));
    onAbort=()=>reject(Object.assign(Error('Plan cancelled'),{code:'zero_plan_cancelled',statusCode:409}));controller.signal.addEventListener('abort',onAbort,{once:true});
   })]);}finally{clearTimeout(timer);controller.signal.removeEventListener('abort',onAbort);}
  };
  for(const step of row.steps)if(!this.allowed(ctx,actor,this.tools.get(step.tool_id)))C.fail('zero_agent_tool_denied',403);
  this.change(ctx,row,{state:'RUNNING',started_at:this.now().toISOString()});this.running.set(key,{controller,tenantKey});
  try{
   for(const step of row.steps){
    check();if(step.depends_on.some(id=>!receipts.some(r=>r.step_id===id&&r.state==='READ')))C.fail('zero_plan_dependency_failed',409);
    const tool=this.tools.get(step.tool_id);if(!this.allowed(ctx,actor,tool))C.fail('zero_agent_tool_denied',403);
    const result=await bounded(()=>tool.read(ctx,actor,{signal:controller.signal}));check();
    if(!this.allowed(ctx,actor,tool))C.fail('zero_agent_tool_denied',403);
    C.object(result);const size=Buffer.byteLength(JSON.stringify(result));if((bytes+=size)>LIMITS.context_bytes)C.fail('zero_agent_context_budget',413);
    const receipt={step_id:step.id,tool_id:tool.id,state:'READ',result_hash:C.hash(result),source_class:tool.source_class,observed_at:this.now().toISOString()};
    receipts.push(receipt);evidence.push({step_id:step.id,tool_id:tool.id,data:C.clone(result),provenance:receipt});
   }
   // Independent registered verifiers reread the authoritative source. The
   // worker's own success flag or model critique is never verification evidence.
   for(const item of evidence){
    const tool=this.tools.get(item.tool_id);check();if(!this.allowed(ctx,actor,tool))C.fail('zero_agent_tool_denied',403);
    if(++calls>LIMITS.tool_calls)C.fail('zero_agent_tool_budget',429);
    const verified=tool.verify(ctx,actor,item.data,{signal:controller.signal});
    if(verified?.then)C.fail('zero_agent_async_verification_unsupported');check();
    if(!this.allowed(ctx,actor,tool)||verified!==true)C.fail('zero_agent_verification_failed',409);
   }
   check();for(const step of row.steps)if(!this.allowed(ctx,actor,this.tools.get(step.tool_id)))C.fail('zero_agent_tool_denied',403);
   this.change(ctx,row,{state:'VERIFIED',receipts:receipts.map(r=>({...r,state:'VERIFIED'})),tool_calls:calls,context_bytes:bytes,finished_at:this.now().toISOString()});
   return {plan:this.get(ctx,actor,id),evidence,verification:{method:'INDEPENDENT_SERVER_SOURCE_REREAD',cognitive_quality_verified:false,business_effects:0}};
  }catch(error){
   this.change(ctx,row,{state:row.state==='CANCELLED'?'CANCELLED':'FAILED',failure_code:error.code||'zero_agent_read_failed',receipts:receipts.map(r=>({...r,state:'UNVERIFIED'})),tool_calls:calls,finished_at:this.now().toISOString()});
   throw error;
  }finally{controller.abort();this.running.delete(key);}
 }
}
module.exports={AgentOrchestrator,LIMITS,BUCKET};
