'use strict';
const fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const {browserFixture,Element}=require('./dom-fixture'),{fixture}=require('./commerce-finance-fixture'),commerce=require('../sales-commerce'),retention=require('../commerce-action-confirmations');
class ControlElement extends Element{querySelectorAll(selector){return this.all().slice(1).filter(n=>selector.split(',').some(s=>['input','select','button'].includes(s)?n.tag===s:n.matches(s)));}}
function create(options={}){
 const native=options.native||fixture(),f=browserFixture('en-GB'),calls=[];let active=true,loss=null,hold=null;
 Object.assign(f.context,{crypto,TextEncoder,Uint8Array});f.context.document.createElement=tag=>new ControlElement(tag);
 const clone=value=>JSON.parse(JSON.stringify(value));
 const request=async(route,opts={})=>{const url=new URL(route,'https://fixture.test'),body=opts.body?JSON.parse(opts.body):null,parts=url.pathname.split('/'),last=parts.at(-1),op=opts.method||'GET';calls.push({route,body,method:op});if(hold?.route===route){const gate=hold;hold=null;gate.started();await gate.promise;}let data;
  if(url.pathname==='/api/composition')data={resolution:native.resolver.resolve(native.ctx,native.actor)};
  else if(last==='confirmations')data=op==='GET'?retention.list(native.sales,native.ctx,native.actor,Object.fromEntries(url.searchParams)):retention.remember(native.sales,native.ctx,native.actor,body);
  else if(last==='acknowledge')data=retention.acknowledge(native.sales,native.ctx,native.actor,body);
  else if(last==='recover')data=commerce.recover(native.sales,native.ctx,native.actor,body);
  else if(parts[4]==='actions')data=commerce.execute(native.sales,native.ctx,native.actor,last,body,{idempotency_key:opts.headers['idempotency-key']});
  else data=parts.length===6?{record:commerce.read(native.sales,native.ctx,native.actor,parts[4],last)}:commerce.list(native.sales,native.ctx,native.actor,last,Object.fromEntries(url.searchParams));
  if(loss===url.pathname){loss=null;throw Error('Actual native result lost in controller fixture');}return options.response?options.response(route,clone(data),op):clone(data);
 };
 const zeroRequest=async(action,turn)=>{calls.push({route:'/api/zero/turn',action,turn});const result=require('../sales-zero').execute(native.sales,null,native.ctx,native.actor,action,{message:'Explicit UI action',conversation_id:'commerce-ui',turn_id:turn}).sales_data;if(loss==='/api/zero/turn'){loss=null;throw Error('Lost native ZERO result');}return clone(result);};
 vm.runInContext(fs.readFileSync(require.resolve('../commerce-actions-client'),'utf8'),f.context);const box=f.context.FoundlyCommerceActions.create({document:f.context.document,request,zeroRequest,isActive:()=>active,onReadOnly:options.onReadOnly});f.nodes.commerce=box;
 return{...f,native,box,calls,request,field:key=>box.all().find(n=>n.getAttribute('data-commerce-field')===key),button:key=>box.all().find(n=>n.getAttribute('data-commerce-action')===key),async set(key,value){const n=this.field(key);n.value=value;await n.fire(['operation','transport','product','order'].includes(key)?'change':'input');},async confirm(){this.field('confirm').checked=true;await this.field('confirm').fire('change');},lose:route=>loss=route,detach(){active=false;box.isConnected=false;},hold(route){let release,start;const promise=new Promise(r=>release=r),started=new Promise(r=>start=r);hold={route,promise,started:start};release.started=started;return release;}};
}
module.exports={create,ControlElement};
