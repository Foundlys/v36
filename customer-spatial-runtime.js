'use strict';
(function(root){
  const M=root.FoundlySpatialModel;
  const ICONS={inkoop:'M4 7h16l-2 10H7L4 4H2 M8 21h.01 M17 21h.01',verkoop:'M3 16l6-6 4 3 8-9 M15 4h6v6',finance:'M4 21V9 M10 21V4 M16 21v-9 M22 21H2',crm:'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M2 21v-3a7 7 0 0 1 14 0v3 M17 5a3 3 0 0 1 0 6 M19 15a5 5 0 0 1 3 5',agenda:'M4 5h16v16H4z M4 10h16 M8 2v6 M16 2v6 M8 14h3',mail:'M2 5h20v14H2z M2 5l10 8L22 5',social:'M12 7a3 3 0 1 0 0-6 3 3 0 0 0 0 6 M5 23a3 3 0 1 0 0-6 3 3 0 0 0 0 6 M20 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6 M10 7l-4 10 M14 7l5 8 M8 20l9-2',marketing:'M3 10v6h5l10 5V4L8 10z M8 16l2 6 M21 9v7',analytics:'M3 3v18h19 M6 16l4-7 5 4 6-9'};
  const el=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls||'';if(text!==undefined)n.textContent=text;return n;};
  class IntelligenceCore {
    constructor(){
      this.canvas=el('canvas','spatial-core-material');this.canvas.setAttribute('aria-hidden','true');
      try{
        const gl=this.canvas.getContext?.('webgl',{alpha:true,antialias:true,premultipliedAlpha:false});if(!gl)return;this.gl=gl;
        const shader=(type,source)=>{const sh=gl.createShader(type);gl.shaderSource(sh,source);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw Error('Core material unavailable');return sh;};
        const vertex=shader(gl.VERTEX_SHADER,'attribute vec2 position;varying vec2 uv;void main(){uv=position;gl_Position=vec4(position,0.,1.);}');
        const fragment=shader(gl.FRAGMENT_SHADER,`precision highp float;varying vec2 uv;uniform float yaw;uniform float pitch;
          void main(){vec2 p=uv*1.025;float r=length(p);if(r>1.)discard;vec3 n=vec3(p,sqrt(max(0.,1.-r*r)));vec3 t=vec3(n.x*cos(yaw)-n.z*sin(yaw),n.y,n.x*sin(yaw)+n.z*cos(yaw));t=vec3(t.x,t.y*cos(pitch)-t.z*sin(pitch),t.y*sin(pitch)+t.z*cos(pitch));
          vec3 light=normalize(vec3(-.65,.8,1.2));float diffuse=max(0.,dot(n,light));float spec=pow(max(0.,dot(reflect(-light,n),vec3(0.,0.,1.))),55.);float rim=pow(1.-n.z,3.7);
          float longitude=atan(t.x,t.z),latitude=asin(clamp(t.y,-1.,1.));float grid=(1.-smoothstep(.015,.065,abs(sin(longitude*24.))))+(1.-smoothstep(.012,.06,abs(sin(latitude*30.))));
          vec2 cell=floor(vec2(longitude*80.,latitude*80.));float seed=fract(sin(dot(cell,vec2(127.1,311.7)))*43758.5453);float points=step(.986,seed)*(1.-smoothstep(.08,.22,length(fract(vec2(longitude*80.,latitude*80.))-.5)));
          vec3 color=vec3(.004,.007,.011)+diffuse*vec3(.015,.027,.039)+spec*vec3(.20,.25,.29)+rim*vec3(.06,.14,.20);color+=grid*.004*vec3(.4,.7,1.)+points*.09*vec3(.4,.7,.85);gl_FragColor=vec4(pow(color,vec3(.8)),1.-smoothstep(.988,1.,r));}`);
        const program=gl.createProgram();gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('Core material unavailable');gl.deleteShader(vertex);gl.deleteShader(fragment);this.program=program;
        this.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);this.position=gl.getAttribLocation(program,'position');this.yaw=gl.getUniformLocation(program,'yaw');this.pitch=gl.getUniformLocation(program,'pitch');
      }catch{this.gl=null;}
    }
    draw(size,yaw,pitch){const gl=this.gl;if(!gl||gl.isContextLost())return;const pixels=Math.round(Math.min(480,size*Math.min(root.devicePixelRatio||1,2)));if(this.canvas.width!==pixels){this.canvas.width=pixels;this.canvas.height=pixels;}gl.viewport(0,0,pixels,pixels);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(this.program);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.enableVertexAttribArray(this.position);gl.vertexAttribPointer(this.position,2,gl.FLOAT,false,0,0);gl.uniform1f(this.yaw,yaw);gl.uniform1f(this.pitch,pitch);gl.drawArrays(gl.TRIANGLES,0,6);}
    destroy(){if(this.gl){this.gl.deleteBuffer(this.buffer);this.gl.deleteProgram(this.program);}}
  }
  class CustomerSpatialRuntime {
    constructor(canvas){
      this.available=true;this.rotation=new M.Rotation();this.nodes=[];this.generation=0;this.disposers=[];this.coreMaterial=new IntelligenceCore();this.poseKey=null;this.graphVersion=0;
      this.viewport=el('div','spatial-viewport');this.viewport.tabIndex=0;this.viewport.setAttribute('role','region');this.viewport.setAttribute('aria-label','Foundly ruimtelijk klantdashboard. Pauzeer om met slepen of pijltjestoetsen te draaien.');
      this.fit=el('div','spatial-fit');this.world=el('div','spatial-world');this.fit.append(this.world);this.viewport.append(this.fit);
      this.controls=el('div','spatial-controls');this.toggle=el('button','','Pauzeer rotatie');this.toggle.type='button';this.toggle.setAttribute('aria-pressed','false');this.indicator=el('span','','Automatische rotatie actief');this.indicator.setAttribute('role','status');this.controls.append(this.toggle,this.indicator);
      this.status=el('div','spatial-status','Klantmodules laden…');this.status.setAttribute('role','status');
      document.body.classList.add('foundly-spatial');document.body.append(this.viewport,this.controls,this.status);
      this.listen(this.toggle,'click',()=>this.setPaused(this.rotation.running));
      this.listen(root,'resize',()=>this.resize());
      this.listen(document,'visibilitychange',()=>{this.lastFrame=null;if(document.hidden){cancelAnimationFrame(this.frame);this.frame=null;}else{this.refresh();if(this.rotation.running&&this.animate&&!this.frame)this.frame=requestAnimationFrame(this.animate);}});
      this.listen(root,'focus',()=>this.refresh());
      this.listen(this.viewport,'pointerdown',e=>{if(this.rotation.running||e.target.closest('a'))return;this.drag={id:e.pointerId,x:e.clientX,y:e.clientY};this.viewport.setPointerCapture(e.pointerId);});
      this.listen(this.viewport,'pointermove',e=>{if(!this.drag||this.drag.id!==e.pointerId)return;this.rotation.manual((e.clientX-this.drag.x)*.004,(e.clientY-this.drag.y)*-.004);this.drag={id:e.pointerId,x:e.clientX,y:e.clientY};this.renderPose();});
      for(const event of ['pointerup','pointercancel','lostpointercapture'])this.listen(this.viewport,event,()=>{this.drag=null;});
      this.listen(this.viewport,'keydown',e=>{if(e.target!==this.viewport||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();this.setPaused(true);this.rotation.manual(e.key==='ArrowLeft'?-.08:e.key==='ArrowRight'?.08:0,e.key==='ArrowUp'?-.06:e.key==='ArrowDown'?.06:0);this.renderPose();});
      // Keyboard inspection does not chase moving links or lose its view angle.
      this.listen(this.world,'focusin',()=>this.setPaused(true));
      this.listen(this.world,'click',e=>this.activate(e));
      const motion=root.matchMedia?.('(prefers-reduced-motion: reduce)');
      if(motion?.matches)this.setPaused(true);
      if(motion?.addEventListener)this.listen(motion,'change',event=>{if(event.matches)this.setPaused(true);});
      this.resize();this.setGraph({nodes:[],edges:[]});this.refresh();
      this.timer=setInterval(()=>{if(!document.hidden)this.refresh();},60000);
      this.animate=time=>{this.frame=null;if(!this.available||document.hidden||!this.rotation.running)return;this.rotation.step(this.lastFrame===null||this.lastFrame===undefined?0:(time-this.lastFrame)/1000);this.renderPose();this.lastFrame=time;this.frame=requestAnimationFrame(this.animate);};
      if(this.rotation.running)this.frame=requestAnimationFrame(this.animate);
    }
    listen(target,type,fn){target.addEventListener(type,fn);this.disposers.push(()=>target.removeEventListener(type,fn));}
    async read(path){const response=await fetch(path,{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}});if(!response.ok)throw Error(`HTTP ${response.status}`);return response.json();}
    async snapshot(){
      const [composition,navigation,catalog]=await Promise.all([this.read('/api/composition'),this.read('/api/workspaces'),this.read('/api/composition/catalog')]);
      const resolution=composition.resolution;
      // Source registry is optional; failed/forbidden providers never become nodes.
      const social=resolution?.visible_modules?.includes('marketing')&&resolution?.capabilities?.includes('marketing:campaigns');
      const sources=social?await this.read('/api/source-registry?module=marketing').catch(()=>({sources:[]})):{sources:[]};
      const current=await this.read('/api/composition');
      if(M.signature(current.resolution)!==M.signature(resolution))throw Error('Klantconfiguratie is gewijzigd');
      return M.buildGraph({resolution,navigation,catalog:catalog.modules,sources:sources.sources});
    }
    async refresh(){
      const generation=++this.generation;
      // Remove stale access immediately on session/visibility refresh.
      this.world.inert=true;
      try{const graph=await this.snapshot();if(generation!==this.generation||!this.available)return;this.setGraph(graph);this.status.textContent=graph.nodes.length?'':'Geen toegankelijke klantmodules.';}
      catch(error){if(generation!==this.generation||!this.available)return;this.setGraph({nodes:[],edges:[]});this.status.textContent='Klantmodules niet beschikbaar. Vernieuw de pagina om opnieuw te controleren.';}
      finally{if(generation===this.generation)this.world.inert=false;}
    }
    async activate(event){
      const link=event.target.closest('a[data-spatial-node]');if(!link)return;
      event.preventDefault();const id=link.dataset.spatialNode,generation=++this.generation;this.setPaused(true);this.world.inert=true;
      try{const graph=await this.snapshot();if(!this.available||generation!==this.generation)return;const current=graph.nodes.find(n=>n.id===id);this.setGraph(graph);if(current)location.assign(current.href);else this.status.textContent='Deze functie is niet meer beschikbaar voor jouw account.';}
      catch{if(generation!==this.generation||!this.available)return;this.setGraph({nodes:[],edges:[]});this.status.textContent='Toegang kon niet worden gecontroleerd.';}
      finally{if(generation===this.generation)this.world.inert=false;}
    }
    setGraph(graph){
      if(this.graph&&JSON.stringify(this.graph.nodes)===JSON.stringify(graph.nodes)&&JSON.stringify(this.graph.edges)===JSON.stringify(graph.edges)){this.graph=graph;return;}
      this.graph=graph;this.nodes=[];this.lines=[];this.graphVersion++;this.composition=null;this.world.replaceChildren();
      for(const edge of graph.edges){const line=el('div','spatial-line'+(edge.from==='core'?'':' spatial-line--sub'));line.setAttribute('aria-hidden','true');line.style.setProperty('--accent',edge.color);this.world.append(line);this.lines.push({line,edge});}
      for(let i=0;i<110;i++){const dust=el('i','spatial-dust');dust.setAttribute('aria-hidden','true');const radius=.3+.7*((i*37%109)/109);dust.style.transform=`translate3d(${Math.sin(i*19.1)*this.box.width*.45*radius}px,${Math.cos(i*7.3)*this.box.height*.4*radius}px,${Math.sin(i*13.7)*480*radius}px)`;this.world.append(dust);}
      // Tertiary paths lie in separate real depth planes around the intelligence core.
      for(let ring=0;ring<2;ring++)for(let i=0;i<44;i++){const point=t=>[Math.cos(t)*(175+ring*22),Math.sin(t)*(38+ring*12),Math.sin(t)*(125+ring*35)],from=point(i*Math.PI*2/44),to=point((i+1)*Math.PI*2/44),segment=M.segment(from,to),line=el('i','spatial-orbit');line.setAttribute('aria-hidden','true');line.style.width=`${segment.length}px`;line.style.transform=`translate3d(${from.join('px,')}px) rotateZ(${segment.roll}rad) rotateY(${segment.yaw}rad)`;this.world.append(line);}
      for(const node of [{id:'core',kind:'core',position:[0,0,0]},...graph.nodes]){
        const host=el('div',`spatial-node spatial-${node.kind}`),face=el(node.kind==='core'?'div':'a','spatial-face');host.dataset.node=node.id;host.style.transform=`translate3d(${node.position.join('px,')}px)`;host.style.setProperty('--accent',node.color||'#a8b8c6');
        if(node.kind==='core'){face.append(this.coreMaterial.canvas,el('strong','','FOUNDLY'),el('small','','INTELLIGENCE IN MOTION'));}
        else {face.href=node.href;face.dataset.spatialNode=node.id;face.setAttribute('title',node.label);face.setAttribute('aria-label',node.kind==='subnode'?`${node.label} · ${M.MODULES.find(m=>m.id===node.parent).label}`:node.label);if(node.kind==='module'){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),path=document.createElementNS(svg.namespaceURI,'path');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');path.setAttribute('d',ICONS[node.id]);svg.append(path);face.append(svg);}face.append(el('span','',node.label));}
        host.append(face);this.world.append(host);this.nodes.push({host,face,node});
      }
      for(const [id,value] of [['mainCount',graph.nodes.filter(n=>n.kind==='module').length],['subCount',graph.nodes.filter(n=>n.kind==='subnode').length],['linkCount',graph.edges.length]]){const counter=document.getElementById(id);if(counter)counter.textContent=String(value);}
      this.measureNeeded=true;this.renderPose();
    }
    resize(){this.box=this.viewport.getBoundingClientRect();this.viewport.classList.toggle?.('spatial-compact',this.box.width<760||this.box.height<440);this.fit.style.transform='none';this.viewport.style.perspective='1500px';this.graphVersion++;this.composition=null;this.measureNeeded=true;if(this.graph)this.renderPose();}
    renderPose(){
      const {yaw,pitch}=this.rotation,key=`${yaw}:${pitch}:${this.graphVersion}`;if(key===this.poseKey)return;
      this.poseKey=key;if(!this.graph)return;
      const compact=this.box.width<760||this.box.height<440;
      if(this.measureNeeded){this.sizes={};for(const {face,node} of this.nodes)if(node.id!=='core'){const module=node.kind==='module';this.sizes[node.id]={width:face.offsetWidth||(module?(compact?96:node.label.length*8+48):(compact?12:node.label.length*7+22)),height:face.offsetHeight||(module?(compact?46:42):(compact?12:26))};}this.measureNeeded=false;}
      this.composition=M.compose(this.graph,{width:this.box.width,height:this.box.height,yaw,pitch,sizes:this.sizes,previous:this.composition});
      this.viewport.style.setProperty('--core-size',`${this.composition.core}px`);this.world.style.transform=`rotateX(${pitch}rad) rotateY(${yaw}rad)`;
      const placed=new Map(this.composition.nodes.map(n=>[n.id,n])),positions=new Map([['core',[0,0,0]],...this.composition.nodes.map(n=>[n.id,n.position])]);
      for(const {host,face,node} of this.nodes){const pose=placed.get(node.id);if(pose)host.style.transform=`translate3d(${pose.position.join('px,')}px)`;face.style.transform=`rotateY(${-yaw}rad) rotateX(${-pitch}rad) scale(${pose?.scale||1}) translate(-50%,-50%)`;host.style.setProperty('--depth-ink',String(pose?Math.max(.7,Math.min(1,.9+pose.depth/2000)):1));}
      for(const {line,edge} of this.lines){const from=positions.get(edge.from),to=positions.get(edge.to);if(!from||!to)continue;const s=M.segment(M.rotated(from,yaw,pitch),M.rotated(to,yaw,pitch));line.style.width=`${s.length}px`;line.style.transform=`translate3d(${from.join('px,')}px) rotateY(${-yaw}rad) rotateX(${-pitch}rad) rotateZ(${s.roll}rad) rotateY(${s.yaw}rad)`;}
      this.coreMaterial.draw(this.composition.core,yaw,pitch);
    }
    setPaused(paused){paused?this.rotation.pause():this.rotation.resume();this.toggle.textContent=paused?'Hervat rotatie':'Pauzeer rotatie';this.toggle.setAttribute('aria-pressed',String(paused));this.indicator.textContent=paused?'Rotatie gepauzeerd · sleep om te bekijken':'Automatische rotatie actief';this.lastFrame=null;if(paused){cancelAnimationFrame(this.frame);this.frame=null;}else if(this.animate&&!this.frame&&!document.hidden)this.frame=requestAnimationFrame(this.animate);}
    route(){return false;} event(){return false;} setState(state){this.state=state;} setAudio(){} setQuality(){return true;} setAutoQuality(){} focus(){this.setPaused(true);} focusCore(){return true;}
    cameraCommand(command){const type=typeof command==='string'?command:command.type;if(type==='RESET_CAMERA'){this.rotation.yaw=0;this.rotation.pitch=-.08;this.renderPose();}else if(type==='ROTATE_VIEW'){this.setPaused(true);this.rotation.manual(Number(command.yaw)||0,Number(command.pitch)||0);this.renderPose();}return true;}
    destroy(){this.coreMaterial.destroy();this.available=false;this.generation++;clearInterval(this.timer);cancelAnimationFrame(this.frame);this.disposers.forEach(fn=>fn());this.viewport.remove();this.controls.remove();this.status.remove();document.body.classList.remove('foundly-spatial');}
  }
  root.FoundlyCustomerSpatialRuntime=CustomerSpatialRuntime;
})(window);
