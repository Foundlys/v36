'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {fixture,reserve,advance}=require('../zero-evaluation/demo-universe-fixture');
const {MANIFESTS,SCOPE}=require('../demo-universe-engine'),L=require('../demo-universe-law');
const copy=v=>JSON.parse(JSON.stringify(v));
test('validated retained manifests cannot be changed in place while native data remains writable',()=>{
 const f=fixture();let row=reserve(f);row=advance(f,row,1);
 const graph=f.adapter.bucket(f.ctx,MANIFESTS)[0];
 for(const value of [graph,graph.nodes,graph.nodes[0],graph.nodes[0].input,graph.nodes[0].depends_on,graph.nodes[0].provenance,graph.derived,graph.scenarios])assert.equal(Object.isFrozen(value),true);
 assert.throws(()=>{graph.nodes[1].input.name='Unreviewed replacement';},TypeError);
 assert.throws(()=>{graph.nodes.push(copy(graph.nodes[0]));},TypeError);
 const company=f.adapter.bucket(f.ctx,'crm:companies')[0];assert.equal(Object.isFrozen(company),false);
 assert.equal(f.crm.update(f.ctx,f.actor,'companies',company.id,{name:'Actual source changed'},{expectedRevision:1}).revision,2);
 assert.throws(()=>advance(f,row),{code:'demo_dependency_changed'});
});
test('replacing a validated manifest triggers fresh integrity validation before another native effect',()=>{
 const f=fixture();let row=reserve(f);row=advance(f,row,1);
 const graphs=f.adapter.bucket(f.ctx,MANIFESTS),replacement=copy(graphs[0]);replacement.nodes[1].input.name+=' Unconfirmed alteration';graphs[0]=replacement;
 assert.throws(()=>advance(f,row,1),{code:'demo_manifest_fingerprint_invalid'});
 assert.equal(f.adapter.bucket(f.ctx,SCOPE)[0].cursor,1);assert.equal(f.adapter.bucket(f.ctx,'crm:companies').length,1);assert.equal(Object.isFrozen(replacement),false);
});
test('repeated immutable reads reuse Law validation but fresh restored objects are independently checked',()=>{
 const f=fixture(),row=reserve(f),stored=f.adapter.bucket(f.ctx,SCOPE)[0],original=L.validate;let calls=0;
 try{
  L.validate=m=>{calls++;return original(m);};
  const first=f.engine.reservedManifest(f.ctx,stored);for(let n=0;n<10;n++)assert.equal(f.engine.reservedManifest(f.ctx,stored),first);
  assert.equal(calls,1);
  f.adapter.bucket(f.ctx,MANIFESTS)[0]=copy(first);f.engine.reservedManifest(f.ctx,stored);assert.equal(calls,2);
  f.adapter.persist();Object.assign(f,f.restart());
  const restored=f.adapter.bucket(f.ctx,MANIFESTS)[0];assert.equal(Object.isFrozen(restored),false);
  f.engine.reservedManifest(f.ctx,f.adapter.bucket(f.ctx,SCOPE)[0]);assert.equal(calls,3);assert.equal(Object.isFrozen(restored.nodes[0].input),true);
  assert.equal(f.engine.get(f.ctx,f.actor,row.id).applied_nodes,0);
 }finally{L.validate=original;}
});
test('immutable reuse still checks reservation binding and freshly revoked native authority',()=>{
 const f=fixture();let row=reserve(f);row=advance(f,row,1);const stored=f.adapter.bucket(f.ctx,SCOPE)[0];
 stored.node_count++;assert.throws(()=>advance(f,row,1),{code:'demo_reserved_manifest_changed'});stored.node_count--;
 f.resolver.configure(f.ctx,f.actor,{industry_id:'AUTOMOTIVE',entitlements:['crm','procurement','sales','marketing','communication','calendar'],capability_flags:{'crm:companies':false},expected_revision:1});
 assert.throws(()=>advance(f,row,1),{code:'capability_disabled'});assert.equal(stored.cursor,1);assert.equal(f.adapter.bucket(f.ctx,'crm:companies').length,1);
});
