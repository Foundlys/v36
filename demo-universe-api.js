'use strict';
function createDemoUniverseApi({engine,context,principal,readBody,sendJson}){
  return async(req,res,url)=>{
    if(!/^\/api\/demo-universe(?:\/|$)/.test(url.pathname))return false;
    try{
      const ctx=context();
      if(url.pathname==='/api/demo-universe/session'&&req.method==='GET')return sendJson(res,200,{ok:true,...engine.session(ctx,principal())});
      engine.authorize(ctx,principal());
      if(url.pathname==='/api/demo-universe/preview'&&req.method==='POST'){const input=await readBody(req);return sendJson(res,200,{ok:true,...engine.preview(ctx,principal(),input)});}
      if(url.pathname==='/api/demo-universe/runs'&&req.method==='POST'){const input=await readBody(req);return sendJson(res,201,{ok:true,universe:engine.start(ctx,principal(),input,req.headers['idempotency-key'])});}
      const match=url.pathname.match(/^\/api\/demo-universe\/runs\/(demo-[a-f0-9]{32})(\/advance)?$/);
      if(match&&!match[2]&&req.method==='GET')return sendJson(res,200,{ok:true,universe:engine.get(ctx,principal(),match[1])});
      if(match&&match[2]&&req.method==='POST'){const input=await readBody(req);return sendJson(res,200,{ok:true,universe:engine.advance(ctx,principal(),match[1],input)});}
      return sendJson(res,405,{ok:false,code:'demo_method_not_allowed'});
    }catch(error){return sendJson(res,error.statusCode||500,{ok:false,code:error.code||'demo_internal_error',error:error.statusCode?error.message:'Demoaanvraag mislukt'});}
  };
}
module.exports={createDemoUniverseApi};
