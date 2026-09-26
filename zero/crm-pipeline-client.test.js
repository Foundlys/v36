'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const editor=require('../crm-pipeline-editor'),{create,locales}=require('../foundly-i18n'),{FoundlyCrmCore}=require('../crm-core');

// This fixture runs the shipped component and controller against native CRM
// contracts. It is not a browser, layout or assistive-technology acceptance test.
class Element{
  constructor(tag){this.tagName=tag;this.children=[];this.handlers={};this.value='';this.disabled=false;this.open=false;this.hidden=false;this.textContent='';}
  append(...nodes){for(const node of nodes){node.parentElement=this;this.children.push(node);}}
  replaceChildren(...nodes){for(const node of this.children)node.parentElement=null;this.children=[];this.append(...nodes);}
  remove(){const parent=this.parentElement;if(parent){parent.children.splice(parent.children.indexOf(this),1);this.parentElement=null;}}
  addEventListener(type,handler){(this.handlers[type]??=[]).push(handler);}
  async fire(type){for(const handler of this.handlers[type]||[])await handler({currentTarget:this,preventDefault(){}});}
  focus(){this.focused=true;}
  showModal(){this.open=true;}
  close(){this.open=false;for(const handler of this.handlers.close||[])handler();}
  all(){return [this,...this.children.flatMap(child=>child.all())];}
}
const document={createElement:tag=>new Element(tag)};
const fields=box=>box.children[0].children.map(row=>({name:row.children[1].children[1],status:row.children[2].children[1],probability:row.children[3].children[1],remove:row.children[4]}));
const plain=value=>JSON.parse(JSON.stringify(value));

test('pipeline editor translates eight defaults but never derives status from stage names',async()=>{
  for(const locale of locales){
    const i18n=create(locale),box=editor.create({document,i18n}),rows=fields(box);
    assert.deepEqual(box.read().map(row=>[row.position,row.status,row.probability]),[[1,'OPEN',10],[2,'OPEN',30],[3,'OPEN',60],[4,'OPEN',80],[5,'WON',100],[6,'LOST',0]]);
    assert.equal(rows[0].name.value,i18n.t('crm.pipeline.new'));
    rows[0].name.value='Gewonnen <literal customer label>';rows[5].name.value='Open';
    assert.equal(box.read()[0].status,'OPEN');assert.equal(box.read()[5].status,'LOST');
    rows[0].probability.value='42';rows[0].status.value='WON';await rows[0].status.fire('change');
    assert.equal(rows[0].probability.value,'100');assert.equal(rows[0].probability.disabled,true);
    rows[0].status.value='LOST';await rows[0].status.fire('change');assert.equal(box.read()[0].probability,0);
    rows[0].status.value='OPEN';await rows[0].status.fire('change');assert.equal(box.read()[0].probability,42);assert.equal(rows[0].probability.disabled,false);
    assert.deepEqual(i18n.missingKeys(),[]);
  }
});

test('pipeline editor validates typed input, bounds stage count and locks an uncertain request',async()=>{
  const box=editor.create({document,i18n:create('en-GB')}),add=box.children[1];let rows=fields(box);
  for(const invalid of ['','-1','101','1.2','NaN']){rows[0].probability.value=invalid;assert.throws(()=>box.read(),error=>error.code==='crm_pipeline_input_invalid');}
  rows[0].probability.value='10';rows[0].status.value='translated-status';assert.throws(()=>box.read(),error=>error.code==='crm_pipeline_input_invalid');rows[0].status.value='OPEN';
  await add.fire('click');assert.equal(fields(box).length,7);assert.throws(()=>box.read(),error=>error.code==='crm_pipeline_input_invalid');
  fields(box)[6].name.value='New stage';assert.equal(box.read()[6].position,7);
  box.setDisabled(true);assert.ok(box.all().filter(node=>['input','select','button'].includes(node.tagName)).every(node=>node.disabled));
  await add.fire('click');await fields(box)[0].remove.fire('click');assert.equal(fields(box).length,7);
  box.setDisabled(false);for(let i=7;i<20;i++)await add.fire('click');assert.equal(fields(box).length,20);assert.equal(add.disabled,true);
  await add.fire('click');assert.equal(fields(box).length,20);
  while(fields(box).length>1)await fields(box).at(-1).remove.fire('click');
  rows=fields(box);assert.equal(rows[0].remove.disabled,true);await rows[0].remove.fire('click');assert.equal(fields(box).length,1);
});

function controller(locale='en-GB',afterWrite=()=>{}){
  const stores=new Map(),tenant={tenant_id:'pipeline-tenant',dealer_id:'pipeline-business'},actor={id:'pipeline-manager',roles:['MANAGER']},calls=[],messages=[];
  const core=new FoundlyCrmCore({bucket(ctx,scope){const key=ctx.tenant_id+':'+ctx.dealer_id+':'+scope;if(!stores.has(key))stores.set(key,[]);return stores.get(key);}});
  const form=new Element('form'),name=new Element('input'),submit=new Element('button');form.elements={name};form.reset=()=>{name.value='';};form.querySelector=selector=>selector.startsWith('button')?submit:name;
  const nodes={'#pipelineForm':form,'#pipelineDialog':new Element('dialog'),'#pipelineStages':new Element('div'),'#pipelineCreateNotice':new Element('p'),'#pipelineSelect':new Element('select')};
  const state={},sandbox={state,document,FoundlyI18n:create(locale),window:{FoundlyCrmPipelineEditor:editor},crypto,requestAnimationFrame:handler=>handler(),$:selector=>nodes[selector],loadPipelines:async()=>{},loadPipelineBoard:async()=>{},toast:message=>messages.push(message)};
  sandbox.api=async(path,options)=>{
    const entity=path.split('/').at(-1),input=JSON.parse(options.body),key=options.headers['idempotency-key'];calls.push({entity,input,key});
    const record=core.create(tenant,actor,entity,input,{idempotencyKey:key});await afterWrite({entity,input,key,record,nodes,calls,actor});return {record};
  };
  const source=fs.readFileSync(require.resolve('../crm-script'),'utf8'),start=source.indexOf('function openPipelineDialog('),end=source.indexOf('\n\nasync function loadRecords',start);
  assert.ok(start>=0&&end>start);vm.createContext(sandbox);vm.runInContext(source.slice(start,end),sandbox);
  return {state,nodes,core,tenant,actor,calls,messages,open:()=>sandbox.openPipelineDialog(),submit:()=>sandbox.createPipeline({currentTarget:form,preventDefault(){}}),count:entity=>core.list(tenant,{id:actor.id,roles:['ADMIN']},entity,{limit:200}).items};
}

test('actual pipeline controller keeps canonical stage semantics in every locale',async()=>{
  for(const locale of locales){
    const f=controller(locale);f.open();f.nodes['#pipelineForm'].elements.name.value='Sales <literal>';
    fields(f.state.pipelineEditor)[0].name.value='Gewonnen';await f.submit();
    assert.equal(f.count('pipelines').length,1);const stages=f.count('stages').sort((a,b)=>a.position-b.position);
    assert.equal(stages[0].name,'Gewonnen');assert.deepEqual(stages.map(row=>[row.status,row.probability]),[['OPEN',10],['OPEN',30],['OPEN',60],['OPEN',80],['WON',100],['LOST',0]]);
    assert.equal(f.state.pipelineRequest,null);assert.equal(f.nodes['#pipelineDialog'].open,false);assert.equal(f.messages[0],create(locale).t('crm.pipeline.created'));
  }
});

test('explicit retry after a committed but lost stage response reuses native idempotency keys and the frozen payload',async()=>{
  let lost=false;const f=controller('fr-FR',({entity,input})=>{if(entity==='stages'&&input.position===3&&!lost){lost=true;throw Error('simulated connection loss after commit');}});
  f.open();f.nodes['#pipelineForm'].elements.name.value='Pending pipeline';await assert.rejects(f.submit(),/connection loss/);
  assert.equal(f.count('pipelines').length,1);assert.equal(f.count('stages').length,3);assert.equal(f.state.pipelineBusy,false);
  const pending=plain(f.state.pipelineRequest),firstCalls=plain(f.calls);assert.equal(f.nodes['#pipelineForm'].elements.name.disabled,true);
  f.nodes['#pipelineDialog'].close();f.open();assert.deepEqual(plain(f.state.pipelineRequest),{...pending,paused:true});
  f.nodes['#pipelineForm'].elements.name.value='Programmatically changed';fields(f.state.pipelineEditor)[0].name.value='Changed';await f.submit();
  assert.equal(f.count('pipelines').length,1);assert.equal(f.count('pipelines')[0].name,'Pending pipeline');assert.equal(f.count('stages').length,6);
  assert.deepEqual(plain(f.calls.slice(firstCalls.length,firstCalls.length+firstCalls.length)),firstCalls);
  assert.equal(f.count('stages').find(row=>row.position===1).name,pending.stages[0].name);
});

test('closing the dialog stops subsequent writes and explicit reopen resumes the same pipeline',async()=>{
  let closed=false;const f=controller('de-DE',({entity,input,nodes})=>{if(entity==='stages'&&input.position===2&&!closed){closed=true;nodes['#pipelineDialog'].close();}});
  f.open();f.nodes['#pipelineForm'].elements.name.value='Paused pipeline';await assert.rejects(f.submit(),error=>error.message===create('de-DE').t('crm.pipeline.paused'));
  assert.equal(f.count('stages').length,2);const count=f.calls.length;await f.submit();assert.equal(f.calls.length,count);
  f.open();await f.submit();assert.equal(f.count('pipelines').length,1);assert.equal(f.count('stages').length,6);
});

test('overlapping submissions do not duplicate writes and current revoked CRM rights stop remaining stages',async()=>{
  let release;const blocked=new Promise(resolve=>release=resolve);const f=controller('en-GB',async({entity,actor})=>{if(entity==='pipelines'){await blocked;actor.roles=['VIEWER'];}});
  f.open();f.nodes['#pipelineForm'].elements.name.value='Rights changed';const first=f.submit();await f.submit();assert.equal(f.calls.length,1);release();
  await assert.rejects(first,error=>error.code==='crm_forbidden');assert.equal(f.count('pipelines').length,1);assert.equal(f.count('stages').length,0);
});

test('reopening a dialog while a previous write is in flight does not implicitly resume it',async()=>{
  let release;const blocked=new Promise(resolve=>release=resolve);let once=true;
  const f=controller('en-GB',async({entity})=>{if(entity==='pipelines'&&once){once=false;await blocked;}});
  f.open();f.nodes['#pipelineForm'].elements.name.value='Explicit resume only';const pending=f.submit();f.nodes['#pipelineDialog'].close();f.open();release();
  await assert.rejects(pending,error=>error.message===create('en-GB').t('crm.pipeline.paused'));
  assert.equal(f.count('stages').length,0);await f.submit();assert.equal(f.count('pipelines').length,1);assert.equal(f.count('stages').length,6);
});
