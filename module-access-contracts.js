'use strict';
// One operation/capability table for route adapters and existing domain engines.
const ENTITY_GROUPS={
  crm:{contacts:['people','contacts','consents'],companies:['companies'],leads:['leads'],relationships:['tenants','users','teams','roles','opportunities','deals','pipelines','stages','activities','tasks','appointments','notes','calls','emails','messages','products','vehicles','inventory_relations','quotes','orders','documents','campaigns','sources','attributions','workflows','automations','automation_executions','custom_fields','tags','segments','dashboard_views','webhook_subscriptions','audit_events']},
  finance:{invoices:['invoices','invoice_lines','credit_notes','source_documents','attachments','document-proposals','document_proposals'],payments:['payments','bank_accounts','bank_transactions','reconciliations','collection_actions'],reports:['reports','budgets','cash_forecasts','counterparty_balances'],ledger:['legal_entities','fiscal_periods','periods','accounts','journals','journal_entries','journal_lines','debtors','creditors','cost_centers','projects','dimensions','assets','depreciations','asset_disposals','vat_codes','tax_periods','closing_periods','audit_events','ledger']},
  analysis:{kpis:['kpis'],events:['events','realtime','historical','provider_events'],funnel:['funnel'],reports:['reports','attribution','campaigns','provider_reports','cohorts']},
  marketing:{campaigns:['campaigns','creatives','experiments'],audiences:['audiences'],attribution:['attribution','measurement']},
  procurement:{sourcing:['rfqs','bids'],suppliers:['suppliers'],opportunities:['opportunities','tasks'],approvals:['quotes','orders','documents','approval_policies','awards']},
  sales:{forecast:['forecast','forecast_snapshots','quotas'],opportunities:['opportunities','tasks'],pipeline:['pipelines','activities'],quotes:['quotes','orders']},
  calendar:{events:['events','reminders','notifications'],availability:['availability','calendars','scheduling'],conflicts:['conflicts']},
  communication:{drafts:['drafts','templates'],threads:['threads','preferences'],inbox:['messages','inbox']},
  automation:{workflows:['workflows','tasks','documents','drafts'],runs:['runs'],approvals:['approvals']}
};
const ENTITY_CAPABILITIES=Object.fromEntries(Object.entries(ENTITY_GROUPS).map(([id,groups])=>[id,Object.fromEntries(Object.entries(groups).flatMap(([cap,entities])=>entities.map(entity=>[entity,`${id}:${cap}`])))]));
const METHOD_CAPABILITIES={
  crm:{priorityLeads:['crm:leads'],customer360:['crm:relationships','crm:contacts'],inventoryCustomerMatches:['crm:relationships','crm:contacts','crm:leads'],analytics:['crm:relationships','crm:leads'],analyticsWithComparison:['crm:relationships','crm:leads'],pipelineBoard:['crm:relationships'],moveDeal:['crm:relationships'],activityVersion:['crm:relationships'],dashboard:['crm:relationships','crm:leads'],saveDashboard:['crm:relationships'],evaluateAutomations:['crm:relationships'],provisionProfile:['crm:relationships']},
  finance:{createLegalEntity:['finance:ledger'],createPeriod:['finance:ledger'],createAccount:['finance:ledger'],bootstrapDutchChart:['finance:ledger'],postJournal:['finance:ledger'],reverseJournal:['finance:ledger'],createInvoice:['finance:invoices'],approveInvoice:['finance:invoices'],postInvoice:['finance:invoices','finance:ledger'],createCreditNote:['finance:invoices','finance:ledger'],recordPayment:['finance:payments','finance:ledger'],createCollectionAction:['finance:payments'],counterpartyBalances:['finance:reports'],importBankTransaction:['finance:payments'],reconciliationProposals:['finance:payments'],confirmReconciliation:['finance:payments'],ingestDocumentProposal:['finance:invoices'],closePeriod:['finance:ledger'],createAsset:['finance:ledger'],depreciationSchedule:['finance:ledger'],disposeAsset:['finance:ledger'],createBudget:['finance:reports'],createCashForecast:['finance:reports'],reports:['finance:reports'],dashboard:['finance:reports']},
  analysis:{calculateKpi:['analysis:kpis'],realtime:['analysis:events'],historical:['analysis:events'],attribution:['analysis:reports'],commercialFunnel:['analysis:funnel'],campaignOutcome:['analysis:reports'],dashboard:['analysis:kpis','analysis:funnel','analysis:events','analysis:reports']},
  automation:{automationDefinitions:['automation:workflows'],queryAutomationRuns:['automation:runs'],previewAutomationRecovery:['automation:workflows','automation:runs'],recoverAutomation:['automation:workflows','automation:runs'],verifyAutomationRecord:['automation:workflows'],setAutomationActivation:['automation:workflows'],defineAutomation:['automation:workflows'],runAutomation:['automation:workflows'],tickAutomations:['automation:workflows'],automationStatus:['automation:runs','automation:workflows'],automationRecords:['automation:workflows'],createAutomationRecord:['automation:workflows']},
  marketing:{metaPlan:['marketing:attribution'],ga4Plan:['marketing:attribution'],enhancedConversionPlan:['marketing:attribution'],queueDelivery:['marketing:attribution']},
  procurement:{search:['procurement:sourcing'],getSearch:['procurement:sourcing'],comparables:['procurement:sourcing'],calculateEconomics:['procurement:opportunities'],analyseCandidate:['procurement:opportunities'],todayOpportunities:['procurement:opportunities'],getVehicle:['procurement:sourcing']}
};
const READ_METHODS=new Set(['automationDefinitions','queryAutomationRuns','previewAutomationRecovery','verifyAutomationRecord','schema','status','diagnostics','list','get','search','query','reports','analytics','analyticsWithComparison','activityVersion','customer360','priorityLeads','inventoryCustomerMatches','dashboard','pipelineBoard','providerStatuses','todayOpportunities','comparables','analyseCandidate','getVehicle','getSearch','calculateEconomics','counterpartyBalances','reconciliationProposals','depreciationSchedule','calculateKpi','realtime','historical','attribution','commercialFunnel','campaignOutcome','automationStatus','automationRecords','metaPlan','ga4Plan','enhancedConversionPlan','taxRules','calculateVat','validateDutchInvoice','retentionPolicy','taxCapabilities']);
function methodOperation(method){return String(method).startsWith('export')?'export':method==='approveInvoice'?'approve':READ_METHODS.has(method)?'read':'write';}
// Legacy provider routes must enforce the same capability as native workspaces.
// Reporting POSTs are reads; an internal cache is not user mutation authority.
const PROVIDER_ROUTES=[
  [/^\/api\/google\/ga4\/report$/, 'analysis:reports','read'],
  [/^\/api\/google\/ga4\/realtime$/, 'analysis:events','read'],
  [/^\/api\/google\/calendar\/events$/, 'calendar:events','read'],
  [/^\/api\/google\/ads\/(?:customers|keyword-ideas)$/, 'marketing:campaigns','read'],
  [/^\/api\/google\/(?:ads\/query|search-console\/(?:sites|query))$/, 'marketing:attribution','read'],
  [/^\/api\/meta\/(?:adaccounts|pages)$/, 'marketing:campaigns','read'],
  [/^\/api\/meta\/insights$/, 'marketing:attribution','read'],
  [/^\/api\/meta\/capi\/events$/, 'marketing:attribution','write'],
  [/^\/api\/measurement\/(?:meta|google\/ga4|google\/enhanced-conversion)\/plan$/, 'marketing:attribution','read'],
  [/^\/api\/measurement\//, 'marketing:attribution',null],
  [/^\/api\/whatsapp\/status$/, 'communication:inbox','read'],
  [/^\/api\/whatsapp\/messages$/, 'communication:threads','write'],
  [/^\/api\/tax\/invoices\/validate$/, 'finance:invoices','read'],
  [/^\/api\/tax\/(?:status|rules|vat\/calculate|retention\/policy)$/, 'finance:ledger','read'],
  [/^\/api\/tax\/retention\/archive$/, 'finance:ledger','write']
];
function providerRouteContract(pathname){const row=PROVIDER_ROUTES.find(([pattern])=>pattern.test(pathname));return row?{capability:row[1],operation:row[2]}:null;}
module.exports={ENTITY_CAPABILITIES,METHOD_CAPABILITIES,methodOperation,providerRouteContract};
