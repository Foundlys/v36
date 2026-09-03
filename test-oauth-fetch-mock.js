'use strict';

const nativeFetch=globalThis.fetch;
const attempts=new Map();
function json(body,status=200){return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}})}
function formValue(init,name){try{return new URLSearchParams(String(init?.body||'')).get(name)||''}catch{return ''}}

globalThis.fetch=async(input,init={})=>{
  const url=String(typeof input==='string'||input instanceof URL?input:input.url);
  if(url.startsWith('http://127.0.0.1:')||url.startsWith('http://localhost:'))return nativeFetch(input,init);

  if(url.includes('graph.facebook.com')&&url.includes('/oauth/access_token')){
    const code=formValue(init,'code');
    if(code==='retry-once'){
      const n=(attempts.get(code)||0)+1;attempts.set(code,n);
      if(n===1)return json({error:{message:'temporary provider failure'}},503);
    }
    return json({access_token:'mock-meta-access-token',expires_in:3600,token_type:'bearer'});
  }
  if(url.includes('graph.facebook.com')&&url.includes('/me/adaccounts'))return json({data:[]});
  if(url.includes('graph.facebook.com')&&url.includes('/me/accounts'))return json({data:[]});
  if(url.includes('graph.facebook.com')&&url.includes('/me?'))return json({id:'meta-user-1',name:'Meta Test'});

  if(url==='https://www.linkedin.com/oauth/v2/accessToken')return json({access_token:'mock-linkedin-access-token',expires_in:3600});
  if(url==='https://api.linkedin.com/v2/userinfo')return json({sub:'linkedin-user-1',name:'LinkedIn Test'});

  if(url==='https://open.tiktokapis.com/v2/oauth/token/')return json({access_token:'mock-tiktok-access-token',refresh_token:'mock-tiktok-refresh-token',expires_in:3600});
  if(url.startsWith('https://open.tiktokapis.com/v2/user/info/'))return json({data:{user:{open_id:'tiktok-user-1',display_name:'TikTok Test'}}});

  if(url==='https://oauth2.googleapis.com/token')return json({access_token:'mock-google-access-token',refresh_token:'mock-google-refresh-token',expires_in:3600,token_type:'Bearer'});
  if(url==='https://openidconnect.googleapis.com/v1/userinfo')return json({sub:'google-user-1',email:'oauth-test@example.invalid'});
  if(url.startsWith('https://analyticsadmin.googleapis.com/'))return json({accountSummaries:[]});
  if(url.startsWith('https://www.googleapis.com/webmasters/'))return json({siteEntry:[]});
  if(url.includes('googleapis.com/calendar/'))return json({items:[]});
  if(url.includes('googleads.googleapis.com/'))return json({resourceNames:[]});

  return nativeFetch(input,init);
};
