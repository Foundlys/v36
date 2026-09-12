'use strict';
const assert=require('node:assert/strict'),S=require('./customer-spatial-scene'),M=require('./customer-spatial-model');
const {resolve}=require('./capability-resolver'),{MODULES}=require('./module-catalog'),{WORKSPACE_DEFINITIONS}=require('./workspace-system');
const context={tenant_id:'scene-fixture',dealer_id:'scene-fixture'},ids=Object.keys(MODULES);
function graph(enabled){return M.buildGraph({resolution:resolve(context,{roles:['ADMIN']},{...context,industry_id:'GENERAL',entitlements:enabled,enabled_modules:enabled,revision:1}),navigation:{tenant:context,workspaces:Object.values(WORKSPACE_DEFINITIONS)},catalog:Object.values(MODULES)});}
for(const enabled of [[],['crm'],['crm','calendar','communication'],ids]){
 const g=graph(enabled),scene=S.layout(g),original=JSON.stringify(scene),r=new M.Rotation();
 assert.equal(scene.nodes.length,g.nodes.length);assert.equal(scene.paths.length,g.edges.length);
 for(const n of scene.nodes.filter(n=>n.kind==='module')){const a=S.ANCHORS[n.id],v=S.view(n.position,r,1536,864);assert.ok(Math.abs(v.x-a[0])<1e-8&&Math.abs(v.y-a[1])<1e-8,'canonical module centers match reference positions');}
 let above=false,below=false,depthSwaps=false,previousDistance=1800;
 const firstDepth=new Map(scene.nodes.map(n=>[n.id,n.position[2]]));
 for(let frame=0;frame<10800;frame++){
  r.step(1/60);above||=r.pitch>.25;below||=r.pitch<-.25;
  const distance=S.cameraDistance(scene.nodes,r);assert.ok(Math.abs(distance-previousDistance)<2,'framing has no camera jumps');previousDistance=distance;
  if(frame%30)continue;
  for(const size of [[1536,864],[1024,768],[390,844],[844,390]])for(const n of scene.nodes){const p=S.view(n.position,{...r,distance},...size);assert.ok(p.x>0&&p.x<size[0]&&p.y>0&&p.y<size[1],'spatial anchors remain framed');if(firstDepth.get(n.id)*p.depth<0)depthSwaps=true;}
  for(const edge of scene.paths){assert.deepEqual(S.cubic(edge,0),edge.p0);assert.deepEqual(S.cubic(edge,1),edge.p3);}
 }
 assert.ok(Math.abs(r.yaw-Math.PI*2)<1e-8,'complete horizontal cycle');assert.ok(above&&below,'above and below are part of auto motion');if(scene.nodes.length)assert.ok(depthSwaps,'front/back ordering genuinely changes');
 assert.equal(JSON.stringify(scene),original,'rotation never reflows or deforms world-space node positions');
 r.pause();const frozen=JSON.stringify(r);for(let i=0;i<100;i++)r.step(.1);assert.equal(JSON.stringify(r),frozen,'all autonomous axes/time freeze');r.manual(.3,.2);const manual=JSON.stringify({yaw:r.yaw,pitch:r.pitch,roll:r.roll,time:r.time});r.resume();assert.equal(JSON.stringify({yaw:r.yaw,pitch:r.pitch,roll:r.roll,time:r.time}),manual,'resume preserves exact manually selected pose');r.step(1/60);assert.ok(Number.isFinite(r.pitch));
}
console.log('PASS reference-scene geometry: canonical anchors, exact entitled topology, full continuous 360, above/below, depth swaps, immutable world points, smooth framing, pause/manual/resume. Not a browser visual verdict.');
