'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
class Element{
 constructor(tag){Object.assign(this,{tag,children:[],handlers:{},dataset:{},value:'',checked:false,textContent:'',isConnected:true});}
 append(...children){for(const child of children){if(child.parentElement)child.remove();child.parentElement=this;this.children.push(child);if(this.tag==='select'&&this.children.length===1)this.value=child.value;}}
 replaceChildren(...children){for(const child of this.children)child.parentElement=null;this.children=[];this.append(...children);}
 setAttribute(key,value){this[key]=value;}
 addEventListener(name,handler){(this.handlers[name]??=[]).push(handler);}
 async fire(name){for(const handler of this.handlers[name]||[])await handler({preventDefault(){}});}
 all(){return [this,...this.children.flatMap(child=>child.all())];}
 querySelector(tag){return this.all().find(child=>child.tag===tag);}
 remove(){if(this.parentElement){const p=this.parentElement;p.children=p.children.filter(child=>child!==this);this.parentElement=null;}}
 focus(){this.focused=true;}
}
const find=(root,tag,label)=>root.all().find(el=>el.tag===tag&&(label===undefined||el.textContent===label));
const field=(root,label)=>find(root,'label',label).children[0];
const {FoundlyPlatformCore}=require('./platform-core'),{ownedActionInput}=require('./automation-owned-action');let rows=new Map(),effects=0;
const ctx={tenant_id:'recovery-ui',dealer_id:'default'},actor={id:'owner',roles:['ADMIN']},core=new FoundlyPlatformCore({bucket(c,s){const k=JSON.stringify([c,s]);if(!rows.has(k))rows.set(k,[]);return rows.get(k);},persist(){},automationActionContract:type=>({idempotent:type==='create_task'}),verifyAutomationAction(c,a,action,run){const o=ownedActionInput(action,run);return core.verifyAutomationRecord(c,a,o.entity,o.input,{idempotencyKey:run.idempotency_key});},executeAutomationAction(){throw Error('Fixture before effect');}});
const workflow=core.defineAutomation(ctx,actor,{name:'UI absent recovery',trigger:'custom_event',actions:[{type:'create_task',title:'Expected task'}]});
const source=fs.readFileSync(require.resolve('./foundly-workspace.js'),'utf8'),start=source.indexOf('        if(data.can_manage&&row.can_recover&&row.steps?.some('),end=source.indexOf("        if(row.status==='RECOVERY_READY'",start);assert.ok(start>0&&end>start);
let renders=0,requests=[];
function create(eventId){const row=core.runAutomation(ctx,actor,workflow.id,{event_id:eventId}),card=new Element('article');row.can_recover=true;const sandbox={card,row,data:{can_manage:true,retryable_actions:['create_task']},section:'FAILURES',content:new Element('div'),node:(tag,cls,text)=>{const e=new Element(tag);e.textContent=text||'';return e;},friendlyError:e=>e.message,renderAutomationSection:()=>{renders++;},request:async(route,options)=>{requests.push({route,options});if(options){const input=JSON.parse(options.body);return core.recoverAutomation(ctx,actor,row.run_id,input);}return core.previewAutomationRecovery(ctx,actor,row.run_id);}};vm.createContext(sandbox);vm.runInContext('(function(){'+source.slice(start,end)+'})()',sandbox);return {row,card};}
(async()=>{
 const {row,card}=create('ui:absent');await find(card,'button','Controleer opgeslagen resultaat').fire('click');assert.ok(card.all().some(e=>e.textContent.includes('Dit is geen voltooiing')));const save=find(card,'button','Nieuwe poging afzonderlijk voorbereiden');assert.ok(save);assert.equal(find(card,'button','Bewezen stap als voltooid vastleggen'),undefined);field(card,'Reden voor herstel').value='Reviewed verified absence';field(card,'Ik heb de bewezen afwezigheid en deze afzonderlijke voorbereiding van een nieuwe poging gecontroleerd').checked=true;await find(card,'form').fire('submit');assert.equal(renders,1);const current=core.automationStatus(ctx,actor).runs.find(r=>r.run_id===row.run_id);assert.equal(current.status,'RECOVERY_READY');assert.equal(current.steps[0].status,'PLANNED_INTERNAL');assert.equal(current.outputs.length,0);assert.equal(core.automationRecords(ctx,actor,'tasks').total,0);
 const changed=create('ui:changed');await find(changed.card,'button','Controleer opgeslagen resultaat').fire('click');core.createAutomationRecord(ctx,actor,'tasks',{title:'Expected task'},{idempotencyKey:changed.row.steps[0].idempotency_key});field(changed.card,'Reden voor herstel').value='Old absence preview';field(changed.card,'Ik heb de bewezen afwezigheid en deze afzonderlijke voorbereiding van een nieuwe poging gecontroleerd').checked=true;await find(changed.card,'form').fire('submit');assert.equal(renders,1);assert.ok(find(changed.card,'output').textContent.includes('gewijzigd'));assert.equal(core.automationStatus(ctx,actor).runs.find(r=>r.run_id===changed.row.run_id).status,'ERROR');
 const presentCard=new Element('article');const present=core.previewAutomationRecovery(ctx,actor,changed.row.run_id);assert.equal(present.action,'RECONCILE_VERIFIED_INTERNAL_RESULT');
 console.log('PASS actual recovery UI distinguishes verified absence from completion, confirms preparation without execution, and rejects stale absence when a record appears; NOT browser evidence');
})().catch(e=>{console.error(e);process.exitCode=1;});
