'use strict';
const C=require('./contracts');
function createZeroApi({context,principal,body,json,memory,stack,declareStack,discoverStack,models,agents,knowledge}) {
  return async function handle(req,res,url) {
    const route=url.pathname.replace(/^\/api\/jarvis(?=\/|$)/,'/api/zero');
    if(!/^\/api\/zero\/(?:memories(?:\/|$)|stack(?:\/(?:evidence|discover))?$|models$|agents$|plans(?:\/|$)|knowledge(?:\/|$))/.test(route))return false;
    try{
      const ctx=context();C.scope(ctx,principal());
      if(route==='/api/zero/knowledge'&&knowledge){
        if(req.method==='GET')return json(res,200,{ok:true,...knowledge.list(ctx,principal(),{q:url.searchParams.get('q')||'',active:url.searchParams.get('active')==='true'}),review_due:knowledge.due(ctx,principal())});
        if(req.method==='POST'){const input=await body(req);return json(res,201,{ok:true,record:knowledge.stage(ctx,principal(),input)});}
      }
      const knowledgeMatch=route.match(/^\/api\/zero\/knowledge\/([a-zA-Z0-9-]{1,100})\/transition$/);
      if(knowledgeMatch&&knowledge&&req.method==='POST'){const input=await body(req);return json(res,200,{ok:true,record:knowledge.transition(ctx,principal(),knowledgeMatch[1],input)});}
      if(route==='/api/zero/agents'&&req.method==='GET'&&agents)return json(res,200,{ok:true,...agents.catalog(ctx,principal())});
      if(route==='/api/zero/plans'&&agents){
        if(req.method==='GET')return json(res,200,{ok:true,...agents.list(ctx,principal())});
        if(req.method==='POST'){const input=await body(req);return json(res,201,{ok:true,plan:agents.create(ctx,principal(),input)});}
      }
      const planMatch=route.match(/^\/api\/zero\/plans\/([a-zA-Z0-9-]{1,100})(?:\/(run|cancel))?$/);
      if(planMatch&&agents){
        if(!planMatch[2]&&req.method==='GET')return json(res,200,{ok:true,plan:agents.get(ctx,principal(),planMatch[1])});
        if(planMatch[2]&&req.method==='POST'){const input=await body(req);C.keys(input,[]);return json(res,200,{ok:true,...await agents[planMatch[2]](ctx,principal(),planMatch[1])});}
      }
      if(route==='/api/zero/memories'){
        if(req.method==='GET'){
          const query={};for(const [key,value]of url.searchParams){if(!['q','session_id','task_id','workflow_id','limit'].includes(key))C.fail('zero_query_invalid');query[key]=value;}
          return json(res,200,{ok:true,...memory.search(ctx,principal(),query)});
        }
        if(req.method==='POST'){const input=await body(req);return json(res,201,{ok:true,memory:memory.create(ctx,principal(),input)});}
      }
      const match=route.match(/^\/api\/zero\/memories\/([a-zA-Z0-9-]{1,100})$/);
      if(match&&req.method==='DELETE'){
        const input=await body(req);return json(res,200,{ok:true,...memory.remove(ctx,principal(),match[1],input)});
      }
      if(route==='/api/zero/stack'&&req.method==='GET'&&stack)return json(res,200,await stack(ctx,principal()));
      if(route==='/api/zero/stack/evidence'&&req.method==='POST'&&declareStack){const input=await body(req);return json(res,201,{ok:true,evidence:declareStack(ctx,principal(),input)});}
      if(route==='/api/zero/stack/discover'&&req.method==='POST'&&discoverStack){const input=await body(req);const result=await discoverStack(ctx,principal(),input);return json(res,result.ok?200:503,result);}
      if(route==='/api/zero/models'&&req.method==='GET'&&models)return json(res,200,models(ctx,principal()));
      return json(res,405,{ok:false,code:'zero_method_not_allowed'});
    }catch(error){return json(res,error.statusCode||500,{ok:false,code:error.code||'zero_internal_error',error:error.statusCode?error.message:'ZERO request failed'});}
  };
}
module.exports={createZeroApi};
