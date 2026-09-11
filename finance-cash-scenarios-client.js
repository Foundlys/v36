'use strict';
(function(root){
 function create({document,request,forecastId,isActive=()=>true}){
  const el=(tag,text='')=>{const n=document.createElement(tag);n.textContent=text;return n;},box=el('section'),out=el('output'),form=el('div'),result=el('div');out.setAttribute('role','status');box.append(el('h3','Kasplanning: scenario vergelijken'),el('p','Vergelijk expliciete aannames met één actuele kasplanning. Dit wijzigt geen brongegevens en voert geen financiële actie uit.'),form,out,result);
  const field=(label,value)=>{const l=el('label',label),n=el('input');n.value=String(value);l.append(n);form.append(l);return n;};
  let source=null,busy=false,dirty=false,serial=0;const active=()=>box.isConnected&&isActive();
  function button(host,title,fn){const b=el('button',title);b.type='button';b.addEventListener('click',async()=>{if(busy||!active())return;busy=true;box.inert=true;try{await fn();}catch(e){if(active()){result.replaceChildren();out.textContent=e.message;}}finally{busy=false;box.inert=false;}});host.append(b);return b;}
  const money=(value,currency)=>new Intl.NumberFormat('nl-NL',{style:'currency',currency}).format(value/100);
  form.addEventListener('input',()=>{serial++;dirty=true;result.replaceChildren();});
  async function load(){const at=++serial,data=await request('/api/finance/forecast-scenarios',{method:'POST',body:JSON.stringify({forecast_id:forecastId})});if(!active()||at!==serial)return;source=data;form.replaceChildren();result.replaceChildren();const opening=field('Scenario beginsaldo in centen',data.baseline.opening_cash_cents),horizon=field('Scenario horizon in hele dagen',data.baseline.horizon_days);opening.type=horizon.type='number';
   const rows=[...data.baseline.entries,...data.baseline.excluded_entries].sort((a,b)=>a.entry_index-b.entry_index);if(rows.length>200){out.textContent='Deze bron heeft meer dan 200 regels. De volledige vergelijking is beschikbaar via de scenario-API; de editor toont geen gedeeltelijk plan.';return;}
   const editors=rows.map(row=>({row,date:field('Datum bronregel '+(row.entry_index+1),row.date),amount:field('Bedrag bronregel '+(row.entry_index+1)+' in centen',row.amount_cents)}));
   out.textContent='Actuele bron geladen. Bedragen buiten het venster tellen niet mee.';
   button(form,'Scenario berekenen',async()=>{const at=serial,number=input=>input.value.trim()?Number(input.value):NaN,changes={opening_cash_cents:number(opening),horizon_days:number(horizon),entries:editors.filter(e=>e.date.value!==e.row.date||number(e.amount)!==e.row.amount_cents).map(e=>({entry_index:e.row.entry_index,date:e.date.value,amount_cents:number(e.amount)}))};
    if(!Number.isSafeInteger(changes.opening_cash_cents)||!Number.isSafeInteger(changes.horizon_days)||changes.entries.some(e=>!Number.isSafeInteger(e.amount_cents)))throw Error('Gebruik volledige gehele bedragen in centen en een hele horizon.');
    const data=await request('/api/finance/forecast-scenarios',{method:'POST',body:JSON.stringify({forecast_id:forecastId,expected_source_hash:source.source_hash,changes})});if(!active()||at!==serial)return;
    result.replaceChildren(el('p','Basis eindsaldo: '+money(data.baseline.closing_cash_cents,data.currency)),el('p','Scenario eindsaldo: '+money(data.scenario.closing_cash_cents,data.currency)),el('p','Verschil: '+money(data.delta_closing_cents,data.currency)),el('p','Laagste berekende saldo: '+money(data.scenario.lowest_cash_cents,data.currency)),el('p','Niet meegetelde regels buiten het venster: '+data.scenario.excluded_entry_count),el('p',data.recommendation));const observed=data.recorded_outcome;if(observed?.available)result.append(el('p','Vastgelegde kasbeweging: '+money(observed.recorded_net_cents,data.currency)+'; planning tot hetzelfde moment: '+money(observed.planned_net_cents,data.currency)+'; afwijking: '+money(observed.variance_cents,data.currency)),el('p',observed.recommendation),el('p','Bronboekingen: '+observed.source_entry_ids.join(', ')),el('p','Alleen vastgelegde administratie; volledigheid, provideruitkomst en causaliteit zijn niet bewezen.'));else result.append(el('p',observed?.reason||'Geen bewezen kasuitkomst beschikbaar'));out.textContent='Hypothetische vergelijking; brongegevens en financiële administratie zijn ongewijzigd.';
   });
  }
  button(box,'Scenario-invoer wissen',async()=>{dirty=false;await load();});
  box.canLeave=()=>{if(busy||dirty){out.textContent='Wis eerst de scenario-invoer voordat je een andere selectie laadt.';return false;}return true;};
  box.ready=load().catch(e=>{if(active())out.textContent=e.message;});return box;
 }
 root.FoundlyFinanceCashScenarios={create};
})(globalThis);
