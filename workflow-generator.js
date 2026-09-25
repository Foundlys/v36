'use strict';
(function(root){
 const fallback={legend:'Workflow beschrijven met ZERO',help:'Beschrijf de trigger, stappen en eventuele als/anders-voorwaarden. Het model maakt een voorstel. Controleer dit voordat je het als privéconcept bewaart.',prompt:'Gewenste workflow',prepare:'Voorstel uit beschrijving maken',reason:'Reden om dit voorstel als concept te bewaren',save:'Bevestig voorstel als privéconcept',changed:'Beschrijving gewijzigd; maak een nieuw voorstel.',prompt_required:'Beschrijf eerst de gewenste workflow.',loading:'Voorstel voorbereiden…',review:'Modelvoorstel — controleer alle stappen. Er is nog geen concept bewaard.',reason_required:'Vul een reden in om het voorstel te bewaren.',saved:'Privéconcept bewaard. Open het via Bewaard concept om het te bewerken. Publicatie en uitvoering vereisen afzonderlijke stappen.',saving:'Gecontroleerd privéconcept bewaren…',unconfirmed:'De opslag is nog niet bevestigd. Probeer dezelfde aanvraag opnieuw; de gecontroleerde invoer blijft vaststaan.',retry:'Dezelfde opslag opnieuw controleren',failed:'Het workflowvoorstel is niet beschikbaar. Probeer opnieuw.',invalid:'Het ontvangen workflowvoorstel kon niet worden bevestigd.',conflict:'Het concept is gewijzigd of de bevestiging is afgewezen. Maak een nieuw voorstel.',heading:'{name} · versie {version}',trigger:'Trigger: {value}',automatic:'Automatisch na afzonderlijke publicatie: {value}',approval:'Goedkeuring vóór uitvoering: {value}',yes:'ja',no:'nee',required:'vereist',not_required:'niet vereist',step:'{index}. {action}',field:'{label}: {value}',condition:'Voorwaarde: {value}',unconditional:'Zonder voorwaarde',retry_policy:'Maximaal {attempts} pogingen; eerste wachttijd {seconds} seconden',title:'Titel',content:'Inhoud',message:'Melding',seconds:'Wachttijd (seconden)',questions:'Verduidelijk je beschrijving:\n{questions}'};
 const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value),clone=value=>JSON.parse(JSON.stringify(value)),hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
 function create({document,spec,zeroRequest,onSaved,isActive=()=>true}){
  const i18n=root.FoundlyI18n,el=tag=>document.createElement(tag),box=el('fieldset'),bindings=new Map();let generation=0,proposal=null,pendingSave=null,busy=false;
  const active=()=>box.isConnected&&isActive(),number=value=>i18n?i18n.number(value,{maximumSignificantDigits:21}):String(value),copy=(key,params={})=>i18n?i18n.t('workflow.generator.'+key,params):(fallback[key]||key).replace(/\{(\w+)\}/g,(_,name)=>String(params[name]));
  const inspectCopy=key=>i18n?i18n.t('workflow.inspector.'+key):({true:'waar',false:'onwaar',and:'EN',or:'OF',not:'NIET','operator.exists':'bestaat','operator.in':'één van'}[key]||key);
  function bind(node,read){const entry={read,last:read()};node.textContent=entry.last;bindings.set(node,entry);return node;}
  const owned=(tag,key)=>bind(el(tag),()=>copy(key));
  box.append(owned('legend','legend'),owned('p','help'));
  const field=(key,tag='input')=>{const label=el('label'),input=el(tag);label.append(owned('span',key),input);box.append(label);return input;};
  const prompt=field('prompt','textarea');prompt.maxLength=4000;
  const prepare=owned('button','prepare');prepare.type='button';box.append(prepare);
  const preview=el('pre'),notice=el('output');notice.setAttribute('aria-live','polite');box.append(preview,notice);
  const reason=field('reason');reason.maxLength=500;
  const save=owned('button','save');save.type='button';box.append(save);
  const lock=()=>{prepare.disabled=busy||Boolean(pendingSave);save.disabled=busy||!proposal;prompt.disabled=Boolean(pendingSave);reason.disabled=busy||Boolean(pendingSave);};
  const message=key=>bind(notice,()=>copy(key));
  const clearPreview=()=>{bindings.delete(preview);preview.textContent='';};
  function discard(){proposal=null;pendingSave=null;clearPreview();bind(save,()=>copy('save'));}
  function feedback(error,fallbackKey='failed'){const status=error.status||error.statusCode,key=status===403?'common.access_denied':status===401?'identity.auth_required':null;bind(notice,()=>i18n&&key?i18n.t(key):copy(error.invalidProposal?'invalid':fallbackKey));}
  document.addEventListener?.('foundly:locale',()=>{if(!active())return;for(const [node,entry]of bindings)if(node.textContent===entry.last){entry.last=entry.read();node.textContent=entry.last;}});
  prompt.addEventListener('input',()=>{if(!active()||pendingSave)return;generation++;discard();message('changed');lock();});
  const scalar=value=>typeof value==='number'?number(value):typeof value==='boolean'?inspectCopy(String(value)):JSON.stringify(value);
  const condition=c=>c.not?inspectCopy('not')+' ('+condition(c.not)+')':c.all||c.any?'('+((c.all||c.any).map(condition).join(' '+inspectCopy(c.all?'and':'or')+' '))+')':c.field+' '+(['exists','in'].includes(c.operator)?inspectCopy('operator.'+c.operator):({eq:'=',ne:'≠',gt:'>',gte:'≥',lt:'<',lte:'≤'}[c.operator]))+(c.operator==='exists'?'':' '+(Array.isArray(c.value)?c.value.map(scalar).join(', '):scalar(c.value)));
  function describe(def){
   const trigger=i18n?i18n.t('workflow.trigger.'+def.trigger.type):def.trigger.type;
   return [copy('heading',{name:def.name,version:number(def.version)}),copy('trigger',{value:trigger+(def.trigger.event_name?' · '+def.trigger.event_name:'')+(def.trigger.at?' · '+(i18n?i18n.date(def.trigger.at,{dateStyle:'medium',timeStyle:'medium',timeZone:'UTC'})+' UTC':def.trigger.at):'')}),copy('automatic',{value:copy(def.trigger.automatic?'yes':'no')}),copy('approval',{value:copy(def.approval_required?'required':'not_required')})].join('\n')+'\n\n'+def.actions.map((a,index)=>copy('step',{index:number(index+1),action:i18n?i18n.t('workflow.action.'+a.type):spec.actions.find(row=>row.type===a.type)?.label||a.type})+'\n'+['title','content','message','seconds'].filter(k=>Object.hasOwn(a,k)).map(k=>copy('field',{label:copy(k),value:typeof a[k]==='number'?number(a[k]):a[k]})).join('\n')+'\n'+(a.when?copy('condition',{value:condition(a.when)}):copy('unconditional'))+(a.retry?'\n'+copy('retry_policy',{attempts:number(a.retry.max_attempts),seconds:number(a.retry.initial_delay_seconds)}):'')).join('\n\n');
  }
  const invalid=()=>Object.assign(Error('invalid_workflow_proposal'),{invalidProposal:true});
  function checked(data,id){
   if(!record(data)||data.executable!==false||data.inference!==true)throw invalid();
   if(Object.hasOwn(data,'questions')){if(!Array.isArray(data.questions)||!data.questions.length||data.questions.length>5||data.questions.some(q=>typeof q!=='string'||!q.trim()||q.length>500)||data.draft!==undefined||data.definition!==undefined)throw invalid();return null;}
   if(!record(data.draft)||!record(data.definition)||!hash(data.preview_fingerprint)||data.draft_id!==id||data.expected_revision!==0||data.publication_required!==true||typeof data.draft.name!=='string'||typeof data.draft.automatic!=='boolean'||typeof data.draft.approval_required!=='boolean')throw invalid();
   let definition;try{definition=root.FoundlyWorkflowAuthoring.compile(data.draft,spec);}catch{throw invalid();}if(JSON.stringify(definition)!==JSON.stringify(data.definition))throw invalid();return definition;
  }
  prepare.addEventListener('click',async()=>{
   if(!active()||busy||pendingSave)return;if(!prompt.value.trim()){message('prompt_required');return;}
   busy=true;discard();lock();message('loading');const start=generation,id=root.crypto.randomUUID();
   try{
    const data=await zeroRequest({operation:'GENERATE',draft_id:id,input:{prompt:prompt.value,expected_revision:0}},root.crypto.randomUUID());if(!active()||generation!==start)return;
    const definition=checked(data,id);if(!definition){const questions=data.questions.join('\n');bind(notice,()=>copy('questions',{questions}));return;}
    proposal={id,input:clone({draft:data.draft,expected_revision:0}),definition:clone(definition),fingerprint:data.preview_fingerprint,generation:start};const displayed=proposal.definition;bind(preview,()=>describe(displayed));message('review');
   }catch(error){if(active()&&generation===start){discard();feedback(error);}}finally{busy=false;if(active())lock();}
  });
  function acknowledge(data,p){
   const r=data?.record;if(!record(data)||data.executable!==false||typeof data.deduplicated!=='boolean'||!record(r)||r.id!==p.id||r.revision!==p.input.expected_revision+1||r.request_revision!==p.input.expected_revision||r.executable!==false||r.status!=='DRAFT'||r.schema_version!==1||!hash(r.fingerprint)||!record(r.draft))throw invalid();
   let definition;try{definition=root.FoundlyWorkflowAuthoring.compile(r.draft,spec);}catch{throw invalid();}if(JSON.stringify(definition)!==JSON.stringify(p.definition))throw invalid();
  }
  save.addEventListener('click',async()=>{
   if(!active()||busy||save.disabled||!proposal||proposal.generation!==generation)return;
   if(!pendingSave){if(!reason.value.trim()){message('reason_required');return;}pendingSave={proposal,action:clone({operation:'SAVE',draft_id:proposal.id,input:{...proposal.input,preview_fingerprint:proposal.fingerprint,confirm:true,reason:reason.value.trim()}}),turn:root.crypto.randomUUID()};}
   const pending=pendingSave,p=proposal;busy=true;lock();message('saving');
   try{
    const data=await zeroRequest(clone(pending.action),pending.turn);if(!active()||proposal!==p||generation!==p.generation)return;acknowledge(data,p);discard();message('saved');await onSaved(data.record);
   }catch(error){if(active()&&proposal===p){const status=error.status||error.statusCode;if(status>=400&&status<500&&![408,429].includes(status)){discard();feedback(error,'conflict');}else{message('unconfirmed');bind(save,()=>copy('retry'));}}}
   finally{busy=false;if(active())lock();}
  });lock();return box;
 }
 root.FoundlyWorkflowGenerator={create};
})(globalThis);
