'use strict';
const { DEFINITIONS }=require('./business-domains');
const {calendarOperations}=require('./calendar-operations');
function createBusinessDomainApi({domains,platform,context,principal,readBody,sendJson,mailAccount=()=>null,mailSubmissions=()=>null,mailboxes=()=>null}){
  return async(req,res,url)=>{
    const match=url.pathname.match(/^\/api\/(procurement|sales|calendar|communication|marketing|analysis)(?:\/(.*))?$/);
    if(!match)return false;
    const id=match[1],core=domains[id],parts=(match[2]||'status').split('/'),ctx=context(),actor=principal();
    if(id==='analysis'&&!['reports','provider_reports','provider_events','owned-export','industry-kpis','cohorts','cohort_definitions','schema'].includes(parts[0]))return false;
    try{
      if(id==='analysis'&&parts[0]==='cohort_definitions'&&parts[2]==='query'&&parts.length===3&&req.method==='GET')return sendJson(res,200,{ok:true,...require('./analysis-cohorts').querySavedCohort(core,platform,ctx,actor,parts[1],Object.fromEntries(url.searchParams))});
      if(id==='analysis'&&parts[0]==='cohorts'&&parts.length===1&&req.method==='GET')return sendJson(res,200,{ok:true,...require('./analysis-cohorts').queryCohorts(core.resolver,platform,ctx,actor,Object.fromEntries(url.searchParams))});
      if(id==='analysis'&&parts[0]==='industry-kpis'&&parts.length===1&&req.method==='GET')return sendJson(res,200,{ok:true,...require('./industry-kpis').industryKpis(core.resolver,platform,ctx,actor,Object.fromEntries(url.searchParams))});
      if(parts[0]==='schema'&&req.method==='GET'){core.scope(ctx,actor);return sendJson(res,200,{ok:true,module_id:id,entities:DEFINITIONS[id].entities,required_fields:DEFINITIONS[id].required,industry_fields:require('./industry-field-contract').fieldContract(core.resolver,ctx,actor,id)});}
      if(['status','summary'].includes(parts[0])&&req.method==='GET')return sendJson(res,200,{ok:true,...core.summary(ctx,actor)});
      if(['export','owned-export'].includes(parts[0])&&req.method==='GET')return sendJson(res,200,{ok:true,...core.export(ctx,actor)});
      if(id==='calendar'&&parts[0]==='conflicts'&&req.method==='POST'){const data=await readBody(req);return sendJson(res,200,{ok:true,...core.conflicts(ctx,actor,data,data.exclude_id)});}
      if(id==='calendar'&&parts[0]==='scheduling'){const operations=calendarOperations(core);if(parts[1]==='slots'&&parts.length===2&&req.method==='GET')return sendJson(res,200,{ok:true,...operations.slots(ctx,actor,Object.fromEntries(url.searchParams))});if(parts[1]==='book'&&parts.length===2&&req.method==='POST')return sendJson(res,201,{ok:true,...operations.book(ctx,actor,await readBody(req),{idempotency_key:req.headers['idempotency-key']})});}
      if(id==='procurement'&&parts[0]==='rfqs'&&parts[2]==='comparison'&&parts.length===3&&req.method==='GET')return sendJson(res,200,{ok:true,...require('./procurement-sourcing').compareBids(core,ctx,actor,parts[1])});
      if(id==='procurement'){
        const reviews=require('./procurement-reviews'),options={idempotency_key:req.headers['idempotency-key']};
        if(parts[0]==='orders'&&parts.length===3&&parts[2]==='approval-preview'&&req.method==='GET')return sendJson(res,200,{ok:true,...reviews.previewOrderApproval(core,ctx,actor,parts[1])});
        if(parts[0]==='orders'&&parts.length===3&&parts[2]==='approvals'&&req.method==='POST')return sendJson(res,201,{ok:true,...reviews.prepareOrderApproval(core,ctx,actor,parts[1],await readBody(req),options)});
        if(parts[0]==='rfqs'&&parts.length===3&&parts[2]==='award-preview'&&req.method==='GET')return sendJson(res,200,{ok:true,...reviews.previewAward(core,ctx,actor,parts[1],url.searchParams.get('bid_id'))});
        if(parts[0]==='rfqs'&&parts.length===3&&parts[2]==='allocation-preview'&&req.method==='POST')return sendJson(res,200,{ok:true,...reviews.previewAllocation(core,ctx,actor,parts[1],(await readBody(req)).allocations)});
        if(parts[0]==='rfqs'&&parts.length===3&&parts[2]==='awards'&&req.method==='POST')return sendJson(res,201,{ok:true,...reviews.prepareAward(core,ctx,actor,parts[1],await readBody(req),options)});
        if(parts[0]==='awards'&&parts.length===3&&['approve','cancel'].includes(parts[2])&&req.method==='POST')return sendJson(res,200,{ok:true,...reviews[parts[2]==='approve'?'reviewAward':'cancelAward'](core,ctx,actor,parts[1],await readBody(req),options)});
      }
      if(id==='communication'&&parts[0]==='mailboxes'){
        const service=mailboxes();if(!service)return sendJson(res,503,{ok:false,code:'mailbox_unavailable'});
        if(parts.length===1&&req.method==='GET')return sendJson(res,200,{ok:true,...service.status(ctx,actor)});
        if(parts.length===2&&parts[1]==='sync'&&req.method==='POST')return sendJson(res,200,{ok:true,...await service.sync(ctx,actor,await readBody(req),{idempotency_key:req.headers['idempotency-key']})});
        return sendJson(res,405,{ok:false,code:'method_not_allowed'});
      }
      if(id==='communication'&&parts[0]==='inbox'&&parts.length===1&&req.method==='GET')return sendJson(res,200,{ok:true,...require('./communication-inbox').list(core,ctx,actor,Object.fromEntries(url.searchParams))});
      if(id==='communication'&&parts[0]==='messages'&&parts.length===3){
        if(parts[2]==='conversation'&&req.method==='GET')return sendJson(res,200,{ok:true,...require('./communication-threads').query(core,ctx,actor,parts[1],Object.fromEntries(url.searchParams))});
        if(parts[2]==='source'&&req.method==='GET'){const service=mailboxes();if(!service)return sendJson(res,503,{ok:false,code:'mailbox_unavailable'});return sendJson(res,200,{ok:true,...service.source(ctx,actor,parts[1])});}
        if(parts[2]==='view'&&req.method==='GET')return sendJson(res,200,{ok:true,...require('./communication-inbox').detail(core,ctx,actor,parts[1])});
        if(parts[2]==='inbox-state'&&req.method==='PUT')return sendJson(res,200,{ok:true,...require('./communication-inbox').update(core,ctx,actor,parts[1],await readBody(req),{idempotency_key:req.headers['idempotency-key']})});
        const service=require('./communication-replies');
        if(parts[2]==='draft-preview'&&req.method==='GET'){if([...url.searchParams.keys()].some(key=>key!=='mode'))return sendJson(res,422,{ok:false,code:'message_draft_query_invalid'});return sendJson(res,200,{ok:true,...service.preview(core,ctx,actor,parts[1],url.searchParams.get('mode'),mailAccount)});}
        if(parts[2]==='drafts'&&req.method==='POST'){const result=service.create(core,ctx,actor,parts[1],await readBody(req),{idempotency_key:req.headers['idempotency-key']},mailAccount);return sendJson(res,result.deduplicated?200:201,{ok:true,...result});}
      }
      if(id==='communication'&&parts[0]==='drafts'&&parts[2]==='edit-session'){
        const service=require('./communication-edit-sessions');
        if(parts.length===3&&req.method==='GET')return sendJson(res,200,{ok:true,...service.get(core,ctx,actor,parts[1])});
        if(parts.length===4&&req.method==='POST')return sendJson(res,200,{ok:true,...service.change(core,ctx,actor,parts[1],parts[3],await readBody(req),{idempotency_key:req.headers['idempotency-key'],edit_token:req.headers['x-communication-edit-token']})});
        return sendJson(res,405,{ok:false,code:'method_not_allowed'});
      }
      if(id==='communication'&&parts[0]==='drafts'&&parts[2]==='comments'){
        const service=require('./communication-comments'),options={idempotency_key:req.headers['idempotency-key']};
        if(parts.length===3&&req.method==='GET')return sendJson(res,200,{ok:true,...service.list(core,ctx,actor,parts[1],Object.fromEntries(url.searchParams))});
        if(parts.length===3&&req.method==='POST'){const value=service.create(core,ctx,actor,parts[1],await readBody(req),options);return sendJson(res,value.deduplicated?200:201,{ok:true,...value});}
        if(parts.length===5&&parts[4]==='withdraw'&&req.method==='POST')return sendJson(res,200,{ok:true,...service.withdraw(core,ctx,actor,parts[1],parts[3],await readBody(req),options)});
        return sendJson(res,405,{ok:false,code:'method_not_allowed'});
      }
      if(id==='communication'&&parts[0]==='drafts'&&parts.length===5&&parts[2]==='submissions'&&parts[4]==='reconcile'&&req.method==='POST'){const service=mailSubmissions();if(!service)return sendJson(res,503,{ok:false,code:'mail_submission_unavailable'});return sendJson(res,200,{ok:true,...service.reconcile(ctx,actor,parts[1],parts[3],await readBody(req),{idempotency_key:req.headers['idempotency-key']})});}
      if(id==='communication'&&parts[0]==='drafts'&&parts.length===3&&parts[2]==='submissions'&&req.method==='GET'){const service=mailSubmissions();if(!service)return sendJson(res,503,{ok:false,code:'mail_submission_unavailable'});return sendJson(res,200,{ok:true,...service.list(ctx,actor,parts[1])});}
      if(id==='communication'&&parts[0]==='drafts'&&parts[2]==='send-reviews'){
        const service=require('./communication-send-reviews'),options={idempotency_key:req.headers['idempotency-key']};
        if(parts.length===3&&req.method==='GET'){const model=service.list(core,ctx,actor,parts[1],mailAccount),submissions=mailSubmissions();if(submissions)model.items=model.items.map(row=>{const current=submissions.reviewState(ctx,actor,parts[1],row);return {...row,...current,can_cancel:row.can_cancel&&!require('./communication-submissions').blocks(core,ctx,parts[1],row.basis_fingerprint)};});return sendJson(res,200,{ok:true,...model});}
        if(parts.length===4&&parts[3]==='preview'&&req.method==='GET')return sendJson(res,200,{ok:true,...service.preview(core,ctx,actor,parts[1],url.searchParams.get('purpose'),mailAccount)});
        if(parts.length===4&&parts[3]==='reviewers'&&req.method==='GET')return sendJson(res,200,{ok:true,...service.reviewers(core,ctx,actor,parts[1],Object.fromEntries(url.searchParams),mailAccount)});
        if(parts.length===3&&req.method==='POST'){const result=service.prepare(core,ctx,actor,parts[1],await readBody(req),options,mailAccount);return sendJson(res,result.deduplicated?200:201,{ok:true,...result});}
        if(parts.length===5&&parts[4]==='submit'&&req.method==='POST'){const submissions=mailSubmissions();if(!submissions)return sendJson(res,503,{ok:false,code:'mail_submission_unavailable'});return sendJson(res,200,{ok:true,...await submissions.execute(ctx,actor,parts[1],parts[3],await readBody(req),options)});}
        if(parts.length===5&&['approve','cancel'].includes(parts[4])&&req.method==='POST')return sendJson(res,200,{ok:true,...service.decide(core,ctx,actor,parts[1],parts[3],await readBody(req),options,mailAccount,parts[4]==='cancel')});
        return sendJson(res,405,{ok:false,code:'method_not_allowed'});
      }
      if(id==='communication'&&parts[0]==='drafts'&&parts[2]==='attachments'&&[3,4].includes(parts.length)){
        const service=require('./communication-attachments');
        if(req.method==='GET')return sendJson(res,200,{ok:true,...(parts.length===3?service.list(core,ctx,actor,parts[1]):service.read(core,ctx,actor,parts[1],parts[3]))});
        if(req.method==='POST'&&parts.length===3){const result=await service.upload(core,ctx,actor,parts[1],await readBody(req),{idempotency_key:req.headers['idempotency-key'],edit_token:req.headers['x-communication-edit-token']});return sendJson(res,result.deduplicated?200:201,{ok:true,...result});}
        if(req.method==='POST'&&parts[3]==='detach')return sendJson(res,200,{ok:true,...service.detach(core,ctx,actor,parts[1],await readBody(req),{idempotency_key:req.headers['idempotency-key'],edit_token:req.headers['x-communication-edit-token']})});
        return sendJson(res,405,{ok:false,code:'method_not_allowed'});
      }
      if(id==='communication'&&parts[0]==='drafts'&&parts.length===3){
        const service=require('./communication-drafts');if(parts[2]==='collaborator-options'&&req.method==='GET')return sendJson(res,200,{ok:true,...service.collaborators(core,ctx,actor,parts[1],Object.fromEntries(url.searchParams))});if(parts[2]==='revisions'&&req.method==='GET')return sendJson(res,200,{ok:true,...service.history(core,ctx,actor,parts[1],Object.fromEntries(url.searchParams))});
        if(['collaborators','restore'].includes(parts[2])&&req.method==='POST')return sendJson(res,200,{ok:true,...service[parts[2]==='restore'?'restore':'share'](core,ctx,actor,parts[1],await readBody(req),{idempotency_key:req.headers['idempotency-key'],edit_token:req.headers['x-communication-edit-token']})});
      }
      if(id==='marketing'){
        const service=require('./marketing-creative-reviews'),options={idempotency_key:req.headers['idempotency-key']};
        if(parts[0]==='creatives'&&parts[2]==='reviews'&&parts.length===3&&req.method==='POST')return sendJson(res,201,{ok:true,...service.prepareCreativeReview(core,ctx,actor,parts[1],await readBody(req),options)});
        if(parts[0]==='creative_reviews'&&parts.length===3&&['approve','withdraw'].includes(parts[2])&&req.method==='POST')return sendJson(res,200,{ok:true,...service[parts[2]==='approve'?'reviewCreative':'withdrawCreativeReview'](core,ctx,actor,parts[1],await readBody(req),options)});
      }
      if(id==='sales'&&parts[0]==='forecast'){
        const service=require('./sales-forecast');
        if(parts.length===3&&parts[1]==='scenarios'&&parts[2]==='query'&&req.method==='POST'){const data=await readBody(req);if(Object.keys(data).some(key=>!['filters','scenario'].includes(key)))return sendJson(res,422,{ok:false,code:'scenario_query_invalid'});return sendJson(res,200,{ok:true,...require('./sales-scenarios').scenarioForecast(core,ctx,actor,data.filters||{},data.scenario)});}
        if(parts.length===1&&req.method==='GET')return sendJson(res,200,{ok:true,...service.forecast(core,ctx,actor,Object.fromEntries(url.searchParams))});
        if(parts.length===2&&parts[1]==='snapshots'&&req.method==='POST')return sendJson(res,201,{ok:true,...service.snapshotForecast(core,ctx,actor,await readBody(req),{idempotency_key:req.headers['idempotency-key']})});
      }
      if(parts.length>3||!DEFINITIONS[id].entities.includes(parts[0]))return sendJson(res,404,{ok:false,code:'entity_unknown'});
      const [entity,recordId,action]=parts;
      if(req.method==='GET'&&!action)return sendJson(res,200,recordId?{ok:true,record:core.get(ctx,actor,entity,recordId)}:{ok:true,...core.list(ctx,actor,entity,Object.fromEntries(url.searchParams))});
      if(req.method==='POST'&&action==='approve'){return sendJson(res,200,{ok:true,...core.approve(ctx,actor,entity,recordId,await readBody(req))});}
      if(req.method==='POST'&&!recordId||req.method==='PUT'&&recordId&&!action){
        const data=await readBody(req),{expected_revision,...input}=data;
        const result=core.save(ctx,actor,entity,input,{id:recordId,expected_revision,idempotency_key:req.headers['idempotency-key'],edit_token:req.headers['x-communication-edit-token'],correlation_id:req.headers['x-correlation-id']});
        return sendJson(res,result.deduplicated||recordId?200:201,{ok:true,...result});
      }
      return sendJson(res,405,{ok:false,code:'method_not_allowed'});
    }catch(error){return sendJson(res,error.statusCode||500,{ok:false,code:error.code||'domain_error',error:error.statusCode?error.message:'Interne domeinfout'});}
  };
}
module.exports={createBusinessDomainApi};
