'use strict';
const assert=require('node:assert/strict'),{BusinessDomain}=require('./business-domains'),{CapabilityResolver}=require('./capability-resolver');
const state=new Map(),ctx={tenant_id:'history-bounds',dealer_id:'default'},actor={id:'reader',roles:['VIEWER'],permissions:['communication:export']},admin={id:'admin',roles:['SUPER_ADMIN']};
let draftReads=0;
const adapter={bucket(c,scope){if(scope==='communicatie')draftReads++;const key=JSON.stringify([c.tenant_id,c.dealer_id,scope]);if(!state.has(key))state.set(key,[]);return state.get(key);},persist(){},audit(){},publish(){}};
const resolver=new CapabilityResolver(adapter);resolver.configure(ctx,admin,{entitlements:['communication'],expected_revision:0});const core=new BusinessDomain('communication',adapter,resolver);
const parents=core.bucket(ctx,'drafts'),revisions=core.bucket(ctx,'draft_revisions');
for(let p=0;p<200;p++){
 parents.push({id:'draft-'+p,owned_entity:'drafts',owner_id:'owner-'+p,collaborator_ids:p%2===0?[actor.id]:[]});
 for(let r=0;r<100;r++)revisions.push({id:`revision-${p}-${r}`,owned_entity:'draft_revisions',owner_id:'owner-'+p,draft_id:'draft-'+p,draft_revision:r+1,title:'Retained history',snapshot:{content:'Private revision body'}});
}
draftReads=0;const first=core.list(ctx,actor,'draft_revisions',{limit:20});assert.equal(first.total,10000);assert.equal(first.items.length,20);assert.ok(first.items.every(row=>!row.snapshot));assert.ok(draftReads<=2,`History reads must not scan parents per revision (${draftReads} parent reads)`);
for(const parent of parents)parent.collaborator_ids=[];
draftReads=0;assert.equal(core.list(ctx,actor,'draft_revisions').total,0,'Revocation invalidates the next read without any cross-request ACL cache');assert.ok(draftReads<=2);
parents[0].collaborator_ids=[actor.id];draftReads=0;const exported=core.export(ctx,actor);assert.equal(exported.collections.draft_revisions.length,100);assert.ok(draftReads<=3,'Export must resolve current parent ACL once, not once per historical revision');
console.log('PASS 20,000 retained revisions use bounded parent lookups, pagination excludes bodies, current grants are rechecked and export remains parent-authorized');
