'use strict';
const test=require('node:test'),assert=require('node:assert/strict');const {fixture}=require('../zero-evaluation/fixture');
test('actual per-user interface locale is independent of ZERO language, survives restart and never changes another member',async()=>{
 const f=await fixture();try{
  for(const asset of ['/foundly-static-copy.js','/foundly-locales.js','/foundly-i18n.js','/identity-login.js'])assert.equal((await f.request(asset,'GET',undefined,'')).status,200);
  await f.request('/api/composition','PUT',{entitlements:['automation'],expected_revision:0});const alice=await f.enroll('locale.alice'),bob=await f.enroll('locale.bob');
  const a=(path,method,body)=>f.request(path,method,body,alice.cookie);let r=await a('/api/zero/preferences','PUT',{ui_locale:'fr-FR',language:'de-DE'});assert.equal(r.status,200);assert.equal(r.body.preferences.ui_locale,'fr-FR');assert.equal(r.body.preferences.language,'de-DE');
  assert.equal((await f.request('/api/zero/preferences','GET',undefined,bob.cookie)).body.preferences.ui_locale,'nl-NL');assert.equal((await a('/api/zero/preferences','PUT',{ui_locale:'xx-XX'})).status,400);
  for(const [cookie,locale]of [[alice.cookie,'fr-FR'],[bob.cookie,'nl-NL']]){const response=await fetch(f.base+'/',{headers:{cookie},redirect:'manual'});assert.equal(response.status,200);assert.match(await response.text(),new RegExp('<html lang="'+locale+'"'));assert.equal(response.headers.get('cache-control'),'no-store');}
  await f.stop();await f.start();r=await a('/api/zero/preferences');assert.equal(r.body.preferences.ui_locale,'fr-FR');assert.equal(r.body.preferences.language,'de-DE');
 }finally{await f.close();}
});
