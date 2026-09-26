'use strict';

const L=require('./demo-universe-law');
const DAY=86400000;
// These are fictional examples of named product families, not specifications,
// provider listings, valuations, registration records or external knowledge.
const FAMILIES=Object.freeze([
  ['Volkswagen','Golf',2600000],['Volkswagen','Tiguan',3900000],
  ['Audi','A4',3500000],['Audi','Q5',4800000],
  ['BMW','3 Series',3700000],['BMW','X3',4900000],
  ['Mercedes-Benz','C-Class',4000000],['Mercedes-Benz','GLC',5100000],
  ['Porsche','911',11000000],['Porsche','Cayenne',7800000],
  ['Ferrari','Roma',19000000],['Bentley','Continental GT',14500000],
  ['Land Rover','Range Rover',9000000],['Toyota','Corolla',2300000],
  ['Volvo','XC60',4400000],['Škoda','Octavia',2700000]
]);
function build({seed,as_of,vehicle_count=200,history_months=18}={}){
  if(typeof seed!=='string'||!/^[A-Za-z0-9_.:-]{1,120}$/.test(seed)||typeof as_of!=='string'||!Number.isFinite(Date.parse(as_of))||new Date(as_of).toISOString()!==as_of||!Number.isSafeInteger(vehicle_count)||vehicle_count<150||vehicle_count>300||!Number.isSafeInteger(history_months)||history_months<12||history_months>24)throw Object.assign(Error('automotive_demo_options_invalid'),{code:'automotive_demo_options_invalid',statusCode:422});
  const end=Date.parse(as_of),startDate=new Date(end);startDate.setUTCMonth(startDate.getUTCMonth()-history_months);const start=startDate.getTime(),span=Math.floor((end-start)/DAY),stamp=days=>new Date(start+days*DAY).toISOString(),scenario_id='automotive-'+L.hash({seed,as_of,vehicle_count,history_months}).slice(0,24),label=text=>L.LABEL+' '+text,ref=id=>({$ref:id}),number=(tag,max)=>parseInt(L.hash({seed,tag}).slice(0,8),16)%max;
  const locations=['Noord','Midden','Zuid'].map((name,i)=>({id:'location-'+i,name:label('Foundly Demo '+name),country:'NL',timezone:'Europe/Amsterdam',classification:'SYNTHETIC_DEMO'}));
  const personas=locations.flatMap((location,i)=>['MANAGER','SALES','VIEWER'].map((role,j)=>({id:'persona-'+i+'-'+j,name:label(location.name.slice(L.LABEL.length+1)+' '+role),role,location_id:location.id,classification:'SYNTHETIC_DEMO'})));
  const nodes=[],byId=new Map(),node=(id,kind,contract,module,entity,day,input,extra={})=>{
    const depends_on=[...new Set([...L.references(input),...(extra.depends_on||[])])],row={id,kind,contract,module,entity,occurred_at:stamp(day),location_id:extra.location_id||locations[0].id,persona_id:extra.persona_id||personas[0].id,input,depends_on,provenance:L.provenance(scenario_id,id)};nodes.push(row);byId.set(id,row);return row;
  };
  node('company','company','crm.create','crm','companies',0,{name:label('Foundly Automotive Group'),country:'NL',website:'https://foundly-demo.example.test',description:label('Fictional multi-location dealer group; no real company registration or external provider data.')});
  for(const loc of locations)node(loc.id,'location','crm.create','crm','companies',0,{name:loc.name,parent_company_id:ref('company'),country:loc.country,timezone:loc.timezone},{location_id:loc.id});
  for(const persona of personas)node(persona.id,'identity','identity.invite','identity','members',0,{username:scenario_id+'.'+persona.id+'.demo',display_name:persona.name,roles:[persona.role],permissions:[],team_ids:[persona.location_id],confirm:true,reason:label('Explicit role-bound demo invitation; activation requires the normal enrollment contract.')},{location_id:persona.location_id,persona_id:persona.id});
  for(let i=0;i<20;i++)node('supplier-'+i,'supplier','domain.create','procurement','suppliers',0,{name:label('Supplier '+String(i+1).padStart(3,'0')),description:label('Fictional supplier; no external verification or credentials.')});
  for(let i=0;i<18;i++)node('campaign-'+i,'campaign','domain.create','marketing','campaigns',0,{title:label('Campaign '+String(i+1).padStart(2,'0')),budget_cents:120000+number('campaign-budget-'+i,180000),currency:'EUR',status:'DRAFT',description:label('Historical synthetic campaign scenario, not a running external advertising campaign.')});
  for(const loc of locations)node('calendar-'+loc.id,'calendar','domain.create','calendar','calendars',0,{name:loc.name+' agenda',timezone:loc.timezone},{location_id:loc.id});
  const vehicles=[];
  for(let i=0;i<vehicle_count;i++){
    const [make,model,base]=FAMILIES[i%FAMILIES.length],sold=i<Math.floor(vehicle_count*0.7),acquired=sold?2+number('acquired-'+i,span-100):Math.max(2,span-(i%7===0?220:20+number('stock-age-'+i,130))),soldDay=sold?Math.min(span-25,acquired+25+number('sold-'+i,45)):null,cost=base+number('cost-'+i,500000),initialAsk=cost+350000+number('ask-'+i,i===0?50000:400000),price=initialAsk-(i%9===0?550000:100000),location=locations[i%locations.length],vehicle={id:'vehicle-'+i,make,model,cost,initialAsk,price,acquired,sold,soldDay,location};vehicles.push(vehicle);
    node(vehicle.id,'vehicle','crm.create','crm','vehicles',0,{name:label(make+' '+model+' demo '+String(i+1).padStart(3,'0')),make,model,variant:'Fictional scenario specification '+(i%4+1),model_year:2021+i%5,mileage:10000+number('mileage-'+i,100000),currency:'EUR',purchase_price_cents:cost,initial_asking_price_cents:initialAsk,asking_price_cents:price,acquired_at:stamp(acquired),sold_at:sold?stamp(soldDay):null,status:sold?'SOLD':'IN_STOCK',location_id:ref(location.id),specification_verified:false,description:label('Generated asset, not a provider listing or verified vehicle specification.')},{location_id:location.id});
  }
  const customerCount=720,leadCount=1200;
  for(let i=0;i<customerCount;i++)node('customer-'+i,'customer','crm.create','crm','people',0,{name:label('Customer '+String(i+1).padStart(4,'0')),email:'customer'+String(i+1).padStart(4,'0')+'@example.test',company_id:ref('company'),country:'NL',description:label('Fictional person; reserved example address; no external contact.')},{location_id:locations[i%3].id});
  for(let i=0;i<leadCount;i++){
    const v=vehicles[i%vehicle_count],day=v.acquired+1+i%6,closed=v.sold&&i<vehicle_count,neglected=!v.sold&&i%7===0;
    node('lead-'+i,'lead','crm.create','crm','leads',day,{name:label('Vehicle enquiry '+String(i+1).padStart(4,'0')),person_id:ref('customer-'+i%customerCount),vehicle_id:ref(v.id),status:closed?'WON':neglected?'OPEN':'QUALIFIED',occurred_at:stamp(day),last_contact_at:stamp(day+(i<vehicle_count?3:2)),source:'SYNTHETIC_DEMO',campaign_id:ref('campaign-'+i%18),description:label(neglected?'Neglected enquiry: inspect its recorded age before proposing follow-up.':'Fictional enquiry linked to customer, vehicle and campaign.')},{location_id:v.location.id});
  }
  for(let i=0;i<leadCount*2;i++){
    const lead=byId.get('lead-'+i%leadCount),day=Math.round((Date.parse(lead.occurred_at)-start)/DAY)+1+Math.floor(i/leadCount),kind=i%3===0?'CALL':i%3===1?'EMAIL':'MEETING';
    node('interaction-'+i,'interaction','crm.create','crm','activities',day,{type:kind,title:label(kind+' interaction '+String(i+1).padStart(4,'0')),lead_id:ref(lead.id),person_id:ref('customer-'+i%leadCount%customerCount),occurred_at:stamp(day),description:label('Recorded synthetic '+kind.toLowerCase()+' history. No call, email or meeting was performed externally.')},{location_id:lead.location_id});
  }
  const saleIds=[],saleTotals=[],meetingSlots=new Set();
  for(let i=0;i<vehicles.length;i++){
    const v=vehicles[i],lead=byId.get('lead-'+i),leadDay=Math.round((Date.parse(lead.occurred_at)-start)/DAY),customer='customer-'+i%customerCount;
    node('purchase-'+i,'purchase','domain.create','procurement','opportunities',v.acquired,{title:label('Acquire '+v.make+' '+v.model+' '+i),supplier_id:ref('supplier-'+i%20),value_cents:v.cost,cost_cents:v.cost,currency:'EUR',status:'QUALIFIED',description:label('Synthetic purchase activity; supplier invoice and payment are separate evidence.'),industry_fields:{vin:'DEMO-'+String(i).padStart(8,'0'),registration:'DEMO-'+i,mileage:10000+number('mileage-'+i,100000)}});
    node('document-'+i,'document','domain.create','procurement','documents',v.acquired,{name:label('Purchase evidence '+i),content:label('Fictional purchase record for '+v.make+' '+v.model+'. Cost EUR '+(v.cost/100).toFixed(2)+'. Not a supplier invoice or proof of payment.'),related_refs:[{module:'crm',entity:'vehicles',id:ref(v.id)}]});
    node('price-'+i,'price_change','crm.create','crm','activities',Math.min(span,v.acquired+20),{type:'PRICE_CHANGE',title:label('Price adjustment '+i),vehicle_id:ref(v.id),occurred_at:stamp(Math.min(span,v.acquired+20)),previous_price_cents:v.initialAsk,current_price_cents:v.price,currency:'EUR',description:label('Scenario price change; no market valuation or external listing update.')});
    const meetDay=leadDay+3;let meetingTime=start+meetDay*DAY+(9+(i%8))*3600000;while(meetingSlots.has(v.location.id+':'+meetingTime))meetingTime+=1800000;meetingSlots.add(v.location.id+':'+meetingTime);
    node('meeting-'+i,'meeting','domain.create','calendar','events',meetDay,{title:label('Vehicle consultation '+i),start_at:new Date(meetingTime).toISOString(),end_at:new Date(meetingTime+1800000).toISOString(),timezone:'Europe/Amsterdam',calendar_id:ref('calendar-'+v.location.id),participants:['customer'+String(i%customerCount+1).padStart(4,'0')+'@example.test'],status:'COMPLETED',description:label('Synthetic meeting history for '+v.make+' '+v.model+'.')},{location_id:v.location.id,depends_on:[lead.id]});
    if(v.sold){
      const sale='sale-'+i;saleIds.push(sale);saleTotals.push(v.price);
      node(sale,'sale','domain.create','sales','opportunities',v.soldDay,{title:label('Sale '+v.make+' '+v.model+' '+i),status:'WON',value_cents:v.price,cost_cents:v.cost,currency:'EUR',probability:1,closed_date:stamp(v.soldDay).slice(0,10),industry_fields:{vehicle_id:ref(v.id)},related_refs:[{module:'crm',entity:'people',id:ref(customer)},{module:'crm',entity:'leads',id:ref(lead.id)}],description:label('Synthetic closed sale; financial posting and customer payment are independent records.')},{location_id:v.location.id,depends_on:['purchase-'+i]});
    }
    if(!v.sold&&i%3===0){node('followup-'+i,'task','crm.create','crm','tasks',span,{title:label('Review stock and unanswered enquiry '+i),lead_id:ref(lead.id),vehicle_id:ref(v.id),due_at:new Date(end+DAY).toISOString(),status:'OPEN',description:label('Internal follow-up proposal; customer contact needs separate explicit authorization.')});node('draft-'+i,'communication_draft','domain.create','communication','drafts',span,{title:label('Follow-up draft '+i),content:label('Fictional follow-up for the enquiry about '+v.make+' '+v.model+'. This draft has not been sent.'),to:['customer'+String(i%customerCount+1).padStart(4,'0')+'@example.test'],cc:[]},{depends_on:[lead.id]});}
  }
  for(let i=0;i<8;i++)node('template-'+i,'communication_template','domain.create','communication','templates',0,{title:label('Demo communication template '+i),content:label('Internal reusable scenario text. External sending is a separate governed action.')});
  node('context-policy','zero_context','memory.create','knowledge','memories',span,{layer:'ORGANIZATION',key:scenario_id+'-provenance',text:label('This universe is synthetic. Read current authorized native records for amounts, stock, contacts and actions. Never claim provider connections, real people, actual messages sent or actual payments. Scenario time is '+as_of+'. Native audit time is separate.'),roles:['ADMIN','FOUNDER','SUPER_ADMIN','MANAGER','SALES','VIEWER'],capabilities:[],sensitivity:'INTERNAL',confidence:null});
  const old=vehicles.find(v=>!v.sold&&span-v.acquired>180),loss=vehicles.find(v=>v.price<v.cost),sources=saleIds.length?saleIds:[vehicles[0].id];
  const scenarios=[
    {id:'cross-module-sale',kind:'NORMAL',description:label('Trace customer, lead, asset, supplier acquisition, interactions and closed sale.'),source_ids:['customer-0','lead-0','vehicle-0','purchase-0','interaction-0','sale-0'],expectations:{currency:'EUR',value_cents:vehicles[0].price,cost_cents:vehicles[0].cost,gross_margin_cents:vehicles[0].price-vehicles[0].cost,external_payment_proven:false}},
    {id:'aging-stock',kind:'ANOMALY',description:label('Identify retained inventory older than 180 days without inventing a live valuation.'),source_ids:[old.id,'purchase-'+vehicles.indexOf(old)],expectations:{as_of,minimum_days:181,external_valuation_available:false}},
    {id:'margin-pressure',kind:'ANOMALY',description:label('Explain a price decrease below recorded purchase cost, with exact integer amounts.'),source_ids:[loss?.id||vehicles[0].id,'price-'+vehicles.indexOf(loss||vehicles[0])],expectations:{currency:'EUR',amounts_are_estimates_of_a_fictional_scenario:true}},
    {id:'disabled-module',kind:'OPERATIONAL_FAILURE',description:label('Disable a relevant module through normal composition and verify current ZERO/record denial without deleting data.'),source_ids:['vehicle-0','sale-0'],expectations:{permissions_bypassed:false,data_deleted:false}},
    {id:'unavailable-provider',kind:'OPERATIONAL_FAILURE',description:label('A missing provider connection stays unavailable and does not turn synthetic stock into live listings.'),source_ids:['vehicle-0'],expectations:{provider_verified:false,live_provider_evidence:false}},
    {id:'lost-seed-response',kind:'OPERATIONAL_FAILURE',description:label('Recover retained seed receipts after a lost response without duplicate native objects.'),source_ids:['company','vehicle-0','lead-0'],expectations:{duplicates:0,requires_explicit_resume:true}}
  ];
  const body={schema_version:L.VERSION,scenario_id,seed,as_of,history_start:stamp(0),industry_id:'AUTOMOTIVE',company:{name:label('Foundly Automotive Group'),classification:'SYNTHETIC_DEMO'},locations,personas,nodes,scenarios,derived:[{id:'synthetic-sales-total',classification:'DERIVED_ESTIMATED',metric:'sale_value_cents',value:saleTotals.reduce((a,b)=>a+b,0),currency:'EUR',period_start:stamp(0),period_end:as_of,source_ids:sources,formula:'SUM(source sales opportunities.value_cents); not recognized revenue or received cash'}]};
  return L.seal(body);
}
function assess(manifest){const proof=L.validate(manifest),c=proof.counts,days=(Date.parse(manifest.as_of)-Date.parse(manifest.history_start))/DAY;return {...proof,automotive_depth_met:manifest.industry_id==='AUTOMOTIVE'&&c.vehicle>=150&&c.vehicle<=300&&(c.customer||0)+(c.lead||0)+(c.interaction||0)>=2000&&days>=365&&days<=732&&manifest.locations.length>=2,full_acceptance:false,remaining:['Production seed execution and recovery','Financial/workflow/approval/event histories and failure execution','Structured verified Automotive knowledge','ZERO end-to-end scenario evidence','Desktop, iPhone and Android acceptance']};}
module.exports={build,assess,FAMILIES};
