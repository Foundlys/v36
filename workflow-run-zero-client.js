'use strict';
(function(root){
 const fallback={legend:'Deze uitvoering met ZERO controleren',prepare:'Uitvoering met ZERO voorbereiden',confirm:'Bevestig uitvoering via ZERO',retry:'Dezelfde ZERO-uitvoering controleren',reason:'Reden voor deze uitvoering',dirty:'Invoer gewijzigd; controleer deze uitvoering opnieuw.',loading:'Uitvoerinvoer controleren…',reason_required:'Vul een reden van 1 tot 500 tekens in voor deze uitvoering.',review:'Er is geen run gestart. Controleer en bevestig deze exacte invoer.',invalid:'De ontvangen uitvoerbevestiging kon niet worden gecontroleerd.',failed:'De workflowuitvoering kon niet worden gecontroleerd.',unconfirmed:'De uitkomst is nog niet bevestigd. Controleer dezelfde aanvraag opnieuw; de bevestigde invoer blijft vaststaan.',confirmed:'Native run {id}: {status}.',approval_separate:'Gebruik de afzonderlijke goedkeuringsstap.',event:'Event: {value}',inputs:'Invoer: {value}',trigger:'Workflowtrigger: {value}',action_details:'Actiedefinitie: {value}',condition:'Voorwaarde: {value}',matches:'waar',skipped:'onwaar (wordt overgeslagen)'};
 const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value),hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value),integer=value=>Number.isSafeInteger(value)&&value>=0,clone=value=>JSON.parse(JSON.stringify(value));
 const canonical=value=>Array.isArray(value)?value.map(canonical):object(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value,same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
 const digest=async value=>Array.from(new Uint8Array(await root.crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value)))),byte=>byte.toString(16).padStart(2,'0')).join('');
 const statuses=new Set(['RUNNING','PLANNED','SUCCEEDED','ERROR','BLOCKED','AWAITING_APPROVAL','WAITING_TIME','WAITING_RETRY','DEAD_LETTER','RECOVERY_READY']),stepStatuses=new Set([...statuses,'FAILED','PLANNED_INTERNAL','SKIPPED_CONDITION']);
 const invalid=()=>Object.assign(Error('automation_run_ack_invalid'),{code:'automation_run_ack_invalid'}),shape=row=>({name:row.name,version:row.version,trigger:row.trigger,actions:row.actions,enabled:row.enabled!==false,approval_required:Boolean(row.approval_required)});
 function create({document,workflow,inputHost,getInput,canRequest,onBusy,zeroRequest,isActive=()=>true,requestContext}){
  workflow=clone(workflow);if(requestContext)requestContext=Object.freeze({...requestContext});
  const i18n=root.FoundlyI18n,bindings=new Map(),el=tag=>document.createElement(tag),box=el('fieldset'),active=()=>box.isConnected&&inputHost.isConnected&&isActive();
  const copy=(key,params={})=>i18n?i18n.t('workflow.run.'+key,params):(fallback[key]||key).replace(/\{(\w+)\}/g,(_,name)=>String(params[name])),shared=(key,fallback,params={})=>i18n?i18n.t(key,params):fallback.replace(/\{(\w+)\}/g,(_,name)=>String(params[name])),number=value=>i18n?i18n.number(value,{maximumSignificantDigits:21}):String(value),status=value=>shared('workflow.status.'+value.toLowerCase(),value);
  function bind(node,read){const value={read,last:read()};node.textContent=value.last;bindings.set(node,value);return node;}
  const owned=(tag,key)=>bind(el(tag),()=>copy(key)),legend=owned('legend','legend'),prepare=owned('button','prepare'),confirm=el('button'),reasonLabel=el('label'),reason=el('input'),output=el('pre'),notice=el('output');box.append(legend);reasonLabel.append(owned('span','reason'),reason);reason.maxLength=500;prepare.type=confirm.type='button';prepare.setAttribute('data-workflow-run-action','prepare');confirm.setAttribute('data-workflow-run-action','confirm');notice.setAttribute('aria-live','polite');box.append(prepare,output,reasonLabel,confirm,notice);
  let preview=null,pending=null,generation=0,busy=false;bind(confirm,()=>copy(pending?'retry':'confirm'));confirm.disabled=true;
  document.addEventListener?.('foundly:locale',()=>{if(!active())return;for(const [node,entry]of bindings)if(node.textContent===entry.last){entry.last=entry.read();node.textContent=entry.last;}});
  const message=key=>bind(notice,()=>copy(key)),clear=()=>{bindings.delete(output);output.textContent='';};
  function feedback(error,uncertain=false){const status=error.status||error.statusCode;if([401,403].includes(status)){bind(notice,()=>shared(status===403?'common.access_denied':'identity.auth_required',status===403?'Toegang geweigerd.':'Meld je opnieuw aan.'));return;}message(uncertain?'unconfirmed':error.code==='automation_run_ack_invalid'?'invalid':'failed');}
  function lock(){if(!active())return;onBusy(busy||Boolean(pending));prepare.disabled=busy||Boolean(pending);confirm.disabled=busy||!pending&&!preview;reason.disabled=busy||Boolean(pending);const entry=bindings.get(confirm);entry.last=entry.read();confirm.textContent=entry.last;}
  const changed=()=>{if(!active()||pending)return;generation++;preview=null;clear();confirm.disabled=true;message('dirty');};inputHost.addEventListener('input',changed);inputHost.addEventListener('change',changed);
  async function verifyPreview(data,input){
   const realm=data?.request_context;
   if(!object(data)||!object(realm)||!['tenant_id','dealer_id','actor_id'].every(key=>typeof realm[key]==='string'&&realm[key].length>0)||requestContext&&!['tenant_id','dealer_id','actor_id'].every(key=>realm[key]===requestContext[key])||realm.tenant_id!==workflow.tenant_id||realm.dealer_id!==workflow.dealer_id||data.workflow_id!==workflow.id||data.workflow_name!==workflow.name||data.workflow_version!==workflow.version||data.workflow_signature!==workflow.signature||!hash(data.workflow_signature)||!hash(data.request_signature)||!hash(data.request_fingerprint)||!hash(data.preview_fingerprint)||!object(data.event)||!object(data.inputs)||!object(data.definition)||!same(data.definition,shape(workflow))||data.approval_required!==workflow.approval_required||data.execution_performed!==false||data.run_created!==false||data.source_result_retained!==false||!integer(data.activation_revision)||!integer(data.recovery_revision)||!Array.isArray(data.steps)||data.steps.length!==workflow.actions.length)throw invalid();
   if(data.steps.some((step,index)=>!object(step)||step.index!==index||step.type!==workflow.actions[index].type||step.title!==(workflow.actions[index].title||workflow.actions[index].message||null)||typeof step.condition_matched!=='boolean'))throw invalid();
   if(data.request_fingerprint!==await digest(input)||data.workflow_signature!==await digest(shape(data.definition))||data.request_signature!==await digest(canonical({workflow:data.workflow_signature,trigger:data.event,inputs:data.inputs})))throw invalid();
  }
  function describe(data){
   const lines=[shared('workflow.inspector.heading','{name} · versie {version}',{name:data.workflow_name,version:number(data.workflow_version)}),copy('trigger',{value:JSON.stringify(data.definition.trigger)}),copy('event',{value:JSON.stringify(data.event)}),copy('inputs',{value:JSON.stringify(data.inputs)}),shared('workflow.generator.approval','Goedkeuring vóór uitvoering: {value}',{value:shared('workflow.generator.'+(data.approval_required?'required':'not_required'),data.approval_required?'vereist':'niet vereist')})];
   for(const [index,action]of data.definition.actions.entries()){
    lines.push('',number(index+1)+'. '+shared('workflow.action.'+action.type,action.type));
    for(const key of ['title','content','message','seconds'])if(Object.hasOwn(action,key))lines.push(shared('workflow.generator.'+key,({title:'Titel',content:'Inhoud',message:'Melding',seconds:'Wachttijd'})[key])+': '+(typeof action[key]==='number'?number(action[key]):action[key]));
    const rest=Object.fromEntries(Object.entries(action).filter(([key])=>!['type','title','content','message','seconds'].includes(key)));if(Object.keys(rest).length)lines.push(copy('action_details',{value:JSON.stringify(rest)}));lines.push(copy('condition',{value:copy(data.steps[index].condition_matched?'matches':'skipped')}));
   }
   return lines.join('\n');
  }
  async function verifyResult(data,current){
   const run=data?.run,p=current.preview.data,realm=p.request_context;
   if(!object(data)||data.approval_is_separate!==true||!object(run)||typeof run.run_id!=='string'||!run.run_id||run.automation_id!==workflow.id||run.workflow_version!==workflow.version||run.event_id!==(p.event.event_id||p.event.id)||run.actor_id!==realm.actor_id||run.tenant_id!==realm.tenant_id||run.dealer_id!==realm.dealer_id||run.request_signature!==p.request_signature||!same(run.trigger,p.event)||!same(run.inputs,p.inputs)||!statuses.has(run.status)||run.replay_safe!==true||!Array.isArray(run.steps)||run.steps.length>workflow.actions.length||run.steps.some((step,index)=>!object(step)||step.index!==index||step.type!==workflow.actions[index].type.toLowerCase()||!stepStatuses.has(step.status))||!Array.isArray(run.outputs)||!Array.isArray(run.errors))throw invalid();
   if(run.steps.some((step,index)=>!same(step.input,workflow.actions[index])||step.idempotency_key!==`workflow:${run.run_id}:${index}`||step.status==='SKIPPED_CONDITION'&&p.steps[index].condition_matched||step.status==='SUCCEEDED'&&!p.steps[index].condition_matched||step.status==='SUCCEEDED'&&step.type!=='delay'&&(!integer(step.output_index)||run.outputs[step.output_index]?.executed!==true)))throw invalid();
   if(run.status==='SUCCEEDED'&&(run.steps.length!==workflow.actions.length||run.steps.some(step=>!['SUCCEEDED','SKIPPED_CONDITION'].includes(step.status))))throw invalid();
   return run;
  }
  prepare.addEventListener('click',async()=>{
   if(busy||pending||!active()||!canRequest())return;busy=true;preview=null;clear();lock();message('loading');const start=generation;
   try{const payload=getInput(),input=clone({event:payload.event,inputs:payload.options.inputs}),data=await zeroRequest({operation:'RUN_PREVIEW',workflow_id:workflow.id,input},root.crypto.randomUUID());if(!active()||generation!==start)return;await verifyPreview(data,input);if(!active()||generation!==start)return;preview={input,data:clone(data),signature:JSON.stringify(input),generation:start};const shown=preview.data;bind(output,()=>describe(shown));message('review');}
   catch(error){if(active()&&generation===start)feedback(error);}finally{busy=false;lock();}
  });
  confirm.addEventListener('click',async()=>{
   if(busy||!active()||confirm.disabled)return;
   if(!pending){
    if(!preview||!canRequest())return;if(!reason.value.trim()||reason.value.trim().length>500){message('reason_required');return;}
    try{const payload=getInput();if(preview.generation!==generation||JSON.stringify({event:payload.event,inputs:payload.options.inputs})!==preview.signature){changed();return;}}catch(error){feedback(error);return;}
    pending={preview,turn:root.crypto.randomUUID(),uncertain:false,action:clone({operation:'RUN_SUBMIT',workflow_id:workflow.id,input:{...preview.input,preview_fingerprint:preview.data.preview_fingerprint,confirm:true,reason:reason.value.trim()}})};
   }
   const current=pending;busy=true;lock();
   try{const data=await zeroRequest(clone(current.action),current.turn);if(!active()||pending!==current)return;const run=await verifyResult(data,current);if(!active()||pending!==current)return;pending=null;preview=null;clear();bind(notice,()=>copy('confirmed',{id:run.run_id,status:status(run.status)})+(run.status==='AWAITING_APPROVAL'?' '+copy('approval_separate'):''));}
   catch(error){if(active()&&pending===current){const status=error.status||error.statusCode;if(!current.uncertain&&status>=400&&status<500&&![401,403,408,429].includes(status)){pending=null;preview=null;clear();feedback(error);}else{current.uncertain=true;feedback(error,true);}}}finally{busy=false;lock();}
  });return box;
 }
 root.FoundlyWorkflowRunZero={create};
})(globalThis);
