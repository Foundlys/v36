'use strict';
// Original sequential form editor over the existing versioned workflow API.
(function(root){
  function create({document,spec,request,onSaved}){
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
    form.append(make('p','Stappen worden op volgorde uitgevoerd. Een onware conditie slaat alleen die stap over. Opslaan bewaart deze versie; oudere versies en uitvoerhistorie blijven behouden. Automatische versies draaien afzonderlijk; oudere actieve versies blijven actief.'));
    const list=make('div');list.className='workflow-step-list';form.append(list);const steps=[];
    const notice=make('output');notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');
    function renumber(){steps.forEach((step,index)=>{step.legend.textContent=`Stap ${index+1}`;step.up.disabled=index===0;step.down.disabled=index===steps.length-1;list.append(step.box);});add.disabled=steps.length>=spec.max_steps;}
    function addStep(){
      const step={},box=make('fieldset'),legend=make('legend'),settings=make('div');step.box=box;step.legend=legend;box.append(legend);
      const type=select(box,'Actie',spec.actions.map(a=>[a.type,a.label]));box.append(settings);let values={},attempts,delay;
      const renderFields=()=>{settings.replaceChildren();values={};const definition=spec.actions.find(a=>a.type===type.value);for(const item of definition.fields){const input=field(settings,item.label,item.multiline?'textarea':item.type||'text',item.type==='number'?'1':'');input.required=Boolean(item.required);if(item.type==='number'){input.min=String(item.min);input.max=String(item.max);}else input.maxLength=item.max;values[item.key]=input;}attempts=field(settings,'Maximum aantal pogingen','number','1');attempts.min='1';attempts.max='5';attempts.disabled=!definition.retryable;delay=field(settings,'Eerste retrywachttijd in seconden','number','10');delay.min='1';delay.max='3600';delay.disabled=!definition.retryable;};type.addEventListener('change',renderFields);renderFields();
      const conditional=field(box,'Alleen uitvoeren wanneer de conditie waar is','checkbox'),conditions=make('div');box.append(conditions);
      const conditionField=field(conditions,'Conditieveld, bijvoorbeeld inputs.priority'),operator=select(conditions,'Vergelijking',[['eq','Gelijk aan'],['ne','Niet gelijk aan'],['gt','Groter dan'],['gte','Groter of gelijk'],['lt','Kleiner dan'],['lte','Kleiner of gelijk'],['exists','Veld bestaat'],['in','Een van de waarden (één per regel)']]),valueType=select(conditions,'Waardetype',[['text','Tekst'],['number','Getal'],['boolean','Boolean (true / false)']]),value=field(conditions,'Vergelijkingswaarde','textarea');
      const syncCondition=()=>{conditions.hidden=!conditional.checked;conditionField.required=conditional.checked;value.parentElement.hidden=operator.value==='exists';valueType.parentElement.hidden=['exists','in'].includes(operator.value);};conditional.addEventListener('change',syncCondition);operator.addEventListener('change',syncCondition);syncCondition();
      step.up=button(box,'Stap omhoog',()=>{const i=steps.indexOf(step);if(i>0){[steps[i-1],steps[i]]=[steps[i],steps[i-1]];renumber();step.up.focus();}});
      step.down=button(box,'Stap omlaag',()=>{const i=steps.indexOf(step);if(i<steps.length-1){[steps[i+1],steps[i]]=[steps[i],steps[i+1]];renumber();step.down.focus();}});
      button(box,'Stap verwijderen',()=>{steps.splice(steps.indexOf(step),1);box.remove();renumber();add.focus();});
      step.read=()=>({type:type.value,values:Object.fromEntries(Object.entries(values).map(([key,input])=>[key,input.value])),attempts:attempts.value,retry_delay:delay.value,condition:{enabled:conditional.checked,field:conditionField.value.trim(),operator:operator.value,value_type:valueType.value,value:value.value}});
      steps.push(step);renumber();
    }
    const add=button(form,'Stap toevoegen',()=>{addStep();steps.at(-1).box.querySelector('select').focus();});
    const save=make('button','Workflowversie opslaan');save.type='submit';save.className='primary-button';form.append(save,notice);addStep();
    form.addEventListener('submit',async event=>{event.preventDefault();save.disabled=true;try{
      const definition=root.FoundlyWorkflowAuthoring.compile({name:name.value,version:version.value,trigger_type:trigger.value,automatic:automatic.checked,at:at.value.trim(),event_name:eventName.value.trim(),approval_required:approval.checked,steps:steps.map(s=>s.read())},spec);
      await request('/api/automation/workflows',{method:'POST',body:JSON.stringify(definition)});await onSaved();
    }catch(error){notice.textContent=error.message||'Opslaan is niet gelukt.';}finally{save.disabled=false;}});
    return form;
  }
  root.FoundlyWorkflowEditor={create};
})(globalThis);
