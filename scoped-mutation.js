'use strict';

// Synchronous mutations on the existing encrypted adapter. A failed atomic
// persist restores precisely the touched in-memory buckets before returning.
function scopedMutation(adapter,ctx,scopes,mutate){
  const saved=[...new Set(scopes)].map(scope=>{const rows=adapter.bucket(ctx,scope);return {rows,copy:JSON.parse(JSON.stringify(rows))};});
  try{
    const result=mutate();
    if(result&&typeof result.then==='function')throw Object.assign(new Error('Synchronous transaction required'),{code:'mutation_async_not_supported'});
    adapter.persist();return result;
  }catch(error){for(const {rows,copy} of saved){rows.length=0;for(const row of copy)rows.push(row);}throw error;}
}
module.exports={scopedMutation};
