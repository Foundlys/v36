'use strict';

// New business workflows use the existing Core bucket/persistence/event adapters.
// They never instantiate or depend on an optional CRM/Finance product.
const crypto = require('node:crypto');
const {scopedMutation}=require('./scoped-mutation');
const { sanitizeInput, normalizeContext } = require('./crm-core');
const { requirePermission } = require('./capability-resolver');
const clone = value => JSON.parse(JSON.stringify(value));
const fail = (code, message, statusCode = 422) => { throw Object.assign(new Error(message), { code, statusCode }); };
const DEFINITIONS = Object.freeze({
  analysis:{legacy:'rapportages',primary:'reports',entities:['reports','provider_reports','provider_events','cohort_definitions'],required:{cohort_definitions:['title','cohort_definition'],reports:['title','content'],provider_reports:['title'],provider_events:['title']}},
  procurement: { legacy: 'inkoop', primary: 'opportunities', entities: ['opportunities','suppliers','rfqs','bids','approval_policies','awards','quotes','orders','documents','tasks'], required: {approval_policies:['name','currency','minimum_value_cents','approval_steps'],awards:['title'], rfqs:['title','currency','lines'],bids:['title','rfq_id','rfq_revision','supplier_id','currency','lines','evidence_reference'],suppliers: ['name'], opportunities: ['title'], quotes: ['title'], orders: ['title'], documents: ['name'], tasks: ['title'] } },
  sales: { legacy: 'verkoop', primary: 'opportunities', entities: ['opportunities','pipelines','quotas','forecast_snapshots','quotes','orders','activities','tasks'], required: {quotas:['name','owner_id','period_start','period_end','currency','target_cents'],forecast_snapshots:['title'], opportunities: ['title'], pipelines: ['name'], quotes: ['title'], orders: ['title'], activities: ['title'], tasks: ['title'] } },
  marketing: { legacy: 'social_media', primary: 'campaigns', entities: ['campaigns','audiences','creatives','experiments','creative_reviews'], required: {creative_reviews:['title'],campaigns:['title'],audiences:['name'],creatives:['title','content'],experiments:['title']} },
  calendar: { legacy: 'agenda', primary: 'events', entities: ['events','calendars','availability','reminders','notifications'], required: { events: ['title','start_at','end_at','timezone'], calendars: ['name','timezone'], availability: ['title','start_at','end_at','timezone'],reminders:['title','due_at'],notifications:['title'] } },
  communication: { legacy: 'communicatie', primary: 'drafts', entities: ['drafts','messages','threads','templates','preferences','draft_revisions'], required: {draft_revisions:['title'], drafts: ['title','content'], messages: ['title','content'], threads: ['title'], templates: ['title','content'], preferences: ['subject_id','purpose','status'] } }
});
const INTERNAL_STATUSES = new Set(['DRAFT','OPEN','QUALIFIED','WON','LOST','CANCELLED','ARCHIVED','SCHEDULED','CONFIRMED','DECLINED','COMPLETED','APPROVAL_REQUIRED','APPROVED_INTERNAL']);
const OWNED_FIELDS = new Set(['cohort_definition','title','name','content','description','status','value_cents','cost_cents','currency','probability','supplier_id','opportunity_id','pipeline_id','stage_id','stages','owner_id','start_at','end_at','timezone','participants','calendar_id','recurrence','thread_id','to','cc','subject_id','purpose','legal_basis','related_refs','industry_fields','due_at','direction','consent_status','filters','hypothesis','success_metric','budget_cents','rfq_id','rfq_revision','lines','evidence_reference','minimum_value_cents','approval_steps','allow_self_approval','expected_close_date','closed_date','forecast_category','period_start','period_end','target_cents']);
const {timestamp,timezone,wallParts,wallNumber,fromWall}=require('./calendar-time');
function occurrences(row) {
  const start=timestamp(row.start_at),end=timestamp(row.end_at),rule=require('./calendar-recurrence').normalize(row.recurrence);
  if(end<=start)fail('date_order_invalid','Einde moet na start liggen');
  if(!rule)return [{start_at:new Date(start).toISOString(),end_at:new Date(end).toISOString()}];
  const {count,interval,frequency}=rule;
  const parts=wallParts(start,row.timezone),result=[];
  for(let i=0;i<count;i++){
    const date=new Date(wallNumber(parts)+(frequency==='WEEKLY'?7:1)*interval*i*86400000);
    const wall={year:date.getUTCFullYear(),month:date.getUTCMonth()+1,day:date.getUTCDate(),hour:date.getUTCHours(),minute:date.getUTCMinutes(),second:date.getUTCSeconds(),millisecond:date.getUTCMilliseconds()};
    const at=i===0?start:fromWall(wall,row.timezone);
    result.push({start_at:new Date(at).toISOString(),end_at:new Date(at+end-start).toISOString()});
  }
  return result;
}
class BusinessDomain {
  constructor(id, adapter, resolver) {
    if(!DEFINITIONS[id])throw new TypeError('Unknown business domain');
    this.id=id;this.definition=DEFINITIONS[id];this.adapter=adapter;this.resolver=resolver;
  }
  runtimeProbe(ctx,actor){this.scope(ctx,actor);return Object.values(this.summary(ctx,actor).by_entity).some(result=>result.available&&Array.isArray(result.items));}
  scope(ctx,actor,operation='read'){normalizeContext(ctx);requirePermission(actor,`${this.id}:${operation}`);return this.resolver.assertModule(ctx,actor,this.id,operation);}
  bucket(ctx,entity){if(!this.definition.entities.includes(entity))fail('entity_unknown','Onbekend onderdeel',404);return this.adapter.bucket(ctx,entity===this.definition.primary?this.definition.legacy:`${this.id}:${entity}`);}
  visible(row,actor){if(this.id==='communication'&&(row.owned_entity==='draft_revisions'||row.owned_entity==='drafts'&&row.collaborator_ids?.includes(actor.id)))return true;if(this.id==='marketing'&&row.owned_entity==='creative_reviews'&&row.approval_steps?.includes(actor.id))return true;if(this.id==='procurement'&&(row.owned_entity==='approval_policies'||row.owned_entity==='awards'&&row.approval_steps?.includes(actor.id)))return true;return (actor.roles||[]).some(r=>['ADMIN','SUPER_ADMIN','FOUNDER','MANAGER'].includes(String(r).toUpperCase()))||row.owner_id===actor.id;}
  validate(entity,input,previous={}){
    if(this.id==='communication'&&entity==='draft_revisions')fail('draft_history_immutable','Conceptgeschiedenis wordt uitsluitend door conceptacties vastgelegd');
    if(this.id==='marketing'&&entity==='creative_reviews')fail('creative_review_action_required','Gebruik de expliciete creatieve beoordelingsacties');
    if(entity.startsWith('provider_'))fail('provider_ingest_required','Providerresultaten worden uitsluitend door de geverifieerde rapportadapter opgeslagen');
    const unknown=Object.keys(input).filter(key=>!OWNED_FIELDS.has(key));if(unknown.length)fail('domain_fields_invalid','Niet-ondersteunde velden');
    if(this.id==='communication'&&entity==='drafts')require('./communication-drafts').validateInput(input);
    const next={...previous,...sanitizeInput(input)};
    if(Object.hasOwn(input,'cohort_definition')&&(this.id!=='analysis'||entity!=='cohort_definitions'))fail('cohort_definition_entity_invalid','Een cohortdefinitie hoort bij opgeslagen cohortanalyses');
    if(this.id==='analysis'&&entity==='cohort_definitions'){next.cohort_definition=require('./analysis-cohorts').normalizeCohortDefinition(next.cohort_definition);next.model_version=1;if(next.status&&!['DRAFT','ARCHIVED'].includes(next.status))fail('cohort_definition_status_invalid','Een opgeslagen definitie is een concept of gearchiveerd');}
    for(const field of this.definition.required[entity])if(!String(next[field]??'').trim())fail('domain_required',`${field} is verplicht`);
    if(next.status&&!INTERNAL_STATUSES.has(next.status)&&!(this.id==='communication'&&entity==='preferences'&&['GRANTED','DENIED','REVOKED'].includes(next.status)))fail('status_invalid','Ongeldige status');
    for(const field of ['value_cents','cost_cents','budget_cents'])if(next[field]!==undefined&&(!Number.isSafeInteger(next[field])||next[field]<0))fail('amount_invalid','Bedragen moeten niet-negatieve gehele centen zijn');
    if(next.probability!==undefined&&(!Number.isFinite(next.probability)||next.probability<0||next.probability>1))fail('probability_invalid','Kans moet tussen nul en één liggen');
    if(next.currency&&!/^[A-Z]{3}$/.test(next.currency))fail('currency_invalid','Ongeldige valuta');
    if(next.status==='APPROVED_INTERNAL'&&previous.status!=='APPROVED_INTERNAL')fail('approval_route_required','Gebruik de expliciete goedkeuringsactie');
    if(this.id==='calendar'&&['events','availability'].includes(entity)){
      timezone(next.timezone);if(!/(?:Z|[+-]\d{2}:\d{2})$/.test(next.start_at)||!/(?:Z|[+-]\d{2}:\d{2})$/.test(next.end_at))fail('date_offset_required','Start en einde moeten een UTC-offset bevatten');
      if(timestamp(next.end_at)<=timestamp(next.start_at))fail('date_order_invalid','Einde moet na start liggen');
      if(next.participants&&!Array.isArray(next.participants))fail('participants_invalid','Deelnemers moeten een lijst zijn');
      if(Object.hasOwn(next,'recurrence'))next.recurrence=require('./calendar-recurrence').normalize(next.recurrence);
      occurrences(next);
    }
    if(this.id==='calendar'&&entity==='calendars')timezone(next.timezone);
    if(this.id==='calendar'&&entity==='notifications')fail('notification_system_owned','Meldingen worden door de herinneringsworker aangemaakt');
    if(this.id==='calendar'&&entity==='reminders'){if(!/(?:Z|[+-]\d{2}:\d{2})$/.test(next.due_at))fail('date_offset_required','Herinnering vereist UTC-offset');timestamp(next.due_at);next.delivery_state='INTERNAL_ONLY';}
    if(this.id==='marketing')next.delivery_state='NOT_PUBLISHED';
    if(this.id==='sales'&&entity==='pipelines'&&next.stages){
      if(!Array.isArray(next.stages)||next.stages.length>30||next.stages.some(stage=>!stage.id||!stage.name||!Number.isFinite(stage.probability)||stage.probability<0||stage.probability>1)||new Set(next.stages.map(s=>s.id)).size!==next.stages.length)fail('pipeline_stages_invalid','Fases vereisen unieke IDs, namen en geldige kansen');
    }
    if(this.id==='communication'){
      if(entity==='messages')fail('provider_ingest_required','Berichten moeten via geverifieerde provider-ingest binnenkomen');
      if(next.to&&(!Array.isArray(next.to)||next.to.some(address=>typeof address!=='string'||!/^\S+@\S+\.\S+$/.test(address))))fail('recipients_invalid','Ongeldige e-mailontvangers');
      if(entity==='drafts'){if(typeof next.title!=='string'||typeof next.content!=='string'||next.title.length>1000||next.content.length>12000||next.to?.length>100)fail('draft_content_invalid','Ongeldige conceptinhoud');next.delivery_state='NOT_SENT';}
    }
    return next;
  }
  snapshotReadable(ctx,actor,row){return require('./sales-snapshot-access').snapshotReadable(this,ctx,actor,row)&&require('./marketing-creative-reviews').reviewReadable(this,ctx,actor,row)&&require('./communication-drafts').readable(this,ctx,actor,row)&&require('./communication-replies').readable(this,ctx,actor,row);}
  list(ctx,actor,entity,query={}){
    if(this.id==='sales'&&entity==='forecast_snapshots')this.resolver.assertCapability(ctx,actor,'sales:opportunities');
    this.scope(ctx,actor);const capability=require('./composition-runtime').routeCapability(`/api/${this.id}/${entity}`,this.id);if(capability)this.resolver.assertCapability(ctx,actor,capability);const limit=Math.max(1,Math.min(250,Number(query.limit)||100)),offset=Math.max(0,Number(query.offset)||0),q=String(query.q||'').toLowerCase();
    const snapshotAccess=this.id==='communication'?require('./communication-drafts').revisionAccess(this,ctx,actor):row=>this.snapshotReadable(ctx,actor,row);
    const rows=this.bucket(ctx,entity).filter(row=>!row.deleted_at&&row.status!=='ARCHIVED'&&!(this.id==='communication'&&entity==='messages'&&row.provider_currently_draft===true)&&this.visible(row,actor)&&snapshotAccess(row)&&(!q||[row.title,row.name,row.description].some(v=>String(v||'').toLowerCase().includes(q)))&&(!query.status||row.status===query.status));
    return {items:rows.slice(offset,offset+limit).map(row=>this.id==='communication'&&entity==='draft_revisions'?require('./communication-drafts').metadata(row):clone(row)),total:rows.length,limit,offset,next_offset:offset+limit<rows.length?offset+limit:null};
  }
  get(ctx,actor,entity,id){if(this.id==='sales'&&entity==='forecast_snapshots')this.resolver.assertCapability(ctx,actor,'sales:opportunities');this.scope(ctx,actor);const capability=require('./composition-runtime').routeCapability(`/api/${this.id}/${entity}`,this.id);if(capability)this.resolver.assertCapability(ctx,actor,capability);const row=this.bucket(ctx,entity).find(row=>row.id===id&&!(this.id==='communication'&&entity==='messages'&&row.provider_currently_draft===true)&&this.visible(row,actor)&&this.snapshotReadable(ctx,actor,row));if(!row)fail('record_not_found','Record niet gevonden',404);return clone(row);}
  conflicts(ctx,actor,input,exclude){
    this.scope(ctx,actor);const times=occurrences(input),people=new Set(input.participants||[]);
    const candidates=this.bucket(ctx,'events').filter(row=>row.id!==exclude&&!['CANCELLED','ARCHIVED'].includes(row.status)&&row.start_at&&row.end_at&&((row.calendar_id||'default')===(input.calendar_id||'default')||(row.participants||[]).some(p=>people.has(p))));
    let count=0;const visible=[];
    for(const row of candidates){if(occurrences(row).some(a=>times.some(b=>timestamp(a.start_at)<timestamp(b.end_at)&&timestamp(b.start_at)<timestamp(a.end_at)))){count++;if(this.visible(row,actor))visible.push(row.id);}}
    return {count,visible_ids:visible,private_details_redacted:true};
  }
  mutate(ctx,callback){return scopedMutation(this.adapter,ctx,[...this.definition.entities.map(entity=>entity===this.definition.primary?this.definition.legacy:`${this.id}:${entity}`),`${this.id}:idempotency`,`${this.id}:outbox`,'platform:audit',...(this.id==='communication'?['communication:draft_operations',require('./communication-attachments').SCOPE,require('./communication-inbox').SCOPE,require('./communication-send-reviews').SCOPE,require('./communication-submissions').SCOPE,require('./communication-submission-recovery').SCOPE,require('./communication-mailboxes').SCOPE,require('./communication-mailboxes').ITEMS,require('./communication-comments').SCOPE,require('./communication-edit-sessions').SCOPE,require('./communication-binary-attachments').SCOPE]:[])],callback);}
  save(ctx,actor,entity,input,options={}){const result=this.mutate(ctx,()=>this.saveOwned(ctx,actor,entity,input,options));try{this.flush(ctx,actor);}catch{result.event_delivery='QUEUED_RETRY';}return result;}
  saveOwned(ctx,actor,entity,input,options={}){
    this.scope(ctx,actor,'write');const capability=require('./composition-runtime').routeCapability(`/api/${this.id}/${entity}`,this.id);if(capability)this.resolver.assertCapability(ctx,actor,capability,'write');const rows=this.bucket(ctx,entity),prior=options.id?this.get(ctx,actor,entity,options.id):null;
    if(this.id==='communication'&&entity==='drafts'&&prior)require('./communication-edit-sessions').assertEdit(this,ctx,actor,prior.id,options.edit_token);
    if(prior&&options.expected_revision!==prior.revision)fail('record_revision_conflict','Record is intussen gewijzigd',409);
    if(prior?.status==='APPROVED_INTERNAL')fail('approved_record_immutable','Maak een nieuwe revisie buiten het goedgekeurde record');
    if(this.id==='communication'&&entity==='drafts'&&prior&&input.owner_id!==undefined&&input.owner_id!==prior.owner_id&&prior.owner_id!==actor.id&&!this.visible({owner_id:null},actor))fail('draft_owner_change_forbidden','Een medebewerker kan geen eigenaarschap wijzigen',403);
    const value=this.validate(entity,input,prior||{});
    if(this.id==='communication'&&entity==='drafts'&&Object.hasOwn(options,'draft_attachments'))value.attachments=require('./communication-attachments').references(this,ctx,options.id,options.draft_attachments);
    if(this.id==='sales'){require('./sales-forecast').validateForecast(entity,value);require('./sales-quotas').validateQuota(this,ctx,actor,entity,value,prior);}
    if(this.id==='procurement'){require('./procurement-sourcing').validateSourcing(this,ctx,actor,entity,value);require('./procurement-reviews').validatePolicy(this,ctx,actor,entity,value,prior);}
    if(Object.hasOwn(input,'industry_fields')){
      const {fieldContract,validateFields}=require('./industry-field-contract'),contract=fieldContract(this.resolver,ctx,actor,this.id);
      value.industry_fields=validateFields(contract,input.industry_fields,prior);
      value.industry_field_pack_id=contract.industry_id;
    }
    if(this.id==='sales'&&entity==='opportunities'&&value.pipeline_id){
      const pipeline=this.get(ctx,actor,'pipelines',value.pipeline_id),stage=(pipeline.stages||[]).find(s=>s.id===value.stage_id);
      if(!stage)fail('pipeline_stage_invalid','Kies een bestaande fase binnen de pipeline');
      if(input.probability===undefined)value.probability=stage.probability;
    }
    if(value.owner_id&&value.owner_id!==actor.id&&value.owner_id!==prior?.owner_id&&!this.visible({owner_id:null},actor))fail('owner_assignment_forbidden','Alleen een beheerder mag een andere eigenaar toewijzen',403);
    const fingerprint=crypto.createHash('sha256').update(JSON.stringify({entity,input,id:options.id||null})).digest('hex');
    const keys=this.adapter.bucket(ctx,`${this.id}:idempotency`),key=options.idempotency_key;
    if(key){const seen=keys.find(row=>row.key===key&&row.actor_id===actor.id);if(seen){if(seen.fingerprint!==fingerprint)fail('idempotency_conflict','Idempotency key heeft andere inhoud',409);return {record:this.get(ctx,actor,entity,seen.record_id),deduplicated:true};}}
    if(this.id==='calendar'&&entity==='events'&&!['CANCELLED','ARCHIVED'].includes(value.status)){const conflict=this.conflicts(ctx,actor,value,options.id);if(conflict.count)fail('calendar_conflict',`Tijdstip overlapt met ${conflict.count} bestaande afspraak(en)`,409);}
    const now=new Date().toISOString(),row={...value,...(this.id==='calendar'&&entity==='reminders'?{execution_principal_id:actor.id}:{}),id:prior?.id||crypto.randomUUID(),tenant_id:ctx.tenant_id,dealer_id:ctx.dealer_id,owner_id:value.owner_id||prior?.owner_id||actor.id,status:value.status||'DRAFT',created_at:prior?.created_at||now,updated_at:now,revision:(prior?.revision||0)+1,source_module:this.id,owned_entity:entity,schema_version:1,provenance:{source_id:'authorized_user_input',actor_id:actor.id,observed_at:now,classification:options.provenance_classification||'USER_SUPPLIED',provider_verified:false}};
    if(rows.length>=25000&&!prior)fail('domain_capacity','Recordlimiet bereikt',507);
    if(prior)rows[rows.findIndex(r=>r.id===row.id)]=row;else rows.push(row);
    if(key)keys.push({key,actor_id:actor.id,fingerprint,request_fingerprint:options.request_fingerprint||null,record_id:row.id});
    if(this.id==='communication'&&entity==='drafts')require('./communication-drafts').append(this,ctx,actor,row,prior);
    this.recordEvent(ctx,actor,entity,row,prior?'updated':'created',options);
    return {record:clone(row),deduplicated:false};
  }
  recordEvent(ctx,actor,entity,row,action,options={}){
    const event_id=crypto.randomUUID(),event={event_id,event_name:`${this.id}.record.${action}.v1`,event_version:1,tenant_id:ctx.tenant_id,dealer_id:ctx.dealer_id,actor_id:actor.id,source_module:this.id,source:`foundly_${this.id}`,occurred_at:row.updated_at,correlation_id:options.correlation_id||event_id,causation_id:options.causation_id||null,entity_type:entity,entity_id:row.id,properties:{revision:row.revision,status:row.status},permissions:row.owner_id?{user_ids:[row.owner_id]}:{},consent_context:{purpose:'business_operations',legal_basis:'contract'},privacy_classification:'INTERNAL',provenance:row.provenance,idempotency_key:`${this.id}:${row.id}:${row.revision}`};
    this.adapter.bucket(ctx,`${this.id}:outbox`).push({event,status:'PENDING',attempts:0});
    this.adapter.audit(ctx,actor,action.toUpperCase(),`${this.id}:${entity}`,row.id,{revision:row.revision,correlation_id:event.correlation_id});
  }
  flush(ctx,actor){
    const pending=this.adapter.bucket(ctx,`${this.id}:outbox`).filter(r=>r.status==='PENDING').slice(0,50);
    if(!pending.length)return;
    for(const row of pending){
      try{row.attempts++;this.adapter.publish(ctx,actor,row.event);row.status='DELIVERED';row.last_error=null;}catch(error){row.last_error=String(error.code||'event_delivery_failed').slice(0,100);}
    }
    try{this.adapter.persist();}catch(error){for(const row of pending)row.status='PENDING';throw error}
  }
  approve(ctx,actor,entity,id,input){const result=this.mutate(ctx,()=>this.approveOwned(ctx,actor,entity,id,input));try{this.flush(ctx,actor);}catch{result.event_delivery='QUEUED_RETRY';}return result;}
  approveOwned(ctx,actor,entity,id,input){
    this.scope(ctx,actor,'manage');if(!['quotes','orders'].includes(entity))fail('approval_not_applicable','Geen goedkeuringsobject');
    const capability=require('./composition-runtime').routeCapability(`/api/${this.id}/${entity}`,this.id);if(capability)this.resolver.assertCapability(ctx,actor,capability,'approve');
    if(this.id==='procurement'&&entity==='orders')fail('order_review_required','Gebruik de verplichte orderbeoordeling met aangewezen beoordelaars',409);
    const row=this.bucket(ctx,entity).find(r=>r.id===id);if(!row||!this.visible(row,actor))fail('record_not_found','Record niet gevonden',404);
    if(input.confirm!==true||input.expected_revision!==row.revision)fail('approval_confirmation_required','Bevestig exact deze recordrevisie',409);
    if(row.status==='APPROVED_INTERNAL')return {record:clone(row),deduplicated:true,external_commitment:false};
    row.status='APPROVED_INTERNAL';row.revision++;row.updated_at=new Date().toISOString();row.approved_by=actor.id;
    this.recordEvent(ctx,actor,entity,row,'approved',input);
    return {record:clone(row),external_commitment:false};
  }
  export(ctx,actor){
    this.scope(ctx,actor,'export');const snapshotAccess=this.id==='communication'?require('./communication-drafts').revisionAccess(this,ctx,actor,{exporting:true}):row=>this.snapshotReadable(ctx,actor,row);const collections=Object.fromEntries(this.definition.entities.map(entity=>[entity,clone(this.bucket(ctx,entity).filter(row=>this.visible(row,actor)&&snapshotAccess(row)))]));
    if(this.id==='communication')collections.draft_attachment_content=require('./communication-attachments').exportOwned(this,ctx,collections.drafts);
    if(this.id==='communication')collections.inbox_state=require('./communication-inbox').exportOwned(this,ctx,actor,collections.messages);
    if(this.id==='communication')collections.mail_oauth_authorizations=require('./communication-google-oauth').exportOwned(this,ctx,actor);
    if(this.id==='communication')collections.submission_receipts=require('./communication-submission-recovery').exportOwned(this,ctx,collections.drafts);
    if(this.id==='communication')collections.submissions=require('./communication-submissions').exportOwned(this,ctx,collections.drafts);
    if(this.id==='communication')Object.assign(collections,require('./communication-mailboxes').exportOwned(this,ctx,actor,collections.messages));
    if(this.id==='communication')collections.binary_attachment_content=require('./communication-binary-attachments').exportOwned(this,ctx,collections.drafts);
    if(this.id==='communication')collections.draft_edit_sessions=require('./communication-edit-sessions').exportOwned(this,ctx,collections.drafts);
    if(this.id==='communication')collections.draft_comments=require('./communication-comments').exportOwned(this,ctx,collections.drafts);
    if(this.id==='communication')collections.send_reviews=require('./communication-send-reviews').exportOwned(this,ctx,collections.drafts);
    this.adapter.audit(ctx,actor,'EXPORT',this.id,null,{entities:Object.keys(collections)});this.adapter.persist();
    return {module_id:this.id,schema_version:1,tenant_id:ctx.tenant_id,exported_at:new Date().toISOString(),collections};
  }
  summary(ctx,actor){
    this.scope(ctx,actor);const by_entity={};
    for(const entity of this.definition.entities){try{by_entity[entity]={...this.list(ctx,actor,entity,{limit:100}),available:true};}catch(error){if(error.code!=='capability_disabled')throw error;by_entity[entity]={items:[],total:null,available:false,reason:error.code};}}
    const opportunities=by_entity.opportunities?.available?this.bucket(ctx,'opportunities').filter(row=>!row.deleted_at&&row.status!=='ARCHIVED'&&this.visible(row,actor)):[],currency_groups={};
    for(const row of opportunities){if(!row.currency||!Number.isSafeInteger(row.value_cents))continue;const group=currency_groups[row.currency]||(currency_groups[row.currency]={open_cents:0,weighted_cents:0,won_cents:0});if(row.status==='WON')group.won_cents+=row.value_cents;else if(!['LOST','CANCELLED'].includes(row.status)){group.open_cents+=row.value_cents;if(Number.isFinite(row.probability))group.weighted_cents+=Math.round(row.value_cents*row.probability);}}
    return {module_id:this.id,by_entity,currency_groups,...(this.id==='communication'?{submission_summary:require('./communication-submissions').summary(this,ctx,actor)}:{}),aggregate_scope:'ALL_PERMISSION_FILTERED_RECORDS',observed_at:new Date().toISOString(),no_fake_data:true};
  }
}
module.exports={BusinessDomain,DEFINITIONS,occurrences};
