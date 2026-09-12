'use strict';
(function(root){
  const M=root.FoundlySpatialModel;
  const ICONS={inkoop:'M4 7h16l-2 10H7L4 4H2 M8 21h.01 M17 21h.01',verkoop:'M3 16l6-6 4 3 8-9 M15 4h6v6',finance:'M4 21V9 M10 21V4 M16 21v-9 M22 21H2',crm:'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M2 21v-3a7 7 0 0 1 14 0v3 M17 5a3 3 0 0 1 0 6 M19 15a5 5 0 0 1 3 5',agenda:'M4 5h16v16H4z M4 10h16 M8 2v6 M16 2v6 M8 14h3',mail:'M2 5h20v14H2z M2 5l10 8L22 5',social:'M12 7a3 3 0 1 0 0-6 3 3 0 0 0 0 6 M5 23a3 3 0 1 0 0-6 3 3 0 0 0 0 6 M20 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6 M10 7l-4 10 M14 7l5 8 M8 20l9-2',marketing:'M3 10v6h5l10 5V4L8 10z M8 16l2 6 M21 9v7',analytics:'M3 3v18h19 M6 16l4-7 5 4 6-9'};
  const el=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls||'';if(text!==undefined)n.textContent=text;return n;};
  class CustomerSpatialRuntime {
    constructor(canvas){
      this.available=true;this.rotation=new M.Rotation();this.nodes=[];this.generation=0;this.disposers=[];this.sceneCanvas=el('canvas','spatial-scene');this.sceneCanvas.setAttribute('aria-hidden','true');this.scene=new root.FoundlyReferenceScene.Scene(this.sceneCanvas,ICONS);this.poseKey=null;this.graphVersion=0;
      this.viewport=el('div','spatial-viewport');this.viewport.tabIndex=0;this.viewport.setAttribute('role','region');this.viewport.setAttribute('aria-label','Foundly ruimtelijk klantdashboard. Pauzeer om met slepen of pijltjestoetsen te draaien.');
      this.fit=el('div','spatial-fit');this.world=el('div','spatial-world');this.fit.append(this.world);this.viewport.append(this.sceneCanvas,this.fit);
      this.controls=el('div','spatial-controls');this.toggle=el('button','','Pauzeer rotatie');this.toggle.type='button';this.toggle.setAttribute('aria-pressed','false');this.indicator=el('span','','Automatische rotatie actief');this.indicator.setAttribute('role','status');this.controls.append(this.toggle,this.indicator);
      this.status=el('div','spatial-status','Klantmodules laden…');this.status.setAttribute('role','status');
      document.body.classList.add('foundly-spatial');document.body.append(this.viewport,this.controls,this.status);this.installFrame();
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
      this.world.inert=true;if(this.sidebar)this.sidebar.inert=true;if(this.searchResults)this.searchResults.inert=true;
      try{const graph=await this.snapshot();if(generation!==this.generation||!this.available)return;this.setGraph(graph);this.status.textContent=graph.nodes.length?'':'Geen toegankelijke klantmodules.';}
      catch(error){if(generation!==this.generation||!this.available)return;this.setGraph({nodes:[],edges:[]});this.status.textContent='Klantmodules niet beschikbaar. Vernieuw de pagina om opnieuw te controleren.';}
      finally{if(generation===this.generation){this.world.inert=false;if(this.sidebar)this.sidebar.inert=false;if(this.searchResults)this.searchResults.inert=false;}}
    }
    async activate(event){
      const link=event.target.closest('a[data-spatial-node]');if(!link)return;
      event.preventDefault();const id=link.dataset.spatialNode,generation=++this.generation;this.setPaused(true);this.world.inert=true;if(this.sidebar)this.sidebar.inert=true;if(this.searchResults)this.searchResults.inert=true;
      try{const graph=await this.snapshot();if(!this.available||generation!==this.generation)return;const current=graph.nodes.find(n=>n.id===id);this.setGraph(graph);if(current)location.assign(current.href);else this.status.textContent='Deze functie is niet meer beschikbaar voor jouw account.';}
      catch{if(generation!==this.generation||!this.available)return;this.setGraph({nodes:[],edges:[]});this.status.textContent='Toegang kon niet worden gecontroleerd.';}
      finally{if(generation===this.generation){this.world.inert=false;if(this.sidebar)this.sidebar.inert=false;if(this.searchResults)this.searchResults.inert=false;}}
    }
    installFrame(){
      this.chrome=el('div','reference-chrome');const brand=el('div','reference-brand');brand.append(el('strong','','FOUNDLY'),el('small','','INTELLIGENCE IN MOTION'));
      this.sidebar=el('nav','reference-sidebar');this.sidebar.setAttribute('aria-label','Klantmodules');
      const home=el('a','reference-home','⌂  Home');home.href='/';home.setAttribute('aria-current','page');this.sidebar.append(home);
      const searchWrap=el('label','reference-search'),search=el('input');search.type='search';search.placeholder='Zoek in Foundly…';search.setAttribute('aria-label','Zoek beschikbare Foundly-functies');searchWrap.append(search);this.searchResults=el('div','reference-search-results');this.searchResults.hidden=true;searchWrap.append(this.searchResults);
      this.listen(search,'input',()=>{const q=search.value.trim().toLocaleLowerCase('nl-NL');this.searchResults.replaceChildren();this.searchResults.hidden=!q;if(q)for(const n of (this.graph?.nodes||[]).filter(n=>n.label.toLocaleLowerCase('nl-NL').includes(q))){const a=el('a','',n.label);a.href=n.href;a.dataset.spatialNode=n.id;this.searchResults.append(a);}});
      this.listen(this.searchResults,'click',e=>this.activate(e));this.listen(this.sidebar,'click',e=>this.activate(e));
      const tools=el('div','reference-tools'),notifications=el('button','reference-bell'),profile=el('button','reference-profile','○'),bell=document.createElementNS('http://www.w3.org/2000/svg','svg'),bellPath=document.createElementNS('http://www.w3.org/2000/svg','path');bell.setAttribute('viewBox','0 0 24 24');bellPath.setAttribute('d','M5 17h14l-2-3V9a5 5 0 0 0-10 0v5z M10 20h4');bell.append(bellPath);notifications.append(bell);notifications.type=profile.type='button';notifications.setAttribute('aria-label','Recente Foundly-activiteit');profile.setAttribute('aria-label','Open Foundly-navigatie');this.notice=el('div','reference-notices');this.notice.hidden=true;this.listen(notifications,'click',async()=>{this.notice.hidden=!this.notice.hidden;if(this.notice.hidden)return;this.notice.replaceChildren(el('p','','Activiteit laden…'));const generation=this.generation;try{const result=await this.read('/api/events');if(generation!==this.generation)return;this.notice.replaceChildren(...(result.events||[]).slice(0,8).map(e=>el('p','',String(e.message||''))));if(!this.notice.children.length)this.notice.append(el('p','','Geen recente activiteit.'));}catch{this.notice.replaceChildren(el('p','','Activiteit niet beschikbaar.'));}});this.listen(profile,'click',()=>document.querySelector('.FoundlyOsLauncher')?.click());tools.append(notifications,profile,this.notice);
      this.live=el('aside','reference-live');this.live.setAttribute('aria-label','Actuele klantstatus');this.live.append(el('b','','Status controleren'),el('small','','Klantomgeving'));
      const ai=el('button','reference-ai'),orb=el('span','reference-ai-orb','◉'),aiText=el('span');ai.type='button';aiText.append(el('b','','FOUNDLY AI'),el('small','','Altijd een stap vooruit.'));ai.append(orb,aiText);this.listen(ai,'click',()=>{document.body.classList.add('reference-command-open');document.getElementById('command')?.focus();});
      const slogan=el('div','reference-slogan','CONNECT · AUTOMATE · SELL · GROW');this.chrome.append(brand,this.sidebar,searchWrap,tools,this.live,ai,slogan);document.body.append(this.chrome);
      this.controls.prepend?.(el('strong','reference-360','◇  360° View'));
    }
    setGraph(graph){
      if(this.graph&&JSON.stringify(this.graph.nodes)===JSON.stringify(graph.nodes)&&JSON.stringify(this.graph.edges)===JSON.stringify(graph.edges)){this.graph=graph;return;}
      this.graph=graph;this.nodes=[];this.graphVersion++;this.world.replaceChildren();try{this.scene.setGraph(graph);}catch(error){this.scene.available=false;this.scene.error=String(error.message);}
      this.searchResults?.replaceChildren();if(this.notice){this.notice.replaceChildren();this.notice.hidden=true;}
      if(this.sidebar){const home=this.sidebar.children[0];this.sidebar.replaceChildren(home);for(const n of graph.nodes.filter(n=>n.kind==='module')){const a=el('a','',n.label),svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),path=document.createElementNS('http://www.w3.org/2000/svg','path');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');path.setAttribute('d',ICONS[n.id]);svg.append(path);a.prepend?.(svg);a.href=n.href;a.dataset.spatialNode=n.id;this.sidebar.append(a);}}
      this.live?.replaceChildren(el('b','',graph.nodes.length?'● Verbonden':'Status niet beschikbaar'),el('small','','Klantomgeving'),el('div','reference-live-row',`${graph.nodes.filter(n=>n.kind==='module').length}  Actieve modules`),el('div','reference-live-row',`${graph.nodes.filter(n=>n.kind==='subnode').length}  Beschikbare functies`));
      for(const node of graph.nodes){const host=el('div',`spatial-node spatial-${node.kind}`),face=el('a','spatial-face',node.label);host.dataset.node=node.id;face.href=node.href;face.dataset.spatialNode=node.id;face.setAttribute('aria-label',node.kind==='subnode'?`${node.label} · ${M.MODULES.find(m=>m.id===node.parent).label}`:node.label);host.append(face);this.world.append(host);this.nodes.push({host,face,node});}
      for(const [id,value] of [['mainCount',graph.nodes.filter(n=>n.kind==='module').length],['subCount',graph.nodes.filter(n=>n.kind==='subnode').length],['linkCount',graph.edges.length]]){const counter=document.getElementById(id);if(counter)counter.textContent=String(value);}
      this.renderPose();
    }
    resize(){this.box=this.viewport.getBoundingClientRect();try{this.scene.resize(this.box.width,this.box.height);}catch(error){this.scene.available=false;this.scene.error=String(error.message);}this.graphVersion++;if(this.graph)this.renderPose();}
    renderPose(){
      const {yaw,pitch,roll,time}=this.rotation,key=`${yaw}:${pitch}:${roll}:${time}:${this.graphVersion}`;if(key===this.poseKey)return;this.poseKey=key;
      this.world.dataset.orientation=`${yaw},${pitch},${roll}`;this.world.style.transform='none';
      try{this.scene.draw(this.rotation);}catch(error){this.scene.available=false;this.scene.error=String(error.message);}
      const positions=new Map(this.scene.projected(this.rotation).map(n=>[n.id,n]));
      for(const {host,face,node} of this.nodes){const p=positions.get(node.id);if(!p)continue;host.style.transform=`translate(${p.x}px,${p.y}px)`;host.style.zIndex=String(Math.round(p.depth+2000));host.hidden=p.occluded;face.tabIndex=p.occluded?-1:0;face.style.width=`${(node.kind==='module'?160:Math.max(80,node.label.length*7.5+15))*p.unit*p.scale}px`;face.style.height=`${(node.kind==='module'?82:32)*p.unit*p.scale}px`;}
      if(!this.scene.available){this.status.textContent='3D-weergave niet beschikbaar. Gebruik de module-navigatie.';this.viewport.classList.add('spatial-unavailable');this.controls.hidden=true;}
    }
    setPaused(paused){paused?this.rotation.pause():this.rotation.resume();this.toggle.textContent=paused?'Hervat rotatie':'Pauzeer rotatie';this.toggle.setAttribute('aria-pressed',String(paused));this.indicator.textContent=paused?'Rotatie gepauzeerd · sleep om te bekijken':'Automatische rotatie actief';this.lastFrame=null;if(paused){cancelAnimationFrame(this.frame);this.frame=null;}else if(this.animate&&!this.frame&&!document.hidden)this.frame=requestAnimationFrame(this.animate);}
    route(){return false;} event(){return false;} setState(state){this.state=state;} setAudio(){} setQuality(){return true;} setAutoQuality(){} focus(){this.setPaused(true);} focusCore(){return true;}
    cameraCommand(command){const type=typeof command==='string'?command:command.type;if(type==='RESET_CAMERA'){this.rotation.yaw=0;this.rotation.pitch=0;this.rotation.roll=0;this.rotation.time=0;this.renderPose();}else if(type==='ROTATE_VIEW'){this.setPaused(true);this.rotation.manual(Number(command.yaw)||0,Number(command.pitch)||0);this.renderPose();}return true;}
    destroy(){this.scene.destroy();this.chrome.remove();this.available=false;this.generation++;clearInterval(this.timer);cancelAnimationFrame(this.frame);this.disposers.forEach(fn=>fn());this.viewport.remove();this.controls.remove();this.status.remove();document.body.classList.remove('foundly-spatial');}
  }
  root.FoundlyCustomerSpatialRuntime=CustomerSpatialRuntime;
})(window);
