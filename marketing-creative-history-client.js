'use strict';
(function(root){
 function create({document,request,id,canWrite=()=>true,isActive=()=>true}){
  const el=(tag,text='')=>{const n=document.createElement(tag);n.textContent=text;return n;},box=el('section'),content=el('div'),form=el('div'),status=el('output');status.setAttribute('role','status');box.append(content,form,status);
  let writable=false,sourceId=id,current=null,restoreId=null,dirty=false,busy=false,generation=0,pending=null;
  const active=()=>box.isConnected&&isActive(),route=()=>'/api/marketing/creatives/'+encodeURIComponent(sourceId);
  const field=(name,tag='input')=>{const l=el('label',name),n=el(tag);l.append(n);form.append(l);return n;};
  const title=field('Titel'),text=field('Creatieve inhoud','textarea'),description=field('Beschrijving','textarea'),reason=field('Reden voor deze revisie'),confirm=field('Ik bevestig deze creatieve revisie');confirm.type='checkbox';
  for(const n of [title,text,description,reason])n.addEventListener('input',()=>{dirty=true;confirm.checked=false;});
  function button(host,label,fn){const b=el('button',label);b.type='button';b.addEventListener('click',async()=>{if(busy||!active())return;busy=true;form.inert=true;try{await fn();}catch(e){if(active())status.textContent=e.message;}finally{busy=false;form.inert=Boolean(pending)||(!writable||!canWrite());}});host.append(b);return b;}
  function edit(snapshot,restore=null){title.value=snapshot.title||'';text.value=snapshot.content||'';description.value=snapshot.description||'';restoreId=restore;for(const n of [title,text,description])n.readOnly=Boolean(restore);confirm.checked=false;reason.value='';}
  async function load(offset=0){const at=++generation;try{const [data,history]=await Promise.all([request(route()),request(route()+'/revisions?offset='+offset+'&limit=25')]);if(!active()||at!==generation)return;current=data.record;writable=history.can_write===true;form.inert=!writable||!canWrite();content.replaceChildren(el('h3',current.title+' · revisie '+current.revision),el('p',current.status==='APPROVED_INTERNAL'?'Wijzigen of herstellen maakt een apart nieuw concept. De goedgekeurde creatie blijft ongewijzigd.':'Herstellen maakt een nieuwe conceptrevisie. Goedkeuring of publicatie wordt niet overgenomen.'),el('p','Bewaarde revisies: '+history.total+' · '+history.coverage));edit(current);dirty=false;
    for(const row of history.items){const article=el('article');article.append(el('h4','Revisie '+row.creative_revision+' · '+row.snapshot.status),el('pre',JSON.stringify(row.snapshot,null,2)));button(article,'Deze revisie voorbereiden',async()=>{if(pending||dirty)throw Error('Wis of verifieer eerst de huidige invoer.');if((!writable||!canWrite()))throw Error('Wijzigen is niet toegestaan.');edit(row.snapshot,row.id);dirty=true;status.textContent='Bewaarde inhoud geselecteerd. Bevestig afzonderlijk met een reden.';});content.append(article);}
    if(history.next_offset!==null)button(content,'Volgende revisies',async()=>{if(pending||dirty)throw Error('Wis of verifieer eerst de huidige invoer.');await load(history.next_offset);});status.textContent='Actuele bron en bewaarde geschiedenis geladen.';
   }catch(e){if(active()&&at===generation){content.replaceChildren();edit({});form.inert=true;current=null;status.textContent=e.message;}throw e;}}
  button(box,'Invoer wissen en actuele bron laden',async()=>{if(pending)throw Error('Verifieer eerst het onzekere resultaat met dezelfde bevestiging.');dirty=false;await load();});
  button(box,'Bevestigde revisie opslaan / resultaat verifiëren',async()=>{
   if((!writable||!canWrite()))throw Error('Wijzigen is niet toegestaan.');
   if(!pending){if(!current||!confirm.checked||!reason.value.trim())throw Error('Bevestig de actuele revisie met een reden.');pending={route:route()+(restoreId?'/revisions/'+encodeURIComponent(restoreId)+'/restore':'/version'),key:root.crypto.randomUUID(),input:{expected_revision:current.revision,confirm:true,reason:reason.value,...(restoreId?{}:{fields:{title:title.value,content:text.value,description:description.value}})}};}
   const at=generation,action=pending;
   try{const data=await request(action.route,{method:'POST',headers:{'idempotency-key':action.key},body:JSON.stringify(action.input)});if(!active()||at!==generation)return;pending=null;dirty=false;sourceId=data.record.id;await load();status.textContent=data.forked?'Nieuw concept vastgelegd; het goedgekeurde origineel is behouden.':'Nieuwe conceptrevisie geverifieerd. Er is niets gepubliceerd.';}
   catch(e){if(active()&&e.status>=400&&e.status<500){pending=null;confirm.checked=false;}throw e;}
  });
  box.canLeave=()=>{if(busy||dirty||pending){status.textContent=pending?'Verifieer eerst het onzekere resultaat.':'Wis eerst de huidige revisie-invoer.';return false;}return true;};box.ready=load().catch(()=>{});return box;
 }
 root.FoundlyMarketingCreativeHistory={create};
})(globalThis);
