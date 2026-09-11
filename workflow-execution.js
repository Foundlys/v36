'use strict';

// Durable sequential execution on the existing platform adapter. A persisted
// RUNNING step after a crash is indeterminate and is never blindly repeated.
const crypto = require('node:crypto');
const {queueOwnedEvent,flushOwnedEvents}=require('./module-event-outbox');
const AUTOMATIC_EVENT_ALIASES=Object.freeze({new_lead:'lead_created',stage_changed:'crm_record_changed',appointment:'appointment_scheduled',payment:'invoice_paid',connector_state:'connector_state_changed'});
const clone = value => JSON.parse(JSON.stringify(value));
const fail = (code, message, statusCode = 409) => { throw Object.assign(new Error(message), { code, statusCode }); };
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
const signature = value => crypto.createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
function validateCondition(condition,depth=0,budget={nodes:0}) {
  const invalid=()=>fail('automation_condition_invalid','Ongeldige conditie of conditiegroep',422);
  if(depth>5||++budget.nodes>200||!condition||typeof condition!=='object'||Array.isArray(condition))invalid();
  const keys=Object.keys(condition),groups=['all','any','not'].filter(key=>Object.hasOwn(condition,key));
  if(groups.length){
    if(groups.length!==1||keys.length!==1)invalid();
    const children=groups[0]==='not'?[condition.not]:condition[groups[0]];
    if(!Array.isArray(children)||!children.length||children.length>20)invalid();
    for(const child of children)validateCondition(child,depth+1,budget);
    return;
  }
  if(keys.some(key=>!['field','operator','value'].includes(key))||typeof condition.field!=='string'||!/^(event|inputs)(?:\.[A-Za-z][A-Za-z0-9_]{0,79}){1,5}$/.test(condition.field)||/(?:__proto__|constructor|prototype)/.test(condition.field)||!['eq','ne','gt','gte','lt','lte','exists','in'].includes(condition.operator))invalid();
  const scalar=value=>value===null||typeof value==='boolean'||typeof value==='string'&&value.length<=12000||typeof value==='number'&&Number.isFinite(value);
  if(condition.operator==='exists'){if(Object.hasOwn(condition,'value'))invalid();return;}
  if(!Object.hasOwn(condition,'value'))invalid();
  if(condition.operator==='in'){
    if(!Array.isArray(condition.value)||!condition.value.length||condition.value.length>100||!condition.value.every(scalar))invalid();
  }else if(['gt','gte','lt','lte'].includes(condition.operator)){
    if(typeof condition.value!=='number'||!Number.isFinite(condition.value))invalid();
  }else if(!scalar(condition.value))invalid();
}
function sanitizeAction(action,sanitize){
  // Conditions are already strictly validated. Generic payload depth/string
  // normalization must not truncate a valid group or alter comparison values.
  const {when,...rest}=action;
  return {...sanitize(rest),...(Object.hasOwn(action,'when')?{when:clone(when)}:{})};
}
function matches(condition,event,inputs) {
  if(condition===undefined)return true;
  if(Object.hasOwn(condition,'not'))return !matches(condition.not,event,inputs);
  if(condition.all)return condition.all.every(child=>matches(child,event,inputs));
  if(condition.any)return condition.any.some(child=>matches(child,event,inputs));
  const value=condition.field.split('.').reduce((value,key)=>value&&Object.hasOwn(value,key)?value[key]:undefined,{event,inputs}),wanted=condition.value;
  switch(condition.operator){case'exists':return value!==undefined&&value!==null;case'eq':return value===wanted;case'ne':return value!==wanted;case'in':return Array.isArray(wanted)&&wanted.includes(value);case'gt':return typeof value==='number'&&typeof wanted==='number'&&value>wanted;case'gte':return typeof value==='number'&&typeof wanted==='number'&&value>=wanted;case'lt':return typeof value==='number'&&typeof wanted==='number'&&value<wanted;case'lte':return typeof value==='number'&&typeof wanted==='number'&&value<=wanted;default:return false;}
}
function validateWorkflow(actions) {
  if(!Array.isArray(actions)||!actions.length||actions.some(action=>!action||typeof action!=='object'||Array.isArray(action)))fail('automation_actions_invalid','Workflowstappen moeten geldige actieobjecten zijn',422);
  if(actions.length>100)fail('automation_action_limit','Maximaal honderd workflowstappen',422);
  for(const action of actions){retryPolicy(action);if(Object.hasOwn(action,'when'))validateCondition(action.when);if(String(action.type).toLowerCase()==='delay'&&(!Number.isInteger(action.seconds)||action.seconds<1||action.seconds>2592000))fail('automation_delay_invalid','Vertraging moet tussen één seconde en dertig dagen zijn',422);}
}

function retryPolicy(action){
  if(action.retry===undefined)return {max_attempts:1,initial_delay_seconds:1};
  const policy=action.retry;
  if(!policy||typeof policy!=='object'||Array.isArray(policy)||Object.keys(policy).some(key=>!['max_attempts','initial_delay_seconds'].includes(key))||!Number.isInteger(policy.max_attempts)||policy.max_attempts<1||policy.max_attempts>5||!Number.isInteger(policy.initial_delay_seconds)||policy.initial_delay_seconds<1||policy.initial_delay_seconds>3600)fail('automation_retry_invalid','Retries vereisen 1–5 pogingen en 1–3600 seconden wachttijd',422);
  return policy;
}

function retryableFailure(core,type,error){
  if(core.adapter.automationActionContract?.(type)?.idempotent!==true)return false;
  if(error.statusCode&&error.statusCode<500)return false;
  return error.retryable===true||['EIO','EBUSY','ETIMEDOUT'].includes(error.code);
}
function validateRetryContracts(core,actions){
  for(const action of actions)if(retryPolicy(action).max_attempts>1&&core.adapter.automationActionContract?.(String(action.type).toLowerCase())?.idempotent!==true)fail('automation_retry_contract_missing','Deze actie heeft geen geverifieerd idempotentiecontract voor retries',422);
}

function validateTrigger(trigger){
  if(!trigger||typeof trigger!=='object'||Array.isArray(trigger)||typeof trigger.type!=='string'||trigger.automatic!==undefined&&typeof trigger.automatic!=='boolean')fail('automation_trigger_invalid','Ongeldige workflowtrigger',422);
  if(trigger.automatic!==true)return;
  if(String(trigger.type).toLowerCase()==='schedule'){
    if(typeof trigger.at!=='string'||!/(?:Z|[+-]\d{2}:\d{2})$/.test(trigger.at)||!Number.isFinite(Date.parse(trigger.at)))fail('automation_schedule_invalid','Automatische planning vereist een geldig tijdstip met UTC-offset',422);
  }else if(!Object.hasOwn(AUTOMATIC_EVENT_ALIASES,trigger.type.toLowerCase())&&!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/.test(trigger.event_name||''))fail('automation_event_selector_required','Automatische eventtrigger vereist een expliciete eventnaam',422);
}

function executeWorkflow(core, ctx, actor, workflow, event, options, helpers) {
  const { sanitize, highRisk } = helpers;
  // Revalidate retained definitions before any new run, resume, or side effect.
  validateWorkflow(workflow.actions);
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
  const resuming = row?.status==='RECOVERY_READY'||row?.status === 'AWAITING_APPROVAL' && options.approval || ['WAITING_TIME','WAITING_RETRY'].includes(row?.status)&&Date.parse(row.next_wakeup_at)<=core.adapter.now().getTime();
  if (row && !resuming) return { ...clone(row), replayed: true };
  if(resuming)for(const step of row.steps)if(step.status==='WAITING_RETRY'&&core.adapter.automationActionContract?.(step.type)?.idempotent!==true)fail('automation_retry_contract_missing','Het retrycontract is niet meer beschikbaar',409);

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
    if(step?.status==='WAITING_RETRY'&&core.adapter.automationActionContract?.(type)?.idempotent!==true)fail('automation_retry_contract_missing','Het retrycontract is niet meer beschikbaar',409);
    if (['SUCCEEDED','SKIPPED_CONDITION'].includes(step?.status)) continue;
    if (step && !['AWAITING_APPROVAL', 'PLANNED_INTERNAL','WAITING_TIME','WAITING_RETRY'].includes(step.status)) break;
    if (!step) {
      step = { index, type, input: sanitizeAction(action,sanitize), status: 'PLANNED_INTERNAL', external_write: highRisk.has(type), idempotency_key: `workflow:${row.run_id}:${index}` };
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
    step.status = 'RUNNING'; step.started_at = core.now();step.attempts=(step.attempts||0)+1;row.next_wakeup_at=null;step.next_retry_at=null;
    core.commit(); // Failure here must prevent the side effect.
    try {
      const output = core.adapter.executeAutomationAction(ctx, actor, { ...clone(action), type }, { event: clone(row.trigger), inputs: clone(row.inputs), approval: clone(row.approval), run_id: row.run_id, step_index: index, idempotency_key: step.idempotency_key });
      if (output && typeof output.then === 'function') fail('automation_async_adapter_invalid', 'Automationadapter moet synchroon uitvoeren', 500);
      if (!output || typeof output.executed !== 'boolean') fail('automation_execution_unproven', 'Adapter gaf geen expliciet uitvoerbewijs', 500);
      step.status = output.executed ? 'SUCCEEDED' : 'BLOCKED';
      if(output.executed)delete step.error;
      step.output_index = row.outputs.length;
      row.outputs.push(sanitize(output));
    } catch (error) {
      const policy=retryPolicy(action),retryable=retryableFailure(core,type,error);
      step.status = retryable&&step.attempts<policy.max_attempts?'WAITING_RETRY':retryable&&policy.max_attempts>1?'DEAD_LETTER':'FAILED';
      // Domain errors must not expose payloads or provider credential details.
      step.error = String(error.code || 'automation_action_failed').slice(0, 120);
      row.errors.push({ step: index, attempt:step.attempts,code: step.error });
      if(step.status==='WAITING_RETRY'){
        row.next_wakeup_at=new Date(core.adapter.now().getTime()+Math.min(3600,policy.initial_delay_seconds*2**(step.attempts-1))*1000).toISOString();
        step.next_retry_at=row.next_wakeup_at;step.retry_basis='DOMAIN_IDEMPOTENCY_CONTRACT';
      }
    }
    step.completed_at = core.now();
    core.commit();
    if (step.status !== 'SUCCEEDED') break;
  }
  row.status = row.steps.some(step => step.status === 'DEAD_LETTER') ? 'DEAD_LETTER'
    : row.steps.some(step => step.status === 'FAILED') ? 'ERROR'
    : row.steps.some(step => step.status === 'BLOCKED') ? 'BLOCKED'
    : row.steps.some(step => step.status === 'AWAITING_APPROVAL') ? 'AWAITING_APPROVAL'
    : row.steps.some(step => step.status === 'WAITING_TIME') ? 'WAITING_TIME'
    : row.steps.some(step => step.status === 'WAITING_RETRY') ? 'WAITING_RETRY'
    : row.steps.length !== workflow.actions.length || row.steps.some(step => step.status === 'PLANNED_INTERNAL') ? 'PLANNED' : 'SUCCEEDED';
  row.completed_at = ['AWAITING_APPROVAL', 'PLANNED','WAITING_TIME','WAITING_RETRY'].includes(row.status) ? null : core.now();
  core.audit(ctx, actor, resuming ? 'RESUME' : 'RUN', 'automation', workflow.id, { run_id: row.run_id, status: row.status, step_count: row.steps.length, request_signature: requestSignature });
  queueOwnedEvent(core,ctx,actor,'automation','run',row,'updated');
  core.commit();
  flushOwnedEvents(core,ctx,actor);
  return clone(row);
}
module.exports = { validateCondition,sanitizeAction,AUTOMATIC_EVENT_ALIASES,executeWorkflow,validateWorkflow,validateTrigger,retryPolicy,validateRetryContracts,signature };
