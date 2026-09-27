'use strict';
(function(root){
 function create({document,request,isActive=()=>true}){
  const i18n=root.FoundlyI18n,localErrors=new WeakMap();
  const copy=(key,fallback,params={})=>i18n?.message?i18n.message('finance.close.'+key,params):fallback;
  const write=(node,value)=>i18n?.renderText?i18n.renderText(node,value):(node.textContent=String(value??''),node);
  const el=(tag,text='')=>{const node=document.createElement(tag);if(i18n?.renderText)i18n.renderText(node,text);else node.textContent=String(text);return node;};
  const fail=(key,fallback)=>{const error=Error(String(copy(key,fallback)));localErrors.set(error,copy(key,fallback));return error;};
  // Formatting wrappers hold a snapshot of the source value and reformat only
  // presentation on locale changes. Customer names and record IDs stay literal.
  const number=value=>i18n?Object.freeze({toString:()=>i18n.number(value)}):value;
  const date=value=>i18n?Object.freeze({toString:()=>i18n.date(value,{dateStyle:'medium'})}):value;
  const box=el('section'),fields=el('div'),status=el('output'),reviewBox=el('div');status.setAttribute('role','status');
  const field=(label,tag='input')=>{const l=el('label',label),n=el(tag);l.append(n);fields.append(l);return n;};
  const select=field(copy('period','Fiscale periode'),'select'),reason=field(copy('reason','Reden voor afsluiting')),confirm=field(copy('confirm','Ik bevestig deze interne periodecontrole'));confirm.type='checkbox';
  const choose=()=>{const option=el('option',copy('choose','Kies expliciet een periode'));option.value='';return option;};select.append(choose());
  let review=null,busy=false,dirty=false,serial=0,cursor=0,next=null,pending=null;
  const active=()=>box.isConnected&&isActive();
  function showFailure(error){if(!active())return;write(status,localErrors.get(error)||(i18n?.errorKey?i18n.message(i18n.errorKey(error.code||error.data?.code,error.status)):error.message));}
  function invalidate(){serial++;review=null;confirm.checked=false;reviewBox.replaceChildren();dirty=Boolean(reason.value||select.value);}
  select.addEventListener('change',invalidate);reason.addEventListener('input',()=>{confirm.checked=false;dirty=true;});
  function button(label,fn){const b=el('button',label);b.type='button';b.addEventListener('click',async()=>{if(busy||!active())return;busy=true;fields.inert=true;try{await fn();}catch(error){showFailure(error);}finally{busy=false;fields.inert=Boolean(pending);}});box.append(b);return b;}
  async function list(atCursor){
   const at=++serial,data=await request('/api/finance/records/fiscal_periods?limit=100&cursor='+atCursor);if(!active()||at!==serial)return;
   cursor=atCursor;next=data.next_cursor;select.replaceChildren(choose());select.value='';
   for(const period of data.items){
    const state=period.status==='OPEN'?copy('open','OPEN'):period.status==='CLOSED'?copy('closed_status','CLOSED'):period.status;
    const option=el('option',copy('period_option',period.name+' · '+period.start_date+' — '+period.end_date+' · '+period.status,{name:period.name,start:date(period.start_date),end:date(period.end_date),status:state}));option.value=period.id;select.append(option);
   }
   const start=data.items.length?cursor+1:0,end=cursor+data.items.length;
   write(status,copy('page','Periodes '+start+'–'+end+' van '+data.total,{start:number(start),end:number(end),total:number(data.total)}));
  }
  box.append(el('h3',copy('title','Periode beoordelen en afsluiten')),el('p',copy('scope','Controleer de vastgelegde administratie. Deze interne afsluiting bewijst geen wettelijke juistheid of volledigheid bij externe aanbieders.')),fields,status,reviewBox);
  button(copy('next','Volgende periodes'),async()=>{if(pending||dirty)throw fail('clear_first','Wis eerst de huidige selectie.');if(next!==null)await list(next);});
  button(copy('clear','Selectie wissen'),async()=>{if(pending)throw fail('verify_first','Verifieer eerst het onzekere afsluitresultaat met dezelfde bevestiging.');reason.value='';select.value='';dirty=false;invalidate();await list(0);});
  button(copy('review','Periodecontrole bekijken'),async()=>{
   if(pending)throw fail('verify_first','Verifieer eerst het onzekere afsluitresultaat.');if(!select.value)throw fail('choose','Kies een periode.');
   const id=select.value,at=++serial;review=null;confirm.checked=false;const data=await request('/api/finance/periods/'+encodeURIComponent(id)+'/close-preview');if(!active()||at!==serial||id!==select.value)return;
   review=data;reviewBox.replaceChildren(el('p',data.ready?copy('ready','Interne controles afgerond; afzonderlijke bevestiging vereist.'):copy('blocked','Periode kan niet worden afgesloten.')),el('p',copy('totals','Debet: '+data.totals.debit_cents_exact+' cent '+data.currency+'; credit: '+data.totals.credit_cents_exact+' cent '+data.currency,{debit:data.totals.debit_cents_exact,credit:data.totals.credit_cents_exact,currency:data.currency})));
   const known=new Set(['INVALID_PERIOD','PERIOD_NOT_OPEN','OVERLAPPING_PERIODS','DUPLICATE_JOURNALS','DUPLICATE_LINES','DUPLICATE_ACCOUNTS','INVALID_JOURNAL','INVALID_ACCOUNT','INVALID_LINE','UNBALANCED_JOURNAL','DRAFT_INVOICES','UNRECONCILED_BANK_TRANSACTIONS']);
   for(const blocker of data.blockers){const label=known.has(blocker.code)?copy(blocker.code.toLowerCase(),blocker.code):blocker.code,records=blocker.record_ids.join(', ');reviewBox.append(el('p',copy('blocker',blocker.code+': '+records,{label,records})));}
   write(status,copy('refreshed','Actuele periodebron gecontroleerd.'));
  });
  button(copy('submit','Bevestigde periode afsluiten / resultaat verifiëren'),async()=>{
   if(!pending){if(!review?.ready||!reason.value.trim()||!confirm.checked)throw fail('confirm_reason','Bekijk de actuele controle en bevestig met een reden.');pending={id:select.value,payload:{expected_source_hash:review.source_hash,reason:reason.value,confirm:true,request_id:root.crypto.randomUUID()}};}
   const at=serial,current=pending;
   try{
    const data=await request('/api/finance/periods/'+encodeURIComponent(current.id)+'/close',{method:'POST',body:JSON.stringify(current.payload)});if(!active()||at!==serial)return;
    pending=null;review=null;dirty=false;confirm.checked=false;reason.value='';reviewBox.replaceChildren(el('p',copy('closed','Periode '+data.period.name+' is intern gesloten.',{name:data.period.name})),el('p',copy('receipt','Afsluitbewijs: '+data.closing.id,{id:data.closing.id})));
    write(status,data.deduplicated?copy('verified','Bestaand afsluitresultaat geverifieerd.'):copy('saved','Afsluiting vastgelegd. Er zijn geen financiële boekingen uitgevoerd.'));
   }catch(error){
    if(active()){if(error.status>=400&&error.status<500){pending=null;review=null;confirm.checked=false;}else{const message=copy('uncertain','Resultaat nog onzeker. Verifieer met dezelfde bevestigingsknop.');write(status,message);localErrors.set(error,message);}}
    throw error;
   }
  });
  box.canLeave=()=>{if(busy||dirty||pending){write(status,pending?copy('verify_first','Verifieer eerst het afsluitresultaat.'):copy('clear_input','Wis eerst de huidige periode-invoer.'));return false;}return true;};
  box.ready=list(0).catch(showFailure);return box;
 }
 root.FoundlyFinancePeriodClosing={create};
})(globalThis);
