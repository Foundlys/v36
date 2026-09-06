'use strict';
const { DEFINITIONS }=require('./business-domains');
const {calendarOperations}=require('./calendar-operations');
function createBusinessDomainApi({domains,context,principal,readBody,sendJson}){
  return async(req,res,url)=>{
    const match=url.pathname.match(/^\/api\/(procurement|sales|calendar|communication|marketing|analysis)(?:\/(.*))?$/);
    if(!match)return false;
    const id=match[1],core=domains[id],parts=(match[2]||'status').split('/'),ctx=context(),actor=principal();
    if(id==='analysis'&&!['reports','owned-export'].includes(parts[0]))return false;
    try{
      if(parts[0]==='schema'&&req.method==='GET'){core.scope(ctx,actor);return sendJson(res,200,{ok:true,module_id:id,entities:DEFINITIONS[id].entities,required_fields:DEFINITIONS[id].required});}
      if(['status','summary'].includes(parts[0])&&req.method==='GET')return sendJson(res,200,{ok:true,...core.summary(ctx,actor)});
      if(['export','owned-export'].includes(parts[0])&&req.method==='GET')return sendJson(res,200,{ok:true,...core.export(ctx,actor)});
      if(id==='calendar'&&parts[0]==='conflicts'&&req.method==='POST'){const data=await readBody(req);return sendJson(res,200,{ok:true,...core.conflicts(ctx,actor,data,data.exclude_id)});}
      if(id==='calendar'&&parts[0]==='scheduling'){const operations=calendarOperations(core);if(parts[1]==='slots'&&parts.length===2&&req.method==='GET')return sendJson(res,200,{ok:true,...operations.slots(ctx,actor,Object.fromEntries(url.searchParams))});if(parts[1]==='book'&&parts.length===2&&req.method==='POST')return sendJson(res,201,{ok:true,...operations.book(ctx,actor,await readBody(req),{idempotency_key:req.headers['idempotency-key']})});}
      if(id==='procurement'&&parts[0]==='rfqs'&&parts[2]==='comparison'&&parts.length===3&&req.method==='GET')return sendJson(res,200,{ok:true,...require('./procurement-sourcing').compareBids(core,ctx,actor,parts[1])});
      if(parts.length>3||!DEFINITIONS[id].entities.includes(parts[0]))return sendJson(res,404,{ok:false,code:'entity_unknown'});
      const [entity,recordId,action]=parts;
      if(req.method==='GET'&&!action)return sendJson(res,200,recordId?{ok:true,record:core.get(ctx,actor,entity,recordId)}:{ok:true,...core.list(ctx,actor,entity,Object.fromEntries(url.searchParams))});
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
