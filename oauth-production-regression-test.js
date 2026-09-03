'use strict';

const {spawn}=require('child_process');
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const assert=require('assert');
const PORT=20020+Math.floor(Math.random()*80),dataDir=fs.mkdtempSync('/tmp/foundly-oauth-production-'),base=`http://127.0.0.1:${PORT}`,publicBase='https://foundly-production.test';
const password='oauth-production-password',auth='Basic '+Buffer.from(`foundly:${password}`).toString('base64');
const preload=path.join(__dirname,'test-oauth-fetch-mock.js');
const env={...process.env,NODE_ENV:'production',NODE_OPTIONS:`--require=${preload}`,PORT:String(PORT),FOUNDLY_DATA_DIR:dataDir,FOUNDLY_PUBLIC_BASE_URL:publicBase,FOUNDLY_ADMIN_USERNAME:'foundly',FOUNDLY_ADMIN_PASSWORD:password,FOUNDLY_ENCRYPTION_KEY:'oauth-regression-encryption-key',FOUNDLY_TENANT_ID:'tenant-regression',FOUNDLY_DEALER_ID:'dealer-regression',FOUNDLY_WORKER_INTERVAL_MS:'99999999',OPENAI_API_KEY:'',FOUNDLY_AI_API_KEY:'',META_APP_ID:'meta-client',META_APP_SECRET:'meta-secret',META_REDIRECT_URI:`${publicBase}/api/connect/meta/callback`,LINKEDIN_CLIENT_ID:'linkedin-client',LINKEDIN_CLIENT_SECRET:'linkedin-secret',LINKEDIN_REDIRECT_URI:`${publicBase}/api/connect/linkedin/callback`,TIKTOK_CLIENT_KEY:'tiktok-client',TIKTOK_CLIENT_SECRET:'tiktok-secret',TIKTOK_REDIRECT_URI:`${publicBase}/api/connect/tiktok/callback`,GOOGLE_CLIENT_ID:'google-client',GOOGLE_CLIENT_SECRET:'google-secret',GOOGLE_REDIRECT_URI:`${publicBase}/api/google/oauth/callback`,GOOGLE_ADS_DEVELOPER_TOKEN:'google-developer-token',WIX_APP_ID:'wix-app',WIX_APP_SECRET:'wix-secret',WIX_SHARE_URL_ID:'wix-share-id',WIX_REDIRECT_URI:`${publicBase}/api/connect/wix/callback`};
let child=null,logs='';const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function start(){logs='';child=spawn(process.execPath,['server.js'],{cwd:__dirname,env,stdio:['ignore','pipe','pipe']});child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);for(let i=0;i<80;i++){try{if((await fetch(base+'/api/health')).ok)return}catch{}await wait(75)}throw new Error('server start timeout\n'+logs)}
async function stop(){if(!child)return;child.kill('SIGTERM');for(let i=0;i<40&&child.exitCode===null;i++)await wait(50);child=null}
async function call(url,opts={}){const r=await fetch(base+url,{redirect:'manual',...opts}),text=await r.text();let body;try{body=JSON.parse(text)}catch{body=text}return {r,body,text}}
function stateKey(token){return crypto.createHash('sha256').update(token).digest('hex')}
function stateStore(){return JSON.parse(fs.readFileSync(path.join(dataDir,'oauth-states-v2.json'),'utf8'))}
const providers=[
  {id:'meta',start:'/api/connect/meta',callback:'/api/connect/meta/callback',status:'/api/connect/meta/status'},
  {id:'google',start:'/api/google/connect',callback:'/api/google/oauth/callback',status:'/api/google/status'},
  {id:'linkedin',start:'/api/connect/linkedin',callback:'/api/connect/linkedin/callback',status:'/api/connect/linkedin/status'},
  {id:'tiktok',start:'/api/connect/tiktok',callback:'/api/connect/tiktok/callback',status:'/api/connect/tiktok/status'}
];

(async()=>{try{
  await start();
  for(const provider of providers){
    let x=await call(`${provider.start}?return_to=/?open=integraties`,{headers:{authorization:auth}});assert.equal(x.r.status,302,`${provider.id} start`);assert(!x.r.headers.get('www-authenticate'));
    const state=new URL(x.r.headers.get('location')).searchParams.get('state');assert(state&&state.length>=43);
    const raw=fs.readFileSync(path.join(dataDir,'oauth-states-v2.json'),'utf8');assert(!raw.includes(state),'raw state token may not be persisted');const stored=stateStore()[stateKey(state)];assert.equal(stored.status,'PENDING');assert.equal(stored.tenant_id,'tenant-regression');assert.equal(stored.dealer_id,'dealer-regression');assert(stored.signature);

    await stop();await start();
    const callback=`${provider.callback}?state=${encodeURIComponent(state)}&code=${encodeURIComponent(`${provider.id}-code`)}`;
    x=await call(callback);assert.equal(x.r.status,302,`${provider.id} callback must be public`);assert(!x.r.headers.get('www-authenticate'),`${provider.id} callback emitted Basic challenge`);const success=x.r.headers.get('location')||'';assert(success.includes(`${provider.id}=connected`),`${provider.id} callback failed: ${success}\n${logs}`);
    assert.equal(stateStore()[stateKey(state)].status,'USED');

    const protectedUi=await call('/?open=integraties');assert.equal(protectedUi.r.status,401);assert(protectedUi.r.headers.get('www-authenticate'));
    const authenticatedUi=await call('/?open=integraties',{headers:{authorization:auth}});assert.equal(authenticatedUi.r.status,200);
    const replay=await call(callback);assert.equal(replay.r.status,302);assert(!replay.r.headers.get('www-authenticate'));assert((replay.r.headers.get('location')||'').includes('error_code=oauth_state_invalid'));
    const status=await call(provider.status,{headers:{authorization:auth}});assert.equal(status.r.status,200);assert.equal(Boolean(status.body.connected),true,`${provider.id} should be connected after real mocked probe`);
  }

  // Generic runtime OAuth uses the same durable, hashed, one-time state rules.
  let generic=await call('/api/connector-runtime/config/marktplaats',{method:'POST',headers:{authorization:auth,'content-type':'application/json'},body:JSON.stringify({credentials:{client_id:'runtime-client',client_secret:'runtime-secret'}})});assert.equal(generic.r.status,200);
  generic=await call('/api/connector-runtime/oauth/marktplaats/start?return_to=/?open=integraties',{headers:{authorization:auth}});assert.equal(generic.r.status,302);const genericState=new URL(generic.r.headers.get('location')).searchParams.get('state'),genericStatePath=path.join(dataDir,'connector-oauth-states.json'),genericRaw=fs.readFileSync(genericStatePath,'utf8');assert(genericState&&genericState.length>=43);assert(!genericRaw.includes(genericState));const genericStore=JSON.parse(genericRaw),genericRow=genericStore[stateKey(genericState)];assert.equal(genericRow.status,'PENDING');assert.equal(genericRow.tenant_id,'tenant-regression');assert(genericRow.signature);
  await stop();await start();generic=await call(`/api/connector-runtime/oauth/marktplaats/callback?state=${encodeURIComponent(genericState)}`);assert.equal(generic.r.status,302);assert(!generic.r.headers.get('www-authenticate'));assert((generic.r.headers.get('location')||'').includes('error_code=oauth_callback_failed'));assert.equal(JSON.parse(fs.readFileSync(genericStatePath,'utf8'))[stateKey(genericState)].status,'PENDING');

  let x=await call('/api/connect/meta?return_to=/?open=integraties',{headers:{authorization:auth}});const retryState=new URL(x.r.headers.get('location')).searchParams.get('state'),retryCallback=`/api/connect/meta/callback?state=${encodeURIComponent(retryState)}&code=retry-once`;
  x=await call(retryCallback);assert((x.r.headers.get('location')||'').includes('oauth_provider_temporarily_unavailable'));assert.equal(stateStore()[stateKey(retryState)].status,'PENDING');
  x=await call(retryCallback);assert((x.r.headers.get('location')||'').includes('meta=connected'));assert.equal(stateStore()[stateKey(retryState)].status,'USED');

  // Concurrent delivery of one callback may exchange/bootstrap only once.
  x=await call('/api/connect/meta?return_to=/?open=integraties',{headers:{authorization:auth}});const concurrentState=new URL(x.r.headers.get('location')).searchParams.get('state'),concurrentCallback=`/api/connect/meta/callback?state=${encodeURIComponent(concurrentState)}&code=concurrent-code`;
  const concurrent=await Promise.all([call(concurrentCallback),call(concurrentCallback)]),locations=concurrent.map(y=>y.r.headers.get('location')||'');assert.equal(locations.filter(y=>y.includes('meta=connected')).length,1);assert.equal(locations.filter(y=>y.includes('error_code=oauth_state_invalid')).length,1);assert.equal(stateStore()[stateKey(concurrentState)].status,'USED');

  // A failed reconnect probe must restore the previously verified connection.
  x=await call('/api/connect/meta?return_to=/?open=integraties',{headers:{authorization:auth}});const rollbackState=new URL(x.r.headers.get('location')).searchParams.get('state');x=await call(`/api/connect/meta/callback?state=${encodeURIComponent(rollbackState)}&code=probe-fails`);assert((x.r.headers.get('location')||'').includes('error_code=oauth_bootstrap_failed'));assert.equal(stateStore()[stateKey(rollbackState)].status,'USED');const restored=await call('/api/connect/meta/status',{headers:{authorization:auth}});assert.equal(restored.body.connected,true,'previous verified Meta token should survive failed reconnect');

  for(const provider of providers){x=await call(`${provider.callback}?state=invalid-state-value-that-is-long-enough&code=x`);assert.equal(x.r.status,302);assert(!x.r.headers.get('www-authenticate'))}
  x=await call('/api/connect/wix?return_to=/?open=integraties',{headers:{authorization:auth}});assert.equal(x.r.status,302);const install=new URL(x.r.headers.get('location'));assert.equal(install.origin+install.pathname,'https://www.wix.com/app-installer');assert.equal(install.searchParams.get('appId'),'wix-app');assert.equal(install.searchParams.get('shareUrlId'),'wix-share-id');const postInstall=new URL(install.searchParams.get('postInstallationUrl')),wixState=postInstall.searchParams.get('state');assert.equal(postInstall.origin+postInstall.pathname,publicBase+'/api/connect/wix/callback');assert(wixState);assert.equal(stateStore()[stateKey(wixState)].status,'PENDING');
  await stop();await start();const payload=Buffer.from(JSON.stringify({instanceId:'wix-instance-1',appId:'wix-app'})).toString('base64url'),signature=crypto.createHmac('sha256','wix-secret').update(payload).digest('base64url'),signedInstance=`${signature}.${payload}`;const wixCallback=`/api/connect/wix/callback?state=${encodeURIComponent(wixState)}&appId=wix-app&tenantId=wix-site-1&instanceId=wix-instance-1&signedInstance=${encodeURIComponent(signedInstance)}`;x=await call(wixCallback);assert.equal(x.r.status,302);assert(!x.r.headers.get('www-authenticate'));assert((x.r.headers.get('location')||'').includes('wix=connected'),x.r.headers.get('location'));assert.equal(stateStore()[stateKey(wixState)].status,'USED');const wixStatus=await call('/api/connect/wix/status',{headers:{authorization:auth}});assert.equal(wixStatus.body.connected,true);const wixReplay=await call(wixCallback);assert((wixReplay.r.headers.get('location')||'').includes('oauth_state_invalid'));
  const persistedFiles=fs.readdirSync(dataDir).filter(f=>/^(connector-|google-)/.test(f)&&f!=='connector-oauth-states.json');assert(persistedFiles.length>=4);for(const file of persistedFiles){const raw=fs.readFileSync(path.join(dataDir,file),'utf8');assert(raw.includes('"encrypted": true'));assert(!raw.includes('mock-'))}
  console.log(JSON.stringify({ok:true,basic_auth_start:'pass',public_callbacks:'pass',providers:[...providers.map(x=>x.id),'wix'],generic_oauth_state:'pass',wix_signed_instance:'pass',wix_native_install:'pass',restart_persistence:'pass',tenant_binding:'pass',state_integrity:'pass',one_time_replay:'pass',concurrent_callback:'pass',transient_retry:'pass',reconnect_rollback:'pass',encrypted_tokens:'pass',bootstrap_and_connected:'pass'},null,2));
}catch(e){console.error(logs);console.error(e);process.exitCode=1}finally{await stop()}})();
