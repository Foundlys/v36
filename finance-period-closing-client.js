'use strict';
(function(root){
 function create({document,request,isActive=()=>true}){
  const el=(tag,text='')=>{const n=document.createElement(tag);n.textContent=text;return n;},box=el('section'),fields=el('div'),status=el('output'),reviewBox=el('div');status.setAttribute('role','status');
  const field=(label,tag='input')=>{const l=el('label',label),n=el(tag);l.append(n);fields.append(l);return n;};
  const select=field('Fiscale periode','select'),reason=field('Reden voor afsluiting'),confirm=field('Ik bevestig deze interne periodecontrole');confirm.type='checkbox';select.append(el('option','Kies expliciet een periode'));select.children[0].value='';
  let review=null,busy=false,dirty=false,serial=0,cursor=0,next=null,pending=null;
  const active=()=>box.isConnected&&isActive();
  function invalidate(){serial++;review=null;confirm.checked=false;reviewBox.replaceChildren();dirty=Boolean(reason.value||select.value);}
  select.addEventListener('change',invalidate);reason.addEventListener('input',()=>{confirm.checked=false;dirty=true;});
  function button(label,fn){const b=el('button',label);b.type='button';b.addEventListener('click',async()=>{if(busy||!active())return;busy=true;fields.inert=true;try{await fn();}catch(e){if(active())status.textContent=e.message;}finally{busy=false;fields.inert=Boolean(pending);}});box.append(b);return b;}
  async function list(atCursor){const at=++serial,data=await request('/api/finance/records/fiscal_periods?limit=100&cursor='+atCursor);if(!active()||at!==serial)return;cursor=atCursor;next=data.next_cursor;select.replaceChildren(el('option','Kies expliciet een periode'));select.children[0].value='';select.value='';for(const p of data.items){const option=el('option',p.name+' · '+p.start_date+' — '+p.end_date+' · '+p.status);option.value=p.id;select.append(option);}status.textContent='Periodes '+(data.items.length?cursor+1:0)+'–'+(cursor+data.items.length)+' van '+data.total;}
  box.append(el('h3','Periode beoordelen en afsluiten'),el('p','Controleer de vastgelegde administratie. Deze interne afsluiting bewijst geen wettelijke juistheid of volledigheid bij externe aanbieders.'),fields,status,reviewBox);
  button('Volgende periodes',async()=>{if(pending||dirty)throw Error('Wis eerst de huidige selectie.');if(next!==null)await list(next);});
  button('Selectie wissen',async()=>{if(pending)throw Error('Verifieer eerst het onzekere afsluitresultaat met dezelfde bevestiging.');reason.value='';select.value='';dirty=false;invalidate();await list(0);});
  button('Periodecontrole bekijken',async()=>{if(pending)throw Error('Verifieer eerst het onzekere afsluitresultaat.');if(!select.value)throw Error('Kies een periode.');const id=select.value,at=++serial;review=null;confirm.checked=false;const data=await request('/api/finance/periods/'+encodeURIComponent(id)+'/close-preview');if(!active()||at!==serial||id!==select.value)return;review=data;reviewBox.replaceChildren(el('p',data.ready?'Interne controles afgerond; afzonderlijke bevestiging vereist.':'Periode kan niet worden afgesloten.'),el('p','Debet: '+data.totals.debit_cents_exact+' cent '+data.currency+'; credit: '+data.totals.credit_cents_exact+' cent '+data.currency));for(const b of data.blockers)reviewBox.append(el('p',b.code+': '+b.record_ids.join(', ')));status.textContent='Actuele periodebron gecontroleerd.';});
  button('Bevestigde periode afsluiten / resultaat verifiëren',async()=>{
   if(!pending){if(!review?.ready||!reason.value.trim()||!confirm.checked)throw Error('Bekijk de actuele controle en bevestig met een reden.');pending={id:select.value,payload:{expected_source_hash:review.source_hash,reason:reason.value,confirm:true,request_id:root.crypto.randomUUID()}};}
   const at=serial,current=pending;
   try{const data=await request('/api/finance/periods/'+encodeURIComponent(current.id)+'/close',{method:'POST',body:JSON.stringify(current.payload)});if(!active()||at!==serial)return;pending=null;review=null;dirty=false;confirm.checked=false;reason.value='';reviewBox.replaceChildren(el('p','Periode '+data.period.name+' is intern gesloten.'),el('p','Afsluitbewijs: '+data.closing.id));status.textContent=data.deduplicated?'Bestaand afsluitresultaat geverifieerd.':'Afsluiting vastgelegd. Er zijn geen financiële boekingen uitgevoerd.';}
   catch(e){if(active()){if(e.status>=400&&e.status<500){pending=null;review=null;confirm.checked=false;}else status.textContent='Resultaat nog onzeker. Verifieer met dezelfde bevestigingsknop.';}throw e;}
  });
  box.canLeave=()=>{if(busy||dirty||pending){status.textContent=pending?'Verifieer eerst het afsluitresultaat.':'Wis eerst de huidige periode-invoer.';return false;}return true;};
  box.ready=list(0).catch(e=>{if(active())status.textContent=e.message;});return box;
 }
 root.FoundlyFinancePeriodClosing={create};
})(globalThis);
