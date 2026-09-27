'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {FoundlyPlatformCore}=require('../platform-core'),{buildSourceRegistry}=require('../foundly-registry'),{fixture}=require('../zero-evaluation/fixture');
const ctx={tenant_id:'knowledge-observation',dealer_id:'default'},admin={id:'admin',roles:['ADMIN']},reader={id:'reader',roles:['VIEWER']};
const input=(extra={})=>({type:'OBSERVATION',subject:'Observed source',predicate:'has_observation',value:'Literal record',permissions:{roles:['VIEWER']},...extra});
function core(){const rows=new Map();return new FoundlyPlatformCore({bucket:(c,name)=>{const key=c.tenant_id+':'+c.dealer_id+':'+name;if(!rows.has(key))rows.set(key,[]);return rows.get(key);}});}
test('source registry preserves unknown and explicit zero counts without falling through to another count',()=>{
 for(const value of [undefined,null,'',-1,.5,Number.MAX_SAFE_INTEGER+1]){const rows=buildSourceRegistry({internalCounts:{foundly_knowledge:value}});assert.equal(rows.find(row=>row.source_id==='foundly_knowledge').records_available,null);}
 const connector={connector_id:'observed',name:'Observed',category:[],capabilities:[],auth_type:'PUBLIC',records:19,credential_contract:{}};
 assert.equal(buildSourceRegistry({connectors:[connector],recordsBySource:{observed:0}}).find(row=>row.source_id==='observed').records_available,0);
 assert.equal(buildSourceRegistry({internalCounts:{foundly_knowledge:0}}).find(row=>row.source_id==='foundly_knowledge').records_available,0);
});
test('native knowledge preserves missing confidence and real zero as different observations',()=>{
 const p=core();for(const value of [undefined,null,''])assert.equal(p.createKnowledge(ctx,admin,input({confidence:value})).confidence,null);
 assert.equal(p.createKnowledge(ctx,admin,input({confidence:0})).confidence,0);
});
test('native knowledge rejects invalid confidence before changing records or audit',()=>{
 const p=core();for(const value of [-.1,1.1,'0.8',false,{},[]])assert.throws(()=>p.createKnowledge(ctx,admin,input({confidence:value})),error=>error.code==='knowledge_confidence_invalid');
 assert.equal(p.searchKnowledge(ctx,admin,{current:false}).total,0);assert.equal(p.bucket(ctx,'audit').length,0);
});
test('knowledge source access honors explicit current user grants without bypassing record restrictions',()=>{
 const p=core();p.createKnowledge(ctx,admin,input({permissions:{roles:['ADMIN'],user_ids:['reader']}}));p.createKnowledge(ctx,admin,input({subject:'Private',permissions:{roles:['ADMIN'],user_ids:['other']}}));
 const visible=p.searchKnowledge(ctx,reader,{current:false});assert.equal(visible.total,1);assert.equal(visible.items[0].subject,'Observed source');
});
test('knowledge export shares current record grants and requires native source-read permission',()=>{
 const p=core(),exporter={...reader,permissions:['export:run']};p.createKnowledge(ctx,admin,input({permissions:{roles:['ADMIN'],user_ids:['reader']}}));p.createKnowledge(ctx,admin,input({subject:'Private',permissions:{roles:['ADMIN']}}));
 const exported=p.export(ctx,exporter,'knowledge');assert.equal(exported.count,1);assert.equal(exported.records[0].subject,'Observed source');
 assert.throws(()=>p.export(ctx,{id:'bare-exporter',roles:[],permissions:['export:run']},'knowledge'),error=>error.code==='platform_forbidden');
});
test('native source registry counts only current-authorized retained knowledge through encrypted restart',async()=>{
 const f=await fixture();try{
  assert.equal((await f.request('/api/composition','PUT',{entitlements:[],expected_revision:0})).status,200);const member=await f.enroll('source-knowledge-reader',['VIEWER']);
  for(const record of [input(),input({subject:'Expired but retained',expires_at:'2000-01-01T00:00:00Z'}),input({subject:'PRIVATE hidden knowledge',permissions:{roles:['ADMIN']}})])assert.equal((await f.request('/api/knowledge/records','POST',record)).status,201);
  for(let pass=0;pass<2;pass++){
   const native=await f.request('/api/knowledge/records?current=false','GET',undefined,member.cookie);assert.equal(native.status,200,JSON.stringify(native.body));assert.equal(native.body.total,2);
   const source=await f.request('/api/source-registry/foundly_knowledge','GET',undefined,member.cookie);assert.equal(source.status,200,JSON.stringify(source.body));assert.equal(source.body.source.records_available,native.body.total);assert.equal(source.body.source.records_scope,'CURRENT_AUTHORIZED_RETAINED_RECORDS');
   assert.equal((await f.request('/api/source-registry/foundly_knowledge')).body.source.records_available,3);
   if(!pass){await f.stop();await f.start();}
  }
 }finally{await f.close();}
});
test('native knowledge workspace never turns absent confidence into a measured zero',async()=>{
 const f=await fixture();try{assert.equal((await f.request('/api/knowledge/records','POST',input())).status,201);const r=await f.request('/api/workspaces/knowledge/snapshot');assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.body.metrics.average_confidence.value,null);assert.equal(r.body.metrics.average_confidence.available,false);}finally{await f.close();}
});
test('native knowledge workspace aggregates all authorized lifecycle records beyond its bounded preview',async()=>{
 const f=await fixture();try{
  for(let n=0;n<101;n++)assert.equal((await f.request('/api/knowledge/records','POST',input({subject:'Source '+n,confidence:.8,sources:[{source_id:'observed'}]}))).status,201);
  const old=await f.request('/api/knowledge/records','POST',input({subject:'Superseded source',confidence:.4}));assert.equal(old.status,201);
  assert.equal((await f.request('/api/knowledge/records','POST',input({subject:'Replacement source',supersedes:old.body.knowledge_id,confidence:.8,sources:[{source_id:'observed'}]}))).status,201);
  assert.equal((await f.request('/api/knowledge/records','POST',input({subject:'Expired source',confidence:.2,expires_at:'2000-01-01T00:00:00Z'}))).status,201);
  assert.equal((await f.request('/api/knowledge/records','POST',input({subject:'Unknown confidence',sources:[{source_id:'observed'}]}))).status,201);
  const r=await f.request('/api/workspaces/knowledge/snapshot');assert.equal(r.status,200,JSON.stringify(r.body));const {metrics:m,details:d}=r.body;
  assert.equal(m.current_records.value,103);assert.equal(m.stale_records.value,1);assert.equal(m.superseded_records.value,1);assert.equal(m.knowledge_records.value,105);assert.equal(m.average_confidence.value,80);assert.equal(m.evidence_coverage.value,100);assert.equal(m.knowledge_sources.value,1);
  assert.equal(r.body.rows.length,100);assert.equal(d.coverage.retained_records,105);assert.equal(d.coverage.current_records,103);assert.equal(d.coverage.preview_records,100);assert.equal(d.coverage.preview_complete,false);assert.equal(d.coverage.aggregate_complete,true);assert.equal(d.coverage.confidence_records,102);
 }finally{await f.close();}
});
