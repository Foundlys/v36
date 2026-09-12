'use strict';
// Readiness is a configuration test, not a live provider acceptance test.
// Never send its deliberately invalid fixture key or inherited data upstream.
const nativeFetch=globalThis.fetch;
globalThis.fetch=async(input,init={})=>{
  const url=new URL(String(typeof input==='string'||input instanceof URL?input:input.url));
  if(['127.0.0.1','localhost','[::1]'].includes(url.hostname))return nativeFetch(input,init);
  if(url.origin==='https://api.openai.com'&&url.pathname==='/v1/models')return new Response(JSON.stringify({fixture:'READINESS_CONFIG_ONLY_NOT_PROVIDER_PROOF',error:{message:'Deliberately unverified fixture key'}}),{status:401,headers:{'content-type':'application/json'}});
  throw Object.assign(new Error('External transport disabled for readiness configuration fixtures'),{code:'readiness_test_external_transport_blocked'});
};
