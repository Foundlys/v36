'use strict';
// Explicitly isolated provider transport and disk-failure boundary. No request
// reaches a real provider; all unselected providers return unverified HTTP 401.
const fs=require('node:fs'),path=require('node:path'),dns=require('node:dns').promises,http=require('node:http');
const dir=process.env.FOUNDLY_SYNC_FIXTURE_DIR;
if(!dir)throw Error('Isolated sync fixture directory required');
const file=name=>path.join(dir,name),config=()=>JSON.parse(fs.readFileSync(file('control.json'),'utf8'));
dns.lookup=async host=>{if(host==='source-sync.fixture.test'&&config().dns_wait){fs.writeFileSync(file('dns-started'),'lookup observed');for(let n=0;!fs.existsSync(file('dns-release'));n++){if(n>250)throw Error('Isolated DNS wait expired');await new Promise(resolve=>setTimeout(resolve,20));}}return [{address:'93.184.216.34',family:4}];};
globalThis.fetch=async(url,options={})=>{
 const u=new URL(String(url));if(u.hostname!=='source-sync.fixture.test')return new Response('UNVERIFIED ISOLATED PROVIDER',{status:401});
 if(u.pathname==='/health')return new Response('{}',{status:200});
 const c=config(),n=Number(fs.existsSync(file('fetches'))?fs.readFileSync(file('fetches'),'utf8'):0);fs.writeFileSync(file('fetches'),String(n+1));fs.writeFileSync(file('started'),'request observed');
 if(c.wait)for(let i=0;!fs.existsSync(file('release'));i++){if(i>250||options.signal?.aborted)throw Error('Isolated transport wait expired');await new Promise(resolve=>setTimeout(resolve,20));}
 return new Response(c.raw??JSON.stringify(c.payload),{status:c.status||200,headers:{'content-type':'application/json'}});
};
const rename=fs.renameSync;fs.renameSync=function(from,to,...args){if(path.basename(to)==='foundly-core-state.json'&&fs.existsSync(file('fail-commit')))throw Object.assign(Error('Isolated commit failure'),{code:'EIO'});return rename.call(this,from,to,...args);};
const emit=http.Server.prototype.emit;http.Server.prototype.emit=function(event,req,res,...rest){if(event==='request'&&req.url==='/api/connector-runtime/sync/rdw'&&req.headers['x-zero-sync-drop-reply']==='isolated-http-fixture'){const end=res.end;res.end=function(...args){if(this.statusCode===200){this.socket.destroy();return this;}return end.apply(this,args);};}return emit.call(this,event,req,res,...rest);};
