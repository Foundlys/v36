'use strict';
// Production Finance page, loader and action controller over actual HTTP.
// The DOM is synthetic: this is not layout, installed-device or model evidence.
const fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const {browserFixture}=require('./dom-fixture'),{View}=require('./analysis-page-fixture');
const source=fs.readFileSync(require.resolve('../finance-script'),'utf8');
async function create(server,member){
 const f=browserFixture('en-GB'),calls=[];let loss=null;
 for(const id of new Set([...source.matchAll(/\$\('#([^']+)'\)/g)].map(m=>m[1].split(' ')[0])))f.nodes[id]=new View();
 f.nodes.financeZeroForm.append(new View('button'));f.context.document.createElement=tag=>new View(tag);f.context.document.querySelector=selector=>selector==='#financeZeroForm button'?f.nodes.financeZeroForm.querySelector('button'):selector.startsWith('#')?f.nodes[selector.slice(1)]||null:null;
 f.context.fetch=async(route,options={})=>{
  const body=options.body?JSON.parse(options.body):undefined;calls.push({route,body});let headers={};
  if(loss===route&&(route!=='/api/zero/turn'||body?.client_context?.finance_action?.operation.endsWith('_EXECUTE'))){loss=null;headers={'x-fixture-finance-drop':'committed-reply'};}
  const response=await server.request(route,options.method||'GET',body,member.cookie,headers);return{ok:response.status<400,status:response.status,text:async()=>JSON.stringify(response.body)};
 };
 Object.assign(f.context,{window:f.context,crypto,sessionStorage:{},URLSearchParams,FoundlyFinanceLoading:require('../finance-loading')});
 vm.runInContext(fs.readFileSync(require.resolve('../finance-invoice-actions-client'),'utf8'),f.context);
 vm.runInContext(source.replace(/load\(true\);\s*$/, 'globalThis.pageReady=load(true);'),f.context);await f.context.pageReady;
 let box=f.nodes.financeActions.children[0];if(!box)throw Error('Finance actions did not mount: '+f.nodes.financeNotice.textContent);await box.ready;
 const page={...f,calls,get box(){return f.nodes.financeActions.children[0];},field:key=>page.box.all().find(n=>n.getAttribute('data-finance-field')===key),button:key=>page.box.all().find(n=>n.getAttribute('data-finance-action')===key),async set(key,value){const node=this.field(key);node.value=value;await node.fire(['operation','document','legal_entity','invoice_kind'].includes(key)?'change':'input');},async confirm(){this.field('reason').value='Explicit current UI financial action';await this.field('reason').fire('input');this.field('confirm').checked=true;await this.field('confirm').fire('change');},async transport(value){f.nodes.financeTransport.value=value;await f.nodes.financeTransport.fire('change');},loseNext(route){loss=route;}};if(f.nodes.financeCreate.children[0]){const creation={...page,get box(){return f.nodes.financeCreate.children[0];}};creation.field=key=>creation.box.all().find(n=>n.getAttribute('data-finance-field')===key);creation.button=key=>creation.box.all().find(n=>n.getAttribute('data-finance-action')===key);creation.line=(index,key)=>creation.box.all().filter(n=>n.getAttribute('data-finance-line')!==null)[index].all().find(n=>n.getAttribute('data-finance-line-field')===key);creation.setLine=async(index,key,value)=>{const node=creation.line(index,key);node.value=value;await node.fire('input');};page.creation=creation;await creation.box.ready;}return page;
}
module.exports={create};
