'use strict';
const crypto=require('node:crypto'),{fixture:creative,hash,clone}=require('./marketing-creative-fixture'),service=require('../marketing-creative-reviews');
function fixture(){const f=creative(),first={id:'review-first',roles:['MANAGER'],permissions:['marketing:approve']},second={id:'review-second',roles:['MANAGER'],permissions:['marketing:approve']};
 const reference=(operation,source,input,actor=f.actor,key=crypto.randomUUID())=>({operation,source,input,actor,key,meta:{request_id:key,request_fingerprint:hash({operation:operation.toLowerCase()+':'+source.id,input}),operation,source_id:source.id,expected_revision:input.expected_revision}});
 const prepare=(source=f.source,extra={})=>reference('PREPARE',source,{expected_revision:source.revision,approval_steps:[first.id,second.id],reason:'Literal private review reason',confirm:true,...extra});
 const decision=(row,actor=first,value='APPROVE')=>reference('REVIEW',row,{expected_revision:row.revision,decision:value,reason:'Literal private decision',confirm:true},actor);
 const withdraw=row=>reference('WITHDRAW',row,{expected_revision:row.revision,reason:'Literal private withdrawal',confirm:true});
 const apply=r=>service[{PREPARE:'prepareCreativeReview',REVIEW:'reviewCreative',WITHDRAW:'withdrawCreativeReview'}[r.operation]](f.core,f.ctx,r.actor,r.source.id,r.input,{idempotency_key:r.key});
 return {...f,first,second,reference,prepare,decision,withdraw,apply,recover:(r,meta=r.meta,actor=r.actor)=>service.recover(f.core,f.ctx,actor,{...meta,confirm:true}),review:id=>f.core.get(f.ctx,f.admin,'creative_reviews',id),receipts:()=>f.adapter.bucket(f.ctx,'marketing:idempotency')};
}
module.exports={fixture,hash,clone};
