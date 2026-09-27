'use strict';
// Hold only the real native readiness fetch boundary. No live key or network is
// used; the existing transport fixture returns an explicitly unverified 401.
require('../test-readiness-fetch-mock');
const fs=require('node:fs'),fetch=globalThis.fetch;
globalThis.fetch=async(input,options)=>{
 const url=new URL(String(typeof input==='string'||input instanceof URL?input:input.url)),marker=process.env.FOUNDLY_WORKSPACE_PROVIDER_BARRIER;
 if(marker&&url.origin==='https://api.openai.com'&&url.pathname==='/v1/models'&&fs.existsSync(marker+'.armed')){
  fs.writeFileSync(marker+'.entered','isolated provider observation wait');const deadline=Date.now()+8000;
  while(!fs.existsSync(marker+'.release')){if(Date.now()>deadline)throw Error('Workspace fixture barrier timed out');await new Promise(resolve=>setTimeout(resolve,10));}
 }
 return fetch(input,options);
};
