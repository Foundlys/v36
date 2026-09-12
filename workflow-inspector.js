'use strict';
(function(root){
 function create({document,run,request,isActive=()=>true}){
  const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;},box=el('section'),inspect=el('button','Run en voorwaarden verklaren'),output=el('div'),notice=el('output');inspect.type='button';notice.setAttribute('aria-live','polite');box.append(inspect,notice,output);let generation=0;
  const active=()=>box.isConnected&&isActive();
  const scalar=d=>!d.present?'ontbreekt':d.value_omitted?d.type+' (inhoud weggelaten)':JSON.stringify(d.value)+(d.truncated?'… (ingekort)':'');
  function trace(node,host){
   const item=el('li');item.textContent=node.kind==='unconditional'?'Geen voorwaarde: waar':node.kind==='comparison'?node.field+' · '+node.operator+' · waarde '+scalar(node.actual)+(node.expected?' · verwacht '+(Array.isArray(node.expected)?node.expected.map(scalar).join(', '):scalar(node.expected)):'')+' → '+(node.matched?'waar':'onwaar'):({all:'EN',any:'OF',not:'NIET'}[node.kind])+' → '+(node.matched?'waar':'onwaar');host.append(item);
   if(node.children){const children=el('ul');item.append(children);node.children.forEach(n=>trace(n,children));}
  }
  async function load(step){const seq=++generation;inspect.disabled=true;notice.textContent='Bewaarde run controleren…';output.replaceChildren();
   try{const data=await request('/api/automation/runs/'+encodeURIComponent(run.run_id)+'/inspection'+(step===undefined?'':'?step='+step));if(!active()||seq!==generation)return;
    if(data.run_id!==run.run_id||data.read_only!==true||data.execution_performed!==false||data.outcome_reverified!==false||!Array.isArray(data.steps)||!data.selected)throw Error('Er is geen gecontroleerde runuitlezing beschikbaar.');
    output.append(el('h4',data.workflow_name+' · versie '+data.workflow_version),el('p','Bewaarde runstatus: '+data.status+'. De conditieverklaring gebruikt de bewaarde invoer. Acties zijn niet uitgevoerd of opnieuw geverifieerd.'));
    const label=el('label','Stap voor verklaring'),select=el('select');for(const s of data.steps){const option=el('option',(s.index+1)+'. '+s.type+' · '+s.status);option.value=String(s.index);select.append(option);}select.value=String(data.selected.index);label.append(select);output.append(label);select.addEventListener('change',()=>load(select.value));
    const s=data.selected;output.append(el('p','Status: '+s.status+' · pogingen: '+s.attempts+' · uitvoerregistratie: '+s.recorded_output));if(s.error)output.append(el('p','Geregistreerde fout: '+s.error));if(s.next_wakeup_at)output.append(el('p','Bewaard hervattijdstip: '+s.next_wakeup_at));
    const list=el('ul');output.append(list);trace(s.condition,list);notice.textContent='Uitlezing gereed.';
   }catch(e){if(active()&&seq===generation){output.replaceChildren();notice.textContent=e.message;}}finally{if(seq===generation)inspect.disabled=false;}
  }
  inspect.addEventListener('click',()=>{if(!inspect.disabled)return load();});return box;
 }
 root.FoundlyWorkflowInspector={create};
})(globalThis);
