'use strict';

// A report is an observation of persisted records. No exchange rate or missing
// historical currency is inferred, and historical source rows are never changed.
const clone=value=>JSON.parse(JSON.stringify(value));
const currency=value=>typeof value==='string'&&/^[A-Z]{3}$/.test(value)?value:null;
const posted=row=>['POSTED','PARTIALLY_PAID','PAID','OVERDUE'].includes(row.status);
const iso=value=>{const date=new Date(value);return Number.isNaN(date.getTime())?null:date.toISOString();};
const fail=(code,message)=>{throw Object.assign(new Error(message),{statusCode:422,code});};
const safe=value=>Number.isSafeInteger(value);
const normalSign=type=>['ASSET','EXPENSE'].includes(type)?1:-1;
const bucket=days=>days<=0?'current':days<=30?'1_30':days<=60?'31_60':days<=90?'61_90':'over_90';

function reports(core,ctx,options={}){
 const entityId=options.legal_entity_id||null,start=options.from?iso(options.from):null,end=options.to?iso(options.to):null;
 if(options.from&&!start||options.to&&!end||start&&end&&start>end)fail('finance_report_range_invalid','Kies een geldige rapportperiode');
 const allEntities=core.collection(ctx,'legal_entities'),entities=allEntities.filter(row=>!entityId||row.id===entityId);
 if(entityId&&!entities.length)fail('finance_report_entity_missing','De gekozen entiteit bestaat niet');
 const selected=row=>!entityId||row.legal_entity_id===entityId,inRange=row=>(!start||row.date>=start)&&(!end||row.date<=end);
 const entries=core.collection(ctx,'journal_entries').filter(row=>selected(row)&&inRange(row)),entryMap=new Map(entries.map(row=>[row.id,row])),lines=core.collection(ctx,'journal_lines').filter(row=>entryMap.has(row.journal_entry_id)),accounts=core.collection(ctx,'accounts').filter(selected),accountMap=new Map(accounts.map(row=>[row.id,row])),entityMap=new Map(entities.map(row=>[row.id,row]));
 const invoices=core.collection(ctx,'invoices').filter(row=>selected(row)&&posted(row)),payments=core.collection(ctx,'payments').filter(selected),currencies=[...new Set([...entities,...entries,...invoices].map(row=>currency(row.currency)))].sort((a,b)=>String(a).localeCompare(String(b),'en'));
 const currencyConflicts=entries.flatMap(entry=>{
  const codes=[currency(entry.currency),currency(entityMap.get(entry.legal_entity_id)?.currency),...lines.filter(line=>line.journal_entry_id===entry.id).map(line=>currency(accountMap.get(line.account_id)?.currency))];
  return codes.some(code=>code!==codes[0]||!code)?[...new Set(codes)].map(code=>({currency:code,record_id:entry.id})):[];
 });
 const groups=currencies.map(code=>{
  const issues=[],issue=(kind,id)=>issues.push({code:kind,record_id:id||null,currency:code});
  const amount=value=>{if(value>BigInt(Number.MAX_SAFE_INTEGER)||value<BigInt(Number.MIN_SAFE_INTEGER)){issue('AMOUNT_OUT_OF_RANGE');return null;}return Number(value);};
  const sum=values=>{if(values.some(value=>!safe(value))){issue('AMOUNT_UNVERIFIED');return null;}return amount(values.reduce((total,value)=>total+BigInt(value),0n));};
  const difference=(a,b)=>safe(a)&&safe(b)?amount(BigInt(a)-BigInt(b)):null;
  const ownEntries=entries.filter(row=>currency(row.currency)===code),ids=new Set(ownEntries.map(row=>row.id)),ownLines=lines.filter(row=>ids.has(row.journal_entry_id)),ownInvoices=invoices.filter(row=>currency(row.currency)===code),ownEntities=entities.filter(row=>currency(row.currency)===code);
  if(!code)issue('CURRENCY_UNVERIFIED');
  for(const conflict of currencyConflicts.filter(row=>row.currency===code))issue('LEDGER_CURRENCY_MISMATCH',conflict.record_id);
  for(const entry of ownEntries){
   const actual=ownLines.filter(line=>line.journal_entry_id===entry.id),entity=entityMap.get(entry.legal_entity_id);
   if(!entity||currency(entity.currency)!==code)issue('LEDGER_CURRENCY_MISMATCH',entry.id);
   if(!['POSTED','REVERSAL','CORRECTION'].includes(entry.status)||actual.length<2)issue('LEDGER_ENTRY_UNVERIFIED',entry.id);
   for(const line of actual){const account=accountMap.get(line.account_id);if(!account||account.legal_entity_id!==entry.legal_entity_id||currency(account.currency)!==code)issue('LEDGER_CURRENCY_MISMATCH',entry.id);if(!safe(line.debit_cents)||!safe(line.credit_cents)||line.debit_cents<0||line.credit_cents<0||(line.debit_cents===0)===(line.credit_cents===0))issue('LEDGER_AMOUNT_UNVERIFIED',entry.id);}
   const debit=sum(actual.map(row=>row.debit_cents)),credit=sum(actual.map(row=>row.credit_cents));
   if(debit===null||credit===null||debit!==credit||entry.debit_cents!==debit||entry.credit_cents!==credit)issue('LEDGER_BALANCE_UNVERIFIED',entry.id);
  }
  const ledgerValid=issues.length===0,trial=[];
  for(const account of accounts){const own=ownLines.filter(line=>line.account_id===account.id);if(!own.length)continue;const debit=ledgerValid?sum(own.map(row=>row.debit_cents)):null,credit=ledgerValid?sum(own.map(row=>row.credit_cents)):null,balance=difference(debit,credit);trial.push({account_id:account.id,legal_entity_id:account.legal_entity_id,code:account.code,name:account.name,type:account.type,currency:code,debit_cents:debit,credit_cents:credit,balance_cents:balance===null?null:balance*normalSign(account.type),source_entry_ids:[...new Set(own.map(line=>line.journal_entry_id))]});}
  const pnl=trial.filter(row=>['REVENUE','EXPENSE'].includes(row.type)),balanceSheet=trial.filter(row=>['ASSET','LIABILITY','EQUITY'].includes(row.type)),ledgerSum=(rows,field)=>ledgerValid?sum(rows.map(row=>row[field])):null;
  const debit=ledgerSum(trial,'debit_cents'),credit=ledgerSum(trial,'credit_cents'),revenue=ledgerSum(pnl.filter(row=>row.type==='REVENUE'),'balance_cents'),expenses=ledgerSum(pnl.filter(row=>row.type==='EXPENSE'),'balance_cents'),cogs=ledgerSum(pnl.filter(row=>accountMap.get(row.account_id)?.system_role==='COGS'),'balance_cents'),cash=ledgerSum(trial.filter(row=>accountMap.get(row.account_id)?.system_role==='BANK'),'balance_cents');
  const now=core.adapter.now().getTime(),aging=kind=>{
   const candidates=ownInvoices.filter(row=>row.kind===kind),valid=Boolean(code)&&candidates.every(row=>safe(row.outstanding_cents)&&row.outstanding_cents>=0&&Number.isFinite(Date.parse(row.due_date))),items=candidates.filter(row=>row.outstanding_cents>0).map(row=>{const days=Math.floor((now-Date.parse(row.due_date))/864e5);return {invoice_id:row.id,invoice_number:row.invoice_number,currency:code,outstanding_cents:row.outstanding_cents,due_date:row.due_date,days_overdue:Math.max(0,days),bucket:bucket(days)};}),buckets=Object.fromEntries(['current','1_30','31_60','61_90','over_90'].map(name=>[name,valid?sum(items.filter(row=>row.bucket===name).map(row=>row.outstanding_cents)):null]));
   if(!valid)issue('AGING_SOURCE_UNVERIFIED');return {currency:code,available:valid,buckets,items,total_cents:valid?sum(items.map(row=>row.outstanding_cents)):null,scope:'CURRENT_RETAINED_POSTED_OPEN_INVOICES'};
  };
  const vatInvoices=ownInvoices.filter(row=>(!start||row.invoice_date>=start)&&(!end||row.invoice_date<=end)),vatValid=Boolean(code)&&vatInvoices.every(row=>safe(row.vat_cents)),vatOutput=vatValid?sum(vatInvoices.filter(row=>['SALES','CREDIT_NOTE'].includes(row.kind)).map(row=>row.vat_cents*(row.kind==='CREDIT_NOTE'?-1:1))):null,vatInput=vatValid?sum(vatInvoices.filter(row=>row.kind==='PURCHASE').map(row=>row.vat_cents)):null;
  if(!vatValid)issue('VAT_SOURCE_UNVERIFIED');
  const oneEntity=ownEntities.length===1?ownEntities[0].id:null,budget=oneEntity&&ledgerValid?core.budgetVsActualSnapshot(ctx,oneEntity,start,end,pnl):{available:false,reason_code:'SELECT_LEGAL_ENTITY',reason:'Kies één entiteit voor een budgetvergelijking'},forecast=oneEntity&&ledgerValid?core.cashForecastSnapshot(ctx,oneEntity,cash):{available:false,reason_code:'SELECT_LEGAL_ENTITY',reason:'Kies één entiteit voor een kasprognose'};
  const group={currency:code,trial_balance:{currency:code,rows:trial,total_debit_cents:debit,total_credit_cents:credit,balanced:debit!==null&&credit!==null?debit===credit:null},profit_and_loss:{currency:code,revenue_cents:revenue,expense_cents:expenses,operating_result_cents:difference(revenue,expenses),rows:pnl},balance_sheet:{currency:code,rows:balanceSheet,assets_cents:ledgerSum(balanceSheet.filter(row=>row.type==='ASSET'),'balance_cents'),liabilities_cents:ledgerSum(balanceSheet.filter(row=>row.type==='LIABILITY'),'balance_cents'),equity_cents:ledgerSum(balanceSheet.filter(row=>row.type==='EQUITY'),'balance_cents')},cash_flow:{currency:code,cash_balance_cents:cash,payments:clone(payments.filter(row=>currency(row.currency)===code))},ar_aging:aging('SALES'),ap_aging:aging('PURCHASE'),vat_summary:{currency:code,output_vat_cents:vatOutput,input_vat_cents:vatInput,position_cents:difference(vatOutput,vatInput)},margin_analysis:{currency:code,revenue_cents:revenue,cost_of_goods_cents:cogs,gross_margin_cents:difference(revenue,cogs)},general_ledger:{entries:clone(ownEntries),lines:ownLines.map(row=>({...clone(row),currency:code}))},budget_vs_actual:{...budget,currency:code},cash_forecast:{...forecast,currency:code},issues};
  group.available=Boolean(code)&&issues.length===0;return group;
 });
 const one=groups.length===1?groups[0]:null,joined=name=>groups.flatMap(group=>group[name].rows),allIssues=groups.flatMap(group=>group.issues),unknownAging=name=>({currency:null,available:false,buckets:{current:null,'1_30':null,'31_60':null,'61_90':null,over_90:null},items:groups.flatMap(group=>group[name].items),total_cents:null});
 const aggregate=one||{currency:null,available:false,trial_balance:{rows:joined('trial_balance'),total_debit_cents:null,total_credit_cents:null,balanced:groups.length&&groups.every(group=>group.trial_balance.balanced===true)?true:null,verification_scope:'SEPARATE_CURRENCY_GROUPS'},profit_and_loss:{revenue_cents:null,expense_cents:null,operating_result_cents:null,rows:joined('profit_and_loss')},balance_sheet:{rows:joined('balance_sheet'),assets_cents:null,liabilities_cents:null,equity_cents:null},cash_flow:{cash_balance_cents:null,payments:clone(payments)},ar_aging:unknownAging('ar_aging'),ap_aging:unknownAging('ap_aging'),vat_summary:{output_vat_cents:null,input_vat_cents:null,position_cents:null},margin_analysis:{revenue_cents:null,cost_of_goods_cents:null,gross_margin_cents:null},general_ledger:{entries:clone(entries),lines:lines.map(row=>({...clone(row),currency:currency(entryMap.get(row.journal_entry_id)?.currency)}))},budget_vs_actual:{available:false,reason_code:'SELECT_LEGAL_ENTITY',reason:'Kies één entiteit voor een budgetvergelijking'},cash_forecast:{available:false,reason_code:'SELECT_LEGAL_ENTITY',reason:'Kies één entiteit voor een kasprognose'}};
 return {...aggregate,ok:true,observed_at:core.now(),range:{from:start,to:end},currency_groups:groups,issues:allIssues,fx_conversion_performed:false,scalar_unavailable_reason:!one?(groups.length?'MULTIPLE_CURRENCIES':'CURRENCY_UNVERIFIED'):one.available?null:'SOURCE_UNVERIFIED',coverage:{scope:'CURRENT_AUTHORIZED_RETAINED_FINANCE_RECORDS',ledger_entries:entries.length,currency_groups:groups.length,external_ledger_completeness:'NOT_ESTABLISHED'},source:'posted_immutable_journal_entries',no_fake_data:true};
}

function widgets(report){
 const {currency:code}=report,observed=(id,value)=>({id,type:'KPI',value_cents:value,currency:code,available:Boolean(currency(code))&&safe(value)}),overdueValues=['1_30','31_60','61_90','over_90'].map(name=>report.ar_aging.buckets[name]),overdue=overdueValues.every(safe)?overdueValues.reduce((a,b)=>a+BigInt(b),0n):null;
 return [observed('revenue',report.profit_and_loss.revenue_cents),observed('gross_margin',report.margin_analysis.gross_margin_cents),observed('operating_result',report.profit_and_loss.operating_result_cents),observed('cash',report.cash_flow.cash_balance_cents),observed('receivables',report.ar_aging.total_cents),observed('payables',report.ap_aging.total_cents),observed('overdue',overdue!==null&&overdue<=BigInt(Number.MAX_SAFE_INTEGER)?Number(overdue):null),{id:'cash_forecast',type:'FORECAST',...report.cash_forecast},observed('vat_position',report.vat_summary.position_cents),{id:'top_costs',type:'TABLE',rows:report.profit_and_loss.rows.filter(row=>row.type==='EXPENSE').sort((a,b)=>(b.balance_cents??0)-(a.balance_cents??0)).slice(0,10)},{id:'profitability',type:'BAR',currency:code,gross_margin_cents:report.margin_analysis.gross_margin_cents},{id:'budget_vs_actual',type:'BAR',...report.budget_vs_actual}];
}
function dashboard(report){return {id:'foundly-finance-command-center',name:'Foundly Finance Command Center',preset:'FINANCE',currency:report.currency,widgets:widgets(report),currency_groups:report.currency_groups.map(group=>({currency:group.currency,widgets:widgets(group),available:group.available,issues:group.issues})),issues:report.issues,fx_conversion_performed:false,observed_at:report.observed_at,source:report.source,no_fake_data:true};}
function counterparties(core,ctx,entityId){
 const groups=new Map();
 for(const row of core.collection(ctx,'invoices').filter(row=>(!entityId||row.legal_entity_id===entityId)&&posted(row)&&row.outstanding_cents>0)){
  const direction=row.kind==='PURCHASE'?'PAYABLE':'RECEIVABLE',name=String(row.kind==='PURCHASE'?row.supplier_name:row.customer_name),code=currency(row.currency),key=JSON.stringify([direction,name,code]),group=groups.get(key)||{counterparty:name,direction,currency:code,amount:0n,valid:Boolean(code),invoice_ids:[]};
  group.valid=group.valid&&safe(row.outstanding_cents);if(safe(row.outstanding_cents))group.amount+=BigInt(row.outstanding_cents);group.invoice_ids.push(row.id);groups.set(key,group);
 }
 const items=[...groups.values()].map(({amount,valid,...group})=>({...group,outstanding_cents:valid&&amount<=BigInt(Number.MAX_SAFE_INTEGER)?Number(amount):null,available:valid&&amount<=BigInt(Number.MAX_SAFE_INTEGER),invoice_count:group.invoice_ids.length}));
 items.sort((a,b)=>String(a.currency).localeCompare(String(b.currency),'en')||(b.outstanding_cents??0)-(a.outstanding_cents??0));return {items,total:items.length,observed_at:core.now(),source:'posted_open_invoices',grouping:['direction','recorded_counterparty_name','currency'],fx_conversion_performed:false,tenant_filtered:true,no_fake_data:true};
}
module.exports={reports,dashboard,counterparties};
