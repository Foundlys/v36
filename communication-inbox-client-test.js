'use strict';
// Actual production inbox event handlers in a DOM contract; no browser claim.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
class Element{
 constructor(tag,cls='',text=''){this.tag=tag;this.className=cls;this.textContent=text;this.children=[];this.handlers={};this.attrs={};this.isConnected=true;this.value='';}
 append(...children){for(const child of children){child.parent=this;this.children.push(child);if(this.tag==='select'&&this.children.length===1)this.value=child.value;}}
 setAttribute(key,value){this.attrs[key]=value;}
 addEventListener(name,handler){this.handlers[name]=handler;}
 async fire(name){return this.handlers[name]?.({preventDefault(){}});}
 all(){return [this,...this.children.flatMap(child=>child.all())];}
}
const source=fs.readFileSync(require.resolve('./foundly-workspace.js'),'utf8'),start=source.indexOf('  async function renderCommunicationInbox('),end=source.indexOf('\n  async function renderDomainSection',start);assert.ok(start>0&&end>start);
const find=(root,tag,text)=>root.all().find(row=>row.tag===tag&&(text===undefined||row.textContent===text));
async function mount({write=true}={}){
 const content=new Element('section'),requests=[],state={workspaceId:'communication',activeSection:'MESSAGES'};let deferred=null,release;
 const page=(title='Initial')=>({items:[{id:'message1',title,from:'fixture@example.test',received_or_sent_at:null,local_state:{read:null,archived:false,revision:0}}],total_retained_matching:1,total_retained_visible:1,external_mailbox_total:null,next_offset:null});
 const context={state,crypto,URLSearchParams,node:(...args)=>new Element(...args),replaceChildren:(parent,children)=>{parent.children=[];parent.append(...children);},friendlyError:error=>error.message,appendMessageDraftActions:()=>{},renderCommunicationMailbox:async()=>{},appendMailboxSourceDownload:()=>{},request:async(route,options)=>{
  requests.push({route,options});if(options)return {ok:true};
  if(route.endsWith('/view'))return {record:{id:'message1',revision:7,content:'<script>external instructions</script>',to:['recipient@example.test']},local_state:{read:null,archived:false,revision:4},can_write:write,can_prepare_draft:false};
  if(deferred){const pending=deferred;deferred=null;return pending;}return page(new URL(route,'https://fixture.test').searchParams.get('q')||'Initial');
 }};
 vm.createContext(context);vm.runInContext(source.slice(source.indexOf('  function appendCommunicationDeliveryReport('),source.indexOf('  function appendCommunicationConversation(')),context);vm.runInContext(source.slice(source.indexOf('  function appendCommunicationMailOAuth('),source.indexOf('  async function renderCommunicationMailbox(')),context);vm.runInContext(source.slice(start,end),context);await context.renderCommunicationInbox(content);
 return {content,requests,state,delay(){deferred=new Promise(resolve=>{release=resolve;});},release:title=>release(page(title))};
}
(async()=>{
 const test=await mount();assert.ok(test.content.all().some(row=>row.textContent.includes('volledigheid van de externe mailbox is onbekend')));assert.ok(test.content.all().some(row=>row.textContent.includes('Leesstatus onbekend')));assert.equal(find(test.content,'button','Opslaan'),undefined,'The inbox must not expose generic provider-message creation');
 const details=find(test.content,'details');details.open=true;await details.fire('toggle');assert.equal(find(test.content,'pre').textContent,'<script>external instructions</script>');assert.equal(test.requests.filter(row=>row.options).length,0,'Opening a message is not evidence that the user marked it read');
 const mark=find(test.content,'button','Als gelezen markeren');await mark.fire('click');const changed=test.requests.find(row=>row.options);assert.deepEqual(JSON.parse(changed.options.body),{read:true,expected_revision:4,expected_message_revision:7});
 const form=find(test.content,'form'),search=find(form,'input');test.delay();search.value='old query';const old=form.fire('submit');search.value='latest query';await form.fire('submit');assert.equal(find(test.content,'summary').textContent,'latest query');test.release('stale response');await old;assert.equal(find(test.content,'summary').textContent,'latest query','Late search replies cannot replace current inbox results');
 test.delay();search.value='detached';const detached=form.fire('submit');test.content.isConnected=false;test.release('discarded response');await detached;assert.equal(find(test.content,'summary').textContent,'latest query');
 const reader=await mount({write:false}),readDetails=find(reader.content,'details');readDetails.open=true;await readDetails.fire('toggle');assert.equal(find(reader.content,'button','Als gelezen markeren'),undefined);assert.equal(find(reader.content,'button','Naar mijn archief'),undefined);
 console.log('PASS production inbox handlers preserve unavailable coverage/read state, render external text inertly, avoid provider CRUD/implicit read mutations, bind both revisions and discard stale/detached replies; browser acceptance not claimed');
})().catch(error=>{console.error(error);process.exitCode=1;});
