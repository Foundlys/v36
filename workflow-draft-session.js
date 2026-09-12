'use strict';
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FoundlyWorkflowDraftSession=api;})(globalThis,()=>{
  function create({id,revision=0,request,onState=()=>{}}){
    let sequence=Promise.resolve(),conflict=false;
    return {save(draft){const snapshot=JSON.parse(JSON.stringify(draft));const operation=sequence.then(async()=>{
      if(conflict)throw new Error('Laad het gewijzigde concept of bewaar je invoer als nieuw concept.');
      onState('SAVING');try{const result=await request(`/api/automation/drafts/${encodeURIComponent(id)}`,{method:'PUT',body:JSON.stringify({draft:snapshot,expected_revision:revision})});revision=result.record.revision;onState('SAVED',result.record);return result.record;}
      catch(error){conflict=error.status===409||error.data?.code==='workflow_draft_conflict'||error.code==='workflow_draft_conflict';onState(conflict?'CONFLICT':'ERROR');throw error;}
    });sequence=operation.catch(()=>{});return operation;},get revision(){return revision;}};
  }
  return {create};
});
