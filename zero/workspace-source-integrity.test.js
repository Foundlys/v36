'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{fixture}=require('../zero-evaluation/workspace-page-fixture');
test('workspace money never invents currency, rounds away cents or turns invalid observations into zero',()=>{
 const f=fixture();assert.ok(!String(f.ui.formatMetric({available:true,value:123,unit:'CURRENCY_CENTS'})).includes('€'),'A missing currency must not become EUR');assert.equal(String(f.ui.formatMetric({available:true,value:-123,unit:'CURRENCY_CENTS',currency:'USD'})),f.i.currencyCents(-123,'USD'));
 for(const value of [null,undefined,'',false,NaN,Infinity])assert.equal(String(f.ui.formatMetric({available:true,value,unit:'COUNT'})),f.i.t('common.unknown'));
});
test('workspace record amounts retain explicit currency and null instead of fabricated euro values',async()=>{
 const f=fixture();f.snapshot.rows=[{name:'Literal null',amount_cents:null,currency:'USD'},{name:'Literal missing currency',amount_cents:123},{name:'Literal exact USD',amount_cents:-123,currency:'USD'}];await f.ui.loadWorkspaceData();const rows=f.nodes.recordRows.children;assert.ok(!rows[0].textContent.includes('€'));assert.ok(!rows[1].textContent.includes('€'));assert.ok(rows[2].textContent.includes(f.i.currencyCents(-123,'USD')));
});
test('workspace sources distinguish absent count and provenance from observed zero and false',async()=>{
 const f=fixture();await f.ui.loadWorkspaceData();f.ui.state.snapshot.sources=[{source_id:'unknown_source',display_name:'Unknown source',categories:[]}];f.ui.renderSources();assert.ok(!f.nodes.sourceMatrix.textContent.includes('0 records'));assert.ok(!f.nodes.sourceMatrix.textContent.includes('provenance actief'));
});
test('explicitly empty workspace source coverage never falls back to unrelated registry sources',async()=>{
 const f=fixture();await f.ui.loadWorkspaceData();await f.ui.reloadRegistries();assert.ok(!f.nodes.sourceMatrix.textContent.includes('Literal private source'));
});
test('a denied workspace refresh retires prior private observations and late successful loads',async()=>{
 const f=fixture();await f.ui.loadWorkspaceData();const release=f.hold('/api/workspaces/data/snapshot'),old=f.ui.loadWorkspaceData();await release.started;f.deny();await assert.rejects(f.ui.loadWorkspaceData());release();await old.catch(()=>{});assert.equal(f.ui.state.snapshot,null);assert.equal(f.ui.state.dashboard,null);for(const id of ['recordRows','dashboardGrid','metricDialogContent','contextContent'])assert.ok(!f.nodes[id].textContent.includes('Literal private'));assert.ok(!f.nodes.workspaceNotice.textContent.includes('RAW_PRIVATE'));
});
test('a denied registry refresh clears prior private sources/connectors and suppresses late reads',async()=>{
 const f=fixture();await f.ui.loadWorkspaceData();await f.ui.reloadRegistries();const release=f.hold('/api/source-registry'),old=f.ui.reloadRegistries();await release.started;f.deny();await assert.rejects(f.ui.reloadRegistries());release();await old.catch(()=>{});assert.equal(f.ui.state.sources.length,0);assert.equal(f.ui.state.connectors.length,0);for(const id of ['sourceRegistryGrid','connectorGrid','globalSearchResults'])assert.ok(!f.nodes[id].textContent.includes('Literal private'));
});
test('a denied refresh prevents a late ZERO answer restoring private data or clearing the input draft',async()=>{
 const f=fixture();await f.ui.loadWorkspaceData();f.nodes.zeroInput.value='Original drafted question';const release=f.hold('/api/zero/turn'),pending=f.ui.askZero({preventDefault(){}});await release.started;f.deny();await assert.rejects(f.ui.loadWorkspaceData());release();await pending;assert.ok(!f.nodes.zeroOutput.textContent.includes('Literal private ZERO answer'));assert.equal(f.nodes.zeroInput.value,'Original drafted question');assert.equal(f.ui.state.conversationId,null);
});
test('workspace export rechecks source access before releasing cached private rows',async()=>{
 const f=fixture();await f.ui.loadWorkspaceData();f.deny();await f.ui.exportRows();assert.equal(f.downloads.length,0);assert.ok(!f.nodes.toastRegion.textContent.includes('RAW_PRIVATE'));
});
test('detached dashboard controls cannot mutate a newer rendered layout',async()=>{
 const f=fixture();await f.ui.loadWorkspaceData();f.ui.toggleEditing(true);const old=f.nodes.dashboardGrid.children[0],remove=old.all().find(n=>n.tag==='button'&&n.textContent==='×');f.ui.renderDashboard();await remove.fire('click');assert.equal(f.ui.state.dashboard.widgets.length,2);
});
test('a failed current workspace observation cannot leave runtime-live status or previous private records',async()=>{
 const f=fixture();await f.ui.loadWorkspaceData();f.fail();await assert.rejects(f.ui.loadWorkspaceData());assert.equal(f.ui.state.snapshot,null);assert.ok(!f.nodes.workspaceRuntime.textContent.includes('LIVE'));assert.equal(f.nodes.recordRows.children.length,0);
});
