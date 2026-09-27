'use strict';
(function(root,factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;else root.FoundlyDemoState=value;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 const invalid=()=>Object.assign(Error('demo_observation_invalid'),{code:'demo_observation_invalid'}),check=value=>{if(!value)throw invalid();},object=v=>v&&typeof v==='object'&&!Array.isArray(v),integer=(v,min=0,max=100000)=>Number.isSafeInteger(v)&&v>=min&&v<=max,string=v=>typeof v==='string'&&v.length>0&&v.length<=160;
 const canonical=v=>JSON.stringify(Object.keys(v).sort().map(k=>[k,v[k]]));
 function realm(v,expected){check(object(v)&&['tenant_id','dealer_id','actor_id'].every(k=>string(v[k])));if(expected)check(['tenant_id','dealer_id','actor_id'].every(k=>v[k]===expected[k]));return v;}
 function flags(v){check(v.classification==='SYNTHETIC_DEMO'&&v.external_effects===false&&v.full_acceptance===false);}
 function options(v,industry){check(object(v)&&string(v.seed)&&typeof v.as_of==='string'&&Number.isFinite(Date.parse(v.as_of))&&integer(v.history_months,12,24));const commerce=industry==='ECOMMERCE';check(commerce||industry==='AUTOMOTIVE');const names=commerce?['product_count','order_count','customer_count']:['vehicle_count'];check(Object.keys(v).every(k=>['seed','as_of','history_months','industry_id',...names].includes(k)));if(v.industry_id!==undefined)check(v.industry_id===industry);check(commerce?integer(v.product_count,12,240)&&integer(v.order_count,12,1000)&&integer(v.customer_count,12,1000):integer(v.vehicle_count,150,300));return Object.fromEntries(['seed','as_of','history_months',...names].map(k=>[k,v[k]]));}
 function universe(v,context,industry,previous){
  check(object(v)&&/^demo-[a-f0-9]{32}$/.test(v.id)&&typeof v.request_id==='string'&&/^[A-Za-z0-9_.:-]{8,160}$/.test(v.request_id));realm(v.request_context,context);flags(v);options(v.options,industry);
  check(/^[a-f0-9]{64}$/.test(v.plan_fingerprint)&&integer(v.revision,1,Number.MAX_SAFE_INTEGER)&&integer(v.profile_revision,1,Number.MAX_SAFE_INTEGER)&&integer(v.applied_nodes)&&integer(v.total_nodes,1)&&v.applied_nodes<=v.total_nodes&&v.native_data_currently_verified===false);
  check(v.status==='READY'?v.applied_nodes===0:v.status==='SEEDING'?v.applied_nodes>0&&v.applied_nodes<v.total_nodes:v.status==='SEEDED'&&v.applied_nodes===v.total_nodes);
  if(previous)check(v.id===previous.id&&v.request_id===previous.request_id&&v.plan_fingerprint===previous.plan_fingerprint&&canonical(v.options)===canonical(previous.options)&&v.total_nodes===previous.total_nodes&&v.revision>=previous.revision&&v.applied_nodes>=previous.applied_nodes);
  return v;
 }
 function session(v,context){
  check(object(v)&&v.ok===true&&typeof v.available==='boolean');realm(v.request_context,context);if(!v.available)return v;flags(v);
  check(integer(v.profile_revision,1,Number.MAX_SAFE_INTEGER)&&typeof v.can_start==='boolean'&&[null,'INDUSTRY_UNAVAILABLE','RESERVATION_UNAVAILABLE','EXISTING_DATA'].includes(v.blocked_reason));
  if(v.blocked_reason==='INDUSTRY_UNAVAILABLE'){check(!v.can_start&&v.universe===null);return v;}
  options(v.defaults,v.industry_id);if(v.universe!==null)universe(v.universe,v.request_context,v.industry_id);
  check(v.can_start===(!v.universe&&!v.blocked_reason));if(v.universe)check(v.universe.profile_revision===v.profile_revision&&v.blocked_reason===null);return v;
 }
 function preview(v,session,input){check(object(v)&&v.ok===true);realm(v.request_context,session.request_context);flags(v);check(v.industry_id===session.industry_id&&v.profile_revision===session.profile_revision&&/^[a-f0-9]{64}$/.test(v.plan_fingerprint)&&integer(v.node_count,1)&&v.native_permissions_required===true);check(canonical(options(v.options,session.industry_id))===canonical(options(input,session.industry_id)));return v;}
 return {invalid,realm,flags,options,universe,session,preview,canonical};
});
