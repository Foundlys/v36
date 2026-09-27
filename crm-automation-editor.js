(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FoundlyCrmAutomationEditor=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const effects=new Set(['assign','field_update','stage_change']),numbers=new Set(['score','value','margin','amount','forecast_value','probability']),dates=new Set(['next_action_at','last_contacted_at','expected_close_at']);
 function create({document,i18n=globalThis.FoundlyI18n,request,schema}){
  const root=document.createElement('section');root.className='wide';let generation=0,disabled=false,current=null;
  function label(node,key){if(i18n.bind)i18n.bind(node,key);else node.textContent=i18n.t(key);return node;}
  function el(tag,key){const node=document.createElement(tag);if(key)label(node,key);return node;}
  function field(host,key,node){const wrap=el('label'),text=el('span',key);wrap.append(text,node);host.append(wrap);return node;}
  function failure(){return Object.assign(Error(i18n.t('crm.automation.incomplete')),{status:400,code:'crm_automation_input_invalid'});}
  function active(state){return current===state&&generation===state.generation&&root.isConnected;}
  function option(select,value,key,literal){const node=el('option',key);node.value=value;if(literal!==undefined)node.textContent=literal;select.append(node);return node;}
  function choices(select,rows){select.replaceChildren();option(select,'','crm.automation.choose');for(const row of rows)option(select,row.id,null,row.name||row.title||row.id);select.value='';}
  function availability(){if(!current)return;for(const node of current.inputs)node.disabled=disabled;for(const picker of current.pickers){picker.select.disabled=disabled||picker.busy||!picker.rows.length;picker.more.disabled=disabled||picker.busy||picker.next===null;}
   if(current.value)current.value.disabled=disabled||Boolean(current.clear.checked);
  }
  function source(state,host,key,entity,query=''){
   const select=field(host,key,el('select'));select.required=true;const notice=el('p'),more=el('button','crm.automation.more');more.type='button';host.append(notice,more);const picker={select,notice,more,rows:[],next:0,busy:false,token:0,query};state.inputs.push(select);state.pickers.push(picker);
   picker.load=async(reset=false)=>{if(!active(state)||disabled||picker.busy&&!reset)return;const token=++picker.token;if(reset){picker.rows=[];picker.next=0;choices(select,[]);}if(picker.next===null)return;picker.busy=true;availability();label(notice,'common.loading');
    try{const result=await request('/api/crm/'+entity+'?limit=200&sort=name&order=asc&cursor='+picker.next+picker.query);if(!active(state)||token!==picker.token)return;if(!Array.isArray(result.items)||result.items.some(row=>!row||typeof row.id!=='string'||!row.id))throw failure();const selected=select.value;picker.rows=[...new Map([...picker.rows,...result.items].filter(row=>!row.deleted_at&&row.enabled!==false&&(entity!=='users'||!/^(?:INACTIVE|DISABLED|ARCHIVED)$/i.test(row.status||''))).map(row=>[row.id,row])).values()];choices(select,picker.rows);if(picker.rows.some(row=>row.id===selected))select.value=selected;
     const next=result.next_cursor;if(next!==null&&(!Number.isSafeInteger(next)||next<=Number(picker.next)))throw failure();picker.next=next;label(notice,picker.rows.length?'crm.automation.source_scope':'common.no_data');more.hidden=picker.next===null;label(more,'crm.automation.more');
    }catch(error){if(!active(state)||token!==picker.token)return;picker.rows=[];picker.next=0;choices(select,[]);more.hidden=false;label(more,'crm.automation.retry');label(notice,'crm.automation.load_error');}
    finally{if(active(state)&&token===picker.token){picker.busy=false;availability();}}
   };
   more.addEventListener('click',()=>picker.load());choices(select,[]);return picker;
  }
  root.select=async type=>{
   const state={type,generation:++generation,inputs:[],pickers:[]};current=state;root.replaceChildren();if(!effects.has(type))return;root.append(el('p','crm.automation.scope'));
   try{const contract=(await schema()).automation_internal_contract;if(!active(state))return;if(!contract||contract.execution_mode!=='AUTOMATIC_INTERNAL'||!Array.isArray(contract.entities)||!Array.isArray(contract.fields))throw failure();state.contract=contract;
    const entity=field(root,'crm.automation.target',el('select'));state.entity=entity;state.inputs.push(entity);entity.required=true;for(const value of type==='stage_change'?['deals']:contract.entities)option(entity,value,'crm.source.entity.'+value);entity.value=type==='stage_change'?'deals':contract.entities[0];
    if(type==='assign'){state.owner=source(state,root,'crm.automation.owner','users');await state.owner.load();}
    else if(type==='stage_change'){
     state.pipeline=source(state,root,'crm.dashboard.metric.pipeline','pipelines');const stageHost=el('div');root.append(stageHost);state.stage=source(state,stageHost,'crm.pipeline.stage','stages');state.stage.next=null;state.stage.more.hidden=true;
     state.pipeline.select.addEventListener('change',async()=>{if(!active(state)||disabled)return;const id=state.pipeline.select.value;state.stage.query='&filter.pipeline_id='+encodeURIComponent(id);state.stage.token++;state.stage.rows=[];state.stage.next=id?0:null;state.stage.busy=false;choices(state.stage.select,[]);availability();if(id)await state.stage.load(true);});await state.pipeline.load();
    }else{
     state.field=field(root,'crm.automation.field',el('select'));state.inputs.push(state.field);for(const key of contract.fields)option(state.field,key,'crm.automation.field.'+key);state.field.value=contract.fields.includes('status')?'status':contract.fields[0];
     state.value=field(root,'crm.automation.value',el('input'));state.value.required=true;state.inputs.push(state.value);state.clear=field(root,'crm.automation.clear',el('input'));state.clear.type='checkbox';state.inputs.push(state.clear);
     const updateType=()=>{state.value.type=numbers.has(state.field.value)?'number':dates.has(state.field.value)?'datetime-local':'text';if(numbers.has(state.field.value)){state.value.min='0';state.value.step='any';}else state.value.removeAttribute('min');state.value.required=!state.clear.checked;availability();};
     state.field.addEventListener('change',()=>{if(!active(state)||disabled)return;state.value.value='';state.clear.checked=false;updateType();});state.clear.addEventListener('change',()=>{if(active(state)&&!disabled)updateType();});updateType();
    }availability();
   }catch(error){if(active(state)){state.contract=null;root.replaceChildren(el('p','crm.automation.load_error'));const retry=el('button','crm.automation.retry');retry.type='button';retry.addEventListener('click',()=>{if(!disabled&&active(state))return root.select(type);});root.append(retry);}}
  };
  root.read=type=>{
   if(!effects.has(type))return {type};const state=current;if(!state||state.type!==type||!active(state)||!state.contract||state.pickers.some(p=>p.busy))throw failure();const entity=state.entity.value;if(!state.contract.entities.includes(entity))throw failure();const action={type,execution_mode:'AUTOMATIC_INTERNAL',target_entity:entity};
   const selected=picker=>{const row=picker.rows.find(row=>row.id===picker.select.value);if(!row)throw failure();return row;};
   if(type==='assign')action.owner_id=selected(state.owner).id;
   else if(type==='stage_change'){const pipeline=selected(state.pipeline),stage=selected(state.stage);if(entity!=='deals'||stage.pipeline_id!==pipeline.id)throw failure();action.stage_id=stage.id;}
   else{const field=state.field.value;if(!state.contract.fields.includes(field))throw failure();let value=state.value.value;if(state.clear.checked)value=null;else if(numbers.has(field)){if(!String(value).trim()||!Number.isFinite(Number(value))||Number(value)<0||['score','probability'].includes(field)&&Number(value)>100)throw failure();value=Number(value);}else if(dates.has(field)){if(!value||!Number.isFinite(Date.parse(value)))throw failure();value=new Date(value).toISOString();}else if(!String(value).trim())throw failure();if(['name','title'].includes(field)&&value===null)throw failure();action.field=field;action.value=value;}
   return action;
  };
  root.setDisabled=value=>{disabled=Boolean(value);availability();};
  root.clear=()=>{generation++;current=null;root.replaceChildren();};
  root.invalidate=()=>{const type=current?.type;root.clear();if(!effects.has(type))return;const token=generation,retry=el('button','crm.automation.retry');retry.type='button';root.append(el('p','crm.automation.load_error'),retry);retry.addEventListener('click',()=>{if(!disabled&&token===generation&&root.isConnected)return root.select(type);});};
  return root;
 }
 return {create};
});
