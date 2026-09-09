'use strict';
(function(root){
  function mount(document,request){
    const form=document.getElementById('cohortForm'),output=document.getElementById('cohortOutput'),notice=document.getElementById('cohortNotice'),button=form.querySelector('button');let enabled=false,generation=0;
    const make=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=String(text);return el;};
    const clear=()=>{generation++;output.replaceChildren();notice.textContent='Kies je instroom, terugkeer en periode en bereken opnieuw.';};form.addEventListener('input',clear);
    form.addEventListener('submit',async event=>{
      event.preventDefault();if(!enabled)return;const token=++generation;button.disabled=true;output.replaceChildren();notice.textContent='Cohorten berekenen…';
      try{
        const query=new URLSearchParams(new FormData(form));for(const field of ['from','to'])query.set(field,query.get(field)+'T00:00:00.000Z');
        const data=await request('/api/analysis/cohorts?'+query);if(token!==generation||!enabled)return;
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
    return {setEnabled(value){enabled=Boolean(value);form.querySelector('fieldset').disabled=!enabled;button.disabled=!enabled;if(!enabled){generation++;output.replaceChildren();notice.textContent='Cohorten vereisen toegang tot Analytics-rapporten en events.';}}};
  }
  root.FoundlyCohortUI={mount};
})(globalThis);
