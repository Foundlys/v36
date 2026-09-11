'use strict';
const fs=require('node:fs'),path=require('node:path');
const original=globalThis.fetch;globalThis.fetch=async(input,options={})=>{
 const url=new URL(String(input));if(url.hostname!=='www.googleapis.com')return original(input,options);
 if(!url.pathname.startsWith('/calendar/v3/calendars/'))throw Error('Unexpected fixture URL');
 if(options.method!=='GET'||options.redirect!=='error')throw Error('Unexpected fixture request');
 const dir=process.env.FOUNDLY_DATA_DIR,modeFile=path.join(dir,'calendar-mode'),mode=fs.existsSync(modeFile)?fs.readFileSync(modeFile,'utf8'):'normal';
 if(mode==='wait'){fs.writeFileSync(path.join(dir,'calendar-wait'),'waiting');for(let i=0;i<500&&!fs.existsSync(path.join(dir,'calendar-release'));i++)await new Promise(r=>setTimeout(r,10));}
 const start='2026-09-20T08:00:00Z',end='2026-09-20T09:00:00Z';
 if(mode==='fail'&&url.searchParams.has('pageToken'))return new Response('{}',{status:503});
 return new Response(JSON.stringify({kind:'calendar#events',timeZone:'Europe/Amsterdam',accessRole:'owner',...(!url.searchParams.has('pageToken')?{items:[],nextPageToken:'next'}:{items:[{id:'external-one',status:'confirmed',start:{dateTime:start},end:{dateTime:end},summary:'PRIVATE PROVIDER TITLE'}]})}),{headers:{'content-type':'application/json'}});
};
