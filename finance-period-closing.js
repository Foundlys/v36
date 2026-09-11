'use strict';
const crypto=require('node:crypto');
const {ROLE_PERMISSIONS}=require('./finance-core');
const {timestamp}=require('./calendar-time');
const {scopedMutation}=require('./scoped-mutation');
const {queueOwnedEvent}=require('./module-event-outbox');
const fail=(code,message,statusCode=409)=>{throw Object.assign(Error(message),{code,statusCode});};
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const clone=value=>JSON.parse(JSON.stringify(value));
const duplicates=rows=>{const seen=new Set();return rows.filter(r=>seen.has(r.id)||!seen.add(r.id)).map(r=>r.id);};
const OUTBOX='finance:close_event_outbox';
function authority(core,context,actor,permission){
 const {ctx,principal}=core.scope(context,actor),permissions=new Set([...(principal.permissions||[]),...(principal.roles||[]).flatMap(r=>ROLE_PERMISSIONS[r]||[])]);
 if(!permissions.has('*')&&!permissions.has(permission))fail('finance_permission_denied','Onvoldoende Finance-rechten',403);
 return {ctx,principal};
}
function selected(core,ctx,id){const rows=core.collection(ctx,'fiscal_periods').filter(p=>p.id===id);if(rows.length!==1)fail('finance_period_missing','Kies één bestaande fiscale periode',404);return rows[0];}
function preview(core,context,actor,id){
 const {ctx}=authority(core,context,actor,'finance:read'),period=selected(core,ctx,id),start=timestamp(period.start_date),end=timestamp(period.end_date),blockers=[];
 const issue=(code,ids)=>{if(ids.length)blockers.push({code,record_ids:ids});};
 if(start>end)issue('INVALID_PERIOD',[id]);
 if(period.status!=='OPEN')issue('PERIOD_NOT_OPEN',[id]);
 const entities=core.collection(ctx,'legal_entities').filter(e=>e.id===period.legal_entity_id),entity=entities[0];
 if(entities.length!==1||!/^[A-Z]{3}$/.test(entity?.currency||''))fail('finance_period_entity_invalid','Entiteit of valuta ontbreekt');
 const periods=core.collection(ctx,'fiscal_periods').filter(p=>p.legal_entity_id===entity.id);
 issue('OVERLAPPING_PERIODS',periods.filter(p=>p.id!==id&&timestamp(p.start_date)<=end&&timestamp(p.end_date)>=start).map(p=>p.id));
 const inRange=value=>{const at=timestamp(value);return at>=start&&at<=end;};
 const journals=core.collection(ctx,'journal_entries').filter(j=>j.legal_entity_id===entity.id&&(j.fiscal_period_id===id||inRange(j.date))),journalIds=new Set(journals.map(j=>j.id));
 const lines=core.collection(ctx,'journal_lines').filter(l=>journalIds.has(l.journal_entry_id)),accounts=core.collection(ctx,'accounts').filter(a=>a.legal_entity_id===entity.id),accountMap=new Map(accounts.map(a=>[a.id,a]));
 const invoices=core.collection(ctx,'invoices').filter(i=>i.legal_entity_id===entity.id&&inRange(i.invoice_date));
 const bank=core.collection(ctx,'bank_transactions').filter(t=>t.legal_entity_id===entity.id&&inRange(t.date));
 if(journals.length>50000||lines.length>250000||invoices.length>50000||bank.length>50000)fail('finance_close_capacity','De volledige periode overschrijdt de controlelimiet',413);
 issue('DUPLICATE_JOURNALS',duplicates(journals));
 issue('DUPLICATE_LINES',duplicates(lines));
 issue('DUPLICATE_ACCOUNTS',duplicates(accounts));
 const byJournal=new Map();for(const line of lines){if(!byJournal.has(line.journal_entry_id))byJournal.set(line.journal_entry_id,[]);byJournal.get(line.journal_entry_id).push(line);}
 let debit=0n,credit=0n;
 for(const journal of journals){
  const own=byJournal.get(journal.id)||[];let d=0n,c=0n;
  if(journal.fiscal_period_id!==id||!inRange(journal.date)||!['POSTED','REVERSAL','CORRECTION'].includes(journal.status)||journal.currency!==entity.currency)issue('INVALID_JOURNAL',[journal.id]);
  for(const line of own){const account=accountMap.get(line.account_id);if(!account||account.currency!==entity.currency)issue('INVALID_ACCOUNT',[line.id]);
   if(!Number.isSafeInteger(line.debit_cents)||!Number.isSafeInteger(line.credit_cents)||line.debit_cents<0||line.credit_cents<0||(line.debit_cents===0)===(line.credit_cents===0)){issue('INVALID_LINE',[line.id]);continue;}
   d+=BigInt(line.debit_cents);c+=BigInt(line.credit_cents);
  }
  if(own.length<2||d!==c||d!==BigInt(Number.isSafeInteger(journal.debit_cents)?journal.debit_cents:-1)||c!==BigInt(Number.isSafeInteger(journal.credit_cents)?journal.credit_cents:-1))issue('UNBALANCED_JOURNAL',[journal.id]);
  debit+=d;credit+=c;
 }
 issue('DRAFT_INVOICES',invoices.filter(i=>i.status==='DRAFT').map(i=>i.id));
 issue('UNRECONCILED_BANK_TRANSACTIONS',bank.filter(t=>t.status!=='RECONCILED').map(t=>t.id));
 const basis={period,entity,periods,journals,lines,accounts,invoices,bank};
 return {period:clone(period),currency:entity.currency,source_hash:hash(basis),ready:blockers.length===0,blockers,counts:{journals:journals.length,lines:lines.length,invoices:invoices.length,bank_transactions:bank.length},totals:{debit_cents_exact:String(debit),credit_cents_exact:String(credit)},scope:'RECORDED_INTERNAL_PERIOD',jurisdiction_acceptance:'UNVERIFIED',provider_completeness:'UNVERIFIED',financial_posting_performed:false};
}
function flush(core,ctx){
 if(typeof core.adapter.publish!=='function')return;
 for(const row of core.adapter.bucket(ctx,OUTBOX).filter(r=>r.status==='PENDING').slice(0,50)){
  try{const receipt=core.adapter.publish(ctx,row.event);if(!receipt)continue;scopedMutation(core.adapter,ctx,[OUTBOX],()=>{row.status='DELIVERED';row.delivered_at=core.now();});}catch(_){/* Durable pending event is retried by the next authorized close/read. */}
 }
}
function close(core,context,actor,id,reason,input){
 const {ctx,principal}=authority(core,context,actor,'finance:close');
 if(!input||Object.keys(input).some(k=>!['expected_source_hash','confirm','request_id','reason'].includes(k))||input.confirm!==true||typeof reason!=='string'||!reason.trim()||reason.length>500||!/^[-A-Za-z0-9_.:]{8,200}$/.test(input.request_id||'')||!/^[a-f0-9]{64}$/.test(input.expected_source_hash||''))fail('finance_close_confirmation_required','Bevestig de actuele periodecontrole met reden en verzoeknummer',422);
 const period=selected(core,ctx,id),signature=hash({actor_id:principal.id,id,reason,input}),closings=core.collection(ctx,'closing_periods'),prior=closings.find(r=>r.actor_id===principal.id&&r.request_id===input.request_id);
 if(prior){if(prior.request_hash!==signature||prior.fiscal_period_id!==id)fail('finance_close_request_conflict','Het verzoeknummer hoort bij andere invoer');if(period.status!=='CLOSED'||prior.id!==period.reviewed_closing_id)fail('finance_close_result_changed','Het bewaarde afsluitresultaat is gewijzigd');flush(core,ctx);return {period:clone(period),closing:clone(prior),deduplicated:true,financial_posting_performed:false};}
 const review=preview(core,ctx,actor,id);if(review.source_hash!==input.expected_source_hash)fail('finance_close_source_changed','De periodebron is gewijzigd; beoordeel de actuele controle');if(!review.ready)fail('finance_close_blocked','Los de expliciete periodecontroles eerst op');
 const result=scopedMutation(core.adapter,ctx,['finance:fiscal_periods','finance:closing_periods','finance:audit_events',OUTBOX],()=>{
  const shadow=Object.create(core);shadow.adapter={...core.adapter,persist(){},emit(){}};
  const value=core.closePeriod.call(shadow,ctx,actor,id,reason),closing=closings.find(r=>r.id===value.closing.id);
  Object.assign(closing,{actor_id:principal.id,request_id:input.request_id,request_hash:signature,source_hash:review.source_hash,review:clone(review)});period.reviewed_closing_id=closing.id;
  queueOwnedEvent({bucket:()=>core.adapter.bucket(ctx,OUTBOX),now:()=>core.now()},ctx,principal,'finance','closing_periods',closing,'closed');
  return {period:clone(period),closing:clone(closing),deduplicated:false,financial_posting_performed:false};
 });flush(core,ctx);return result;
}
module.exports={preview,close,flush,authority,OUTBOX};
