'use strict';
const assert=require('node:assert/strict');
const {FoundlyPlatformCore}=require('./platform-core');
const {validateWorkflow}=require('./workflow-execution');
const ctx={tenant_id:'condition-fixture',dealer_id:'default'},actor={id:'condition-owner',roles:['ADMIN']};
let state=new Map(),disk,clock=new Date('2026-09-11T10:00:00Z'),effects=0;
const adapter={bucket(c,s){const key=JSON.stringify([c,s]);if(!state.has(key))state.set(key,[]);return state.get(key);},persist(){disk=JSON.stringify([...state]);},now:()=>clock,executeAutomationAction(c,a,action,run){effects++;const record=core.createAutomationRecord(c,a,'tasks',{title:action.title||'Condition fixture'},{idempotencyKey:run.idempotency_key});return {executed:true,record_id:record.id};}};
let core=new FoundlyPlatformCore(adapter);
const leaf={field:'inputs.score',operator:'gte',value:5};
const invalid=[false,true,null,0,1,'',[],{}, {all:[]},{any:false},{all:[leaf],any:[leaf]},{all:[leaf],field:'inputs.score'}, {any:[leaf,false]}, {all:[null]}, {all:[leaf],extra:true}, {...leaf,operator:'wat'}, {...leaf,value:'5'}, {...leaf,value:null}, {field:'inputs.score',operator:'eq'}, {field:'inputs.score',operator:'in',value:'x'}, {field:'inputs.score',operator:'in',value:[]}, {field:'inputs.score',operator:'in',value:[{}]}, {...leaf,field:'inputs.constructor'}, {...leaf,extra:true}, {field:'inputs.score',operator:'exists',value:false}];
let deep=leaf;for(let n=0;n<6;n++)deep={all:[deep]};invalid.push(deep,{all:Array(21).fill(leaf)},{all:Array(20).fill({all:Array(20).fill(leaf)})});
for(const [index,when] of invalid.entries()){
 const before=JSON.stringify([...state]),count=effects;
 assert.throws(()=>core.defineAutomation(ctx,actor,{name:`Invalid ${index}`,trigger:'custom_event',actions:[{type:'create_task'},{type:'create_task',when}]}),{code:'automation_condition_invalid'});
 assert.equal(JSON.stringify([...state]),before,'Rejected definition must not mutate storage');assert.equal(effects,count);
 // Simulate an old invalid persisted definition, without passing new validation.
 const flow=core.defineAutomation(ctx,actor,{name:`Retained ${index}`,trigger:{type:'schedule',automatic:true,at:clock.toISOString()},actions:[{type:'create_task'},{type:'create_task'}]});
 const retained=core.bucket(ctx,'automations').find(row=>row.id===flow.id);retained.actions[1].when=when;
 const preserved=JSON.stringify(retained),runCount=core.bucket(ctx,'automation_runs').length;
 assert.throws(()=>core.runAutomation(ctx,actor,flow.id,{event_id:`invalid:${index}`}),{code:'automation_condition_invalid'});
 assert.equal(effects,count,'Even preceding unconditional actions must not run');assert.equal(core.bucket(ctx,'automation_runs').length,runCount);assert.equal(JSON.stringify(retained),preserved,'Keep invalid retained evidence intact');
}
for(const when of [undefined,NaN,Infinity,{...leaf,value:NaN}])assert.throws(()=>validateWorkflow([{type:'create_task',when}]),{code:'automation_condition_invalid'});
const good=core.defineAutomation(ctx,actor,{name:'Unrelated valid schedule',trigger:{type:'schedule',automatic:true,at:clock.toISOString()},actions:[{type:'create_task'}]});
const tick=core.tickAutomations(ctx,actor);assert.equal(tick.invalid_workflows.length,invalid.length);assert.equal(tick.processed,1);assert.equal(effects,1);assert.equal(tick.runs[0].status,'SUCCEEDED');
const definitions=[
 [undefined,{},true],[leaf,{score:7},true],[leaf,{score:3},false],
 [{all:[leaf,{any:[{field:'inputs.flag',operator:'eq',value:true},{field:'inputs.kind',operator:'in',value:['a','b']}]}]},{score:7,kind:'b'},true],
 [{all:[leaf,{any:[{field:'inputs.flag',operator:'eq',value:true},{field:'inputs.kind',operator:'in',value:['a','b']}]}]},{score:7,kind:'c'},false],
 [{field:'inputs.x',operator:'exists'},{x:false},true], [{field:'inputs.x',operator:'exists'},{x:null},false],
 [{field:'inputs.x',operator:'eq',value:null},{x:null},true], [{field:'inputs.x',operator:'ne',value:5},{x:4},true],
 ...['gt','gte','lt','lte'].map(operator=>[{field:'inputs.x',operator,value:5},{x:operator.startsWith('g')?6:4},true])
];
for(const [i,[when,inputs,expected]] of definitions.entries()){
 const flow=core.defineAutomation(ctx,actor,{name:`Valid ${i}`,trigger:'custom_event',actions:[{type:'create_task',...(when===undefined?{}:{when})}]});const count=effects,event={event_id:`valid:${i}`};
 const run=core.runAutomation(ctx,actor,flow.id,event,{inputs});assert.equal(run.steps[0].status,expected?'SUCCEEDED':'SKIPPED_CONDITION');assert.equal(effects,count+Number(expected));core.runAutomation(ctx,actor,flow.id,event,{inputs});assert.equal(effects,count+Number(expected));
}
// Maximum valid group nesting survives definition persistence and step evidence.
let nested=leaf;for(let n=0;n<5;n++)nested={all:[nested]};
const flow=core.defineAutomation(ctx,actor,{name:'Retained nested delay',trigger:'custom_event',actions:[{type:'delay',seconds:1},{type:'create_task',when:nested}]}),event={event_id:'nested:one'};
let run=core.runAutomation(ctx,actor,flow.id,event,{inputs:{score:7}});assert.equal(run.status,'WAITING_TIME');
state=new Map(JSON.parse(disk));core=new FoundlyPlatformCore(adapter);clock=new Date(clock.getTime()+2000);
run=core.runAutomation(ctx,actor,flow.id,event,{inputs:{score:7}});assert.equal(run.status,'SUCCEEDED');assert.deepEqual(run.steps[1].input.when,nested);
const delayed=core.defineAutomation(ctx,actor,{name:'Invalid resume',trigger:'custom_event',actions:[{type:'delay',seconds:1},{type:'create_task'}]}),resumeEvent={event_id:'invalid:resume'};
core.runAutomation(ctx,actor,delayed.id,resumeEvent);core.bucket(ctx,'automations').find(row=>row.id===delayed.id).actions[1].when=false;core.commit();state=new Map(JSON.parse(disk));core=new FoundlyPlatformCore(adapter);clock=new Date(clock.getTime()+2000);const count=effects;
assert.throws(()=>core.runAutomation(ctx,actor,delayed.id,resumeEvent),{code:'automation_condition_invalid'});assert.equal(effects,count);
console.log('PASS malformed conditions reject definition/manual/scheduled/resumed execution without effects; complete group validation, bounds, valid operators, nested persistence and replay');
