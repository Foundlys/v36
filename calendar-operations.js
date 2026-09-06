'use strict';
const crypto=require('node:crypto');
const {occurrences}=require('./business-domains');
const fail=(code,message,statusCode=422)=>{throw Object.assign(new Error(message),{code,statusCode});};
const digest=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
function instant(value){if(typeof value!=='string'||!/(?:Z|[+-]\d{2}:\d{2})$/.test(value)||!Number.isFinite(Date.parse(value)))fail('date_offset_required','Gebruik een geldige datum met UTC-offset');return Date.parse(value);}
function calendarOperations(core){
  return {
    slots(ctx,actor,input={}){
      core.scope(ctx,actor);core.resolver.assertCapability(ctx,actor,'calendar:availability');
      const from=instant(input.from),to=instant(input.to),duration=Number(input.duration_minutes||30),step=Number(input.step_minutes||15);
      if(to<=from||to-from>31*86400000||!Number.isInteger(duration)||duration<5||duration>480||!Number.isInteger(step)||step<5||step>120)fail('scheduling_window_invalid','Kies maximaal 31 dagen en een geldige afspraakduur');
      let ids=input.calendar_ids;if(typeof ids==='string')ids=ids.split(',');if(ids&&(!Array.isArray(ids)||ids.length>50))fail('calendar_selection_invalid','Maximaal vijftig agenda’s');
      const calendars=core.bucket(ctx,'calendars').filter(row=>core.visible(row,actor)&&row.status!=='ARCHIVED'&&(!ids||ids.includes(row.id))).slice(0,50);
      if(ids&&ids.some(id=>!calendars.some(row=>row.id===id)))fail('calendar_not_found','Agenda niet beschikbaar',404);
      const availability=core.bucket(ctx,'availability').filter(row=>core.visible(row,actor)&&!['ARCHIVED','CANCELLED'].includes(row.status));
      const events=core.bucket(ctx,'events').filter(row=>!['ARCHIVED','CANCELLED'].includes(row.status)&&row.start_at&&row.end_at);
      const candidates=[];
      for(const calendar of calendars){
        const revision=digest({tenant:ctx,actor:actor.id,calendar:{id:calendar.id,revision:calendar.revision},availability:availability.filter(row=>row.calendar_id===calendar.id).map(row=>[row.id,row.revision]),events:events.filter(row=>row.calendar_id===calendar.id).map(row=>[row.id,row.revision])});
        const busy=events.filter(row=>row.calendar_id===calendar.id).flatMap(occurrences);
        const load=busy.filter(row=>Date.parse(row.start_at)>=from&&Date.parse(row.start_at)<to).length;
        for(const window of availability.filter(row=>row.calendar_id===calendar.id).flatMap(occurrences)){
          const starts=Math.max(from,Date.parse(window.start_at)),ends=Math.min(to,Date.parse(window.end_at));
          for(let at=starts;at+duration*60000<=ends;at+=step*60000){
            const end=at+duration*60000;
            if(busy.some(row=>Date.parse(row.start_at)<end&&at<Date.parse(row.end_at)))continue;
            candidates.push({calendar_id:calendar.id,start_at:new Date(at).toISOString(),end_at:new Date(end).toISOString(),timezone:calendar.timezone,availability_revision:revision,distribution_load:load});
            if(candidates.filter(row=>row.calendar_id===calendar.id).length>=500)break;
          }
          if(candidates.filter(row=>row.calendar_id===calendar.id).length>=500)break;
        }
      }
      const mode=String(input.distribution||'AVAILABILITY').toUpperCase();if(!['AVAILABILITY','ROUND_ROBIN'].includes(mode))fail('distribution_invalid','Onbekende verdeling');
      candidates.sort((a,b)=>mode==='ROUND_ROBIN'?(a.distribution_load-b.distribution_load||a.start_at.localeCompare(b.start_at)||a.calendar_id.localeCompare(b.calendar_id)):(a.start_at.localeCompare(b.start_at)||a.calendar_id.localeCompare(b.calendar_id)));
      const unique=[...new Map(candidates.map(row=>[`${row.calendar_id}:${row.start_at}`,row])).values()];
      return {items:unique.slice(0,500),total:Math.min(unique.length,500),truncated:unique.length>500,limit:500,distribution:mode,scope:'AUTHORIZED_CALENDARS_AND_RECORDED_AVAILABILITY',external_calendar_coverage:'NOT_CLAIMED',observed_at:new Date().toISOString()};
    },
    book(ctx,actor,input,options={}){
      core.scope(ctx,actor,'write');core.resolver.assertCapability(ctx,actor,'calendar:events','write');
      if(!options.idempotency_key)fail('booking_idempotency_required','Idempotency-Key is verplicht');
      if(input.confirm!==true)fail('booking_confirmation_required','Bevestig het gekozen tijdstip');
      const prior=core.adapter.bucket(ctx,'calendar:idempotency').find(row=>row.key===`booking:${options.idempotency_key}`&&row.actor_id===actor.id),fingerprint=digest(input);
      if(prior){if(prior.request_fingerprint!==fingerprint)fail('booking_idempotency_conflict','Boekingssleutel heeft andere inhoud',409);return {record:core.get(ctx,actor,'events',prior.record_id),deduplicated:true};}
      const duration=(instant(input.end_at)-instant(input.start_at))/60000;
      const matching=this.slots(ctx,actor,{calendar_ids:[input.calendar_id],from:input.start_at,to:input.end_at,duration_minutes:duration}).items[0];
      if(!matching||input.availability_revision!==matching.availability_revision)fail('availability_changed','Beschikbaarheid is gewijzigd; kies opnieuw',409);
      const result=core.save(ctx,actor,'events',{title:input.title,calendar_id:matching.calendar_id,start_at:matching.start_at,end_at:matching.end_at,timezone:matching.timezone,participants:input.participants||[],related_refs:input.related_refs||[],status:'CONFIRMED'},{...options,idempotency_key:`booking:${options.idempotency_key}`,request_fingerprint:fingerprint});
      return result;
    },
    tickReminders(ctx,actor,now=new Date()){
      core.scope(ctx,actor,'write');core.resolver.assertCapability(ctx,actor,'calendar:events','write');
      const notifications=core.bucket(ctx,'notifications'),due=core.bucket(ctx,'reminders').filter(row=>core.visible(row,actor)&&!['ARCHIVED','CANCELLED','COMPLETED'].includes(row.status)&&Date.parse(row.due_at)<=now.getTime()).slice(0,100);
      if(!due.length)return {processed:0,delivery:'IN_APP_ONLY',external_delivery:false};
      core.mutate(ctx,()=>{for(const reminder of due){
        const key=`reminder:${reminder.id}:${reminder.revision}`;
        if(!notifications.some(row=>row.delivery_key===key)){
          const notification={id:crypto.randomUUID(),tenant_id:ctx.tenant_id,dealer_id:ctx.dealer_id,owner_id:reminder.owner_id,title:reminder.title,content:reminder.content||'',related_refs:reminder.related_refs||[],status:'OPEN',delivery_key:key,delivery_state:'AVAILABLE_IN_APP',created_at:now.toISOString(),updated_at:now.toISOString(),revision:1,source_module:'calendar'};
          notifications.push(notification);core.recordEvent(ctx,actor,'notifications',notification,'created');
        }
        reminder.status='COMPLETED';reminder.delivery_state='AVAILABLE_IN_APP';reminder.delivered_at=now.toISOString();
      }
      });
      if(due.length)core.flush(ctx,actor);
      return {processed:due.length,delivery:'IN_APP_ONLY',external_delivery:false};
    }
  };
}
module.exports={calendarOperations};
