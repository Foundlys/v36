'use strict';
const dns=require('node:dns').promises,lookup=dns.lookup.bind(dns),nativeFetch=global.fetch;
dns.lookup=async(host,options)=>host==='discovery.fixture.invalid'?(options?.all?[{address:'93.184.216.34',family:4}]:{address:'93.184.216.34',family:4}):lookup(host,options);
global.fetch=async(input,options)=>{
 const url=new URL(typeof input==='string'?input:input.url);if(url.hostname!=='discovery.fixture.invalid')return nativeFetch(input,options);
 if(process.env.ZERO_EVALUATION_DISCOVERY_STATUS)return new Response('{}',{status:Number(process.env.ZERO_EVALUATION_DISCOVERY_STATUS)});
 return new Response(JSON.stringify({openapi:'3.1.0',paths:{'/customers':{get:{operationId:'list'}}},components:{schemas:{PrivateCustomer:{properties:{id:{type:'string'}}}}}}));
};
