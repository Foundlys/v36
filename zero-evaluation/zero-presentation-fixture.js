'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {browserFixture,Element}=require('../zero-evaluation/dom-fixture');
const source=fs.readFileSync(require.resolve('../index-script.js'),'utf8');
function extract(name){const match=new RegExp('(?:async )?function '+name+'\\(').exec(source);assert.ok(match,name);const rest=source.slice(match.index),end=rest.slice(match[0].length).search(/\n(?:async )?function /);return end<0?rest:rest.slice(0,match[0].length+end);}
// Controller fixture only: no browser, audio hardware or layout evidence.
class ViewElement extends Element{
  querySelectorAll(selector){return selector==='input,select'?this.all().slice(1).filter(node=>['input','select'].includes(node.tag)):super.querySelectorAll(selector);}
  constructor(tag='div'){super(tag);this.style={};const values=new Set();this.classList={add:v=>values.add(v),remove:v=>values.delete(v),contains:v=>values.has(v),toggle(v,on){if(on)values.add(v);else values.delete(v);}};}
}
function fixture(locale='en-GB'){
  const f=browserFixture(locale),events=[],audio=[],visual=[],requests=[],speeches=[],refreshes=[];
  for(const id of ['layer','layerBody','layerSmall','layerTitle','voiceState','listenText','mic','voicebar','command'])f.nodes[id]=new ViewElement();
  f.nodes.layer.classList.add('hidden');Object.defineProperty(f.nodes.voicebar,'dataset',{value:{}});
  f.context.document.createElement=tag=>new ViewElement(tag);f.context.document.querySelector=selector=>selector==='.voicebar'?f.nodes.voicebar:selector.startsWith('#')?f.nodes[selector.slice(1)]||null:null;
  const zero={enabled:true,realtimeConnected:true,clientRealtimeReported:false,preferences:{language:'da-DK',voice_mode:'CONVERSATION'},audioScene:{setState:state=>audio.push(state)}};
  Object.assign(f.context,{$:selector=>f.nodes[selector.slice(1)]||null,URL,ZERO:zero,neuralRuntime:{setState:state=>visual.push(state)},reportClientEvent:(...args)=>events.push(args),backendModule:id=>'native-'+id,conversationId:()=> 'canonical-conversation',randomId:()=> 'canonical-turn',isConfirmation:()=>false,resetConversationTimer(){},UICommandBus:{apply:async()=>{}},loadSystemStatus:async()=>refreshes.push('status'),refreshEvents:()=>refreshes.push('events'),requestRealtimeSpeech:(...args)=>speeches.push(args),FoundlySpeechFormatter:require('../speech-formatter'),fetch:async(path,options)=>{requests.push({path,options});return {ok:true,json:async()=>({ok:true,answer:'Literal model answer',status:'ok',ui_commands:[]})};}});
  const helpers=source.slice(source.indexOf('function zeroCopy('),source.indexOf("\nif($('#close'))",source.indexOf('function zeroCopy(')));
  const states=source.slice(source.indexOf('const ZERO_STATE_ALIAS='),source.indexOf('\nfunction audioSettings('));
  vm.runInContext(helpers+'\n'+states+'\n'+['safeResultUrl','showZeroResult','spokenText','initialCommandState','executeZeroTurn','startWakeListener'].map(extract).join('\n'),f.context);
  return {...f,i:f.context.FoundlyI18n,zero,events,audio,visual,requests,speeches,refreshes};
}
module.exports={fixture,ViewElement,extract};
