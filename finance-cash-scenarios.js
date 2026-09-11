'use strict';
const crypto=require('node:crypto');
const {timestamp}=require('./calendar-time');
const fail=(code,message,statusCode=422)=>{throw Object.assign(Error(message),{code,statusCode});};
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const keys=(v,allowed)=>object(v)&&Object.keys(v).every(k=>allowed.includes(k));
const hash=v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
const integer=v=>{if(!Number.isSafeInteger(v))fail('finance_scenario_amount_invalid','Bedragen moeten exacte gehele centen zijn');return v;};
const amount=v=>{if(v>BigInt(Number.MAX_SAFE_INTEGER)||v<BigInt(Number.MIN_SAFE_INTEGER))fail('finance_scenario_overflow','Het scenario overschrijdt de veilige bedraggrens');return Number(v);};
function calculate(source,changes={}){
 if(!keys(changes,['opening_cash_cents','horizon_days','entries']))fail('finance_scenario_invalid','Gebruik uitsluitend de expliciete scenariovelden');
 const start=timestamp(source.as_of),days=Object.hasOwn(changes,'horizon_days')?changes.horizon_days:source.horizon_days;
 if(!Number.isSafeInteger(days)||days<1||days>730)fail('finance_scenario_horizon_invalid','Kies 1 tot 730 hele dagen');
 const end=start+days*86400000,opening=integer(Object.hasOwn(changes,'opening_cash_cents')?changes.opening_cash_cents:source.opening_cash_cents);
 if(!Array.isArray(source.entries)||source.entries.length>10000)fail('finance_scenario_capacity','De volledige kasplanning moet maximaal 10000 regels bevatten');
 const adjustments=Object.hasOwn(changes,'entries')?changes.entries:[];
 if(!Array.isArray(adjustments)||adjustments.length>source.entries.length||new Set(adjustments.map(e=>e?.entry_index)).size!==adjustments.length)fail('finance_scenario_entries_invalid','Elke bronregel mag eenmaal worden aangepast');
 for(const row of adjustments)if(!keys(row,['entry_index','amount_cents','date'])||!Number.isSafeInteger(row.entry_index)||row.entry_index<0||row.entry_index>=source.entries.length||Object.keys(row).length<2)fail('finance_scenario_entries_invalid','Kies bestaande bronregels en expliciete aannames');
 const byIndex=new Map(adjustments.map(row=>[row.entry_index,row])),included=[],excluded=[];
 for(let i=0;i<source.entries.length;i++){
  const original=source.entries[i];if(!object(original))fail('finance_scenario_source_invalid','De kasplanning bevat een ongeldige bronregel');
  integer(original.amount_cents);timestamp(original.date);
  const change=byIndex.get(i)||{},date=Object.hasOwn(change,'date')?change.date:original.date,at=timestamp(date),value=integer(Object.hasOwn(change,'amount_cents')?change.amount_cents:original.amount_cents);
  const row={entry_index:i,date:new Date(at).toISOString(),amount_cents:value,assumption_changed:Boolean(byIndex.has(i))};
  (at>=start&&at<end?included:excluded).push(row);
 }
 included.sort((a,b)=>a.date.localeCompare(b.date)||a.entry_index-b.entry_index);
 let balance=BigInt(opening),net=0n,lowest=balance;const byDate=new Map();
 for(const row of included){net+=BigInt(row.amount_cents);byDate.set(row.date,(byDate.get(row.date)||0n)+BigInt(row.amount_cents));}
 const timeline=[];for(const [date,movement]of byDate){balance+=movement;amount(balance);if(balance<lowest)lowest=balance;timeline.push({date,movement_cents:amount(movement),balance_cents:amount(balance)});}
 return {available:true,as_of:new Date(start).toISOString(),window_end_exclusive:new Date(end).toISOString(),horizon_days:days,opening_cash_cents:opening,net_movement_cents:amount(net),closing_cash_cents:amount(BigInt(opening)+net),lowest_cash_cents:amount(lowest),entry_count:included.length,excluded_entry_count:excluded.length,entries:included,excluded_entries:excluded,timeline,assumptions:JSON.parse(JSON.stringify(source.assumptions||[])),provider_verified:false,basis:'RECORDED_CASH_ASSUMPTIONS',financial_action:false};
}
function source(core,ctx,id){
 const rows=core.collection(ctx,'cash_forecasts').filter(r=>r.id===id);
 if(rows.length!==1||rows[0].status!=='ACTIVE')fail('finance_scenario_source_unavailable','De actieve kasplanning is niet beschikbaar',404);
 const row=rows[0],entities=core.collection(ctx,'legal_entities').filter(e=>e.id===row.legal_entity_id);
 if(entities.length!==1||!/^[A-Z]{3}$/.test(entities[0].currency))fail('finance_scenario_entity_unavailable','Entiteit of valuta is niet beschikbaar',409);
 return {row,entity:entities[0],source_hash:hash({forecast:row,entity:entities[0]})};
}
function outcome(core,ctx,row,entity,baseline){
 const start=timestamp(baseline.as_of),end=Math.min(timestamp(core.now()),timestamp(baseline.window_end_exclusive));
 const unavailable=reason=>({available:false,reason,provider_verified:false,coverage:'RECORDED_LEDGER_ONLY'});
 if(end<=start)return unavailable('Het prognosevenster is nog niet begonnen');
 const accounts=core.collection(ctx,'accounts').filter(a=>a.legal_entity_id===entity.id&&a.system_role==='BANK');
 if(!accounts.length)return unavailable('Geen geboekte kasrekeningen beschikbaar');
 if(accounts.some(a=>a.currency!==entity.currency||a.type!=='ASSET')||new Set(accounts.map(a=>a.id)).size!==accounts.length)return unavailable('Kasrekeningmapping of valuta is niet eenduidig');
 const accountIds=new Set(accounts.map(a=>a.id)),entries=core.collection(ctx,'journal_entries').filter(e=>e.legal_entity_id===entity.id&&timestamp(e.date)>=start&&timestamp(e.date)<end),ids=new Set(entries.map(e=>e.id));
 if(ids.size!==entries.length||entries.some(e=>!['POSTED','REVERSAL','CORRECTION'].includes(e.status)||e.currency!==entity.currency))return unavailable('De geboekte bron is niet eenduidig in deze valuta');
 const lines=core.collection(ctx,'journal_lines').filter(l=>ids.has(l.journal_entry_id)),cashLines=lines.filter(l=>accountIds.has(l.account_id));
 if(entries.length>50000||lines.length>250000)return unavailable('De volledige bron overschrijdt de controlelimiet');
 const byJournal=new Map();for(const line of lines){if(!byJournal.has(line.journal_entry_id))byJournal.set(line.journal_entry_id,[]);byJournal.get(line.journal_entry_id).push(line);}
 if(new Set(lines.map(l=>l.id)).size!==lines.length)return unavailable('Dubbele boekingsregels');
 for(const entry of entries){const own=byJournal.get(entry.id)||[];let debit=0n,credit=0n;for(const l of own){if(!Number.isSafeInteger(l.debit_cents)||!Number.isSafeInteger(l.credit_cents)||l.debit_cents<0||l.credit_cents<0)return unavailable('Ongeldige boekingsbedragen');debit+=BigInt(l.debit_cents);credit+=BigInt(l.credit_cents);}if(own.length<2||debit!==credit)return unavailable('De boekingsbron is onvolledig of niet in balans');}
 if(!cashLines.length)return unavailable('Geen vastgelegde kasbewegingen in het verstreken venster; ontbrekende registratie is geen nulresultaat');
 const actual=cashLines.reduce((sum,l)=>sum+BigInt(l.debit_cents)-BigInt(l.credit_cents),0n),expected=baseline.entries.filter(e=>timestamp(e.date)<end).reduce((sum,e)=>sum+BigInt(e.amount_cents),0n);
 return {available:true,from:baseline.as_of,to_exclusive:new Date(end).toISOString(),recorded_net_cents:amount(actual),planned_net_cents:amount(expected),variance_cents:amount(actual-expected),source_entry_ids:[...new Set(cashLines.map(l=>l.journal_entry_id))],source_hash:hash({accounts,entries,lines}),coverage:'RECORDED_LEDGER_ONLY',completeness_verified:false,provider_verified:false,causality:'UNVERIFIED',recommendation:actual<expected?'De vastgelegde kasbeweging ligt onder de planning. Controleer eerst ontbrekende boekingen en betaalmomenten voordat je aannames wijzigt.':'De vastgelegde kasbeweging ligt op of boven de planning. Controleer de volledigheid van de administratie voordat je hierop handelt.'};
}
function safeOutcome(...args){try{return outcome(...args);}catch(error){return {available:false,reason:'De vastgelegde kasbron kan niet volledig en exact worden gecontroleerd',code:error.code||'finance_outcome_source_invalid',provider_verified:false,coverage:'RECORDED_LEDGER_ONLY'};}}
function scenario(core,context,actor,input){
 const {ctx}=require('./finance-period-closing').authority(core,context,actor,'finance:read');
 if(!keys(input,['forecast_id','expected_source_hash','changes'])||typeof input.forecast_id!=='string'||!input.forecast_id||input.forecast_id.length>200)fail('finance_scenario_invalid','Kies expliciet een actuele kasplanning');
 const {row,entity,source_hash}=source(core,ctx,input.forecast_id);
 if(input.changes!==undefined&&input.expected_source_hash!==source_hash||input.expected_source_hash!==undefined&&input.expected_source_hash!==source_hash)fail('finance_scenario_source_changed','De kasplanning of entiteit is gewijzigd; laad de actuele bron',409);
 const baseline=calculate(row),result=input.changes===undefined?baseline:calculate(row,input.changes);
 return {forecast_id:row.id,legal_entity_id:entity.id,currency:entity.currency,source_hash,baseline,scenario:result,delta_closing_cents:amount(BigInt(result.closing_cash_cents)-BigInt(baseline.closing_cash_cents)),source_mutated:false,financial_action:false,approval_required_for_financial_actions:true,outcome:'HYPOTHETICAL',recorded_outcome:safeOutcome(core,ctx,row,entity,baseline),recommendation:result.lowest_cash_cents<0?'De ingevoerde aannames tonen een mogelijk kastekort; controleer bedragen en betaalmomenten.':'Binnen deze ingevoerde aannames blijft het berekende kassaldo niet-negatief; dit bewijst geen toekomstige liquiditeit.'};
}
function projection(core,ctx,entityId){
 const rows=core.collection(ctx,'cash_forecasts').filter(row=>(!entityId||row.legal_entity_id===entityId)&&row.status==='ACTIVE');
 if(!rows.length)return {available:false,reason:'Geen actieve kasplanning beschikbaar'};
 if(!entityId&&new Set(rows.map(row=>row.legal_entity_id)).size>1)return {available:false,reason:'Kies één entiteit voor een kasprognose; entiteiten worden niet impliciet samengevoegd'};
 rows.sort((a,b)=>Date.parse(b.as_of)-Date.parse(a.as_of));
 if(rows.length>1&&rows[0].as_of===rows[1].as_of)return {available:false,reason:'Meerdere actuele plannen: kies expliciet een kasplanning in de scenariovergelijking'};
 try{const selected=source(core,ctx,rows[0].id);return {...calculate(selected.row),forecast_id:selected.row.id,source_hash:selected.source_hash,currency:selected.entity.currency};}
 catch(error){return {available:false,reason:'Kasplanning kan niet volledig en exact worden berekend',code:error.code||'finance_scenario_source_invalid'};}
}
function apply(core,ctx,options,value,method){const forecast=projection(core,ctx,options?.legal_entity_id);if(method==='reports')return {...value,cash_forecast:forecast};return {...value,widgets:value.widgets.map(row=>row.id==='cash_forecast'?{id:row.id,type:'FORECAST',...forecast}:row)};}
module.exports={calculate,scenario,projection,apply};
