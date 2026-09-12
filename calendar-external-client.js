'use strict';
(function(root){
 function create({document,request,calendars,isActive=()=>true}){
  const el=(tag,text='')=>{const n=document.createElement(tag);n.textContent=text;return n;};
  const box=el('section'),out=el('output');out.setAttribute('role','status');box.append(el('h3','Externe agendadekking'),el('p','Lees Google Calendar voor een gekozen tijdvenster. Alleen bezette tijden worden bewaard. Er worden geen externe afspraken gewijzigd of uitnodigingen verstuurd.'));
  function field(label,type='text'){const l=el('label',label),n=el('input');n.type=type;l.append(n);box.append(l);return n;}
  const label=el('label','Native agenda'),calendar=el('select');label.append(calendar);box.append(label);
  for(const row of [{id:'',name:'Kies een agenda'},...calendars]){const o=el('option',row.name);o.value=row.id;calendar.append(o);}calendar.value='';
  const provider=field('Google-agenda-ID'),from=field('Venster begin met UTC-offset'),to=field('Venster einde met UTC-offset'),reason=field('Reden voor verversen'),confirm=field('Ik bevestig deze agenda en dit leesvenster','checkbox');provider.value='primary';
  let revision=null,busy=false,serial=0;const active=()=>box.isConnected&&isActive();
  for(const node of [calendar,provider,from,to,reason])node.addEventListener('input',()=>{serial++;confirm.checked=false;if(node===calendar)revision=null;});
  function button(text,fn){const b=el('button',text);b.type='button';b.addEventListener('click',async()=>{if(busy||!active())return;busy=true;box.inert=true;try{await fn();}catch(e){if(active())out.textContent=e.message;}finally{busy=false;box.inert=false;}});box.append(b);}
  const selected=()=>{const cal=calendars.find(row=>row.id===calendar.value);if(!cal)throw Error('Kies een actuele native agenda.');return cal;};
  const show=data=>{out.textContent=data.coverage==='RETAINED_COMPLETE_WINDOW'?'Bewaarde externe dekking: '+data.from+' – '+data.to+'; '+data.busy_count+' bezette perioden. Waargenomen: '+data.observed_at+'.':'Externe dekking: '+data.coverage+'. Buiten een actueel volledig leesvenster is beschikbaarheid niet vastgesteld.';};
  button('Externe dekking bekijken',async()=>{const cal=selected(),at=serial,data=await request('/api/calendar/external-calendar?calendar_id='+encodeURIComponent(cal.id));if(!active()||at!==serial||calendar.value!==cal.id)return;revision=data.revision;confirm.checked=false;show(data);});
  button('Gekozen externe leesvenster verversen',async()=>{const cal=selected();if(revision===null)throw Error('Bekijk eerst de actuele externe dekking.');if(!confirm.checked||!reason.value.trim())throw Error('Bevestig dit exacte leesvenster met een reden.');const at=serial,input={calendar_id:cal.id,expected_calendar_revision:cal.revision,expected_revision:revision,provider_calendar_id:provider.value,from:from.value,to:to.value,reason:reason.value.trim(),confirm:true};const data=await request('/api/calendar/external-calendar/reconcile',{method:'POST',body:JSON.stringify(input)});if(!active()||at!==serial)return;revision=data.revision;confirm.checked=false;show(data);});
  box.append(out);return box;
 }
 root.FoundlyCalendarExternal={create};
})(globalThis);
