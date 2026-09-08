'use strict';
const assert = require('node:assert/strict');
const {BusinessDomain} = require('./business-domains');
const {CapabilityResolver} = require('./capability-resolver');
const {forecast, snapshotForecast} = require('./sales-forecast');
let state = new Map(), disk, broken = false;
const events = [], ctx = {tenant_id:'forecast-fixture', dealer_id:'default'};
const admin = {id:'admin', roles:['ADMIN','SUPER_ADMIN']};
const seller = {id:'seller', roles:['SALES']}, stranger = {id:'other-seller', roles:['SALES']};
const adapter = {
  bucket(c, name) {const key=JSON.stringify([c.tenant_id,c.dealer_id,name]);if(!state.has(key))state.set(key,[]);return state.get(key);},
  persist() {if(broken)throw new Error('fixture disk unavailable');disk=JSON.stringify([...state]);},
  audit() {}, publish(c,a,event) {events.push(event);}
};
const resolver = new CapabilityResolver(adapter);
resolver.configure(ctx,admin,{entitlements:['sales'],expected_revision:0});
let core = new BusinessDomain('sales',adapter,resolver);
const period = {from:'2026-09-01',to:'2026-09-30'};
const save = (input={},actor=seller) => core.save(ctx,actor,'opportunities',{
  title:'Explicit test fixture',status:'OPEN',currency:'EUR',value_cents:10000,expected_close_date:'2026-09-20',...input
}).record;
const known = save({probability:0.5,forecast_category:'COMMIT'});
save({value_cents:20000,forecast_category:'__proto__'});
save({value_cents:3000,currency:'USD',probability:0,forecast_category:'constructor'});
save({status:'WON',value_cents:4000,closed_date:'2026-09-30'});
save({expected_close_date:''});
save({status:'WON'});
save({currency:''});
save({status:'LOST',value_cents:999999});
save({expected_close_date:'2026-10-01',value_cents:999999});
const privateRecord=save({value_cents:999999},stranger);
let result = forecast(core,ctx,seller,period);
const eur=result.groups.find(row=>row.currency==='EUR'),usd=result.groups.find(row=>row.currency==='USD');
assert.equal(eur.open_cents,30000);assert.equal(eur.weighted_cents,5000);assert.equal(eur.won_cents,4000);
assert.equal(eur.probability_coverage,0.5);assert.equal(eur.weighted_scope,'PARTIAL_KNOWN_PROBABILITIES');
assert.equal(eur.categories.__proto__.value_cents,20000);assert.equal(usd.categories.constructor.count,1);
assert.equal(usd.weighted_cents,0,'Known zero probability must remain a real zero');
assert.equal(result.items.some(row=>row.id===privateRecord.id),false);
assert.deepEqual(result.excluded.map(row=>row.reason).sort(),['MISSING_ACTUAL_CLOSE_DATE','MISSING_AMOUNT_OR_CURRENCY','MISSING_EXPECTED_CLOSE_DATE']);
assert.equal(result.provider_verified,false);assert.equal(result.accounting_revenue,false);
assert.equal(forecast(core,ctx,seller,{...period,currency:'EUR'}).groups.length,1);
assert.equal(forecast(core,ctx,seller,{...period,owner_id:stranger.id}).source_record_count,0);
assert.equal(forecast(core,{...ctx,tenant_id:'other-fixture'},admin,period).available,false);
for(const from of ['2026-02-30','2026-9-01','2026-09-01T00:00:00Z'])assert.throws(()=>forecast(core,ctx,seller,{...period,from}),{code:'forecast_date_invalid'});
assert.throws(()=>forecast(core,ctx,seller,{from:'2026-09-02',to:'2026-09-01'}),{code:'forecast_period_invalid'});
assert.throws(()=>forecast(core,ctx,seller,{from:'2026-01-01',to:'2028-01-01'}),{code:'forecast_period_invalid'});
assert.throws(()=>save({closed_date:'2026-02-30'}),{code:'forecast_date_invalid'});
assert.throws(()=>save({forecast_category:'<script>'}),{code:'forecast_category_invalid'});
assert.throws(()=>forecast(core,ctx,{id:'unauthorized',roles:[]},period),{code:'composition_forbidden'});
assert.throws(()=>forecast(core,{...ctx,tenant_id:'legacy-fixture'},{id:'unauthorized',roles:[]},period),{code:'composition_forbidden'});

const input={title:'September fixture projection',filters:period,basis_fingerprint:result.basis_fingerprint,confirm:true};
assert.throws(()=>snapshotForecast(core,ctx,{...seller,roles:['VIEWER']},input,{idempotency_key:'viewer'}),{code:'composition_forbidden'});
assert.throws(()=>snapshotForecast(core,ctx,seller,input),{code:'forecast_idempotency_required'});
assert.throws(()=>snapshotForecast(core,ctx,seller,{...input,confirm:false},{idempotency_key:'unconfirmed'}),{code:'forecast_confirmation_required'});
const saved=snapshotForecast(core,ctx,seller,input,{idempotency_key:'snapshot-fixture'}).record;
assert.equal(saved.immutable,true);assert.equal(saved.provenance.provider_verified,false);
assert.equal(snapshotForecast(core,ctx,seller,input,{idempotency_key:'snapshot-fixture'}).deduplicated,true);
assert.throws(()=>snapshotForecast(core,ctx,seller,{...input,title:'Other'},{idempotency_key:'snapshot-fixture'}),{code:'idempotency_conflict'});
assert.equal(core.list(ctx,stranger,'forecast_snapshots').total,0);
assert.throws(()=>core.get(ctx,stranger,'forecast_snapshots',saved.id),{code:'record_not_found'});
assert.throws(()=>core.save(ctx,seller,'forecast_snapshots',{title:'Fake'}),{code:'forecast_snapshot_action_required'});
assert.throws(()=>core.save(ctx,seller,'forecast_snapshots',{title:'Changed',status:'DRAFT'},{id:saved.id,expected_revision:1}),{code:'forecast_snapshot_action_required'});
assert.throws(()=>core.approve(ctx,admin,'forecast_snapshots',saved.id,{confirm:true,expected_revision:1}),{code:'approval_not_applicable'});
core.save(ctx,seller,'opportunities',{value_cents:12000},{id:known.id,expected_revision:1});
assert.throws(()=>snapshotForecast(core,ctx,seller,input,{idempotency_key:'stale'}),{code:'forecast_basis_changed'});
assert.equal(snapshotForecast(core,ctx,seller,input,{idempotency_key:'snapshot-fixture'}).record.forecast.groups.find(g=>g.currency==='EUR').weighted_cents,5000,'Replay retains the originally reviewed calculation');
result=forecast(core,ctx,seller,period);
const current={...input,basis_fingerprint:result.basis_fingerprint};
const before=JSON.stringify([...state]);broken=true;
assert.throws(()=>snapshotForecast(core,ctx,seller,current,{idempotency_key:'disk-failure'}),/fixture disk/);
broken=false;assert.equal(JSON.stringify([...state]),before,'Failed persistence must restore snapshot, outbox and idempotency state');
state=new Map(JSON.parse(disk));core=new BusinessDomain('sales',adapter,resolver);
assert.equal(core.get(ctx,seller,'forecast_snapshots',saved.id).forecast.basis_fingerprint,input.basis_fingerprint);
assert.equal(snapshotForecast(core,ctx,seller,input,{idempotency_key:'snapshot-fixture'}).deduplicated,true);
assert.ok(events.some(event=>event.entity_type==='forecast_snapshots'&&event.permissions.user_ids.includes(seller.id)));
for(const cap of ['sales:forecast','sales:opportunities']){
  resolver.configure(ctx,admin,{entitlements:['sales'],capability_flags:{[cap]:false},expected_revision:resolver.profile(ctx).revision});
  assert.throws(()=>forecast(core,ctx,seller,period),{code:'capability_disabled'});
}
resolver.configure(ctx,admin,{entitlements:['sales'],enabled_modules:[],expected_revision:resolver.profile(ctx).revision});
assert.throws(()=>forecast(core,ctx,seller,period),{code:'module_disabled'});
assert.equal(core.export(ctx,admin).collections.forecast_snapshots.length,1);
assert.throws(()=>core.export(ctx,seller),{code:'composition_forbidden'});
console.log('PASS period forecasts, explicit missing data, currency separation, owner/tenant/capability access, immutable snapshots, stale basis, replay, rollback and restart');
