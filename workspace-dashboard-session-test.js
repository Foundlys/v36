'use strict';
const assert=require('node:assert/strict'),{create}=require('./workspace-dashboard-session');
const session=create(),personal='procurement:PERSONAL:owner',team='procurement:TEAM:buyers';
const a=session.beginLoad(personal),b=session.beginLoad(team);assert.equal(session.finishLoad(b),true);assert.equal(session.finishLoad(a),false,'A late personal response cannot replace the selected team');
const draft={name:'Buyers',revision:0,scope:'TEAM',team_id:'buyers',widgets:[{metric:'rfqs',x:0}],filters:{source:null}};
assert.throws(()=>session.beginSave(personal,draft),/Laad eerst/);
const save=session.beginSave(team,draft);assert.ok(save);draft.widgets[0].x=4;assert.equal(save.draft.widgets[0].x,0,'The outgoing payload is detached');assert.equal(session.beginSave(team,draft),null,'Only one save may be in flight');
const first=session.finishSave(save,{...save.draft,id:'saved-team',revision:1,created_at:'2026-09-09T00:00:00Z'},draft);assert.equal(first.applied,true);assert.equal(first.dirty,true);assert.equal(first.dashboard.revision,1);assert.equal(first.dashboard.widgets[0].x,4,'An edit made during save remains local');
const followup=session.beginSave(team,first.dashboard);assert.equal(followup.draft.revision,1);const second=session.finishSave(followup,{...first.dashboard,revision:2},first.dashboard);assert.equal(second.dirty,false);assert.equal(second.dashboard.revision,2);
const pending=session.beginSave(team,second.dashboard);const load=session.beginLoad(personal);assert.equal(session.finishLoad(load),true);assert.equal(session.finishSave(pending,{...second.dashboard,revision:3},draft).applied,false,'An old save cannot paint over a new scope');
const pendingPersonal=session.beginSave(personal,{revision:0,widgets:[]});session.failSave(pendingPersonal);assert.equal(session.saving,false);const retry=session.beginSave(personal,{revision:0,widgets:[]});assert.ok(retry);session.failSave(retry);
const refresh=session.beginLoad(personal);assert.throws(()=>session.beginSave(personal,{revision:0}),/Laad eerst/,'An unfinished/failed load cannot authorize saving another displayed draft');assert.equal(session.finishLoad(refresh),true);
console.log('PASS reordered dashboard loads, cross-scope save denial, detached in-flight payload, one pending save, retained concurrent local edits, revision handoff, stale save suppression and retry after failure');

const changedSelection=session.beginSave(personal,{revision:0,widgets:[]});assert.equal(session.finishSave(changedSelection,{revision:1},{revision:0},team).applied,false,'An uncommitted qualifier selection cannot receive another scope response');
