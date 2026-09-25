'use strict';
(function(root,factory){const native=typeof module==='object'&&module.exports,sha=native?async text=>require('node:crypto').createHash('sha256').update(text).digest('hex'):async text=>Array.from(new Uint8Array(await root.crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),byte=>byte.toString(16).padStart(2,'0')).join('');const api=factory(sha);if(native)module.exports=api;else root.FoundlyWorkflowDraftSession=api;})(globalThis,sha=>{
  const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value),hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
  const error=(code,message=code)=>Object.assign(Error(message),{code});
  async function acknowledge(result,{id,revision,body,requestContext}){
    const row=result?.record,realm=result?.request_context;
    if(!object(result)||!object(row)||!object(realm)||result.draft_id!==id||result.expected_revision!==revision||typeof result.deduplicated!=='boolean'||result.executable!==false||row.id!==id||row.revision!==revision+1||row.request_revision!==revision||row.status!=='DRAFT'||row.executable!==false||row.schema_version!==1||!object(row.draft)||!hash(row.fingerprint)||!hash(result.request_fingerprint)||!['tenant_id','dealer_id','actor_id'].every(key=>typeof realm[key]==='string'&&realm[key].length>0)||row.owner_id!==realm.actor_id||row.tenant_id!==realm.tenant_id||row.dealer_id!==realm.dealer_id||requestContext&&!['tenant_id','dealer_id','actor_id'].every(key=>realm[key]===requestContext[key]))throw error('workflow_draft_ack_invalid');
    // Bind both the exact dispatched input and the native normalized result.
    // Partial draft normalization stays exclusively in the native draft store.
    if(result.request_fingerprint!==await sha(body)||row.fingerprint!==await sha(JSON.stringify(row.draft)))throw error('workflow_draft_ack_invalid');
    return row;
  }
  function create({id,revision=0,request,requestContext,onState=()=>{},isActive=()=>true}){
    if(requestContext)requestContext=Object.freeze({...requestContext});
    let sequence=Promise.resolve(),conflict=false,pending=null;
    const active=()=>{if(!isActive())throw error('workflow_draft_session_inactive');};
    const state=(value,record)=>{if(isActive())try{onState(value,record);}catch{/* An observer cannot undo a native acknowledgement. */}};
    async function dispatch(){
      active();const current=pending;
      try{
        const result=await request(`/api/automation/drafts/${encodeURIComponent(id)}`,{method:'PUT',body:current.body});active();
        const row=await acknowledge(result,{id,revision:current.revision,body:current.body,requestContext});active();revision=row.revision;pending=null;return row;
      }catch(reason){
        const status=reason.status||reason.statusCode;conflict=status===409||reason.data?.code==='workflow_draft_conflict'||reason.code==='workflow_draft_conflict';
        // Validation before any uncertain outcome is definitive. Transport loss,
        // access loss and malformed acknowledgements retain the original body.
        if(!current.uncertain&&[400,413,422].includes(status))pending=null;else current.uncertain=true;
        throw reason;
      }
    }
    return {save(draft){const serialized=JSON.stringify(draft);const operation=sequence.then(async()=>{
      active();if(conflict)throw error('workflow_draft_conflict','Laad het gewijzigde concept of bewaar je invoer als nieuw concept.');state('SAVING');
      try{
        let row;if(pending){const previous=pending.serialized;row=await dispatch();if(previous===serialized){state('SAVED',row);return row;}}
        active();pending={serialized,revision,body:JSON.stringify({draft:JSON.parse(serialized),expected_revision:revision}),uncertain:false};row=await dispatch();state('SAVED',row);return row;
      }catch(reason){state(conflict?'CONFLICT':'ERROR');throw reason;}
    });sequence=operation.catch(()=>{});return operation;},get revision(){return revision;},get uncertain(){return !conflict&&Boolean(pending?.uncertain);}};
  }
  return {create,acknowledge};
});
