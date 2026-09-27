'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {VoiceTurns}=require('../zero-voice-turns');
test('a complete actual transcription, rather than model arguments, supplies one stable native turn',async()=>{
 const turns=new VoiceTurns({session:'session-one'});turns.start('item-one');turns.response('response-one');let calls=0;
 const dispatch=async data=>{calls++;assert.equal(data.message,'Maak een taak');return data.turn_id;};
 const first=turns.execute({response_id:'response-one',call_id:'one',arguments:'{"message":"Bevestig"}'},dispatch);
 const second=turns.execute({response_id:'response-one',call_id:'two'},dispatch);assert.equal(calls,0);turns.transcript('item-one','Maak een taak');
 assert.equal(await first,'voice:session-one:item-one');assert.equal(await second,await first);assert.equal(calls,1);
});
test('barge-in rejects an incomplete previous utterance and delayed old model calls',async()=>{
 const t=new VoiceTurns();t.start('first');t.response('response-first');let calls=0;const pending=t.execute({response_id:'response-first'},()=>calls++);
 t.start('second');await assert.rejects(pending,{code:'voice_utterance_interrupted'});assert.equal(t.transcript('first','Bevestig'),false);
 await assert.rejects(t.execute({response_id:'response-first'},()=>calls++),{code:'voice_utterance_unavailable'});assert.equal(calls,0);
});
test('a missing transcript cannot become an approval and uncertain transport cannot duplicate execution',async()=>{
 const t=new VoiceTurns({timeout_ms:10});t.start('first');t.response('response-first');let calls=0;
 await assert.rejects(t.execute({response_id:'response-first',arguments:'{"message":"confirm"}'},()=>calls++),{code:'voice_transcript_unavailable'});assert.equal(calls,0);
 t.start('second');t.response('response-second');t.transcript('second','Create a task');const dispatch=()=>{calls++;throw Error('connection lost');};
 await assert.rejects(t.execute({response_id:'response-second'},dispatch),/connection lost/);await assert.rejects(t.execute({response_id:'response-second'},dispatch),/connection lost/);assert.equal(calls,1);
});
