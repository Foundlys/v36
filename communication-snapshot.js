'use strict';
function communicationSnapshot({read,calendar,metric}){
  const load=operation=>{if(!operation)return {available:false,total:null,items:[],code:'MODULE_UNAVAILABLE'};try{const value=operation();return {...value,available:true,code:null};}catch(error){return {available:false,total:null,items:[],code:String(error.code||'source_unavailable').slice(0,100)};}};
  const drafts=load(()=>read('drafts')),messages=load(()=>read('messages')),appointments=load(calendar),rows=messages.items;
  const complete=messages.available&&rows.length===messages.total;
  const direction=row=>typeof row.direction==='string'?row.direction.toUpperCase():null;
  const readState=row=>typeof row.read==='boolean'?row.read:row.status==='UNREAD'?false:row.status==='READ'?true:null;
  const directionsKnown=rows.every(row=>['INBOUND','OUTBOUND'].includes(direction(row))),readKnown=rows.every(row=>readState(row)!==null);
  const basis='Uitsluitend toegankelijke, vastgelegde berichtrecords. Geen claim over volledigheid of bezorging van een externe mailbox.';
  const messageMetric=(id,value,available=messages.available)=>metric(id,value,{available,unit:'RETAINED_MESSAGES',source:'FOUNDLY_RETAINED_COMMUNICATION_MESSAGES',freshness:'RETAINED_RECORDS',detail:basis+(!available?' Deze telling is niet beschikbaar: rechten, gegevensdekking of bronvelden ontbreken.':'')});
  return {
    metrics:{
      drafts:metric('drafts',drafts.total,{available:drafts.available,unit:'INTERNAL_DRAFTS',source:'FOUNDLY_COMMUNICATION_DRAFTS',detail:'Interne concepten; niet verzonden.'}),
      messages:messageMetric('messages',messages.total),
      inbound:messageMetric('inbound',rows.filter(row=>direction(row)==='INBOUND').length,complete&&directionsKnown),
      outbound:messageMetric('outbound',rows.filter(row=>direction(row)==='OUTBOUND').length,complete&&directionsKnown),
      unread:messageMetric('unread',rows.filter(row=>readState(row)===false).length,complete&&readKnown),
      recent_communication:messageMetric('recent_communication',messages.total),
      appointments:metric('appointments',appointments.total,{available:appointments.available,source:'FOUNDLY_CALENDAR_EVENTS'})
    },
    rows:rows.slice().sort((a,b)=>String(b.updated_at||b.created_at||'').localeCompare(String(a.updated_at||a.created_at||''))).slice(0,100),
    details:{drafts:{available:drafts.available,total:drafts.total,error:drafts.code},messages:{available:messages.available,total:messages.total,returned:rows.length,complete,direction_coverage_complete:complete&&directionsKnown,read_coverage_complete:complete&&readKnown,error:messages.code},calendar:{available:appointments.available,error:appointments.code},external_mailbox_coverage:'NOT_CLAIMED',verified_external_delivery:false,row_scope:'FIRST_ACCESSIBLE_PAGE',row_limit:100}
  };
}
module.exports={communicationSnapshot};
