'use strict';

// Durable sequential execution on the existing platform adapter. A persisted
// RUNNING step after a crash is indeterminate and is never blindly repeated.
const crypto = require('node:crypto');
const {queueOwnedEvent,flushOwnedEvents}=require('./module-event-outbox');
const clone = value => JSON.parse(JSON.stringify(value));
const fail = (code, message, statusCode = 409) => { throw Object.assign(new Error(message), { code, statusCode }); };
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
const signature = value => crypto.createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
function validateCondition(condition,depth=0) {
  if(!condition)return;
  if(depth>5||typeof condition!=='object')fail('automation_condition_invalid','Ongeldige conditie',422);
  if(condition.all||condition.any){const group=condition.all||condition.any;if(!Array.isArray(group)||!group.length||group.length>20)fail('automation_condition_invalid','Ongeldige conditiegroep',422);for(const child of group)validateCondition(child,depth+1);return;}
  if(!/^(event|inputs)(?:\.[A-Za-z][A-Za-z0-9_]{0,79}){1,5}$/.test(condition.field||'')||/(?:__proto__|constructor|prototype)/.test(condition.field)||!['eq','ne','gt','gte','lt','lte','exists','in'].includes(condition.operator))fail('automation_condition_invalid','Conditie heeft een niet-ondersteund veld of vergelijking',422);
}
function matches(condition,event,inputs) {
  if(!condition)return true;
  if(condition.all)return condition.all.every(child=>matches(child,event,inputs));
  if(condition.any)return condition.any.some(child=>matches(child,event,inputs));
  const value=condition.field.split('.').reduce((value,key)=>value&&Object.hasOwn(value,key)?value[key]:undefined,{event,inputs}),wanted=condition.value;
  switch(condition.operator){case'exists':return value!==undefined&&value!==null;case'eq':return value===wanted;case'ne':return value!==wanted;case'in':return Array.isArray(wanted)&&wanted.includes(value);case'gt':return typeof value==='number'&&typeof wanted==='number'&&value>wanted;case'gte':return typeof value==='number'&&typeof wanted==='number'&&value>=wanted;case'lt':return typeof value==='number'&&typeof wanted==='number'&&value<wanted;case'lte':return typeof value==='number'&&typeof wanted==='number'&&value<=wanted;default:return false;}
}
function validateWorkflow(actions) {
  if(actions.length>100)fail('automation_action_limit','Maximaal honderd workflowstappen',422);
  for(const action of actions){validateCondition(action.when);if(String(action.type).toLowerCase()==='delay'&&(!Number.isInteger(action.seconds)||action.seconds<1||action.seconds>2592000))fail('automation_delay_invalid','Vertraging moet tussen één seconde en dertig dagen zijn',422);}
}

function executeWorkflow(core, ctx, actor, workflow, event, options, helpers) {
  const { sanitize, highRisk } = helpers;
  if (!event || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/.test(event.event_id || event.id || '')) fail('automation_event_invalid', 'Canonical event_id is verplicht', 400);
  if (event.tenant_id && event.tenant_id !== ctx.tenant_id || event.dealer_id && event.dealer_id !== ctx.dealer_id) fail('automation_tenant_mismatch', 'Event behoort tot een andere tenant', 403);
  if (event.event_version !== undefined && event.event_version !== 1) fail('automation_event_version_unsupported', 'Eventversie wordt niet ondersteund', 422);
  const eventId = event.event_id || event.id, trigger = sanitize(event), inputs = sanitize(options.inputs || {});
  const requestSignature = signature({ workflow: workflow.signature, trigger, inputs });
  const rows = core.bucket(ctx, 'automation_runs');
  let row = rows.find(item => item.automation_id === workflow.id && item.event_id === eventId);
  if (row && (row.request_signature || signature({ workflow: workflow.signature, trigger: row.trigger, inputs: row.inputs })) !== requestSignature) fail('automation_replay_conflict', 'Event-ID heeft andere workflow-invoer');
  if (row && row.actor_id !== actor.id && !actor.permissions.has('*')) fail('automation_run_forbidden', 'Run behoort tot een andere gebruiker', 403);
  if (row?.steps.some(step => step.status === 'RUNNING')) fail('automation_outcome_indeterminate', 'Controleer het resultaat van de onderbroken stap vóór hervatten');
  const resuming = row?.status === 'AWAITING_APPROVAL' && options.approval || row?.status==='WAITING_TIME'&&Date.parse(row.next_wakeup_at)<=core.adapter.now().getTime();
  if (row && !resuming) return { ...clone(row), replayed: true };

  let approval = null;
  if (options.approval) {
    const value = options.approval;
    if (!actor.permissions.has('*') && !actor.permissions.has('automation:approve')) fail('automation_approval_forbidden', 'Goedkeuringsrecht ontbreekt', 403);
    if (!row || value.run_id !== row.run_id || value.request_signature !== requestSignature || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/.test(value.reference || '') || !String(value.reason || '').trim()) fail('automation_approval_binding_invalid', 'Goedkeuring moet verwijzen naar de wachtende run en exacte invoer', 422);
    approval = { approved: true, run_id: row.run_id, request_signature: requestSignature, reference: value.reference, reason: String(value.reason).slice(0, 500), actor_id: actor.id, at: core.now() };
  }
  if (!row) {
    if (rows.length >= 25000) fail('automation_run_capacity', 'Archiveer runs volgens bewaarbeleid', 507);
    row = { run_id: core.adapter.id(), tenant_id: ctx.tenant_id, dealer_id: ctx.dealer_id, automation_id: workflow.id, workflow_version: workflow.version, event_id: eventId, request_signature: requestSignature, trigger, inputs, steps: [], outputs: [], errors: [], status: 'RUNNING', started_at: core.now(), completed_at: null, actor_id: actor.id, approval: null, replay_safe: true };
    rows.push(row);
  }
  if (approval) row.approval = approval;
  row.status = 'RUNNING';
  core.commit();
  for (let index = 0; index < workflow.actions.length; index++) {
    const action = workflow.actions[index], type = String(action.type).toLowerCase();
    let step = row.steps.find(item => item.index === index);
    if (['SUCCEEDED','SKIPPED_CONDITION'].includes(step?.status)) continue;
    if (step && !['AWAITING_APPROVAL', 'PLANNED_INTERNAL','WAITING_TIME'].includes(step.status)) break;
    if (!step) {
      step = { index, type, input: sanitize(action), status: 'PLANNED_INTERNAL', external_write: highRisk.has(type), idempotency_key: `workflow:${row.run_id}:${index}` };
      row.steps.push(step);
    }
    if(!matches(action.when,row.trigger,row.inputs)){step.status='SKIPPED_CONDITION';step.completed_at=core.now();core.commit();continue;}
    if(type==='delay'){
      if(!step.wake_at){step.wake_at=new Date(core.adapter.now().getTime()+action.seconds*1000).toISOString();step.status='WAITING_TIME';}
      if(Date.parse(step.wake_at)>core.adapter.now().getTime()){row.next_wakeup_at=step.wake_at;break;}
      step.status='SUCCEEDED';step.completed_at=core.now();row.next_wakeup_at=null;core.commit();continue;
    }
    if ((highRisk.has(type) || workflow.approval_required && workflow.risk !== 'HIGH') && !row.approval) { step.status = 'AWAITING_APPROVAL'; break; }
    if (typeof core.adapter.executeAutomationAction !== 'function') { step.status = 'PLANNED_INTERNAL'; continue; }
    step.status = 'RUNNING'; step.started_at = core.now();
    core.commit(); // Failure here must prevent the side effect.
    try {
      const output = core.adapter.executeAutomationAction(ctx, actor, { ...clone(action), type }, { event: clone(row.trigger), inputs: clone(row.inputs), approval: clone(row.approval), run_id: row.run_id, step_index: index, idempotency_key: step.idempotency_key });
      if (output && typeof output.then === 'function') fail('automation_async_adapter_invalid', 'Automationadapter moet synchroon uitvoeren', 500);
      if (!output || typeof output.executed !== 'boolean') fail('automation_execution_unproven', 'Adapter gaf geen expliciet uitvoerbewijs', 500);
      step.status = output.executed ? 'SUCCEEDED' : 'BLOCKED';
      step.output_index = row.outputs.length;
      row.outputs.push(sanitize(output));
    } catch (error) {
      step.status = 'FAILED';
      // Domain errors must not expose payloads or provider credential details.
      step.error = String(error.code || 'automation_action_failed').slice(0, 120);
      row.errors.push({ step: index, code: step.error });
    }
    step.completed_at = core.now();
    core.commit();
    if (step.status !== 'SUCCEEDED') break;
  }
  row.status = row.steps.some(step => step.status === 'FAILED') ? 'ERROR'
    : row.steps.some(step => step.status === 'BLOCKED') ? 'BLOCKED'
    : row.steps.some(step => step.status === 'AWAITING_APPROVAL') ? 'AWAITING_APPROVAL'
    : row.steps.some(step => step.status === 'WAITING_TIME') ? 'WAITING_TIME'
    : row.steps.length !== workflow.actions.length || row.steps.some(step => step.status === 'PLANNED_INTERNAL') ? 'PLANNED' : 'SUCCEEDED';
  row.completed_at = ['AWAITING_APPROVAL', 'PLANNED','WAITING_TIME'].includes(row.status) ? null : core.now();
  core.audit(ctx, actor, resuming ? 'RESUME' : 'RUN', 'automation', workflow.id, { run_id: row.run_id, status: row.status, step_count: row.steps.length, request_signature: requestSignature });
  queueOwnedEvent(core,ctx,actor,'automation','run',row,'updated');
  core.commit();
  flushOwnedEvents(core,ctx,actor);
  return clone(row);
}
module.exports = { executeWorkflow,validateWorkflow };
