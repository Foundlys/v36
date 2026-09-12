'use strict';
function readable(domain,ctx,actor,row,options={}){if(domain.id!=='analysis'||row.owned_entity!=='action_proposals'&&!row.source_analysis_action_id)return true;return (options.analysisAccess||domain.adapter.analysisActionAccess?.(ctx,actor,options))?.(row)===true;}
function batch(domain,ctx,actor,options={}){const access=domain.adapter.analysisActionAccess?.(ctx,actor,options);return row=>domain.snapshotReadable(ctx,actor,row,{...options,analysisAccess:access});}
module.exports={readable,batch};
