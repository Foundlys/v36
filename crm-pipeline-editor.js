(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FoundlyCrmPipelineEditor=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const statuses=Object.freeze(['OPEN','WON','LOST']);
  const template=Object.freeze([['new',10,'OPEN'],['qualified',30,'OPEN'],['proposal',60,'OPEN'],['negotiation',80,'OPEN'],['won',100,'WON'],['lost',0,'LOST']].map(Object.freeze));
  function defaults(i18n){return template.map(([key,probability,status])=>({name:i18n.t('crm.pipeline.'+key),probability,status}));}
  function create({document,i18n=globalThis.FoundlyI18n,stages=defaults(i18n)}){
    if(!i18n||!Array.isArray(stages)||stages.length<1||stages.length>20)throw Error('pipeline_editor_configuration_invalid');
    const root=document.createElement('section'),host=document.createElement('div'),add=document.createElement('button'),rows=[];let disabled=false;
    root.className='pipeline-stage-editor';host.className='pipeline-stage-list';add.type='button';root.append(host,add);
    function label(node,key){if(i18n.bind)return i18n.bind(node,key);node.textContent=i18n.t(key);return node;}
    function field(row,key,control){const wrap=document.createElement('label'),text=document.createElement('span');label(text,key);wrap.append(text,control);row.append(wrap);return control;}
    function failure(key){return Object.assign(Error(i18n.t(key)),{code:'crm_pipeline_input_invalid'});}
    function availability(){add.disabled=disabled||rows.length>=20;for(const row of rows){row.name.disabled=disabled;row.status.disabled=disabled;row.probability.disabled=disabled||row.status.value!=='OPEN';row.remove.disabled=disabled||rows.length===1;}}
    function append(stage){
      if(rows.length>=20)throw failure('crm.pipeline.limit');
      const box=document.createElement('fieldset'),legend=document.createElement('legend');box.className='pipeline-stage-row';box.append(label(legend,'crm.pipeline.stage'));
      const name=field(box,'crm.pipeline.stage_name',document.createElement('input'));name.value=String(stage.name??'');name.required=true;name.maxLength=160;
      const status=field(box,'crm.pipeline.status',document.createElement('select'));for(const value of statuses){const option=document.createElement('option');option.value=value;label(option,'crm.pipeline.status_'+value.toLowerCase());status.append(option);}status.value=stage.status;
      const probability=field(box,'crm.pipeline.probability',document.createElement('input'));probability.type='number';probability.min='0';probability.max='100';probability.step='1';probability.required=true;probability.value=String(stage.probability);
      const remove=document.createElement('button');remove.type='button';label(remove,'crm.pipeline.remove');box.append(remove);
      const row={box,name,status,probability,remove,openProbability:stage.status==='OPEN'?stage.probability:0,previousStatus:stage.status};rows.push(row);host.append(box);
      status.addEventListener('change',()=>{if(disabled)return;if(row.previousStatus==='OPEN')row.openProbability=probability.value;row.previousStatus=status.value;probability.value=String(status.value==='WON'?100:status.value==='LOST'?0:row.openProbability);availability();});
      remove.addEventListener('click',()=>{if(disabled||rows.length===1)return;rows.splice(rows.indexOf(row),1);box.remove();availability();});availability();return row;
    }
    label(add,'crm.pipeline.add');add.addEventListener('click',()=>{if(disabled||rows.length>=20)return;append({name:'',status:'OPEN',probability:0}).name.focus();});for(const stage of stages)append(stage);
    root.setDisabled=value=>{disabled=Boolean(value);availability();};
    root.read=()=>rows.map((row,index)=>{
      const name=row.name.value.trim(),status=row.status.value,raw=row.probability.value.trim(),probability=Number(raw);
      if(!name||name.length>160||!statuses.includes(status)||!raw||!Number.isInteger(probability)||probability<0||probability>100)throw failure('crm.pipeline.invalid');
      return {name,position:index+1,status,probability:status==='WON'?100:status==='LOST'?0:probability};
    });
    return root;
  }
  return {defaults,create};
});
