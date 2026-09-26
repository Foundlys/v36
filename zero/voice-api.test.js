'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),os=require('node:os');
const {fixture}=require('../zero-evaluation/fixture');
const override={OPENAI_API_KEY:'voice-contract-fixture',NODE_OPTIONS:'--require='+path.resolve(__dirname,'../zero-evaluation/voice-provider-fixture.js')};
test('real session API binds own voice/mode/locale preferences without claiming listening acceptance',async()=>{
 const f=await fixture(override);try{
  await f.request('/api/composition','PUT',{entitlements:['communication'],expected_revision:0});const alice=await f.enroll('voice.alice');
  for(const voice_gender of ['MALE','FEMALE'])for(const voice_mode of ['EXECUTIVE','CONVERSATIONAL','BRIEFING']){
   await f.request('/api/zero/preferences','PUT',{language:'en-GB',voice_gender,voice_mode},alice.cookie);
   const r=await f.request('/api/zero/realtime/client-secret','POST',{},alice.cookie);assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.body.session.voice,voice_gender==='MALE'?'cedar':'marin');assert.equal(r.body.voice_profile.mode,voice_mode);assert.equal(r.body.voice_profile.locale,'en-GB');assert.equal(r.body.voice_profile.quality_acceptance,'UNVERIFIED_REQUIRES_LISTENING');
  }
  for(const route of ['/zero-voice-turns.js','/zero-confirmation.js'])assert.equal((await f.request(route)).status,200);
 }finally{await f.close();}
});
test('revocation during Realtime credential creation prevents releasing even the ephemeral credential',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'zero-voice-revoke-')),marker=path.join(dir,'barrier'),f=await fixture({...override,ZERO_EVALUATION_VOICE_BARRIER:marker});
 try{
  await f.request('/api/composition','PUT',{entitlements:['communication'],expected_revision:0});const alice=await f.enroll('voice.revoked');
  const pending=f.request('/api/zero/realtime/client-secret','POST',{},alice.cookie);
  for(let i=0;i<200&&!fs.existsSync(marker+'.started');i++)await new Promise(r=>setTimeout(r,10));assert.ok(fs.existsSync(marker+'.started'));
  await f.request('/api/identity/users/'+alice.member.id,'PUT',{roles:['VIEWER'],expected_revision:alice.member.revision,confirm:true,reason:'Revoke during provider credential creation'});
  fs.writeFileSync(marker+'.release','release');const r=await pending;assert.equal(r.status,401);assert.ok(!JSON.stringify(r.body).includes('isolated-ephemeral-fixture'));
 }finally{await f.close();fs.rmSync(dir,{recursive:true,force:true});}
});
