'use strict';
// Shared authoring contract. Execution and authorization remain in the existing
// workflow engine; compiling a draft never persists or executes anything.
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FoundlyWorkflowAuthoring=api;})(globalThis,()=>{
  const fields={
    create_task:{label:'Taak maken',fields:[{key:'title',label:'Taaktitel',required:true,max:200}]},
    create_document:{label:'Conceptdocument maken',fields:[{key:'title',label:'Documenttitel',required:true,max:200},{key:'content',label:'Inhoud',multiline:true,max:12000}]},
    notify:{label:'Interne melding',fields:[{key:'message',label:'Melding',required:true,max:240}]},
    delay:{label:'Wachten',fields:[{key:'seconds',label:'Wachttijd in seconden',type:'number',required:true,min:1,max:2592000}]}
  };
  const operators=['eq','ne','gt','gte','lt','lte','exists','in'];
  const fail=message=>{throw Object.assign(new Error(message),{code:'workflow_draft_invalid'});};
  const integer=(value,min,max,label)=>{const n=Number(value);if(!Number.isInteger(n)||n<min||n>max)fail(`${label}: kies ${min} tot ${max}.`);return n;};
  function contract(automation){return {version:1,max_steps:100,triggers:automation.triggers,automatic_event_aliases:automation.event_aliases||{},actions:Object.entries(fields).filter(([type])=>automation.actions.includes(type)).map(([type,value])=>({type,...value,retryable:(automation.retryable_actions||[]).includes(type)})),operators};}
  function compile(draft,spec){
    const name=String(draft.name||'').trim();if(!name||name.length>200)fail('Vul een workflownaam van maximaal 200 tekens in.');
    const version=integer(draft.version??1,1,2147483647,'Versie');
    if(!spec.triggers.includes(draft.trigger_type))fail('Kies een ondersteunde trigger.');
    const trigger={type:draft.trigger_type,automatic:draft.automatic===true};
    if(trigger.type==='schedule'){
      const at=String(draft.at||'');if(!/(?:Z|[+-]\d{2}:\d{2})$/.test(at)||!Number.isFinite(Date.parse(at)))fail('Geef een geldig tijdstip met UTC-offset, bijvoorbeeld 2026-09-30T09:00:00+02:00.');trigger.at=new Date(at).toISOString();
    }else if(draft.event_name){if(!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/.test(draft.event_name))fail('De eventnaam is ongeldig.');trigger.event_name=draft.event_name;}
    if(trigger.automatic&&trigger.type!=='schedule'&&!Object.hasOwn(spec.automatic_event_aliases,trigger.type)&&!trigger.event_name)fail('Automatische uitvoering vereist een expliciete eventnaam.');
    if(!Array.isArray(draft.steps)||!draft.steps.length||draft.steps.length>spec.max_steps)fail(`Kies 1 tot ${spec.max_steps} stappen.`);
    const actions=draft.steps.map(step=>{
      const definition=spec.actions.find(row=>row.type===step.type);if(!definition)fail('Deze stap wordt niet door de editor ondersteund.');
      const action={type:step.type};
      for(const field of definition.fields){const value=step.values?.[field.key];if(field.type==='number')action[field.key]=integer(value,field.min,field.max,field.label);else {const text=String(value||'').trim();if(field.required&&!text||text.length>field.max)fail(`Controleer ${field.label.toLowerCase()}.`);if(text)action[field.key]=text;}}
      if(step.condition?.enabled){
        const c=step.condition;if(!/^(event|inputs)(?:\.[A-Za-z][A-Za-z0-9_]{0,79}){1,5}$/.test(c.field)||/(?:__proto__|constructor|prototype)/.test(c.field)||!operators.includes(c.operator))fail('Controleer het conditieveld en de vergelijking.');
        const when={field:c.field,operator:c.operator};
        if(c.operator!=='exists'){
          let value=c.value;
          if(c.value_type==='number'){if(String(value).trim()===''||!Number.isFinite(Number(value)))fail('Vul een geldig getal voor de conditie in.');value=Number(value);}
          else if(c.value_type==='boolean'){if(!['true','false'].includes(String(value)))fail('Kies true of false voor de conditie.');value=String(value)==='true';}
          else value=String(value??'');
          if(c.operator==='in')value=String(c.value||'').split('\n').map(item=>item.trim()).filter(Boolean);
          if(['gt','gte','lt','lte'].includes(c.operator)&&typeof value!=='number')fail('Deze vergelijking vereist een getal.');
          when.value=value;
        }
        action.when=when;
      }
      const attempts=integer(step.attempts??1,1,5,'Pogingen');
      if(attempts>1){if(!definition.retryable)fail('Deze actie ondersteunt geen veilige retries.');action.retry={max_attempts:attempts,initial_delay_seconds:integer(step.retry_delay,1,3600,'Retrywachttijd')};}
      return action;
    });
    return {name,version,trigger,actions,approval_required:draft.approval_required===true};
  }
  return {contract,compile};
});
