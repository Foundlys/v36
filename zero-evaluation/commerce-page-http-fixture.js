'use strict';
// Actual workspace controller and Commerce UI over real authenticated HTTP.
// Synthetic DOM only; no rendered-browser, model or installed-device claim.
const fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const {fixture}=require('./workspace-page-fixture');
async function create(server,member,section='COMMERCE_PRODUCTS'){
 const f=fixture({workspaceId:'sales'}),calls=[];let loss=null;
 Object.assign(f.context,{crypto,TextEncoder,Uint8Array});
 f.context.fetch=async(route,options={})=>{const body=options.body?JSON.parse(options.body):undefined;calls.push({route,body});const drop=loss===route;if(drop)loss=null;const result=await server.request(route,options.method||'GET',body,member.cookie,{...options.headers,...(drop?{'x-fixture-commerce-drop':'committed-reply'}:{})});return{ok:result.status<400,status:result.status,json:async()=>result.body};};
 vm.runInContext(fs.readFileSync(require.resolve('../commerce-actions-client'),'utf8'),f.context);
 const definition=await server.request('/api/workspaces/sales','GET',undefined,member.cookie);if(definition.status!==200)throw Error('Workspace unavailable');f.ui.state.workspace=definition.body.workspace;f.ui.state.workspaceId='sales';f.ui.state.activeSection=section;f.ui.renderContext(section);
 const box=()=>f.ui.state.creativeHistoryViews?.filter(v=>v.isConnected).at(-1);if(!box())throw Error('Commerce panel did not mount');await box().ready;
 const page={...f,calls,get box(){return box();},field:key=>box()?.all().find(n=>n.getAttribute('data-commerce-field')===key),button:key=>box()?.all().find(n=>n.getAttribute('data-commerce-action')===key),async set(key,value){const n=this.field(key);n.value=value;await n.fire(['operation','transport','product','order'].includes(key)?'change':'input');},async confirm(){this.field('confirm').checked=true;await this.field('confirm').fire('change');},loseNext(route){loss=route;}};return page;
}
module.exports={create};
