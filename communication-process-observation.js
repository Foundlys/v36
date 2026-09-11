'use strict';
// Read-only Linux process identity. A different application UUID alone never
// proves retirement: another server/namespace could still own the transport.
const fs=require('node:fs');
function parseStat(raw,pid){if(typeof raw!=='string'||!raw.startsWith(pid+' ('))return null;const end=raw.lastIndexOf(') ');if(end<0)return null;const fields=raw.slice(end+2).trim().split(/\s+/),ticks=fields[19];return /^[0-9]+$/.test(ticks||'')?ticks:null;}
function createObserver({readFile=path=>fs.readFileSync(path,'utf8'),readlink=path=>fs.readlinkSync(path),probe=pid=>process.kill(pid,0),pid=process.pid,platform=process.platform}={}){
 const context=()=>{try{if(platform!=='linux')return null;const boot_id=readFile('/proc/sys/kernel/random/boot_id').trim(),pid_namespace=readlink('/proc/self/ns/pid');if(!/^[a-f0-9-]{36}$/.test(boot_id)||!/^pid:\[[0-9]+\]$/.test(pid_namespace))return null;return {boot_id,pid_namespace};}catch{return null;}};
 function stamp(){try{const scope=context(),start_ticks=parseStat(readFile('/proc/self/stat'),pid);return scope&&start_ticks?{...scope,pid,start_ticks}:null;}catch{return null;}}
 function retired(previous){
  const scope=stamp();if(!scope||!previous||!Number.isSafeInteger(previous.pid)||previous.pid<1||typeof previous.start_ticks!=='string'||!/^\d+$/.test(previous.start_ticks)||previous.boot_id!==scope.boot_id||previous.pid_namespace!==scope.pid_namespace)return false;
  try{const ticks=parseStat(readFile('/proc/'+previous.pid+'/stat'),previous.pid);return ticks!==null&&ticks!==previous.start_ticks;}catch(error){
   // hidepid/permissions can make /proc entries appear absent. Signal 0 sends
   // no signal; only ESRCH confirms absence in this exact PID namespace.
   if(error.code!=='ENOENT'&&error.code!=='ESRCH')return false;try{probe(previous.pid);return false;}catch(probeError){return probeError.code==='ESRCH';}
  }
 }
 return {stamp,retired};
}
module.exports={...createObserver(),createObserver,parseStat};
