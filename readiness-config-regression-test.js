'use strict';

const {spawn}=require('child_process');
const fs=require('fs');
const assert=require('assert');

const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let nextPort=20280+Math.floor(Math.random()*100);

async function withServer(overrides,verify){
  const port=nextPort++,dataDir=fs.mkdtempSync('/tmp/foundly-readiness-config-'),localBase=`http://127.0.0.1:${port}`;
  const runtimeEnv={
    ...process.env,
    NODE_ENV:'production',
    PORT:String(port),
    FOUNDLY_DATA_DIR:dataDir,
    FOUNDLY_ADMIN_USERNAME:'foundly',
    FOUNDLY_ADMIN_PASSWORD:'',
    FOUNDLY_ADMIN_TOKEN:'',
    FOUNDLY_ENCRYPTION_KEY:'',
    GOOGLE_TOKEN_ENCRYPTION_KEY:'',
    FOUNDLY_OAUTH_STATE_SECRET:'',
    GOOGLE_OAUTH_STATE_SECRET:'',
    CONNECTOR_OAUTH_STATE_SECRET:'',
    FOUNDLY_PUBLIC_BASE_URL:'',
    META_REDIRECT_URI:'',
    GOOGLE_REDIRECT_URI:'',
    LINKEDIN_REDIRECT_URI:'',
    TIKTOK_REDIRECT_URI:'',
    WIX_REDIRECT_URI:'',
    OPENAI_API_KEY:'readiness-openai-key',
    FOUNDLY_WORKER_INTERVAL_MS:'99999999',
    ...overrides
  };
  const child=spawn(process.execPath,['server.js'],{cwd:__dirname,env:runtimeEnv,stdio:['ignore','pipe','pipe']});
  let logs='';child.stdout.on('data',chunk=>logs+=chunk);child.stderr.on('data',chunk=>logs+=chunk);
  try{
    for(let i=0;i<80;i++){try{if((await fetch(localBase+'/api/health')).ok)break}catch{}await wait(75)}
    const health=await fetch(localBase+'/api/health');assert.equal(health.status,200,logs);
    await verify(localBase);
  }finally{
    child.kill('SIGTERM');
    for(let i=0;i<50&&child.exitCode===null;i++)await wait(40);
  }
}

async function getReady(base){const response=await fetch(base+'/api/ready');return {response,body:await response.json()}}

(async()=>{try{
  const productionOrigin='https://v36-production.up.railway.app';
  const strongPassword='R9v!Foundly-Admin-Regression-2026';
  const strongToken='gV7nQ2wL8sX4pR9mK6cD3fH5jB1zT0yU';
  const strongEncryption='Q8wR2tY6uI0pA4sD7fG9hJ3kL5zX1cVb';

  await withServer({
    FOUNDLY_PUBLIC_BASE_URL:productionOrigin,
    FOUNDLY_ADMIN_PASSWORD:'Existing#7',
    FOUNDLY_ENCRYPTION_KEY:'change-me-production-secret'
  },async base=>{
    const {body}=await getReady(base);assert.equal(body.checks.authentication,true);assert.equal(body.checks.encryption,false);assert.equal(body.checks.public_base_url,true);assert.equal(body.checks.oauth_callbacks,true);
    const existingAuth='Basic '+Buffer.from('foundly:Existing#7').toString('base64');
    const protectedResponse=await fetch(base+'/api/connectors',{headers:{authorization:existingAuth}});assert.equal(protectedResponse.status,200);
  });

  await withServer({
    FOUNDLY_PUBLIC_BASE_URL:productionOrigin,
    FOUNDLY_ADMIN_TOKEN:strongToken,
    FOUNDLY_ENCRYPTION_KEY:'<GENERATE_A_LONG_RANDOM_SECRET>'
  },async base=>{const {body}=await getReady(base);assert.equal(body.checks.authentication,true);assert.equal(body.checks.encryption,false)});

  await withServer({
    FOUNDLY_PUBLIC_BASE_URL:'https://localhost',
    FOUNDLY_ADMIN_PASSWORD:strongPassword,
    FOUNDLY_ENCRYPTION_KEY:strongEncryption
  },async base=>{const {body}=await getReady(base);assert.equal(body.checks.authentication,true);assert.equal(body.checks.encryption,true);assert.equal(body.checks.public_base_url,false);assert.equal(body.checks.oauth_callbacks,false)});

  await withServer({
    FOUNDLY_PUBLIC_BASE_URL:productionOrigin,
    FOUNDLY_ADMIN_PASSWORD:strongPassword,
    FOUNDLY_ENCRYPTION_KEY:strongEncryption,
    WIX_REDIRECT_URI:productionOrigin+'/api/connect/wix/callback/'
  },async base=>{const {body}=await getReady(base);assert.equal(body.checks.public_base_url,true);assert.equal(body.checks.oauth_callbacks,false)});

  await withServer({
    FOUNDLY_PUBLIC_BASE_URL:productionOrigin+'/',
    FOUNDLY_ADMIN_TOKEN:strongToken,
    FOUNDLY_ENCRYPTION_KEY:strongEncryption
  },async base=>{
    const {response,body}=await getReady(base);assert.equal(response.status,503);assert.equal(body.version,'5.3.0');assert.equal(body.checks.authentication,true);assert.equal(body.checks.encryption,true);assert.equal(body.checks.public_base_url,true);assert.equal(body.checks.oauth_callbacks,true);assert.deepEqual(body.failed,['storage_path','persistent_mount']);
  });

  console.log(JSON.stringify({ok:true,version:'5.3.0',configured_admin_secret_accepted:'pass',placeholder_encryption_rejected:'pass',localhost_origin_rejected:'pass',callback_exactness:'pass',derived_callbacks:'pass'},null,2));
}catch(error){console.error(error);process.exitCode=1}})();
