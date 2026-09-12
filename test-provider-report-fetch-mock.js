'use strict';
// Test preload only. Every provider response below is a labeled fixture.
require('./test-oauth-fetch-mock');
const fs=require('node:fs'),previous=globalThis.fetch;
globalThis.fetch=async(input,init={})=>{
  const url=new URL(String(typeof input==='string'||input instanceof URL?input:input.url));
  if(url.hostname==='analyticsdata.googleapis.com'){
    fs.appendFileSync(process.env.FOUNDLY_PROVIDER_QUERY_TEST_LOG,JSON.stringify({path:url.pathname,request:JSON.parse(String(init.body))})+'\n');
    return new Response(JSON.stringify({fixture:'SYNTHETIC_GA4_REPORT_NOT_LIVE_EVIDENCE',rowCount:1,rows:[{metricValues:[{value:'7'}]}]}),{status:200,headers:{'content-type':'application/json'}});
  }
  return previous(input,init);
};
