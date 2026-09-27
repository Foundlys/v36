'use strict';

// Full credits bind an actual posted sales invoice. Copy billing facts only;
// posting, payment, provider/order authority and audit fields belong to the
// original document and must never become facts about a new draft.
const fields=['legal_entity_id','currency','supplier_name','supplier_address','supplier_vat_id','supplier_kvk_number','customer_name','customer_address','customer_vat_id'];
const fail=(code,message,statusCode=422)=>{throw Object.assign(Error(message),{code,statusCode});};
const clone=v=>JSON.parse(JSON.stringify(v));
const validDate=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&(/^\d{4}-\d\d-\d\d$/.test(value)?new Date(value).toISOString().slice(0,10)===value:new Date(value).toISOString()===value);
function inspect(core,ctx,invoiceId,input={},explicitDates=false,existingCreditId=null){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['invoice_number','series','invoice_date','supply_date','due_date','reason'].includes(k)))fail('finance_credit_input_invalid','Kies alleen factuurnummer, datums en reden voor de volledige creditnota');
 if(typeof input.invoice_number!=='string'||!input.invoice_number.trim()||input.invoice_number.length>60)fail('finance_credit_input_invalid','Kies een exact creditnotanummer');
 if(input.reason!==undefined&&(typeof input.reason!=='string'||!input.reason.trim()||input.reason.length>500))fail('finance_credit_input_invalid','Gebruik een begrensde creditreden');
 if(input.series!==undefined&&(typeof input.series!=='string'||!input.series.trim()||input.series.length>20))fail('finance_credit_input_invalid','Kies een exacte creditreeks');
 for(const field of ['invoice_date','supply_date','due_date'])if((explicitDates||input[field]!==undefined)&&!validDate(input[field]))fail('finance_credit_date_invalid','Kies expliciete geldige creditdatums');
 const matches=core.collection(ctx,'invoices').filter(r=>r.id===invoiceId&&!r.archived_at),original=matches[0];
 if(matches.length!==1||original.kind!=='SALES')fail('finance_credit_source_missing','Kies de oorspronkelijke native verkoopfactuur',404);
 const entity=core.collection(ctx,'legal_entities').find(e=>e.id===original.legal_entity_id&&!e.archived_at),lines=core.collection(ctx,'invoice_lines').filter(l=>l.invoice_id===original.id),credits=core.collection(ctx,'invoices').filter(r=>r.kind==='CREDIT_NOTE'&&r.credits_invoice_id===original.id&&r.id!==existingCreditId),journal=core.collection(ctx,'journal_entries').find(j=>j.id===original.journal_entry_id),reversals=core.collection(ctx,'journal_entries').filter(j=>j.reverses_entry_id===original.journal_entry_id);
 if(credits.length>1000||lines.length>500)fail('finance_credit_capacity','De broncontrole overschrijdt de creditlimiet',413);
 const blockers=[];
 if(!['POSTED','PARTIALLY_PAID','PAID','OVERDUE'].includes(original.status)||!journal||journal.legal_entity_id!==original.legal_entity_id||journal.source_id!==original.id||journal.source!=='invoice'||reversals.length)blockers.push('SOURCE_NOT_POSTED');
 if(!entity||entity.currency!==original.currency||journal&&journal.currency!==original.currency)blockers.push('SOURCE_CURRENCY_INVALID');
 if(!lines.length||['net_cents','vat_cents','gross_cents'].some(field=>!Number.isSafeInteger(original[field])||original[field]<0||lines.some(l=>!Number.isSafeInteger(l[field])||l[field]<0)||lines.reduce((n,l)=>n+BigInt(l[field]||0),0n)!==BigInt(original[field]||0))||!(original.gross_cents>0))blockers.push('SOURCE_AMOUNTS_INVALID');
 if(journal&&(journal.debit_cents!==original.gross_cents||journal.credit_cents!==original.gross_cents))blockers.push('SOURCE_AMOUNTS_INVALID');
 if(credits.some(c=>c.currency!==original.currency||!Number.isSafeInteger(c.gross_cents)||c.gross_cents<=0))blockers.push('PRIOR_CREDIT_INVALID');
 const credited=blockers.includes('PRIOR_CREDIT_INVALID')?null:credits.reduce((n,c)=>n+BigInt(c.gross_cents),0n),remaining=credited===null||!Number.isSafeInteger(original.gross_cents)?null:BigInt(original.gross_cents)-credited;
 if(remaining===null||remaining<BigInt(original.gross_cents||0))blockers.push('FULL_CREDIT_EXCEEDS_REMAINING');
 const invoice={...Object.fromEntries(fields.filter(k=>Object.hasOwn(original,k)).map(k=>[k,clone(original[k])])),kind:'CREDIT_NOTE',series:input.series||'CREDIT',invoice_number:input.invoice_number,invoice_date:input.invoice_date||core.now(),supply_date:input.supply_date||original.supply_date,due_date:input.due_date||core.now(),credits_invoice_id:original.id,credit_reason:input.reason||'Full credit of '+original.invoice_number,
  lines:lines.map(line=>({description:'Credit '+original.invoice_number+': '+line.description,quantity:line.quantity,unit_price_cents:line.unit_price_cents,vat_rate:line.vat_rate,vat_code:line.vat_code,...(line.product_id?{product_id:line.product_id}:{}),...(line.project_id?{project_id:line.project_id}:{}),...(line.cost_center_id?{cost_center_id:line.cost_center_id}:{})}))};
 const series=String(invoice.series).trim(),number=String(invoice.invoice_number).trim(),duplicates=core.collection(ctx,'invoices').filter(r=>r.id!==existingCreditId&&r.legal_entity_id===original.legal_entity_id&&r.series===series&&r.invoice_number===number).map(r=>r.id);
 if(duplicates.length)blockers.push('INVOICE_NUMBER_EXISTS');
 return {basis:{entity:entity||null,original,lines,credits,journal:journal||null,reversals,duplicates},effective_input:invoice,blockers,summary:{original_invoice_id:original.id,invoice_number:number,amount_cents:original.gross_cents,currency:original.currency,next_status:'DRAFT',credit_scope:'FULL_ORIGINAL_INVOICE',settlement_performed:false,refund_performed:false}};
}
function ready(current){
 const reason=current.blockers[0];if(!reason)return;
 const codes={SOURCE_NOT_POSTED:'finance_credit_source_not_posted',SOURCE_CURRENCY_INVALID:'finance_credit_currency_invalid',SOURCE_AMOUNTS_INVALID:'finance_credit_source_invalid',PRIOR_CREDIT_INVALID:'finance_credit_source_invalid',FULL_CREDIT_EXCEEDS_REMAINING:'finance_credit_amount_exceeded',INVOICE_NUMBER_EXISTS:'finance_invoice_number_duplicate'};
 fail(codes[reason]||'finance_credit_source_invalid','De volledige creditnota vereist een geldige geboekte bron en voldoende resterend creditbedrag',409);
}
function draft(core,ctx,invoiceId,input){const current=inspect(core,ctx,invoiceId,input);ready(current);return current.effective_input;}
function assertDraft(core,ctx,data,existingCreditId=null){
 const original=core.collection(ctx,'invoices').find(r=>r.id===data.credits_invoice_id&&!r.archived_at);
 if(!original)fail('finance_credit_source_missing','Een creditnota vereist de oorspronkelijke native verkoopfactuur',404);
 const current=inspect(core,ctx,original.id,{invoice_number:data.invoice_number,series:data.series||data.kind,invoice_date:data.invoice_date,supply_date:data.supply_date,due_date:data.due_date},false,existingCreditId);ready(current);
 if(fields.some(k=>data[k]!==original[k]))fail('finance_credit_source_mismatch','Creditbedragen, valuta en factuurpartijen komen uitsluitend uit de oorspronkelijke bron');
 const lines=current.basis.lines;
 if(data.lines.length!==lines.length||['net_cents','vat_cents','gross_cents'].some(k=>data[k]!==original[k])||data.lines.some((l,i)=>['quantity','unit_price_cents','vat_rate','vat_code','product_id','project_id','cost_center_id'].some(k=>l[k]!==lines[i][k])))fail('finance_credit_amount_mismatch','Deze creditroute ondersteunt uitsluitend het exacte volledige bronbedrag en dezelfde bronregels');
 return current;
}
module.exports={inspect,draft,assertDraft};
