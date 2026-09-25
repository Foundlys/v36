'use strict';
(function(root){
  const fields=['request_id','request_fingerprint','workflow_id','run_id','request_signature','step_index','run_actor_id'],object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value),clone=value=>JSON.parse(JSON.stringify(value));
  const id=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/.test(value),hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value),integer=value=>Number.isSafeInteger(value)&&value>=0;
  const canonical=value=>Array.isArray(value)?value.map(canonical):object(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value,same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
  const digest=async value=>Array.from(new Uint8Array(await root.crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value)))),byte=>byte.toString(16).padStart(2,'0')).join('');
  const shape=row=>({name:row.name,version:row.version,trigger:row.trigger,actions:row.actions,enabled:row.enabled!==false,approval_required:Boolean(row.approval_required)}),invalid=()=>Object.assign(Error('approval_observation_invalid'),{code:'approval_observation_invalid'});
  const metadata=value=>object(value)&&Object.keys(value).length===fields.length&&fields.every(key=>Object.hasOwn(value,key))&&['request_id','workflow_id','run_id','run_actor_id'].every(key=>id(value[key]))&&['request_fingerprint','request_signature'].every(key=>hash(value[key]))&&integer(value.step_index)&&value.step_index<100;
  function create({document,request,requestContext,isActive=()=>true,row=null}){
    if(row)row=clone(row);const realm=clone(requestContext||{}),i18n=root.FoundlyI18n,el=tag=>document.createElement(tag),box=el('fieldset'),bindings=new Map(),active=()=>box.isConnected&&isActive();
    const text=(key,params={})=>i18n.t('workflow.approval.'+key,params),common=(key,params={})=>i18n.t('workflow.run.'+key,params),bind=(node,read)=>{node.textContent=read();bindings.set(node,{read,last:node.textContent});return node;},owned=(tag,key)=>bind(el(tag),()=>text(key));
    const notice=el('output');notice.setAttribute('aria-live','polite');box.append(owned('legend',row?'legend':'recovery'),notice);const message=(key,shared=true)=>bind(notice,()=>shared?common(key):text(key));
    document.addEventListener('foundly:locale',()=>{if(!active())return;for(const [node,binding]of bindings)if(node.textContent===binding.last){binding.last=binding.read();node.textContent=binding.last;}});
    const realmValid=['tenant_id','dealer_id','actor_id'].every(key=>typeof realm[key]==='string'&&realm[key].length>0),storageKey='foundly.workflow.approvals.v1:'+JSON.stringify([realm.tenant_id,realm.dealer_id,realm.actor_id]);let storageReady=realmValid,busy=false,pending=null,preview=null,done=false;
    function read(){if(!realmValid)throw invalid();const raw=root.sessionStorage.getItem(storageKey),rows=raw===null?[]:JSON.parse(raw);if(!Array.isArray(rows)||rows.length>100||rows.some(value=>!metadata(value))||new Set(rows.map(value=>value.request_id)).size!==rows.length)throw invalid();return rows;}
    function write(rows){if(rows.length)root.sessionStorage.setItem(storageKey,JSON.stringify(rows));else root.sessionStorage.removeItem(storageKey);}
    function remember(meta){const rows=read();if(rows.some(value=>value.run_id===meta.run_id))throw invalid();if(rows.length>=100)throw invalid();write([...rows,meta]);}
    function forget(meta){try{write(read().filter(value=>value.request_id!==meta.request_id));return true;}catch{storageReady=false;return false;}}
    let prior=[];try{prior=read();}catch{storageReady=false;message('storage_required');}
    const statuses=new Set(['RUNNING','PLANNED','SUCCEEDED','ERROR','BLOCKED','AWAITING_APPROVAL','WAITING_TIME','WAITING_RETRY','DEAD_LETTER','RECOVERY_READY']),stepStatuses=new Set([...statuses,'FAILED','PLANNED_INTERNAL','SKIPPED_CONDITION']);
    async function verifyRun(run,meta,workflow){
      if(!object(workflow)||!object(run)||workflow.id!==meta.workflow_id||!hash(workflow.signature)||workflow.signature!==await digest(shape(workflow))||run.automation_id!==meta.workflow_id||run.run_id!==meta.run_id||run.actor_id!==meta.run_actor_id||run.tenant_id!==realm.tenant_id||run.dealer_id!==realm.dealer_id||run.workflow_version!==workflow.version||run.request_signature!==meta.request_signature||!same(run.approval&&{reference:run.approval.reference,actor_id:run.approval.actor_id,run_id:run.approval.run_id,request_signature:run.approval.request_signature,approved:run.approval.approved},{reference:meta.request_id,actor_id:realm.actor_id,run_id:meta.run_id,request_signature:meta.request_signature,approved:true})||await digest(canonical({workflow:workflow.signature,trigger:run.trigger,inputs:run.inputs}))!==meta.request_signature||!statuses.has(run.status)||run.replay_safe!==true||!Array.isArray(run.outputs)||!Array.isArray(run.errors)||!Array.isArray(run.steps)||run.steps.length>workflow.actions.length)throw invalid();
      if(run.steps.some((step,index)=>!object(step)||step.index!==index||step.idempotency_key!==`workflow:${run.run_id}:${index}`||step.type!==workflow.actions[index].type.toLowerCase()||!same(step.input,workflow.actions[index])||!stepStatuses.has(step.status)||step.status==='SUCCEEDED'&&step.type!=='delay'&&(!integer(step.output_index)||run.outputs[step.output_index]?.executed!==true)))throw invalid();
      if(run.status==='SUCCEEDED'&&(run.steps.length!==workflow.actions.length||run.steps.some(step=>!['SUCCEEDED','SKIPPED_CONDITION'].includes(step.status))))throw invalid();
      return run;
    }
    function confirmed(run,clean){bind(notice,()=>text('confirmed',{id:run.run_id,status:i18n.t('workflow.status.'+run.status.toLowerCase())})+(!clean?' '+common('confirmed_metadata'):''));}
    async function reconcile(meta){
      const result=await request('/api/automation/approval-requests/recover',{method:'POST',body:JSON.stringify({...meta,confirm:true})});if(!active())return false;
      if(!object(result)||!fields.every(key=>result[key]===meta[key])||!same(result.request_context,realm)||result.execution_performed!==false||result.approval_performed!==false||!['APPLIED','NOT_APPLIED'].includes(result.state))throw invalid();
      let run=null;if(result.state==='APPLIED')run=await verifyRun(result.run,meta,result.workflow);else if(result.run!==null||result.workflow!==null)throw invalid();if(!active())return false;
      const clean=forget(meta);if(run)confirmed(run,clean);else message(clean?'not_applied':'confirmed_metadata',!clean);return true;
    }
    function feedback(error){if(!active())return;if([401,403].includes(error.status||error.statusCode))bind(notice,()=>i18n.t('common.access_denied'));else message(storageReady?'unconfirmed':'storage_required');}
    if(!row){
      for(const meta of prior){const recover=owned('button','recover');recover.type='button';recover.setAttribute('data-approval-action','recover');recover.setAttribute('data-approval-run',meta.run_id);box.append(recover);let resolved=false;recover.addEventListener('click',async()=>{if(!active()||busy||resolved||!storageReady)return;busy=true;recover.disabled=true;try{resolved=await reconcile(meta);}catch(error){feedback(error);}finally{busy=false;if(active())recover.disabled=resolved||!storageReady;}});}
      if(!prior.length&&storageReady)box.hidden=true;return box;
    }
    const prepare=owned('button','prepare'),confirm=owned('button','confirm'),reason=el('input'),reasonLabel=el('label'),review=el('pre');reason.maxLength=500;reasonLabel.append(owned('span','reason'),reason);prepare.type=confirm.type='button';prepare.setAttribute('data-approval-action','prepare');confirm.setAttribute('data-approval-action','confirm');box.append(prepare,review,reasonLabel,confirm);
    bind(confirm,()=>text(pending?.submitted?'recover':'confirm'));
    function lock(){if(!active())return;const entry=bindings.get(confirm);entry.last=entry.read();confirm.textContent=entry.last;prepare.disabled=busy||done||!!pending||!storageReady||prior.some(meta=>meta.run_id===row.run_id);confirm.disabled=busy||done||!storageReady||!pending&&!preview;reason.disabled=busy||done||!!pending;}
    prepare.addEventListener('click',async()=>{
      if(!active()||busy||prepare.disabled)return;busy=true;preview=null;lock();
      try{const p=await request('/api/automation/runs/'+encodeURIComponent(row.run_id)+'/approval-preview');if(!active())return;
        if(!object(p)||!same(p.request_context,realm)||p.run_id!==row.run_id||p.workflow_id!==row.automation_id||p.workflow_version!==row.workflow_version||p.run_actor_id!==row.actor_id||p.request_signature!==row.request_signature||p.execution_performed!==false||p.approval_performed!==false||!object(p.step)||p.step.status!=='AWAITING_APPROVAL'||p.step.index!==row.steps.find(step=>step.status==='AWAITING_APPROVAL')?.index||!object(p.definition)||!hash(p.workflow_signature)||!hash(p.preview_fingerprint)||p.workflow_signature!==await digest(shape(p.definition))||await digest(canonical({workflow:p.workflow_signature,trigger:p.event,inputs:p.inputs}))!==p.request_signature||!same(p.event,row.trigger)||!same(p.inputs,row.inputs)||!same(p.step.input,p.definition.actions[p.step.index]))throw invalid();
        if(!active())return;preview=clone(p);bind(review,()=>[p.definition.name,text('review'),common('event',{value:JSON.stringify(p.event)}),common('inputs',{value:JSON.stringify(p.inputs)}),...p.definition.actions.flatMap((action,index)=>[i18n.number(index+1)+'. '+i18n.t('workflow.action.'+action.type),...['title','content','message','seconds'].filter(key=>Object.hasOwn(action,key)).map(key=>i18n.t('workflow.generator.'+key)+': '+action[key]),...Object.keys(action).filter(key=>!['type','title','content','message','seconds'].includes(key)).map(key=>key+': '+JSON.stringify(action[key]))])].join('\n'));message('review',false);
      }catch(error){feedback(error);}finally{busy=false;lock();}
    });
    confirm.addEventListener('click',async()=>{
      if(!active()||busy||confirm.disabled)return;if(!pending){if(!preview||!reason.value.trim()||reason.value.trim().length>500){message('reason_required');return;}pending={preview,input:{run_id:row.run_id,request_signature:row.request_signature,reference:root.crypto.randomUUID(),reason:reason.value.trim(),step_index:preview.step.index,preview_fingerprint:preview.preview_fingerprint},submitted:false};}
      const current=pending;busy=true;lock();
      try{
        if(current.submitted){if(await reconcile(current.meta)){done=true;pending=null;}return;}
        const p=current.preview;current.meta={request_id:current.input.reference,request_fingerprint:await digest(current.input),workflow_id:row.automation_id,run_id:row.run_id,request_signature:row.request_signature,step_index:p.step.index,run_actor_id:row.actor_id};if(!active())return;
        try{remember(current.meta);}catch{storageReady=false;throw invalid();}if(!active())return;current.submitted=true;
        const run=await request('/api/automation/workflows/'+encodeURIComponent(row.automation_id)+'/runs',{method:'POST',body:JSON.stringify({event:p.event,options:{inputs:p.inputs,approval:current.input}})});if(!active())return;
        if(!same(run?.approval_acknowledgement,{...current.meta,request_context:realm}))throw invalid();await verifyRun(run,current.meta,{...p.definition,id:p.workflow_id,signature:p.workflow_signature});if(!active())return;
        const clean=forget(current.meta);done=true;pending=null;confirmed(run,clean);
      }catch(error){feedback(error);}finally{busy=false;lock();}
    });lock();return box;
  }
  root.FoundlyWorkflowApproval={create};
})(globalThis);
