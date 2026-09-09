'use strict';
// Immutable snapshots retain evidence; access still follows the current source owners.
function snapshotReadable(domain,ctx,actor,row){
  if(domain.id!=='sales'||row.owned_entity!=='forecast_snapshots')return true;
  if(!row.forecast||!Array.isArray(row.forecast.items))return false;
  const sources=new Map(domain.bucket(ctx,'opportunities').map(source=>[source.id,source])),quotas=new Map(domain.bucket(ctx,'quotas').map(quota=>[quota.id,quota]));
  for(const reference of [...row.forecast.items,...(row.forecast.excluded||[])]){
    const current=sources.get(reference.id);
    if(!current||!domain.visible(current,actor))return false;
  }
  for(const reference of row.forecast.quotas?.items||[]){if(!reference.quota)continue;const current=quotas.get(reference.quota.id);if(!current||!domain.visible(current,actor))return false;}
  return true;
}
module.exports={snapshotReadable};
