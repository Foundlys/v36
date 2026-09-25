'use strict';
// Original sequential form editor over the existing versioned workflow API.
(function(root){
  const fallback={"name":"Workflownaam","version":"Versie","trigger":"Trigger","action":"Actie","automatic":"Automatisch uitvoeren voor nieuwe passende events of op het geplande tijdstip","schedule":"Gepland tijdstip met UTC-offset (bijv. 2026-09-30T09:00:00+02:00)","event_name":"Expliciete eventnaam (verplicht bij een automatische eigen trigger)","approval":"Menselijke goedkeuring vereist vóór uitvoering","help":"Stappen worden op volgorde uitgevoerd. Een onware conditie slaat alleen die stap over. Opslaan bewaart deze versie; oudere versies en uitvoerhistorie blijven behouden. Gebruik na opslaan de versieactivatie om één versie te kiezen. Zonder expliciete keuze behouden bestaande versies hun eerdere activiteitsinstelling en kan een nieuwe automatische versie direct na opslaan starten.","step":"Stap {index}","branch":"Vertakking — als waar / anders","task_title":"Taaktitel","document_title":"Documenttitel","content":"Inhoud","message":"Melding","seconds":"Wachttijd in seconden","attempts":"Maximum aantal pogingen","retry_delay":"Eerste retrywachttijd in seconden","conditional":"Alleen uitvoeren wanneer de conditie waar is","group_part":"Onderdeel van conditiegroep","condition":"Voorwaarde","kind":"Soort voorwaarde","comparison":"Vergelijking","all":"EN — alle onderdelen waar","any":"OF — minstens één onderdeel waar","condition_field":"Conditieveld, bijvoorbeeld inputs.priority","value_type":"Waardetype","text":"Tekst","number":"Getal","boolean":"Boolean (true / false)","value":"Vergelijkingswaarde","condition_remove":"Voorwaarde verwijderen","condition_add":"Voorwaarde toevoegen","then":"Als de voorwaarde waar is","else":"Anders","up":"Stap omhoog","down":"Stap omlaag","remove":"Stap verwijderen","add":"Stap toevoegen","publish":"Workflowversie opslaan","draft_save":"Concept nu bewaren","draft_new":"Bewaar invoer als nieuw concept","zero_legend":"Workflowconcept met ZERO","zero_reason":"Reden om dit concept via ZERO te bewaren","zero_prepare":"Concept met ZERO voorbereiden","zero_confirm":"Bevestig concept bewaren via ZERO","saving":"Concept bewaren…","saved":"Concept bewaard; er is geen workflow gestart.","conflict":"Dit concept is elders gewijzigd. Je invoer blijft staan; bewaar deze zo nodig als nieuw concept.","error":"Concept niet bevestigd. Controleer de opslag opnieuw voordat je dit scherm verlaat.","dirty":"Wijzigingen nog niet bewaard…","zero_saved":"Concept via ZERO bewaard. Er is geen workflow gepubliceerd of gestart.","reason_required":"Vul een reden in voor het bewaren van dit concept.","validation":"Controleer de naam, versie, trigger, stappen en voorwaarden voordat je doorgaat.","condition_values":"Vul 1 tot 100 vergelijkingswaarden in, één per regel.","invalid":"De ontvangen workflowbevestiging kon niet worden gecontroleerd.","stored_invalid":"Dit bewaarde concept kan niet veilig in deze editor worden geopend. Het blijft behouden.","unconfirmed":"De uitkomst is nog niet bevestigd. Controleer dezelfde aanvraag opnieuw; de bevestigde invoer blijft vaststaan.","published":"Workflowversie bevestigd.","published_refresh":"Workflowversie bevestigd. Vernieuw de weergave om deze te openen.","preview_loading":"Workflowconcept controleren…","review":"Controleer het concept en bevestig afzonderlijk om het via ZERO te bewaren.","retry_zero":"Dezelfde ZERO-conceptopslag controleren","retry_publication":"Dezelfde workflowpublicatie controleren"};
  function create({document,spec,request,onSaved,draft:initial=null,zeroRequest=null,requestContext,isActive=()=>true}){
    if(requestContext)requestContext=Object.freeze({...requestContext});
    const i18n=root.FoundlyI18n,bindings=new Map(),number=value=>i18n?i18n.number(value,{maximumSignificantDigits:21}):String(value);
    const shared=(key,fallback,params={})=>i18n?i18n.t(key,params):fallback.replace(/\{(\w+)\}/g,(_,key)=>String(params[key]));
    const copy=(key,params={})=>shared('workflow.editor.'+key,fallback[key]||key,params),label=key=>Object.assign(()=>copy(key),{key});
    function bind(node,read){const entry={read,last:read()};node.textContent=entry.last;bindings.set(node,entry);return node;}
    function checkSteps(steps,depth=0){
      if(!Array.isArray(steps)||depth>3)throw Object.assign(Error(copy('stored_invalid')),{code:'workflow_draft_invalid'});
      for(const step of steps){
        if(!step||typeof step!=='object')throw Object.assign(Error(copy('stored_invalid')),{code:'workflow_draft_invalid'});
        if(step.type==='branch'){if(!spec.branching||depth>=3)throw Object.assign(Error(copy('stored_invalid')),{code:'workflow_draft_invalid'});checkSteps(step.then_steps,depth+1);checkSteps(step.else_steps,depth+1);}
        else if(!spec.actions.some(action=>action.type===step.type))throw Object.assign(Error(copy('stored_invalid')),{code:'workflow_draft_invalid'});
        if(Object.hasOwn(step,'condition'))try{root.FoundlyWorkflowAuthoring.validateDraftCondition(step.condition);}catch{throw Object.assign(Error(copy('stored_invalid')),{code:'workflow_draft_invalid'});}
      }
    }
    if(initial?.draft?.steps)checkSteps(initial.draft.steps);
    const make=(tag,text)=>{const el=document.createElement(tag);if(typeof text==='function')bind(el,text);else if(text)el.textContent=text;return el;};
    const form=make('form');form.className='domain-record-form workflow-editor';
    const active=()=>form.isConnected&&isActive();
    document.addEventListener?.('foundly:locale',()=>{if(!active())return;for(const [node,entry]of bindings){if(!node.isConnected){bindings.delete(node);continue;}if(node.textContent===entry.last){entry.last=entry.read();node.textContent=entry.last;}}});
    let timer,generation=0,savedGeneration=0,zeroPreview=null,zeroSequence=0,zeroOutput,zeroSave,zeroReason,flushing=0,exclusive=false,pendingZero=null,pendingPublication=null,publicationKnown=false;
    const controls=new Set();
    const field=(container,label,type='text',value='')=>{const wrapper=make('label'),input=make(type==='textarea'?'textarea':'input');controls.add(input);if(type!=='textarea')input.type=type;input.value=value;wrapper.append(make('span',label),input);container.append(wrapper);return input;};
    const select=(container,label,options)=>{const wrapper=make('label'),input=make('select');controls.add(input);for(const [value,text]of options){const option=make('option',text);option.value=value;input.append(option);}wrapper.append(make('span',label),input);container.append(wrapper);return input;};
    const button=(container,label,handler)=>{const b=make('button',label);if(label.key)b.setAttribute('data-workflow-editor-action',label.key);controls.add(b);b.type='button';b.addEventListener('click',event=>{if(active()&&b.isConnected&&!b.disabled&&!exclusive)return handler(event);});container.append(b);return b;};
    const name=field(form,label('name')),version=field(form,label('version'),'number','1');name.required=true;name.maxLength=200;version.required=true;version.min='1';
    const trigger=select(form,label('trigger'),spec.triggers.map(t=>[t,()=>shared('workflow.trigger.'+t,t)]));trigger.value='custom_event';
    const automatic=field(form,label('automatic'),'checkbox');
    const at=field(form,label('schedule')),eventName=field(form,label('event_name'));
    const syncTrigger=()=>{at.parentElement.hidden=trigger.value!=='schedule';at.required=trigger.value==='schedule';eventName.parentElement.hidden=trigger.value==='schedule';};trigger.addEventListener('change',syncTrigger);syncTrigger();
    const approval=field(form,label('approval'),'checkbox');
    form.append(make('p',label('help')));
    function stepCollection(container,level=0){
    const list=make('div');list.className='workflow-step-list';container.append(list);const steps=[];
    function renumber(){steps.forEach((step,index)=>{bind(step.legend,()=>copy('step',{index:number(index+1)}));step.up.disabled=index===0;step.down.disabled=index===steps.length-1;list.append(step.box);});add.disabled=steps.length>=spec.max_steps;}
    function addStep(saved){
      const step={},box=make('fieldset'),legend=make('legend'),settings=make('div');step.box=box;step.legend=legend;box.append(legend);
      const type=select(box,label('action'),[...spec.actions.map(a=>[a.type,()=>shared('workflow.action.'+a.type,a.label)]),...(spec.branching&&level<3?[['branch',label('branch')]]:[])]);box.append(settings);if(saved)type.value=saved.type;let values={},attempts,delay;
      const renderFields=()=>{settings.replaceChildren();values={};const definition=spec.actions.find(a=>a.type===type.value);if(type.value==='branch'){attempts=delay=null;return;}for(const item of definition.fields){const input=field(settings,label(({title:type.value==='create_task'?'task_title':'document_title',content:'content',message:'message',seconds:'seconds'})[item.key]),item.multiline?'textarea':item.type||'text',item.type==='number'?'1':'');input.required=Boolean(item.required);if(item.type==='number'){input.min=String(item.min);input.max=String(item.max);}else input.maxLength=item.max;values[item.key]=input;}attempts=field(settings,label('attempts'),'number','1');attempts.min='1';attempts.max='5';attempts.disabled=!definition.retryable;delay=field(settings,label('retry_delay'),'number','10');delay.min='1';delay.max='3600';delay.disabled=!definition.retryable;};type.addEventListener('change',renderFields);renderFields();
      const conditional=field(box,label('conditional'),'checkbox'),conditions=make('div');box.append(conditions);
      function conditionNode(container,savedNode={},depth=0){
        const box=make('fieldset'),legend=make('legend',depth?label('group_part'):label('condition'));box.append(legend);container.append(box);
        const kind=select(box,label('kind'),depth>=5?[['leaf',label('comparison')]]:[['leaf',label('comparison')],['all',label('all')],['any',label('any')]]);kind.value=savedNode.mode||'leaf';
        const leaf=make('div'),group=make('div'),childrenHost=make('div');box.append(leaf,group);group.append(childrenHost);const children=[];
        const conditionField=field(leaf,label('condition_field'),'text',savedNode.field||''),operator=select(leaf,label('comparison'),[['eq',()=>shared('workflow.inspector.operator.eq','Gelijk aan')],['ne',()=>shared('workflow.inspector.operator.ne','Niet gelijk aan')],['gt',()=>shared('workflow.inspector.operator.gt','Groter dan')],['gte',()=>shared('workflow.inspector.operator.gte','Groter of gelijk')],['lt',()=>shared('workflow.inspector.operator.lt','Kleiner dan')],['lte',()=>shared('workflow.inspector.operator.lte','Kleiner of gelijk')],['exists',()=>shared('workflow.inspector.operator.exists','Veld bestaat')],['in',()=>shared('workflow.inspector.operator.in','Een van de waarden (één per regel)')]]),valueType=select(leaf,label('value_type'),[['text',label('text')],['number',label('number')],['boolean',label('boolean')]]),value=field(leaf,label('value'),'textarea',savedNode.value??'');
        operator.value=savedNode.operator||'eq';valueType.value=savedNode.value_type||'text';
        const appendChild=data=>{
          if(children.length>=20)return;
          const child=conditionNode(childrenHost,data,depth+1);children.push(child);
          button(child.box,label('condition_remove'),()=>{children.splice(children.indexOf(child),1);child.box.remove();sync();markDirty();addCondition.focus();});sync();
        };
        const addCondition=button(group,label('condition_add'),()=>{appendChild({});markDirty();children.at(-1)?.box.querySelector('select').focus();});
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
          yesBox=make('fieldset');yesBox.append(make('legend',label('then')));noBox=make('fieldset');noBox.append(make('legend',label('else')));paths.append(yesBox,noBox);
          yes=stepCollection(yesBox,level+1);no=stepCollection(noBox,level+1);
          for(const child of saved?.then_steps||[])yes.addStep(child);for(const child of saved?.else_steps||[])no.addStep(child);
        }
        if(yesBox)yesBox.disabled=noBox.disabled=!branching;
      };conditional.addEventListener('change',syncCondition);type.addEventListener('change',syncCondition);
      if(saved){for(const [key,input] of Object.entries(values))input.value=String(saved.values?.[key]??'');if(attempts)attempts.value=String(saved.attempts??1);if(delay)delay.value=String(saved.retry_delay??10);}syncCondition();
      step.up=button(box,label('up'),()=>{const i=steps.indexOf(step);if(i>0){[steps[i-1],steps[i]]=[steps[i],steps[i-1]];renumber();markDirty();step.up.focus();}});
      step.down=button(box,label('down'),()=>{const i=steps.indexOf(step);if(i<steps.length-1){[steps[i+1],steps[i]]=[steps[i],steps[i+1]];renumber();markDirty();step.down.focus();}});
      button(box,label('remove'),()=>{steps.splice(steps.indexOf(step),1);box.remove();renumber();markDirty();add.focus();});
      step.read=()=>type.value==='branch'?{type:'branch',condition:{enabled:true,...conditionRoot.read()},then_steps:yes.read(),else_steps:no.read()}:{type:type.value,values:Object.fromEntries(Object.entries(values).map(([key,input])=>[key,input.value])),attempts:attempts.value,retry_delay:delay.value,condition:{enabled:conditional.checked,...conditionRoot.read()}};
      steps.push(step);renumber();
    }
    const add=button(container,label('add'),()=>{addStep();markDirty();steps.at(-1).box.querySelector('select').focus();});
    return {addStep,read:()=>steps.map(step=>step.read())};
    }
    const notice=make('output');notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');
    const collection=stepCollection(form);
    const save=make('button',()=>copy(pendingPublication?'retry_publication':'publish'));save.setAttribute('data-workflow-editor-action','publish');controls.add(save);save.type='submit';save.className='primary-button';form.append(save,notice);
    const read=()=>({name:name.value,version:version.value,trigger_type:trigger.value,automatic:automatic.checked,at:at.value.trim(),event_name:eventName.value.trim(),approval_required:approval.checked,steps:collection.read()});
    const frozenControls=new Map(),clone=value=>JSON.parse(JSON.stringify(value)),record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value),hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value),canonical=value=>Array.isArray(value)?value.map(canonical):record(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value,same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
    const invalid=()=>Object.assign(Error('workflow_editor_ack_invalid'),{code:'workflow_editor_ack_invalid'});
    const message=key=>bind(notice,()=>copy(key)),clearPreview=()=>{bindings.delete(zeroOutput);if(zeroOutput)zeroOutput.textContent='';};
    function feedback(error,key='error'){
      const status=error.status||error.statusCode;if([401,403].includes(status)){bind(notice,()=>shared(status===403?'common.access_denied':'identity.auth_required',status===403?'Toegang geweigerd.':'Meld je opnieuw aan.'));return;}
      message(error.code==='workflow_draft_invalid'?(error.issue==='condition_values'?'condition_values':'validation'):status===409||error.code==='workflow_draft_conflict'?'conflict':error.code==='workflow_editor_ack_invalid'&&!pendingZero&&!pendingPublication?'invalid':key);
    }
    const definite=error=>{const status=error.status||error.statusCode;return status>=400&&status<500&&![401,403,408,429].includes(status);};
    function lock(){
      for(const node of [save,zeroSave]){const entry=bindings.get(node);if(entry){entry.last=entry.read();node.textContent=entry.last;}}
      for(const [node,disabled]of frozenControls)node.disabled=disabled;frozenControls.clear();
      if(pendingZero||pendingPublication||publicationKnown)for(const node of controls){if(!node.isConnected){controls.delete(node);continue;}frozenControls.set(node,node.disabled);node.disabled=true;}
      if(pendingZero)zeroSave.disabled=exclusive;if(pendingPublication)save.disabled=exclusive;form.inert=exclusive;
    }
    const session=(id,revision)=>{let own;own=root.FoundlyWorkflowDraftSession.create({id,revision,request,requestContext,isActive:()=>active()&&draftSession===own&&draftId===id,onState:state=>message({SAVING:'saving',SAVED:'saved',CONFLICT:'conflict',ERROR:'error'}[state])});return own;};
    let draftId=initial?.id||root.crypto.randomUUID(),draftSession=session(draftId,initial?.revision||0);
    async function flush(){if(!active())throw Object.assign(Error('workflow_draft_session_inactive'),{code:'workflow_draft_session_inactive'});clearTimeout(timer);zeroPreview=null;clearPreview();if(zeroSave)zeroSave.disabled=true;const current=generation,own=draftSession;flushing++;try{await own.save(read());if(!active()||own!==draftSession)throw Object.assign(Error('workflow_draft_session_inactive'),{code:'workflow_draft_session_inactive'});savedGeneration=current;form.dataset.unsaved=String(savedGeneration!==generation);if(savedGeneration!==generation)message('dirty');}finally{flushing--;}}
    function markDirty(event){if(!active()||zeroReason&&event?.target===zeroReason||pendingZero||pendingPublication||publicationKnown)return;generation++;zeroPreview=null;if(zeroSave)zeroSave.disabled=true;clearPreview();form.dataset.unsaved='true';message('dirty');clearTimeout(timer);if(!exclusive)timer=setTimeout(()=>flush().catch(error=>{if(active())feedback(error);}),600);}
    form.addEventListener('input',markDirty);form.addEventListener('change',markDirty);
    button(form,label('draft_save'),()=>{if(!exclusive&&!pendingZero&&!pendingPublication&&!publicationKnown)return flush().catch(error=>{if(active())feedback(error,pendingZero||pendingPublication?'unconfirmed':'error');});});
    button(form,label('draft_new'),()=>{if(draftSession.uncertain){message('unconfirmed');return;}if(flushing||exclusive||pendingZero||pendingPublication||publicationKnown)return;draftId=root.crypto.randomUUID();draftSession=session(draftId,0);zeroPreview=null;if(zeroSave)zeroSave.disabled=true;return flush().catch(error=>{if(active())feedback(error,pendingZero||pendingPublication?'unconfirmed':'error');});});
    const reviewCopy=(key,fallback,params={})=>shared('workflow.generator.'+key,fallback,params);
    const scalar=value=>typeof value==='number'?number(value):typeof value==='boolean'?shared('workflow.inspector.'+String(value),value?'waar':'onwaar'):JSON.stringify(value);
    const condition=c=>c.not?shared('workflow.inspector.not','NIET')+' ('+condition(c.not)+')':c.all||c.any?'('+((c.all||c.any).map(condition).join(' '+shared('workflow.inspector.'+(c.all?'and':'or'),c.all?'EN':'OF')+' '))+')':c.field+' '+shared('workflow.inspector.operator.'+c.operator,({eq:'=',ne:'≠',gt:'>',gte:'≥',lt:'<',lte:'≤',exists:'bestaat',in:'in lijst'})[c.operator])+(c.operator==='exists'?'':' '+(Array.isArray(c.value)?c.value.map(scalar).join(', '):scalar(c.value)));
    function describe(def){
      const trigger=shared('workflow.trigger.'+def.trigger.type,def.trigger.type)+(def.trigger.event_name?' · '+def.trigger.event_name:'')+(def.trigger.at?' · '+(i18n?i18n.date(def.trigger.at,{dateStyle:'medium',timeStyle:'medium',timeZone:'UTC'})+' UTC':def.trigger.at):'');
      return [reviewCopy('heading','{name} · versie {version}',{name:def.name,version:number(def.version)}),reviewCopy('trigger','Trigger: {value}',{value:trigger}),reviewCopy('automatic','Automatisch na afzonderlijke publicatie: {value}',{value:reviewCopy(def.trigger.automatic?'yes':'no',def.trigger.automatic?'ja':'nee')}),reviewCopy('approval','Goedkeuring vóór uitvoering: {value}',{value:reviewCopy(def.approval_required?'required':'not_required',def.approval_required?'vereist':'niet vereist')})].join('\n')+'\n\n'+def.actions.map((action,index)=>reviewCopy('step','{index}. {action}',{index:number(index+1),action:shared('workflow.action.'+action.type,spec.actions.find(row=>row.type===action.type)?.label||action.type)})+'\n'+['title','content','message','seconds'].filter(key=>Object.hasOwn(action,key)).map(key=>reviewCopy('field','{label}: {value}',{label:reviewCopy(key,({title:'Titel',content:'Inhoud',message:'Melding',seconds:'Wachttijd (seconden)'})[key]),value:typeof action[key]==='number'?number(action[key]):action[key]})).join('\n')+'\n'+(action.when?reviewCopy('condition','Voorwaarde: {value}',{value:condition(action.when)}):reviewCopy('unconditional','Zonder voorwaarde'))+(action.retry?'\n'+reviewCopy('retry_policy','Maximaal {attempts} pogingen; eerste wachttijd {seconds} seconden',{attempts:number(action.retry.max_attempts),seconds:number(action.retry.initial_delay_seconds)}):'')).join('\n\n');
    }
    if(zeroRequest){
      const zeroBox=make('fieldset');zeroBox.append(make('legend',label('zero_legend')));form.append(zeroBox);
      zeroOutput=make('pre');zeroBox.append(zeroOutput);const reason=zeroReason=field(zeroBox,label('zero_reason'));reason.maxLength=500;
      const prepare=button(zeroBox,label('zero_prepare'),async()=>{
        if(prepare.disabled||exclusive||flushing||pendingZero||pendingPublication||publicationKnown)return;exclusive=true;prepare.disabled=true;zeroPreview=null;zeroSave.disabled=true;clearPreview();const sequence=++zeroSequence,start=generation;form.inert=true;message('preview_loading');
        try{
          await flush();if(!active()||generation!==start)return;
          const input=clone({draft:read(),expected_revision:draftSession.revision}),id=draftId,definition=root.FoundlyWorkflowAuthoring.compile(input.draft,spec);
          message('preview_loading');const result=await zeroRequest({operation:'PREVIEW',draft_id:id,input},root.crypto.randomUUID());
          if(!active()||generation!==start||sequence!==zeroSequence||draftId!==id)return;
          if(!record(result)||!hash(result.preview_fingerprint)||result.executable!==false||result.publication_required!==true||result.expected_revision!==input.expected_revision||!same(result.draft,input.draft)||!same(result.definition,definition))throw invalid();
          zeroPreview={input,id,definition,fingerprint:result.preview_fingerprint,generation:start};const shown=zeroPreview.definition;bind(zeroOutput,()=>describe(shown));message('review');zeroSave.disabled=false;
        }catch(error){if(active()&&generation===start)feedback(error,pendingZero||pendingPublication?'unconfirmed':'error');}finally{exclusive=false;if(active()){form.inert=false;prepare.disabled=false;}}
      });
      zeroSave=button(zeroBox,Object.assign(()=>copy(pendingZero?'retry_zero':'zero_confirm'),{key:'zero_confirm'}),async()=>{
        if(zeroSave.disabled||exclusive||flushing||pendingPublication||publicationKnown||!zeroPreview||zeroPreview.generation!==generation)return;
        if(!pendingZero){if(!reason.value.trim()){message('reason_required');return;}pendingZero={preview:zeroPreview,turn:root.crypto.randomUUID(),action:clone({operation:'SAVE',draft_id:zeroPreview.id,input:{...zeroPreview.input,preview_fingerprint:zeroPreview.fingerprint,confirm:true,reason:reason.value.trim()}})};}
        const pending=pendingZero,preview=pending.preview;exclusive=true;message('saving');form.dataset.unsaved='true';clearTimeout(timer);lock();
        try{
          const result=await zeroRequest(clone(pending.action),pending.turn);if(!active()||pendingZero!==pending)return;
          await root.FoundlyWorkflowDraftSession.acknowledge(result,{id:preview.id,revision:preview.input.expected_revision,body:JSON.stringify(preview.input),requestContext});if(!active()||pendingZero!==pending)return;
          if(!same(root.FoundlyWorkflowAuthoring.compile(result.record.draft,spec),preview.definition))throw invalid();
          pendingZero=null;lock();
          draftSession=session(draftId,result.record.revision);savedGeneration=generation;form.dataset.unsaved='false';zeroPreview=null;clearPreview();message('zero_saved');
          zeroSave.disabled=true;
        }catch(error){if(active()&&pendingZero===pending){if(definite(error)){pendingZero=null;zeroPreview=null;clearPreview();lock();zeroSave.disabled=true;}feedback(error,pendingZero||pendingPublication?'unconfirmed':'error');}}finally{exclusive=false;if(active())lock();}
      });zeroSave.disabled=true;
    }
    if(initial){const d=initial.draft;name.value=d.name||'';version.value=String(d.version??1);trigger.value=d.trigger_type||'custom_event';automatic.checked=d.automatic===true;at.value=d.at||'';eventName.value=d.event_name||'';approval.checked=d.approval_required===true;syncTrigger();for(const step of d.steps||[])collection.addStep(step);}else collection.addStep();
    form.dataset.unsaved='false';
    form.addEventListener('submit',async event=>{event.preventDefault();if(!active()||exclusive||flushing||pendingZero||publicationKnown)return;exclusive=true;const start=generation,own=draftSession;save.disabled=true;try{
      if(!pendingPublication){const definition=root.FoundlyWorkflowAuthoring.compile(read(),spec);form.inert=true;await flush();if(!active()||generation!==start||draftSession!==own)return;pendingPublication={definition:clone(definition),body:JSON.stringify(definition)};}
      const pending=pendingPublication;form.dataset.unsaved='true';lock();const result=await request('/api/automation/workflows',{method:'POST',body:pending.body});if(!active()||pendingPublication!==pending)return;
      const expected=pending.definition;
      if(!record(result)||typeof result.id!=='string'||!result.id||result.immutable_version!==true||!hash(result.signature)||result.name!==expected.name||result.version!==expected.version||result.enabled!==true||result.approval_required!==expected.approval_required||!same(result.actions,expected.actions)||!same(result.trigger,expected.trigger)||requestContext&&(result.tenant_id!==requestContext.tenant_id||result.dealer_id!==requestContext.dealer_id))throw invalid();
      if(result.signature!==await root.FoundlyWorkflowDraftSession.fingerprint(JSON.stringify({name:result.name,version:result.version,trigger:result.trigger,actions:result.actions,enabled:result.enabled,approval_required:result.approval_required})))throw invalid();if(!active()||pendingPublication!==pending)return;
      pendingPublication=null;publicationKnown=true;form.dataset.unsaved='false';message('published');await onSaved();if(active())publicationKnown=false;
    }catch(error){if(active()){if(publicationKnown)message('published_refresh');else{if(definite(error))pendingPublication=null;feedback(error,pendingPublication?'unconfirmed':'error');}}}finally{exclusive=false;if(active()){lock();if(!pendingPublication&&!publicationKnown)save.disabled=false;}}});
    return form;
  }
  root.FoundlyWorkflowEditor={create};
})(globalThis);
