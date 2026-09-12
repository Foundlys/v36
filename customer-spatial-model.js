'use strict';

// Presentation identities only. Commercial identities and capabilities stay in
// the existing resolver; MAIL and SOCIAL MEDIA do not create new entitlements.
(function (root) {
  const MODULES = [
    ['inkoop', 'INKOOP', 'procurement', [430, 65, 345], '#bd686d'],
    ['verkoop', 'VERKOOP', 'sales', [165, 105, 40], '#78b6cc'],
    ['finance', 'FINANCE', 'finance', [-450, 290, -240], '#9eb991'],
    ['crm', 'CRM', 'crm', [-90, 230, -70], '#77b6a0'],
    ['agenda', 'AGENDA', 'calendar', [-245, 360, 95], '#cbb779'],
    ['mail', 'MAIL', 'communication', [55, -330, -310], '#72b8c4'],
    ['social', 'SOCIAL MEDIA', 'marketing', [-460, 125, 250], '#be81ae'],
    ['marketing', 'MARKETING', 'marketing', [-280, -195, -65], '#c69e73'],
    ['analytics', 'ANALYTICS', 'analysis', [340, -205, -405], '#bbbc7d']
  ].map(([id, label, owner, position, color]) => Object.freeze({ id, label, owner, position: Object.freeze(position), color }));
  Object.freeze(MODULES);
  const LABELS = { sourcing:'Sourcing', suppliers:'Leveranciers', opportunities:'Kansen', approvals:'Beoordelingen', pipeline:'Pipeline', forecast:'Prognose', quotes:'Offertes', contacts:'Contacten', companies:'Bedrijven', leads:'Leads', relationships:'Relaties', campaigns:'Campagnes', audiences:'Doelgroepen', attribution:'Attributie', ledger:'Grootboek', invoices:'Facturen', payments:'Betalingen', reports:'Rapporten', kpis:'KPI’s', events:'Events', funnel:'Funnel', availability:'Beschikbaarheid', conflicts:'Conflicten', inbox:'Inbox', drafts:'Concepten', threads:'Gesprekken' };
  const SECTIONS = { 'procurement:sourcing':'RFQS', 'procurement:approvals':'ORDERS', 'sales:opportunities':'OPPORTUNITIES', 'sales:pipeline':'PIPELINES', 'sales:forecast':'FORECAST', 'crm:relationships':'DEALS', 'calendar:events':'EVENTS', 'calendar:availability':'AVAILABILITY', 'calendar:conflicts':'CONFLICTS', 'communication:inbox':'INBOX', 'communication:drafts':'DRAFTS', 'communication:threads':'THREADS' };
  const ANCHORS = { 'finance:ledger':'ledger', 'finance:invoices':'receivables', 'finance:payments':'receivables', 'finance:reports':'result', 'analysis:kpis':'overview', 'analysis:events':'events', 'analysis:funnel':'funnel', 'analysis:reports':'history' };
  const PROVIDERS = [ ['Facebook', ['facebook', 'facebook_pages']], ['Instagram', ['instagram']], ['TikTok', ['tiktok']] ];
  function signature(resolution) {
    return JSON.stringify([resolution?.tenant_id, resolution?.dealer_id, resolution?.revision, resolution?.visible_modules, resolution?.capabilities]);
  }
  function buildGraph({ resolution, navigation, catalog, sources = [] }) {
    const empty = { nodes: [], edges: [], signature: signature(resolution) };
    if (!resolution?.tenant_id || !resolution?.dealer_id || navigation?.tenant?.tenant_id !== resolution.tenant_id || navigation?.tenant?.dealer_id !== resolution.dealer_id) return empty;
    const visible = new Set(resolution.visible_modules || []), enabled = new Set(resolution.enabled_modules || []), entitled = new Set(resolution.entitlements || []), caps = new Set(resolution.capabilities || []);
    const workspaces = new Map((navigation.workspaces || []).map(w => [w.id, w]));
    const definitions = new Map((catalog || []).map(m => [m.module_id, m]));
    const nodes = [], edges = [];
    for (const spec of MODULES) {
      const workspace = workspaces.get(spec.owner), definition = definitions.get(spec.owner);
      if (!visible.has(spec.owner) || !enabled.has(spec.owner) || !entitled.has(spec.owner) || !definition || workspace?.route !== `/${spec.owner}`) continue;
      const active = (definition.provided_capabilities || []).filter(cap => caps.has(cap));
      if (!active.length || spec.id === 'social' && !caps.has('marketing:campaigns')) continue;
      const href = spec.id === 'social' ? '/marketing?section=SOCIAL' : workspace.route;
      nodes.push({ ...spec, kind:'module', href });
      edges.push({ from:'core', to:spec.id, color:spec.color });
      let children;
      if (spec.id === 'social') {
        children = PROVIDERS.flatMap(([label, ids]) => {
          const source = sources.find(s => ids.includes(s.source_id) && s.connection_status === 'CONNECTED' && s.runtime_enabled !== false);
          // A connected parent Meta account is not proof of Instagram/Facebook.
          return source ? [{ id:source.source_id, label, href:'/marketing?section=SOCIAL', capability:'marketing:campaigns', source_id:source.source_id }] : [];
        });
      } else {
        children = active.map(capability => {
          const key = capability.split(':')[1], section = capability==='calendar:conflicts'?'EVENTS':SECTIONS[capability] || key.toUpperCase();
          return { id:key, label:LABELS[key] || key, capability, href:ANCHORS[capability] ? `${workspace.route}#${ANCHORS[capability]}` : `${workspace.route}?section=${encodeURIComponent(section)}` };
        }).filter(child=>child.capability!=='calendar:conflicts'||caps.has('calendar:events'));
      }
      // Deterministic, unequal offsets in all three axes, never a ring/grid.
      const offsets = [[-105,-86,65],[130,-22,-115],[-68,105,-75],[108,102,105]];
      children.forEach((child, i) => {
        const offset = offsets[i % offsets.length], position = spec.position.map((v, axis) => v + offset[axis]);
        const node = { ...child, id:`${spec.id}:${child.id}`, owner:spec.owner, parent:spec.id, kind:'subnode', position, color:spec.color };
        nodes.push(node); edges.push({ from:spec.id, to:node.id, color:spec.color });
      });
    }
    return { nodes, edges, signature:signature(resolution) };
  }
  function rotated([x,y,z], yaw, pitch=0) {
    const a=x*Math.cos(yaw)+z*Math.sin(yaw), b=-x*Math.sin(yaw)+z*Math.cos(yaw);
    return [a, y*Math.cos(pitch)-b*Math.sin(pitch), y*Math.sin(pitch)+b*Math.cos(pitch)];
  }
  function segment(from, to) {
    const d=to.map((v,i)=>v-from[i]), length=Math.hypot(...d);
    return { length, yaw:Math.atan2(-d[2],Math.hypot(d[0],d[1])), roll:Math.atan2(d[1],d[0]) };
  }
  class Rotation {
    constructor() { this.yaw=0; this.pitch=-.08; this.running=true; }
    step(seconds) { if(this.running) this.yaw=(this.yaw+Math.min(Math.max(seconds,0),.1)*Math.PI*2/180)%(Math.PI*2); }
    pause() { this.running=false; }
    resume() { this.running=true; }
    manual(yaw,pitch=0) { if(this.running)return; this.yaw+=yaw; this.pitch=Math.max(-.7,Math.min(.7,this.pitch+pitch)); }
  }
  const api={MODULES,buildGraph,signature,rotated,segment,Rotation};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.FoundlySpatialModel=api;
})(typeof window==='undefined'?{}:window);
