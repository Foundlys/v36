'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {fixture}=require('../zero-evaluation/finance-page-fixture');
const {locales}=require('../foundly-i18n');
test('denied Finance refresh clears private ledger observations and mounted editor source evidence',async()=>{
 const f=fixture();await f.context.load();assert.ok(f.nodes.financePnl.textContent.includes('Literal private'));f.deny();await f.context.load();assert.equal(f.nodes.financePnl.textContent,'');assert.equal(f.nodes.financeJournal.textContent,'');assert.equal(f.nodes.financePeriodClosing.textContent,'');
});
test('missing Finance aging buckets cannot prove that no balance is overdue',async()=>{
 const f=fixture();delete f.reports.ar_aging.buckets['1_30'];await f.context.load();assert.notEqual(f.nodes.financeAgingBadge.textContent,'GEEN ACHTERSTAND');assert.equal(f.nodes.financeAgingBadge.textContent,f.i.t('common.unknown'));
});
test('Finance amounts retain exact cents and never coerce malformed values into money',async()=>{
 const f=fixture();await f.context.load();for(const locale of locales){f.i.setLocale(locale);for(const amount of [-1,0,123450,Number.MAX_SAFE_INTEGER])assert.equal(f.context.money(amount),f.i.currencyCents(amount,'EUR'));for(const amount of [null,undefined,false,true,'1234',1.2,Infinity,NaN])assert.equal(f.context.money(amount),f.i.t('common.unknown'));}
});
test('late Finance ZERO replies and exports cannot restore or download prior data after access denial',async()=>{
 for(const route of ['/api/zero/turn','/api/finance/exports']){const f=fixture();await f.context.load();f.nodes.financeZeroInput.value='Literal question';const release=f.hold(route),pending=route.endsWith('/turn')?f.context.askZero({preventDefault(){}}):f.context.exportJournal();await release.started;f.deny();await f.context.load();release();await pending;assert.equal(f.nodes.financeZeroOutput.textContent,'');assert.equal(f.downloads.length,0);assert.equal(f.nodes.exportFinance.disabled,true);assert.equal(f.nodes.financeZeroInput.disabled,true);assert.ok(!f.nodes.financeNotice.textContent.includes('RAW_PRIVATE_ERROR'));}
});
test('scoped report denial invalidates late exports while independently authorized entity observations remain',async()=>{
 const f=fixture();await f.context.load();const release=f.hold('/api/finance/exports'),pending=f.context.exportJournal();await release.started;f.errors.set('/api/finance/reports?legal_entity_id=entity_literal',403);await f.context.load();release();await pending;assert.equal(f.downloads.length,0);assert.equal(f.nodes.financeJournal.textContent,'');assert.ok(f.nodes.financeEntity.textContent.includes('Literal private entity'));assert.equal(f.nodes.exportFinance.disabled,true);assert.ok(!f.nodes.financePnlEmpty.textContent.includes('RAW_PRIVATE_ERROR'));
});
test('a dirty Finance editor keeps its confirmation state when access is unchanged and is removed when current access is revoked',async()=>{
 const f=fixture();await f.context.load();const editor=f.editors.at(-1);editor.dirty=true;const before=f.calls.length;await f.context.load();assert.equal(f.editors.at(-1),editor);assert.equal(f.calls.length,before+1);assert.equal(f.calls.at(-1).route,'/api/composition');assert.equal(editor.options.isActive(),true);f.deny();await f.context.load();assert.equal(editor.options.isActive(),false);assert.equal(f.nodes.financePeriodClosing.textContent,'');assert.equal(f.nodes.financeJournal.textContent,'');
});
test('pending Finance requests reject duplicates and authorized native exports retain exact payload and CSV bytes',async()=>{
 const f=fixture();await f.context.load();f.nodes.financeFrom.value='2026-01-01';f.nodes.financeTo.value='2026-09-24';const release=f.hold('/api/finance/exports'),pending=f.context.exportJournal();await release.started;const before=f.calls.length;await f.context.exportJournal();assert.equal(f.calls.length,before);release();await pending;assert.deepEqual(JSON.parse(f.calls.at(-1).options.body),{scope:'journal_entries',format:'CSV',filters:{legal_entity_id:'entity_literal',from:'2026-01-01T00:00:00.000Z',to:'2026-09-24T23:59:59.999Z'}});assert.equal(f.downloads[0].parts[0],'Literal CSV bytes');assert.equal(f.nodes.exportFinance.disabled,false);
});
test('Finance durability and forecast availability require boolean evidence and missing aging does not retain a stale badge',async()=>{
 const f=fixture();f.status.persistence.durable='false';f.reports.cash_forecast={available:'true',opening_cash_cents:0};await f.context.load();assert.ok(!f.nodes.financeNotice.textContent.includes('duurzame opslag bewezen'));assert.ok(!f.nodes.financeForecast.textContent.includes('Forecast beginsaldo'));delete f.reports.ar_aging;await f.context.load();assert.equal(f.nodes.financeAgingBadge.textContent,f.i.t('common.unknown'));
});
test('missing Finance journal and profit rows remain unknown while native empty arrays remain observed empty data',async()=>{
 const f=fixture();await f.context.load();delete f.reports.general_ledger.entries;delete f.reports.profit_and_loss.rows;await f.context.load();assert.equal(f.nodes.journalCount.textContent,f.i.t('common.unknown'));assert.equal(f.nodes.financeJournalEmpty.textContent,f.i.t('common.no_data'));assert.equal(f.nodes.financePnlEmpty.textContent,f.i.t('common.no_data'));f.reports.general_ledger.entries=[];f.reports.profit_and_loss.rows=[];await f.context.load();assert.equal(f.nodes.journalCount.textContent,'0 ENTRIES');assert.ok(f.nodes.financePnlEmpty.textContent.includes('Nog geen geboekte'));
});
