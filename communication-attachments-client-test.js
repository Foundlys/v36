'use strict';
// Production handlers under an isolated DOM contract, not browser acceptance.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
class Element{
 constructor(tag,cls='',text=''){this.tag=tag;this.className=cls;this.textContent=text;this.children=[];this.handlers={};this.attrs={};this.isConnected=true;}
 append(...children){for(const child of children){child.parent=this;this.children.push(child);}}
 setAttribute(key,value){this.attrs[key]=value;}
 addEventListener(name,handler){this.handlers[name]=handler;}
 remove(){this.parent.children=this.parent.children.filter(child=>child!==this);}
 async fire(name){return this.handlers[name]?.({preventDefault(){}});}
 all(){return [this,...this.children.flatMap(child=>child.all())];}
}
const source=fs.readFileSync(require.resolve('./foundly-workspace.js'),'utf8'),start=source.indexOf('  function appendDraftAttachments('),end=source.indexOf('\n  function appendDraftCollaboration',start);assert.ok(start>0&&end>start);
const find=(root,tag,text)=>root.all().find(row=>row.tag===tag&&(text===undefined||row.textContent===text));
async function mount({write=true,corrupt=false}={}){
 const requests=[],downloads=[],blobs=[],revoked=[],state={workspaceId:'communication',activeSection:'DRAFTS'},content=new Element('section'),cell=new Element('td'),body=new Element('body');let renders=0,failUpload=false;
 const bytes=Buffer.from('<script>fixture only</script>\nCafé 😀'),attachment={id:'file1',name:'Notes.txt',size_bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),content_base64:bytes.toString('base64')};
 const context={crypto,state,Uint8Array,Blob,atob,btoa,setTimeout:callback=>callback(),URL:{createObjectURL:blob=>{blobs.push(blob);return 'blob:fixture';},revokeObjectURL:href=>revoked.push(href)},document:{body},node:(...args)=>{const node=new Element(...args);if(node.tag==='a')node.click=()=>downloads.push({name:node.download,href:node.href});return node;},replaceChildren:(parent,children)=>{parent.children=[];parent.append(...children);},friendlyError:error=>error.message,renderDomainSection:async()=>{renders++;},request:async(route,options)=>{
  requests.push({route,options});if(options){if(failUpload)throw Error('Fixture network failure');return {ok:true};}
  if(route.endsWith('/file1'))return {attachment:{...attachment,...(corrupt?{content_base64:Buffer.from('corrupt').toString('base64')}:{})}};
  return {items:[attachment],current_revision:3,can_write:write,max_bytes:65536,max_current:10};
 }};
 vm.createContext(context);vm.runInContext(source.slice(start,end),context);context.appendDraftAttachments({id:'draft1'},cell,content);const details=cell.children[0];details.open=true;await details.fire('toggle');
 return {cell,content,requests,downloads,blobs,revoked,bytes,renders:()=>renders,failUpload:value=>{failUpload=value;}};
}
(async()=>{
 const test=await mount();await find(test.cell,'button','Tekstbestand downloaden').fire('click');assert.deepEqual(test.downloads,[{name:'Notes.txt',href:'blob:fixture'}]);assert.equal(test.blobs[0].type,'text/plain;charset=utf-8');assert.equal(Buffer.from(await test.blobs[0].arrayBuffer()).equals(test.bytes),true);assert.deepEqual(test.revoked,['blob:fixture']);assert.ok(!test.cell.all().some(row=>row.textContent.includes('<script>')));
 const form=find(test.cell,'form'),file=find(form,'input');file.files=[{name:'Upload.txt',size:3,arrayBuffer:async()=>Buffer.from('one')}];test.content.isConnected=false;test.failUpload(true);await form.fire('submit');const first=test.requests.at(-1);assert.equal(JSON.parse(first.options.body).expected_revision,3);await form.fire('submit');assert.equal(test.requests.at(-1).options.headers['idempotency-key'],first.options.headers['idempotency-key'],'Same input retries keep their idempotency key');
 file.files=[{name:'Changed.txt',size:3,arrayBuffer:async()=>Buffer.from('two')}];test.failUpload(false);await form.fire('submit');assert.notEqual(test.requests.at(-1).options.headers['idempotency-key'],first.options.headers['idempotency-key'],'Changing a failed upload starts a new input-bound request');assert.equal(test.renders(),0);
 const before=test.requests.length;file.files=[{name:'Large.txt',size:65537}];await form.fire('submit');assert.equal(test.requests.length,before);assert.ok(test.cell.all().some(row=>row.textContent.includes('maximaal 64 KiB')));
 await find(test.cell,'button','Uit concept verwijderen').fire('click');assert.deepEqual(JSON.parse(test.requests.at(-1).options.body),{attachment_id:'file1',expected_revision:3});
 const corrupt=await mount({corrupt:true});await find(corrupt.cell,'button','Tekstbestand downloaden').fire('click');assert.equal(corrupt.downloads.length,0);assert.equal(corrupt.blobs.length,0);assert.ok(corrupt.cell.all().some(row=>row.textContent.includes('niet worden geverifieerd')));
 const reader=await mount({write:false});assert.equal(find(reader.cell,'form'),undefined);assert.equal(find(reader.cell,'button','Uit concept verwijderen'),undefined);assert.ok(find(reader.cell,'button','Tekstbestand downloaden'));
 console.log('PASS production attachment handlers verify bytes, download only text, avoid inline rendering, preserve input-bound retry/CAS, bound uploads and respect read-only/detached state; browser acceptance not claimed');
})().catch(error=>{console.error(error);process.exitCode=1;});
