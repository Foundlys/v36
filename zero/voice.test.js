'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {LOCALES}=require('./contracts');const {voiceProfile,voiceInstructions}=require('./voice');
test('eight locale by two voice by three mode selections form 48 explicit lawful provider contracts',()=>{
 const selected=[];for(const language of LOCALES)for(const voice_gender of ['MALE','FEMALE'])for(const voice_mode of ['EXECUTIVE','CONVERSATIONAL','BRIEFING']){
  const p=voiceProfile({language,voice_gender,voice_mode},{});assert.equal(p.locale,language);assert.equal(p.voice,voice_gender==='MALE'?'cedar':'marin');assert.equal(p.quality_acceptance,'UNVERIFIED_REQUIRES_LISTENING');assert.ok(p.speed>0&&p.speed<=1);selected.push(p);
 }assert.equal(selected.length,48);assert.equal(voiceProfile({},{}).speed,.93);assert.ok(voiceProfile({language:'en-GB'},{}).accent.includes('British'));
});
test('voice configuration cannot silently use an unknown profile or claim naturalness from settings',()=>{
 assert.throws(()=>voiceProfile({}, {FOUNDLY_ZERO_MALE_VOICE:'unauthorized-clone'}),{code:'zero_voice_provider_profile_invalid'});
 const p=voiceProfile({voice_gender:'FEMALE',language:'fr-FR'},{}),text=voiceInstructions(p,{preferred_address:'Quoted user data'},'Europe/Paris');assert.ok(text.includes('fr-FR'));assert.ok(text.includes('spoken_text'));assert.ok(text.includes('completed user transcription'));
});
