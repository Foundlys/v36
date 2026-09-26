'use strict';
// Collect reviewable actual HTTP turns, never automatically grade empathy.
// The default is an isolated no-provider rehearsal; no customer data, accounts,
// connections or real money are used. Live-model use requires an explicit caller
// opt-in and a supplied model configuration, and is not run by the test suite.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const {fixture}=require('./fixture'),{MODULES}=require('../module-catalog');
const corpus=require('./social-corpus.v1.json');
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
async function collect({industry='ECOMMERCE',caseIds,output,seed=true,allowLiveModel=false,modelEnvironment={}}={}){
 if(!corpus.priority_industries.includes(industry))throw Error('This corpus currently covers the two priority demos. Additional packs require their own evidence.');
 const permitted=new Set(['OPENAI_API_KEY','FOUNDLY_AI_API_KEY','ANTHROPIC_API_KEY','FOUNDLY_ZERO_MODEL_REGISTRY']);
 if(Object.keys(modelEnvironment).some(k=>!permitted.has(k)))throw Error('Only explicit model configuration may be supplied');
 if(Object.keys(modelEnvironment).length&&!allowLiveModel)throw Error('Live model use requires explicit opt-in');
 const cases=caseIds?corpus.cases.filter(c=>caseIds.includes(c.id)):corpus.cases;
 if(!cases.length||caseIds&&(new Set(caseIds).size!==caseIds.length||cases.length!==caseIds.length))throw Error('Unknown or duplicate scenario');
 const root=path.resolve(__dirname,'..'),source={commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root}).toString().trim(),tree:execFileSync('git',['rev-parse','HEAD^{tree}'],{cwd:root}).toString().trim(),worktree_status:execFileSync('git',['status','--porcelain'],{cwd:root}).toString().trim()};
 const changed=[...execFileSync('git',['diff','--name-only','-z','HEAD'],{cwd:root}).toString().split('\0'),...execFileSync('git',['ls-files','--others','--exclude-standard','-z'],{cwd:root}).toString().split('\0')];
 source.uncommitted_code_sha256=Object.fromEntries([...new Set(changed)].filter(file=>/\.(?:js|json|html|css)$/.test(file)&&!file.startsWith('docs/')&&fs.existsSync(path.join(root,file))).sort().map(file=>[file,hash(fs.readFileSync(path.join(root,file)))]));
 const report={schema_version:1,recorded_at:new Date().toISOString(),source,industry_id:industry,input_locale:corpus.input_locale,corpus_version:corpus.version,corpus_sha256:hash(fs.readFileSync(path.join(__dirname,'social-corpus.v1.json'))),execution_environment:allowLiveModel?'EXPLICIT_LIVE_MODEL_ISOLATED_DEMO':'ISOLATED_REAL_HTTP_NO_MODEL_PROVIDER',quality_status:'UNVERIFIED_REQUIRES_INDEPENDENT_REVIEW',voice_status:'UNVERIFIED_NO_AUDIO',demo_acceptance:false,seed:null,cases:[],review_protocol:corpus.review_protocol,remaining:['Independent model transcript review; default run has no live model','Native-language scenarios/review for the other seven locales','All voice profiles with actual listening, interruption and device evidence','Complete seed/UI/recovery/data/delivery acceptance separate from this conversation corpus']};
 const save=()=>{if(output){fs.mkdirSync(path.dirname(output),{recursive:true});const tmp=output+'.writing';fs.writeFileSync(tmp,JSON.stringify(report,null,2)+'\n');fs.renameSync(tmp,output);}};
 const tenant='demo-social-'+crypto.randomUUID();
 const f=await fixture({FOUNDLY_TENANT_ID:tenant,FOUNDLY_DEMO_TENANT_ID:tenant,FOUNDLY_DEMO_UNIVERSE_ENABLED:'true',...modelEnvironment});
 try{
  const composition=await f.request('/api/composition','PUT',{industry_id:industry,entitlements:Object.keys(MODULES),expected_revision:0});
  if(composition.status!==200)throw Error('Isolated composition failed: '+composition.body.code);
  const member=await f.enroll('social.evaluator',['SUPER_ADMIN']),call=(route,method,body,headers)=>f.request(route,method,body,member.cookie,headers);
  report.composition=(await call('/api/composition')).body.resolution;
  report.model_registry=(await call('/api/zero/models')).body;
  if(seed){
   const options={seed:'zero-social-'+industry.toLowerCase(),as_of:'2026-09-26T00:00:00.000Z'},started=performance.now();
   const preview=await call('/api/demo-universe/preview','POST',options);if(preview.status!==200)throw Error('Native demo preview failed: '+preview.body.code);
   const start=await call('/api/demo-universe/runs','POST',{...options,plan_fingerprint:preview.body.plan_fingerprint,expected_profile_revision:preview.body.profile_revision,confirm:true,reason:'Explicit isolated social evaluation seed'},{'idempotency-key':'social-native-seed'});if(start.status!==201)throw Error('Native demo start failed: '+start.body.code);
   let row=start.body.universe;report.seed={state:'RUNNING',plan_fingerprint:preview.body.plan_fingerprint,id:row.id,total_nodes:row.total_nodes,checkpoints:[]};save();
   while(row.status!=='SEEDED'){
    const before=performance.now(),next=await call('/api/demo-universe/runs/'+row.id+'/advance','POST',{expected_cursor:row.applied_nodes,expected_profile_revision:preview.body.profile_revision,limit:25,confirm:true,reason:'Explicit isolated native continuation'});
    if(next.status!==200)throw Error('Native seed continuation failed: '+next.body.code);
    row=next.body.universe;report.seed.checkpoints.push({applied_nodes:row.applied_nodes,elapsed_ms:Math.round(performance.now()-before)});save();
   }
   report.seed={...report.seed,state:row.status,elapsed_ms:Math.round(performance.now()-started),full_acceptance:row.full_acceptance};
  }else report.seed={state:'NOT_RUN',limitation:'Transport rehearsal only; not actual seeded-demo quality evidence'};
  // A fresh universe must be reserved before personal preferences create
  // ordinary tenant memory. Keep the engine's empty-tenant gate authoritative.
  const prefs=await call('/api/zero/preferences','PUT',{language:corpus.input_locale,ui_locale:corpus.input_locale,voice_mode:'CONVERSATIONAL'});if(prefs.status!==200)throw Error('Preferences failed');
  save();
  for(const scenario of cases){
   const conversation_id=crypto.randomUUID(),item={id:scenario.id,modules:scenario.modules,conversation_id,turns:[],status:'UNVERIFIED_REQUIRES_REVIEW',must_observe:scenario.must_observe};report.cases.push(item);
   for(const message of scenario.turns){
    const request={message,conversation_id,turn_id:crypto.randomUUID()},started=performance.now();
    const response=await call('/api/zero/turn','POST',request);
    item.turns.push({request,response,latency_ms:Math.round(performance.now()-started)});
    if(response.status!==200)item.status='TRANSPORT_OR_NATIVE_FAILURE';
    else if((response.body.actions||[]).some(a=>a.status==='executed'))item.status='UNEXPECTED_EXECUTION_REQUIRES_INVESTIGATION';
    save();
   }
  }
  report.completed_at=new Date().toISOString();save();return report;
 }catch(error){report.collection_error={name:error.name,message:String(error.message).slice(0,1000)};save();throw error;}
 finally{await f.close();}
}
if(require.main===module){
 const value=name=>process.argv.find(x=>x.startsWith('--'+name+'='))?.slice(name.length+3);
 const live=process.argv.includes('--allow-live-model'),modelEnvironment=live?Object.fromEntries(['OPENAI_API_KEY','FOUNDLY_AI_API_KEY','ANTHROPIC_API_KEY','FOUNDLY_ZERO_MODEL_REGISTRY'].filter(k=>process.env[k]).map(k=>[k,process.env[k]])):{};
 collect({industry:value('industry')||'ECOMMERCE',caseIds:value('cases')?.split(','),output:value('output'),seed:!process.argv.includes('--no-seed'),allowLiveModel:live,modelEnvironment}).then(r=>console.log(JSON.stringify({industry:r.industry_id,cases:r.cases.length,seed:r.seed?.state,quality_status:r.quality_status,output:value('output')||null}))).catch(error=>{console.error(error.message);process.exitCode=1;});
}
module.exports={collect};
