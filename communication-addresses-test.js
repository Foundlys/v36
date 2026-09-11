'use strict';
const assert=require('node:assert/strict'),{publicV6,sameAddress}=require('./communication-addresses'),{destination}=require('./communication-smtp');
(async()=>{
 for(const address of ['2001:4860:4860::8888','2606:4700:4700::1111','2410::1','2a10:abcd::1','2003:1::1','2800::1234','2c00::42'])assert.equal(publicV6(address),true,address);
 for(const address of ['::','::1','::ffff:8.8.8.8','::ffff:127.0.0.1','64:ff9b::808:808','64:ff9b:1::a00:1','100::1','fc00::1','fd12::1','fe80::1','fe80::1%eth0','ff02::1','2001::1','2001:2::1','2001:20::1','2001:db8::1','2002:0808:0808::1','2620:4f:8000::1','3fff::1','3ffe::1','3000::1','5f00::1','2001:1000::1','invalid'])assert.equal(publicV6(address),false,address);
 assert.equal(sameAddress('2606:4700:0000:0000:0000:0000:0000:1111','2606:4700::1111'),true);assert.equal(sameAddress('2001:4860::8.8.8.8','2001:4860::808:808'),true);assert.equal(sameAddress('2001:4860::1','2001:4860::2'),false);assert.equal(sameAddress('bad','bad'),false);assert.equal(sameAddress('fe80::1%a','fe80::1%a'),false);assert.equal(sameAddress('::ffff:8.8.8.8','8.8.8.8'),false);
 const v6={family:6,address:'2606:4700::1111'},v4={family:4,address:'93.184.216.34'};assert.equal(await destination('smtp.fixture.test',async()=>[v6]),v6.address);assert.equal(await destination('smtp.fixture.test',async()=>[v6,v4]),v4.address);
 for(const rows of [[],null,[{family:6,address:'::1'}],[v4,{family:6,address:'fd00::1'}],[v6,{family:4,address:'127.0.0.1'}],[{family:4,address:v6.address}],Array(65).fill(v6)])await assert.rejects(destination('smtp.fixture.test',async()=>rows),{code:'smtp_destination_unavailable'});
 console.log('PASS allocated IPv6 mail destinations, reserved/special/transition/mapped/scoped denial, mixed-family DNS rejection, bounded answers and canonical exact peer comparison without re-resolution');
})().catch(error=>{console.error(error);process.exitCode=1;});
