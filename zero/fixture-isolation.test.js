'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {fixture}=require('../zero-evaluation/fixture');
test('parallel native HTTP fixtures own their listening port, reject collisions and retain authenticated state across restart',async()=>{
  const fixtures=[];
  try{
    await Promise.all([0,1].map(async()=>fixtures.push(await fixture())));
    const [a,b]=fixtures;assert.notEqual(a.base,b.base);assert.equal(a.env.PORT,'0');assert.equal(b.env.PORT,'0');
    assert.equal((await a.request('/api/zero/preferences')).status,200);assert.equal((await b.request('/api/zero/preferences')).status,200);
    assert.equal((await b.request('/api/zero/preferences','GET',undefined,null,{authorization:'Bearer '+a.env.FOUNDLY_ADMIN_TOKEN})).status,401);
    assert.equal((await a.request('/api/zero/preferences','PUT',{ui_locale:'fr-FR'})).status,200);
    assert.equal((await b.request('/api/zero/preferences')).body.preferences.ui_locale,'nl-NL');
    await assert.rejects(fixture({PORT:new URL(a.base).port}),/EADDRINUSE/);
    assert.equal((await a.request('/api/zero/preferences')).body.preferences.ui_locale,'fr-FR');
    await a.stop();await a.start();assert.ok(Number(new URL(a.base).port)>0);
    assert.equal((await a.request('/api/zero/preferences')).body.preferences.ui_locale,'fr-FR');
    assert.equal((await b.request('/api/zero/preferences')).body.preferences.ui_locale,'nl-NL');
  }finally{await Promise.all(fixtures.map(f=>f.close()));}
});
