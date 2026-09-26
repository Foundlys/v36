'use strict';
// Test-only HTTPS transport adapter. Production URL and principal checks still
// run before requests reach the isolated loopback provider in the HTTP test.
require('./provider-network-fixture');
const nativeFetch=global.fetch;
global.fetch=async(input,options)=>{
 const url=new URL(typeof input==='string'?input:input.url);
 if(url.hostname!=='workflow-language.fixture.invalid')return nativeFetch(input,options);
 const target=new URL(process.env.FOUNDLY_WORKFLOW_PROVIDER_FIXTURE_URL);
 if(target.protocol!=='http:'||target.hostname!=='127.0.0.1')throw new Error('Workflow fixture must use loopback HTTP');
 target.pathname=url.pathname;target.search=url.search;
 return nativeFetch(target,options);
};
