'use strict';

const assert=require('assert');
const fs=require('fs');
const {sanitizeForSpeech,formatJarvisResponse}=require('./speech-formatter');
const {FoundlyAudioScene,DoubleClapGate}=require('./jarvis-audio');
const {QUALITY,MODULE_INDEX}=require('./neural-runtime');

const cases=new Map([
  ['**Hallo**','Hallo'],
  ['*Hallo*','Hallo'],
  ['# Hallo','Hallo'],
  ['`Hallo`','Hallo'],
  ['- eerste\n- tweede','eerste. tweede'],
  ['[Foundly](https://foundly.example)','Foundly'],
  ['€5.250','vijfduizend tweehonderd vijftig euro'],
  ['12,4%','twaalf komma vier procent'],
  ['09:30','negen uur dertig'],
  ['2021','tweeduizend eenentwintig'],
  ['25 km','vijfentwintig kilometer'],
  ['BMW X5','bee em wee iks vijf'],
  ['BMW X5 xDrive45e','bee em wee iks vijf iks drive vijfenveertig ee']
]);
for(const [input,expected] of cases)assert.equal(sanitizeForSpeech(input),expected,`speech normalization failed for ${input}`);
for(const input of cases.keys())assert(!/[*_`#<>\[\]{}|]/.test(sanitizeForSpeech(input)),`speech still contains presentation syntax: ${input}`);
const formatted=formatJarvisResponse('**Marge:** €5.250 bij 12,4%.');
assert.equal(formatted.display_text,'**Marge:** €5.250 bij 12,4%.','display text must remain intact');
assert.equal(formatted.spoken_text,'Marge: vijfduizend tweehonderd vijftig euro bij twaalf komma vier procent.');

const audioScene=new FoundlyAudioScene();
audioScene.setSettings({master:.6,voice:.7,music:.45,sfx:.2,voiceEnabled:false,musicEnabled:true,sfxEnabled:false,muted:false});
assert.equal(audioScene.settings.master,.6);assert.equal(audioScene.settings.voice,.7);assert.equal(audioScene.settings.music,.45);assert.equal(audioScene.settings.sfx,.2);assert.equal(audioScene.settings.voiceEnabled,false);assert.equal(audioScene.settings.musicEnabled,true);assert.equal(audioScene.settings.sfxEnabled,false);
assert.equal(audioScene.diagnostics().audio_context_state,'uninitialized');
const gate=new DoubleClapGate();gate.suppress(500,1000);assert.equal(gate.push({rms:.05,peak:.8,attack:.2,highRatio:.5,outputLevel:.7},1200).reason,'suppressed');

assert.equal(QUALITY.length,4);assert(QUALITY[0].particles>=600);assert(QUALITY.at(-1).particles>=2600);assert(QUALITY.at(-1).filaments>=140);assert.equal(MODULE_INDEX.social_media,MODULE_INDEX.social);assert.equal(MODULE_INDEX.google_ads,MODULE_INDEX.google);

const html=fs.readFileSync(__dirname+'/index.html','utf8'),client=fs.readFileSync(__dirname+'/index-script.js','utf8'),audio=fs.readFileSync(__dirname+'/jarvis-audio.js','utf8'),neural=fs.readFileSync(__dirname+'/neural-runtime.js','utf8'),server=fs.readFileSync(__dirname+'/server.js','utf8'),ui=html+'\n'+client;
const formatterIndex=html.indexOf('/speech-formatter.js'),clientIndex=html.indexOf('/index-script.js');assert(formatterIndex>=0&&formatterIndex<clientIndex,'speech formatter must load before the Jarvis client');
for(const id of ['businessPanels','panelInventory','panelLeads','panelCrm','panelTasks','panelRecords','panelProviders','liveSourceList','microphoneEnabled','voiceEnabled','musicEnabled','sfxEnabled','audioContextStatus','audioOutputStatus','musicStatus','duckingStatus','micPermissionStatus','voiceOutputStatus'])assert(html.includes(`id="${id}"`),`missing production HUD/control ${id}`);
for(const token of ['buildOriginalSoundscape','musicDuck','outputAnalyser','voiceAnalyser','canDetectWake','musicEnabled','voiceEnabled','sfxEnabled'])assert(audio.includes(token),`missing audio contract ${token}`);
for(const token of ['particlePositions','filamentPositions','cubic(','prefers-reduced-motion','onMetrics','routeEnergy','requestAnimationFrame'])assert(neural.includes(token),`missing neural renderer contract ${token}`);
assert(!neural.includes('Math.random('),'visual topology must be deterministic and may not fabricate runtime activity');
assert(client.includes("fetch('/api/dashboard/summary')"));assert(server.includes("u.pathname==='/api/dashboard/summary'"));assert(client.includes('spokenText(result)'));assert(client.includes('spoken_text:spokenText(result)'));assert(!client.includes('fallbackSpeak(j.answer)'));assert(!client.includes('requestRealtimeSpeech(j.answer'));
assert(!ui.includes('ScreenRecording_'),'reference media may not be shipped or replayed');assert(!ui.includes('.mp4'),'reference audio may not be copied into the product');

class FakeParam{constructor(value=0){this.value=value}setTargetAtTime(value){this.value=value}setValueAtTime(value){this.value=value}exponentialRampToValueAtTime(value){this.value=value}}
class FakeNode{constructor(){this.gain=new FakeParam();this.frequency=new FakeParam();this.Q=new FakeParam();this.pan=new FakeParam();this.threshold=new FakeParam();this.knee=new FakeParam();this.ratio=new FakeParam();this.attack=new FakeParam();this.release=new FakeParam();this.started=false}connect(target){this.target=target;return target}disconnect(){}start(){this.started=true}stop(){this.started=false}getByteFrequencyData(values){values.fill(0)}getFloatTimeDomainData(values){values.fill(0)}}
class FakeAudioContext{constructor(){this.state='suspended';this.currentTime=0;this.sampleRate=48000;this.destination=new FakeNode()}createGain(){return new FakeNode()}createAnalyser(){const node=new FakeNode();node.fftSize=512;node.frequencyBinCount=256;return node}createDynamicsCompressor(){return new FakeNode()}createBiquadFilter(){return new FakeNode()}createOscillator(){return new FakeNode()}createStereoPanner(){return new FakeNode()}createBuffer(channels,length){const data=Array.from({length:channels},()=>new Float32Array(length));return{getChannelData:index=>data[index]}}createBufferSource(){return new FakeNode()}async resume(){this.state='running'}async close(){this.state='closed'}}

(async()=>{
  const originalContext=globalThis.AudioContext,originalFrame=globalThis.requestAnimationFrame,originalCancel=globalThis.cancelAnimationFrame;
  globalThis.AudioContext=FakeAudioContext;globalThis.requestAnimationFrame=()=>1;globalThis.cancelAnimationFrame=()=>{};
  try{const initialized=new FoundlyAudioScene();assert.equal(await initialized.initialize(),true);assert.equal(initialized.ready,true);assert.equal(initialized.outputUnlocked,true);assert.equal(initialized.oscillators.length,4);assert(initialized.oscillators.every(row=>row.oscillator.started));assert.equal(initialized.noise.source.started,true);assert.equal(initialized.diagnostics().music_playing,true);initialized.setUserSpeaking(true);assert.equal(initialized.diagnostics().ducking_active,true);initialized.setJarvisSpeaking(true);assert.equal(initialized.canDetectWake(),false);initialized.dispose()}
  finally{if(originalContext===undefined)delete globalThis.AudioContext;else globalThis.AudioContext=originalContext;if(originalFrame===undefined)delete globalThis.requestAnimationFrame;else globalThis.requestAnimationFrame=originalFrame;if(originalCancel===undefined)delete globalThis.cancelAnimationFrame;else globalThis.cancelAnimationFrame=originalCancel}
  console.log(JSON.stringify({ok:true,version:'5.2.0',speech_plain_text:'pass',dutch_normalization:'pass',display_speech_separation:'pass',audio_buses:'pass',soundscape_initialization:'pass',output_wake_suppression:'pass',adaptive_gpu_density:'pass',deterministic_visual_topology:'pass',real_dashboard_summary:'pass'},null,2));
})().catch(error=>{console.error(error);process.exitCode=1});
