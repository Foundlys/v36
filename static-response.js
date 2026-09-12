'use strict';
const fs=require('node:fs');
// A filesystem failure belongs to its response, not the whole application.
function serveStaticFile(res,file,headers){
  let stream;
  function unavailable(){
    if(res.destroyed||res.writableEnded)return;
    if(res.headersSent){res.destroy();return;}
    res.writeHead(503,{...headers,'content-type':'text/plain; charset=utf-8','cache-control':'no-store'});
    res.end('Dit bestand is tijdelijk niet beschikbaar.');
  }
  try{
    stream=fs.createReadStream(file);
    stream.on('error',unavailable);
    res.once('close',()=>stream.destroy());
    stream.once('open',()=>{
      if(res.destroyed||res.writableEnded){stream.destroy();return;}
      res.writeHead(200,headers);stream.pipe(res);
    });
  }catch{unavailable();}
}
module.exports={serveStaticFile};
