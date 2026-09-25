'use strict';
const crypto=require('node:crypto'),{fixture:forecastFixture,hash}=require('./sales-forecast-fixture'),service=require('../sales-hierarchy');
function fixture(){const f=forecastFixture(),author=f.admin,definition={key:'literal_team',version:1,title:'Literal private hierarchy',reader_ids:[f.actor.id],nodes:[{id:'root',label:'Literal private root',parent_id:null,owner_ids:[f.actor.id]}]},canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
 const request=(extra={},id=crypto.randomUUID())=>{const input={definition:JSON.parse(JSON.stringify(definition)),expected_revision:0,confirm:true,...extra};return {id,input,meta:{request_id:id,request_fingerprint:hash(input),definition_fingerprint:hash(canonical(input.definition))}};};
 return {...f,author,definition,request,apply:(r,a=author)=>service.save(f.core,f.ctx,a,r.id,r.input),recover:(r,meta=r.meta,a=author)=>service.recoverRequest(f.core,f.ctx,a,{...meta,confirm:true}),journal:()=>f.adapter.bucket(f.ctx,'sales:hierarchy_requests'),records:()=>f.core.bucket(f.ctx,'forecast_hierarchies')};
}
module.exports={fixture};
