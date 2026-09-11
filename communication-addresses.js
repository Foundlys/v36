'use strict';
const net=require('node:net');
// IANA Global Unicast and IPv6 Special-Purpose registries checked 2026-09-11.
// Ordinary allocated unicast only; special-purpose/transition and unallocated
// space are not mail destinations. Scoped/link-local and mapped IPv4 fail shut.
const ALLOCATED=['2001:200::/23','2001:400::/23','2001:600::/23','2001:800::/22','2001:c00::/23','2001:e00::/23','2001:1200::/23','2001:1400::/22','2001:1800::/23','2001:1a00::/23','2001:1c00::/22','2001:2000::/19','2001:4000::/23','2001:4200::/23','2001:4400::/23','2001:4600::/23','2001:4800::/23','2001:4a00::/23','2001:4c00::/23','2001:5000::/20','2001:8000::/19','2001:a000::/20','2001:b000::/20','2003::/18','2400::/12','2410::/12','2600::/12','2610::/23','2620::/23','2630::/12','2800::/12','2a00::/12','2a10::/12','2c00::/12'];
const SPECIAL=['2001::/23','2001:db8::/32','2002::/16','2620:4f:8000::/48','3fff::/20'];
function ipv6(value){
 if(typeof value!=='string'||net.isIP(value)!==6||value.includes('%'))return null;
 if(value.includes('.')){const index=value.lastIndexOf(':'),v4=value.slice(index+1);if(net.isIP(v4)!==4)return null;const bytes=v4.split('.').map(Number);value=value.slice(0,index+1)+(bytes[0]*256+bytes[1]).toString(16)+':'+(bytes[2]*256+bytes[3]).toString(16);}
 const parts=value.split('::'),left=parts[0]?parts[0].split(':'):[],right=parts.length===2&&parts[1]?parts[1].split(':'):[],words=parts.length===2?[...left,...Array(8-left.length-right.length).fill('0'),...right]:left;if(words.length!==8)return null;
 return words.reduce((total,word)=>(total<<16n)+BigInt(parseInt(word,16)),0n);
}
const prefixes=values=>values.map(value=>{const [address,length]=value.split('/'),shift=128n-BigInt(length);return {shift,network:ipv6(address)>>shift};}),allocated=prefixes(ALLOCATED),special=prefixes(SPECIAL),contains=(prefix,value)=>(value>>prefix.shift)===prefix.network;
function publicV6(address){const value=ipv6(address);return value!==null&&allocated.some(prefix=>contains(prefix,value))&&!special.some(prefix=>contains(prefix,value));}
function sameAddress(left,right){const family=net.isIP(left);if(!family||family!==net.isIP(right))return false;if(family===4)return left===right;const value=ipv6(left);return value!==null&&value===ipv6(right);}
module.exports={publicV6,sameAddress,ipv6};
