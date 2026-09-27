'use strict';
// Local diagnostic, not a full encrypted seed, load test, or device SLA.
// Both revisions use the same real full generated graph and reserved read path.
const {fixture,reserve}=require('./demo-universe-fixture'),{SCOPE}=require('../demo-universe-engine');
const {execFileSync}=require('node:child_process');
const count=20,profiles=[];
for(const industry of ['AUTOMOTIVE','ECOMMERCE']){
 const f=fixture({full:true,durable:false,industry}),row=reserve(f),stored=f.adapter.bucket(f.ctx,SCOPE)[0];
 const first=performance.now(),manifest=f.engine.reservedManifest(f.ctx,stored),cold_ms=performance.now()-first,times=[];
 for(let i=0;i<count;i++){const start=performance.now();f.engine.reservedManifest(f.ctx,stored);times.push(performance.now()-start);}
 const ordered=[...times].sort((a,b)=>a-b),round=x=>Math.round(x*1000)/1000;
 profiles.push({industry,manifest_fingerprint:row.plan_fingerprint,node_count:manifest.nodes.length,manifest_bytes:Buffer.byteLength(JSON.stringify(manifest)),first_reserved_read_ms:round(cold_ms),repeat_count:count,repeat_ms:times.map(round),repeat_p50_ms:round(ordered[Math.ceil(count*.5)-1]),repeat_p95_ms:round(ordered[Math.ceil(count*.95)-1]),repeat_total_ms:round(times.reduce((a,b)=>a+b,0))});
}
console.log(JSON.stringify({schema_version:1,measured_at:new Date().toISOString(),source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),tree:execFileSync('git',['rev-parse','HEAD^{tree}'],{encoding:'utf8'}).trim(),source_status:execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),node_version:process.version,scope:'LOCAL_REPEATED_RESERVED_MANIFEST_READS_NOT_END_TO_END_SLA',profiles},null,2));
