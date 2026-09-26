'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {fixture}=require('../zero-evaluation/fixture'),{MODULES}=require('../module-catalog');
for(const industry of ['AUTOMOTIVE','ECOMMERCE'])test(industry+' ordinary pressure/correction phrases stay in the conversation while explicit clock/weather requests retain native routing',async()=>{
 const f=await fixture();try{
  await f.request('/api/composition','PUT',{industry_id:industry,entitlements:Object.keys(MODULES),expected_revision:0});
  const user=await f.enroll('social.routing'),conversation_id=crypto.randomUUID(),turn=message=>f.request('/api/zero/turn','POST',{message,conversation_id,turn_id:crypto.randomUUID()},user.cookie);
  for(const message of ['Ik heb weinig tijd en ben gefrustreerd. Help me mijn prioriteiten te bepalen.','Ik baal dat dit weer gebeurt. Help me rustig nadenken.','Correctie: we hebben hier twee uur aan besteed. Geef weer een kort antwoord.']){
   const r=await turn(message);assert.equal(r.status,200,JSON.stringify(r.body));assert.ok(!['current_time','current_weather'].includes(r.body.intent));assert.notEqual(r.body.verification?.reason,'location_missing');assert.equal(r.body.verification?.server_clock,undefined);assert.equal(r.body.verification?.model_available,false);assert.equal(r.body.status,'partial');
  }
  const clock=await turn('Hoe laat is het in New York?');assert.equal(clock.status,200);assert.equal(clock.body.verification.server_clock,true);assert.equal(clock.body.timezone,'America/New_York');
  const weather=await turn('Hoe is het weer?');assert.equal(weather.status,200);assert.equal(weather.body.status,'needs_input');assert.equal(weather.body.verification.reason,'location_missing');
 }finally{await f.close();}
});
