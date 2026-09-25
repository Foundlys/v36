'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{TenantIdentities}=require('../tenant-identities');
function fixture(){const rows=new Map();let clock=new Date('2026-09-25T00:00:00Z');const adapter={bucket(ctx,scope){const key=JSON.stringify([ctx,scope]);if(!rows.has(key))rows.set(key,[]);return rows.get(key);},persist(){},audit(){},encrypted:()=>true,composed:()=>true,now:()=>clock};return {adapter,identities:new TenantIdentities(adapter),advance(){clock=new Date(clock.getTime()+25*3600000);}};}
const actor={id:'receipt_guard_admin',roles:['SUPER_ADMIN']},input={username:'receipt.guard',display_name:'Literal receipt guard',roles:['VIEWER'],confirm:true,reason:'Isolated receipt guards'};
test('identity receipt lookup and replay preserve tenant, actor and live invitation validity boundaries',()=>{
 const f=fixture(),a={tenant_id:'receipt_a',dealer_id:'default'},b={tenant_id:'receipt_b',dealer_id:'default'},key='identity-guard-request';
 const first=f.identities.invite(a,actor,input,key);assert.throws(()=>f.identities.request(b,actor,key),{code:'identity_request_missing'});assert.throws(()=>f.identities.request(a,{...actor,id:'other_admin'},key),{code:'identity_request_missing'});
 const other=f.identities.invite(b,actor,input,key);assert.notEqual(first.member.id,other.member.id);assert.notEqual(first.invite_token,other.invite_token);assert.deepEqual(f.identities.request(a,actor,key),first);
 f.advance();assert.throws(()=>f.identities.request(a,actor,key),{code:'identity_request_superseded'});assert.throws(()=>f.identities.invite(a,actor,input,key),{code:'identity_request_superseded'});assert.equal(f.identities.list(a,actor).items.length,1);
 const renewed=f.identities.reissue(a,actor,first.member.id,{confirm:true,expected_revision:1,reason:'Reviewed expired invitation'},'identity-renewed-request');assert.equal(renewed.member.revision,2);assert.notEqual(renewed.invite_token,first.invite_token);assert.throws(()=>f.identities.invitation(a,first.invite_token),{code:'identity_invitation_invalid'});
});
test('receipt capacity refuses new effects while preserving existing recovery and typed input validation',()=>{
 const f=fixture(),ctx={tenant_id:'receipt_capacity',dealer_id:'default'},key='identity-retained-request',first=f.identities.invite(ctx,actor,input,key),receipts=f.adapter.bucket(ctx,'identity:mutation_receipts');
 for(let n=1;n<10000;n++)receipts.push({request_id:'other-request-'+n,actor_id:'other_actor'});
 assert.deepEqual(f.identities.invite(ctx,actor,input,key),first);assert.throws(()=>f.identities.invite(ctx,actor,{...input,username:'capacity.blocked'},'identity-capacity-request'),{code:'identity_request_capacity'});assert.equal(f.identities.list(ctx,actor).items.length,1);assert.equal(receipts.length,10000);
 const fresh={tenant_id:'receipt_invalid',dealer_id:'default'};assert.throws(()=>f.identities.invite(fresh,actor,{...input,display_name:{nested:{untrusted:true}}},'identity-invalid-request'),{code:'identity_name_required'});assert.equal(f.identities.list(fresh,actor).items.length,0);assert.equal(f.adapter.bucket(fresh,'identity:mutation_receipts').length,0);
});
test('recovery closes an absent request atomically and delayed original writes cannot create a user afterward',()=>{
 const f=fixture(),ctx={tenant_id:'receipt_cancelled',dealer_id:'default'},key='identity-cancelled-request',review={operation:'INVITE',target_id:null,expected_revision:0,confirm:true};
 const result=f.identities.recover(ctx,actor,key,review);assert.equal(result.status,'NOT_APPLIED');assert.equal(result.operation,'INVITE');assert.equal(result.actor_id,actor.id);assert.deepEqual(f.identities.recover(ctx,actor,key,review),result);assert.deepEqual(f.identities.request(ctx,actor,key),result);assert.throws(()=>f.identities.invite(ctx,actor,input,key),{code:'identity_request_abandoned'});assert.equal(f.identities.list(ctx,actor).items.length,0);
 assert.throws(()=>f.identities.recover(ctx,actor,'invalid-review-request',{...review,confirm:'true'}),{code:'identity_recovery_invalid'});
 const committed=f.identities.invite(ctx,actor,input,'identity-committed-request');assert.deepEqual(f.identities.recover(ctx,actor,'identity-committed-request',review),committed);assert.equal(f.identities.list(ctx,actor).items.length,1);
});
