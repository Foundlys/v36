'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createCoreStateTransaction}=require('../core-state-transaction');
test('a synchronous native boundary commits effects, events and request/cursor receipts once and restores all maps on write failure',()=>{
 const records=new Map([['order',[{id:'one',revision:1}]]]),events=new Map(),memory=new Map();let dirty=true,writes=0,disk;
 const t=createCoreStateTransaction({maps:[records,events,memory],readDirty:()=>dirty,restoreDirty:v=>{dirty=v;},persist(){writes++;disk=JSON.stringify([Array.from(records),Array.from(events),Array.from(memory)]);dirty=false;}});
 const nativePersist=()=>{if(!t.defer()){writes++;throw Error('Unexpected intermediate commit');}};
 const result=t.run(()=>{records.get('order')[0].revision=2;nativePersist();events.set('event',[{id:'one'}]);memory.set('cursor',2);nativePersist();return {revision:2};});
 assert.equal(result.revision,2);assert.equal(writes,1);assert.ok(disk.includes('cursor'));assert.equal(dirty,false);assert.equal(t.defer(),false);
 const before=JSON.stringify([Array.from(records),Array.from(events),Array.from(memory)]);
 const fail=createCoreStateTransaction({maps:[records,events,memory],readDirty:()=>dirty,restoreDirty:v=>{dirty=v;},persist(){throw Error('Atomic rename failed');}});
 assert.throws(()=>fail.run(()=>{records.get('order')[0].revision=3;records.set('new-scope',[]);events.clear();memory.set('cursor',3);dirty=true;return 'must not acknowledge';}),/Atomic rename failed/);
 assert.equal(JSON.stringify([Array.from(records),Array.from(events),Array.from(memory)]),before);assert.equal(dirty,false);assert.equal(fail.defer(),false);
});
test('native failure, asynchronous callbacks and nested boundaries cannot acknowledge partial work',()=>{
 const map=new Map([['state',1]]);let writes=0;
 const t=createCoreStateTransaction({maps:[map],persist:()=>writes++});
 assert.throws(()=>t.run(async()=>{map.set('state',99);}),{code:'core_transaction_async'});assert.equal(map.get('state'),1);
 assert.throws(()=>t.run(()=>{map.set('state',2);throw Error('Native validation failed');}),/Native validation failed/);
 assert.equal(map.get('state'),1);assert.equal(writes,0);
 assert.throws(()=>t.run(()=>{map.set('state',3);return Promise.resolve();}),{code:'core_transaction_async'});assert.equal(map.get('state'),1);
 assert.throws(()=>t.run(()=>{map.set('state',4);return t.run(()=>true);}),{code:'core_transaction_reentry'});assert.equal(map.get('state'),1);assert.equal(writes,0);
 t.run(()=>map.set('state',5));assert.equal(writes,1);assert.equal(map.get('state'),5);
});
