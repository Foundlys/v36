'use strict';
const {words} = require('./memory');
const C = require('./contracts');

function assembleContext({ctx,actor,query,memory,history=[],sources=[],limits={},references={}}) {
  C.scope(ctx,actor);
  const maxBytes=Math.max(1024,Math.min(96000,Number(limits.max_bytes)||24000));
  const started=performance.now(), deadline=Math.max(1,Math.min(1000,Number(limits.max_ms)||100));
  const terms=words(query), memoryResult=memory.search(ctx,actor,{q:String(query||'').slice(0,1000),...references,limit:50});
  const selected=[], withheld=[], sourceStates=[];let used=0;
  const take=item=>{
    const bytes=Buffer.byteLength(JSON.stringify(item));
    if(used+bytes>maxBytes){withheld.push({id:item.id,reason:'CONTEXT_BUDGET'});return false;}
    if(performance.now()-started>deadline){withheld.push({id:item.id,reason:'CONTEXT_DEADLINE'});return false;}
    used+=bytes;selected.push(item);return true;
  };
  for(const source of sources){
    if(performance.now()-started>deadline){sourceStates.push({id:source.id,state:'TIME_BUDGET_EXHAUSTED'});continue;}
    // Source readers are registered server-side, never supplied by a model/client.
    try{
      if(!source.authorize(ctx,actor)){sourceStates.push({id:source.id,state:'PERMISSION_DENIED'});continue;}
      const result=source.read(ctx,actor,query);
      if(result?.then)C.fail('zero_context_async_source_unsupported');
      if(!source.authorize(ctx,actor))C.fail('zero_source_revoked',403);
      const state=result.state||'AVAILABLE';sourceStates.push({id:source.id,state,observed_at:result.observed_at||null});
      if(state!=='AVAILABLE')continue;
      for(const record of (result.items||[]).slice(0,100)){
        if(!source.visible(ctx,actor,record))continue;
        const projection=source.project(record),hay=words(JSON.stringify(projection));
        const score=[...terms].filter(x=>hay.has(x)).length;
        if(terms.size&&!score)continue;
        take({id:String(record.id||record.knowledge_id||C.hash(projection)),kind:'SOURCE',source_id:source.id,
          provenance:record.provenance||{source_class:source.source_class,observed_at:result.observed_at||null},
          data:projection,untrusted_data:true});
      }
    }catch(error){if(error.statusCode===401)throw error;sourceStates.push({id:source.id,state:error.statusCode===403?'PERMISSION_DENIED':'UNAVAILABLE',code:error.code||'SOURCE_ERROR'});}
  }
  for(const row of memoryResult.items){
    if(!memory.authorize(ctx,actor,row))continue;
    take({id:row.id,kind:'MEMORY',layer:row.layer,key:row.key,text:row.text,confidence:row.confidence,
      freshness:row.freshness,provenance:row.provenance,authority:row.authority,sensitivity:row.sensitivity,
      conflict:memoryResult.conflicts.some(x=>x.memory_ids.includes(row.id)),untrusted_data:true});
  }
  const conversation=[];
  for(const row of history.slice(-24).reverse()){
    if(!['user','assistant'].includes(row.role)||typeof row.content!=='string')continue;
    const projection={role:row.role,content:row.content.slice(0,8000)},bytes=Buffer.byteLength(JSON.stringify(projection));
    if(used+bytes>maxBytes)break;used+=bytes;conversation.unshift(projection);
  }
  return {schema_version:1,items:selected,conversation,source_states:sourceStates,conflicts:memoryResult.conflicts,
    limits:{max_bytes:maxBytes,used_bytes:used,max_ms:deadline},withheld,latency_ms:performance.now()-started,
    permission_checked:true,truth_policy:'Customer records remain authoritative; memory, research and inference never silently replace them.'};
}
module.exports={assembleContext};
