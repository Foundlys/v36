'use strict';
(function(root){
  const fields=['request_id','request_fingerprint','workflow_id','workflow_signature','run_id','request_signature','step_index','preview_fingerprint'],object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value),clone=value=>JSON.parse(JSON.stringify(value));
  const id=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/.test(value),hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value),integer=value=>Number.isSafeInteger(value)&&value>=0;
  const canonical=value=>Array.isArray(value)?value.map(canonical):object(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value,same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
  const digest=async value=>Array.from(new Uint8Array(await root.crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value)))),byte=>byte.toString(16).padStart(2,'0')).join('');
  const shape=row=>({name:row.name,version:row.version,trigger:row.trigger,actions:row.actions,enabled:row.enabled!==false,approval_required:Boolean(row.approval_required)}),invalid=()=>Object.assign(Error('resume_observation_invalid'),{code:'resume_observation_invalid'});
  const metadata=value=>object(value)&&Object.keys(value).length===fields.length&&fields.every(key=>Object.hasOwn(value,key))&&['request_id','workflow_id','run_id'].every(key=>id(value[key]))&&['request_fingerprint','workflow_signature','request_signature','preview_fingerprint'].every(key=>hash(value[key]))&&integer(value.step_index)&&value.step_index<=100;
  function create({document,request,requestContext,isActive=()=>true,row=null}){
    if(row)row=clone(row);const realm=clone(requestContext||{}),i18n=root.FoundlyI18n,el=tag=>document.createElement(tag),box=el('fieldset'),bindings=new Map(),active=()=>box.isConnected&&isActive();
    const text=(key,params={})=>i18n.t('workflow.resume.'+key,params),common=(key,params={})=>i18n.t('workflow.run.'+key,params),bind=(node,read)=>{node.textContent=read();bindings.set(node,{read,last:node.textContent});return node;},owned=(tag,key)=>bind(el(tag),()=>text(key));
    const notice=el('output');notice.setAttribute('aria-live','polite');box.append(owned('legend',row?'legend':'recovery'),notice);const message=(key,shared=true)=>bind(notice,()=>shared?common(key):text(key));
    document.addEventListener('foundly:locale',()=>{if(!active())return;for(const [node,binding]of bindings)if(node.textContent===binding.last){binding.last=binding.read();node.textContent=binding.last;}});
    const realmValid=['tenant_id','dealer_id','actor_id'].every(key=>typeof realm[key]==='string'&&realm[key].length>0),storageKey='foundly.workflow.resumes.v1:'+JSON.stringify([realm.tenant_id,realm.dealer_id,realm.actor_id]);let storageReady=realmValid,busy=false,pending=null,preview=null,done=false;
    function read(){if(!realmValid)throw invalid();const raw=root.sessionStorage.getItem(storageKey),rows=raw===null?[]:JSON.parse(raw);if(!Array.isArray(rows)||rows.length>100||rows.some(value=>!metadata(value))||new Set(rows.map(value=>value.request_id)).size!==rows.length)throw invalid();return rows;}
    function write(rows){if(rows.length)root.sessionStorage.setItem(storageKey,JSON.stringify(rows));else root.sessionStorage.removeItem(storageKey);}
    function remember(meta){const rows=read();if(rows.some(value=>value.run_id===meta.run_id))throw invalid();if(rows.length>=100)throw invalid();write([...rows,meta]);}
    function forget(meta){try{write(read().filter(value=>value.request_id!==meta.request_id));return true;}catch{storageReady=false;return false;}}
    let prior=[];try{prior=read();}catch{storageReady=false;message('storage_required');}
    const statuses=new Set(['RUNNING','PLANNED','SUCCEEDED','ERROR','BLOCKED','AWAITING_APPROVAL','WAITING_TIME','WAITING_RETRY','DEAD_LETTER','RECOVERY_READY']),stepStatuses=new Set([...statuses,'FAILED','PLANNED_INTERNAL','SKIPPED_CONDITION']);
    async function verifyRun(run,meta,workflow){
      if(!object(workflow)||!object(run)||workflow.id!==meta.workflow_id||workflow.signature!==meta.workflow_signature||!hash(workflow.signature)||workflow.signature!==await digest(shape(workflow))||workflow.tenant_id!==realm.tenant_id||workflow.dealer_id!==realm.dealer_id||run.automation_id!==meta.workflow_id||run.run_id!==meta.run_id||run.actor_id!==realm.actor_id||run.tenant_id!==realm.tenant_id||run.dealer_id!==realm.dealer_id||run.workflow_version!==workflow.version||run.request_signature!==meta.request_signature||await digest(canonical({workflow:workflow.signature,trigger:run.trigger,inputs:run.inputs}))!==meta.request_signature||!statuses.has(run.status)||run.replay_safe!==true||!Array.isArray(run.outputs)||!Array.isArray(run.errors)||!Array.isArray(run.steps)||run.steps.length>workflow.actions.length)throw invalid();
      if(run.steps.some((step,index)=>!object(step)||step.index!==index||step.idempotency_key!==`workflow:${run.run_id}:${index}`||step.type!==workflow.actions[index].type.toLowerCase()||!same(step.input,workflow.actions[index])||!stepStatuses.has(step.status)||step.status==='SUCCEEDED'&&step.type!=='delay'&&(!integer(step.output_index)||run.outputs[step.output_index]?.executed!==true)))throw invalid();
      if(run.status==='SUCCEEDED'&&(run.steps.length!==workflow.actions.length||run.steps.some(step=>!['SUCCEEDED','SKIPPED_CONDITION'].includes(step.status))))throw invalid();return run;
    }
    function confirmed(run,clean){bind(notice,()=>text('confirmed',{id:run.run_id,status:i18n.t('workflow.status.'+run.status.toLowerCase())})+(!clean?' '+common('confirmed_metadata'):''));}
    async function reconcile(meta){
      const result=await request('/api/automation/resume-requests/recover',{method:'POST',body:JSON.stringify({...meta,confirm:true})});if(!active())return false;
      if(!object(result)||!fields.every(key=>result[key]===meta[key])||!same(result.request_context,realm)||result.execution_performed!==false||!['APPLIED','NOT_APPLIED'].includes(result.state))throw invalid();
      let run=null;if(result.state==='APPLIED')run=await verifyRun(result.run,meta,result.workflow);else if(result.run!==null||result.workflow!==null)throw invalid();if(!active())return false;
      const clean=forget(meta);if(run)confirmed(run,clean);else message(clean?'not_applied':'confirmed_metadata',!clean);return true;
    }
    function feedback(error){if(!active())return;if([401,403].includes(error.status||error.statusCode))bind(notice,()=>i18n.t('common.access_denied'));else message(storageReady?'unconfirmed':'storage_required');}
    if(!row){
      for(const meta of prior){const recover=owned('button','recover');recover.type='button';recover.setAttribute('data-resume-action','recover');recover.setAttribute('data-resume-run',meta.run_id);box.append(recover);let resolved=false;recover.addEventListener('click',async()=>{if(!active()||busy||resolved||!storageReady)return;busy=true;recover.disabled=true;try{resolved=await reconcile(meta);}catch(error){feedback(error);}finally{busy=false;if(active())recover.disabled=resolved||!storageReady;}});}
      if(!prior.length&&storageReady)box.hidden=true;return box;
    }
    const prepare=owned('button','prepare'),confirm=owned('button','confirm'),reason=el('input'),reasonLabel=el('label'),review=el('pre');reason.maxLength=500;reasonLabel.append(owned('span','reason'),reason);prepare.type=confirm.type='button';prepare.setAttribute('data-resume-action','prepare');confirm.setAttribute('data-resume-action','confirm');box.append(prepare,review,reasonLabel,confirm);
    bind(confirm,()=>text(pending?.submitted?'recover':'confirm'));
    function lock(initial=false){if(!initial&&!active())return;const entry=bindings.get(confirm);entry.last=entry.read();confirm.textContent=entry.last;prepare.disabled=busy||done||!!pending||!storageReady||prior.some(meta=>meta.run_id===row.run_id);confirm.disabled=busy||done||!storageReady||!pending&&!preview;reason.disabled=busy||done||!!pending;}
    prepare.addEventListener('click',async()=>{
      if(!active()||busy||prepare.disabled)return;busy=true;preview=null;lock();
      try{const p=await request('/api/automation/runs/'+encodeURIComponent(row.run_id)+'/resume-preview');if(!active())return;
        if(!object(p)||!same(p.request_context,realm)||p.run_id!==row.run_id||p.workflow_id!==row.automation_id||p.request_signature!==row.request_signature||p.execution_performed!==false||!integer(p.activation_revision)||!integer(p.recovery_revision)||!integer(p.step_index)||p.step_index>100||!hash(p.preview_fingerprint)||!['WAITING_TIME','WAITING_RETRY','RECOVERY_READY'].includes(p.run_status)||p.run_status!==row.status||p.run?.status!==p.run_status||p.next_wakeup_at!==(p.run?.next_wakeup_at||null))throw invalid();
        const target=p.run.steps.find(step=>!['SUCCEEDED','SKIPPED_CONDITION'].includes(step.status));if(p.step_index!==(target?.index??p.run.steps.length)||!same(p.step,target||null)||p.recovery_revision!==(p.run.recovery_revision||0)||p.workflow_signature!==p.workflow.signature)throw invalid();
        if(['WAITING_TIME','WAITING_RETRY'].includes(p.run_status)&&(!object(p.step)||p.step.status!==p.run_status||typeof p.next_wakeup_at!=='string'||!Number.isFinite(Date.parse(p.next_wakeup_at))))throw invalid();
        const basis=Object.fromEntries(['request_context','workflow_signature','activation_revision','run_id','request_signature','step_index','step','run_status','recovery_revision','next_wakeup_at'].map(key=>[key,p[key]]));if(p.preview_fingerprint!==await digest(basis))throw invalid();await verifyRun(p.run,{workflow_id:p.workflow_id,workflow_signature:p.workflow_signature,run_id:p.run_id,request_signature:p.request_signature},p.workflow);if(!active())return;
        preview=clone(p);bind(review,()=>[p.workflow.name,text('review'),p.step_index===p.workflow.actions.length?text('finish'):text('step',{index:i18n.number(p.step_index+1)}),...(p.next_wakeup_at?[text('wake',{time:i18n.date(p.next_wakeup_at,{dateStyle:'medium',timeStyle:'short',timeZone:'UTC'})})]:[]),common('event',{value:JSON.stringify(p.run.trigger)}),common('inputs',{value:JSON.stringify(p.run.inputs)}),...p.workflow.actions.flatMap((action,index)=>[i18n.number(index+1)+'. '+i18n.t('workflow.action.'+action.type),...['title','content','message','seconds'].filter(key=>Object.hasOwn(action,key)).map(key=>i18n.t('workflow.generator.'+key)+': '+action[key]),...Object.keys(action).filter(key=>!['type','title','content','message','seconds'].includes(key)).map(key=>key+': '+JSON.stringify(action[key]))])].join('\n'));message('review',false);
      }catch(error){feedback(error);}finally{busy=false;lock();}
    });
    confirm.addEventListener('click',async()=>{
      if(!active()||busy||confirm.disabled)return;if(!pending){if(!preview||!reason.value.trim()||reason.value.trim().length>500){message('reason_required');return;}pending={preview,input:{request_id:root.crypto.randomUUID(),confirm:true,reason:reason.value.trim(),run_id:row.run_id,request_signature:row.request_signature,step_index:preview.step_index,preview_fingerprint:preview.preview_fingerprint},submitted:false};}
      const current=pending;busy=true;lock();
      try{
        if(current.submitted){if(await reconcile(current.meta)){done=true;pending=null;}return;}
        const p=current.preview;current.meta={request_id:current.input.request_id,request_fingerprint:await digest(current.input),workflow_id:row.automation_id,workflow_signature:p.workflow_signature,run_id:row.run_id,request_signature:row.request_signature,step_index:p.step_index,preview_fingerprint:p.preview_fingerprint};if(!active())return;
        try{remember(current.meta);}catch{storageReady=false;throw invalid();}if(!active())return;current.submitted=true;
        const run=await request('/api/automation/runs/'+encodeURIComponent(row.run_id)+'/resume-confirmation',{method:'POST',body:JSON.stringify(current.input)});if(!active())return;
        if(!same(run?.resume_acknowledgement,{...current.meta,request_context:realm}))throw invalid();await verifyRun(run,current.meta,p.workflow);if(!active())return;
        const clean=forget(current.meta);done=true;pending=null;confirmed(run,clean);
      }catch(error){feedback(error);}finally{busy=false;lock();}
    });lock(true);return box;
  }
  root.FoundlyWorkflowResume={create};
})(globalThis);
