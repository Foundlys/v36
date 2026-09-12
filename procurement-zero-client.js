'use strict';
(function(root){
 function create({document,request,build,isActive=()=>true,initialMode='native'}){
  const host=document.createElement('section'),label=document.createElement('label'),select=document.createElement('select');label.textContent='Bediening';
  for(const [value,title]of [['native','Native Procurement'],['zero','ZERO']]){const option=document.createElement('option');option.value=value;option.textContent=title;select.append(option);}select.value=initialMode==='zero'?'zero':'native';label.append(select);host.append(label);
  let mode=select.value,view;const conversation=root.crypto.randomUUID(),active=()=>host.isConnected&&isActive();
  const wrapped=async(path,options={})=>{
   if(mode!=='zero')return request(path,options);
   const url=new URL(path,'https://foundly.invalid'),parts=url.pathname.split('/').filter(Boolean),input=options.body?JSON.parse(options.body):{};let action;
   if(parts[0]==='api'&&parts[1]==='procurement'){
    if(parts[2]==='rfqs'&&parts.length===5){const operations={'economics-preview':'ECONOMICS','economics-snapshots':'SNAPSHOT','allocation-preview':'ALLOCATION','incremental-allocation-preview':'ALLOCATION','awards':'PREPARE'},operation=operations[parts[4]];if(operation)action={operation,input:{rfq_id:parts[3],...input,...(operation==='ALLOCATION'?{allocation_mode:parts[4].startsWith('incremental')?'INCREMENTAL':'FULL'}:{})}};}
    if(parts[2]==='rfqs'&&parts.length===5&&parts[4]==='clarifications')action={operation:'CLARIFICATIONS',input:{rfq_id:parts[3],...Object.fromEntries([...url.searchParams].map(([k,v])=>[k,Number(v)]))}};
    if(parts[2]==='clarifications'){if(parts.length===3)action={operation:'CLARIFY',input};else if(parts.length===4&&parts[3]==='collaborators')action={operation:'MEMBERS',input:Object.fromEntries(url.searchParams)};else if(parts.length===4)action={operation:'CLARIFICATION',input:{clarification_id:parts[3]}};else if(parts.length===5&&['entries','collaborators'].includes(parts[4]))action={operation:parts[4]==='entries'?'REPLY':'SHARE',input:{clarification_id:parts[3],...input}};}
    if(parts[2]==='suppliers'&&parts.length===5&&parts[4]==='outcomes')action={operation:'OUTCOMES',input:{supplier_id:parts[3]}};
    if(parts[2]==='outcome-observations'&&parts.length===3)action={operation:'OBSERVE',input};
   }
   if(!action)return request(path,options);if(!active())throw Error('Deze Procurement-weergave is niet meer actief.');
   const data=await request('/api/zero/turn',{method:'POST',body:JSON.stringify({message:'Gekozen Procurement-actie',conversation_id:conversation,turn_id:options.headers?.['idempotency-key']||root.crypto.randomUUID(),preferred_module:'procurement',client_context:{procurement_action:action}})});if(!active())throw Error('Deze Procurement-weergave is niet meer actief.');if(!data.procurement_data)throw Error('Het actuele Procurement-resultaat ontbreekt.');return data.procurement_data;
  };
  view=build(wrapped);host.append(view);select.addEventListener('change',()=>{if(view.canLeave&&!view.canLeave()){select.value=mode;return;}mode=select.value;});host.canLeave=()=>view.canLeave?view.canLeave():true;host.ready=view.ready;return host;
 }
 root.FoundlyProcurementTransport={create};
})(globalThis);
