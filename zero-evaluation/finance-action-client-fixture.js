'use strict';
// Actual action controller and native Finance core; synthetic DOM, not browser proof.
const fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const {browserFixture}=require('./dom-fixture'),{fixture,input}=require('./finance-mutation-fixture');
const clone=value=>JSON.parse(JSON.stringify(value));
function create(options={}){
 const native=options.native||fixture(),f=browserFixture('en-GB');let active=true,loss=null,hold=null;
 f.context.crypto=crypto;vm.runInContext(fs.readFileSync(require.resolve('../finance-invoice-actions-client'),'utf8'),f.context);
 const calls=[],request=async(route,opts={})=>{
  const body=opts.body?JSON.parse(opts.body):null,url=new URL(route,'https://fixture.test');calls.push({route,body});let result;
  if(hold&&route===hold.route){const wait=hold;hold=null;wait.started();await wait.promise;}
  if(url.pathname==='/api/finance/records/invoices')result=native.core.list(native.ctx,native.actor,'invoices',Object.fromEntries(url.searchParams));
  else if(url.pathname.endsWith('/confirmations')&&!body)result=native.core.listInvoiceActionConfirmations(native.ctx,native.actor,{operation:url.searchParams.get('operation'),limit:Number(url.searchParams.get('limit')||10)});
  else{const method={'preview':'previewInvoiceAction',execute:'executeInvoiceAction',recover:'recoverInvoiceAction',confirmations:'rememberInvoiceAction',acknowledge:'acknowledgeInvoiceAction'}[url.pathname.split('/').at(-1)];result=native.core[method](native.ctx,native.actor,body);}
  if(loss===url.pathname){loss=null;throw Error('lost committed HTTP response');}
  return clone(result);
 };
 if(!options.native)native.core.createInvoice(native.ctx,native.actor,{...input(native),invoice_number:'SOURCE <img> 001'});
 const box=f.context.FoundlyFinanceInvoiceActions.create({document:f.context.document,request,isActive:()=>active,operations:options.operations||f.context.FoundlyFinanceInvoiceActions.OPERATIONS});f.nodes.actions=box;
 return{...f,native,box,calls,request,field:key=>box.all().find(n=>n.getAttribute('data-finance-field')===key),button:key=>box.all().find(n=>n.getAttribute('data-finance-action')===key),async set(key,value){const node=this.field(key);node.value=value;await node.fire(['operation','document'].includes(key)?'change':'input');},async confirm(){this.field('reason').value='Explicit reviewed source';await this.field('reason').fire('input');this.field('confirm').checked=true;await this.field('confirm').fire('change');},lose(route){loss=route;},detach(){active=false;box.isConnected=false;},hold(route){let release,start;const promise=new Promise(r=>release=r),started=new Promise(r=>start=r);hold={route,promise,started:start};release.started=started;return release;}};
}
async function act(f,operation,id,fields={}){
 await f.set('operation',operation);await f.set('document',id);for(const[key,value]of Object.entries(fields))await f.set(key,value);
 await f.button('preview').fire('click');await f.confirm();await f.button('submit').fire('click');
}
module.exports={create,act};
