'use strict';
const { DEFINITIONS }=require('./business-domains');
function createBusinessDomainApi({domains,context,principal,readBody,sendJson}){
  return async(req,res,url)=>{
    const match=url.pathname.match(/^\/api\/(procurement|sales|calendar|communication)(?:\/(.*))?$/);
    if(!match)return false;
    const id=match[1],core=domains[id],parts=(match[2]||'status').split('/'),ctx=context(),actor=principal();
    try{
      if(parts[0]==='schema'&&req.method==='GET'){core.scope(ctx,actor);return sendJson(res,200,{ok:true,module_id:id,entities:DEFINITIONS[id].entities,required_fields:DEFINITIONS[id].required});}
      if(['status','summary'].includes(parts[0])&&req.method==='GET')return sendJson(res,200,{ok:true,...core.summary(ctx,actor)});
      if(parts[0]==='export'&&req.method==='GET')return sendJson(res,200,{ok:true,...core.export(ctx,actor)});
      if(id==='calendar'&&parts[0]==='conflicts'&&req.method==='POST'){const data=await readBody(req);return sendJson(res,200,{ok:true,...core.conflicts(ctx,actor,data,data.exclude_id)});}
      if(!DEFINITIONS[id].entities.includes(parts[0]))return sendJson(res,404,{ok:false,code:'entity_unknown'});
      const [entity,recordId,action]=parts;
      if(req.method==='GET')return sendJson(res,200,recordId?{ok:true,record:core.get(ctx,actor,entity,recordId)}:{ok:true,...core.list(ctx,actor,entity,Object.fromEntries(url.searchParams))});
      if(req.method==='POST'&&action==='approve'){return sendJson(res,200,{ok:true,...core.approve(ctx,actor,entity,recordId,await readBody(req))});}
      if(req.method==='POST'&&!recordId||req.method==='PUT'&&recordId&&!action){
        const data=await readBody(req),{expected_revision,...input}=data;
        const result=core.save(ctx,actor,entity,input,{id:recordId,expected_revision,idempotency_key:req.headers['idempotency-key'],correlation_id:req.headers['x-correlation-id']});
        return sendJson(res,result.deduplicated||recordId?200:201,{ok:true,...result});
      }
      return sendJson(res,405,{ok:false,code:'method_not_allowed'});
    }catch(error){return sendJson(res,error.statusCode||500,{ok:false,code:error.code||'domain_error',error:error.statusCode?error.message:'Interne domeinfout'});}
  };
}
module.exports={createBusinessDomainApi};
