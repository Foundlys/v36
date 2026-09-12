'use strict';
(function(root){
  const M=root.FoundlySpatialModel;
  const ICONS={inkoop:'M4 7h16l-2 10H7L4 4H2 M8 21h.01 M17 21h.01',verkoop:'M3 16l6-6 4 3 8-9 M15 4h6v6',finance:'M4 21V9 M10 21V4 M16 21v-9 M22 21H2',crm:'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M2 21v-3a7 7 0 0 1 14 0v3 M17 5a3 3 0 0 1 0 6 M19 15a5 5 0 0 1 3 5',agenda:'M4 5h16v16H4z M4 10h16 M8 2v6 M16 2v6 M8 14h3',mail:'M2 5h20v14H2z M2 5l10 8L22 5',social:'M12 7a3 3 0 1 0 0-6 3 3 0 0 0 0 6 M5 23a3 3 0 1 0 0-6 3 3 0 0 0 0 6 M20 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6 M10 7l-4 10 M14 7l5 8 M8 20l9-2',marketing:'M3 10v6h5l10 5V4L8 10z M8 16l2 6 M21 9v7',analytics:'M3 3v18h19 M6 16l4-7 5 4 6-9'};
  const el=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls||'';if(text!==undefined)n.textContent=text;return n;};
  class CustomerSpatialRuntime {
    constructor(canvas){
      this.available=true;this.rotation=new M.Rotation();this.nodes=[];this.generation=0;this.disposers=[];
      this.viewport=el('div','spatial-viewport');this.viewport.tabIndex=0;this.viewport.setAttribute('role','region');this.viewport.setAttribute('aria-label','Foundly ruimtelijk klantdashboard. Pauzeer om met slepen of pijltjestoetsen te draaien.');
      this.fit=el('div','spatial-fit');this.world=el('div','spatial-world');this.fit.append(this.world);this.viewport.append(this.fit);
      this.controls=el('div','spatial-controls');this.toggle=el('button','','Pauzeer rotatie');this.toggle.type='button';this.toggle.setAttribute('aria-pressed','false');this.indicator=el('span','','Automatische rotatie actief');this.indicator.setAttribute('role','status');this.controls.append(this.toggle,this.indicator);
      this.status=el('div','spatial-status','Klantmodules laden…');this.status.setAttribute('role','status');
      document.body.classList.add('foundly-spatial');document.body.append(this.viewport,this.controls,this.status);
      this.listen(this.toggle,'click',()=>this.setPaused(this.rotation.running));
      this.listen(root,'resize',()=>this.resize());
      this.listen(document,'visibilitychange',()=>{this.lastFrame=null;if(!document.hidden)this.refresh();});
      this.listen(root,'focus',()=>this.refresh());
      this.listen(this.viewport,'pointerdown',e=>{if(this.rotation.running||e.target.closest('a'))return;this.drag={id:e.pointerId,x:e.clientX,y:e.clientY};this.viewport.setPointerCapture(e.pointerId);});
      this.listen(this.viewport,'pointermove',e=>{if(!this.drag||this.drag.id!==e.pointerId)return;this.rotation.manual((e.clientX-this.drag.x)*.004,(e.clientY-this.drag.y)*-.004);this.drag={id:e.pointerId,x:e.clientX,y:e.clientY};this.renderPose();});
      for(const event of ['pointerup','pointercancel','lostpointercapture'])this.listen(this.viewport,event,()=>{this.drag=null;});
      this.listen(this.viewport,'keydown',e=>{if(e.target!==this.viewport||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();this.setPaused(true);this.rotation.manual(e.key==='ArrowLeft'?-.08:e.key==='ArrowRight'?.08:0,e.key==='ArrowUp'?-.06:e.key==='ArrowDown'?.06:0);this.renderPose();});
      // Keyboard inspection does not chase moving links or lose its view angle.
      this.listen(this.world,'focusin',()=>this.setPaused(true));
      this.listen(this.world,'click',e=>this.activate(e));
      this.resize();this.setGraph({nodes:[],edges:[]});this.refresh();
      this.timer=setInterval(()=>{if(!document.hidden)this.refresh();},60000);
      const frame=time=>{if(!this.available)return;if(!document.hidden){this.rotation.step(this.lastFrame===null||this.lastFrame===undefined?0:(time-this.lastFrame)/1000);this.renderPose();}this.lastFrame=time;this.frame=requestAnimationFrame(frame);};
      this.frame=requestAnimationFrame(frame);
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
      this.graph=graph;this.nodes=[];this.world.replaceChildren();
      const positions=new Map([['core',[0,0,0]],...graph.nodes.map(n=>[n.id,n.position])]);
      const drawLine=(from,to,color,kind='')=>{const s=M.segment(from,to),line=el('div','spatial-line'+kind);line.setAttribute('aria-hidden','true');line.style.setProperty('--accent',color);line.style.width=`${s.length}px`;line.style.transform=`translate3d(${from[0]}px,${from[1]}px,${from[2]}px) rotateZ(${s.roll}rad) rotateY(${s.yaw}rad)`;this.world.append(line);};
      for(const edge of graph.edges){
        const from=positions.get(edge.from),to=positions.get(edge.to);if(!from||!to)continue;
        drawLine(from,to,edge.color,edge.from==='core'?'':' spatial-line--sub');
        // Fine 3D strands follow existing authorized connections; they add no nodes or relationships.
        if(edge.from==='core')for(const side of [-1,1]){let previous=from;for(let i=1;i<=12;i++){const t=i/12,bend=Math.sin(Math.PI*t)*side,next=from.map((v,axis)=>v+(to[axis]-v)*t+bend*[18,38,60][axis]);drawLine(previous,next,edge.color,' spatial-line--filament');previous=next;}}
      }
      // Static depth detail belongs to the rotating world, never to a fake activity feed.
      for(let i=0;i<240;i++){const dust=el('i','spatial-dust');dust.setAttribute('aria-hidden','true');const radius=.35+.65*((i*37%239)/239);dust.style.transform=`translate3d(${Math.sin(i*19.1)*560*radius}px,${Math.cos(i*7.3)*380*radius}px,${Math.sin(i*13.7)*450*radius}px)`;this.world.append(dust);}
      for(const node of [{id:'core',kind:'core',position:[0,0,0]},...graph.nodes]){
        const host=el('div',`spatial-node spatial-${node.kind}`),face=el(node.kind==='core'?'div':'a','spatial-face');host.dataset.node=node.id;host.style.transform=`translate3d(${node.position.join('px,')}px)`;host.style.setProperty('--accent',node.color||'#a8b8c6');
        if(node.kind==='core'){face.append(el('strong','','FOUNDLY'),el('small','','INTELLIGENCE IN MOTION'));}
        else {face.href=node.href;face.dataset.spatialNode=node.id;face.setAttribute('aria-label',node.kind==='subnode'?`${node.label} · ${M.MODULES.find(m=>m.id===node.parent).label}`:node.label);if(node.kind==='module'){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),path=document.createElementNS(svg.namespaceURI,'path');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');path.setAttribute('d',ICONS[node.id]);svg.append(path);face.append(svg);}face.append(el('span','',node.label));}
        host.append(face);this.world.append(host);this.nodes.push({host,face,node});
      }
      for(const [id,value] of [['mainCount',graph.nodes.filter(n=>n.kind==='module').length],['subCount',graph.nodes.filter(n=>n.kind==='subnode').length],['linkCount',graph.edges.length]]){const counter=document.getElementById(id);if(counter)counter.textContent=String(value);}
      this.renderPose();
    }
    resize(){const box=this.viewport.getBoundingClientRect();this.scale=Math.max(.15,Math.min(1.18,box.width/1400,box.height/900));this.fit.style.transform=`scale3d(${this.scale},${this.scale},${this.scale})`;this.viewport.style.perspective=`${1500*this.scale}px`;this.viewport.style.setProperty('--label-factor',String(Math.max(1,.55/this.scale)));}
    renderPose(){const {yaw,pitch}=this.rotation;this.world.style.transform=`rotateX(${pitch}rad) rotateY(${yaw}rad)`;for(const {face} of this.nodes)face.style.transform=`rotateY(${-yaw}rad) rotateX(${-pitch}rad) translate(-50%,-50%)`;}
    setPaused(paused){paused?this.rotation.pause():this.rotation.resume();this.toggle.textContent=paused?'Hervat rotatie':'Pauzeer rotatie';this.toggle.setAttribute('aria-pressed',String(paused));this.indicator.textContent=paused?'Rotatie gepauzeerd · sleep om te bekijken':'Automatische rotatie actief';this.lastFrame=null;}
    route(){return false;} event(){return false;} setState(state){this.state=state;} setAudio(){} setQuality(){return true;} setAutoQuality(){} focus(){this.setPaused(true);} focusCore(){return true;}
    cameraCommand(command){const type=typeof command==='string'?command:command.type;if(type==='RESET_CAMERA'){this.rotation.yaw=0;this.rotation.pitch=-.08;this.renderPose();}else if(type==='ROTATE_VIEW'){this.setPaused(true);this.rotation.manual(Number(command.yaw)||0,Number(command.pitch)||0);this.renderPose();}return true;}
    destroy(){this.available=false;this.generation++;clearInterval(this.timer);cancelAnimationFrame(this.frame);this.disposers.forEach(fn=>fn());this.viewport.remove();this.controls.remove();this.status.remove();document.body.classList.remove('foundly-spatial');}
  }
  root.FoundlyCustomerSpatialRuntime=CustomerSpatialRuntime;
})(window);
