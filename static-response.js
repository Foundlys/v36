'use strict';
const fs=require('node:fs');
const {Transform}=require('node:stream');
const INSTALL_HEAD='\n<link rel="manifest" href="/app.webmanifest">\n<link rel="apple-touch-icon" href="/foundly-app-180.png">\n<meta name="theme-color" content="#010207">\n<meta name="apple-mobile-web-app-capable" content="yes">\n<script src="/foundly-install.js" defer></script>\n';
function htmlLanguageStream(locale,installable=false){
  if(locale&&!/^[a-z]{2}-[A-Z]{2}$/.test(locale))throw Error('Invalid HTML locale');
  let prefix=Buffer.alloc(0),done=false;
  return new Transform({transform(chunk,encoding,callback){
    if(done)return callback(null,chunk);prefix=Buffer.concat([prefix,chunk]);
    // Inspect ASCII markup through latin1 so UTF-8 bytes split across input
    // chunks remain exactly intact. Installation markup is explicitly enabled
    // by the full runtime, never leaked into the independent CRM package.
    const source=prefix.toString('latin1'),match=/<html\b[^>]*>/i.exec(source);
    if(!match||installable&&!/<head\b[^>]*>/i.test(source)){if(prefix.length>8192){done=true;callback(null,prefix);prefix=Buffer.alloc(0);}else callback();return;}
    const tag=match[0],language=/\slang\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/i;
    const updated=!locale?tag:language.test(tag)?tag.replace(language,' lang="'+locale+'"'):tag.slice(0,-1)+' lang="'+locale+'">';
    let result=source.slice(0,match.index)+updated+source.slice(match.index+tag.length);
    if(installable)result=result.replace(/<head\b[^>]*>/i,head=>head+INSTALL_HEAD);
    done=true;callback(null,Buffer.from(result,'latin1'));prefix=Buffer.alloc(0);
  },flush(callback){if(prefix.length)this.push(prefix);callback();}});
}
// A filesystem failure belongs to its response, not the whole application.
function serveStaticFile(res,file,headers,{htmlLanguage,installable=false}={}){
  let stream,output;
  function unavailable(){
    if(res.destroyed||res.writableEnded)return;
    if(res.headersSent){res.destroy();return;}
    res.writeHead(503,{...headers,'content-type':'text/plain; charset=utf-8','cache-control':'no-store'});
    res.end('Dit bestand is tijdelijk niet beschikbaar.');
  }
  try{
    const transform=htmlLanguage||installable?htmlLanguageStream(htmlLanguage,installable):null;
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
