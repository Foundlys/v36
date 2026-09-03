'use strict';
const {spawn}=require('child_process');
const fs=require('fs');
const assert=require('assert');
const PORT=19820+Math.floor(Math.random()*100);
const data=fs.mkdtempSync('/tmp/foundly-audit-');
const env={...process.env,PORT:String(PORT),FOUNDLY_DATA_DIR:data,FOUNDLY_ENCRYPTION_KEY:'audit-key',OPENAI_API_KEY:'',META_APP_ID:'',META_APP_SECRET:'',GOOGLE_CLIENT_ID:'',GOOGLE_CLIENT_SECRET:'',FOUNDLY_WORKER_INTERVAL_MS:'99999999'};
const child=spawn(process.execPath,['server.js'],{cwd:__dirname,env,stdio:['ignore','pipe','pipe']});
let logs='';child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);
const base=`http://127.0.0.1:${PORT}`;const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function get(path,opts){const r=await fetch(base+path,opts);const text=await r.text();let j;try{j=JSON.parse(text)}catch{j=text}return {r,j}}
(async()=>{try{
  for(let i=0;i<50;i++){try{if((await fetch(base+'/api/ping')).ok)break}catch{}await wait(100)}
  const p=await get('/api/connector-runtime/profiles'),s=await get('/api/connectors');assert.equal(p.r.status,200);assert.equal(s.r.status,200);assert.equal(p.j.total,93);assert.equal(s.j.total,93);
  const profiles=new Map(p.j.profiles.map(x=>[x.id,x])),statuses=new Map(s.j.connectors.map(x=>[x.id,x]));assert.equal(profiles.size,93);assert.equal(statuses.size,93);
  const problems=[];for(const [id,profile] of profiles){const st=statuses.get(id);if(!st)problems.push(`${id}: missing status`);if(!profile.naam&&!profile.name)problems.push(`${id}: missing name`);if(!profile.auth_strategy)problems.push(`${id}: missing auth_strategy`);if(!profile.connection_mode)problems.push(`${id}: missing connection_mode`);if(typeof st?.configured!=='boolean'||typeof st?.connected!=='boolean')problems.push(`${id}: invalid status booleans`)}assert.deepEqual(problems,[]);
  // Dedicated routes must exist even without credentials.
  for(const path of ['/api/google/status','/api/connect/meta/status','/api/connect/linkedin/status','/api/connect/tiktok/status','/api/whatsapp/status']){const x=await get(path);assert.notEqual(x.r.status,404,`${path} missing`)}
  const html=fs.readFileSync(__dirname+'/index.html','utf8');
  const requiredApi=['/api/core/command','/api/integration-sync/','/api/google/connect','/api/connect/${dedicated}','/api/connector-runtime/test/','/api/connector-runtime/config/','/api/events','/api/workers/tick'];for(const token of requiredApi)assert(html.includes(token),`UI missing ${token}`);
  assert(!/OPENAI_API_KEY[^\n]{0,120}prompt/i.test(html),'OpenAI key still collected in browser');
  assert(!html.includes('setInterval(()=>addEvent(events['),'simulated event loop still exists');
  console.log(JSON.stringify({ok:true,version:'4.2.1',connectors_audited:93,status_contract:'pass',dedicated_routes:'pass',ui_contract:'pass'},null,2));
}catch(e){console.error(logs);console.error(e);process.exitCode=1}finally{child.kill('SIGTERM')}})();
