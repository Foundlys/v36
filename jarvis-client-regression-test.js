'use strict';

const assert=require('assert');
const fs=require('fs');
const vm=require('vm');
const {DoubleClapGate}=require('./jarvis-audio.js');

const clap={rms:.045,peak:.62,attack:.11,highRatio:.34};
const speech={rms:.24,peak:.39,attack:.05,highRatio:.2};

let gate=new DoubleClapGate();
assert.equal(gate.push(clap,1000).activated,false,'a single clap may not activate Jarvis');
assert.equal(gate.push(clap,1320).activated,true,'two valid transients inside the timing window must activate Jarvis');
assert.equal(gate.push(clap,1510).activated,false,'cooldown must reject an immediate third transient');

gate=new DoubleClapGate();
assert.equal(gate.push(clap,2000).activated,false);
assert.equal(gate.push(clap,2070).activated,false,'transients that are too close are one clap');
assert.equal(gate.push(clap,2450).activated,true,'a later second clap can complete the new pair');

gate=new DoubleClapGate();
assert.equal(gate.push(speech,3000).candidate,false,'ordinary speech-shaped energy may not count as a clap');
gate.suppress(1000,3100);
assert.equal(gate.push(clap,3300).reason,'suppressed','output playback must suppress wake detection');

const html=fs.readFileSync(__dirname+'/index.html','utf8');
const js=fs.readFileSync(__dirname+'/index-script.js','utf8');
const neural=fs.readFileSync(__dirname+'/neural-runtime.js','utf8');
const audio=fs.readFileSync(__dirname+'/zero-audio.js','utf8');
const server=fs.readFileSync(__dirname+'/server.js','utf8');
const ui=html+'\n'+js+'\n'+neural+'\n'+audio+'\n'+server;

for(const token of ['/speech-formatter.js','/neural-runtime.js','/zero-audio.js','initializeFoundly','FoundlyClapDetector','DoubleClapGate','FoundlyAudioScene','attachRemote','/api/zero/preferences','/api/zero/client-event','/api/dashboard/summary','requestFullscreen','setAutoQuality','REALTIME · CONVERSATION','spoken_text'])assert(ui.includes(token),`missing client contract: ${token}`);
for(const state of ['STANDBY','ACTIVATING','LISTENING','THINKING','SEARCHING','PLANNING','WAITING_TOOL','EXECUTING','WAITING_CONFIRMATION','VERIFYING','SPEAKING','SUCCESS','WARNING','ERROR','RECOVERING'])assert(ui.includes(state),`missing Jarvis state contract: ${state}`);
for(const id of ['initializeFoundly','settingsToggle','settingsClose','saveSettings','fullscreen','mic','send','microphoneEnabled','voiceEnabled','musicEnabled','sfxEnabled']){assert(html.includes(`id="${id}"`),`missing UI control ${id}`);assert(js.includes(`'${id}'`),`missing UI handler ${id}`)}
assert.equal((js.match(/async function connectRealtime\(/g)||[]).length,1,'there must be one authoritative Realtime client path');
assert(js.includes('preserve_state:true'));assert(js.includes('lastVoiceOutcome'));assert(js.includes('initialCommandState'));assert(js.includes("regions:globalThis.FOUNDLY_RUNTIME_PROFILE?.neural_regions"),'renderer must accept future auto-provisioned regional profiles without a rewrite');
assert(js.includes('initializeNeuralRuntime'));assert(js.includes("CLIENT_RUNTIME.renderer='FAILED_ISOLATED'"));assert(js.includes("CLIENT_RUNTIME.audio='FAILED_ISOLATED'"));assert(js.includes('CLIENT_RUNTIME.zero_handlers=status'));assert(js.includes('CLIENT_RUNTIME.jarvis_handlers=status'));
assert(!js.includes('if(Math.random()<.06&&links.length)'), 'visual activity may not be randomly fabricated');
assert(!/Yoo bro/i.test(ui));
assert(!/sk-[A-Za-z0-9_-]{12,}/.test(ui),'server credentials may not appear in client assets');

function startupContext({missing=[]}={}){
  const missingIds=new Set(missing);
  const elements=new Map(),storage=()=>{const values=new Map();return{getItem:key=>values.has(key)?values.get(key):null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)}};
  function element(id='node'){const listeners={};return{id,listeners,value:id==='visualQualitySelect'?'AUTO':id==='preferredAddress'?'Big Boss':'.62',checked:true,textContent:'',innerHTML:'',dataset:{},style:{setProperty(){},removeProperty(){}},classList:{add(){},remove(){},toggle(){},contains(){return false}},addEventListener(type,handler){(listeners[type]||(listeners[type]=[])).push(handler)},append(){},appendChild(){},replaceChildren(){},setAttribute(){},focus(){},scrollIntoView(){},animate(){},getContext(){return null}}}
  const get=id=>{if(missingIds.has(id))return null;if(!elements.has(id))elements.set(id,element(id));return elements.get(id)},document={hidden:false,body:element('body'),documentElement:element('documentElement'),querySelector(selector){if(selector.startsWith('#'))return get(selector.slice(1));if(selector==='.voicebar')return get('voicebar');return element(selector)},querySelectorAll(){return[]},getElementById:get,createElement:tag=>element(tag),addEventListener(){},exitFullscreen(){}};
  const track={stop(){},clone(){return{...track}}},stream={active:true,getTracks:()=>[track],getAudioTracks:()=>[track]};
  class Recognition{start(){this.started=true}stop(){this.started=false}abort(){this.started=false}}
  const context={document,navigator:{mediaDevices:{getUserMedia:async()=>stream},permissions:{query:async()=>({state:'granted'})}},location:{hostname:'production.example',search:'',pathname:'/'},history:{replaceState(){}},localStorage:storage(),sessionStorage:storage(),URL,URLSearchParams,Intl,Date,Math,JSON,Promise,Map,Set,Array,Object,String,Number,Boolean,RegExp,Error,TypeError,console,performance:{now:()=>1000},crypto:{randomUUID:()=>`turn-${'x'.repeat(20)}`},innerWidth:1920,innerHeight:1080,devicePixelRatio:1,isSecureContext:true,setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){},requestAnimationFrame:()=>1,cancelAnimationFrame(){},addEventListener(){},fetch:async()=>({ok:false,status:401,json:async()=>({})}),alert(){},prompt:()=>null,FoundlyNeuralRuntime:class{constructor(){throw new Error('injected shader failure')}},FoundlyAudioScene:class{constructor(){throw new Error('injected audio failure')}},FoundlyClapDetector:class{},FoundlySpeechFormatter:{sanitizeForSpeech:value=>String(value)},SpeechRecognition:Recognition,webkitSpeechRecognition:Recognition,CSS:{escape:String},MediaStream:class{constructor(tracks){this.tracks=tracks}getAudioTracks(){return this.tracks}},speechSynthesis:{cancel(){},getVoices(){return[]}}};
  context.window=context;context.globalThis=context;return{context,elements,get};
}

(async()=>{
  const {context,get}=startupContext();vm.runInNewContext(js,context,{filename:'index-script.js'});
  assert.equal(context.__FOUNDLY_CLIENT_RUNTIME.renderer,'FAILED_ISOLATED','a renderer failure must be contained');
  assert.equal(context.__FOUNDLY_CLIENT_RUNTIME.zero_handlers,'REGISTERED','ZERO handlers must register after renderer failure');
  for(const [id,event] of [['mic','click'],['initializeFoundly','click'],['send','click'],['command','keydown']])assert.equal(get(id).listeners[event]?.length,1,`${id} ${event} handler must remain registered`);
  await get('initializeFoundly').listeners.click[0]();
  assert.equal(context.__FOUNDLY_CLIENT_RUNTIME.audio,'FAILED_ISOLATED','an audio startup failure must be contained');
  assert.equal(get('voiceState').textContent,'STANDBY','ZERO must still reach standby after an audio subsystem failure');
  const sparse=startupContext({missing:['mainCount','subCount','linkCount','legend','close','resetView','settingsToggle','settingsClose','saveSettings','masterVolume','voiceVolume','ambienceVolume','sfxVolume','audioMuted','voiceEnabled','musicEnabled','sfxEnabled','wakeEnabled','clapEnabled','clapSensitivity','visualQualitySelect','microphoneEnabled']});vm.runInNewContext(js,sparse.context,{filename:'index-script-sparse-layout.js'});assert.equal(sparse.context.__FOUNDLY_CLIENT_RUNTIME.zero_handlers,'REGISTERED','optional HUD edits may not prevent authoritative ZERO handlers');for(const [id,event] of [['mic','click'],['initializeFoundly','click'],['send','click'],['command','keydown']])assert.equal(sparse.get(id).listeners[event]?.length,1,`${id} ${event} must survive a sparse HUD layout`);
  console.log(JSON.stringify({ok:true,version:'6.0.0',double_clap_gate:'pass',standby_privacy:'contract_pass',single_realtime_pipeline:'pass',renderer_failure_isolated:'pass',audio_failure_isolated:'pass',jarvis_handlers_after_failure:'pass',runtime_bound_visuals:'pass',fake_activity_removed:'pass'},null,2));
})().catch(error=>{console.error(error);process.exitCode=1});
