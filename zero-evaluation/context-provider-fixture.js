'use strict';
require('./provider-network-fixture');
const fs=require('node:fs');
const original=globalThis.fetch;
globalThis.fetch=async(url,options={})=>{
  if(String(url)==='https://api.openai.com/v1/responses'){
    const payload=JSON.parse(options.body),input=String(payload.input);
    const barrier=process.env.ZERO_EVALUATION_PROVIDER_BARRIER;
    if(barrier&&input.includes('PAUSE_FOR_REVOCATION')){
      fs.writeFileSync(barrier+'.started','started');
      for(let n=0;n<300&&!fs.existsSync(barrier+'.release');n++)await new Promise(r=>setTimeout(r,10));
      if(!fs.existsSync(barrier+'.release'))throw Error('Fixture release timeout');
    }
    // Deliberately copy source data to test retention/revocation. This is a
    // transport failure/security fixture, never cognitive-quality evidence.
    const value=(input.match(/ZERO_PRIVATE_[A-Z]+/)||[])[0]||'No matching memory in supplied context.';
    return new Response(JSON.stringify({status:'completed',output_text:value,usage:{input_tokens:50,output_tokens:10}}),{status:200});
  }
  return original(url,options);
};
