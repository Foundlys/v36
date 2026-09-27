'use strict';
const fs=require('node:fs'),nativeFetch=global.fetch;
global.fetch=async(input,options)=>{
 const url=String(typeof input==='string'?input:input.url);if(url!=='https://api.openai.com/v1/realtime/client_secrets')return nativeFetch(input,options);
 const payload=JSON.parse(options.body),marker=process.env.ZERO_EVALUATION_VOICE_BARRIER;
 if(marker){fs.writeFileSync(marker+'.started','ready');for(let i=0;i<1000&&!fs.existsSync(marker+'.release');i++)await new Promise(r=>setTimeout(r,10));}
 return new Response(JSON.stringify({value:'isolated-ephemeral-fixture',expires_at:Math.floor(Date.now()/1000)+60,session:payload.session}));
};
