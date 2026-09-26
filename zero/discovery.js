'use strict';
const C=require('./contracts');
const {scopedMutation}=require('../scoped-mutation');
const BUCKET='zero:stack-observations',USAGE='zero:stack-discovery-usage';
function targetsFromEnvironment(env=process.env){if(!env.FOUNDLY_ZERO_DISCOVERY_TARGETS)return [];try{return JSON.parse(env.FOUNDLY_ZERO_DISCOVERY_TARGETS);}catch{C.fail('zero_discovery_config_invalid');}}
function validateTargets(input){
 if(!Array.isArray(input)||input.length>20)C.fail('zero_discovery_config_invalid');const ids=new Set();
 return input.map(t=>{C.keys(t,['id','schema_url','credential_env','module','ttl_seconds']);const id=C.identifier(t.id,80);if(ids.has(id))C.fail('zero_discovery_duplicate_target');ids.add(id);
  let url;try{url=new URL(t.schema_url);}catch{C.fail('zero_discovery_url_invalid');}
  if(url.protocol!=='https:'||url.username||url.password||url.hash||url.search||url.href.length>2000)C.fail('zero_discovery_url_invalid');
  if(t.credential_env!==undefined&&!/^[A-Z][A-Z0-9_]{2,80}$/.test(t.credential_env))C.fail('zero_discovery_credential_invalid');
  const ttl=t.ttl_seconds??3600;if(!Number.isInteger(ttl)||ttl<60||ttl>86400)C.fail('zero_discovery_ttl_invalid');
  return {id,schema_url:url.href,module:C.identifier(t.module,80),credential_env:t.credential_env||null,ttl_seconds:ttl,config_hash:C.hash(t)};
 });
}
function describeSchema(doc){
 if(!doc||typeof doc!=='object'||(!/^3\./.test(doc.openapi||'')&&doc.swagger!=='2.0'))C.fail('zero_discovery_schema_unsupported',422);
 const schemas=doc.components?.schemas||doc.definitions||{},items=[];
 if(Object.keys(schemas).length>300||Object.keys(doc.paths||{}).length>500)C.fail('zero_discovery_schema_too_large',413);
 for(const [name,schema]of Object.entries(schemas)){
  const properties=Object.entries(schema?.properties||{}).slice(0,100).map(([name,p])=>({name:String(name).slice(0,160),type:typeof p.type==='string'?p.type.slice(0,40):null,reference:typeof p.$ref==='string'?p.$ref.slice(0,500):null,required:Array.isArray(schema.required)&&schema.required.includes(name)}));
  items.push({kind:'SCHEMA',subject:String(name).slice(0,160),predicate:'documented_properties',value:properties});
 }
 const operations=[];for(const [path,methods]of Object.entries(doc.paths||{}))for(const method of ['get','post','put','patch','delete','head','options'])if(methods?.[method])operations.push({path:path.slice(0,300),method:method.toUpperCase(),operation_id:typeof methods[method].operationId==='string'?methods[method].operationId.slice(0,160):null});
 items.push({kind:'API',subject:'api',predicate:'documented_operations',value:operations.slice(0,500)});
 items.push({kind:'API',subject:'api',predicate:'specification_version',value:doc.openapi||doc.swagger});
 const schemes=doc.components?.securitySchemes||doc.securityDefinitions||{};
 items.push({kind:'PERMISSION',subject:'api',predicate:'documented_security_schemes',value:Object.entries(schemes).slice(0,40).map(([name,s])=>({name:name.slice(0,120),type:String(s.type||'UNKNOWN').slice(0,80),scheme:s.scheme?String(s.scheme).slice(0,80):null}))});
 if(doc.webhooks)items.push({kind:'EVENT',subject:'api',predicate:'documented_webhooks',value:Object.keys(doc.webhooks).slice(0,100).map(s=>s.slice(0,160))});
 return {items,limitations:['DOCUMENTATION_IS_NOT_RUNTIME_BEHAVIOR','REMOTE_SCHEMA_REFERENCES_NOT_RESOLVED','ROW_DATA_NOT_READ','IDENTITY_AND_EFFECTIVE_PERMISSIONS_NOT_PROVEN'],truncated:operations.length>500||Object.values(schemas).some(s=>Object.keys(s?.properties||{}).length>100)};
}
class StackProbe{
 constructor({adapter,targets=targetsFromEnvironment(),env=process.env,fetch:fetcher=globalThis.fetch,validateUrl,authorize,now=()=>new Date()}){this.adapter=adapter;this.targets=validateTargets(targets);this.env=env;this.fetch=fetcher;this.validateUrl=validateUrl;this.authorize=authorize;this.now=now;this.running=new Set();}
 allowed(c,a,t){C.scope(c,a);C.permit(a,'connectors:manage');return this.authorize(c,a,t.module)===true;}
 facts(c,a){
  const facts=[],at=this.now().toISOString();
  for(const target of this.targets){let allowed=false;try{allowed=this.allowed(c,a,target);}catch(e){if(e.statusCode===401)throw e;}if(!allowed)continue;
   const rows=this.adapter.bucket(c,BUCKET).filter(r=>C.sameScope(r,c)&&r.owner_id===a.id&&r.target_id===target.id&&r.config_hash===target.config_hash),latest=rows.at(-1);
   const common={...C.scope(c,a),source_reference:target.schema_url,observed_at:latest?.observed_at||null,expires_at:latest?.expires_at||null,target_id:target.id};
   if(!latest||latest.state!=='OBSERVED'||latest.expires_at<=at){facts.push({...common,id:C.hash([target.id,at]).slice(0,32),kind:'SYSTEM',subject:target.id,predicate:'schema_discovery',value:null,evidence_state:latest?.state==='BLOCKED'?'BLOCKED':'UNKNOWN',reason:latest?.expires_at<=at?'STALE_METADATA':latest?.code||'NO_AUTHORIZED_OBSERVATION'});continue;}
   for(const fact of latest.schema.items)facts.push({...common,...fact,id:C.hash([target.id,latest.document_hash,fact]).slice(0,32),subject:target.id+':'+fact.subject,evidence_state:'PROVEN',proof_scope:'OBSERVED_SCHEMA_DOCUMENT_ONLY',document_hash:latest.document_hash,untrusted_data:true});
   for(const reason of latest.schema.limitations)facts.push({...common,id:C.hash([target.id,reason]).slice(0,32),kind:'SYSTEM',subject:target.id,predicate:reason.toLowerCase(),value:null,evidence_state:'UNKNOWN',reason});
   if(latest.schema.truncated)facts.push({...common,id:C.hash([target.id,'truncated']).slice(0,32),kind:'SCHEMA',subject:target.id,predicate:'complete_schema',value:false,evidence_state:'UNKNOWN',reason:'SCHEMA_PROJECTION_TRUNCATED'});
  }
  return facts;
 }
 catalog(c,a){return this.targets.filter(t=>{try{return this.allowed(c,a,t);}catch(e){if(e.statusCode===401)throw e;return false;}}).map(t=>({id:t.id,module:t.module,adapter:'OPENAPI_DOCUMENT_READ',configured:true,credentials_present:t.credential_env?Boolean(this.env[t.credential_env]):null,connection_verified:false}));}
 async discover(c,a,input){
  C.keys(input,['target_id']);const target=this.targets.find(t=>t.id===input.target_id);if(!target||!this.allowed(c,a,target))C.fail('zero_discovery_target_denied',403);
  const identity=C.scope(c,a),key=C.hash([c.tenant_id,c.dealer_id]),at=this.now().toISOString(),day=at.slice(0,10),usage=this.adapter.bucket(c,USAGE);
  if(this.running.has(key))C.fail('zero_discovery_running',429);if(usage.filter(r=>C.sameScope(r,c)&&r.day===day).length>=50)C.fail('zero_discovery_budget',429);
  scopedMutation(this.adapter,c,[USAGE],()=>{for(let i=usage.length-1;i>=0;i--)if(usage[i].day<day)usage.splice(i,1);usage.push({...identity,day,target_id:target.id,at});});
  this.running.add(key);const controller=new AbortController();let timer;
  const check=()=>{C.scope(c,a);if(a.id!==identity.owner_id||!this.allowed(c,a,target))C.fail('zero_discovery_revoked',403);};
  try{
   let observation;try{
    const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Object.assign(Error('Discovery timeout'),{code:'zero_discovery_timeout'}));},8000);});
    const read=async()=>{
     if(!this.validateUrl)C.fail('zero_discovery_network_policy_missing',503);await this.validateUrl(target.schema_url);check();
     const headers={accept:'application/json'};if(target.credential_env){const credential=this.env[target.credential_env];if(!credential)C.fail('zero_discovery_not_configured',503);headers.authorization='Bearer '+credential;}
     const response=await this.fetch(target.schema_url,{headers,signal:controller.signal,redirect:'error'});check();
     if(!response.ok)C.fail('zero_discovery_provider_'+response.status,502);
     const chunks=[];let size=0;for await(const chunk of response.body){size+=chunk.length;if(size>524288){controller.abort();C.fail('zero_discovery_document_too_large',413);}chunks.push(Buffer.from(chunk));}
     const raw=Buffer.concat(chunks).toString('utf8');let doc;try{doc=JSON.parse(raw);}catch{C.fail('zero_discovery_document_invalid',422);}
     return {schema:describeSchema(doc),document_hash:C.hash(raw)};
    };
    observation={state:'OBSERVED',...await Promise.race([read(),timeout])};
   }catch(error){if(error.statusCode===401||error.statusCode===403)throw error;observation={state:'BLOCKED',code:error.code||'zero_discovery_provider_unavailable'};}
   check();const row={id:C.hash([identity,target.id,at]),...identity,target_id:target.id,config_hash:target.config_hash,observed_at:at,expires_at:new Date(this.now().getTime()+target.ttl_seconds*1000).toISOString(),...observation};
   scopedMutation(this.adapter,c,[BUCKET],()=>{const rows=this.adapter.bucket(c,BUCKET);for(let i=rows.length-1;i>=0;i--)if(C.sameScope(rows[i],c)&&rows[i].owner_id===a.id&&rows[i].target_id===target.id)rows.splice(i,1);rows.push(row);});
   return {ok:row.state==='OBSERVED',state:row.state,code:row.code||null,target_id:target.id,observed_at:at,source_reference:target.schema_url,document_hash:row.document_hash||null,proof_scope:'SCHEMA_DOCUMENT_ONLY',connection_to_business_data_verified:false};
  }finally{clearTimeout(timer);controller.abort();this.running.delete(key);}
 }
}
module.exports={StackProbe,describeSchema,validateTargets,BUCKET};
