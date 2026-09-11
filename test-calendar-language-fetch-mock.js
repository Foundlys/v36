'use strict';
// Isolated HTTP fixture only. No real provider request or credential is used.
const fs=require('node:fs'),original=global.fetch;
global.fetch=async(input,options={})=>{
 if(String(input)!=='https://calendar-language.fixture.invalid/responses')return original(input,options);
 const request=JSON.parse(JSON.parse(options.body).input).request;
 if(request.includes('WAIT_CALENDAR_MODEL')){
  fs.writeFileSync(process.env.FOUNDLY_CALENDAR_MODEL_BARRIER,'model-request-observed');
  for(let i=0;i<400&&!fs.existsSync(process.env.FOUNDLY_CALENDAR_MODEL_BARRIER+'.release');i++)await new Promise(resolve=>setTimeout(resolve,10));
  if(!fs.existsSync(process.env.FOUNDLY_CALENDAR_MODEL_BARRIER+'.release'))throw Error('Fixture model release missing');
 }
 const draft={title:'PRIVATE isolated model proposal',start_local:'2026-09-23T10:00',end_local:'2026-09-23T11:00',participant_names:[],recurrence:null,...(request==='INVALID_CALENDAR_MODEL'?{send:true}:{})};
 return new Response(JSON.stringify({output_text:JSON.stringify({draft})}),{status:200,headers:{'content-type':'application/json'}});
};
