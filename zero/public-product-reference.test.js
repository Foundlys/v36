'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),zlib=require('node:zlib'),crypto=require('node:crypto');
const {PublicProductCatalog}=require('../public-product-reference'),{productReferenceRows}=require('./product-reference-context');
const {fixture}=require('../zero-evaluation/fixture');
function tiny(t){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'foundly-product-reference-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const sets=[['products','PUBLIC_PRODUCT_REFERENCE',[{code:'12345678',product_name:'Fixture product',brands:'Fixture',countries_tags:['en:belgium']},{code:'00001234',product_name:'Other',brands:'Other',countries_tags:['en:netherlands']}]],['prices','PUBLIC_PRICE_OBSERVATION',[{id:1,product_code:'12345678',price:'1.250',currency:'EUR',date:'2024-01-03'},{id:2,product_code:'12345678',price:'1.300',currency:'EUR',date:'2025-01-03'},{id:3,product_code:'12345678',price:'1.999',currency:'USD',date:'2025-01-04'}]]];
  const sources=sets.map(([source_id,kind,rows])=>{const data=zlib.gzipSync(rows.map(JSON.stringify).join('\n')+'\n'),file=source_id+'.jsonl.gz';fs.writeFileSync(path.join(dir,file),data);return {source_id,kind,file,format:'jsonl.gz',records:rows.length,sha256:crypto.createHash('sha256').update(data).digest('hex'),license:'ODbL-1.0',source_url:'https://example.test/fixture',observed_at:'2026-09-26T19:00:00Z',attribution:'TEST FIXTURE'};});
  fs.writeFileSync(path.join(dir,'catalog-manifest.json'),JSON.stringify({schema_version:'foundly-public-product-catalog/1',snapshot_id:'fixture',sources}));
  return new PublicProductCatalog(dir);
}
test('product references keep barcode zeros, source authority and separate dated decimal prices without conversion or stock claims',t=>{
  const c=tiny(t);assert.equal(c.search({code:'00001234'}).results[0].product.code,'00001234');assert.equal(c.search({country:'BE'}).total,1);
  assert.equal(c.search({brand:'Fixture',q:'product'}).total,1);
  const page=c.prices({code:'12345678',currency:'EUR',from:'2025-01-01',limit:1});assert.equal(page.total,1);assert.equal(page.results[0].observation.price,'1.300');assert.equal(page.results[0].observation.currency,'EUR');assert.equal(page.live_inventory_verified,false);
  assert.equal(c.prices({code:'12345678'}).results[0].observation.currency,'USD');
  page.results[0].observation.price='999';assert.equal(c.prices({code:'12345678',currency:'EUR'}).results[0].observation.price,'1.300');
  assert.equal(page.results[0].provenance.customer_truth,false);assert.equal(page.results[0].provenance.authority,'PUBLIC_CONTRIBUTOR_CLAIM');
  for(const input of [{},{code:'../file'},{code:'12345678',from:'2025-02-30'},{code:'12345678',limit:101}])assert.throws(()=>c.prices(input),{statusCode:400});
});
test('modified public product bytes cannot become a partially trusted catalog',t=>{
  const c=tiny(t),file=path.join(c.directory,'products.jsonl.gz');fs.appendFileSync(file,'corrupt');assert.throws(()=>c.search(),{code:'product_reference_snapshot_integrity',statusCode:503});assert.throws(()=>c.search(),{code:'product_reference_snapshot_integrity'});
});
test('ZERO product context requires explicit product intent and current rights, and retains dated-source meaning',t=>{
  const c=tiny(t);let allowed=true;const composition={assertCapability(){if(!allowed)throw Object.assign(Error('disabled'),{statusCode:403,code:'capability_disabled'});}};
  const options={context:{},actor:{},composition,crm:{publicProductReferences:(_c,_a,i)=>c.search(i),publicProductPrices:(_c,_a,i)=>c.prices(i)}};
  const result=productReferenceRows({...options,query:'Wat weten we van product EAN 12345678?'});assert.equal(result.length,4);assert.ok(result.every(r=>r.provenance.source_class==='EXTERNAL_REFERENCE'&&!r.provenance.executable));
  assert.deepEqual(productReferenceRows({...options,query:'Factuur 12345678'}),[]);allowed=false;assert.deepEqual(productReferenceRows({...options,query:'EAN 12345678'}),[]);
  allowed=true;options.crm.publicProductPrices=()=>{allowed=false;return {results:[]};};assert.throws(()=>productReferenceRows({...options,query:'EAN 12345678'}),{code:'capability_disabled'});
});
test('actual HTTP product references are bounded native CRM reads and obey current capability revocation',async()=>{
  const s=await fixture();try{
    const route='/api/crm/product-reference?country=BE&limit=2';assert.equal((await s.request(route,'GET',undefined,'')).status,401);
    assert.equal((await s.request('/api/composition','PUT',{industry_id:'GENERAL',entitlements:['crm'],expected_revision:0})).status,200);
    const reader=await s.enroll('product.reference.viewer',['VIEWER']);const page=await s.request(route,'GET',undefined,reader.cookie);assert.equal(page.status,200,JSON.stringify(page.body));assert.equal(page.body.results.length,2);assert.ok(page.body.total>2);assert.equal(page.body.results[0].provenance.license,'ODbL-1.0');
    const prices=await s.request('/api/crm/product-reference/prices?code=3560070283484&currency=EUR&limit=1','GET',undefined,reader.cookie);assert.equal(prices.status,200,JSON.stringify(prices.body));assert.equal(prices.body.results.length,1);assert.equal(typeof prices.body.results[0].observation.price,'string');assert.equal(prices.body.live_inventory_verified,false);
    assert.equal((await s.request('/api/composition','PUT',{industry_id:'GENERAL',entitlements:['crm'],capability_flags:{'crm:relationships':false},expected_revision:1})).status,200);
    for(const url of [route,'/api/crm/product-reference/coverage','/api/crm/product-reference/prices?code=3560070283484']){const denied=await s.request(url,'GET',undefined,reader.cookie);assert.equal(denied.status,403);assert.equal(denied.body.code,'capability_disabled');}
  }finally{await s.close();}
});
