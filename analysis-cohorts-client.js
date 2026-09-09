'use strict';
(function(root){
  function mount(document,request){
    const form=document.getElementById('cohortForm'),output=document.getElementById('cohortOutput'),notice=document.getElementById('cohortNotice'),button=form.querySelector('button');let enabled=false,writable=false,generation=0,definitionsGeneration=0,definitionsOffset=0,selectedDefinition=null,saveAttempt=null;
    const definitionsForm=document.getElementById('cohortDefinitionsForm'),savedSelect=document.getElementById('cohortSavedDefinition'),savedNotice=document.getElementById('cohortDefinitionsNotice'),saveForm=document.getElementById('cohortSaveDefinitionForm'),previous=document.getElementById('cohortDefinitionsPrevious'),next=document.getElementById('cohortDefinitionsNext');
    const make=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=String(text);return el;};
    const clear=()=>{generation++;selectedDefinition=null;output.replaceChildren();notice.textContent='Kies je instroom, terugkeer en periode en bereken opnieuw.';};form.addEventListener('input',clear);
    form.addEventListener('submit',async event=>{
      event.preventDefault();if(!enabled)return;const token=++generation;button.disabled=true;output.replaceChildren();notice.textContent='Cohorten berekenen…';
      try{
        const query=new URLSearchParams(new FormData(form));for(const field of ['from','to'])query.set(field,query.get(field)+'Z');
        const route=selectedDefinition?'/api/analysis/cohort_definitions/'+encodeURIComponent(selectedDefinition.id)+'/query?'+new URLSearchParams({expected_revision:selectedDefinition.revision}):'/api/analysis/cohorts?'+query;
        const data=await request(route);if(token!==generation||!enabled)return;
        notice.textContent=data.available?`${data.sample_size} waargenomen leden · brondekking is niet geschat · ${data.data_quality.excluded_visible_records} onbruikbare toegankelijke events`:'Geen toegankelijke instroom gevonden voor deze definitie.';
        if(!data.available)return;
        const table=make('table'),caption=make('caption','Terugkeer per instroomcohort. Een onvolledig venster heeft nog geen definitief percentage.'),head=make('thead'),heading=make('tr'),body=make('tbody');
        for(const text of ['Instroom vanaf (UTC)','Leden',...data.items[0].cells.map(cell=>`Periode ${cell.age}`)]){const th=make('th',text);th.scope='col';heading.append(th);}head.append(heading);
        for(const row of data.items){const tr=make('tr'),label=make('th',row.from.slice(0,10));label.scope='row';tr.append(label,make('td',row.members));for(const cell of row.cells){const td=make('td',cell.retention_percent===null?'Onvolledig':new Intl.NumberFormat('nl-NL',{maximumFractionDigits:1}).format(cell.retention_percent)+'%');td.title=`${cell.observed_returning_members} waargenomen terugkerende leden · ${cell.from} tot ${cell.to}`;tr.append(td);}body.append(tr);}
        table.append(caption,head,body);output.append(table,make('p',`Bronnen: ${data.sources.join(', ')}. Laatst ontvangen: ${data.freshness||'onbekend'}. Batchberekening op bewaarde, toegankelijke events.`));
        const details=make('details'),summary=make('summary',`Bronverwijzingen (${data.supporting_records.length} van ${data.supporting_record_count})`),list=make('ul');details.append(summary,list);for(const row of data.supporting_records){const item=make('li',`${row.event_id} · ${row.event_name} · ${row.source} · ${row.occurred_at}${row.provider_verified?' · provider bevestigd':' · geen providerbevestiging'}`);list.append(item);}output.append(details);
      }catch(error){if(token===generation){output.replaceChildren();notice.textContent='Cohortanalyse niet beschikbaar: '+error.message;}}
      finally{button.disabled=!enabled;}
    });
    async function loadDefinitions(offset=0){
      const token=++definitionsGeneration;savedSelect.replaceChildren();previous.disabled=next.disabled=true;
      if(!enabled)return;
      savedNotice.textContent='Opgeslagen definities laden…';
      try{const data=await request('/api/analysis/cohort_definitions?'+new URLSearchParams({offset,limit:100}));if(token!==definitionsGeneration||!enabled)return;definitionsOffset=offset;for(const row of data.items){const option=make('option',row.title+' · revisie '+row.revision);option.value=row.id;savedSelect.append(option);}previous.disabled=offset===0;next.disabled=data.next_offset===null;savedNotice.textContent=data.total?`${offset+1}–${offset+data.items.length} van ${data.total} toegankelijke definities. Laden berekent nog geen resultaat.`:'Geen opgeslagen definities.';}
      catch(error){if(token===definitionsGeneration)savedNotice.textContent='Definities niet beschikbaar: '+error.message;}
    }
    definitionsForm.addEventListener('submit',async event=>{
      event.preventDefault();if(!enabled||!savedSelect.value)return;const token=++generation;output.replaceChildren();selectedDefinition=null;
      try{const data=await request('/api/analysis/cohort_definitions/'+encodeURIComponent(savedSelect.value));if(token!==generation||!enabled)return;const row=data.record;if(row.status==='ARCHIVED')throw Error('Deze definitie is gearchiveerd.');for(const [key,value] of Object.entries(row.cohort_definition)){const field=form.elements.namedItem(key);if(field)field.value=['from','to'].includes(key)?value.slice(0,-1):value;}selectedDefinition={id:row.id,revision:row.revision};notice.textContent=`${row.title} · revisie ${row.revision} geladen. Kies Berekenen of vraag ZERO naar deze cohort voor actuele toegankelijke brondata.`;}
      catch(error){if(token===generation)notice.textContent='Definitie niet geladen: '+error.message;}
    });
    saveForm.addEventListener('submit',async event=>{
      event.preventDefault();if(!enabled||!writable||!form.reportValidity())return;
      const query=Object.fromEntries(new FormData(form));for(const key of ['from','to'])query[key]+='Z';
      const payload=JSON.stringify({title:new FormData(saveForm).get('title'),cohort_definition:query}),token=generation,saveButton=saveForm.querySelector('button');
      if(!saveAttempt||saveAttempt.payload!==payload)saveAttempt={payload,key:globalThis.crypto.randomUUID()};saveButton.disabled=true;
      try{const data=await request('/api/analysis/cohort_definitions',{method:'POST',headers:{'idempotency-key':saveAttempt.key},body:payload});if(token!==generation||!enabled)return;saveAttempt=null;notice.textContent=`${data.record.title} opgeslagen. Er is geen resultaat of workflow uitgevoerd.`;await loadDefinitions();}
      catch(error){if(token===generation)notice.textContent='Definitie niet opgeslagen: '+error.message;}
      finally{saveButton.disabled=!enabled||!writable;}
    });
    previous.addEventListener('click',()=>loadDefinitions(Math.max(0,definitionsOffset-100)));next.addEventListener('click',()=>loadDefinitions(definitionsOffset+100));document.getElementById('cohortDefinitionsRefresh').addEventListener('click',()=>loadDefinitions());
    return {selectedDefinition(){return enabled&&selectedDefinition?{...selectedDefinition}:null;},setEnabled(value,canWrite=false){enabled=Boolean(value);writable=Boolean(canWrite);form.querySelector('fieldset').disabled=!enabled;definitionsForm.querySelector('fieldset').disabled=!enabled;saveForm.querySelector('fieldset').disabled=!enabled||!writable;saveForm.querySelector('button').disabled=!enabled||!writable;button.disabled=!enabled;if(!enabled){generation++;definitionsGeneration++;selectedDefinition=null;savedSelect.replaceChildren();output.replaceChildren();savedNotice.textContent='Opgeslagen definities zijn niet beschikbaar.';notice.textContent='Cohorten vereisen toegang tot Analytics-rapporten en events.';}else loadDefinitions();}};
  }
  root.FoundlyCohortUI={mount};
})(globalThis);
