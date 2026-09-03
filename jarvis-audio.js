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
      this.noiseFloor=.012;
      this.firstAt=0;
      this.lastTransientAt=0;
      this.suppressedUntil=0;
    }
    reset(){this.firstAt=0;this.lastTransientAt=0}
    suppress(untilOrDuration=0,now=Date.now()){
      this.suppressedUntil=untilOrDuration>now?untilOrDuration:now+Math.max(0,untilOrDuration);
      this.reset();
    }
    push(sample={},now=Date.now()){
      const rms=clamp(Number(sample.rms)||0,0,1),peak=clamp(Number(sample.peak)||0,0,1),attack=Math.max(0,Number(sample.attack)||0),highRatio=clamp(Number(sample.highRatio)||0,0,1);
      if(peak<Math.max(this.options.minPeak,this.noiseFloor*this.options.noiseMultiplier))this.noiseFloor=clamp(this.noiseFloor*.985+rms*.015,.004,.16);
      if(now<this.suppressedUntil)return {candidate:false,activated:false,reason:'suppressed'};
      if(this.firstAt&&now-this.firstAt>this.options.maxIntervalMs)this.firstAt=0;
      const crest=peak/Math.max(rms,.006);
      const candidate=peak>=Math.max(this.options.minPeak,this.noiseFloor*this.options.noiseMultiplier)&&crest>=this.options.minCrest&&attack>=this.options.minAttack&&highRatio>=this.options.minHighRatio;
      if(!candidate||now-this.lastTransientAt<this.options.refractoryMs)return {candidate:false,activated:false,crest,noiseFloor:this.noiseFloor};
      this.lastTransientAt=now;
      if(!this.firstAt){this.firstAt=now;return {candidate:true,activated:false,position:1,crest,noiseFloor:this.noiseFloor}}
      const interval=now-this.firstAt;
      if(interval<this.options.minIntervalMs){this.firstAt=now;return {candidate:true,activated:false,position:1,crest,noiseFloor:this.noiseFloor}}
      if(interval<=this.options.maxIntervalMs){this.firstAt=0;this.suppressedUntil=now+this.options.cooldownMs;return {candidate:true,activated:true,interval,crest,noiseFloor:this.noiseFloor}}
      this.firstAt=now;
      return {candidate:true,activated:false,position:1,crest,noiseFloor:this.noiseFloor};
    }
  }

  class FoundlyClapDetector{
    constructor({audioContext,stream,onActivation,onCandidate,canDetect,sensitivity=.62}={}){
      this.context=audioContext;this.stream=stream;this.onActivation=onActivation||(()=>{});this.onCandidate=onCandidate||(()=>{});this.canDetect=canDetect||(()=>true);this.running=false;this.frame=0;this.previousRms=0;
      const tuned=clamp(Number(sensitivity)||.62,.1,1);
      this.gate=new DoubleClapGate({minPeak:.34-tuned*.16,noiseMultiplier:7-tuned*2.2,minCrest:5-tuned*1.2,minHighRatio:.18-tuned*.08});
    }
    start(){
      if(this.running||!this.context||!this.stream)return false;
      this.source=this.context.createMediaStreamSource(this.stream);
      this.analyser=this.context.createAnalyser();this.analyser.fftSize=1024;this.analyser.smoothingTimeConstant=.18;
      this.time=new Float32Array(this.analyser.fftSize);this.freq=new Uint8Array(this.analyser.frequencyBinCount);
      this.source.connect(this.analyser);this.running=true;this.tick();return true;
    }
    suppress(ms){this.gate.suppress(ms,performance.now())}
    tick(){
      if(!this.running)return;
      this.analyser.getFloatTimeDomainData(this.time);this.analyser.getByteFrequencyData(this.freq);
      let sum=0,peak=0;for(const value of this.time){const a=Math.abs(value);sum+=value*value;if(a>peak)peak=a}const rms=Math.sqrt(sum/this.time.length),attack=Math.max(0,rms-this.previousRms);this.previousRms=this.previousRms*.35+rms*.65;
      const binHz=this.context.sampleRate/(this.analyser.fftSize),start=Math.max(1,Math.floor(1600/binHz));let high=0,total=0;for(let i=1;i<this.freq.length;i++){const energy=this.freq[i]*this.freq[i];total+=energy;if(i>=start)high+=energy}const highRatio=total?high/total:0;
      const result=this.canDetect()?this.gate.push({rms,peak,attack,highRatio},performance.now()):{candidate:false,activated:false,reason:'state_gate'};
      if(result.candidate)this.onCandidate(result);if(result.activated)this.onActivation(result);
      this.frame=requestAnimationFrame(()=>this.tick());
    }
    stop(){this.running=false;if(this.frame)cancelAnimationFrame(this.frame);this.frame=0;try{this.source?.disconnect();this.analyser?.disconnect()}catch{}this.source=null;this.analyser=null}
  }

  class FoundlyAudioScene{
    constructor({onLevel,onCapability}={}){
      this.onLevel=onLevel||(()=>{});this.onCapability=onCapability||(()=>{});this.context=null;this.ready=false;this.muted=false;this.userSpeaking=false;this.jarvisSpeaking=false;this.state='STANDBY';this.levelFrame=0;this.remoteSource=null;
      this.settings={master:.72,voice:.92,ambience:.18,sfx:.35};
    }
    async initialize(){
      if(this.ready){await this.resume();return true}
      const AudioContextCtor=globalThis.AudioContext||globalThis.webkitAudioContext;if(!AudioContextCtor){this.onCapability({audio:false,reason:'web_audio_unavailable'});return false}
      this.context=new AudioContextCtor({latencyHint:'interactive'});const c=this.context;
      this.master=c.createGain();this.voice=c.createGain();this.ambience=c.createGain();this.sfx=c.createGain();this.duck=c.createGain();this.outputAnalyser=c.createAnalyser();this.outputAnalyser.fftSize=512;this.outputAnalyser.smoothingTimeConstant=.72;
      this.master.gain.value=this.settings.master;this.voice.gain.value=this.settings.voice;this.ambience.gain.value=0;this.sfx.gain.value=this.settings.sfx;this.duck.gain.value=1;
      const compressor=c.createDynamicsCompressor();compressor.threshold.value=-18;compressor.knee.value=16;compressor.ratio.value=3;compressor.attack.value=.006;compressor.release.value=.18;
      this.voice.connect(compressor);this.ambience.connect(compressor);this.sfx.connect(compressor);compressor.connect(this.duck);this.duck.connect(this.outputAnalyser);this.outputAnalyser.connect(this.master);this.master.connect(c.destination);
      this.buildOriginalSoundscape();this.ready=true;await this.resume();this.sampleLevel();this.onCapability({audio:true,state:c.state});return true;
    }
    buildOriginalSoundscape(){
      const c=this.context,filter=c.createBiquadFilter();filter.type='lowpass';filter.frequency.value=310;filter.Q.value=.7;filter.connect(this.ambience);this.ambientFilter=filter;this.oscillators=[];
      for(const [frequency,gainValue,type] of [[43.65,.025,'sine'],[65.41,.012,'triangle'],[87.31,.008,'sine']]){const oscillator=c.createOscillator(),gain=c.createGain();oscillator.type=type;oscillator.frequency.value=frequency;gain.gain.value=gainValue;oscillator.connect(gain);gain.connect(filter);oscillator.start();this.oscillators.push({oscillator,gain,base:frequency})}
      const length=Math.max(1,Math.floor(c.sampleRate*2)),buffer=c.createBuffer(1,length,c.sampleRate),data=buffer.getChannelData(0);let last=0;for(let i=0;i<length;i++){last=last*.985+(Math.random()*2-1)*.015;data[i]=last*.22}const noise=c.createBufferSource(),noiseFilter=c.createBiquadFilter(),noiseGain=c.createGain();noise.buffer=buffer;noise.loop=true;noiseFilter.type='bandpass';noiseFilter.frequency.value=1100;noiseFilter.Q.value=.35;noiseGain.gain.value=.018;noise.connect(noiseFilter);noiseFilter.connect(noiseGain);noiseGain.connect(this.ambience);noise.start();this.noise={source:noise,filter:noiseFilter,gain:noiseGain};
    }
    async resume(){if(this.context?.state==='suspended')await this.context.resume();return this.context?.state==='running'}
    setSettings(next={}){for(const key of ['master','voice','ambience','sfx'])if(Number.isFinite(Number(next[key])))this.settings[key]=clamp(Number(next[key]),0,1);this.muted=Boolean(next.muted??this.muted);if(!this.ready)return;const now=this.context.currentTime;this.master.gain.setTargetAtTime(this.muted?0:this.settings.master,now,.035);this.voice.gain.setTargetAtTime(this.settings.voice,now,.035);this.sfx.gain.setTargetAtTime(this.settings.sfx,now,.035);this.applyMix()}
    setState(state){this.state=state||'STANDBY';if(!this.ready)return;this.applyMix();if(['ACTIVATING','SUCCESS','WARNING','ERROR'].includes(this.state))this.playCue(this.state)}
    setUserSpeaking(active){this.userSpeaking=Boolean(active);this.applyMix()}
    setJarvisSpeaking(active){this.jarvisSpeaking=Boolean(active);this.applyMix()}
    applyMix(){if(!this.ready)return;const now=this.context.currentTime,stateFactor={STANDBY:.42,ACTIVATING:.9,LISTENING:.26,THINKING:.58,SEARCHING:.7,PLANNING:.62,WAITING_TOOL:.48,EXECUTING:.78,WAITING_CONFIRMATION:.38,VERIFYING:.55,SPEAKING:.18,SUCCESS:.65,WARNING:.34,ERROR:.22,RECOVERING:.45,MUTED:0}[this.state]??.42;const ducked=this.userSpeaking||this.jarvisSpeaking;this.ambience.gain.setTargetAtTime(this.settings.ambience*stateFactor*(ducked?.18:1),now,ducked?.045:.38);this.duck.gain.setTargetAtTime(this.userSpeaking?.75:1,now,this.userSpeaking?.025:.2);if(this.ambientFilter)this.ambientFilter.frequency.setTargetAtTime(['THINKING','SEARCHING','EXECUTING'].includes(this.state)?520:280,now,.35)}
    attachRemote(stream){if(!this.ready||!stream)return false;try{this.remoteSource?.disconnect()}catch{}const c=this.context,source=c.createMediaStreamSource(stream),high=c.createBiquadFilter(),body=c.createBiquadFilter(),presence=c.createBiquadFilter();high.type='highpass';high.frequency.value=68;body.type='lowshelf';body.frequency.value=190;body.gain.value=2.4;presence.type='peaking';presence.frequency.value=2600;presence.Q.value=.72;presence.gain.value=1.2;source.connect(high);high.connect(body);body.connect(presence);presence.connect(this.voice);this.remoteSource=source;this.remoteNodes=[high,body,presence];return true}
    playCue(kind){if(!this.ready||this.muted||!this.settings.sfx)return;const c=this.context,now=c.currentTime,osc=c.createOscillator(),gain=c.createGain(),freq={ACTIVATING:196,SUCCESS:261.63,WARNING:146.83,ERROR:98}[kind]||174.61;osc.type=kind==='ERROR'?'sawtooth':'sine';osc.frequency.setValueAtTime(freq,now);osc.frequency.exponentialRampToValueAtTime(freq*(kind==='SUCCESS'?1.5:1.12),now+.22);gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(.035,now+.018);gain.gain.exponentialRampToValueAtTime(.0001,now+.32);osc.connect(gain);gain.connect(this.sfx);osc.start(now);osc.stop(now+.34)}
    sampleLevel(){if(!this.ready)return;const values=new Uint8Array(this.outputAnalyser.frequencyBinCount);this.outputAnalyser.getByteFrequencyData(values);let low=0,mid=0,high=0;for(let i=0;i<values.length;i++){const v=values[i]/255;if(i<values.length*.12)low+=v;else if(i<values.length*.48)mid+=v;else high+=v}low/=Math.max(1,Math.floor(values.length*.12));mid/=Math.max(1,Math.floor(values.length*.36));high/=Math.max(1,Math.floor(values.length*.52));const level=clamp(low*.38+mid*.48+high*.14,0,1);this.onLevel({level,low,mid,high,voice:this.jarvisSpeaking});this.levelFrame=requestAnimationFrame(()=>this.sampleLevel())}
    dispose(){if(this.levelFrame)cancelAnimationFrame(this.levelFrame);try{this.remoteSource?.disconnect();for(const row of this.oscillators||[])row.oscillator.stop();this.noise?.source.stop();this.context?.close()}catch{}this.ready=false}
  }

  return {DoubleClapGate,FoundlyClapDetector,FoundlyAudioScene};
});
