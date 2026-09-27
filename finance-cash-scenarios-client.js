'use strict';
(function(root){
 function create({document,request,forecastId,isActive=()=>true}){
  const i18n=root.FoundlyI18n,localErrors=new WeakMap();
  const copy=(key,fallback,params={})=>i18n?.message?i18n.message('finance.cash.'+key,params):fallback;
  const write=(node,value)=>i18n?.renderText?i18n.renderText(node,value):(node.textContent=String(value??''),node);
  const el=(tag,text='')=>{const node=document.createElement(tag);if(i18n?.renderText)i18n.renderText(node,text);else node.textContent=String(text);return node;};
  const money=(value,currency)=>i18n?.currencyCents?Object.freeze({toString:()=>i18n.currencyCents(value,currency)}):new Intl.NumberFormat('nl-NL',{style:'currency',currency}).format(value/100);
  const number=value=>i18n?Object.freeze({toString:()=>i18n.number(value)}):value;
  const recommendations=new Set(['POSSIBLE_CASH_SHORTFALL','NONNEGATIVE_ASSUMPTIONS','RECORDED_BELOW_PLAN','RECORDED_AT_OR_ABOVE_PLAN']);
  const recommendation=(code,text)=>recommendations.has(code)?copy(code.toLowerCase(),text):text;
  const reasons=new Set(['WINDOW_NOT_STARTED','NO_CASH_ACCOUNTS','AMBIGUOUS_CASH_ACCOUNTS','AMBIGUOUS_LEDGER','SOURCE_CAPACITY','INVALID_AMOUNTS','UNBALANCED_LEDGER','NO_RECORDED_MOVEMENTS','SOURCE_UNVERIFIABLE']);
  const errorKeys={finance_scenario_amount_invalid:'invalid',finance_scenario_horizon_invalid:'horizon_invalid',finance_scenario_source_changed:'source_changed',finance_scenario_source_unavailable:'source_unavailable',finance_scenario_entity_unavailable:'entity_unavailable',finance_scenario_entries_invalid:'entries_invalid',finance_scenario_invalid:'input_invalid',finance_scenario_capacity:'source_capacity',finance_scenario_overflow:'overflow',finance_scenario_source_invalid:'source_invalid'};
  const reason=observed=>observed?.reason_code==='DUPLICATE_LINES'&&i18n?.message?i18n.message('finance.close.duplicate_lines'):reasons.has(observed?.reason_code)?copy(observed.reason_code.toLowerCase(),observed.reason):observed?.reason||copy('unavailable','Geen bewezen kasuitkomst beschikbaar');
  const box=el('section'),out=el('output'),form=el('div'),result=el('div');out.setAttribute('role','status');box.append(el('h3',copy('title','Kasplanning: scenario vergelijken')),el('p',copy('scope','Vergelijk expliciete aannames met één actuele kasplanning. Dit wijzigt geen brongegevens en voert geen financiële actie uit.')),form,out,result);
  const field=(label,value)=>{const l=el('label',label),n=el('input');n.value=String(value);l.append(n);form.append(l);return n;};
  let source=null,busy=false,dirty=false,serial=0;const active=()=>box.isConnected&&isActive();
  function showError(error){if(!active())return;result.replaceChildren();const code=error.code||error.data?.code,key=Object.hasOwn(errorKeys,code)?errorKeys[code]:null;write(out,localErrors.get(error)||(key?copy(key,error.message):i18n?.errorKey?i18n.message(i18n.errorKey(error.code||error.data?.code,error.status)):error.message));}
  function button(host,title,fn){const b=el('button',title);b.type='button';b.addEventListener('click',async()=>{if(busy||!active())return;busy=true;box.inert=true;try{await fn();}catch(error){showError(error);}finally{busy=false;box.inert=false;}});host.append(b);return b;}
  form.addEventListener('input',()=>{serial++;dirty=true;result.replaceChildren();write(out,copy('changed','Scenario-invoer gewijzigd; bereken opnieuw.'));});
  async function load(){
   const at=++serial;source=null;form.replaceChildren();result.replaceChildren();
   const data=await request('/api/finance/forecast-scenarios',{method:'POST',body:JSON.stringify({forecast_id:forecastId})});if(!active()||at!==serial)return;source=data;
   const rows=[...data.baseline.entries,...data.baseline.excluded_entries].sort((a,b)=>a.entry_index-b.entry_index);
   if(rows.length>200){write(out,copy('too_many','Deze bron heeft meer dan 200 regels. De volledige vergelijking is beschikbaar via de scenario-API; de editor toont geen gedeeltelijk plan.'));return;}
   const opening=field(copy('opening','Scenario beginsaldo in centen'),data.baseline.opening_cash_cents),horizon=field(copy('horizon','Scenario horizon in hele dagen'),data.baseline.horizon_days);opening.type=horizon.type='number';opening.step=horizon.step='1';horizon.min='1';horizon.max='730';
   const editors=rows.map(row=>{const index=row.entry_index+1,date=field(copy('entry_date','Datum bronregel '+index,{number:number(index)}),row.date),amount=field(copy('entry_amount','Bedrag bronregel '+index+' in centen',{number:number(index)}),row.amount_cents);amount.type='number';amount.step='1';return {row,date,amount};});
   write(out,copy('loaded','Actuele bron geladen. Bedragen buiten het venster tellen niet mee.'));
   button(form,copy('calculate','Scenario berekenen'),async()=>{
    const at=serial,numeric=input=>input.value.trim()?Number(input.value):NaN,changes={opening_cash_cents:numeric(opening),horizon_days:numeric(horizon),entries:editors.filter(e=>e.date.value!==e.row.date||numeric(e.amount)!==e.row.amount_cents).map(e=>({entry_index:e.row.entry_index,date:e.date.value,amount_cents:numeric(e.amount)}))};
    if(!Number.isSafeInteger(changes.opening_cash_cents)||!Number.isSafeInteger(changes.horizon_days)||changes.entries.some(e=>!Number.isSafeInteger(e.amount_cents))){const message=copy('invalid','Gebruik volledige gehele bedragen in centen en een hele horizon.'),error=Error(String(message));localErrors.set(error,message);throw error;}
    if(changes.horizon_days<1||changes.horizon_days>730){const message=copy('horizon_invalid','Kies 1 tot 730 hele dagen.'),error=Error(String(message));localErrors.set(error,message);throw error;}
    const data=await request('/api/finance/forecast-scenarios',{method:'POST',body:JSON.stringify({forecast_id:forecastId,expected_source_hash:source.source_hash,changes})});if(!active()||at!==serial)return;
    const amounts=[['baseline','Basis eindsaldo: ',data.baseline.closing_cash_cents],['scenario','Scenario eindsaldo: ',data.scenario.closing_cash_cents],['delta','Verschil: ',data.delta_closing_cents],['lowest','Laagste berekende saldo: ',data.scenario.lowest_cash_cents]];
    result.replaceChildren(...amounts.map(([key,label,value])=>el('p',copy(key,label+money(value,data.currency),{amount:money(value,data.currency)}))),el('p',copy('excluded','Niet meegetelde regels buiten het venster: '+data.scenario.excluded_entry_count,{count:data.scenario.excluded_entry_count})),el('p',recommendation(data.recommendation_code,data.recommendation)));
    const observed=data.recorded_outcome;
    if(observed?.available){const actual=money(observed.recorded_net_cents,data.currency),planned=money(observed.planned_net_cents,data.currency),variance=money(observed.variance_cents,data.currency);result.append(el('p',copy('recorded','Vastgelegde kasbeweging: '+actual+'; planning tot hetzelfde moment: '+planned+'; afwijking: '+variance,{actual,planned,variance})),el('p',recommendation(observed.recommendation_code,observed.recommendation)),el('p',copy('sources','Bronboekingen: '+observed.source_entry_ids.join(', '),{ids:observed.source_entry_ids.join(', ')})),el('p',copy('recorded_scope','Alleen vastgelegde administratie; volledigheid, provideruitkomst en causaliteit zijn niet bewezen.')));}
    else result.append(el('p',reason(observed)));
    write(out,copy('hypothetical','Hypothetische vergelijking; brongegevens en financiële administratie zijn ongewijzigd.'));
   });
  }
  button(box,copy('reset','Scenario-invoer wissen'),async()=>{dirty=false;await load();});
  box.canLeave=()=>{if(busy||dirty){write(out,copy('clear_first','Wis eerst de scenario-invoer voordat je een andere selectie laadt.'));return false;}return true;};
  box.ready=load().catch(showError);return box;
 }
 root.FoundlyFinanceCashScenarios={create};
})(globalThis);
