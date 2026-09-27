'use strict';

// An opt-in synchronous boundary around the existing encrypted atomic file.
// Native APIs still perform every permission, validation, receipt and audit
// step. Intermediate persist requests are deferred; no result is acknowledged
// until the whole boundary is durable. A failed final write restores all maps.
function createCoreStateTransaction({maps,persist,readDirty,restoreDirty}){
 if(!Array.isArray(maps)||maps.some(map=>!(map instanceof Map))||typeof persist!=='function')throw TypeError('Invalid core transaction adapter');
 let active=false;
 const sync=fn=>{const result=fn();if(result&&typeof result.then==='function')throw Object.assign(Error('Core state transaction must be synchronous'),{code:'core_transaction_async'});return result;};
 return {
  defer(){return active;},
  run(mutate){
   if(Object.prototype.toString.call(mutate)!=='[object Function]')throw Object.assign(Error('Core state transaction requires a synchronous callback'),{code:'core_transaction_async'});
   if(active)throw Object.assign(Error('Nested core state transaction is not supported'),{code:'core_transaction_reentry'});
   const snapshots=maps.map(map=>JSON.parse(JSON.stringify([...map.entries()]))),dirty=readDirty?.();
   active=true;
   try{
    const result=sync(mutate);active=false;
    // This is the sole durable acknowledgement for this boundary. The
    // underlying writer still encrypts, fsyncs and atomically renames the file.
    persist();return result;
   }catch(error){
    for(let i=0;i<maps.length;i++){maps[i].clear();for(const [key,value] of snapshots[i])maps[i].set(key,value);}
    restoreDirty?.(dirty);throw error;
   }finally{active=false;}
  }
 };
}
module.exports={createCoreStateTransaction};
