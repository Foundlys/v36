'use strict';

require('./test-oauth-fetch-mock');
const upstreamFetch=globalThis.fetch;

function json(body,status=200){return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}})}

globalThis.fetch=async(input,init={})=>{
  const url=String(typeof input==='string'||input instanceof URL?input:input.url);
  if(url==='https://api.openai.com/v1/realtime/client_secrets'){
    const headers=new Headers(init.headers||{}),authorization=headers.get('authorization')||'',safety=headers.get('openai-safety-identifier')||'';
    if(authorization!==`Bearer ${process.env.OPENAI_API_KEY}`)return json({error:{message:'server credential missing'}},401);
    if(!/^[a-f0-9]{64}$/.test(safety))return json({error:{message:'privacy-safe identifier missing'}},400);
    const body=JSON.parse(String(init.body||'{}')),session=body.session||{},tool=session.tools?.find(x=>x.name==='foundly_core');
    if(session.tool_choice!=='required'||session.audio?.input?.turn_detection?.type!=='semantic_vad'||session.audio?.input?.turn_detection?.interrupt_response!==true)return json({error:{message:'unsafe realtime session contract'}},422);
    if(JSON.stringify(tool?.parameters?.required)!==JSON.stringify(['message'])||tool?.parameters?.properties?.conversation_id||tool?.parameters?.properties?.turn_id)return json({error:{message:'client controls authoritative ids'}},422);
    return json({value:'ek_mock_ephemeral_only',expires_at:Math.floor(Date.now()/1000)+60,session});
  }
  if(url==='https://api.openai.com/v1/models')return json({data:[{id:'gpt-realtime'}]});
  if(url==='https://api.openai.com/v1/responses'){
    const body=JSON.parse(String(init.body||'{}'));
    if((body.tools||[]).some(x=>x.type==='web_search'))return json({output_text:'Live bronresultaat met actuele timestamp; verdere details blijven brongebonden.',output:[{type:'web_search_call',action:{sources:[{type:'url',title:'Officiële testbron',url:'https://example.com/live-source'},{type:'url',title:'Onveilige bron',url:'javascript:alert(1)'}]}}]});
    return json({output_text:'Gecontroleerd Foundly-antwoord op basis van de aangeleverde context.'});
  }
  return upstreamFetch(input,init);
};
