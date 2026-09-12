'use strict';
// One payload mapping for execution and read-only outcome verification.
function ownedActionInput(action,run){
  if(!['create_task','create_document'].includes(action.type))return null;
  const payload={...(action.payload||{}),...(run.inputs||{})},document=action.type==='create_document';
  return {entity:document?'documents':'tasks',input:{title:action.title||payload.title||(document?'Automationdocument':'Automationtaak'),...(document?{content:payload.content||action.content||''}:{owner_id:action.owner_id||payload.owner_id}),related_entity:run.event?.entity_type||payload.related_entity,related_id:run.event?.entity_id||payload.related_id,source:'platform_automation'}};
}
module.exports={ownedActionInput};
