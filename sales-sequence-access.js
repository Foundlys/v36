'use strict';
function readable(domain,ctx,actor,row,options={}){
 if(domain.id==='sales'){
  const ref=row.owned_entity==='sequence_runs'?{run_id:row.id,opportunity_id:row.opportunity_id,definition_id:row.definition_id}:row.source_sequence_ref;
  if(!ref)return true;return require('./sales-sequences').sourceReadable(domain,ctx,actor,ref);
 }
 if(domain.id==='communication'&&row.owned_entity==='drafts'&&row.source_sales_sequence_ref){try{return domain.adapter.salesSequenceSourceReadable?.(ctx,actor,row.source_sales_sequence_ref,options)===true;}catch(e){if([401,403,404,409].includes(e.statusCode))return false;throw e;}}
 return true;
}
module.exports={readable};
