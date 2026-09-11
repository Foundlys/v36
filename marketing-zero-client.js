'use strict';
(function(root){
 function create({document,request,build,isActive=()=>true}){
  const host=document.createElement('section'),label=document.createElement('label'),select=document.createElement('select');label.textContent='Bediening';
  for(const [value,title]of [['native','Native Marketing'],['zero','ZERO']]){const option=document.createElement('option');option.value=value;option.textContent=title;select.append(option);}select.value='native';label.append(select);host.append(label);
  let mode='native',view;const conversation=root.crypto.randomUUID(),active=()=>host.isConnected&&isActive();
  const wrapped=async(path,options={})=>{
   if(mode!=='zero')return request(path,options);
   const url=new URL(path,'https://foundly.invalid'),parts=url.pathname.split('/').filter(Boolean),input=options.body?JSON.parse(options.body):{};let action;
   if(parts[0]==='api'&&parts[1]==='marketing'){
    if(parts[2]==='measurement'&&['query','drilldown'].includes(parts[3]))action={operation:parts[3]==='query'?'METRICS':'SOURCES',input};
    else if(parts[2]==='creatives'){
     if(parts.length===5&&parts[4]==='revisions')action={operation:'HISTORY',input:{creative_id:parts[3],...Object.fromEntries([...url.searchParams].map(([key,value])=>[key,Number(value)]))}};
     if(parts.length===5&&parts[4]==='version')action={operation:'VERSION',input:{creative_id:parts[3],...input}};
     if(parts.length===7&&parts[4]==='revisions'&&parts[6]==='restore')action={operation:'RESTORE',input:{creative_id:parts[3],revision_id:parts[5],...input}};
    }
   }
   if(!action)return request(path,options);if(!active())throw Error('Deze Marketing-weergave is niet meer actief.');
   const data=await request('/api/zero/turn',{method:'POST',body:JSON.stringify({message:'Gekozen Marketing-actie',conversation_id:conversation,turn_id:options.headers?.['idempotency-key']||root.crypto.randomUUID(),preferred_module:'marketing',client_context:{marketing_action:action}})});if(!active())throw Error('Deze Marketing-weergave is niet meer actief.');if(!data.marketing_data)throw Error('Het actuele Marketing-resultaat ontbreekt.');return data.marketing_data;
  };
  view=build(wrapped);host.append(view);select.addEventListener('change',()=>{if(view.canLeave&&!view.canLeave()){select.value=mode;return;}mode=select.value;});host.canLeave=()=>view.canLeave?view.canLeave():true;host.ready=view.ready;return host;
 }
 root.FoundlyMarketingTransport={create};
})(globalThis);
