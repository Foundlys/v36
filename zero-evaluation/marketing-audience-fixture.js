'use strict';
const crypto=require('node:crypto'),{fixture:base,hash,clone}=require('./marketing-creative-fixture'),service=require('../marketing-audiences');
function fixture(){const f=base(),audience=f.core.save(f.ctx,f.actor,'audiences',{name:'Literal private audience',filters:{tags_all:[],tags_none:[]}}).record;
 const reference=(operation,input,key=crypto.randomUUID())=>({operation,input,key,meta:{request_id:key,request_fingerprint:hash(operation==='MEMBER_SAVE'?{audienceId:audience.id,input}:{operation:'FILTERS',audienceId:audience.id,input}),operation,audience_id:audience.id,expected_audience_revision:operation==='MEMBER_SAVE'?input.expected_audience_revision:input.expected_revision,subject_hash:operation==='MEMBER_SAVE'?hash(input.subject_id):null,expected_member_revision:operation==='MEMBER_SAVE'?input.expected_member_revision:null}});
 const member=(extra={})=>reference('MEMBER_SAVE',{subject_id:'literal-person',expected_audience_revision:1,expected_member_revision:0,email:'literal@EXAMPLE.test',tags:['literal-tag'],permission_status:'UNKNOWN',permission_evidence:'Literal private permission reference',permission_observed_at:'2026-09-01T00:00:00Z',reason:'Literal private member reason',confirm:true,...extra});
 const filters=(extra={})=>reference('AUDIENCE_FILTERS',{expected_revision:1,tags_all:['literal-tag'],tags_none:[],reason:'Literal private filters reason',confirm:true,...extra});
 const apply=r=>service[r.operation==='MEMBER_SAVE'?'upsert':'filters'](f.core,f.ctx,f.actor,audience.id,r.input,{idempotency_key:r.key});
 return {...f,audience,reference,member,filters,apply,recover:(r,meta=r.meta,actor=f.actor)=>service.recover(f.core,f.ctx,actor,{...meta,confirm:true}),currentAudience:()=>f.core.get(f.ctx,f.actor,'audiences',audience.id),receipts:()=>f.adapter.bucket(f.ctx,service.OPERATIONS)};
}
module.exports={fixture,hash,clone};
