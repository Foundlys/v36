'use strict';
(function(root){
 function create({document,spec,zeroRequest,onSaved}){
  const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;},box=el('fieldset');box.append(el('legend','Workflow beschrijven met ZERO'),el('p','Beschrijf de trigger, stappen en eventuele als/anders-voorwaarden. Het model maakt een voorstel. Controleer dit voordat je het als privéconcept bewaart.'));
  const field=(label,tag='input')=>{const l=el('label',label),i=el(tag);l.append(i);box.append(l);return i;};
  const prompt=field('Gewenste workflow','textarea');prompt.maxLength=4000;
  const prepare=el('button','Voorstel uit beschrijving maken');prepare.type='button';box.append(prepare);
  const preview=el('pre'),notice=el('output');notice.setAttribute('aria-live','polite');box.append(preview,notice);
  const reason=field('Reden om dit voorstel als concept te bewaren');reason.maxLength=500;
  const save=el('button','Bevestig voorstel als privéconcept');save.type='button';save.disabled=true;box.append(save);
  let generation=0,proposal=null,busy=false;
  prompt.addEventListener('input',()=>{generation++;proposal=null;preview.textContent='';save.disabled=true;notice.textContent='Beschrijving gewijzigd; maak een nieuw voorstel.';});
  const condition=c=>c.not?'NIET ('+condition(c.not)+')':c.all||c.any?'('+((c.all||c.any).map(condition).join(c.all?' EN ':' OF '))+')':c.field+' '+({eq:'=',ne:'≠',gt:'>',gte:'≥',lt:'<',lte:'≤',exists:'bestaat',in:'één van'}[c.operator])+(c.operator==='exists'?'':' '+JSON.stringify(c.value));
  function describe(def){return `${def.name} · versie ${def.version}\nTrigger: ${def.trigger.type}${def.trigger.event_name?' · '+def.trigger.event_name:''}${def.trigger.at?' · '+def.trigger.at:''}\nAutomatisch na afzonderlijke publicatie: ${def.trigger.automatic?'ja':'nee'}\nGoedkeuring vóór uitvoering: ${def.approval_required?'vereist':'niet vereist'}\n\n`+def.actions.map((a,index)=>`${index+1}. ${spec.actions.find(row=>row.type===a.type)?.label||a.type}\n`+['title','content','message','seconds'].filter(k=>Object.hasOwn(a,k)).map(k=>({title:'Titel',content:'Inhoud',message:'Melding',seconds:'Wachttijd (seconden)'}[k])+': '+a[k]).join('\n')+(a.when?'\nVoorwaarde: '+condition(a.when):'\nZonder voorwaarde')+(a.retry?'\nMaximaal '+a.retry.max_attempts+' pogingen; eerste wachttijd '+a.retry.initial_delay_seconds+' seconden':'')).join('\n\n');}
  prepare.addEventListener('click',async()=>{
   if(busy)return;if(!prompt.value.trim()){notice.textContent='Beschrijf eerst de gewenste workflow.';return;}
   busy=true;prepare.disabled=true;save.disabled=true;proposal=null;preview.textContent='';notice.textContent='Voorstel voorbereiden…';const start=generation,id=root.crypto.randomUUID();
   try{const data=await zeroRequest({operation:'GENERATE',draft_id:id,input:{prompt:prompt.value,expected_revision:0}},root.crypto.randomUUID());if(!box.isConnected||generation!==start)return;
    if(data?.questions){notice.textContent=data.questions.join('\n');return;}
    if(!data?.draft||!data.definition||!data.preview_fingerprint||data.executable!==false||data.draft_id!==id||data.expected_revision!==0||data.inference!==true)throw Error('Er is geen gecontroleerd modelvoorstel beschikbaar.');
    // The shared compiler also protects review from an inconsistent response.
    const definition=root.FoundlyWorkflowAuthoring.compile(data.draft,spec);if(JSON.stringify(definition)!==JSON.stringify(data.definition))throw Error('Het voorstel en de gecontroleerde stappen verschillen.');
    proposal={id,input:{draft:data.draft,expected_revision:0},fingerprint:data.preview_fingerprint,generation:start};preview.textContent=describe(definition);notice.textContent='Modelvoorstel — controleer alle stappen. Er is nog geen concept bewaard.';save.disabled=false;
   }catch(e){if(box.isConnected&&generation===start)notice.textContent=e.message;}finally{busy=false;prepare.disabled=false;}
  });
  save.addEventListener('click',async()=>{
   if(busy||save.disabled||!proposal||proposal.generation!==generation)return;if(!reason.value.trim()){notice.textContent='Vul een reden in om het voorstel te bewaren.';return;}
   const p=proposal,action={operation:'SAVE',draft_id:p.id,input:{...p.input,preview_fingerprint:p.fingerprint,confirm:true,reason:reason.value.trim()}},signature=JSON.stringify(action);if(signature!==p.signature){p.signature=signature;p.turn=root.crypto.randomUUID();}
   busy=true;save.disabled=true;prepare.disabled=true;
   try{const data=await zeroRequest(action,p.turn);if(!box.isConnected||proposal!==p||generation!==p.generation)return;if(data?.record?.id!==p.id||!Number.isInteger(data.record.revision))throw Error('De bewaarde conceptrevisie ontbreekt.');proposal=null;notice.textContent='Privéconcept bewaard. Open het via Bewaard concept om het te bewerken. Publicatie en uitvoering vereisen afzonderlijke stappen.';await onSaved(data.record);
   }catch(e){if(box.isConnected&&proposal===p){notice.textContent=e.message;save.disabled=false;}}finally{busy=false;prepare.disabled=false;}
  });return box;
 }
 root.FoundlyWorkflowGenerator={create};
})(globalThis);
