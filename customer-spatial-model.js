'use strict';
(function(root){
  const MODULES=[
    ['inkoop','INKOOP','procurement',[390,170,260],'#d95d65'],
    ['verkoop','VERKOOP','sales',[215,-75,-30],'#e2bd3f'],
    ['finance','FINANCE','finance',[430,320,-270],'#df6262'],
    ['crm','CRM','crm',[110,250,90],'#55c79b'],
    ['agenda','AGENDA','calendar',[-215,240,200],'#d5b55d'],
    ['mail','MAIL','communication',[10,-340,-320],'#58bdd2'],
    ['social','SOCIAL MEDIA','marketing',[-405,145,290],'#d86ab8'],
    ['marketing','MARKETING','marketing',[-350,-190,30],'#d59050'],
    ['analytics','ANALYTICS','analysis',[470,-260,-460],'#8db7e8']
  ].map(([id,label,owner,position,color])=>Object.freeze({id,label,owner,position:Object.freeze(position),color}));Object.freeze(MODULES);
  const LABELS={sourcing:'Sourcing',suppliers:'Leveranciers',opportunities:'Kansen',approvals:'Beoordelingen',pipeline:'Pipeline',forecast:'Prognose',quotes:'Offertes',contacts:'Contacten',companies:'Bedrijven',leads:'Leads',relationships:'Relaties',campaigns:'Campagnes',audiences:'Doelgroepen',attribution:'Attributie',ledger:'Grootboek',invoices:'Facturen',payments:'Betalingen',reports:'Rapporten',kpis:'KPI’s',events:'Events',funnel:'Funnel',availability:'Beschikbaarheid',conflicts:'Conflicten',inbox:'Inbox',drafts:'Concepten',threads:'Gesprekken'};
  const SECTIONS={'procurement:sourcing':'RFQS','procurement:approvals':'ORDERS','sales:opportunities':'OPPORTUNITIES','sales:pipeline':'PIPELINES','sales:forecast':'FORECAST','crm:relationships':'DEALS','calendar:events':'EVENTS','calendar:availability':'AVAILABILITY','calendar:conflicts':'CONFLICTS','communication:inbox':'INBOX','communication:drafts':'DRAFTS','communication:threads':'THREADS'};
  const ANCHORS={'finance:ledger':'ledger','finance:invoices':'receivables','finance:payments':'receivables','finance:reports':'result','analysis:kpis':'overview','analysis:events':'events','analysis:funnel':'funnel','analysis:reports':'history'};
  const PROVIDERS=[['Facebook',['facebook','facebook_pages']],['Instagram',['instagram']],['TikTok',['tiktok']]];
  function signature(resolution){return JSON.stringify([resolution?.tenant_id,resolution?.dealer_id,resolution?.revision,resolution?.visible_modules,resolution?.capabilities]);}
  function buildGraph({resolution,navigation,catalog,sources=[]}){
    const empty={nodes:[],edges:[],signature:signature(resolution)};if(!resolution?.tenant_id||!resolution?.dealer_id||navigation?.tenant?.tenant_id!==resolution.tenant_id||navigation?.tenant?.dealer_id!==resolution.dealer_id)return empty;
    const visible=new Set(resolution.visible_modules||[]),enabled=new Set(resolution.enabled_modules||[]),entitled=new Set(resolution.entitlements||[]),caps=new Set(resolution.capabilities||[]),workspaces=new Map((navigation.workspaces||[]).map(w=>[w.id,w])),definitions=new Map((catalog||[]).map(m=>[m.module_id,m])),nodes=[],edges=[];
    for(const spec of MODULES){const workspace=workspaces.get(spec.owner),definition=definitions.get(spec.owner);if(!visible.has(spec.owner)||!enabled.has(spec.owner)||!entitled.has(spec.owner)||!definition||workspace?.route!==`/${spec.owner}`)continue;const active=(definition.provided_capabilities||[]).filter(cap=>caps.has(cap));if(!active.length||spec.id==='social'&&!caps.has('marketing:campaigns'))continue;const href=spec.id==='social'?'/marketing?section=SOCIAL':workspace.route;nodes.push({...spec,kind:'module',href});edges.push({from:'core',to:spec.id,color:spec.color});let children;
      if(spec.id==='social'){children=PROVIDERS.flatMap(([label,ids])=>{const source=sources.find(s=>ids.includes(s.source_id)&&s.connection_status==='CONNECTED'&&s.runtime_enabled!==false);return source?[{id:source.source_id,label,href:'/marketing?section=SOCIAL',capability:'marketing:campaigns',source_id:source.source_id}]:[];});}
      else children=active.map(capability=>{const key=capability.split(':')[1],section=capability==='calendar:conflicts'?'EVENTS':SECTIONS[capability]||key.toUpperCase();return{id:key,label:LABELS[key]||key,capability,href:ANCHORS[capability]?`${workspace.route}#${ANCHORS[capability]}`:`${workspace.route}?section=${encodeURIComponent(section)}`};}).filter(child=>child.capability!=='calendar:conflicts'||caps.has('calendar:events'));
      const offsets=[[-100,-70,40],[115,-35,-80],[-80,85,-45],[80,100,65],[-145,10,-20],[150,30,45],[-25,-120,90],[35,135,-100]];
      children.forEach((child,i)=>{const offset=offsets[i%offsets.length],position=spec.position.map((v,axis)=>v+offset[axis]);const node={...child,id:`${spec.id}:${child.id}`,owner:spec.owner,parent:spec.id,kind:'subnode',position,color:spec.color};nodes.push(node);edges.push({from:spec.id,to:node.id,color:spec.color});});}
    return{nodes,edges,signature:signature(resolution)};
  }
  function rotated([x,y,z],yaw,pitch=0){const a=x*Math.cos(yaw)+z*Math.sin(yaw),b=-x*Math.sin(yaw)+z*Math.cos(yaw);return[a,y*Math.cos(pitch)-b*Math.sin(pitch),y*Math.sin(pitch)+b*Math.cos(pitch)];}
  function segment(from,to){const d=to.map((v,i)=>v-from[i]),length=Math.hypot(...d);return{length,yaw:Math.atan2(-d[2],Math.hypot(d[0],d[1])),roll:Math.atan2(d[1],d[0])};}
  class Rotation{constructor(){this.yaw=0;this.pitch=-.08;this.running=true;}step(seconds){if(this.running)this.yaw=(this.yaw+Math.min(Math.max(seconds,0),.1)*Math.PI*2/180)%(Math.PI*2);}pause(){this.running=false;}resume(){this.running=true;}manual(yaw,pitch=0){if(this.running)return;this.yaw+=yaw;this.pitch=Math.max(-.7,Math.min(.7,this.pitch+pitch));}}

  // Screen-space constraints steer real camera-space XYZ points. Z is never flattened.
  const clamp=(value,lo,hi)=>Math.max(lo,Math.min(hi,value));
  function project([x,y,z],distance=1500){const scale=distance/(distance-z);return {x:x*scale,y:y*scale,scale};}
  function unproject(x,y,z,distance=1500){const scale=(distance-z)/distance;return [x*scale,y*scale,z];}
  function inverseRotated([x,y,z],yaw,pitch){const b=-y*Math.sin(pitch)+z*Math.cos(pitch),a=y*Math.cos(pitch)+z*Math.sin(pitch);return [x*Math.cos(yaw)-b*Math.sin(yaw),a,x*Math.sin(yaw)+b*Math.cos(yaw)];}
  function overlap(a,b,gap=8){return Math.min(a.x+a.w/2,b.x+b.w/2)-Math.max(a.x-a.w/2,b.x-b.w/2)+gap>0&&Math.min(a.y+a.h/2,b.y+b.h/2)-Math.max(a.y-a.h/2,b.y-b.h/2)+gap>0;}
  function separate(boxes,width,height,obstacle,iterations=100){
    const margin=18,all=obstacle?[obstacle,...boxes]:boxes;
    for(let pass=0;pass<iterations;pass++){
      for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++){
        const a=all[i],b=all[j],dx=b.x-a.x,dy=b.y-a.y,ox=(a.w+b.w)/2+12-Math.abs(dx),oy=(a.h+b.h)/2+12-Math.abs(dy);
        if(ox<=0||oy<=0)continue;
        const room=(box,axis,sign)=>box.fixed?0:Math.max(0,(axis==='x'?width/2-box.w/2:height/2-box.h/2)-margin-sign*box[axis]);
        let axis=ox<oy?'x':'y',sign=(axis==='x'?dx:dy)>=0?1:-1,push=(axis==='x'?ox:oy)+.1;
        if(room(a,axis,-sign)+room(b,axis,sign)<push){axis=axis==='x'?'y':'x';sign=(axis==='x'?dx:dy)>=0?1:-1;push=(axis==='x'?ox:oy)+.1;}
        const ra=room(a,axis,-sign),rb=room(b,axis,sign),pa=Math.min(ra,Math.max(push/2,push-rb)),pb=Math.min(rb,push-pa);
        if(!a.fixed)a[axis]-=pa*sign;if(!b.fixed)b[axis]+=pb*sign;
      }
      for(const box of boxes){box.x=clamp(box.x,-width/2+margin+box.w/2,width/2-margin-box.w/2);box.y=clamp(box.y,-height/2+margin+box.h/2,height/2-margin-box.h/2);}
    }
    return boxes;
  }
  function compose(graph,{width,height,yaw=0,pitch=-.08,sizes={},previous=null}={}){
    width=Math.max(240,width||1280);height=Math.max(240,height||720);
    const compact=width<760||height<440,unit=clamp(Math.min(width/1350,height/820),.38,1.35),distance=1500,core=compact?clamp(Math.min(width*.3,height*.22),100,150):clamp(Math.min(width*.16,height*.29),125,235),modules=graph.nodes.filter(n=>n.kind==='module'),groups=[];
    for(const main of modules){
      const camera=rotated(main.position.map(v=>v*unit),yaw,pitch),projection=project(camera,distance),scale=clamp(projection.scale,compact?1:.84,compact?1.12:1.32),size=sizes[main.id]||{width:compact?96:135,height:compact?46:42};
      const parent={id:main.id,x:0,y:0,w:size.width*scale,h:size.height*scale,scale,camera,fixed:true};
      const children=graph.nodes.filter(n=>n.parent===main.id).map((node,i)=>{
        const local=node.position.map((v,k)=>(v-main.position[k])*unit),delta=rotated(local,yaw,pitch),z=camera[2]+delta[2],q=project([0,0,z],distance),sf=clamp(q.scale,.88,1.2),sz=sizes[node.id]||{width:compact?12:92,height:compact?12:25};
        // Different cluster phases and measured widths prevent identical mini-rings.
        const phase=(MODULES.findIndex(m=>m.id===main.id)%3-1)*.21,side=i%2===0?-1:1,row=Math.floor(i/2),dx=side*(compact?34:Math.max(56,sz.width*sf/2+8)),dy=(row%2===0?-1:1)*(compact?32:48+Math.floor(row/2)*34);
        return {id:node.id,x:compact?(i-(graph.nodes.filter(n=>n.parent===main.id).length-1)/2)*24:dx*Math.cos(phase)-dy*Math.sin(phase),y:compact?parent.h/2+23+(i%2)*3:dx*Math.sin(phase)+dy*Math.cos(phase),w:sz.width*sf,h:sz.height*sf,scale:sf,camera:[0,0,z]};
      });
      separate(children,compact?250:460,compact?220:400,parent,50);
      const members=[parent,...children],left=Math.min(...members.map(n=>n.x-n.w/2)),right=Math.max(...members.map(n=>n.x+n.w/2)),top=Math.min(...members.map(n=>n.y-n.h/2)),bottom=Math.max(...members.map(n=>n.y+n.h/2));
      const offset={x:(left+right)/2,y:(top+bottom)/2},old=previous?.groups?.find(g=>g.id===main.id);
      groups.push({id:main.id,x:projection.x+offset.x,y:projection.y+offset.y,w:right-left,h:bottom-top,offset,members,ideal:projection,old});
    }
    // Fit the actual active composition, with safe margins reserved for the measured clusters.
    const xmax=Math.max(1,...groups.map(g=>Math.abs(g.x)+g.w/2)),ymax=Math.max(1,...groups.map(g=>Math.abs(g.y)+g.h/2));
    const spreadX=clamp((width/2-28)/xmax,.55,modules.length>1?1.8:1.1),spreadY=clamp((height/2-28)/ymax,.55,modules.length>1?1.55:1.1);
    for(const g of groups){const tx=g.x*spreadX,ty=g.y*spreadY;g.x=g.old?g.old.x+(tx-g.old.x)*.025:tx;g.y=g.old?g.old.y+(ty-g.old.y)*.025:ty;}
    const obstacle={x:0,y:0,w:core+22,h:core+22,fixed:true};
    separate(groups,width,height,obstacle,previous?120:220);
    // Resolve remaining first-frame traps with a bounded deterministic placement search.
    if(!previous&&groups.some((g,i)=>overlap(g,obstacle)||groups.slice(i+1).some(b=>overlap(g,b)))){
      const placed=[obstacle];
      for(const g of [...groups].sort((a,b)=>b.w*b.h-a.w*a.h)){
        let best=null;
        for(let i=0;i<900;i++){const angle=i*2.399963229728653,r=Math.sqrt(i)*12,x=clamp(g.x+Math.cos(angle)*r,-width/2+18+g.w/2,width/2-18-g.w/2),y=clamp(g.y+Math.sin(angle)*r,-height/2+18+g.h/2,height/2-18-g.h/2),candidate={...g,x,y};if(!placed.some(p=>overlap(candidate,p,12))){best=candidate;break;}}
        if(best){g.x=best.x;g.y=best.y;}placed.push(g);
      }
    }
    const nodes=[];
    for(const g of groups)for(const n of g.members){const x=g.x-g.offset.x+n.x,y=g.y-g.offset.y+n.y,camera=unproject(x,y,n.camera[2],distance),position=inverseRotated(camera,yaw,pitch),natural=project(camera,distance).scale;nodes.push({id:n.id,position,scale:n.scale/natural,screen:{x,y,w:n.w,h:n.h},depth:n.camera[2]});}
    // Empty portions of two cluster envelopes may overlap; final label/core constraints are exact.
    separate(nodes.map(n=>n.screen),width,height,obstacle,120);
    for(const n of [...nodes].sort((a,b)=>(a.id.includes(':')?0:1)-(b.id.includes(':')?0:1))){
      const blocked=box=>overlap(box,obstacle,2)||nodes.some(other=>other!==n&&overlap(box,other.screen,2));
      if(!blocked(n.screen))continue;
      for(let i=1;i<=1600;i++){const angle=i*2.399963229728653,r=Math.sqrt(i)*2,box={...n.screen,x:n.screen.x+Math.cos(angle)*r,y:n.screen.y+Math.sin(angle)*r};if(Math.abs(box.x)+box.w/2>width/2-18||Math.abs(box.y)+box.h/2>height/2-18)continue;if(!blocked(box)){Object.assign(n.screen,box);break;}}
    }
    for(const n of nodes)n.position=inverseRotated(unproject(n.screen.x,n.screen.y,n.depth,distance),yaw,pitch);
    const collisions=[];for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++)if(overlap(nodes[i].screen,nodes[j].screen,1))collisions.push([nodes[i].id,nodes[j].id]);
    return {nodes,groups:groups.map(({id,x,y,w,h})=>({id,x,y,w,h})),core,distance,compact,collisions};
  }
  const api={MODULES,buildGraph,signature,rotated,segment,Rotation,compose,project,unproject,inverseRotated,overlap};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.FoundlySpatialModel=api;
})(typeof window==='undefined'?{}:window);
