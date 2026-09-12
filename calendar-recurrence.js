'use strict';
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FoundlyCalendarRecurrence=api;})(globalThis,()=>{
  const fail=()=>{throw Object.assign(new Error('Kies dagelijkse of wekelijkse herhaling, 1–104 afspraken en een interval van 1–12. Andere herhaalregels worden niet ondersteund.'),{code:'recurrence_invalid',statusCode:422});};
  function normalize(rule){
    if(rule===null||rule===undefined)return null;
    if(typeof rule!=='object'||Array.isArray(rule)||Object.keys(rule).some(key=>!['frequency','count','interval'].includes(key)))fail();
    const frequency=typeof rule.frequency==='string'?rule.frequency.toUpperCase():'',count=rule.count,interval=rule.interval===undefined?1:rule.interval;
    if(!['DAILY','WEEKLY'].includes(frequency)||!Number.isInteger(count)||count<1||count>104||!Number.isInteger(interval)||interval<1||interval>12)fail();
    return {frequency,count,interval};
  }
  return {normalize};
});
