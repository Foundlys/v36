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
  function validateDraftCondition(condition,depth=0,budget={nodes:0}){
    if(!condition||typeof condition!=='object'||Array.isArray(condition)||depth>5||++budget.nodes>200)fail('Ongeldige conditiegroep.');
    if(depth===0&&typeof condition.enabled!=='boolean'||depth>0&&Object.hasOwn(condition,'enabled'))fail('Een conditie vereist een expliciete aan/uit-keuze.');
    const mode=condition.mode??'leaf';
    if(!['leaf','all','any'].includes(mode))fail('Kies een vergelijking, EN-groep of OF-groep.');
    const allowed=mode==='leaf'?['enabled','mode','field','operator','value_type','value']:['enabled','mode','children'];
    if(Object.keys(condition).some(key=>!allowed.includes(key)))fail('Onbekende conditievelden.');
    if(mode==='leaf'){
      for(const key of ['field','operator','value_type','value'])if(condition[key]!==undefined&&(typeof condition[key]!=='string'||condition[key].length>12000))fail('Ongeldige conditie-invoer.');
    }else{
      if(!Array.isArray(condition.children)||condition.children.length>20)fail('Een groep ondersteunt maximaal twintig onderdelen.');
      for(const child of condition.children)validateDraftCondition(child,depth+1,budget);
    }
    return condition;
  }
  function compileCondition(c){
    if(c.mode==='all'||c.mode==='any'){
      if(!c.children.length)fail('Een conditiegroep mag niet leeg zijn.');
      return {[c.mode]:c.children.map(compileCondition)};
    }
    if(!/^(event|inputs)(?:\.[A-Za-z][A-Za-z0-9_]{0,79}){1,5}$/.test(c.field)||/(?:__proto__|constructor|prototype)/.test(c.field)||!operators.includes(c.operator))fail('Controleer het conditieveld en de vergelijking.');
    const when={field:c.field,operator:c.operator};
    if(c.operator!=='exists'){
      let value=c.value;
      if(!['text','number','boolean'].includes(c.value_type??'text'))fail('Kies een ondersteund waardetype.');
      if(c.operator==='in'){
        value=String(c.value??'').split('\n').map(item=>item.trim()).filter(Boolean);
        if(!value.length||value.length>100)fail('Vul 1 tot 100 vergelijkingswaarden in.');
      }else if(c.value_type==='number'){if(String(value??'').trim()===''||!Number.isFinite(Number(value)))fail('Vul een geldig getal voor de conditie in.');value=Number(value);}
      else if(c.value_type==='boolean'){if(!['true','false'].includes(String(value)))fail('Kies true of false voor de conditie.');value=String(value)==='true';}
      else value=String(value??'');
      if(['gt','gte','lt','lte'].includes(c.operator)&&typeof value!=='number')fail('Deze vergelijking vereist een getal.');
      when.value=value;
    }
    return when;
  }
  function runFields(workflow){
    const result=new Set();let nodes=0;
    function visit(c,depth=0){
      if(!c||typeof c!=='object'||Array.isArray(c)||depth>5||++nodes>200)fail('Deze workflow bevat een ongeldige conditie.');
      const groups=['all','any'].filter(key=>Object.hasOwn(c,key));
      if(groups.length){if(groups.length!==1||Object.keys(c).length!==1||!Array.isArray(c[groups[0]])||!c[groups[0]].length||c[groups[0]].length>20)fail('Ongeldige conditiegroep.');for(const child of c[groups[0]])visit(child,depth+1);return;}
      if(typeof c.field!=='string'||!/^(event|inputs)(?:\.[A-Za-z][A-Za-z0-9_]{0,79}){1,5}$/.test(c.field)||/(?:__proto__|constructor|prototype)/.test(c.field)||!operators.includes(c.operator))fail('Ongeldig conditieveld.');result.add(c.field);if(result.size>200)fail('Dit formulier ondersteunt maximaal tweehonderd verschillende conditievelden.');
    }
    if(!Array.isArray(workflow.actions)||!workflow.actions.length||workflow.actions.length>100)fail('Ongeldige workflowstappen.');
    for(const action of workflow.actions){nodes=0;if(!action||typeof action!=='object'||Array.isArray(action))fail('Ongeldige workflowstap.');if(Object.hasOwn(action,'when'))visit(action.when);}
    return [...result].sort().map(path=>({path,fixed:path.startsWith('event.')&&['event_id','event_version','tenant_id','dealer_id','type','source'].includes(path.split('.')[1])}));
  }
  function manualRunInput(workflow,eventId,values={}){
    if(typeof eventId!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/.test(eventId))fail('Gebruik een geldige unieke uitvoerreferentie.');
    const fields=runFields(workflow),event={event_id:eventId,event_version:1,type:workflow.trigger?.type,source:'authorized_manual_run',...(workflow.tenant_id?{tenant_id:workflow.tenant_id}:{}),...(workflow.dealer_id?{dealer_id:workflow.dealer_id}:{})},inputs={};
    if(!values||typeof values!=='object'||Array.isArray(values)||Object.keys(values).some(path=>!fields.some(field=>field.path===path&&!field.fixed)))fail('Onbekende of gereserveerde uitvoerinvoer.');
    for(const [path,selection]of Object.entries(values)){
      if(!selection||typeof selection!=='object'||Array.isArray(selection)||Object.keys(selection).some(key=>!['type','value'].includes(key))||!['absent','text','number','boolean','null'].includes(selection.type))fail('Kies een geldig invoertype.');
      if(selection.type==='absent')continue;let value=selection.value;
      if(selection.type==='null')value=null;
      else if(selection.type==='number'){if(typeof value!=='string'||!value.trim()||!Number.isFinite(Number(value)))fail('Vul een geldig getal in voor '+path);value=Number(value);}
      else if(selection.type==='boolean'){if(!['true','false'].includes(value))fail('Kies true of false voor '+path);value=value==='true';}
      else if(typeof value!=='string'||value.length>12000)fail('Vul maximaal 12000 tekens in voor '+path);
      const parts=path.split('.'),last=parts.pop();let target=parts.shift()==='event'?event:inputs;
      for(const key of parts){if(Object.hasOwn(target,key)&&(target[key]===null||typeof target[key]!=='object'||Array.isArray(target[key])))fail('Botsende invoervelden: '+path);if(!Object.hasOwn(target,key))target[key]={};target=target[key];}
      if(Object.hasOwn(target,last))fail('Botsende invoervelden: '+path);target[last]=value;
    }
    return {event,options:{inputs}};
  }
  function contract(automation){return {version:1,condition_groups:{modes:['all','any'],max_depth:5,max_children:20,max_nodes:200},max_steps:100,triggers:automation.triggers,automatic_event_aliases:automation.event_aliases||{},actions:Object.entries(fields).filter(([type])=>automation.actions.includes(type)).map(([type,value])=>({type,...value,retryable:(automation.retryable_actions||[]).includes(type)})),operators};}
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
      if(Object.hasOwn(step,'condition')){
        validateDraftCondition(step.condition);
        if(step.condition.enabled)action.when=compileCondition(step.condition);
      }
      const attempts=integer(step.attempts??1,1,5,'Pogingen');
      if(attempts>1){if(!definition.retryable)fail('Deze actie ondersteunt geen veilige retries.');action.retry={max_attempts:attempts,initial_delay_seconds:integer(step.retry_delay,1,3600,'Retrywachttijd')};}
      return action;
    });
    return {name,version,trigger,actions,approval_required:draft.approval_required===true};
  }
  return {contract,compile,validateDraftCondition,runFields,manualRunInput};
});
