'use strict';
(function(root){
 function create({document,workflow,inputHost,getInput,canRequest,onBusy,zeroRequest}){
  const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;},box=el('fieldset');box.append(el('legend','Deze uitvoering met ZERO controleren'));
  const prepare=el('button','Uitvoering met ZERO voorbereiden'),confirm=el('button','Bevestig uitvoering via ZERO'),reasonLabel=el('label','Reden voor deze uitvoering'),reason=el('input'),output=el('pre'),notice=el('output');prepare.type=confirm.type='button';reason.maxLength=500;reasonLabel.append(reason);notice.setAttribute('aria-live','polite');box.append(prepare,output,reasonLabel,confirm,notice);confirm.disabled=true;
  let preview=null,generation=0,busy=false;
  const changed=()=>{generation++;preview=null;output.textContent='';confirm.disabled=true;notice.textContent='Invoer gewijzigd; controleer deze uitvoering opnieuw.';};inputHost.addEventListener('input',changed);inputHost.addEventListener('change',changed);
  const active=()=>box.isConnected&&inputHost.isConnected;
  prepare.addEventListener('click',async()=>{
   if(busy||!active()||!canRequest())return;busy=true;onBusy(true);prepare.disabled=true;confirm.disabled=true;preview=null;output.textContent='';const start=generation;
   try{const payload=getInput(),input={event:payload.event,inputs:payload.options.inputs},signature=JSON.stringify(input),data=await zeroRequest({operation:'RUN_PREVIEW',workflow_id:workflow.id,input},root.crypto.randomUUID());if(!active()||generation!==start)return;
    if(data?.workflow_id!==workflow.id||data.execution_performed!==false||!data.preview_fingerprint||!Array.isArray(data.steps))throw Error('De gecontroleerde uitvoering is niet beschikbaar.');
    preview={input,signature,fingerprint:data.preview_fingerprint,generation:start};output.textContent=data.workflow_name+' · versie '+data.workflow_version+'\nReferentie: '+(data.event.event_id||data.event.id)+'\nGoedkeuring: '+(data.approval_required?'afzonderlijk vereist':'niet vereist')+'\nInvoer: '+JSON.stringify(data.inputs)+'\n\n'+data.steps.map(s=>(s.index+1)+'. '+s.type+' · '+(s.title||'')+' · voorwaarde '+(s.condition_matched?'waar':'onwaar (wordt overgeslagen)')).join('\n');notice.textContent='Er is geen run gestart. Controleer en bevestig deze exacte invoer.';confirm.disabled=false;
   }catch(e){if(active()&&generation===start)notice.textContent=e.message;}finally{busy=false;onBusy(false);prepare.disabled=false;}
  });
  confirm.addEventListener('click',async()=>{
   if(busy||!active()||!canRequest()||confirm.disabled||!preview)return;if(!reason.value.trim()){notice.textContent='Vul een reden in voor deze uitvoering.';return;}
   const p=preview;try{const payload=getInput();if(p.generation!==generation||JSON.stringify({event:payload.event,inputs:payload.options.inputs})!==p.signature){changed();return;}}catch(e){notice.textContent=e.message;return;}
   const action={operation:'RUN_SUBMIT',workflow_id:workflow.id,input:{...p.input,preview_fingerprint:p.fingerprint,confirm:true,reason:reason.value.trim()}},sig=JSON.stringify(action);if(sig!==p.submitSignature){p.submitSignature=sig;p.turn=root.crypto.randomUUID();}
   busy=true;onBusy(true);prepare.disabled=confirm.disabled=true;
   try{const data=await zeroRequest(action,p.turn);if(!active()||preview!==p||generation!==p.generation)return;if(!data?.run?.run_id||!data.run.status)throw Error('De native uitvoerregistratie ontbreekt.');notice.textContent='Native run '+data.run.run_id+': '+data.run.status+'.'+(data.run.status==='AWAITING_APPROVAL'?' Gebruik de afzonderlijke goedkeuringsstap.':'');preview=null;output.textContent='';
   }catch(e){if(active()&&preview===p){notice.textContent=e.message;confirm.disabled=false;}}finally{busy=false;onBusy(false);prepare.disabled=false;}
  });return box;
 }
 root.FoundlyWorkflowRunZero={create};
})(globalThis);
