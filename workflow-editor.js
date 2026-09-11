'use strict';
// Original sequential form editor over the existing versioned workflow API.
(function(root){
  function create({document,spec,request,onSaved,draft:initial=null,zeroRequest=null}){
    function checkSteps(steps,depth=0){
      if(!Array.isArray(steps)||depth>3)throw Error('Dit concept heeft een ongeldige vertakkingsstructuur. Het blijft behouden.');
      for(const step of steps){
        if(!step||typeof step!=='object')throw Error('Dit concept bevat een ongeldige stap.');
        if(step.type==='branch'){if(!spec.branching||depth>=3)throw Error('Deze vertakking wordt niet ondersteund.');checkSteps(step.then_steps,depth+1);checkSteps(step.else_steps,depth+1);}
        else if(!spec.actions.some(action=>action.type===step.type))throw Error('Dit concept bevat een actie die de huidige editor niet ondersteunt. Het bewaarde concept blijft behouden.');
        if(Object.hasOwn(step,'condition'))root.FoundlyWorkflowAuthoring.validateDraftCondition(step.condition);
      }
    }
    if(initial?.draft?.steps)checkSteps(initial.draft.steps);
    const make=(tag,text)=>{const el=document.createElement(tag);if(text)el.textContent=text;return el;};
    const form=make('form');form.className='domain-record-form workflow-editor';
    const field=(container,label,type='text',value='')=>{const wrapper=make('label',label),input=make(type==='textarea'?'textarea':'input');if(type!=='textarea')input.type=type;input.value=value;wrapper.append(input);container.append(wrapper);return input;};
    const select=(container,label,options)=>{const wrapper=make('label',label),input=make('select');for(const [value,text]of options){const option=make('option',text);option.value=value;input.append(option);}wrapper.append(input);container.append(wrapper);return input;};
    const button=(container,label,handler)=>{const b=make('button',label);b.type='button';b.addEventListener('click',handler);container.append(b);return b;};
    const name=field(form,'Workflownaam'),version=field(form,'Versie','number','1');name.required=true;name.maxLength=200;version.required=true;version.min='1';
    const trigger=select(form,'Trigger',spec.triggers.map(t=>[t,t.replaceAll('_',' ')]));trigger.value='custom_event';
    const automatic=field(form,'Automatisch uitvoeren voor nieuwe passende events of op het geplande tijdstip','checkbox');
    const at=field(form,'Gepland tijdstip met UTC-offset (bijv. 2026-09-30T09:00:00+02:00)'),eventName=field(form,'Expliciete eventnaam (verplicht bij een automatische eigen trigger)');
    const syncTrigger=()=>{at.parentElement.hidden=trigger.value!=='schedule';at.required=trigger.value==='schedule';eventName.parentElement.hidden=trigger.value==='schedule';};trigger.addEventListener('change',syncTrigger);syncTrigger();
    const approval=field(form,'Menselijke goedkeuring vereist vóór uitvoering','checkbox');
    form.append(make('p','Stappen worden op volgorde uitgevoerd. Een onware conditie slaat alleen die stap over. Opslaan bewaart deze versie; oudere versies en uitvoerhistorie blijven behouden. Gebruik na opslaan de versieactivatie om één versie te kiezen. Zonder expliciete keuze behouden bestaande versies hun eerdere activiteitsinstelling en kan een nieuwe automatische versie direct na opslaan starten.'));
    function stepCollection(container,level=0){
    const list=make('div');list.className='workflow-step-list';container.append(list);const steps=[];
    function renumber(){steps.forEach((step,index)=>{step.legend.textContent=`Stap ${index+1}`;step.up.disabled=index===0;step.down.disabled=index===steps.length-1;list.append(step.box);});add.disabled=steps.length>=spec.max_steps;}
    function addStep(saved){
      const step={},box=make('fieldset'),legend=make('legend'),settings=make('div');step.box=box;step.legend=legend;box.append(legend);
      const type=select(box,'Actie',[...spec.actions.map(a=>[a.type,a.label]),...(spec.branching&&level<3?[['branch','Vertakking — als waar / anders']]:[])]);box.append(settings);if(saved)type.value=saved.type;let values={},attempts,delay;
      const renderFields=()=>{settings.replaceChildren();values={};const definition=spec.actions.find(a=>a.type===type.value);if(type.value==='branch'){attempts=delay=null;return;}for(const item of definition.fields){const input=field(settings,item.label,item.multiline?'textarea':item.type||'text',item.type==='number'?'1':'');input.required=Boolean(item.required);if(item.type==='number'){input.min=String(item.min);input.max=String(item.max);}else input.maxLength=item.max;values[item.key]=input;}attempts=field(settings,'Maximum aantal pogingen','number','1');attempts.min='1';attempts.max='5';attempts.disabled=!definition.retryable;delay=field(settings,'Eerste retrywachttijd in seconden','number','10');delay.min='1';delay.max='3600';delay.disabled=!definition.retryable;};type.addEventListener('change',renderFields);renderFields();
      const conditional=field(box,'Alleen uitvoeren wanneer de conditie waar is','checkbox'),conditions=make('div');box.append(conditions);
      function conditionNode(container,savedNode={},depth=0){
        const box=make('fieldset'),legend=make('legend',depth?'Onderdeel van conditiegroep':'Voorwaarde');box.append(legend);container.append(box);
        const kind=select(box,'Soort voorwaarde',depth>=5?[['leaf','Vergelijking']]:[['leaf','Vergelijking'],['all','EN — alle onderdelen waar'],['any','OF — minstens één onderdeel waar']]);kind.value=savedNode.mode||'leaf';
        const leaf=make('div'),group=make('div'),childrenHost=make('div');box.append(leaf,group);group.append(childrenHost);const children=[];
        const conditionField=field(leaf,'Conditieveld, bijvoorbeeld inputs.priority','text',savedNode.field||''),operator=select(leaf,'Vergelijking',[['eq','Gelijk aan'],['ne','Niet gelijk aan'],['gt','Groter dan'],['gte','Groter of gelijk'],['lt','Kleiner dan'],['lte','Kleiner of gelijk'],['exists','Veld bestaat'],['in','Een van de waarden (één per regel)']]),valueType=select(leaf,'Waardetype',[['text','Tekst'],['number','Getal'],['boolean','Boolean (true / false)']]),value=field(leaf,'Vergelijkingswaarde','textarea',savedNode.value??'');
        operator.value=savedNode.operator||'eq';valueType.value=savedNode.value_type||'text';
        const appendChild=data=>{
          if(children.length>=20)return;
          const child=conditionNode(childrenHost,data,depth+1);children.push(child);
          button(child.box,'Voorwaarde verwijderen',()=>{children.splice(children.indexOf(child),1);child.box.remove();sync();markDirty();addCondition.focus();});sync();
        };
        const addCondition=button(group,'Voorwaarde toevoegen',()=>{appendChild({});markDirty();children.at(-1)?.box.querySelector('select').focus();});
        function sync(active=conditional.checked){
          leaf.hidden=kind.value!=='leaf';group.hidden=kind.value==='leaf';conditionField.required=active&&kind.value==='leaf';
          value.parentElement.hidden=operator.value==='exists';valueType.parentElement.hidden=['exists','in'].includes(operator.value);
          // Hidden comparisons must not participate in native form validation.
          for(const input of [conditionField,operator,valueType,value])input.disabled=!active||kind.value!=='leaf';
          kind.disabled=!active;addCondition.disabled=!active||children.length>=20||depth>=5;
          for(const child of children)child.sync(active&&kind.value!=='leaf');
        }
        kind.addEventListener('change',()=>{if(kind.value!=='leaf'&&!children.length&&depth<5)appendChild({});sync();});operator.addEventListener('change',()=>sync());
        for(const data of savedNode.children||[])appendChild(data);sync();
        return {box,sync,read:()=>kind.value==='leaf'?{mode:'leaf',field:conditionField.value.trim(),operator:operator.value,value_type:valueType.value,value:value.value}:{mode:kind.value,children:children.map(child=>child.read())}};
      }
      conditional.checked=saved?.condition?.enabled===true;
      const conditionRoot=conditionNode(conditions,saved?.condition||{});
      const paths=make('div');box.append(paths);let yes,no,yesBox,noBox;
      const syncCondition=()=>{
        const branching=type.value==='branch';conditional.parentElement.hidden=branching;if(branching)conditional.checked=true;
        conditions.hidden=!conditional.checked;conditionRoot.sync();paths.hidden=!branching;
        if(branching&&!yes){
          yesBox=make('fieldset');yesBox.append(make('legend','Als de voorwaarde waar is'));noBox=make('fieldset');noBox.append(make('legend','Anders'));paths.append(yesBox,noBox);
          yes=stepCollection(yesBox,level+1);no=stepCollection(noBox,level+1);
          for(const child of saved?.then_steps||[])yes.addStep(child);for(const child of saved?.else_steps||[])no.addStep(child);
        }
        if(yesBox)yesBox.disabled=noBox.disabled=!branching;
      };conditional.addEventListener('change',syncCondition);type.addEventListener('change',syncCondition);
      if(saved){for(const [key,input] of Object.entries(values))input.value=String(saved.values?.[key]??'');if(attempts)attempts.value=String(saved.attempts??1);if(delay)delay.value=String(saved.retry_delay??10);}syncCondition();
      step.up=button(box,'Stap omhoog',()=>{const i=steps.indexOf(step);if(i>0){[steps[i-1],steps[i]]=[steps[i],steps[i-1]];renumber();markDirty();step.up.focus();}});
      step.down=button(box,'Stap omlaag',()=>{const i=steps.indexOf(step);if(i<steps.length-1){[steps[i+1],steps[i]]=[steps[i],steps[i+1]];renumber();markDirty();step.down.focus();}});
      button(box,'Stap verwijderen',()=>{steps.splice(steps.indexOf(step),1);box.remove();renumber();markDirty();add.focus();});
      step.read=()=>type.value==='branch'?{type:'branch',condition:{enabled:true,...conditionRoot.read()},then_steps:yes.read(),else_steps:no.read()}:{type:type.value,values:Object.fromEntries(Object.entries(values).map(([key,input])=>[key,input.value])),attempts:attempts.value,retry_delay:delay.value,condition:{enabled:conditional.checked,...conditionRoot.read()}};
      steps.push(step);renumber();
    }
    const add=button(container,'Stap toevoegen',()=>{addStep();markDirty();steps.at(-1).box.querySelector('select').focus();});
    return {addStep,read:()=>steps.map(step=>step.read())};
    }
    const notice=make('output');notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');
    const collection=stepCollection(form);
    const save=make('button','Workflowversie opslaan');save.type='submit';save.className='primary-button';form.append(save,notice);
    const read=()=>({name:name.value,version:version.value,trigger_type:trigger.value,automatic:automatic.checked,at:at.value.trim(),event_name:eventName.value.trim(),approval_required:approval.checked,steps:collection.read()});
    let timer,generation=0,savedGeneration=0,zeroPreview=null,zeroSequence=0,zeroOutput,zeroSave;
    const session=(id,revision)=>root.FoundlyWorkflowDraftSession.create({id,revision,request,onState:state=>{notice.textContent={SAVING:'Concept bewaren…',SAVED:'Concept bewaard; er is geen workflow gestart.',CONFLICT:'Dit concept is elders gewijzigd. Je invoer blijft staan; bewaar deze zo nodig als nieuw concept.',ERROR:'Concept niet bewaard. Probeer opnieuw voordat je dit scherm verlaat.'}[state];}});
    let draftId=initial?.id||root.crypto.randomUUID(),draftSession=session(draftId,initial?.revision||0);
    async function flush(){clearTimeout(timer);const current=generation;await draftSession.save(read());savedGeneration=current;form.dataset.unsaved=String(savedGeneration!==generation);}
    function markDirty(){generation++;zeroPreview=null;if(zeroSave)zeroSave.disabled=true;if(zeroOutput)zeroOutput.textContent='';form.dataset.unsaved='true';notice.textContent='Wijzigingen nog niet bewaard…';clearTimeout(timer);timer=setTimeout(()=>flush().catch(()=>{}),600);}
    form.addEventListener('input',markDirty);form.addEventListener('change',markDirty);
    button(form,'Concept nu bewaren',()=>flush().catch(error=>{notice.textContent=error.message;}));
    button(form,'Bewaar invoer als nieuw concept',()=>{draftId=root.crypto.randomUUID();draftSession=session(draftId,0);zeroPreview=null;if(zeroSave)zeroSave.disabled=true;flush().catch(error=>{notice.textContent=error.message;});});
    if(zeroRequest){
      const zeroBox=make('fieldset');zeroBox.append(make('legend','Workflowconcept met ZERO'));form.append(zeroBox);
      zeroOutput=make('pre');zeroBox.append(zeroOutput);const reason=field(zeroBox,'Reden om dit concept via ZERO te bewaren');reason.maxLength=500;
      const prepare=button(zeroBox,'Concept met ZERO voorbereiden',async()=>{
        if(prepare.disabled)return;prepare.disabled=true;zeroPreview=null;zeroSave.disabled=true;zeroOutput.textContent='';const sequence=++zeroSequence,start=generation;form.inert=true;
        try{
          await flush();if(!form.isConnected||generation!==start)return;
          const input={draft:read(),expected_revision:draftSession.revision},id=draftId;
          const result=await zeroRequest({operation:'PREVIEW',draft_id:id,input},root.crypto.randomUUID());
          if(!form.isConnected||generation!==start||sequence!==zeroSequence||draftId!==id)return;
          if(!result?.preview_fingerprint||result.executable!==false)throw Error('Het gecontroleerde concept is niet beschikbaar.');
          zeroPreview={input,id,fingerprint:result.preview_fingerprint,generation:start};const describe=c=>c.not?'NIET ('+describe(c.not)+')':c.all||c.any?'('+((c.all||c.any).map(describe).join(c.all?' EN ':' OF '))+')':c.field+' '+({eq:'=',ne:'≠',gt:'>',gte:'≥',lt:'<',lte:'≤',exists:'bestaat',in:'is één van'}[c.operator])+(c.operator==='exists'?'':' '+JSON.stringify(c.value));zeroOutput.textContent=result.definition.name+' · versie '+result.definition.version+'\n'+result.definition.actions.map((action,index)=>(index+1)+'. '+(spec.actions.find(row=>row.type===action.type)?.label||action.type)+' — '+(action.title||action.message||action.seconds||'')+(action.when?'\n   Voorwaarde: '+describe(action.when):'')).join('\n');zeroSave.disabled=false;
        }catch(error){if(form.isConnected&&generation===start)notice.textContent=error.message;}finally{form.inert=false;prepare.disabled=false;}
      });
      zeroSave=button(zeroBox,'Bevestig concept bewaren via ZERO',async()=>{
        if(zeroSave.disabled||!zeroPreview||zeroPreview.generation!==generation)return;
        if(!reason.value.trim()){notice.textContent='Vul een reden in voor het bewaren van dit concept.';return;}
        const preview=zeroPreview,action={operation:'SAVE',draft_id:preview.id,input:{...preview.input,preview_fingerprint:preview.fingerprint,confirm:true,reason:reason.value.trim()}};
        // Retry only an identical request after an uncertain response.
        const signature=JSON.stringify(action);if(preview.signature!==signature){preview.signature=signature;preview.turn=root.crypto.randomUUID();}
        zeroSave.disabled=true;prepare.disabled=true;form.inert=true;clearTimeout(timer);
        try{
          const result=await zeroRequest(action,preview.turn);if(!form.isConnected||zeroPreview!==preview||generation!==preview.generation)return;
          if(result?.record?.id!==draftId||!Number.isInteger(result.record.revision))throw Error('De bewaarde conceptrevisie is niet beschikbaar.');
          draftSession=session(draftId,result.record.revision);savedGeneration=generation;form.dataset.unsaved='false';zeroPreview=null;zeroOutput.textContent='';notice.textContent='Concept via ZERO bewaard. Er is geen workflow gepubliceerd of gestart.';
        }catch(error){if(form.isConnected&&zeroPreview===preview){notice.textContent=error.message;zeroSave.disabled=false;}}finally{form.inert=false;prepare.disabled=false;}
      });zeroSave.disabled=true;
    }
    if(initial){const d=initial.draft;name.value=d.name||'';version.value=String(d.version??1);trigger.value=d.trigger_type||'custom_event';automatic.checked=d.automatic===true;at.value=d.at||'';eventName.value=d.event_name||'';approval.checked=d.approval_required===true;syncTrigger();for(const step of d.steps||[])collection.addStep(step);}else collection.addStep();
    form.dataset.unsaved='false';
    form.addEventListener('submit',async event=>{event.preventDefault();save.disabled=true;try{
      const definition=root.FoundlyWorkflowAuthoring.compile(read(),spec);form.inert=true;await flush();
      await request('/api/automation/workflows',{method:'POST',body:JSON.stringify(definition)});await onSaved();
    }catch(error){notice.textContent=error.message||'Opslaan is niet gelukt.';}finally{form.inert=false;save.disabled=false;}});
    return form;
  }
  root.FoundlyWorkflowEditor={create};
})(globalThis);
