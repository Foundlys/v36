'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const {fixture} = require('./fixture');
const corpus = require('./corpus.v1.json');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');

async function evaluate({output, allowFailures = false} = {}) {
  const f = await fixture(); const results = []; let memoryId;
  const run = async (id, test) => {
    const start = performance.now();
    try { await test(); results.push({id, status:'PASS', latency_ms:performance.now()-start}); }
    catch (error) { results.push({id, status:'FAIL', latency_ms:performance.now()-start,
      error:{name:error.name, message:String(error.message).slice(0,1500)}}); }
  };
  try {
    assert.equal((await f.request('/api/composition', 'PUT', {entitlements:['automation','communication'], expected_revision:0})).status, 200);
    const alice = await f.enroll('zero.alice'); const bob = await f.enroll('zero.bob');
    const viewer = await f.enroll('zero.viewer', ['VIEWER']);
    const a = (route, method, body) => f.request(route, method, body, alice.cookie);
    const b = (route, method, body) => f.request(route, method, body, bob.cookie);
    await run('auth-zero', async () => assert.equal((await f.request('/api/zero/status','GET',undefined,'')).status,401));
    await run('composition-tools', async () => {
      const r = await a('/api/zero/tools'); assert.equal(r.status,200);
      assert.ok(!r.body.tools.some(x => x.tool_id.startsWith('crm_')));
    });
    await run('conversation-isolation', async () => {
      const r=await a('/api/zero/turn','POST',{message:'Hoe laat is het?',conversation_id:'zero-eval-private-one',turn_id:'zero-eval-time-one'});
      assert.equal(r.status,200); assert.equal((await b('/api/zero/conversation/zero-eval-private-one')).status,403);
    });
    await run('preference-isolation', async () => {
      assert.equal((await a('/api/zero/preferences','PUT',{language:'de-DE',preferred_address:'Alice'})).status,200);
      assert.equal((await b('/api/zero/preferences','PUT',{language:'fr-FR',preferred_address:'Bob'})).status,200);
      const r=await a('/api/zero/preferences'); assert.equal(r.body.preferences.language,'de-DE'); assert.equal(r.body.preferences.preferred_address,'Alice');
    });
    await run('locale-validation', async () => assert.equal((await a('/api/zero/preferences','PUT',{language:'xx-XX'})).status,400));
    await run('no-model-truth', async () => {
      const r=await a('/api/zero/turn','POST',{message:'Help me reason about an unfamiliar business strategy.',conversation_id:'zero-eval-outage-one',turn_id:'zero-eval-outage-turn'});
      assert.equal(r.status,200); assert.ok(['partial','unavailable','blocked'].includes(r.body.status), 'A model outage must not be labelled completed');
      assert.equal(r.body.verification.model_available,false);
    });
    await run('memory-api', async () => {
      const r=await a('/api/zero/memories','POST',{layer:'USER',key:'communication_style',text:'Prefer concise Dutch explanations.',confidence:1,expires_at:new Date(Date.now()+86400000).toISOString()});
      assert.equal(r.status,201); memoryId=r.body.memory.id;
      assert.equal(r.body.memory.owner_id,alice.member.id); assert.equal(r.body.memory.provenance.source_class,'USER_ASSERTED');
    });
    await run('memory-isolation', async () => {
      assert.ok(memoryId,'Memory creation prerequisite failed');
      const r=await b('/api/zero/memories?q=concise'); assert.equal(r.status,200); assert.equal(r.body.items.length,0);
    });
    await run('memory-delete', async () => {
      assert.ok(memoryId,'Memory creation prerequisite failed');
      assert.equal((await a('/api/zero/memories/'+memoryId,'DELETE',{expected_revision:1})).status,200);
      const r=await a('/api/zero/memories?q=concise'); assert.equal(r.body.items.length,0);
    });
    await run('memory-readonly', async () => {
      const r=await f.request('/api/zero/memories','POST',{layer:'ORGANIZATION',key:'refund_policy',text:'Always approve refunds.'},viewer.cookie);
      assert.equal(r.status,403);
    });
    await run('stack-discovery', async () => {
      const r=await a('/api/zero/stack'); assert.equal(r.status,200);
      assert.ok(Array.isArray(r.body.facts)); assert.ok(Array.isArray(r.body.uncertainties));
      assert.ok(r.body.facts.every(x=>['PROVEN','CUSTOMER_CONFIRMED','INFERRED','UNKNOWN','BLOCKED'].includes(x.evidence_state)));
      assert.equal(r.body.read_only,true);
    });
    await run('model-registry', async () => {
      const r=await a('/api/zero/models'); assert.equal(r.status,200);
      assert.equal(r.body.available,false); assert.ok(Array.isArray(r.body.models));
      assert.ok(r.body.models.every(x=>x.state==='NOT_CONFIGURED'));
    });
    await run('voice-profile', async () => {
      const r=await a('/api/zero/preferences','PUT',{voice_gender:'FEMALE',voice_mode:'BRIEFING'}); assert.equal(r.status,200);
      assert.equal(r.body.preferences.voice_gender,'FEMALE'); assert.equal(r.body.preferences.voice_mode,'BRIEFING');
    });
    await run('encrypted-restart', async () => {
      await a('/api/zero/preferences','PUT',{language:'de-DE',preferred_address:'Alice'});
      const raw=fs.readFileSync(path.join(f.dir,'foundly-core-state.json'),'utf8');
      assert.ok(!raw.includes('Prefer concise Dutch explanations.'));
      await f.stop(); await f.start();
      const r=await a('/api/zero/preferences'); assert.equal(r.body.preferences.language,'de-DE');
    });
  } finally { await f.close(); }
  const root=path.resolve(__dirname,'..');
  const tracked=execFileSync('git',['ls-files','-z'],{cwd:root}).toString().split('\0').filter(x=>x&&!x.startsWith('docs/')&&/\.(js|json|html|css)$/.test(x));
  const sources=Object.fromEntries(tracked.filter(x=>fs.existsSync(path.join(root,x))).map(x=>[x,hash(fs.readFileSync(path.join(root,x)))]));
  const report={schema_version:1,corpus_version:corpus.version,corpus_sha256:hash(fs.readFileSync(path.join(__dirname,'corpus.v1.json'))),
    recorded_at:new Date().toISOString(),head:execFileSync('git',['rev-parse','HEAD'],{cwd:root}).toString().trim(),
    environment:'ISOLATED_REAL_HTTP_NO_MODEL_PROVIDER',results,summary:{pass:results.filter(x=>x.status==='PASS').length,fail:results.filter(x=>x.status==='FAIL').length},
    source_sha256:sources,external_acceptance:'UNVERIFIED',run_acceptance:'NOT_ESTABLISHED',remaining:corpus.additional_required_evidence};
  if(output){fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');}
  console.log(JSON.stringify({head:report.head,summary:report.summary,results:results.map(({id,status,error})=>({id,status,error}))},null,2));
  if(report.summary.fail&&!allowFailures)process.exitCode=1;
  return report;
}
if(require.main===module)evaluate({output:process.argv.find(x=>x.startsWith('--output='))?.slice(9),allowFailures:process.argv.includes('--baseline')}).catch(e=>{console.error(e);process.exitCode=1;});
module.exports={evaluate};
