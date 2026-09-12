'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
class Element{
 get firstChild(){return this.children[0]||null;}
 constructor(tag){Object.assign(this,{tag,children:[],handlers:{},dataset:{},value:'',checked:false,textContent:'',isConnected:true});}
 append(...children){for(const child of children){if(child.parentElement)child.remove();child.parentElement=this;child.isConnected=this.isConnected;this.children.push(child);if(this.tag==='select'&&this.children.length===1)this.value=child.value;}}
 replaceChildren(...children){for(const child of this.children){child.parentElement=null;for(const node of child.all())node.isConnected=false;}this.children=[];this.append(...children);}
 setAttribute(key,value){this[key]=value;}
 addEventListener(name,handler){(this.handlers[name]??=[]).push(handler);}
 async fire(name,extra={}){for(const handler of this.handlers[name]||[])await handler({preventDefault(){},...extra});}
 all(){return [this,...this.children.flatMap(child=>child.all())];}
 querySelector(tag){return this.all().find(child=>child.tag===tag);}
 remove(){if(this.parentElement){const p=this.parentElement;p.children=p.children.filter(child=>child!==this);this.parentElement=null;}}
 prepend(child){this.append(child);this.children.unshift(this.children.pop());}
 focus(){this.focused=true;}
}
const find=(root,tag,label)=>root.all().find(el=>el.tag===tag&&(label===undefined||el.textContent===label));
const field=(root,label)=>find(root,'label',label).children[0];


const crypto=require('node:crypto');const sandbox={crypto,URL,document:{createElement:tag=>new Element(tag)}};vm.createContext(sandbox);vm.runInContext(fs.readFileSync('marketing-zero-client.js','utf8'),sandbox);
(async()=>{let wrapper,allow=true,active=true;const calls=[],request=async(path,options)=>{calls.push({path,options});return path==='/api/zero/turn'?{marketing_data:{ok:true}}:{native:true};};const host=sandbox.FoundlyMarketingTransport.create({document:sandbox.document,request,isActive:()=>active,build:call=>{wrapper=call;const box=new Element('div');box.canLeave=()=>allow;return box;}}),select=find(host,'select');
 await wrapper('/api/marketing/measurement/query',{method:'POST',body:'{}'});assert.equal(calls[0].path,'/api/marketing/measurement/query');allow=false;select.value='zero';await select.fire('change');assert.equal(select.value,'native');allow=true;select.value='zero';await select.fire('change');
 const action={expected_revision:1,confirm:true,reason:'Explicit',fields:{content:'PRIVATE content'}},options={method:'POST',headers:{'idempotency-key':'same-request'},body:JSON.stringify(action)};await wrapper('/api/marketing/creatives/creative-1/version',options);await wrapper('/api/marketing/creatives/creative-1/version',options);assert.deepEqual(calls[1],calls[2]);const payload=JSON.parse(calls[1].options.body);assert.equal(payload.client_context.marketing_action.operation,'VERSION');assert.equal(payload.client_context.marketing_action.input.fields.content,'PRIVATE content');assert.equal(payload.message.includes('PRIVATE'),false);
 await wrapper('/api/marketing/creatives/creative-1/revisions?offset=25&limit=25');assert.equal(JSON.parse(calls[3].options.body).client_context.marketing_action.input.offset,25);active=false;await assert.rejects(wrapper('/api/marketing/measurement/query',{method:'POST',body:'{}'}));
 console.log('PASS Marketing transport controls: native/ZERO route parity, preserved current typed payload, stable exact write turn, dirty-mode guard and detached refusal');
})().catch(e=>{console.error(e);process.exitCode=1;});
