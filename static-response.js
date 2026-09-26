'use strict';
const fs=require('node:fs');
const {Transform}=require('node:stream');
function htmlLanguageStream(locale){
  if(!/^[a-z]{2}-[A-Z]{2}$/.test(locale))throw Error('Invalid HTML locale');
  let prefix=Buffer.alloc(0),done=false;
  return new Transform({transform(chunk,encoding,callback){
    if(done)return callback(null,chunk);prefix=Buffer.concat([prefix,chunk]);
    // Inspect ASCII markup through latin1 so UTF-8 bytes split across input
    // chunks remain exactly intact. Only the initial html language is changed.
    const source=prefix.toString('latin1'),match=/<html\b[^>]*>/i.exec(source);
    if(!match){if(prefix.length>8192){done=true;callback(null,prefix);prefix=Buffer.alloc(0);}else callback();return;}
    const tag=match[0],language=/\slang\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/i;
    const updated=language.test(tag)?tag.replace(language,' lang="'+locale+'"'):tag.slice(0,-1)+' lang="'+locale+'">';
    done=true;callback(null,Buffer.concat([prefix.subarray(0,match.index),Buffer.from(updated,'latin1'),prefix.subarray(match.index+tag.length)]));prefix=Buffer.alloc(0);
  },flush(callback){if(prefix.length)this.push(prefix);callback();}});
}
// A filesystem failure belongs to its response, not the whole application.
function serveStaticFile(res,file,headers,{htmlLanguage}={}){
  let stream,output;
  function unavailable(){
    if(res.destroyed||res.writableEnded)return;
    if(res.headersSent){res.destroy();return;}
    res.writeHead(503,{...headers,'content-type':'text/plain; charset=utf-8','cache-control':'no-store'});
    res.end('Dit bestand is tijdelijk niet beschikbaar.');
  }
  try{
    const transform=htmlLanguage?htmlLanguageStream(htmlLanguage):null;
    stream=fs.createReadStream(file);
    stream.on('error',unavailable);
    output=transform?stream.pipe(transform):stream;
    if(output!==stream)output.on('error',unavailable);
    res.once('close',()=>{stream.destroy();if(output!==stream)output.destroy();});
    stream.once('open',()=>{
      if(res.destroyed||res.writableEnded){stream.destroy();return;}
      res.writeHead(200,headers);output.pipe(res);
    });
  }catch{unavailable();}
}
module.exports={serveStaticFile,htmlLanguageStream};
