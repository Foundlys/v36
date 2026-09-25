'use strict';
(function(root){
 const fallback={legend:'Workflow beschrijven met ZERO',help:'Beschrijf de trigger, stappen en eventuele als/anders-voorwaarden. Het model maakt een voorstel. Controleer dit voordat je het als privéconcept bewaart.',prompt:'Gewenste workflow',prepare:'Voorstel uit beschrijving maken',reason:'Reden om dit voorstel als concept te bewaren',save:'Bevestig voorstel als privéconcept',changed:'Beschrijving gewijzigd; maak een nieuw voorstel.',prompt_required:'Beschrijf eerst de gewenste workflow.',loading:'Voorstel voorbereiden…',review:'Modelvoorstel — controleer alle stappen. Er is nog geen concept bewaard.',reason_required:'Vul een reden in om het voorstel te bewaren.',saved:'Privéconcept bewaard. Open het via Bewaard concept om het te bewerken. Publicatie en uitvoering vereisen afzonderlijke stappen.',saving:'Gecontroleerd privéconcept bewaren…',unconfirmed:'De opslag is nog niet bevestigd. Probeer dezelfde aanvraag opnieuw; de gecontroleerde invoer blijft vaststaan.',retry:'Dezelfde opslag opnieuw controleren',failed:'Het workflowvoorstel is niet beschikbaar. Probeer opnieuw.',invalid:'Het ontvangen workflowvoorstel kon niet worden bevestigd.',conflict:'Het concept is gewijzigd of de bevestiging is afgewezen. Maak een nieuw voorstel.',heading:'{name} · versie {version}',trigger:'Trigger: {value}',automatic:'Automatisch na afzonderlijke publicatie: {value}',approval:'Goedkeuring vóór uitvoering: {value}',yes:'ja',no:'nee',required:'vereist',not_required:'niet vereist',step:'{index}. {action}',field:'{label}: {value}',condition:'Voorwaarde: {value}',unconditional:'Zonder voorwaarde',retry_policy:'Maximaal {attempts} pogingen; eerste wachttijd {seconds} seconden',title:'Titel',content:'Inhoud',message:'Melding',seconds:'Wachttijd (seconden)',questions:'Verduidelijk je beschrijving:\n{questions}',recover:'Eerdere conceptopslag afhandelen',pending:'Een eerdere conceptopslag is nog niet bevestigd. Haal de bewaarde bevestiging op of sluit de aanvraag af als die niet is uitgevoerd.',not_applied:'De eerdere aanvraag is afgesloten zonder conceptopslag. Een vertraagde aanvraag kan dit concept niet meer aanmaken.',storage_required:'Herstelgegevens kunnen niet veilig worden bewaard. Sta sessieopslag toe en vernieuw de weergave voordat je opslaat.',saved_metadata:'De conceptopslag is bevestigd. De lokale herstelverwijzing kon niet worden verwijderd; controleer deze na verversen.',recovery_metadata:'Hersteluitkomst bevestigd. De lokale herstelverwijzing kon niet worden verwijderd; controleer deze na verversen.',recovered:'Het bewaarde privéconcept is teruggevonden. Publicatie en uitvoering blijven afzonderlijke stappen.',recovery_changed:'De oorspronkelijke conceptbevestiging is niet meer actueel of beschikbaar. Controleer de huidige concepten.'};
 const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value),clone=value=>JSON.parse(JSON.stringify(value)),hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
 function create({document,spec,zeroRequest,onSaved,recoverRequest,requestContext,isActive=()=>true}){
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
  const realm=record(requestContext)&&['tenant_id','dealer_id','actor_id'].every(key=>typeof requestContext[key]==='string'&&requestContext[key].length>0&&requestContext[key].length<=200)?Object.freeze({tenant_id:requestContext.tenant_id,dealer_id:requestContext.dealer_id,actor_id:requestContext.actor_id}):null;
  const storageKey=realm?'foundly.workflow.generator.v1:'+JSON.stringify([realm.tenant_id,realm.dealer_id,realm.actor_id]):null,recovery=el('div'),prior=[];box.append(recovery);let storageReady=true;
  const validMetadata=row=>record(row)&&Object.keys(row).length===3&&typeof row.draft_id==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(row.draft_id)&&row.expected_revision===0&&hash(row.preview_fingerprint);
  function readPending(){if(!storageKey)throw Error('draft_recovery_context_required');const raw=root.sessionStorage.getItem(storageKey),rows=raw===null?[]:JSON.parse(raw);if(!Array.isArray(rows)||rows.length>100||!rows.every(validMetadata)||new Set(rows.map(row=>row.draft_id)).size!==rows.length)throw Error('invalid_draft_recovery_metadata');return rows;}
  function storePending(rows){if(rows.length)root.sessionStorage.setItem(storageKey,JSON.stringify(rows));else root.sessionStorage.removeItem(storageKey);}
  function forget(id){try{storePending(readPending().filter(row=>row.draft_id!==id));}catch(error){storageReady=false;throw error;}}
  const metadata=p=>({draft_id:p.id,expected_revision:p.input.expected_revision,preview_fingerprint:p.fingerprint});
  const hasPrior=()=>prior.some(row=>!row.done);
  const lock=()=>{prepare.disabled=busy||Boolean(pendingSave)||hasPrior();save.disabled=busy||!proposal||!storageReady||hasPrior();prompt.disabled=Boolean(pendingSave)||hasPrior();reason.disabled=busy||Boolean(pendingSave)||hasPrior();};
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
   if(!active()||busy||pendingSave||hasPrior())return;if(!prompt.value.trim()){message('prompt_required');return;}
   busy=true;discard();lock();message('loading');const start=generation,id=root.crypto.randomUUID();
   try{
    const data=await zeroRequest({operation:'GENERATE',draft_id:id,input:{prompt:prompt.value,expected_revision:0}},root.crypto.randomUUID());if(!active()||generation!==start)return;
    const definition=checked(data,id);if(!definition){const questions=data.questions.join('\n');bind(notice,()=>copy('questions',{questions}));return;}
    proposal={id,input:clone({draft:data.draft,expected_revision:0}),definition:clone(definition),fingerprint:data.preview_fingerprint,generation:start};const displayed=proposal.definition;bind(preview,()=>describe(displayed));message(storageReady?'review':'storage_required');
   }catch(error){if(active()&&generation===start){discard();feedback(error);}}finally{busy=false;if(active())lock();}
  });
  const sameRealm=value=>record(value)&&realm&&['tenant_id','dealer_id','actor_id'].every(key=>value[key]===realm[key]);
  const ownedRecord=r=>record(r)&&realm&&r.tenant_id===realm.tenant_id&&r.dealer_id===realm.dealer_id&&r.owner_id===realm.actor_id;
  function acknowledge(data,p){
   if(!sameRealm(data?.request_context)||data.draft_id!==p.id||data.expected_revision!==p.input.expected_revision||data.preview_fingerprint!==p.fingerprint||!ownedRecord(data.record))throw invalid();
   const r=data?.record;if(!record(data)||data.executable!==false||typeof data.deduplicated!=='boolean'||!record(r)||r.id!==p.id||r.revision!==p.input.expected_revision+1||r.request_revision!==p.input.expected_revision||r.executable!==false||r.status!=='DRAFT'||r.schema_version!==1||!hash(r.fingerprint)||!record(r.draft))throw invalid();
   let definition;try{definition=root.FoundlyWorkflowAuthoring.compile(r.draft,spec);}catch{throw invalid();}if(JSON.stringify(definition)!==JSON.stringify(p.definition))throw invalid();
  }
  save.addEventListener('click',async()=>{
   if(!active()||busy||save.disabled||!proposal||proposal.generation!==generation)return;
   if(!pendingSave){if(!reason.value.trim()){message('reason_required');return;}try{const rows=readPending(),entry=metadata(proposal);if(rows.length>=100||rows.some(row=>row.draft_id===entry.draft_id))throw invalid();storePending([...rows,entry]);}catch{storageReady=false;message('storage_required');lock();return;}pendingSave={proposal,action:clone({operation:'SAVE',draft_id:proposal.id,input:{...proposal.input,preview_fingerprint:proposal.fingerprint,confirm:true,reason:reason.value.trim()}}),turn:root.crypto.randomUUID()};}
   const pending=pendingSave,p=proposal;busy=true;lock();message('saving');
   try{
    const data=await zeroRequest(clone(pending.action),pending.turn);if(!active()||proposal!==p||generation!==p.generation)return;acknowledge(data,p);let forgotten=true;try{forget(p.id);}catch{forgotten=false;}discard();message(forgotten?'saved':'saved_metadata');await onSaved(data.record);
   }catch(error){if(active()&&proposal===p){const status=error.status||error.statusCode;if(status>=400&&status<500&&![408,429].includes(status)){if([401,403].includes(status))showRecovery(metadata(p));else try{forget(p.id);}catch{}discard();feedback(error,'conflict');}else{message('unconfirmed');bind(save,()=>copy('retry'));}}}
   finally{busy=false;if(active())lock();}
  });
  function showRecovery(entry){
   if(prior.some(row=>row.entry.draft_id===entry.draft_id))return;const row={entry,done:false,busy:false},host=el('section'),button=owned('button','recover'),notice=el('output'),description=owned('p','pending');button.type='button';button.setAttribute('data-workflow-action','recover');notice.setAttribute('aria-live','polite');host.append(description,button,notice);recovery.append(host);prior.push(row);
   button.addEventListener('click',async()=>{
    if(!active()||row.busy||row.done||typeof recoverRequest!=='function')return;row.busy=true;button.disabled=true;bind(notice,()=>copy('loading'));
    try{
     const data=await recoverRequest('/api/automation/drafts/'+encodeURIComponent(entry.draft_id)+'/recover',{method:'POST',body:JSON.stringify({expected_revision:entry.expected_revision,preview_fingerprint:entry.preview_fingerprint,confirm:true})});if(!active())return;
     if(!record(data)||!sameRealm(data.request_context)||data.draft_id!==entry.draft_id||data.preview_fingerprint!==entry.preview_fingerprint||data.expected_revision!==0||data.executable!==false||!['APPLIED','NOT_APPLIED'].includes(data.state))throw invalid();
     if(data.state==='NOT_APPLIED'){if(data.record!==null)throw invalid();}
     else{const r=data.record;if(!ownedRecord(r)||r.id!==entry.draft_id||r.revision!==1||r.request_revision!==0||r.executable!==false||r.status!=='DRAFT'||r.schema_version!==1||!hash(r.fingerprint)||!record(r.draft))throw invalid();try{root.FoundlyWorkflowAuthoring.compile(r.draft,spec);}catch{throw invalid();}}
     row.done=true;bindings.delete(description);description.textContent='';let forgotten=true;try{forget(entry.draft_id);}catch{forgotten=false;}bind(notice,()=>copy(forgotten?(data.state==='APPLIED'?'recovered':'not_applied'):'recovery_metadata'));if(data.state==='APPLIED')await onSaved(data.record);
    }catch(error){if(active()&&!row.done){
     if(['workflow_draft_request_superseded','workflow_draft_request_unavailable'].includes(error.code)){row.done=true;bindings.delete(description);description.textContent='';try{forget(entry.draft_id);}catch{}bind(notice,()=>copy('recovery_changed'));}
     else{const status=error.status||error.statusCode;bind(notice,()=>i18n&&[401,403].includes(status)?i18n.t(status===403?'common.access_denied':'identity.auth_required'):copy('unconfirmed'));}
    }}finally{if(active()){row.busy=false;button.disabled=row.done;lock();}}
   });
  }
  try{if(typeof recoverRequest!=='function')throw Error('draft_recovery_required');for(const entry of readPending())showRecovery(entry);}catch{storageReady=false;message('storage_required');}
  lock();return box;
 }
 root.FoundlyWorkflowGenerator={create};
})(globalThis);
