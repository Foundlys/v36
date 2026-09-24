'use strict';
const crypto=require('node:crypto');
const C=require('./contracts');
const {scopedMutation}=require('../scoped-mutation');
const USAGE='zero:model-usage';
const PROTOCOLS=['responses','chat','anthropic'];
const integer=(value,fallback,min,max)=>{const n=value===undefined?fallback:Number(value);if(!Number.isSafeInteger(n)||n<min||n>max)C.fail('zero_model_config_invalid');return n;};
function registryFromEnvironment(env=process.env){
  if(env.FOUNDLY_ZERO_MODEL_REGISTRY){
    let parsed;try{parsed=JSON.parse(env.FOUNDLY_ZERO_MODEL_REGISTRY);}catch{C.fail('zero_model_registry_invalid');}
    if(!Array.isArray(parsed)||!parsed.length||parsed.length>12)C.fail('zero_model_registry_invalid');return parsed;
  }
  return [{id:'primary',provider:'openai_compatible',model:env.FOUNDLY_AI_MODEL||'gpt-5.6',
    base_url:env.FOUNDLY_AI_BASE_URL||'https://api.openai.com/v1',
    credential_env:env.FOUNDLY_AI_API_KEY?'FOUNDLY_AI_API_KEY':'OPENAI_API_KEY',protocols:['responses','chat'],
    tasks:['conversation','reasoning','generation','verification'],quality:1,privacy:['INTERNAL','CONFIDENTIAL'],
    max_input_bytes:128000,max_output_tokens:4096,timeout_ms:Number(env.FOUNDLY_REQUEST_TIMEOUT_MS)||12000}];
}
function validateModels(config){
  const seen=new Set();
  return config.map(input=>{
    C.keys(input,['id','provider','model','base_url','credential_env','protocols','tasks','quality','privacy','max_input_bytes','max_output_tokens','timeout_ms','input_usd_per_million','output_usd_per_million','priority']);
    const id=C.identifier(input.id,80);if(seen.has(id))C.fail('zero_duplicate_model');seen.add(id);
    let url;try{url=new URL(input.base_url);}catch{C.fail('zero_model_url_invalid');}
    if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.hostname==='localhost'||/^(127\.|10\.|192\.168\.|169\.254\.)/.test(url.hostname))C.fail('zero_model_url_invalid');
    if(typeof input.credential_env!=='string'||!/^[A-Z][A-Z0-9_]{2,80}$/.test(input.credential_env))C.fail('zero_model_credential_invalid');
    const protocols=input.protocols||['responses'];if(!Array.isArray(protocols)||!protocols.length||protocols.length>3||protocols.some(x=>!PROTOCOLS.includes(x)))C.fail('zero_model_protocol_invalid');
    const tasks=input.tasks||['conversation','reasoning','generation'];if(!Array.isArray(tasks)||!tasks.length||tasks.some(x=>!['conversation','reasoning','generation','verification','research'].includes(x)))C.fail('zero_model_task_invalid');
    const privacy=input.privacy||['INTERNAL'];if(!Array.isArray(privacy)||!privacy.length||privacy.some(x=>!['INTERNAL','CONFIDENTIAL','RESTRICTED'].includes(x)))C.fail('zero_model_privacy_invalid');
    for(const key of ['quality','input_usd_per_million','output_usd_per_million'])if(input[key]!==undefined&&(typeof input[key]!=='number'||!Number.isFinite(input[key])||input[key]<0))C.fail('zero_model_config_invalid');
    return {...input,id,model:C.string(input.model,120),provider:C.identifier(input.provider||'compatible',80),base_url:url.href.replace(/\/$/,''),protocols:[...new Set(protocols)],tasks,privacy,
      quality:input.quality??1,priority:integer(input.priority,0,0,100),max_input_bytes:integer(input.max_input_bytes,64000,1000,1000000),
      max_output_tokens:integer(input.max_output_tokens,2048,64,32000),timeout_ms:integer(input.timeout_ms,12000,100,120000)};
  });
}

class ModelRouter{
  constructor({models,env=process.env,adapter,fetch:fetcher=globalThis.fetch,now=()=>new Date(),policy={},validateUrl}){
    this.env=env;this.models=validateModels(models||registryFromEnvironment(env));this.adapter=adapter;this.fetch=fetcher;this.now=now;
    this.validateUrl=validateUrl;this.inflight=new Map();this.failures=new Map();
    this.policy={daily_requests:integer(policy.daily_requests,500,1,100000),daily_tokens:integer(policy.daily_tokens,2000000,1000,1000000000),
      workflow_requests:integer(policy.workflow_requests,40,1,1000),concurrency:integer(policy.concurrency,4,1,32),
      max_attempts:integer(policy.max_attempts,3,1,6),daily_usd:policy.daily_usd??null};
    if(this.policy.daily_usd!==null&&(typeof this.policy.daily_usd!=='number'||!Number.isFinite(this.policy.daily_usd)||this.policy.daily_usd<=0))C.fail('zero_budget_invalid');
    this.version=C.hash({models:this.models,policy:this.policy});
  }
  credential(model){return String(this.env[model.credential_env]||'').trim().replace(/^(["'])(.*)\1$/,'$2');}
  publicRegistry(ctx,actor){
    C.scope(ctx,actor);const models=this.models.map(model=>({id:model.id,provider:model.provider,model:model.model,tasks:model.tasks,
      state:this.credential(model)?'CONFIGURED_UNVERIFIED':'NOT_CONFIGURED',privacy:model.privacy,
      pricing_configured:model.input_usd_per_million!==undefined&&model.output_usd_per_million!==undefined}));
    return{ok:true,version:this.version,available:models.some(x=>x.state==='CONFIGURED_UNVERIFIED'),availability_verified:false,models,policy:{...this.policy}};
  }
  reserve(ctx,actor,workflow,model,inputBytes){
    const identity=C.scope(ctx,actor),today=this.now().toISOString().slice(0,10),rows=this.adapter.bucket(ctx,USAGE);
    const current=rows.filter(x=>C.sameScope(x,ctx)&&x.day===today),tokens=inputBytes+model.max_output_tokens;
    const priced=model.input_usd_per_million!==undefined&&model.output_usd_per_million!==undefined;
    const cost=priced?(inputBytes*model.input_usd_per_million+model.max_output_tokens*model.output_usd_per_million)/1e6:null;
    if(current.length>=this.policy.daily_requests||current.reduce((s,x)=>s+x.charged_tokens,0)+tokens>this.policy.daily_tokens)C.fail('zero_tenant_budget_exhausted',429);
    if(workflow&&current.filter(x=>x.workflow_id===workflow&&x.owner_id===actor.id).length>=this.policy.workflow_requests)C.fail('zero_workflow_budget_exhausted',429);
    if(this.policy.daily_usd!==null&&(!priced||current.some(x=>x.charged_usd===null)||current.reduce((s,x)=>s+x.charged_usd,0)+cost>this.policy.daily_usd))C.fail(priced?'zero_money_budget_exhausted':'zero_model_price_required',429);
    const row={id:crypto.randomUUID(),...identity,workflow_id:workflow||null,day:today,at:this.now().toISOString(),config_version:this.version,
      model_id:model.id,status:'RESERVED',reserved_tokens:tokens,charged_tokens:tokens,reserved_usd:cost,charged_usd:cost,
      actual_tokens:null,actual_usd:null,latency_ms:null,usage_verified:false};
    return scopedMutation(this.adapter,ctx,[USAGE],()=>{for(let i=rows.length-1;i>=0;i--)if(rows[i].day<today)rows.splice(i,1);rows.push(row);return row;});
  }
  finish(ctx,row,{status,usage,latency,code}){
    const input=Number(usage?.input_tokens??usage?.prompt_tokens),output=Number(usage?.output_tokens??usage?.completion_tokens);
    const verified=Number.isSafeInteger(input)&&Number.isSafeInteger(output)&&input>=0&&output>=0;
    const model=this.models.find(x=>x.id===row.model_id),priced=model.input_usd_per_million!==undefined&&model.output_usd_per_million!==undefined;
    return scopedMutation(this.adapter,ctx,[USAGE],()=>{
      Object.assign(row,{status,latency_ms:latency,code:code||null,usage_verified:verified,
        actual_tokens:verified?input+output:null,actual_usd:verified&&priced?(input*model.input_usd_per_million+output*model.output_usd_per_million)/1e6:null});
      // Unknown usage remains fully charged. Provider outages cannot turn retries
      // into free, unlimited budget. A confirmed usage record can release excess.
      if(verified){row.charged_tokens=input+output;row.charged_usd=row.actual_usd;}
    });
  }
  async transport(model,protocol,{system,input,signal}){
    const headers={'content-type':'application/json'};let endpoint,payload;
    if(protocol==='anthropic'){
      endpoint='/messages';headers['x-api-key']=this.credential(model);headers['anthropic-version']='2023-06-01';
      payload={model:model.model,system,messages:[{role:'user',content:input}],max_tokens:model.max_output_tokens};
    }else{
      headers.authorization=`Bearer ${this.credential(model)}`;
      if(protocol==='responses'){endpoint='/responses';payload={model:model.model,instructions:system,input,max_output_tokens:model.max_output_tokens,store:false};}
      else{endpoint='/chat/completions';payload={model:model.model,messages:[{role:'system',content:system},{role:'user',content:input}],max_completion_tokens:model.max_output_tokens,store:false};}
    }
    const url=model.base_url+endpoint;if(this.validateUrl)await this.validateUrl(url);
    const response=await this.fetch(url,{method:'POST',headers,body:JSON.stringify(payload),signal,redirect:'error'});
    if(!response.ok)throw Object.assign(Error('Model provider request failed'),{code:'zero_provider_http_'+response.status,statusCode:502});
    const data=await response.json();let text;
    if(protocol==='responses'){
      if(data.status&&data.status!=='completed')throw Object.assign(Error('Incomplete provider response'),{code:'zero_provider_incomplete',usage:data.usage});
      text=data.output_text||(data.output||[]).flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('\n');
    }else if(protocol==='anthropic'){
      if(data.stop_reason&&!['end_turn','stop_sequence'].includes(data.stop_reason))throw Object.assign(Error('Incomplete provider response'),{code:'zero_provider_incomplete',usage:data.usage});
      text=(data.content||[]).filter(x=>x.type==='text').map(x=>x.text).join('\n');
    }else{
      if(data.choices?.[0]?.finish_reason&&data.choices[0].finish_reason!=='stop')throw Object.assign(Error('Incomplete provider response'),{code:'zero_provider_incomplete',usage:data.usage});
      text=data.choices?.[0]?.message?.content;
    }
    if(typeof text!=='string'||!text.trim()||Buffer.byteLength(text)>256000)throw Object.assign(Error('Empty or oversized model result'),{code:'zero_provider_result_invalid',usage:data.usage});
    return{text,usage:data.usage};
  }
  async generate({ctx,actor,system,input,task='conversation',privacy='INTERNAL',workflow_id,signal,check=()=>{}}){
    C.scope(ctx,actor);check();C.string(system,40000);C.string(input,1000000);
    if(workflow_id)C.identifier(workflow_id);
    const inputBytes=Buffer.byteLength(system)+Buffer.byteLength(input),scopeKey=ctx.tenant_id+':'+ctx.dealer_id;
    if((this.inflight.get(scopeKey)||0)>=this.policy.concurrency)return{ok:false,state:'CONCURRENCY_LIMIT',text:'',attempts:[]};
    const eligible=this.models.filter(m=>this.credential(m)&&m.tasks.includes(task)&&m.privacy.includes(privacy)&&inputBytes<=m.max_input_bytes)
      .sort((a,b)=>a.priority-b.priority||b.quality-a.quality||((a.input_usd_per_million??Infinity)-(b.input_usd_per_million??Infinity)));
    if(!eligible.length)return{ok:false,state:'NO_ELIGIBLE_MODEL',text:'',attempts:[],config_version:this.version};
    this.inflight.set(scopeKey,(this.inflight.get(scopeKey)||0)+1);const attempts=[];
    try{
      for(const model of eligible){
        const circuitKey=scopeKey+':'+model.id;if((this.failures.get(circuitKey)?.until||0)>this.now().getTime())continue;
        for(const protocol of model.protocols){
          if(attempts.length>=this.policy.max_attempts||signal?.aborted)break;
          C.scope(ctx,actor);check();let row;
          try{row=this.reserve(ctx,actor,workflow_id,model,inputBytes);}catch(error){if(error.statusCode!==429)throw error;return{ok:false,state:'BUDGET_EXHAUSTED',code:error.code,text:'',attempts,config_version:this.version};}
          const started=performance.now(),controller=new AbortController();
          const abort=()=>controller.abort(signal?.reason);signal?.addEventListener('abort',abort,{once:true});
          let timer;
          try{
            const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Object.assign(Error('Model timed out'),{code:'zero_provider_timeout'}));},model.timeout_ms);});
            const result=await Promise.race([this.transport(model,protocol,{system,input,signal:controller.signal}),timeout]);
            C.scope(ctx,actor);check();if(signal?.aborted)C.fail('zero_cancelled',409);
            const latency=performance.now()-started;this.finish(ctx,row,{status:'SUCCEEDED',usage:result.usage,latency});
            attempts.push({model_id:model.id,protocol,status:'SUCCEEDED',latency_ms:latency,usage_verified:row.usage_verified});
            this.failures.delete(circuitKey);
            return{ok:true,state:'SUCCEEDED',text:result.text,model_id:model.id,config_version:this.version,attempts,
              usage:{tokens:row.actual_tokens,cost_usd:row.actual_usd,verified:row.usage_verified},fallback_used:attempts.length>1};
          }catch(error){
            const latency=performance.now()-started;this.finish(ctx,row,{status:'FAILED',usage:error.usage,latency,code:error.code||'zero_provider_error'});
            attempts.push({model_id:model.id,protocol,status:'FAILED',code:error.code||'zero_provider_error',latency_ms:latency});
            if(error.statusCode===401||error.statusCode===403||error.code==='zero_cancelled'||error.code==='zero_context_changed')throw error;
            const n=(this.failures.get(circuitKey)?.count||0)+1;this.failures.set(circuitKey,{count:n,until:n>=3?this.now().getTime()+30000:0});
          }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
        }
        if(attempts.length>=this.policy.max_attempts)break;
      }
      return{ok:false,state:signal?.aborted?'CANCELLED':'PROVIDER_UNAVAILABLE',text:'',attempts,config_version:this.version};
    }finally{const n=(this.inflight.get(scopeKey)||1)-1;if(n)this.inflight.set(scopeKey,n);else this.inflight.delete(scopeKey);}
  }
  telemetry(ctx,actor){
    C.scope(ctx,actor);const rows=this.adapter.bucket(ctx,USAGE).filter(x=>C.sameScope(x,ctx)&&x.owner_id===actor.id),latencies=rows.map(x=>x.latency_ms).filter(Number.isFinite).sort((a,b)=>a-b);
    const percentile=p=>latencies.length?latencies[Math.max(0,Math.ceil(latencies.length*p)-1)]:null;
    return{requests:rows.length,successes:rows.filter(x=>x.status==='SUCCEEDED').length,failures:rows.filter(x=>x.status==='FAILED').length,
      actual_tokens:rows.some(x=>x.actual_tokens===null)?null:rows.reduce((s,x)=>s+x.actual_tokens,0),
      actual_cost_usd:rows.some(x=>x.actual_usd===null)?null:rows.reduce((s,x)=>s+x.actual_usd,0),
      p50_ms:percentile(.5),p95_ms:percentile(.95),p99_ms:percentile(.99),sample_size:latencies.length,config_version:this.version};
  }
}
module.exports={ModelRouter,validateModels,registryFromEnvironment,USAGE};
