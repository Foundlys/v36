'use strict';
// Explicitly loaded by the isolated composition fixture. No production import.
if(process.env.FOUNDLY_CONTEXT_ACL_TEST!=='1')throw new Error('Context ACL fixture not enabled');
const original=globalThis.fetch;
globalThis.fetch=async(input,init={})=>{
  const url=String(typeof input==='string'||input instanceof URL?input:input.url);
  if(url==='https://api.openai.com/v1/models')return new Response(JSON.stringify({data:[]}),{status:200});
  if(url==='https://api.openai.com/v1/responses'){
    const prompt=JSON.parse(String(init.body||'{}')).input||'';
    const safe=prompt.includes('Public fixture context')&&!prompt.includes('Private fixture contact');
    return new Response(JSON.stringify({output_text:safe?'context_acl_ok':'context_acl_failed'}),{status:200,headers:{'content-type':'application/json'}});
  }
  return original(input,init);
};
