'use strict';
const C=require('./contracts');
const {project,stable}=require('./native-evidence');
function nativeTools({composition,domain,crm,crmActor,finance,platform,isDemoScope=()=>false}){
 const sourceClass=c=>isDemoScope(c)?'SYNTHETIC_DEMO':'FOUNDLY_DERIVED_FROM_CUSTOMER_TRUTH';
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
 return specs.map(([id,specialist,module,read])=>({id,specialist,module,effect:'READ',source_class:'FOUNDLY_DERIVED_FROM_CUSTOMER_TRUTH',sourceClass,responsibility:'Read and independently verify '+module+' evidence within current native access contracts',
  authorize(c,a){try{composition().assertTool(c,a,id);return true;}catch(e){if(e.statusCode===403)return false;throw e;}},
  read:(c,a)=>project(read(c,a),sourceClass(c)),verify:(c,a,value)=>C.hash(stable(project(read(c,a),sourceClass(c))))===C.hash(stable(value))}));
}
module.exports={nativeTools,stable};
