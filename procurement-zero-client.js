'use strict';
(function(root){
 function create({document,request,build,isActive=()=>true,initialMode='native'}){
  const i=root.FoundlyI18n,host=document.createElement('section'),label=document.createElement('label'),caption=document.createElement('span'),select=document.createElement('select'),bindings=new Map(),bind=(node,key)=>{node.textContent=i.t('procurement.clarifications.'+key);bindings.set(node,{key,last:node.textContent});return node;};bind(caption,'transport');label.append(caption);
  for(const value of ['native','zero']){const option=document.createElement('option');option.value=value;if(value==='native')bind(option,'transport_native');else option.textContent='ZERO';select.append(option);}select.value=initialMode==='zero'?'zero':'native';label.append(select);host.append(label);
  let mode=select.value,view;const conversation=root.crypto.randomUUID(),active=()=>host.isConnected&&isActive();
  document.addEventListener('foundly:locale',()=>{if(!active())return;for(const [node,b]of bindings)if(node.isConnected&&node.textContent===b.last)node.textContent=b.last=i.t('procurement.clarifications.'+b.key);});
  const wrapped=async(path,options={},isCurrent=()=>true)=>{
   if(mode!=='zero')return request(path,options,isCurrent);
   const url=new URL(path,'https://foundly.invalid'),parts=url.pathname.split('/').filter(Boolean),input=options.body?JSON.parse(options.body):{};let action;
   if(parts[0]==='api'&&parts[1]==='procurement'){
    if(parts[2]==='rfqs'&&parts.length===5){const operations={'economics-preview':'ECONOMICS','economics-snapshots':'SNAPSHOT','allocation-preview':'ALLOCATION','incremental-allocation-preview':'ALLOCATION','awards':'PREPARE'},operation=operations[parts[4]];if(operation)action={operation,input:{rfq_id:parts[3],...input,...(operation==='ALLOCATION'?{allocation_mode:parts[4].startsWith('incremental')?'INCREMENTAL':'FULL'}:{})}};}
    if(parts[2]==='rfqs'&&parts.length===5&&parts[4]==='clarifications')action={operation:'CLARIFICATIONS',input:{rfq_id:parts[3],...Object.fromEntries([...url.searchParams].map(([k,v])=>[k,Number(v)]))}};
    if(parts[2]==='clarifications'){if(parts.length===3)action={operation:'CLARIFY',input};else if(parts.length===4&&parts[3]==='collaborators')action={operation:'MEMBERS',input:Object.fromEntries(url.searchParams)};else if(parts.length===4)action={operation:'CLARIFICATION',input:{clarification_id:parts[3]}};else if(parts.length===5&&['entries','collaborators'].includes(parts[4]))action={operation:parts[4]==='entries'?'REPLY':'SHARE',input:{clarification_id:parts[3],...input}};}
    if(parts[2]==='suppliers'&&parts.length===5&&parts[4]==='outcomes')action={operation:'OUTCOMES',input:{supplier_id:parts[3]}};
    if(parts[2]==='outcome-observations'&&parts.length===3)action={operation:'OBSERVE',input};
   }
   if(['PREPARE','CLARIFY','REPLY','SHARE','SNAPSHOT','OBSERVE'].includes(action?.operation)&&options.headers?.['idempotency-key'])action.request_id=options.headers['idempotency-key'];
   if(!action)return request(path,options,isCurrent);if(!active()||!isCurrent())throw Object.assign(Error('procurement_view_inactive'),{stale:true});
   const data=await request('/api/zero/turn',{method:'POST',body:JSON.stringify({message:'Gekozen Procurement-actie',conversation_id:conversation,turn_id:options.headers?.['idempotency-key']||root.crypto.randomUUID(),preferred_module:'procurement',client_context:{procurement_action:action}})},isCurrent);if(!active()||!isCurrent())throw Object.assign(Error('procurement_view_inactive'),{stale:true});if(!data.procurement_data)throw Error('procurement_result_missing');return data.procurement_data;
  };
  view=build(wrapped);host.append(view);select.addEventListener('change',()=>{if(view.canLeave&&!view.canLeave()){select.value=mode;return;}mode=select.value;});host.canLeave=()=>view.canLeave?view.canLeave():true;host.ready=view.ready;return host;
 }
 root.FoundlyProcurementTransport={create};
})(globalThis);
