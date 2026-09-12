'use strict';
// Fixed Google OAuth endpoints only. No URL, redirect, TLS policy or HTTP header
// can be supplied through a tenant request. Tokens are sent only after peer and
// certificate checks on a new DNS-pinned connection.
const https=require('node:https'),dns=require('node:dns').promises,net=require('node:net'),crypto=require('node:crypto'),{destination}=require('./communication-smtp'),{sameAddress}=require('./communication-addresses');
const failure=(code,statusCode=502)=>Object.assign(new Error('De mailprovider kon de autorisatie niet bevestigen'),{code,statusCode});
function payload(kind,input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw failure('mail_oauth_request_invalid',422);
 if(kind==='USERINFO'){if(Object.keys(input).length!==1||typeof input.access_token!=='string'||input.access_token.length>4096||!/^[-a-zA-Z0-9._~+/]+=*$/.test(input.access_token))throw failure('mail_oauth_request_invalid',422);return {host:'openidconnect.googleapis.com',path:'/v1/userinfo',method:'GET',authorization:'Bearer '+input.access_token,body:''};}
 if(kind!=='TOKEN'||Object.keys(input).some(key=>!['grant_type','client_id','client_secret','code','redirect_uri','code_verifier','refresh_token'].includes(key))||Object.values(input).some(value=>typeof value!=='string'||!value||value.length>8192||/[\x00-\x1f\x7f]/.test(value))||!['authorization_code','refresh_token'].includes(input.grant_type))throw failure('mail_oauth_request_invalid',422);
 const keys=input.grant_type==='authorization_code'?['grant_type','client_id','client_secret','code','redirect_uri','code_verifier']:['grant_type','client_id','client_secret','refresh_token'];if(Object.keys(input).length!==keys.length||keys.some(key=>!Object.hasOwn(input,key)))throw failure('mail_oauth_request_invalid',422);
 const body=new URLSearchParams(input).toString();if(Buffer.byteLength(body)>16384)throw failure('mail_oauth_request_invalid',422);return {host:'oauth2.googleapis.com',path:'/token',method:'POST',body};
}
function createTransport({lookup=dns.lookup.bind(dns),request=https.request,timeoutMs=15000}={}){
 return async(kind,input,{authorize=()=>{}}={})=>{
  const target=payload(kind,input);let req,socket,timer,expired=false;
  const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{expired=true;req?.destroy();socket?.destroy();reject(failure('mail_oauth_timeout'));},timeoutMs);});
  const work=async()=>{
   authorize();const address=await destination(target.host,lookup);if(expired)throw failure('mail_oauth_timeout');authorize();const family=net.isIP(address);
   return new Promise((resolve,reject)=>{
    let settled=false;const fail=error=>{if(settled)return;settled=true;reject(error);req?.destroy();socket?.destroy();};
    req=request({hostname:target.host,port:443,path:target.path,method:target.method,servername:target.host,minVersion:'TLSv1.2',rejectUnauthorized:true,agent:false,family,autoSelectFamily:false,lookup:(_host,_options,callback)=>callback(null,address,family)},response=>{
     const chunks=[];let size=0;try{authorize();if(response.statusCode>=300&&response.statusCode<400)throw failure('mail_oauth_redirect_refused');if(!/^application\/json(?:;|$)/i.test(response.headers['content-type']||''))throw failure('mail_oauth_response_invalid');}catch(error){fail(error);response.destroy();return;}
     response.on('error',()=>fail(failure('mail_oauth_response_incomplete')));response.on('aborted',()=>fail(failure('mail_oauth_response_incomplete')));
     response.on('data',chunk=>{try{authorize();size+=chunk.length;if(size>65536)throw failure('mail_oauth_response_too_large');chunks.push(chunk);}catch(error){fail(error);response.destroy();}});
     response.on('end',()=>{try{authorize();if(!response.complete)throw failure('mail_oauth_response_incomplete');const bytes=Buffer.concat(chunks),text=bytes.toString('utf8');if(!Buffer.from(text).equals(bytes))throw failure('mail_oauth_response_invalid');const body=JSON.parse(text);if(!body||typeof body!=='object'||Array.isArray(body))throw failure('mail_oauth_response_invalid');settled=true;resolve({status:response.statusCode,body,tls_verified:true,host:target.host,observed_at:new Date().toISOString(),body_sha256:crypto.createHash('sha256').update(bytes).digest('hex')});}catch(error){fail(error.code?error:failure('mail_oauth_response_invalid'));}});
    });
    req.once('error',()=>fail(failure('mail_oauth_connection_failed')));
    req.once('socket',active=>{socket=active;active.once('secureConnect',()=>{try{if(expired)throw failure('mail_oauth_timeout');if(!active.authorized||!sameAddress(active.remoteAddress,address))throw failure('mail_oauth_tls_or_destination_invalid');authorize();req.setHeader('accept','application/json');if(target.authorization)req.setHeader('authorization',target.authorization);if(target.method==='POST'){req.setHeader('content-type','application/x-www-form-urlencoded');req.setHeader('content-length',Buffer.byteLength(target.body));}req.end(target.body);}catch(error){fail(error);}});});
   });
  };
  try{return await Promise.race([work(),deadline]);}catch(error){if(/^(?:mail_|smtp_|identity_|composition_|core_)/.test(error?.code||''))throw error;throw failure('mail_oauth_unavailable');}finally{clearTimeout(timer);req?.destroy();socket?.destroy();}
 };
}
module.exports={createTransport,payload};
