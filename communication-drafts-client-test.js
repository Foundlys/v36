'use strict';
// Exercise the production event handlers with an in-memory DOM contract.
// This is not browser, keyboard, layout or accessibility acceptance.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
class Element{
 constructor(tag,cls='',text=''){this.tag=tag;this.className=cls;this.textContent=text;this.children=[];this.handlers={};this.attrs={};this.isConnected=true;this.value='';}
 append(...children){for(const child of children){child.parent=this;this.children.push(child);}}
 prepend(...children){for(const child of children)child.parent=this;this.children.unshift(...children);}
 setAttribute(key,value){this.attrs[key]=value;}
 addEventListener(name,handler){this.handlers[name]=handler;}
 remove(){this.parent.children=this.parent.children.filter(child=>child!==this);}
 async fire(name){return this.handlers[name]?.({preventDefault(){}});}
 all(){return [this,...this.children.flatMap(child=>child.all())];}
}
const source=fs.readFileSync(require.resolve('./foundly-workspace.js'),'utf8'),start=source.indexOf('  function appendDraftCollaboration('),end=source.indexOf('\n  async function renderDomainSection',start);
assert.ok(start>0&&end>start);
async function mount({canWrite=true,canShare=true}={}){
 const requests=[],state={workspaceId:'communication',activeSection:'DRAFTS'},content=new Element('section'),cell=new Element('td');let renders=0;
 const initial={items:[{id:'rev1',draft_revision:1,title:'Original',capture_kind:'CURRENT_REVISION'}],total:21,next_offset:20,current_revision:3,collaborator_ids:['editor'],collaborators:[{id:'editor',display_name:'Editor fixture'}],can_write:canWrite,can_share:canShare};
 const context={crypto,state,node:(...args)=>new Element(...args),replaceChildren:(parent,children)=>{parent.children=[];parent.append(...children);},friendlyError:error=>error.message,renderDomainSection:async()=>{renders++;},request:async(route,options)=>{
  requests.push({route,options});
  if(options)return {ok:true};
  if(route.includes('offset='))return {...initial,current_revision:4,items:[],next_offset:null};
  if(route.includes('draft_revisions/'))return {record:{snapshot:{title:'Original',content:'Retained content',to:['recipient@example.test']}}};
  return initial;
 }};
 vm.createContext(context);vm.runInContext(source.slice(start,end),context);context.appendDraftCollaboration({id:'draft1',title:'Draft'},cell,content);
 const details=cell.children[0];details.open=true;await details.fire('toggle');return {cell,content,context,requests,renders:()=>renders};
}
const button=(root,title)=>root.all().find(node=>node.tag==='button'&&node.textContent===title);
(async()=>{
 const test=await mount();assert.ok(test.cell.all().some(node=>node.textContent==='Medebewerker zoeken'));assert.ok(!test.cell.all().some(node=>node.tag==='input'&&node.value==='editor'));
 await button(test.cell,'Meer revisies').fire('click');assert.ok(test.cell.all().some(node=>node.textContent.includes('Het concept is gewijzigd')));
 await button(test.cell,'Revisie bekijken').fire('click');
 const restore=button(test.cell,'Deze inhoud als nieuwe revisie herstellen').parent;restore.all().find(node=>node.tag==='textarea').value='Use original';restore.all().find(node=>node.type==='checkbox').checked=true;
 test.content.isConnected=false;await restore.fire('submit');const restored=JSON.parse(test.requests.at(-1).options.body);assert.equal(restored.expected_revision,3,'Paging a newer history must not silently refresh an older write precondition');assert.equal(restored.source_revision,1);assert.equal(test.renders(),0,'A completed action must not redraw a detached workspace');
 await button(test.cell,'Verwijderen').fire('click');const sharing=button(test.cell,'Toegang bijwerken').parent;sharing.all().find(node=>node.tag==='textarea').value='Remove shared access';sharing.all().find(node=>node.type==='checkbox').checked=true;await sharing.fire('submit');const shared=JSON.parse(test.requests.at(-1).options.body);assert.deepEqual(shared.collaborator_ids,[]);assert.equal(shared.expected_revision,3);
 const reader=await mount({canWrite:false,canShare:false});assert.equal(button(reader.cell,'Toegang bijwerken'),undefined);await button(reader.cell,'Revisie bekijken').fire('click');assert.equal(button(reader.cell,'Deze inhoud als nieuwe revisie herstellen'),undefined);
 console.log('PASS production draft client handlers keep stale revision protection, explicit collaborator removal, detached workspace isolation and read-only history controls; browser acceptance not claimed');
})().catch(error=>{console.error(error);process.exitCode=1;});
