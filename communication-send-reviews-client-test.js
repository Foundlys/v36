'use strict';
// Production event handlers in an in-memory DOM contract, not browser acceptance.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
class Element{
 constructor(tag,cls='',text=''){Object.assign(this,{tag,className:cls,textContent:text,children:[],handlers:{},attrs:{},isConnected:true,value:''});}
 append(...children){for(const child of children){child.parent=this;this.children.push(child);if(this.tag==='select'&&this.children.length===1)this.value=child.value;}}
 setAttribute(key,value){this.attrs[key]=value;}
 addEventListener(name,handler){this.handlers[name]=handler;}
 async fire(name){return this.handlers[name]?.({preventDefault(){}});}
 all(){return [this,...this.children.flatMap(child=>child.all())];}
}
const source=fs.readFileSync(require.resolve('./foundly-workspace.js'),'utf8'),start=source.indexOf('  function appendSendReviews('),end=source.indexOf('\n  function appendDraftAttachments',start);assert.ok(start>0&&end>start);
const find=(root,tag,text)=>root.all().find(row=>row.tag===tag&&(text===undefined||row.textContent===text)),field=(root,label)=>find(root,'label',label).children[0];
async function mount({canPrepare=true,canReview=false,canCancel=false}={}){
 const content=new Element('section'),cell=new Element('td'),requests=[],state={workspaceId:'communication',activeSection:'DRAFTS'};content.append(cell);let next=null,release,redraws=0,fail=false;
 const snapshot={title:'Exact subject',content:'<script>external instructions</script>',to:['recipient@example.test'],attachments:[{name:'Notes.txt'}]},plan={purpose:'business',draft_revision:7,preview_fingerprint:'exact-source',from:'sender@example.test',snapshot};
 const context={state,crypto,URLSearchParams,node:(...args)=>new Element(...args),replaceChildren:(parent,children)=>{parent.children=[];parent.append(...children);},friendlyError:error=>error.message,renderDomainSection:async()=>{redraws++;},request:async(route,options)=>{
  requests.push({route,options});if(options){if(fail)throw Error('Fixture transient failure');return {ok:true};}
  if(next){const pending=next;next=null;return pending;}
  if(route.includes('/preview?'))return plan;if(route.includes('/reviewers?'))return {items:[{id:'reviewer1',display_name:'Designated colleague'}]};
  return {can_prepare:canPrepare,items:canReview||canCancel?[{id:'review1',revision:3,status:'APPROVAL_REQUIRED',purpose:'business',from:plan.from,snapshot,source_current:true,reason:'Review exact sources',can_review:canReview,can_cancel:canCancel}]:[]};
 }};
 vm.createContext(context);vm.runInContext(source.slice(start,end),context);context.appendSendReviews({id:'draft1',revision:2},cell,content);const details=find(cell,'details');details.open=true;await details.fire('toggle');
 return {content,requests,state,plan,delay(){next=new Promise(resolve=>{release=resolve;});},release:value=>release(value),redraws:()=>redraws,fail:value=>{fail=value;}};
}
(async()=>{
 const test=await mount(),root=test.content,purpose=field(root,'Doel volgens de vastgelegde voorkeuren'),preview=find(root,'button','Exacte inhoud bekijken'),search=field(root,'Beoordelaar zoeken'),searchButton=find(root,'button','Beoordelaars zoeken'),reviewer=field(root,'Bevoegde beoordelaar'),submit=find(root,'button','Beoordeling aanvragen'),form=find(root,'form');
 assert.equal(submit.disabled,true);purpose.value='business';await preview.fire('click');assert.equal(find(root,'pre').textContent,test.plan.snapshot.content);assert.equal(submit.disabled,false);search.value='Designated';await searchButton.fire('click');assert.equal(reviewer.value,'','No implicit reviewer selection');assert.equal(reviewer.children[1].textContent,'Designated colleague');reviewer.value='reviewer1';field(root,'Reden voor beoordeling').value='Check exact source';field(root,'Ik bevestig deze inhoud en ontvangers').checked=true;
 test.fail(true);await form.fire('submit');await form.fire('submit');let writes=test.requests.filter(row=>row.options);assert.equal(writes[0].options.headers['idempotency-key'],writes[1].options.headers['idempotency-key']);assert.equal(JSON.parse(writes[0].options.body).expected_revision,7,'Use the preview revision instead of stale draft row');field(root,'Reden voor beoordeling').value='Changed rationale';await form.fire('submit');writes=test.requests.filter(row=>row.options);assert.notEqual(writes[0].options.headers['idempotency-key'],writes[2].options.headers['idempotency-key']);
 test.delay();const stale=preview.fire('click');purpose.value='other';await purpose.fire('input');purpose.value='business';await purpose.fire('input');test.release({...test.plan,snapshot:{...test.plan.snapshot,title:'Stale'}});await stale;assert.equal(submit.disabled,true);assert.equal(find(root,'h5'),undefined,'A-B-A purpose changes cannot resurrect an old preview');assert.equal(reviewer.value,'');
 await preview.fire('click');test.delay();search.value='old';const oldSearch=searchButton.fire('click');search.value='latest';test.release({items:[{id:'old',display_name:'Outdated colleague'}]});await oldSearch;assert.equal(reviewer.children.length,1,'Late directory results must match the current query');
 test.fail(false);reviewer.value='reviewer1';root.isConnected=false;const count=test.requests.length;await form.fire('submit');assert.equal(test.requests.length,count,'Detached forms cannot initiate actions');assert.equal(test.redraws(),0);
 const reader=await mount({canPrepare:false});assert.equal(find(reader.content,'form'),undefined);
 const assigned=await mount({canPrepare:false,canReview:true}),choice=field(assigned.content,'Beslissing');assert.equal(choice.value,'','Approval is an explicit choice');choice.value='REJECT';field(assigned.content,'Reden').value='Reject exact source';field(assigned.content,'Ik bevestig deze beoordeling').checked=true;await find(assigned.content,'form').fire('submit');const decision=assigned.requests.find(row=>row.options);assert.deepEqual(JSON.parse(decision.options.body),{expected_revision:3,reason:'Reject exact source',confirm:true,decision:'REJECT'});assert.equal(assigned.redraws(),1);
 const cancel=await mount({canPrepare:false,canCancel:true});field(cancel.content,'Reden').value='Withdraw';field(cancel.content,'Ik bevestig deze beoordeling').checked=true;await find(cancel.content,'form').fire('submit');assert.ok(cancel.requests.find(row=>row.options).route.endsWith('/review1/cancel'));
 console.log('PASS production review handlers bind displayed sources, require explicit reviewer/decision, retain retry keys only for identical input, discard stale previews/search and prevent detached actions; no browser acceptance claimed');
})().catch(error=>{console.error(error);process.exitCode=1;});
