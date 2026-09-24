'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {VoiceTurns}=require('../zero-voice-turns');
test('actual client Realtime handlers wait for transcription and dispatch duplicate model calls only once',async()=>{
 const source=fs.readFileSync(path.join(__dirname,'../index-script.js'),'utf8'),sent=[],dispatched=[],ZERO={dc:{},handledCalls:new Set(),pendingCalls:new Set(),voiceTurns:new VoiceTurns(),preferences:{voice_enabled:false},audioScene:null};
 const context={ZERO,console,setTimeout,clearTimeout,JSON,Date,Map,Set,Error,$:()=>({textContent:''}),setZeroState(){},resetConversationTimer(){},realtimeSend:x=>sent.push(x),spokenText:r=>r.answer,executeZeroTurn:async(message,options)=>{dispatched.push({message,...options});return {ok:true,status:'completed',answer:'Done',actions:[],verification:{}};}};
 vm.runInNewContext(source.slice(source.indexOf('function realtimeFunctionCalls('),source.indexOf('function initialCommandState(')),context);
 context.handleRealtimeEvent({type:'input_audio_buffer.speech_started',item_id:'utterance'});
 context.handleRealtimeEvent({type:'response.created',response:{id:'response'}});
 const p=context.handleRealtimeToolCall({call_id:'model-call-one',response_id:'response',arguments:'{"message":"Bevestig"}'});assert.equal(dispatched.length,0);
 context.handleRealtimeEvent({type:'conversation.item.input_audio_transcription.completed',item_id:'utterance',transcript:'Maak een taak'});await p;
 await context.handleRealtimeToolCall({call_id:'model-call-two',response_id:'response',arguments:'{"message":"Maak nog een taak"}'});
 assert.equal(dispatched.length,1);assert.equal(dispatched[0].message,'Maak een taak');assert.equal(dispatched[0].turn_id,'voice:voice:utterance');assert.equal(sent.filter(x=>x.type==='conversation.item.create').length,2);
});
