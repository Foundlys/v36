'use strict';
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./calendar-recurrence'));else root.FoundlyCalendarTime=factory(root.FoundlyCalendarRecurrence);})(globalThis,recurrence=>{
const fail=(code,message)=>{throw Object.assign(new Error(message),{code,statusCode:422});};
const formatters=new Map();
function timestamp(value){
  if(typeof value!=='string'||!/(?:Z|[+-]\d{2}:\d{2})$/.test(value))fail('date_offset_required','Een datum met expliciete UTC-offset is verplicht');
  const parts=value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/),at=Date.parse(value);
  const civil=parts&&Date.parse(parts[1]+'T00:00:00.000Z');
  if(!parts||!Number.isFinite(at)||!Number.isFinite(civil)||Number(parts[2])>23||Number(parts[3])>59||Number(parts[4]||0)>59||new Date(civil).toISOString().slice(0,10)!==parts[1])fail('date_invalid','Ongeldige kalenderdatum of tijd');
  return at;
}
function timezone(value){
  if(typeof value!=='string'||!value.trim())fail('timezone_invalid','Een expliciete IANA-tijdzone is verplicht');
  try{if(!formatters.has(value)){if(formatters.size>=100)formatters.delete(formatters.keys().next().value);formatters.set(value,new Intl.DateTimeFormat('en-CA',{timeZone:value,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}));}}catch{fail('timezone_invalid','Ongeldige IANA-tijdzone');}
  return value;
}
function wallParts(date,zone){
  timezone(zone);const parts=formatters.get(zone).formatToParts(new Date(date));
  return {...Object.fromEntries(parts.filter(part=>part.type!=='literal').map(part=>[part.type,Number(part.value)])),millisecond:((date%1000)+1000)%1000};
}
function wallNumber(parts){const date=new Date(0);date.setUTCFullYear(parts.year,parts.month-1,parts.day);date.setUTCHours(parts.hour,parts.minute,parts.second,parts.millisecond||0);return date.getTime();}
function fromWall(parts,zone){
  const wanted=wallNumber(parts),offsets=new Set();
  // Sample actual zone offsets on both sides of the local date. Do not assume
  // that a clock change is one hour (or even less than one day).
  for(let hours=-48;hours<=48;hours+=6){const sample=wanted+hours*3600000;offsets.add(wallNumber(wallParts(sample,zone))-sample);}
  const matches=[...offsets].map(offset=>wanted-offset).filter(candidate=>wallNumber(wallParts(candidate,zone))===wanted);
  if(!matches.length)fail('recurrence_dst_gap','Deze herhaling valt in een niet-bestaand lokaal tijdstip');
  if(matches.length>1)fail('recurrence_dst_ambiguous','Deze herhaling heeft een dubbel lokaal tijdstip; plan deze afzonderlijk met een expliciete offset');
  return matches[0];
}
function occurrences(row) {
  const start=timestamp(row.start_at),end=timestamp(row.end_at),rule=recurrence.normalize(row.recurrence);
  if(end<=start)fail('date_order_invalid','Einde moet na start liggen');
  if(!rule)return [{start_at:new Date(start).toISOString(),end_at:new Date(end).toISOString()}];
  const {count,interval,frequency}=rule;
  const parts=wallParts(start,row.timezone),result=[];
  for(let i=0;i<count;i++){
    const date=new Date(wallNumber(parts)+(frequency==='WEEKLY'?7:1)*interval*i*86400000);
    const wall={year:date.getUTCFullYear(),month:date.getUTCMonth()+1,day:date.getUTCDate(),hour:date.getUTCHours(),minute:date.getUTCMinutes(),second:date.getUTCSeconds(),millisecond:date.getUTCMilliseconds()};
    const at=i===0?start:fromWall(wall,row.timezone);
    result.push({start_at:new Date(at).toISOString(),end_at:new Date(at+end-start).toISOString()});
  }
  return result;
}
return {timestamp,timezone,wallParts,wallNumber,fromWall,occurrences};
});
