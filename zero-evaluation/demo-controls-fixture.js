'use strict';
// Actual controller/native engine; minimal DOM is not device/layout evidence.
const fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto'),{browserFixture}=require('./dom-fixture'),{WorkspaceView}=require('./workspace-page-fixture'),{fixture:native}=require('./demo-universe-fixture');
async function fixture(){
 const f=browserFixture('nl-NL'),n=native(),calls=[];let drop=null,hold=null,holdPath=null,started,denied=false,alter=null;
 let clock=0;n.engine.clock=()=>clock+=600;
 f.context.document.createElement=tag=>new WorkspaceView(tag);f.context.crypto={randomUUID:()=>crypto.randomUUID()};Object.assign(f.context,{AbortController,setTimeout,clearTimeout});f.context.FoundlyDemoState=require('../demo-universe-client-state');
 const request=async(path,options={},active=()=>true)=>{
  calls.push({path,method:options.method||'GET',body:options.body?JSON.parse(options.body):null});
  if(denied)throw Object.assign(Error('PRIVATE_RAW_DENIAL'),{status:403});
  const input=options.body?JSON.parse(options.body):null;let data;
  if(path==='/api/demo-universe/session')data={ok:true,...n.engine.session(n.ctx,n.actor)};
  else if(path==='/api/demo-universe/preview')data={ok:true,...n.engine.preview(n.ctx,n.actor,input)};
  else if(path==='/api/demo-universe/runs')data={ok:true,universe:n.engine.start(n.ctx,n.actor,input,options.headers['idempotency-key'])};
  else if(path.endsWith('/advance'))data={ok:true,universe:n.engine.advance(n.ctx,n.actor,path.split('/')[4],input)};
  else throw Error('Unexpected route '+path);
  if(hold&&path===holdPath){const pending=hold;hold=null;started();await pending;}
  if(drop===path){drop=null;throw Error('Lost committed reply');}
  if(!active())throw Object.assign(Error('Retired view'),{stale:true});if(alter)alter(data,path);return data;
 };
 vm.runInContext(fs.readFileSync(require.resolve('../demo-universe-client'),'utf8'),f.context);
 const build=async()=>{const box=f.context.FoundlyDemoControls.create({document:f.context.document,request});f.nodes.demo=box;await box.ready;return box;};
 let box=await build();return {...f,n,calls,get box(){return box;},button:key=>box.all().find(e=>e.getAttribute('data-demo-action')===key),field:key=>box.all().find(e=>e.getAttribute('data-demo-field')===key),async reopen(){for(const e of box.all())e.isConnected=false;box=await build();},lose:path=>drop=path,deny:()=>denied=true,alter:fn=>alter=fn,hold(path){holdPath=path;let release;hold=new Promise(r=>release=r);release.started=new Promise(r=>started=r);return release;}};
}
module.exports={fixture};
