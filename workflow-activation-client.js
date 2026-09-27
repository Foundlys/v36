'use strict';
(function(root){
  const fields=['request_id','request_fingerprint','workflow_id','workflow_signature','expected_revision','active'],object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value),clone=value=>JSON.parse(JSON.stringify(value));
  const id=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/.test(value),hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value),integer=value=>Number.isSafeInteger(value)&&value>=0;
  const digest=async value=>Array.from(new Uint8Array(await root.crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value)))),byte=>byte.toString(16).padStart(2,'0')).join('');
  const shape=row=>({name:row.name,version:row.version,trigger:row.trigger,actions:row.actions,enabled:row.enabled!==false,approval_required:Boolean(row.approval_required)}),metadata=meta=>object(meta)&&Object.keys(meta).length===fields.length&&fields.every(key=>Object.hasOwn(meta,key))&&id(meta.request_id)&&id(meta.workflow_id)&&hash(meta.request_fingerprint)&&hash(meta.workflow_signature)&&integer(meta.expected_revision)&&typeof meta.active==='boolean',invalid=()=>Object.assign(Error('activation_observation_invalid'),{code:'activation_observation_invalid'});
  const realmFields=['tenant_id','dealer_id','actor_id'];
  function create({document,request,requestContext,isActive=()=>true,workflow=null}){
    if(workflow)workflow=clone(workflow);const realm=clone(requestContext||{}),i18n=root.FoundlyI18n,el=tag=>document.createElement(tag),box=el(workflow?'form':'fieldset'),bindings=new Map(),active=()=>box.isConnected&&isActive(),text=(key,params={})=>i18n.t('workflow.activation.'+key,params),common=key=>i18n.t('workflow.run.'+key);
    const bind=(node,read)=>{node.textContent=read();bindings.set(node,{read,last:node.textContent});return node;},owned=(tag,key)=>bind(el(tag),()=>text(key)),notice=el('output');notice.setAttribute('aria-live','polite');box.append(owned(workflow?'h4':'legend',workflow?'legend':'recovery'),notice);const message=(key,shared=false)=>bind(notice,()=>shared?common(key):text(key));
    document.addEventListener('foundly:locale',()=>{if(!active())return;for(const [node,binding]of bindings)if(node.textContent===binding.last){binding.last=binding.read();node.textContent=binding.last;}});
    const realmValid=realmFields.every(key=>typeof realm[key]==='string'&&realm[key].length>0),storageKey='foundly.workflow.activations.v1:'+JSON.stringify(realmFields.map(key=>realm[key]));let ready=realmValid,busy=false,pending=null,done=false,prior=[];
    function read(){if(!realmValid)throw invalid();const raw=root.sessionStorage.getItem(storageKey),rows=raw===null?[]:JSON.parse(raw);if(!Array.isArray(rows)||rows.length>100||rows.some(row=>!metadata(row))||new Set(rows.map(row=>row.request_id)).size!==rows.length)throw invalid();return rows;}
    function write(rows){if(rows.length)root.sessionStorage.setItem(storageKey,JSON.stringify(rows));else root.sessionStorage.removeItem(storageKey);}
    function forget(meta){try{write(read().filter(row=>row.request_id!==meta.request_id));return true;}catch{ready=false;return false;}}
    try{prior=read();}catch{ready=false;message('storage_required');}
    async function verifyActivation(value,meta,source,input=null){
      if(!object(source)||source.id!==meta.workflow_id||source.signature!==meta.workflow_signature||source.signature!==await digest(shape(source))||source.tenant_id!==realm.tenant_id||source.dealer_id!==realm.dealer_id||!object(value)||value.id!==await digest([source.created_by,source.name])||value.tenant_id!==realm.tenant_id||value.dealer_id!==realm.dealer_id||value.owner_id!==source.created_by||value.workflow_name!==source.name||value.updated_by!==realm.actor_id||value.revision!==meta.expected_revision+1||value.active_workflow_id!==(meta.active?meta.workflow_id:null)||value.status!==(meta.active?'ACTIVE':'PAUSED')||!hash(value.request_signature))throw invalid();
      if(input&&(value.reason!==input.reason.trim()||value.request_signature!==await digest({workflow_id:meta.workflow_id,actor_id:realm.actor_id,input})))throw invalid();return value;
    }
    function confirmed(value,clean){bind(notice,()=>text(value.status==='ACTIVE'?'active_saved':'pause_saved')+(!clean?' '+common('confirmed_metadata'):''));}
    async function reconcile(meta){
      const result=await request('/api/automation/activation-requests/recover',{method:'POST',body:JSON.stringify({...meta,confirm:true})});if(!active())return false;
      if(!object(result)||!fields.every(key=>result[key]===meta[key])||!object(result.request_context)||!realmFields.every(key=>result.request_context[key]===realm[key])||result.activation_performed!==false||result.execution_performed!==false||!['APPLIED','NOT_APPLIED','SUPERSEDED'].includes(result.state))throw invalid();
      if(result.state==='APPLIED')await verifyActivation(result.activation,meta,result.workflow);else if(result.activation!==null||result.workflow!==null)throw invalid();if(!active())return false;
      const clean=forget(meta);if(result.state==='APPLIED')confirmed(result.activation,clean);else message(clean?(result.state==='SUPERSEDED'?'superseded':'not_applied'):'confirmed_metadata',!clean);return true;
    }
    function feedback(error){if(!active())return;if([401,403].includes(error.status||error.statusCode))bind(notice,()=>i18n.t('common.access_denied'));else message(ready?'unconfirmed':'storage_required');}
    if(!workflow){for(const meta of prior){const recover=owned('button','recover');recover.type='button';recover.setAttribute('data-activation-action','recover');box.append(recover);let resolved=false;recover.addEventListener('click',async()=>{if(!active()||busy||resolved||!ready)return;busy=true;recover.disabled=true;try{resolved=await reconcile(meta);}catch(error){feedback(error);}finally{busy=false;if(active())recover.disabled=resolved||!ready;}});}if(!prior.length&&ready)box.hidden=true;return box;}
    const reason=el('input'),reasonLabel=el('label'),confirm=el('input'),confirmLabel=el('label'),activate=owned('button','activate'),pause=owned('button','pause');reason.required=true;reason.maxLength=500;confirm.type='checkbox';confirm.required=true;reasonLabel.append(owned('span','reason'),reason);confirmLabel.append(confirm,owned('span','confirm'));activate.type=pause.type='submit';activate.value='activate';pause.value='pause';activate.setAttribute('data-activation-action','activate');pause.setAttribute('data-activation-action','pause');box.append(reasonLabel,confirmLabel,activate,pause);
    bind(activate,()=>text(pending?.submitted?'recover':'activate'));bind(pause,()=>text(pending?.submitted?'recover':'pause'));
    const lock=(initial=false)=>{if(!initial&&!active())return;const blocked=busy||done||!ready||prior.some(meta=>meta.workflow_id===workflow.id);reason.disabled=confirm.disabled=blocked||!!pending;activate.disabled=blocked;pause.disabled=blocked||!pending&&workflow.activation_mode==='PAUSED';for(const button of [activate,pause]){const entry=bindings.get(button);entry.last=entry.read();button.textContent=entry.last;}};
    box.addEventListener('submit',async event=>{
      event.preventDefault();if(!active()||busy||done||!ready)return;
      if(!pending){const choice=event.submitter;if(![activate,pause].includes(choice)||choice.disabled||confirm.checked!==true||!reason.value.trim()||reason.value.trim().length>500||!integer(workflow.activation_revision)){message('confirm_required');return;}pending={input:{active:choice===activate,confirm:true,expected_revision:workflow.activation_revision,reason:reason.value.trim(),request_id:root.crypto.randomUUID()},submitted:false};}
      const current=pending;busy=true;lock();try{
        if(current.submitted){if(await reconcile(current.meta)){done=true;pending=null;}return;}
        const input=current.input;current.meta={request_id:input.request_id,request_fingerprint:await digest(input),workflow_id:workflow.id,workflow_signature:workflow.signature,expected_revision:input.expected_revision,active:input.active};if(!active())return;
        if(workflow.signature!==await digest(shape(workflow))||!metadata(current.meta))throw invalid();if(!active())return;
        try{const rows=read();if(rows.length>=100||rows.some(row=>row.workflow_id===workflow.id))throw invalid();write([...rows,current.meta]);}catch{ready=false;throw invalid();}if(!active())return;current.submitted=true;
        const result=await request('/api/automation/workflows/'+encodeURIComponent(workflow.id)+'/activation',{method:'PUT',body:JSON.stringify(input)});if(!active())return;const ack=result?.request_acknowledgement;if(!object(ack)||!fields.every(key=>ack[key]===current.meta[key])||!object(ack.request_context)||!realmFields.every(key=>ack.request_context[key]===realm[key]))throw invalid();await verifyActivation(result,current.meta,workflow,input);if(!active())return;
        done=true;pending=null;confirmed(result,forget(current.meta));
      }catch(error){feedback(error);}finally{busy=false;lock();}
    });lock(true);return box;
  }
  root.FoundlyWorkflowActivation={create};
})(globalThis);
