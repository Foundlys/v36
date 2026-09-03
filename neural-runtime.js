'use strict';

(function exposeNeuralRuntime(root){
  const TAU=Math.PI*2;
  const STATE_LEVEL={STANDBY:.16,ACTIVATING:.82,LISTENING:.46,THINKING:.72,SEARCHING:.86,PLANNING:.76,WAITING_TOOL:.58,EXECUTING:1,WAITING_CONFIRMATION:.48,VERIFYING:.74,SPEAKING:.88,SUCCESS:.7,WARNING:.58,ERROR:.5,RECOVERING:.62,MUTED:.035};
  const QUALITY=[
    {name:'LOW',scale:.52,dpr:1,particles:620,filaments:40},
    {name:'BALANCED',scale:.7,dpr:1.15,particles:1120,filaments:70},
    {name:'HIGH',scale:.86,dpr:1.42,particles:1880,filaments:104},
    {name:'ULTRA',scale:1,dpr:1.7,particles:2700,filaments:144}
  ];
  const MODULES=[
    ['inkoop','#ff9d3d'],['verkoop','#6fe6ff'],['data','#b98cff'],['crm','#52e2a2'],
    ['agenda','#ffd08a'],['voorraad','#7da7ff'],['social','#ff6b9d'],['google','#60a5fa'],
    ['automatisering','#fb923c'],['communicatie','#34d399'],['rapportages','#facc15'],['integraties','#a78bfa']
  ];
  const MODULE_INDEX=Object.fromEntries(MODULES.flatMap(([id],index)=>[[id,index],[id==='social'?'social_media':id==='google'?'google_ads':id,index]]));
  const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,Number(value)||0));
  const ease=(value)=>value*value*(3-2*value);
  const color=(hex)=>{const value=parseInt(hex.slice(1),16);return[((value>>16)&255)/255,((value>>8)&255)/255,(value&255)/255]};
  function randomFactory(seed=0x51f0a11){let value=seed>>>0;return()=>{value=(value*1664525+1013904223)>>>0;return value/4294967296}};
  function cubic(a,b,c,d,t){const u=1-t;return u*u*u*a+3*u*u*t*b+3*u*t*t*c+t*t*t*d}
  function compile(gl,type,source){const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){const reason=gl.getShaderInfoLog(shader)||'shader compile failed';gl.deleteShader(shader);throw new Error(reason)}return shader}
  function makeProgram(gl,vertex,fragment){const program=gl.createProgram(),vs=compile(gl,gl.VERTEX_SHADER,vertex),fs=compile(gl,gl.FRAGMENT_SHADER,fragment);gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);if(!gl.getProgramParameter(program,gl.LINK_STATUS)){const reason=gl.getProgramInfoLog(program)||'shader link failed';gl.deleteProgram(program);throw new Error(reason)}return program}
  function bindAttribute(gl,program,name,size,data,usage=gl.STATIC_DRAW){const location=gl.getAttribLocation(program,name),buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,data,usage);if(location>=0){gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,size,gl.FLOAT,false,0,0)}return buffer}

  const FULLSCREEN_VERTEX=`#version 300 es
precision highp float;
out vec2 v_uv;
void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));v_uv=p*.5;gl_Position=vec4(p*2.0-1.0,0.0,1.0);}`;
  const BACKGROUND_FRAGMENT=`#version 300 es
precision highp float;
in vec2 v_uv;out vec4 outColor;
uniform vec2 u_resolution;uniform float u_time;uniform float u_state;uniform float u_audio;uniform vec3 u_bands;uniform float u_route_energy;
float hash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yxz+33.33);return fract((p.x+p.y)*p.z);}
float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){float value=0.,weight=.53;for(int i=0;i<5;i++){value+=noise(p)*weight;p=p*2.03+vec3(9.1,3.7,5.2);weight*=.48;}return value;}
void main(){vec2 p=(v_uv-.5)*2.;p.x*=u_resolution.x/max(1.,u_resolution.y);float t=u_time;float r=length(p);float a=atan(p.y,p.x);float cloud=fbm(vec3(p*2.15,t*.055));float wisps=fbm(vec3(p*5.4+vec2(sin(t*.06),cos(t*.05))*.2,t*.025));float core=exp(-r*r*(4.4-u_state*1.25));float lobe=exp(-length(p-vec2(-.16,.015))*length(p-vec2(-.16,.015))*17.)+exp(-length(p-vec2(.16,-.015))*length(p-vec2(.16,-.015))*17.);float shell=exp(-pow(abs(r-(.33+.022*sin(a*5.+t*.55))),2.)*240.);float halo=exp(-r*r*1.18);float breathing=.82+.18*sin(t*.72);vec3 deep=vec3(.001,.004,.012),navy=vec3(.008,.035,.09),cyan=vec3(.05,.62,1.),electric=vec3(.1,.34,1.),violet=vec3(.44,.08,.84),gold=vec3(1.,.42,.08);vec3 c=deep+navy*(.13+cloud*.18)*halo;c+=mix(violet,electric,.58+.42*sin(a*1.7))*(wisps-.42)*.07*halo;c+=cyan*core*(.1+.23*u_state+.28*u_audio)*breathing;c+=electric*lobe*(.035+.11*u_state);c+=cyan*shell*(.025+.12*u_state+.13*u_bands.y);c+=mix(electric,gold,.22)*u_route_energy*core*.22;c+=vec3(.03,.11,.17)*exp(-pow(abs(r-.72),2.)*3.)*.06;float scan=.0045*sin(v_uv.y*u_resolution.y*.72);c+=scan*vec3(.08,.32,.44);c*=1.-smoothstep(.82,1.72,r);c*=.94+.06*hash(vec3(gl_FragCoord.xy,t));outColor=vec4(pow(max(c,0.),vec3(.72)),1.);}`;
  const SCENE_VERTEX=`#version 300 es
precision highp float;
in vec3 a_position;in vec3 a_color;in vec2 a_meta;
uniform vec2 u_resolution;uniform float u_time;uniform float u_state;uniform float u_audio;uniform vec3 u_focus;uniform float u_focus_amount;uniform float u_motion;uniform float u_route_index;uniform float u_route_energy;
out vec3 v_color;out float v_energy;out float v_kind;out float v_phase;
vec3 rotateY(vec3 p,float a){float c=cos(a),s=sin(a);return vec3(p.x*c-p.z*s,p.y,p.x*s+p.z*c);}
vec3 rotateX(vec3 p,float a){float c=cos(a),s=sin(a);return vec3(p.x,p.y*c-p.z*s,p.y*s+p.z*c);}
void main(){float kind=a_meta.x,module=a_meta.y;vec3 p=a_position;float drift=(kind<.5?.012:.005)*u_motion;p+=vec3(sin(u_time*.43+a_position.y*13.),cos(u_time*.37+a_position.x*11.),sin(u_time*.31+a_position.z*17.))*drift;p=mix(p-u_focus*.13,p-u_focus*.31,u_focus_amount);p=rotateY(p,u_time*.018*u_motion-.12);p=rotateX(p,-.10);float depth=2.55+p.z;float perspective=1.5/max(.85,depth);vec2 clip=p.xy*perspective;clip.x/=max(.58,u_resolution.x/max(1.,u_resolution.y));gl_Position=vec4(clip,clamp(p.z*.08,-.8,.8),1.);float selected=1.-step(.35,abs(module-u_route_index));float focusSelected=1.-step(.42,length(a_position-u_focus));v_energy=(.28+.72*u_state)+selected*u_route_energy*2.6+focusSelected*u_focus_amount*.7;v_color=a_color;v_kind=kind;v_phase=fract(a_position.x*7.31+a_position.y*11.7+a_position.z*5.13);gl_PointSize=clamp((kind<.5?3.25:2.15)*(1.+u_state*.75+u_audio*1.35+selected*u_route_energy*1.7)*perspective,1.,13.);}`;
  const PARTICLE_FRAGMENT=`#version 300 es
precision highp float;
in vec3 v_color;in float v_energy;in float v_kind;in float v_phase;out vec4 outColor;
void main(){vec2 q=gl_PointCoord-.5;float r=length(q);if(r>.5)discard;float core=smoothstep(.5,.02,r),halo=smoothstep(.52,.2,r);vec3 c=mix(v_color,vec3(.86,.98,1.),core*.72);float alpha=(core*.7+halo*.3)*clamp(v_energy,.12,3.2)*(v_kind<.5?.72:.46);outColor=vec4(c*alpha,alpha);}`;
  const FILAMENT_VERTEX=`#version 300 es
precision highp float;
in vec3 a_position;in vec3 a_color;in vec2 a_meta;
uniform vec2 u_resolution;uniform float u_time;uniform float u_state;uniform vec3 u_focus;uniform float u_focus_amount;uniform float u_motion;uniform float u_route_index;uniform float u_route_energy;
out vec3 v_color;out float v_alpha;out float v_phase;
vec3 rotateY(vec3 p,float a){float c=cos(a),s=sin(a);return vec3(p.x*c-p.z*s,p.y,p.x*s+p.z*c);}
vec3 rotateX(vec3 p,float a){float c=cos(a),s=sin(a);return vec3(p.x,p.y*c-p.z*s,p.y*s+p.z*c);}
void main(){float phase=a_meta.x,module=a_meta.y;vec3 p=a_position;p+=vec3(0.,sin(u_time*.2+phase*8.)*.006*u_motion,cos(u_time*.17+phase*7.)*.004*u_motion);p=mix(p-u_focus*.13,p-u_focus*.31,u_focus_amount);p=rotateY(p,u_time*.018*u_motion-.12);p=rotateX(p,-.10);float perspective=1.5/max(.85,2.55+p.z);vec2 clip=p.xy*perspective;clip.x/=max(.58,u_resolution.x/max(1.,u_resolution.y));gl_Position=vec4(clip,clamp(p.z*.08,-.8,.8),1.);float selected=1.-step(.35,abs(module-u_route_index));float packet=pow(max(0.,sin((phase-u_time*.3)*20.)),18.);v_color=a_color;v_alpha=.045+.11*u_state+selected*u_route_energy*(.5+packet*1.4);v_phase=phase;}`;
  const FILAMENT_FRAGMENT=`#version 300 es
precision highp float;
in vec3 v_color;in float v_alpha;in float v_phase;out vec4 outColor;
void main(){float shimmer=.72+.28*sin(v_phase*77.);float alpha=clamp(v_alpha*shimmer,0.,1.);outColor=vec4(v_color*alpha,alpha);}`;

  class FoundlyNeuralRuntime{
    constructor(canvas,{onQuality,onMetrics}={}){
      this.canvas=canvas;this.onQuality=onQuality||(()=>{});this.onMetrics=onMetrics||(()=>{});
      this.state='STANDBY';this.stateLevel=STATE_LEVEL.STANDBY;this.audio={level:0,output:0,voice:0,low:0,mid:0,high:0};
      this.routeIndex=-99;this.routeEnergy=0;this.focusIndex=-1;this.focusCurrent=[0,0,0];this.focusTarget=[0,0,0];this.focusAmount=0;this.focusTargetAmount=0;
      this.qualityIndex=3;this.autoQuality=true;this.frames=[];this.lastFrame=0;this.lastGovernor=0;this.lastMetrics=0;this.visible=!document.hidden;this.available=false;
      this.reducedMotion=Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches);this.startTime=performance.now();this.init();
    }
    init(){
      const gl=this.canvas?.getContext?.('webgl2',{alpha:false,antialias:false,powerPreference:'high-performance',premultipliedAlpha:false,preserveDrawingBuffer:false});
      if(!gl){this.canvas?.classList.add('hidden');this.onQuality({available:false,name:'FALLBACK'});return}
      this.gl=gl;
      try{
        this.backgroundProgram=makeProgram(gl,FULLSCREEN_VERTEX,BACKGROUND_FRAGMENT);
        this.particleProgram=makeProgram(gl,SCENE_VERTEX,PARTICLE_FRAGMENT);
        this.filamentProgram=makeProgram(gl,FILAMENT_VERTEX,FILAMENT_FRAGMENT);
        this.fullscreenVao=gl.createVertexArray();
        const geometry=this.createGeometry();this.geometry=geometry;
        this.particleVao=gl.createVertexArray();gl.bindVertexArray(this.particleVao);
        this.particleBuffers=[bindAttribute(gl,this.particleProgram,'a_position',3,geometry.particlePositions),bindAttribute(gl,this.particleProgram,'a_color',3,geometry.particleColors),bindAttribute(gl,this.particleProgram,'a_meta',2,geometry.particleMeta)];
        this.filamentVao=gl.createVertexArray();gl.bindVertexArray(this.filamentVao);
        this.filamentBuffers=[bindAttribute(gl,this.filamentProgram,'a_position',3,geometry.filamentPositions),bindAttribute(gl,this.filamentProgram,'a_color',3,geometry.filamentColors),bindAttribute(gl,this.filamentProgram,'a_meta',2,geometry.filamentMeta)];
        gl.bindVertexArray(null);
        this.backgroundUniforms=this.uniforms(this.backgroundProgram,['u_resolution','u_time','u_state','u_audio','u_bands','u_route_energy']);
        this.particleUniforms=this.uniforms(this.particleProgram,['u_resolution','u_time','u_state','u_audio','u_focus','u_focus_amount','u_motion','u_route_index','u_route_energy']);
        this.filamentUniforms=this.uniforms(this.filamentProgram,['u_resolution','u_time','u_state','u_focus','u_focus_amount','u_motion','u_route_index','u_route_energy']);
        this.available=true;this.resize();
        addEventListener('resize',()=>this.resize(),{passive:true});
        document.addEventListener('visibilitychange',()=>{this.visible=!document.hidden;if(this.visible){this.lastFrame=performance.now();requestAnimationFrame(time=>this.draw(time))}});
        globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').addEventListener?.('change',event=>{this.reducedMotion=event.matches});
        this.onQuality({available:true,name:QUALITY[this.qualityIndex].name,auto:true,particles:QUALITY[this.qualityIndex].particles,filaments:QUALITY[this.qualityIndex].filaments});
        requestAnimationFrame(time=>this.draw(time));
      }catch(error){console.error('[NEURAL RENDERER]',String(error?.message||error).slice(0,240));this.canvas.classList.add('hidden');this.onQuality({available:false,name:'FALLBACK'})}
    }
    uniforms(program,names){const gl=this.gl;return Object.fromEntries(names.map(name=>[name,gl.getUniformLocation(program,name)]))}
    createGeometry(){
      const random=randomFactory(),positions=[],colors=[],meta=[],anchors=[];
      for(let index=0;index<MODULES.length;index++){const angle=(index/MODULES.length)*TAU+.17,radius=.76+(index%3)*.12;anchors.push([Math.cos(angle)*radius,Math.sin(angle)*radius*.63,Math.sin(angle*1.73)*.28])}
      const addParticle=(p,c,kind,module)=>{positions.push(...p);colors.push(...c);meta.push(kind,module)};
      const coreCount=1100,moduleCount=150;
      for(let index=0;index<coreCount;index++){
        const theta=random()*TAU,z=random()*2-1,r=Math.pow(random(),.47)*(.25+.09*Math.sin(theta*2.3)*Math.sin(theta*2.3));
        const xy=Math.sqrt(Math.max(0,1-z*z)),lobe=index%2?-.09:.09,p=[Math.cos(theta)*xy*r+lobe,Math.sin(theta)*xy*r*.84,z*r*.8];
        const energy=.58+random()*.42;addParticle(p,[.08*energy,.48*energy,1*energy],0,-99);
      }
      for(let index=0;index<MODULES.length;index++){
        const anchor=anchors[index],c=color(MODULES[index][1]);
        for(let j=0;j<moduleCount;j++){
          const theta=random()*TAU,z=random()*2-1,r=Math.pow(random(),1.8)*(.08+random()*.12),xy=Math.sqrt(Math.max(0,1-z*z));
          addParticle([anchor[0]+Math.cos(theta)*xy*r,anchor[1]+Math.sin(theta)*xy*r,anchor[2]+z*r],[c[0]*(.62+random()*.38),c[1]*(.62+random()*.38),c[2]*(.68+random()*.32)],1,index);
        }
      }
      const filamentPositions=[],filamentColors=[],filamentMeta=[],segments=34;
      for(let index=0;index<QUALITY.at(-1).filaments;index++){
        const module=index%MODULES.length,end=anchors[module],start=[(random()-.5)*.18,(random()-.5)*.16,(random()-.5)*.16];
        const angle=(module/MODULES.length)*TAU+.17,reach=.28+random()*.35;
        const c1=[Math.cos(angle+(.35-random()*.7))*reach,Math.sin(angle+(.35-random()*.7))*reach*.7,(random()-.5)*.48];
        const c2=[end[0]*(.55+random()*.24)+Math.sin(angle)*(.12+random()*.16),end[1]*(.58+random()*.25)-Math.cos(angle)*(.08+random()*.14),end[2]+(random()-.5)*.25];
        const destination=[end[0]+(random()-.5)*.2,end[1]+(random()-.5)*.15,end[2]+(random()-.5)*.18],c=color(MODULES[module][1]);
        for(let segment=0;segment<segments;segment++){
          for(const step of [segment/segments,(segment+1)/segments]){
            filamentPositions.push(cubic(start[0],c1[0],c2[0],destination[0],step),cubic(start[1],c1[1],c2[1],destination[1],step),cubic(start[2],c1[2],c2[2],destination[2],step));
            filamentColors.push(c[0],c[1],c[2]);filamentMeta.push(step,module);
          }
        }
      }
      return{anchors,segments,coreCount,moduleCount,particlePositions:new Float32Array(positions),particleColors:new Float32Array(colors),particleMeta:new Float32Array(meta),filamentPositions:new Float32Array(filamentPositions),filamentColors:new Float32Array(filamentColors),filamentMeta:new Float32Array(filamentMeta)};
    }
    resize(){if(!this.available)return;const profile=QUALITY[this.qualityIndex],dpr=Math.min(devicePixelRatio||1,profile.dpr);this.canvas.width=Math.max(1,Math.floor(innerWidth*dpr*profile.scale));this.canvas.height=Math.max(1,Math.floor(innerHeight*dpr*profile.scale));this.canvas.style.width=innerWidth+'px';this.canvas.style.height=innerHeight+'px';this.gl.viewport(0,0,this.canvas.width,this.canvas.height)}
    setState(state){this.state=state in STATE_LEVEL?state:'STANDBY';this.stateLevel=STATE_LEVEL[this.state]}
    setAudio(values={}){for(const key of ['level','output','voice','low','mid','high'])if(values[key]!==undefined)this.audio[key]=clamp(values[key])}
    route(moduleId,energy=1){const index=MODULE_INDEX[String(moduleId||'').toLowerCase()];if(index===undefined)return false;this.routeIndex=index;this.routeEnergy=Math.max(this.routeEnergy,clamp(energy,.2,1));return true}
    event(event={}){const hay=`${event.type||''} ${event.module||''} ${event.message||''}`.toLowerCase();for(const [id] of MODULES)if(hay.includes(id.replace('_',' '))){this.route(id,.78);return true}return false}
    focus(moduleId){const index=MODULE_INDEX[String(moduleId||'').toLowerCase()];if(index===undefined){this.focusIndex=-1;this.focusTarget=[0,0,0];this.focusTargetAmount=0;return false}this.focusIndex=index;this.focusTarget=[...this.geometry.anchors[index]];this.focusTargetAmount=1;this.route(moduleId,.55);return true}
    setQuality(name){const index=QUALITY.findIndex(row=>row.name===String(name).toUpperCase());if(index<0)return false;this.autoQuality=false;this.qualityIndex=index;this.resize();this.frames=[];this.reportQuality();return true}
    setAutoQuality(){this.autoQuality=true;this.frames=[];this.reportQuality()}
    reportQuality(extra={}){const profile=QUALITY[this.qualityIndex];this.onQuality({available:this.available,name:this.available?profile.name:'FALLBACK',auto:this.autoQuality,particles:profile.particles,filaments:profile.filaments,...extra})}
    metrics(){const profile=QUALITY[this.qualityIndex],average=this.frames.length?this.frames.reduce((sum,value)=>sum+value,0)/this.frames.length:16.67;return{available:this.available,quality:profile.name,auto:this.autoQuality,fps:Math.round(1000/average),particles:profile.particles,filaments:profile.filaments,state:this.state,route_active:this.routeEnergy>.05,reduced_motion:this.reducedMotion}}
    govern(now){if(!this.autoQuality||now-this.lastGovernor<6000||this.frames.length<50)return;this.lastGovernor=now;const stats=this.metrics();let next=this.qualityIndex;if(stats.fps<43&&next>0)next--;else if(stats.fps>58&&next<QUALITY.length-1&&this.frames.length>=120)next++;if(next!==this.qualityIndex){this.qualityIndex=next;this.resize();this.frames=[];this.reportQuality({fps:stats.fps})}}
    setSceneUniforms(program,uniforms,time){const gl=this.gl;gl.useProgram(program);gl.uniform2f(uniforms.u_resolution,this.canvas.width,this.canvas.height);gl.uniform1f(uniforms.u_time,time);gl.uniform1f(uniforms.u_state,this.stateLevel);if(uniforms.u_audio)gl.uniform1f(uniforms.u_audio,Math.max(this.audio.level,this.audio.output,this.audio.voice));if(uniforms.u_focus)gl.uniform3f(uniforms.u_focus,...this.focusCurrent);if(uniforms.u_focus_amount)gl.uniform1f(uniforms.u_focus_amount,this.focusAmount);if(uniforms.u_motion)gl.uniform1f(uniforms.u_motion,this.reducedMotion?.18:1);if(uniforms.u_route_index)gl.uniform1f(uniforms.u_route_index,this.routeIndex);if(uniforms.u_route_energy)gl.uniform1f(uniforms.u_route_energy,this.routeEnergy)}
    draw(now){
      if(!this.available||!this.visible)return;const dt=this.lastFrame?Math.min(100,now-this.lastFrame):16.67;this.lastFrame=now;if(dt>0&&dt<100)this.frames.push(dt);if(this.frames.length>180)this.frames.shift();this.govern(now);
      const interpolation=1-Math.pow(.001,dt/1000);for(let index=0;index<3;index++)this.focusCurrent[index]+=(this.focusTarget[index]-this.focusCurrent[index])*interpolation;this.focusAmount+=(this.focusTargetAmount-this.focusAmount)*interpolation;
      this.routeEnergy*=Math.pow(.988,dt/16.67);if(this.routeEnergy<.002){this.routeEnergy=0;this.routeIndex=-99}
      const gl=this.gl,time=(now-this.startTime)/1000,profile=QUALITY[this.qualityIndex];gl.disable(gl.BLEND);gl.bindVertexArray(this.fullscreenVao);this.setSceneUniforms(this.backgroundProgram,this.backgroundUniforms,time);gl.uniform3f(this.backgroundUniforms.u_bands,this.audio.low,this.audio.mid,this.audio.high);gl.drawArrays(gl.TRIANGLES,0,3);
      gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE);gl.depthMask(false);
      gl.bindVertexArray(this.filamentVao);this.setSceneUniforms(this.filamentProgram,this.filamentUniforms,time);gl.drawArrays(gl.LINES,0,profile.filaments*this.geometry.segments*2);
      gl.bindVertexArray(this.particleVao);this.setSceneUniforms(this.particleProgram,this.particleUniforms,time);const coreDraw=Math.min(this.geometry.coreCount,Math.round(profile.particles*.39)),perModule=Math.min(this.geometry.moduleCount,Math.floor((profile.particles-coreDraw)/MODULES.length));gl.drawArrays(gl.POINTS,0,coreDraw);for(let module=0;module<MODULES.length;module++)gl.drawArrays(gl.POINTS,this.geometry.coreCount+module*this.geometry.moduleCount,perModule);
      gl.bindVertexArray(null);gl.disable(gl.BLEND);
      if(now-this.lastMetrics>1000){this.lastMetrics=now;const metrics=this.metrics();this.onMetrics(metrics);this.reportQuality({fps:metrics.fps})}
      requestAnimationFrame(next=>this.draw(next));
    }
    destroy(){if(!this.gl)return;this.available=false;for(const buffer of [...(this.particleBuffers||[]),...(this.filamentBuffers||[])])this.gl.deleteBuffer(buffer);for(const program of [this.backgroundProgram,this.particleProgram,this.filamentProgram])if(program)this.gl.deleteProgram(program)}
  }
  root.FoundlyNeuralRuntime=FoundlyNeuralRuntime;
  if(typeof module!=='undefined'&&module.exports)module.exports={FoundlyNeuralRuntime,STATE_LEVEL,QUALITY,MODULE_INDEX};
})(typeof globalThis!=='undefined'?globalThis:this);
