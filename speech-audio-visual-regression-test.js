'use strict';

const assert=require('assert');
const fs=require('fs');
const {sanitizeForSpeech,formatJarvisResponse}=require('./speech-formatter');
const {FoundlyAudioScene,DoubleClapGate,SOUNDTRACK_STATE}=require('./jarvis-audio');
const {QUALITY,MODULE_INDEX,REGIONS,STATE_VISUALS,ENERGY_CYCLE_SECONDS,ROTATION_SECONDS,FOV_DEGREES,createGeometry,normalizeRegions,cameraAt,viewProjection,motionPhaseAt,nextQualityIndex}=require('./neural-runtime');

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
  ['BMW X5 xDrive45e','bee em wee iks vijf iks drive vijfenveertig ee'],
  ['<strong>Deal</strong> &amp; **klaar**','Deal en klaar'],
  ['Bekijk https://foundly.example/path?q=1','Bekijk een webadres'],
  ['09-03-2026','negen maart tweeduizend zesentwintig'],
  ['\\*geen markup\\*','geen markup'],
  ['## [Titel](/interne-route)','Titel']
]);
for(const [input,expected] of cases)assert.equal(sanitizeForSpeech(input),expected,`speech normalization failed for ${input}`);
for(const input of cases.keys()){const spoken=sanitizeForSpeech(input);assert(!/[*_`#<>\[\]{}|~\\^]/.test(spoken),`speech still contains presentation syntax: ${input}`);assert(!/(?:[a-z][a-z0-9+.-]*:\/\/|www\.)/i.test(spoken),`speech still contains a raw URL: ${input}`)}
const formatted=formatJarvisResponse('**Marge:** €5.250 bij 12,4%.');
assert.equal(formatted.display_text,'**Marge:** €5.250 bij 12,4%.','display text must remain intact');
assert.equal(formatted.spoken_text,'Marge: vijfduizend tweehonderd vijftig euro bij twaalf komma vier procent.');

const audioScene=new FoundlyAudioScene();
audioScene.setSettings({master:.6,voice:.7,music:.45,sfx:.2,voiceEnabled:false,musicEnabled:true,sfxEnabled:false,muted:false});
assert.equal(audioScene.settings.master,.6);assert.equal(audioScene.settings.voice,.7);assert.equal(audioScene.settings.music,.45);assert.equal(audioScene.settings.sfx,.2);assert.equal(audioScene.settings.voiceEnabled,false);assert.equal(audioScene.settings.musicEnabled,true);assert.equal(audioScene.settings.sfxEnabled,false);
assert.equal(audioScene.diagnostics().audio_context_state,'uninitialized');
const gate=new DoubleClapGate();gate.suppress(500,1000);assert.equal(gate.push({rms:.05,peak:.8,attack:.2,highRatio:.5,outputLevel:.7},1200).reason,'suppressed');

assert.equal(QUALITY.length,4);assert(QUALITY[0].particles>=600);assert(QUALITY.at(-1).particles>=6200);assert(QUALITY.at(-1).filaments>=420);assert.equal(MODULE_INDEX.social_media,MODULE_INDEX.social);assert.equal(MODULE_INDEX.google_ads,MODULE_INDEX.google);for(let index=1;index<QUALITY.length;index++){assert(QUALITY[index].raySteps>QUALITY[index-1].raySteps);assert(QUALITY[index].bloomScale>QUALITY[index-1].bloomScale);assert(QUALITY[index].dpr>=QUALITY[index-1].dpr)}
assert.equal(ENERGY_CYCLE_SECONDS,3.15);assert.equal(ROTATION_SECONDS,6.3);assert.equal(FOV_DEGREES,45);assert.equal(REGIONS.length,12);
const requiredStates=['STANDBY','ACTIVATING','LISTENING','THINKING','SEARCHING','PLANNING','WAITING_TOOL','EXECUTING','WAITING_CONFIRMATION','VERIFYING','SPEAKING','SUCCESS','WARNING','ERROR','RECOVERING'];for(const state of requiredStates){assert(STATE_VISUALS[state],`missing visual state ${state}`);assert(Number.isFinite(STATE_VISUALS[state].tempo));assert(Number.isFinite(SOUNDTRACK_STATE[state]),`missing soundtrack state ${state}`)}
const regionRadii=REGIONS.map(row=>Math.hypot(row.center[0],row.center[1]));assert(Math.max(...regionRadii)-Math.min(...regionRadii)>.65,'regions must be asymmetric volumes, not an orbit');
const geometry=createGeometry(),geometryAgain=createGeometry();assert.equal(geometry.paths.length,420);assert.equal(geometry.particlePositions.length/3,6200);assert.equal(geometry.packetTrail.length/7,96);assert.deepEqual(Array.from(geometry.filamentPositions.slice(0,48)),Array.from(geometryAgain.filamentPositions.slice(0,48)),'reference topology and packet paths must be deterministic');
const dynamicRegions=normalizeRegions([{id:'sales',label:'Sales',color:'#00d9ff',center:[-.8,.4,.2],spread:[.3,.2,.2]},{id:'operations',label:'Operations',color:'#ff7147',center:[.8,-.4,-.2],spread:[.3,.2,.2]}]),dynamicGeometry=createGeometry(dynamicRegions);assert.equal(dynamicRegions.length,2);assert.equal(dynamicGeometry.regions.length,2);assert.equal(dynamicGeometry.paths.length,420);assert.equal(dynamicGeometry.particlePositions.length/3,6200,'auto-provisioned region topology must preserve the renderer architecture');assert.notDeepEqual(cameraAt(0),cameraAt(ENERGY_CYCLE_SECONDS));assert.equal(viewProjection(16/9,cameraAt(0)).length,16);
const peak=motionPhaseAt(0),trough=motionPhaseAt(ENERGY_CYCLE_SECONDS/2),nextPeak=motionPhaseAt(ENERGY_CYCLE_SECONDS);assert.equal(peak.energy,1);assert(trough.energy<1e-12);assert(Math.abs(nextPeak.energy-1)<1e-12);assert.equal(nextPeak.rotationPhase,.5);assert.equal(nextQualityIndex(3,30,180),2);assert.equal(nextQualityIndex(1,60,120),2);assert.equal(nextQualityIndex(1,60,80),1);
const splineLengths=geometry.paths.map(path=>{let total=0,last=path.p0;for(let step=1;step<=24;step++){const t=step/24,u=1-t,next=[0,1,2].map(axis=>u*u*u*path.p0[axis]+3*u*u*t*path.p1[axis]+3*u*t*t*path.p2[axis]+t*t*t*path.p3[axis]);total+=Math.hypot(next[0]-last[0],next[1]-last[1],next[2]-last[2]);last=next}return total});assert(splineLengths.filter(value=>value<.35).length>100);assert(splineLengths.filter(value=>value>=.35&&value<.9).length>150);assert(splineLengths.filter(value=>value>=.9).length>40,'reference topology needs long and extreme tendrils');

const html=fs.readFileSync(__dirname+'/index.html','utf8'),client=fs.readFileSync(__dirname+'/index-script.js','utf8'),audio=fs.readFileSync(__dirname+'/jarvis-audio.js','utf8'),neural=fs.readFileSync(__dirname+'/neural-runtime.js','utf8'),server=fs.readFileSync(__dirname+'/server.js','utf8'),ui=html+'\n'+client;
const formatterIndex=html.indexOf('/speech-formatter.js'),clientIndex=html.indexOf('/index-script.js');assert(formatterIndex>=0&&formatterIndex<clientIndex,'speech formatter must load before the Jarvis client');
for(const id of ['businessPanels','panelInventory','panelLeads','panelCrm','panelTasks','panelRecords','panelProviders','liveSourceList','microphoneEnabled','voiceEnabled','musicEnabled','sfxEnabled','audioContextStatus','audioOutputStatus','musicStatus','duckingStatus','micPermissionStatus','voiceOutputStatus'])assert(html.includes(`id="${id}"`),`missing production HUD/control ${id}`);
for(const token of ['buildOriginalSoundscape','musicDuck','outputAnalyser','voiceAnalyser','canDetectWake','musicEnabled','voiceEnabled','sfxEnabled','deterministicNoise','createConvolver','createWaveShaper','audio_reactive_source'])assert(audio.includes(token),`missing audio contract ${token}`);assert(!audio.includes('Math.random('),'the Foundly score must be deterministic and original');
for(const token of ['particlePositions','filamentPositions','cubic(','prefers-reduced-motion','onMetrics','routeEnergy','requestAnimationFrame','RGBA16F','drawArraysInstanced','gl_FragDepth','u_bloom0','u_bloom1','u_bloom2','PACKET_VERTEX','ROTATION_SECONDS','ENERGY_CYCLE_SECONDS','u_audio_bands','u_packet_speed','u_ray_steps','bloomScale','cameraAt','setRegions'])assert(neural.includes(token),`missing neural renderer contract ${token}`);
assert(neural.includes('v_uv=p;gl_Position=vec4(p*2.0-1.0'), 'fullscreen triangle must cover UV 0..1');
assert(!neural.includes('v_uv=p*.5;gl_Position=vec4(p*2.0-1.0'), 'fullscreen triangle must not sample only one viewport quadrant');
assert(!neural.includes('Math.random('),'visual topology must be deterministic and may not fabricate runtime activity');
assert(!neural.includes('gl.LINES'),'filaments must use instanced ribbons, never line primitives');assert(!client.includes("getContext('2d')"),'the legacy 2D radial graph must not run');assert(!client.includes('function buildGraph('));assert(!client.includes('function drawCurve('));
assert(client.includes("fetch('/api/dashboard/summary')"));assert(server.includes("u.pathname==='/api/dashboard/summary'"));assert(client.includes('spokenText(result)'));assert(client.includes('spoken_text:spokenText(result)'));assert(!client.includes('fallbackSpeak(j.answer)'));assert(!client.includes('requestRealtimeSpeech(j.answer'));
assert(!ui.includes('ScreenRecording_'),'reference media may not be shipped or replayed');assert(!ui.includes('.mp4'),'reference audio may not be copied into the product');

class FakeParam{constructor(value=0){this.value=value}setTargetAtTime(value){this.value=value}setValueAtTime(value){this.value=value}exponentialRampToValueAtTime(value){this.value=value}}
class FakeNode{constructor(){this.gain=new FakeParam();this.frequency=new FakeParam();this.Q=new FakeParam();this.pan=new FakeParam();this.threshold=new FakeParam();this.knee=new FakeParam();this.ratio=new FakeParam();this.attack=new FakeParam();this.release=new FakeParam();this.started=false}connect(target){this.target=target;return target}disconnect(){}start(){this.started=true}stop(){this.started=false}getByteFrequencyData(values){values.fill(0)}getFloatTimeDomainData(values){values.fill(0)}}
class FakeAudioContext{constructor(){this.state='suspended';this.currentTime=0;this.sampleRate=48000;this.destination=new FakeNode()}createGain(){return new FakeNode()}createAnalyser(){const node=new FakeNode();node.fftSize=512;node.frequencyBinCount=256;return node}createDynamicsCompressor(){return new FakeNode()}createBiquadFilter(){return new FakeNode()}createOscillator(){return new FakeNode()}createStereoPanner(){return new FakeNode()}createWaveShaper(){return new FakeNode()}createConvolver(){return new FakeNode()}createMediaStreamSource(){return new FakeNode()}createBuffer(channels,length){const data=Array.from({length:channels},()=>new Float32Array(length));return{getChannelData:index=>data[index]}}createBufferSource(){return new FakeNode()}async resume(){this.state='running'}async close(){this.state='closed'}}

(async()=>{
  const originalContext=globalThis.AudioContext,originalFrame=globalThis.requestAnimationFrame,originalCancel=globalThis.cancelAnimationFrame;
  globalThis.AudioContext=FakeAudioContext;globalThis.requestAnimationFrame=()=>1;globalThis.cancelAnimationFrame=()=>{};
  try{const initialized=new FoundlyAudioScene();assert.equal(await initialized.initialize(),true);assert.equal(initialized.ready,true);assert.equal(initialized.outputUnlocked,true);assert.equal(initialized.oscillators.length,4);assert(initialized.oscillators.every(row=>row.oscillator.started));assert.equal(initialized.noise.source.started,true);assert.equal(initialized.diagnostics().music_playing,true);assert.equal(initialized.diagnostics().audio_reactive_source,'web_audio_frequency_analysis');assert.equal(initialized.attachRemote({}),true);assert(initialized.remoteNodes.length>=8,'voice chain must include EQ, subtle saturation and ambience');initialized.setState('EXECUTING');initialized.setUserSpeaking(true);assert.equal(initialized.diagnostics().ducking_active,true);initialized.setJarvisSpeaking(true);assert.equal(initialized.canDetectWake(),false);initialized.dispose()}
  finally{if(originalContext===undefined)delete globalThis.AudioContext;else globalThis.AudioContext=originalContext;if(originalFrame===undefined)delete globalThis.requestAnimationFrame;else globalThis.requestAnimationFrame=originalFrame;if(originalCancel===undefined)delete globalThis.cancelAnimationFrame;else globalThis.cancelAnimationFrame=originalCancel}
  console.log(JSON.stringify({ok:true,version:'5.3.0',speech_plain_text:'pass',dutch_normalization:'pass',display_speech_separation:'pass',audio_buses:'pass',soundscape_initialization:'pass',output_wake_suppression:'pass',adaptive_gpu_density:'pass',deterministic_visual_topology:'pass',real_dashboard_summary:'pass'},null,2));
})().catch(error=>{console.error(error);process.exitCode=1});
