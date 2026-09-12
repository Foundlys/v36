'use strict';
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FoundlyDashboardSession=api;})(globalThis,()=>{
  function create(){
    let generation=0,loadedKey=null,saving=null;
    const clone=value=>JSON.parse(JSON.stringify(value));
    return {
      beginLoad(key){loadedKey=null;return {key,generation:++generation};},
      finishLoad(ticket){if(ticket.generation!==generation)return false;loadedKey=ticket.key;return true;},
      beginSave(key,draft){if(loadedKey!==key)throw Error('Laad eerst het dashboard voor deze selectie.');if(saving)return null;return saving={key,generation,draft:clone(draft)};},
      finishSave(ticket,saved,currentDraft,currentKey=ticket.key){
        if(ticket!==saving)return {applied:false};saving=null;
        if(ticket.generation!==generation||ticket.key!==loadedKey||ticket.key!==currentKey)return {applied:false};
        const dirty=JSON.stringify(currentDraft)!==JSON.stringify(ticket.draft);
        return {applied:true,dirty,dashboard:dirty?{...clone(currentDraft),id:saved.id,revision:saved.revision,created_at:saved.created_at,updated_at:saved.updated_at,updated_by:saved.updated_by,persisted:true,preset:false}:clone(saved)};
      },
      failSave(ticket){if(ticket===saving)saving=null;},
      get saving(){return Boolean(saving);}
    };
  }
  return {create};
});
