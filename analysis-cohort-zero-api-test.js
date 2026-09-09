'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {spawn}=require('node:child_process'),{once}=require('node:events');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'foundly-cohorts-'));
const port=34600+Math.floor(Math.random()*700),base=`http://127.0.0.1:${port}`,token=crypto.randomBytes(32).toString('hex');
const env={...process.env,NODE_ENV:'production',NODE_OPTIONS:'',PORT:String(port),FOUNDLY_ADMIN_TOKEN:token,FOUNDLY_ADMIN_PASSWORD:'',FOUNDLY_ENCRYPTION_KEY:crypto.randomBytes(32).toString('hex'),FOUNDLY_DATA_DIR:dir,FOUNDLY_TENANT_ID:'cohort-http-fixture',FOUNDLY_DEALER_ID:'default',FOUNDLY_PLATFORM_USER_ID:'authoring-owner',FOUNDLY_PLATFORM_ROLES:'ADMIN,SUPER_ADMIN',FOUNDLY_PUBLIC_BASE_URL:'https://foundly.example.test',FOUNDLY_WORKER_INTERVAL_MS:'99999999',OPENAI_API_KEY:'',FOUNDLY_AI_API_KEY:''};
let child,logs='';
async function start(){
 child=spawn(process.execPath,['--require','./test-readiness-fetch-mock.js','server.js'],{cwd:__dirname,env,stdio:['ignore','pipe','pipe']});
 for(const stream of [child.stdout,child.stderr])stream.on('data',b=>{logs=(logs+b).slice(-10000);});
 for(let n=0;n<80;n++){if(child.exitCode!==null)throw new Error('Fixture server exited: '+logs);try{if((await fetch(base+'/api/health')).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}
 throw new Error('Fixture server start timeout');
}
async function stop(){if(child?.exitCode===null){const closed=once(child,'exit');child.kill('SIGTERM');await closed;}}
async function call(route,method='GET',body){const response=await fetch(base+route,{method,redirect:'manual',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});const text=await response.text();let data;try{data=JSON.parse(text);}catch{data=text;}return {status:response.status,body:data,headers:response.headers};}

(async()=>{try{
 await start();const config=async(flags={})=>{const current=(await call('/api/composition')).body;assert.equal((await call('/api/composition','PUT',{entitlements:['analysis'],expected_revision:current.profile?.revision||0,capability_flags:flags})).status,200);};await config();
 const definitions='/api/analysis/cohort_definitions',definition={from:'2026-01-01T00:00:00Z',to:'2026-02-01T00:00:00Z',identity_field:'customer_id',acquisition_event:'customer_joined',return_event:'customer_returned',interval_days:7,periods:3};
 const saved=await call(definitions,'POST',{title:'January fixture cohort',cohort_definition:definition});assert.equal(saved.status,201);const row=saved.body.record;
 for(const [suffix,reader,source] of [['owned','authoring-owner','owned-fixture-source'],['hidden','another-owner','private-fixture-source']])assert.equal((await call('/api/platform/events/ingest','POST',{event_id:'zero-cohort-'+suffix,event_name:'customer_joined',occurred_at:'2026-01-02T00:00:00Z',source,customer_id:suffix,permissions:{user_ids:[reader]},consent_context:{purpose:'cohort_fixture',legal_basis:'contract'}})).status,202);
 const tools=(await call('/api/zero/tools')).body.tools,tool=tools.find(t=>t.tool_id==='analysis_cohort_retention');assert.ok(tool);assert.equal(tool.mode,'read');assert.equal(tool.confirmation,'never');assert.deepEqual(tool.parameter_schema.required,['id','revision']);
 const conversation=crypto.randomUUID(),turn=crypto.randomUUID(),input={message:'Analyseer de gekozen cohort',conversation_id:conversation,turn_id:turn,preferred_module:'analysis',client_context:{cohort_definition:{id:row.id,revision:row.revision}}};
 let result=await call('/api/zero/turn','POST',{...input,turn_id:crypto.randomUUID(),client_context:{}});assert.equal(result.status,200);assert.equal(result.body.status,'needs_input');assert.equal(result.body.verification.executed,false);
 result=await call('/api/zero/turn','POST',input);assert.equal(result.status,200,JSON.stringify(result.body));assert.equal(result.body.analysis_data.sample_size,2);assert.equal(result.body.verification.business_actions_executed,false);assert.deepEqual(result.body.actions,[]);
 let history=(await call('/api/zero/conversation/'+conversation)).body;assert.ok(!JSON.stringify(history).includes('private-fixture-source'));assert.ok(!JSON.stringify(history).includes('2 waargenomen leden'));
 await stop();env.FOUNDLY_PLATFORM_ROLES='VIEWER';await start();
 result=await call('/api/zero/turn','POST',input);assert.equal(result.status,200,JSON.stringify(result.body));assert.equal(result.body.replayed,true);assert.equal(result.body.revalidated,true);assert.equal(result.body.analysis_data.sample_size,1);assert.ok(!JSON.stringify(result.body).includes('private-fixture-source'));assert.ok(result.body.display_text.includes('1 waargenomen leden'));
 result=await call('/api/zero/turn','POST',{...input,client_context:{cohort_definition:{revision:row.revision,id:row.id}}});assert.equal(result.status,200,'Field order does not alter the selected definition');
 result=await call('/api/zero/turn','POST',{...input,client_context:{cohort_definition:{id:row.id,revision:row.revision+1}}});assert.equal(result.status,409);
 await stop();await start();result=await call('/api/zero/turn','POST',input);assert.equal(result.body.analysis_data.sample_size,1);assert.equal(result.body.revalidated,true);assert.ok(!JSON.stringify(result.body).includes('private-fixture-source'));
 await stop();env.FOUNDLY_PLATFORM_USER_ID='another-reader';await start();assert.equal((await call('/api/zero/turn','POST',{...input,conversation_id:crypto.randomUUID(),turn_id:crypto.randomUUID()})).status,404);assert.equal((await call('/api/zero/turn','POST',input)).status,403);
 await stop();env.FOUNDLY_PLATFORM_USER_ID='authoring-owner';env.FOUNDLY_PLATFORM_ROLES='ADMIN,SUPER_ADMIN';await start();
 result=await call(definitions+'/'+row.id,'PUT',{title:'Changed source definition',expected_revision:row.revision});assert.equal(result.status,200);assert.equal((await call('/api/zero/turn','POST',input)).status,409);
 await config({'analysis:events':false});assert.ok(!(await call('/api/zero/tools')).body.tools.some(t=>t.tool_id==='analysis_cohort_retention'));assert.equal((await call('/api/zero/turn','POST',input)).status,403);
 await config({'analysis:reports':false});assert.ok(!(await call('/api/zero/tools')).body.tools.some(t=>t.tool_id==='analysis_cohort_retention'));assert.equal((await call('/api/zero/turn','POST',input)).status,403);
 assert.equal((await call('/api/tasks')).body.tasks.length,0);
 console.log('PASS actual ZERO cohort selection, dynamic read-tool filtering, current caller projection, source-free conversation history, replay revalidation after role downgrade/restart, foreign owner denial, changed-definition refusal and no business effects');
}finally{await stop();fs.rmSync(dir,{recursive:true,force:true});}})().catch(error=>{console.error(error);process.exitCode=1;});
