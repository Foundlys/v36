'use strict';
(function(root){
 const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value),integer=value=>Number.isSafeInteger(value)&&value>=0,optionalInteger=value=>value===null||integer(value),hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
 const canonical=value=>Array.isArray(value)?value.map(canonical):object(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value,same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b)),clone=value=>JSON.parse(JSON.stringify(value));
 const iso=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value,invalid=()=>Object.assign(Error('marketing_metric_observation_invalid'),{code:'marketing_metric_observation_invalid'});
 const decisions=new Set(['DUPLICATE_OR_MISSING_SOURCE_ID','EXACT_COMPLETE_FINANCIAL_OUTCOME_UNAVAILABLE','RECORDED_DISTINCT_LEAD_SOURCE','CURRENCY_UNAVAILABLE','METRIC_WINDOW_OR_SEMANTICS_UNVERIFIED','RECORDED_METRIC_INPUT','CONFLICTING_FINANCIAL_OUTCOME','SELECTED_TERMINAL_OUTCOME','SUPERSEDED_FINANCIAL_STAGE','DUPLICATE_TERMINAL_OBSERVATION']);
 function expectedQuery(input){
  const query={from:new Date(input.from).toISOString(),to:new Date(input.to).toISOString()};
  for(const key of ['campaign_ids','sources'])if(input[key])query[key]=[...input[key]].sort();return query;
 }
 function verifyQuery(data,input){
  if(!object(data)||!object(data.query)||!same(data.query,expectedQuery(input))||!hash(data.query_fingerprint)||!iso(data.observed_to)||data.observed_to<=data.query.from||data.observed_to>data.query.to||data.period_complete!==(data.observed_to===data.query.to)||data.scope!=='CURRENT_AUTHORIZED_RECORDED_EVENTS'||data.attribution_model!=='RECORDED_EXPLICIT_OUTCOME_LINKS'||data.provider_verified!==false||data.source_records_modified!==false||data.cross_currency_total!==null)throw invalid();
  if(!['events_evaluated','supporting_record_count','unresolved_record_count','invalid_visible_timestamp_count'].every(key=>integer(data[key]))||data.supporting_record_count+data.unresolved_record_count>data.events_evaluated||!optionalInteger(data.leads_count)||!optionalInteger(data.conversions_count)||data.leads_count>data.events_evaluated||data.conversions_count>data.events_evaluated||data.financial_reconciliation_complete!==(data.unresolved_record_count===0&&data.invalid_visible_timestamp_count===0))throw invalid();
  if(!Array.isArray(data.source_preview)||data.source_preview.length!==Math.min(data.events_evaluated,100)||data.source_preview.some(row=>!object(row))||data.source_preview_truncated!==(data.events_evaluated>100)||!Array.isArray(data.currency_groups))throw invalid();
  const currencies=new Set();let outcomes=0;
  for(const group of data.currency_groups){
   if(!object(group)||typeof group.currency!=='string'||!/^[A-Z]{3}$/.test(group.currency)||currencies.has(group.currency)||!['spend_cents','revenue_cents','impressions','clicks'].every(key=>optionalInteger(group[key]))||!integer(group.reconciled_outcomes)||group.source_completeness!=='UNVERIFIED')throw invalid();
   currencies.add(group.currency);outcomes+=group.reconciled_outcomes;
   if(group.roas!==(group.spend_cents>0&&group.revenue_cents!==null?group.revenue_cents/group.spend_cents:null)||group.ctr!==(group.impressions>0&&group.clicks!==null?group.clicks/group.impressions*100:null)||group.cpc_cents!==(group.clicks>0&&group.spend_cents!==null?Math.round(group.spend_cents/group.clicks):null))throw invalid();
   if(!data.financial_reconciliation_complete&&['spend_cents','revenue_cents','impressions','clicks'].some(key=>group[key]!==null))throw invalid();
  }
  if(!integer(outcomes)||outcomes>data.events_evaluated||data.conversions_count!==(data.financial_reconciliation_complete&&outcomes?outcomes:null)||!data.financial_reconciliation_complete&&data.leads_count!==null)throw invalid();
  return clone(data);
 }
 function verifyPage(data,current,offset){
  const total=current.supporting_record_count+current.unresolved_record_count;
  if(!object(data)||data.query_fingerprint!==current.query_fingerprint||data.current_source_revalidated!==true||data.source_records_modified!==false||data.total!==total||data.offset!==offset||data.limit!==25||data.next_offset!==(offset+25<total?offset+25:null)||!Array.isArray(data.items)||data.items.length!==Math.min(25,Math.max(0,total-offset)))throw invalid();
  for(const row of data.items){
   if(!object(row)||!decisions.has(row.decision)||row.reason!==undefined&&row.reason!==row.decision||!object(row.projected_fields)&&row.projected_fields!==null)throw invalid();
   const fields=row.projected_fields;
   if(fields&&(fields.event_id!==row.event_id||fields.source!==row.source)||!fields&&row.decision!=='DUPLICATE_OR_MISSING_SOURCE_ID')throw invalid();
   if(row.decision!=='DUPLICATE_OR_MISSING_SOURCE_ID'&&(typeof row.event_id!=='string'||!row.event_id||typeof row.source!=='string'||!row.source))throw invalid();
  }
  return clone(data);
 }
 function create({document,request,isActive=()=>true}){
  const i18n=root.FoundlyI18n,el=(tag,text='')=>{const node=document.createElement(tag);node.textContent=text;return node;},box=el('section'),form=el('div'),status=el('output'),result=el('div'),sources=el('div'),bindings=new Map();
  const text=(key,params={})=>i18n.t('marketing.metrics.'+key,params),bind=(node,read)=>{node.textContent=read();bindings.set(node,{read,last:node.textContent});return node;},owned=(tag,key,params)=>bind(el(tag),()=>text(key,typeof params==='function'?params():params||{}));
  let serial=0,busy=false,current=null;const active=()=>box.isConnected&&isActive(),message=(key,common=false)=>bind(status,()=>common?i18n.t('common.'+key):text(key));
  status.setAttribute('role','status');status.setAttribute('aria-live','polite');box.append(owned('h3','title'),owned('p','description'),form,status,result,sources);
  document.addEventListener('foundly:locale',()=>{if(!active())return;for(const [node,binding]of bindings){if(!node.isConnected){bindings.delete(node);continue;}if(node.textContent===binding.last){binding.last=binding.read();node.textContent=binding.last;}}});
  const field=(key,value='')=>{const label=el('label'),input=el('input');input.value=value;input.setAttribute('data-metric-field',key);label.append(owned('span',key),input);form.append(label);return input;};
  const now=new Date(),from=field('from',new Date(now.getTime()-30*86400000).toISOString()),to=field('to',now.toISOString()),campaigns=field('campaign_ids'),sourceFilter=field('sources');
  function clear(){serial++;current=null;for(const container of [result,sources]){for(const node of container.querySelectorAll?.('*')||[])bindings.delete(node);container.replaceChildren();}}
  for(const input of [from,to,campaigns,sourceFilter])input.addEventListener('input',()=>{if(!active())return;clear();message('changed');});
  const count=value=>value===null?i18n.t('common.unknown'):i18n.number(value,Number.isInteger(value)?{}:{maximumSignificantDigits:15}),money=(value,currency)=>value===null?i18n.t('common.unknown'):i18n.currencyCents(value,currency),date=value=>i18n.date(value,{dateStyle:'medium',timeStyle:'medium',timeZone:'UTC'});
  const input=()=>{const value={from:from.value,to:to.value};if(campaigns.value.trim())value.campaign_ids=campaigns.value.split(',').map(v=>v.trim());if(sourceFilter.value.trim())value.sources=sourceFilter.value.split(',').map(v=>v.trim());return value;};
  function feedback(error){clear();const code=error.code;if([401,403].includes(error.status||error.statusCode))message('access_denied',true);else if(code==='marketing_metric_observation_invalid')message('invalid');else if(code==='marketing_metrics_source_changed')message('source_changed');else if(['marketing_metrics_query_invalid','marketing_metrics_period_invalid','marketing_metrics_filter_invalid','date_offset_required','date_invalid'].includes(code))message('query_invalid');else if(code==='marketing_metrics_period_unobserved')message('unobserved');else message('failed');}
  function lock(){if(!active())return;box.setAttribute('aria-busy',String(busy));for(const button of box.querySelectorAll('button'))button.disabled=busy;}
  function button(host,key,action,fn,valid=()=>true){const control=owned('button',key);control.type='button';control.setAttribute('data-metric-action',action);control.addEventListener('click',async()=>{if(busy||!active()||!control.isConnected||!valid())return;const at=serial;busy=true;lock();try{await fn(at);}catch(error){if(active()&&at===serial)feedback(error);}finally{busy=false;lock();}});host.append(control);return control;}
  async function drill(observation,offset,at){
   const data=await request('/api/marketing/measurement/drilldown',{method:'POST',body:JSON.stringify({query:observation.query,query_fingerprint:observation.query_fingerprint,offset,limit:25})});if(!active()||at!==serial||observation!==current)return;
   const page=verifyPage(data,observation,offset);sources.replaceChildren(owned('h4','page',()=>({from:i18n.number(page.items.length?offset+1:0),to:i18n.number(offset+page.items.length),total:i18n.number(page.total)})));
   for(const row of page.items)sources.append(owned('p','decision.'+row.decision.toLowerCase()),el('pre',JSON.stringify(row,null,2)));
   if(page.next_offset!==null)button(sources,'next','next',nextAt=>drill(observation,page.next_offset,nextAt),()=>observation===current);message(observation.period_complete?'complete':'partial');
  }
  button(box,'calculate','query',async()=>{
   clear();const at=serial,selected=input();message('loading');
   // This read owns its generation; stale errors are handled here, not by an
   // outer handler whose generation preceded clear().
   try{
    const data=await request('/api/marketing/measurement/query',{method:'POST',body:JSON.stringify(selected)});if(!active()||at!==serial)return;const observation=verifyQuery(data,selected);current=observation;
    result.append(owned('p','period',()=>({from:date(observation.query.from),to:date(observation.query.to)})),owned('p','observed',()=>({to:date(observation.observed_to)})),owned('p','records',()=>({count:observation.events_evaluated,unresolved:count(observation.unresolved_record_count),invalid:count(observation.invalid_visible_timestamp_count)})),owned('p','outcomes',()=>({leads:count(observation.leads_count),conversions:count(observation.conversions_count)})));
    for(const group of observation.currency_groups)result.append(el('h4',group.currency),owned('p','money',()=>({spend:money(group.spend_cents,group.currency),revenue:money(group.revenue_cents,group.currency)})),owned('p','metrics',()=>({impressions:count(group.impressions),clicks:count(group.clicks),roas:count(group.roas)})));
    if(!observation.currency_groups.length)result.append(owned('p','no_groups'));result.append(owned('p','limits'));button(result,'trace','sources',nextAt=>drill(observation,0,nextAt),()=>observation===current);message(observation.period_complete?'complete':'partial');
   }catch(error){if(active()&&at===serial)feedback(error);}
  });
  box.canLeave=()=>{if(busy){message('wait');return false;}return true;};box.ready=Promise.resolve();return box;
 }
 root.FoundlyMarketingMetrics={create};
})(globalThis);
