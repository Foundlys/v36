'use strict';
const crypto=require('node:crypto');
const {sanitizeInput}=require('./crm-core');
const {validateDraftCondition}=require('./workflow-authoring');
const {requirePermission}=require('./capability-resolver');
const {scopedMutation}=require('./scoped-mutation');
const SCOPE='platform:automation_drafts';
const fail=(code,message,statusCode=422)=>{throw Object.assign(new Error(message),{code,statusCode});};
const clone=value=>JSON.parse(JSON.stringify(value));
class WorkflowDrafts{
  constructor(adapter,resolver){this.adapter=adapter;this.resolver=resolver;}
  scope(ctx,actor,operation='read'){requirePermission(actor,`automation:${operation}`);this.resolver.assertModule(ctx,actor,'automation',operation);if(operation!=='export')this.resolver.assertCapability(ctx,actor,'automation:workflows',operation);}
  list(ctx,actor,operation='read'){this.scope(ctx,actor,operation);return {items:clone(this.adapter.bucket(ctx,SCOPE).filter(row=>row.owner_id===actor.id)),scope:'CURRENT_OWNER_ONLY',executable:false};}
  save(ctx,actor,id,input){
    this.scope(ctx,actor,'write');if(!/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(id))fail('workflow_draft_id_invalid','Ongeldig conceptkenmerk');
    const draft=input.draft;
    if(!draft||typeof draft!=='object'||Array.isArray(draft)||JSON.stringify(draft).length>120000||Object.keys(draft).some(key=>!['name','version','trigger_type','automatic','at','event_name','approval_required','steps'].includes(key))||draft.steps!==undefined&&(!Array.isArray(draft.steps)||draft.steps.length>100||draft.steps.some(step=>!step||typeof step!=='object'||Array.isArray(step))))fail('workflow_draft_invalid','Concept heeft een ongeldige structuur of is te groot');
    // Partial drafts remain non-executable; preserve bounded condition trees
    // separately from the shallower generic record sanitizer.
    let stepCount=0;
    const cleanSteps=(steps,depth=0)=>{
      if(!Array.isArray(steps)||depth>3)fail('workflow_draft_invalid','Ongeldige vertakkingsstructuur');
      return steps.map(step=>{
        if(!step||typeof step!=='object'||Array.isArray(step)||++stepCount>100)fail('workflow_draft_invalid','Maximaal honderd conceptstappen inclusief vertakkingen');
        const {condition,then_steps,else_steps,...rest}=step,value=sanitizeInput(rest);
        if(Object.hasOwn(step,'condition')){validateDraftCondition(condition);value.condition=clone(condition);}
        if(step.type==='branch'){
          if(depth>=3)fail('workflow_draft_invalid','Maximaal drie geneste vertakkingen');
          value.then_steps=cleanSteps(then_steps,depth+1);value.else_steps=cleanSteps(else_steps,depth+1);
        }else if(Object.hasOwn(step,'then_steps')||Object.hasOwn(step,'else_steps'))fail('workflow_draft_invalid','Alleen vertakkingen hebben afzonderlijke paden');
        return value;
      });
    };
    const {steps,...rest}=draft,value=sanitizeInput(rest);if(steps!==undefined)value.steps=cleanSteps(steps);
    const fingerprint=crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'),rows=this.adapter.bucket(ctx,SCOPE),previous=rows.find(row=>row.id===id);
    if(previous&&previous.owner_id!==actor.id)fail('workflow_draft_missing','Concept niet gevonden',404);
    if(previous&&previous.request_revision===input.expected_revision&&previous.fingerprint===fingerprint)return {record:clone(previous),deduplicated:true,executable:false};
    if(!Number.isInteger(input.expected_revision)||input.expected_revision!==(previous?.revision||0))fail('workflow_draft_conflict','Dit concept is elders gewijzigd; laad de bewaarde versie voordat je verder opslaat',409);
    if(!previous&&(rows.length>=1000||rows.filter(row=>row.owner_id===actor.id).length>=100))fail('workflow_draft_capacity','Het maximumaantal bewaarde concepten is bereikt',507);
    return scopedMutation(this.adapter,ctx,[SCOPE,'platform:audit'],()=>{
      const now=new Date().toISOString(),record={id,owner_id:actor.id,tenant_id:ctx.tenant_id,dealer_id:ctx.dealer_id,revision:(previous?.revision||0)+1,request_revision:input.expected_revision,fingerprint,draft:value,created_at:previous?.created_at||now,updated_at:now,status:'DRAFT',executable:false,schema_version:1};
      if(previous)rows[rows.indexOf(previous)]=record;else rows.push(record);
      this.adapter.audit(ctx,actor,'SAVE','automation_draft',id,{revision:record.revision,content_logged:false});return {record:clone(record),deduplicated:false,executable:false};
    });
  }
}
function createWorkflowDraftApi({drafts,context,principal,readBody,sendJson}){return async(req,res,url)=>{
  if(!url.pathname.startsWith('/api/automation/drafts'))return false;
  try{const ctx=context(),actor=principal();if(req.method==='GET'&&['/api/automation/drafts','/api/automation/drafts/export'].includes(url.pathname))return sendJson(res,200,drafts.list(ctx,actor,url.pathname.endsWith('/export')?'export':'read'));
    const match=url.pathname.match(/^\/api\/automation\/drafts\/([A-Za-z0-9_-]{1,100})$/);if(match&&req.method==='PUT')return sendJson(res,200,drafts.save(ctx,actor,match[1],await readBody(req)));
    return sendJson(res,404,{code:'workflow_draft_missing',error:'Concept niet gevonden'});
  }catch(error){return sendJson(res,error.statusCode||500,{code:error.code||'workflow_draft_failed',error:error.statusCode?error.message:'Concept opslaan is niet gelukt'});}
};}
module.exports={WorkflowDrafts,createWorkflowDraftApi,SCOPE};
