'use strict';

const assert=require('assert');
const {FoundlyCrmCore,ENTITY_DEFINITIONS,presetDashboard}=require('./crm-core');

const stores=new Map(),events=[];
const key=(ctx,scope)=>`${ctx.tenant_id}:${ctx.dealer_id}:${scope}`;
const bucket=(ctx,scope)=>{const name=key(ctx,scope);if(!stores.has(name))stores.set(name,[]);return stores.get(name)};
let sequence=0,persisted=0;
const core=new FoundlyCrmCore({bucket,persist:()=>persisted++,emit:(ctx,event)=>events.push({ctx,event}),id:()=>`crm-id-${String(++sequence).padStart(5,'0')}`,now:()=>new Date('2026-09-04T09:00:00.000Z')});
const tenant={tenant_id:'tenant-alpha',dealer_id:'business-alpha'},otherTenant={tenant_id:'tenant-beta',dealer_id:'business-beta'};
const admin={id:'admin-1',roles:['ADMIN'],team_ids:['team-1']},sales={id:'sales-1',roles:['SALES'],team_ids:['team-1']},marketing={id:'marketing-1',roles:['MARKETING'],team_ids:['team-1']},viewer={id:'viewer-1',roles:['VIEWER'],team_ids:['team-2']};

assert(Object.keys(ENTITY_DEFINITIONS).length>=37,'the enterprise CRM model must expose every requested domain collection');
assert.equal(core.schema().contracts.external_writes,'never_without_explicit_authorization_and_connector');
assert(presetDashboard('EXECUTIVE').widgets.length>=6);

const empty=core.analytics(otherTenant,admin,{});
assert.equal(empty.metrics.pipeline_value.value,0);
assert.equal(empty.metrics.pipeline_value.available,false,'an empty tenant may not receive fabricated analytics availability');
assert.equal(empty.no_fake_data,true);
const provisioned=core.provisionProfile(otherTenant,admin,{business_name:'Example Business',country:'NL',industry:'professional_services',segment:'mid_market',dashboard_preset:'EXECUTIVE'},{idempotencyKey:'profile-provision-0001'});
assert.equal(provisioned.stages.length,6);assert.equal(provisioned.created_business_records,0);assert.equal(provisioned.no_demo_data,true);assert.equal(provisioned.one_codebase,true);
assert.deepEqual(provisioned.profile.engines,['crm','analytics','automation']);assert.deepEqual(provisioned.profile.regions,['NL']);assert.equal(provisioned.profile.dashboard_preset,'EXECUTIVE');assert(provisioned.profile.kpis.includes('pipeline_value'));assert(provisioned.profile.permissions.roles.includes('SALES'));assert(provisioned.profile.zero_tools.includes('crm_inventory_customer_matches'));
const provisionReplay=core.provisionProfile(otherTenant,admin,{business_name:'Example Business',country:'NL',industry:'professional_services',segment:'mid_market',dashboard_preset:'EXECUTIVE'},{idempotencyKey:'profile-provision-0001'});assert.equal(provisionReplay.idempotent_replay,true);
assert.equal(core.analytics(otherTenant,admin,{}).metrics.leads.available,false,'provisioning may never invent business records');

const pipeline=core.create(tenant,admin,'pipelines',{name:'New business',currency:'EUR'},{idempotencyKey:'pipeline-create-0001'});
const replay=core.create(tenant,admin,'pipelines',{name:'New business',currency:'EUR'},{idempotencyKey:'pipeline-create-0001'});
assert.equal(replay.id,pipeline.id);assert.equal(replay.idempotent_replay,true);
assert.throws(()=>core.create(tenant,admin,'pipelines',{name:'Changed payload'},{idempotencyKey:'pipeline-create-0001'}),error=>error.code==='crm_idempotency_conflict');
const stageNew=core.create(tenant,admin,'stages',{name:'New',pipeline_id:pipeline.id,position:1,probability:10,status:'OPEN'});
const stageQualified=core.create(tenant,admin,'stages',{name:'Qualified',pipeline_id:pipeline.id,position:2,probability:55,status:'OPEN'});
const company=core.create(tenant,admin,'companies',{name:'Northstar Mobility'});
const contact=core.create(tenant,sales,'contacts',{name:'Alex de Vries',email:'alex@example.test',company_id:company.id,team_id:'team-1'});
const lead=core.create(tenant,sales,'leads',{name:'Alex de Vries',contact_id:contact.id,company_id:company.id,status:'qualified',score:71,source_id:'website',team_id:'team-1',next_action_at:'2026-09-04T10:00:00Z'});
const deal=core.create(tenant,sales,'deals',{title:'Fleet renewal',lead_id:lead.id,contact_id:contact.id,company_id:company.id,pipeline_id:pipeline.id,stage_id:stageNew.id,status:'OPEN',probability:10,value:85000,margin:11200,team_id:'team-1'});
core.create(tenant,sales,'activities',{type:'call',lead_id:lead.id,contact_id:contact.id,deal_id:deal.id,occurred_at:'2026-09-04T09:05:00Z',summary:'Discovery completed',team_id:'team-1'});
core.create(tenant,sales,'tasks',{title:'Send proposal',lead_id:lead.id,contact_id:contact.id,deal_id:deal.id,status:'OPEN',due_at:'2026-09-05T09:00:00Z',team_id:'team-1'});
core.create(tenant,sales,'consents',{subject_id:contact.id,contact_id:contact.id,purpose:'sales_follow_up',status:'GRANTED',consented_at:'2026-09-04T08:30:00Z',team_id:'team-1'});

assert.throws(()=>core.create(tenant,sales,'contacts',{name:'Unsafe',api_key:'must-not-live-in-crm'}),error=>error.code==='crm_secret_rejected');
assert.throws(()=>core.get(otherTenant,admin,'contacts',contact.id),error=>error.code==='crm_record_not_found','tenant partitioning must prevent cross-tenant reads');
assert.throws(()=>core.get(tenant,viewer,'contacts',contact.id),error=>error.code==='crm_record_not_found','assigned-record authorization must be enforced');
assert.equal(core.get(tenant,sales,'contacts',contact.id).email,'alex@example.test');
assert.throws(()=>core.create(tenant,marketing,'leads',{name:'Forbidden marketing lead'}),error=>error.code==='crm_forbidden','marketing write permission must not grant unrestricted entity creation');
const campaign=core.create(tenant,marketing,'campaigns',{name:'Real campaign',status:'ACTIVE'});const campaignUpdated=core.update(tenant,marketing,'campaigns',campaign.id,{status:'PAUSED'},{expectedRevision:campaign.revision});assert.equal(campaignUpdated.status,'PAUSED');

const customer=core.customer360(tenant,sales,contact.id);
assert.equal(customer.subject.id,contact.id);
assert.equal(customer.deals.length,1);
assert.equal(customer.timeline.length,3);
assert.equal(customer.consents.length,1);
assert(customer.history.some(row=>row.action==='CREATE'&&row.record_id===contact.id));
const vehicle=core.create(tenant,sales,'vehicles',{name:'Verified inventory vehicle',stock_number:'STOCK-101'}),inventoryRelation=core.create(tenant,sales,'inventory_relations',{inventory_id:vehicle.id,contact_id:contact.id,match_score:91,reasons:['expliciete productinteresse']});
const customerMatches=core.inventoryCustomerMatches(tenant,sales,vehicle.id);assert.equal(customerMatches.inventory.id,vehicle.id);assert.equal(customerMatches.items.length,1);assert.equal(customerMatches.items[0].customer.id,contact.id);assert.equal(customerMatches.items[0].relation.id,inventoryRelation.id);assert.equal(customerMatches.items[0].inference,'explicit_persisted_inventory_relation');assert.equal(customerMatches.no_fake_data,true);
assert.throws(()=>core.inventoryCustomerMatches(otherTenant,admin,vehicle.id),error=>error.code==='crm_inventory_not_found','inventory matches must remain tenant isolated');

const automation=core.create(tenant,admin,'automations',{name:'Stage follow-up',enabled:true,trigger:{type:'stage_change',conditions:{stage_id:stageQualified.id}},actions:[{type:'task',title:'Qualified lead follow-up'},{type:'email',template_id:'qualified'}]});
const moved=core.moveDeal(tenant,admin,deal.id,stageQualified.id,{idempotencyKey:'deal-stage-move-0001',eventId:'event-stage-change-0001'});
assert.equal(moved.stage_id,stageQualified.id);assert.equal(moved.probability,55);
const executions=core.list(tenant,admin,'automation_executions',{limit:20}).items;
assert.equal(executions.length,1);assert.equal(executions[0].automation_id,automation.id);
assert(executions[0].actions.some(action=>action.status==='EXECUTED_INTERNAL'));
assert(executions[0].actions.some(action=>action.status==='AWAITING_EXPLICIT_AUTHORIZATION'&&action.external_write===false),'external automation writes must remain gated');
assert(core.list(tenant,admin,'tasks',{limit:50}).items.some(task=>task.automation_id===automation.id));
const automationReplay=core.evaluateAutomations(tenant,admin,{id:'event-stage-change-0001',type:'stage_change',entity:'deals',record_id:deal.id,after:{stage_id:stageQualified.id}});
assert.equal(automationReplay.replayed,true);

const board=core.pipelineBoard(tenant,admin,pipeline.id);
assert.equal(board.stages.length,2);assert.equal(board.stages[1].deals.length,1);assert.equal(board.stages[1].value,85000);
const priority=core.priorityLeads(tenant,sales,{limit:5});assert.equal(priority.total,1);assert(priority.items[0].priority_score>70);assert.equal(priority.items[0].inference,'deterministic_from_persisted_crm_fields');
const analytics=core.analytics(tenant,admin,{});assert.equal(analytics.metrics.leads.value,1);assert.equal(analytics.metrics.pipeline_value.value,85000);assert.equal(analytics.metrics.forecast.value,46750);assert.equal(analytics.source_performance[0].source_id,'website');
const filtered=core.analytics(tenant,admin,{filters:{owner_id:'sales-1',unsafe_filter:'ignored'}});assert.equal(filtered.metrics.leads.value,1);assert.deepEqual(filtered.filters,{owner_id:'sales-1'});assert.equal(filtered.metrics.my_pipeline.value,0,'personal metrics must remain scoped to the active principal');
const compared=core.analyticsWithComparison(tenant,admin,{from:'2026-09-01T00:00:00Z',to:'2026-09-05T23:59:59Z',compare:true});assert.equal(compared.comparison.available,true);assert.equal(compared.comparison.metrics.leads.absolute_delta,1);assert.equal(compared.comparison.source,'foundly_crm_persisted_records');

const dashboard=core.saveDashboard(tenant,sales,{name:'My sales cockpit',is_default:true,share_mode:'TEAM',team_id:'team-1',widgets:[{id:'lead-kpi',type:'KPI',metric:'leads',x:0,y:0,w:4,h:2},{id:'pipeline-board',type:'PIPELINE',metric:'pipeline',x:0,y:2,w:12,h:4}]},{idempotencyKey:'dashboard-save-0001'});
assert.equal(core.dashboard(tenant,sales,{}).id,dashboard.id);assert.equal(dashboard.widgets.length,2);
assert.equal(core.dashboard(tenant,sales,{preset:'MARKETING',forcePreset:true}).preset,'MARKETING','explicit preset switching must not be shadowed by the saved default');
assert.throws(()=>core.saveDashboard(tenant,viewer,{name:'Cross-team dashboard',share_mode:'TEAM',team_id:'team-1',widgets:[]}),error=>error.code==='crm_forbidden');
const secondDashboard=core.saveDashboard(tenant,sales,{name:'Personal default',is_default:true,share_mode:'PRIVATE',widgets:[{id:'my-leads',type:'KPI',metric:'my_leads',x:0,y:0,w:4,h:2}]});assert.equal(secondDashboard.is_default,true);assert.equal(core.get(tenant,sales,'dashboard_views',dashboard.id).is_default,false,'only one personal default dashboard may remain active');
const activityBefore=core.activityVersion(tenant,sales);
const updated=core.update(tenant,sales,'contacts',contact.id,{phone:'+31 6 12345678'},{expectedRevision:contact.revision,idempotencyKey:'contact-update-0001'});assert.equal(updated.revision,2);
assert.throws(()=>core.update(tenant,sales,'contacts',contact.id,{phone:'+31 6 87654321'},{expectedRevision:1}),error=>error.code==='crm_revision_conflict');
const activityAfter=core.activityVersion(tenant,sales);assert.notEqual(activityAfter.change_token,activityBefore.change_token);assert(activityAfter.changes>activityBefore.changes);

const exported=core.export(tenant,admin,'contacts');assert.equal(exported.count,1);assert.equal(exported.no_secrets,true);
const removed=core.remove(tenant,admin,'contacts',contact.id,{idempotencyKey:'contact-delete-0001'});assert.equal(removed.ok,true);assert.throws(()=>core.get(tenant,admin,'contacts',contact.id),error=>error.code==='crm_record_not_found');
const assigned=core.create(tenant,sales,'contacts',{name:'Assigned disposable'});assert.equal(core.remove(tenant,sales,'contacts',assigned.id,{idempotencyKey:'assigned-delete-0001'}).ok,true,'sales may archive an assigned record');
assert(core.list(tenant,admin,'audit_events',{limit:200}).total>=15,'every material mutation must be audited');
assert(events.some(row=>row.event.type==='crm.record.created'));assert(events.some(row=>row.event.type==='crm.automation.evaluated'));
assert(persisted>10);

console.log(JSON.stringify({ok:true,crm_core:'pass',entities:Object.keys(ENTITY_DEFINITIONS).length,tenant_isolation:'pass',rbac:'pass',customer_360:'pass',inventory_customer_matches:'pass',pipelines:'pass',analytics_real_data:'pass',analytics_filters_comparison:'pass',dashboard_builder:'pass',dashboard_sharing_defaults:'pass',audited_live_change_token:'pass',automation_external_write_gate:'pass',auto_provisioner_contract:'pass',idempotency:'pass',audit:'pass'},null,2));
