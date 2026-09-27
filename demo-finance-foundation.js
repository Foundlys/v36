'use strict';
const L=require('./demo-universe-law');
// Native ledger configuration for the fictional business. No invoices, sales,
// payments, real registration or provider connection are implied by setup.
function append(body){
 const label=text=>L.LABEL+' '+text,ref=id=>({$ref:id});
 const node=(id,entity,input)=>body.nodes.push({id,kind:entity==='legal_entities'?'finance_entity':entity==='fiscal_periods'?'finance_period':'finance_account',contract:'finance.create',module:'finance',entity,occurred_at:body.history_start,location_id:body.locations[0].id,persona_id:body.personas[0].id,input,depends_on:L.references(input),provenance:L.provenance(body.scenario_id,id)});
 node('finance-entity','legal_entities',{name:body.company.name,legal_form:'BV',address:label('Fictional Netherlands billing address'),vat_id:'DEMO-NOT-REGISTERED',kvk_number:'DEMO-NOT-REGISTERED',currency:'EUR'});
 const first=new Date(body.history_start).getUTCFullYear(),last=new Date(body.as_of).getUTCFullYear();
 for(let year=first;year<=last;year++)node('finance-period-'+year,'fiscal_periods',{legal_entity_id:ref('finance-entity'),name:label('Scenario fiscal year '+year),start_date:year+'-01-01T00:00:00.000Z',end_date:year+'-12-31T23:59:59.999Z'});
 const specs=[['1000','Bank','ASSET','BANK'],['1300','Debtors','ASSET','AR'],['1520','Recoverable scenario VAT','ASSET','VAT_RECEIVABLE'],['1600','Creditors','LIABILITY','AP'],['1521','Payable scenario VAT','LIABILITY','VAT_PAYABLE'],['8000','Revenue','REVENUE','REVENUE'],['7000','Cost of sales','EXPENSE','COGS'],['4000','Operating costs','EXPENSE','EXPENSE'],['3000','Equity','EQUITY','EQUITY']];
 for(const [code,name,type,system_role]of specs)node('finance-account-'+code,'accounts',{legal_entity_id:ref('finance-entity'),code,name:label(name),type,system_role,currency:'EUR'});
 body.scenarios.push({id:'native-finance-foundation',kind:'NORMAL',description:label('Inspect the native entity, fiscal periods and chart. Configuration alone proves no revenue, cash or external registration.'),source_ids:body.nodes.filter(n=>n.contract==='finance.create').map(n=>n.id),expectations:{currency:'EUR',setup_invoice_count:0,setup_payment_count:0,external_payment_performed:false,financial_history_complete:false}});
 return body;
}
module.exports={append};
