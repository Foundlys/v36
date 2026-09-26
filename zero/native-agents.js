'use strict';
const C=require('./contracts');
// Only observation timestamps are removed for comparison; business dates,
// revision numbers, permissions, amounts and source metadata remain significant.
function stable(value){if(Array.isArray(value))return value.map(stable);if(!value||typeof value!=='object')return value;return Object.fromEntries(Object.entries(value).filter(([k])=>k!=='observed_at').map(([k,v])=>[k,stable(v)]));}
function nativeTools({composition,domain,crm,crmActor,finance,platform}){
 const specs=[
  ['procurement_summary','Procurement','procurement',(c,a)=>domain('procurement').summary(c,a)],
  ['sales_pipeline','Sales','sales',(c,a)=>domain('sales').summary(c,a)],
  ['calendar_agenda','Calendar','calendar',(c,a)=>domain('calendar').summary(c,a)],
  ['communication_drafts','Communication','communication',(c,a)=>domain('communication').summary(c,a)],
  ['marketing_campaigns','Marketing','marketing',(c,a)=>domain('marketing').summary(c,a)],
  ['crm_pipeline_summary','CRM','crm',(c,a)=>crm().analytics(c,crmActor(a),{})],
  ['finance_report','Finance','finance',(c,a)=>finance().reports(c,a,{})],
  ['automation_status','Workflow','automation',(c,a)=>platform().automationStatus(c,a)]
 ];
 return specs.map(([id,specialist,module,read])=>({id,specialist,module,effect:'READ',source_class:'FOUNDLY_DERIVED_FROM_CUSTOMER_TRUTH',responsibility:'Read and independently verify '+module+' evidence within current native access contracts',
  authorize(c,a){try{composition().assertTool(c,a,id);return true;}catch(e){if(e.statusCode===403)return false;throw e;}},
  read,verify:(c,a,value)=>C.hash(stable(read(c,a)))===C.hash(stable(value))}));
}
module.exports={nativeTools,stable};
