'use strict';

(function exposeJarvisAudio(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root){root.FoundlyAudioScene=api.FoundlyAudioScene;root.FoundlyClapDetector=api.FoundlyClapDetector;root.DoubleClapGate=api.DoubleClapGate}
})(typeof globalThis!=='undefined'?globalThis:this,function buildJarvisAudio(){
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

  class DoubleClapGate{
    constructor(options={}){
      this.options={minPeak:.22,noiseMultiplier:5.5,minCrest:4.2,minAttack:.035,minHighRatio:.12,minIntervalMs:150,maxIntervalMs:720,refractoryMs:110,cooldownMs:1300,...options};
      this.noiseFloor=.012;this.firstAt=0;this.lastTransientAt=0;this.suppressedUntil=0;
    }
    reset(){this.firstAt=0;this.lastTransientAt=0}
    suppress(untilOrDuration=0,now=Date.now()){this.suppressedUntil=untilOrDuration>now?untilOrDuration:now+Math.max(0,untilOrDuration);this.reset()}
    push(sample={},now=Date.now()){
      const rms=clamp(Number(sample.rms)||0,0,1),peak=clamp(Number(sample.peak)||0,0,1),attack=Math.max(0,Number(sample.attack)||0),highRatio=clamp(Number(sample.highRatio)||0,0,1),knownOutput=clamp(Number(sample.outputLevel)||0,0,1);
      if(peak<Math.max(this.options.minPeak,this.noiseFloor*this.options.noiseMultiplier))this.noiseFloor=clamp(this.noiseFloor*.985+rms*.015,.004,.16);
      if(now<this.suppressedUntil)return {candidate:false,activated:false,reason:'suppressed'};
      if(this.firstAt&&now-this.firstAt>this.options.maxIntervalMs)this.firstAt=0;
      const crest=peak/Math.max(rms,.006),outputFloor=knownOutput*.72;
      const candidate=peak>=Math.max(this.options.minPeak,this.noiseFloor*this.options.noiseMultiplier,outputFloor)&&crest>=this.options.minCrest&&attack>=this.options.minAttack&&highRatio>=this.options.minHighRatio;
      if(!candidate||now-this.lastTransientAt<this.options.refractoryMs)return {candidate:false,activated:false,crest,noiseFloor:this.noiseFloor};
      this.lastTransientAt=now;
      if(!this.firstAt){this.firstAt=now;return {candidate:true,activated:false,position:1,crest,noiseFloor:this.noiseFloor}}
      const interval=now-this.firstAt;
      if(interval<this.options.minIntervalMs){this.firstAt=now;return {candidate:true,activated:false,position:1,crest,noiseFloor:this.noiseFloor}}
      if(interval<=this.options.maxIntervalMs){this.firstAt=0;this.suppressedUntil=now+this.options.cooldownMs;return {candidate:true,activated:true,interval,crest,noiseFloor:this.noiseFloor}}
      this.firstAt=now;return {candidate:true,activated:false,position:1,crest,noiseFloor:this.noiseFloor};
    }
  }

  class FoundlyClapDetector{
    constructor({audioContext,stream,onActivation,onCandidate,canDetect,getOutputLevel,sensitivity=.62}={}){
      this.context=audioContext;this.stream=stream;this.onActivation=onActivation||(()=>{});this.onCandidate=onCandidate||(()=>{});this.canDetect=canDetect||(()=>true);this.getOutputLevel=getOutputLevel||(()=>0);this.running=false;this.frame=0;this.previousRms=0;
      const tuned=clamp(Number(sensitivity)||.62,.1,1);
      this.gate=new DoubleClapGate({minPeak:.34-tuned*.16,noiseMultiplier:7-tuned*2.2,minCrest:5-tuned*1.2,minHighRatio:.18-tuned*.08});
    }
    start(){
      if(this.running||!this.context||!this.stream)return false;
      this.source=this.context.createMediaStreamSource(this.stream);this.analyser=this.context.createAnalyser();this.analyser.fftSize=1024;this.analyser.smoothingTimeConstant=.18;
      this.time=new Float32Array(this.analyser.fftSize);this.freq=new Uint8Array(this.analyser.frequencyBinCount);this.source.connect(this.analyser);this.running=true;this.tick();return true;
    }
    suppress(ms){this.gate.suppress(ms,typeof performance!=='undefined'?performance.now():Date.now())}
    tick(){
      if(!this.running)return;
      this.analyser.getFloatTimeDomainData(this.time);this.analyser.getByteFrequencyData(this.freq);
      let sum=0,peak=0;for(const value of this.time){const a=Math.abs(value);sum+=value*value;if(a>peak)peak=a}const rms=Math.sqrt(sum/this.time.length),attack=Math.max(0,rms-this.previousRms);this.previousRms=this.previousRms*.35+rms*.65;
      const binHz=this.context.sampleRate/this.analyser.fftSize,start=Math.max(1,Math.floor(1600/binHz));let high=0,total=0;for(let i=1;i<this.freq.length;i++){const energy=this.freq[i]*this.freq[i];total+=energy;if(i>=start)high+=energy}const highRatio=total?high/total:0;
      const now=performance.now(),result=this.canDetect()?this.gate.push({rms,peak,attack,highRatio,outputLevel:this.getOutputLevel()},now):{candidate:false,activated:false,reason:'state_gate'};
      if(result.candidate)this.onCandidate(result);if(result.activated)this.onActivation(result);this.frame=requestAnimationFrame(()=>this.tick());
    }
    stop(){this.running=false;if(this.frame)cancelAnimationFrame(this.frame);this.frame=0;try{this.source?.disconnect();this.analyser?.disconnect()}catch{}this.source=null;this.analyser=null}
  }

  class FoundlyAudioScene{
    constructor({onLevel,onCapability,onStatus}={}){
      this.onLevel=onLevel||(()=>{});this.onCapability=onCapability||(()=>{});this.onStatus=onStatus||(()=>{});this.context=null;this.ready=false;this.outputUnlocked=false;this.userSpeaking=false;this.jarvisSpeaking=false;this.state='STANDBY';this.levelFrame=0;this.remoteSource=null;this.outputLevel=0;this.voiceLevel=0;this.cueActiveUntil=0;
      this.settings={master:.72,voice:.92,music:.28,sfx:.35,muted:false,voiceEnabled:true,musicEnabled:true,sfxEnabled:true};
    }
    async initialize(){
      if(this.ready){await this.resume();return true}
      const AudioContextCtor=globalThis.AudioContext||globalThis.webkitAudioContext;if(!AudioContextCtor){this.onCapability({audio:false,reason:'web_audio_unavailable'});return false}
      this.context=new AudioContextCtor({latencyHint:'interactive'});const c=this.context;
      this.master=c.createGain();this.voice=c.createGain();this.music=c.createGain();this.sfx=c.createGain();this.musicDuck=c.createGain();this.outputAnalyser=c.createAnalyser();this.voiceAnalyser=c.createAnalyser();this.outputAnalyser.fftSize=512;this.voiceAnalyser.fftSize=512;this.outputAnalyser.smoothingTimeConstant=.72;this.voiceAnalyser.smoothingTimeConstant=.58;this.outputValues=new Uint8Array(this.outputAnalyser.frequencyBinCount);this.voiceValues=new Uint8Array(this.voiceAnalyser.frequencyBinCount);
      const compressor=c.createDynamicsCompressor();compressor.threshold.value=-16;compressor.knee.value=14;compressor.ratio.value=3;compressor.attack.value=.006;compressor.release.value=.22;
      this.voice.connect(this.voiceAnalyser);this.voiceAnalyser.connect(compressor);this.music.connect(this.musicDuck);this.musicDuck.connect(compressor);this.sfx.connect(compressor);compressor.connect(this.outputAnalyser);this.outputAnalyser.connect(this.master);this.master.connect(c.destination);
      this.master.gain.value=0;this.voice.gain.value=this.settings.voice;this.music.gain.value=0;this.musicDuck.gain.value=1;this.sfx.gain.value=this.settings.sfx;
      this.buildOriginalSoundscape();this.ready=true;await this.resume();this.applyMix();this.sampleLevel();this.emitStatus();this.onCapability({audio:true,state:c.state});return true;
    }
    buildOriginalSoundscape(){
      const c=this.context;this.oscillators=[];this.ambientFilter=c.createBiquadFilter();this.ambientFilter.type='lowpass';this.ambientFilter.frequency.value=420;this.ambientFilter.Q.value=.8;this.ambientFilter.connect(this.music);
      for(const [frequency,gainValue,type,pan] of [[43.65,.075,'sine',-.58],[65.41,.043,'triangle',.52],[87.31,.026,'sine',-.16],[130.81,.012,'sine',.7]]){const oscillator=c.createOscillator(),gain=c.createGain(),panner=c.createStereoPanner?c.createStereoPanner():null;oscillator.type=type;oscillator.frequency.value=frequency;gain.gain.value=gainValue;oscillator.connect(gain);if(panner){panner.pan.value=pan;gain.connect(panner);panner.connect(this.ambientFilter)}else gain.connect(this.ambientFilter);oscillator.start();this.oscillators.push({oscillator,gain,panner,base:frequency})}
      this.pulseOsc=c.createOscillator();this.pulseGain=c.createGain();this.pulseFilter=c.createBiquadFilter();this.pulseOsc.type='sine';this.pulseOsc.frequency.value=174.61;this.pulseFilter.type='bandpass';this.pulseFilter.frequency.value=740;this.pulseFilter.Q.value=1.2;this.pulseGain.gain.value=.002;this.pulseOsc.connect(this.pulseFilter);this.pulseFilter.connect(this.pulseGain);this.pulseGain.connect(this.music);this.pulseOsc.start();
      const length=Math.max(1,Math.floor(c.sampleRate*3)),buffer=c.createBuffer(2,length,c.sampleRate);for(let channel=0;channel<2;channel++){const data=buffer.getChannelData(channel);let last=0;for(let i=0;i<length;i++){last=last*.992+(Math.random()*2-1)*.008;data[i]=last*.55}}const noise=c.createBufferSource(),noiseFilter=c.createBiquadFilter(),noiseGain=c.createGain();noise.buffer=buffer;noise.loop=true;noiseFilter.type='bandpass';noiseFilter.frequency.value=1250;noiseFilter.Q.value=.38;noiseGain.gain.value=.052;noise.connect(noiseFilter);noiseFilter.connect(noiseGain);noiseGain.connect(this.music);noise.start();this.noise={source:noise,filter:noiseFilter,gain:noiseGain};
      this.shimmer=c.createOscillator();this.shimmerGain=c.createGain();this.shimmer.type='sine';this.shimmer.frequency.value=1046.5;this.shimmerGain.gain.value=.0032;this.shimmer.connect(this.shimmerGain);this.shimmerGain.connect(this.music);this.shimmer.start();
    }
    async resume(){if(this.context?.state==='suspended')await this.context.resume();this.outputUnlocked=this.context?.state==='running';this.emitStatus();return this.outputUnlocked}
    setSettings(next={}){const aliases={ambience:'music'};for(const raw of ['master','voice','music','ambience','sfx'])if(Number.isFinite(Number(next[raw])))this.settings[aliases[raw]||raw]=clamp(Number(next[raw]),0,1);for(const key of ['voiceEnabled','musicEnabled','sfxEnabled'])if(next[key]!==undefined)this.settings[key]=Boolean(next[key]);if(next.muted!==undefined)this.settings.muted=Boolean(next.muted);if(this.ready)this.applyMix();this.emitStatus()}
    setState(state){this.state=state||'STANDBY';if(!this.ready)return;this.applyMix();if(['ACTIVATING','SUCCESS','WARNING','ERROR'].includes(this.state))this.playCue(this.state)}
    setUserSpeaking(active){this.userSpeaking=Boolean(active);this.applyMix()}
    setJarvisSpeaking(active){this.jarvisSpeaking=Boolean(active);this.applyMix()}
    applyMix(){
      if(!this.ready)return;const now=this.context.currentTime,stateFactor={STANDBY:.62,ACTIVATING:1,LISTENING:.34,THINKING:.72,SEARCHING:.86,PLANNING:.76,WAITING_TOOL:.58,EXECUTING:.92,WAITING_CONFIRMATION:.46,VERIFYING:.67,SPEAKING:.24,SUCCESS:.78,WARNING:.42,ERROR:.26,RECOVERING:.56,MUTED:0}[this.state]??.62,ducked=this.userSpeaking||this.jarvisSpeaking;
      this.master.gain.setTargetAtTime(this.settings.muted?0:this.settings.master,now,.035);this.voice.gain.setTargetAtTime(this.settings.voiceEnabled?this.settings.voice:0,now,.035);this.sfx.gain.setTargetAtTime(this.settings.sfxEnabled?this.settings.sfx:0,now,.035);this.music.gain.setTargetAtTime(this.settings.musicEnabled?this.settings.music*stateFactor:0,now,ducked?.055:.45);this.musicDuck.gain.setTargetAtTime(ducked?.16:1,now,ducked?.05:.42);
      this.ambientFilter.frequency.setTargetAtTime(['THINKING','SEARCHING','EXECUTING'].includes(this.state)?720:360,now,.38);this.pulseGain.gain.setTargetAtTime(this.settings.musicEnabled?({THINKING:.014,SEARCHING:.022,PLANNING:.017,EXECUTING:.028,VERIFYING:.016}[this.state]||.003):0,now,.3);this.pulseOsc.frequency.setTargetAtTime(this.state==='EXECUTING'?220:this.state==='SEARCHING'?196:174.61,now,.28);this.noise.filter.frequency.setTargetAtTime(this.state==='SEARCHING'?1780:this.state==='EXECUTING'?1480:1120,now,.5);this.emitStatus();
    }
    attachRemote(stream){if(!this.ready||!stream)return false;try{this.remoteSource?.disconnect()}catch{}const c=this.context,source=c.createMediaStreamSource(stream),high=c.createBiquadFilter(),body=c.createBiquadFilter(),presence=c.createBiquadFilter();high.type='highpass';high.frequency.value=68;body.type='lowshelf';body.frequency.value=190;body.gain.value=2.4;presence.type='peaking';presence.frequency.value=2600;presence.Q.value=.72;presence.gain.value=1.2;source.connect(high);high.connect(body);body.connect(presence);presence.connect(this.voice);this.remoteSource=source;this.remoteNodes=[high,body,presence];return true}
    playCue(kind){if(!this.ready||this.settings.muted||!this.settings.sfxEnabled||!this.settings.sfx)return;const c=this.context,now=c.currentTime,osc=c.createOscillator(),gain=c.createGain(),freq={ACTIVATING:196,SUCCESS:261.63,WARNING:146.83,ERROR:98}[kind]||174.61;this.cueActiveUntil=performance.now()+480;osc.type=kind==='ERROR'?'sawtooth':'sine';osc.frequency.setValueAtTime(freq,now);osc.frequency.exponentialRampToValueAtTime(freq*(kind==='SUCCESS'?1.5:1.12),now+.3);gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(.065,now+.022);gain.gain.exponentialRampToValueAtTime(.0001,now+.4);osc.connect(gain);gain.connect(this.sfx);osc.start(now);osc.stop(now+.42)}
    canDetectWake(){return !this.jarvisSpeaking&&!this.userSpeaking&&performance.now()>this.cueActiveUntil}
    sampleBand(analyser,values){analyser.getByteFrequencyData(values);let sum=0;for(const value of values)sum+=value/255;return clamp(sum/Math.max(1,values.length),0,1)}
    sampleLevel(){if(!this.ready)return;const outputValues=this.outputValues,voiceValues=this.voiceValues;this.outputLevel=this.sampleBand(this.outputAnalyser,outputValues);this.voiceLevel=this.sampleBand(this.voiceAnalyser,voiceValues);let low=0,mid=0,high=0;for(let i=0;i<voiceValues.length;i++){const v=voiceValues[i]/255;if(i<voiceValues.length*.12)low+=v;else if(i<voiceValues.length*.48)mid+=v;else high+=v}low/=Math.max(1,Math.floor(voiceValues.length*.12));mid/=Math.max(1,Math.floor(voiceValues.length*.36));high/=Math.max(1,Math.floor(voiceValues.length*.52));const level=this.jarvisSpeaking?clamp(low*.3+mid*.54+high*.16,0,1):0;this.onLevel({level,low,mid,high,voice:this.jarvisSpeaking,output:this.outputLevel});this.levelFrame=requestAnimationFrame(()=>this.sampleLevel())}
    diagnostics(extra={}){const musicGain=this.music?.gain?.value||0;return {audio_context_state:this.context?.state||'uninitialized',output_unlocked:Boolean(this.outputUnlocked),music_enabled:Boolean(this.settings.musicEnabled),music_playing:Boolean(this.ready&&this.outputUnlocked&&musicGain>.002&&!this.settings.muted),music_gain:Number(musicGain.toFixed(3)),voice_enabled:Boolean(this.settings.voiceEnabled),voice_active:Boolean(this.jarvisSpeaking),ducking_active:Boolean(this.userSpeaking||this.jarvisSpeaking),sfx_enabled:Boolean(this.settings.sfxEnabled),muted:Boolean(this.settings.muted),output_level:Number(this.outputLevel.toFixed(3)),voice_level:Number(this.voiceLevel.toFixed(3)),...extra}}
    emitStatus(extra={}){const status=this.diagnostics(extra);this.onStatus(status);return status}
    dispose(){if(this.levelFrame)cancelAnimationFrame(this.levelFrame);try{this.remoteSource?.disconnect();for(const row of this.oscillators||[])row.oscillator.stop();this.noise?.source.stop();this.pulseOsc?.stop();this.shimmer?.stop();this.context?.close()}catch{}this.ready=false;this.outputUnlocked=false;this.emitStatus()}
  }

  return {DoubleClapGate,FoundlyClapDetector,FoundlyAudioScene};
});
