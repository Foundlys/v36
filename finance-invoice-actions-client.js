'use strict';
(function(root){
 const OPERATIONS=['INVOICE_POST','INVOICE_APPROVE','PAYMENT_RECORD','CREDIT_NOTE_CREATE','CREDIT_ALLOCATE','CREDIT_REFUND_RECORD'];
 const clone=value=>JSON.parse(JSON.stringify(value));
 const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
 const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
 function cents(value,allowZero=false){
  if(typeof value!=='string'||!/^\d{1,14}(?:[.,]\d{1,2})?$/.test(value.trim()))throw Object.assign(Error('amount'),{localKey:'invalid_amount'});
  const [whole,fraction='']=value.trim().split(/[.,]/),amount=BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0'));
  if(amount<(allowZero?0n:1n)||amount>BigInt(Number.MAX_SAFE_INTEGER))throw Object.assign(Error('amount'),{localKey:'invalid_amount'});
  return Number(amount);
 }
 function create({document,request,isActive=()=>true,operations=[],invoiceCreation=false,commerceCreation=false,onComplete=null}){
  const creating=invoiceCreation||commerceCreation,i18n=root.FoundlyI18n,allowed=(commerceCreation?['COMMERCE_INVOICE_CREATE']:invoiceCreation?['INVOICE_CREATE']:OPERATIONS).filter(operation=>operations.includes(operation));
  const copy=(key,params={})=>i18n.message('finance.actions.'+key,params),write=(node,value)=>i18n.renderText(node,value);
  const el=(tag,value)=>{const node=document.createElement(tag);if(value!==undefined)write(node,value);return node;};
  const live=read=>Object.freeze({toString:read}),money=(amount,currency)=>live(()=>Number.isSafeInteger(amount)&&/^[A-Z]{3}$/.test(currency)?i18n.currencyCents(amount,currency):i18n.t('common.unknown'));
  const statusText=status=>['DRAFT','POSTED','PARTIALLY_PAID','PAID','OVERDUE','SETTLED','PARTIALLY_SETTLED'].includes(status)?copy('status_'+status.toLowerCase()):i18n.message('common.unknown');
  const documentStatus=row=>row.kind==='PURCHASE'?copy('purchase_status',{status:statusText(row.status),approval:copy(row.approval_status==='APPROVED'?'approval_approved':'approval_pending')}):statusText(row.status);
  const box=el(creating?'details':'section'),fields=el('div'),buttons=el('div'),notice=el('output'),reviewBox=el('div'),resultBox=el('div'),pendingBox=el('div');
  box.className='finance-invoice-actions';fields.className='finance-action-fields';buttons.className='finance-action-buttons';notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');
  let busy=false,initialized=false,serial=0,dirty=false,review=null,pending=null,records=[],cursor=0,next=null,retained=[],creditSelection=null,creditInputs=[];
  const creditChoices=el('fieldset');creditChoices.hidden=true;
  const active=()=>box.isConnected&&isActive();
  const error=key=>Object.assign(Error(key),{localKey:key});
  function showError(value){if(!active())return;write(notice,copy(value.localKey||(pending?'uncertain':'failed')));}
  const inputs=[],labels={};
  function field(key,type='input'){
   const label=el('label'),caption=el('span',copy(key)),node=el(type);label.append(caption,node);fields.append(label);node.setAttribute('data-finance-field',key);labels[key]=label;inputs.push(node);return node;
  }
  const operation=field('operation','select'),documentSelect=field('document','select'),amount=field('amount'),date=field('date'),reference=field('reference'),number=field('number'),supplyDate=field('supply_date'),dueDate=field('due_date');
  const draft=commerceCreation?commerceDraft():invoiceCreation?invoiceDraft():null,reason=field('reason'),confirm=field('confirm');
  amount.inputMode='decimal';date.type=supplyDate.type=dueDate.type='date';reference.maxLength=240;number.maxLength=60;reason.maxLength=500;confirm.type='checkbox';
  const choose=()=>{const node=el('option',copy('choose_document'));node.value='';return node;};
  for(const name of allowed){const option=el('option',copy('operation_'+name.toLowerCase()));option.value=name;operation.append(option);}operation.value=allowed[0]||'';
  documentSelect.append(choose());
  const source=()=>records.find(row=>row.id===(draft?draft.entity.value:documentSelect.value));
  function commerceDraft(){
   const entity=field('legal_entity','select'),pickers={};let locked=true;
   entity.addEventListener('change',invalidate);
   for(const key of ['order','contact']){
    const select=field(key,'select'),query=field(key+'_query'),pager=el('div'),coverage=el('output'),detail=el('p'),picker={select,query,rows:[],cursor:0,next:null,filter:'',buttons:{}};pickers[key]=picker;query.maxLength=100;pager.className='finance-action-buttons';coverage.setAttribute('aria-live','polite');fields.append(pager,coverage,detail);
    const chosen=()=>picker.rows.find(row=>row.id===select.value);
    function describe(){const row=chosen();write(detail,row?key==='order'?copy('order_reference',{reference:row.customer_reference}):copy('contact_address',{address:row.billing_address||row.address||i18n.message('common.unknown')}):'');}
    select.addEventListener('change',()=>{describe();invalidate();});query.addEventListener('input',invalidate);
    picker.read=async(at=0,filter='')=>{
     const token=serial,path=key==='order'?'/api/sales/commerce/commerce_orders?limit=50&offset=':'/api/crm/contacts?limit=50&cursor=',data=await request(path+at+'&q='+encodeURIComponent(filter));if(!active()||token!==serial)return;
     const pageNext=key==='order'?data?.next_offset:data?.next_cursor,n=pageNext===null?null:Number(pageNext);
     if(!Array.isArray(data?.items)||data.items.length>50||!Number.isSafeInteger(data.total)||data.total<0||n!==null&&(!Number.isSafeInteger(n)||n<=at)||data.items.some(row=>typeof row.id!=='string')||new Set(data.items.map(row=>row.id)).size!==data.items.length)throw error('invalid_result');
     picker.rows=data.items;picker.cursor=at;picker.next=n;picker.filter=filter;query.value=filter;select.value='';const placeholder=el('option',copy('choose_'+key));placeholder.value='';select.replaceChildren(placeholder);
     for(const row of picker.rows){const option=el('option',key==='order'?copy('order_option',{id:row.id,amount:money(row.totals?.gross_minor,row.currency),state:copy(row.invoice_id||row.financial_status!=='UNPOSTED'?'order_linked':['RESERVED','FULFILLED'].includes(row.status)?'order_available':'order_unavailable')}):copy('contact_option',{name:row.name,id:row.id}));option.value=row.id;select.append(option);}
     describe();write(coverage,copy(key+'_page',{start:i18n.number(data.items.length?at+1:0),end:i18n.number(at+data.items.length),total:i18n.number(data.total)}));
    };
    for(const action of ['search','previous','next']){
     const node=el('button',copy(action==='search'?'search':action));node.type='button';node.setAttribute('data-finance-action',key+'_'+action);pager.append(node);picker.buttons[action]=node;
     node.addEventListener('click',async()=>{if(locked||busy||!active())return;ensureEditable();if(action==='previous'&&picker.cursor===0||action==='next'&&picker.next===null)return;busy=true;invalidate();try{await picker.read(action==='search'?0:action==='previous'?Math.max(0,picker.cursor-50):picker.next,action==='search'?query.value.trim():picker.filter);}catch(value){showError(value);}finally{busy=false;controls();}});
    }
    picker.chosen=chosen;picker.describe=describe;
   }
   return{entity,lock(value){locked=value;for(const p of Object.values(pickers)){p.buttons.search.disabled=value;p.buttons.previous.disabled=value||p.cursor===0;p.buttons.next.disabled=value||p.next===null;}},
    async load(){const results=await Promise.allSettled(Object.values(pickers).map(p=>p.read()));const failed=results.find(result=>result.status==='rejected');if(failed)throw failed.reason;},clear(){for(const p of Object.values(pickers)){p.query.value='';p.select.value='';p.describe();}},
    restore(value){if(Object.keys(value).some(key=>!['order_id','contact_id','legal_entity_id','invoice_number','invoice_date','supply_date','due_date','series'].includes(key))||value.series&&value.series!=='SALES')return false;entity.value=records.some(row=>row.id===value.legal_entity_id)?value.legal_entity_id:'';number.value=value.invoice_number;date.value=value.invoice_date;supplyDate.value=value.supply_date;dueDate.value=value.due_date;for(const[key,p]of Object.entries(pickers)){p.select.value=p.rows.some(row=>row.id===value[key+'_id'])?value[key+'_id']:'';p.describe();}return true;},
    values(){const selected=source(),order=pickers.order.chosen(),contact=pickers.contact.chosen();if(!selected||!order||!contact||!number.value.trim()||!date.value||!supplyDate.value||!dueDate.value)throw error('commerce_fields');return{legal_entity_id:selected.id,order_id:order.id,contact_id:contact.id,invoice_number:number.value.trim(),invoice_date:date.value,supply_date:supplyDate.value,due_date:dueDate.value};}
   };
  }
  function invoiceDraft(){
   const entity=field('legal_entity','select'),kind=field('invoice_kind','select'),parties={},lineBox=el('div'),rows=[];let nextId=0,locked=true;
   for(const value of ['SALES','PURCHASE']){const option=el('option',copy('kind_'+value.toLowerCase()));option.value=value;kind.append(option);}kind.value='SALES';
   for(const [key,max]of Object.entries({supplier_name:200,supplier_address:500,supplier_vat_id:40,supplier_kvk_number:20,customer_name:200,customer_address:500})){const node=field(key);node.maxLength=max;parties[key]=node;node.addEventListener('input',invalidate);}
   lineBox.className='finance-invoice-lines';fields.append(lineBox);
   const own=el('button',copy('fill_business')),add=el('button',copy('add_line'));own.type=add.type='button';own.setAttribute('data-finance-action','fill_business');add.setAttribute('data-finance-action','add_line');
   own.addEventListener('click',()=>{if(locked||!active())return;const row=source();if(!row)return;const prefix=kind.value==='PURCHASE'?'customer_':'supplier_';for(const [key,value]of Object.entries({name:row.name,address:row.address,...(prefix==='supplier_'?{vat_id:row.vat_id,kvk_number:row.kvk_number}:{})}))parties[prefix+key].value=value||'';invalidate();});
   function line(invalidateAfter=true){
    if(rows.length>=50)return;const host=el('fieldset'),nodes={},id=nextId++;host.setAttribute('data-finance-line',String(id));host.className='finance-action-fields';host.append(el('legend',copy('invoice_line')));
    for(const key of ['description','quantity','unit_price','tax_rate']){const label=el('label'),node=el('input');label.append(el('span',copy('line_'+key)),node);host.append(label);node.setAttribute('data-finance-line-field',key);node.maxLength=key==='description'?500:24;if(key!=='description')node.inputMode='decimal';node.addEventListener('input',invalidate);inputs.push(node);nodes[key]=node;}
    nodes.quantity.value='1';const remove=el('button',copy('remove_line'));remove.type='button';remove.setAttribute('data-finance-action','remove_line');host.append(remove);const row={host,nodes,remove};rows.push(row);lineBox.append(host);
    remove.addEventListener('click',()=>{if(locked||rows.length<2||!active())return;rows.splice(rows.indexOf(row),1);for(const node of Object.values(nodes))inputs.splice(inputs.indexOf(node),1);lineBox.replaceChildren(...rows.map(row=>row.host));invalidate();});if(invalidateAfter)invalidate();return row;
   }
   add.addEventListener('click',()=>{if(!locked&&active())line();});fields.append(own,add);entity.addEventListener('change',invalidate);kind.addEventListener('change',invalidate);line(false);
   function decimal(value,positive){const text=value.trim().replace(',','.');if(!/^\d{1,9}(?:\.\d{1,6})?$/.test(text)||!Number.isFinite(Number(text))||Number(text)<(positive?Number.MIN_VALUE:0))throw error('invalid_line');return text;}
   return{entity,kind,parties,lock(value){locked=value;own.disabled=value;add.disabled=value||rows.length>=50;for(const row of rows)row.remove.disabled=value||rows.length<2;},
    clear(){for(const node of Object.values(parties))node.value='';for(const row of rows)for(const node of Object.values(row.nodes))inputs.splice(inputs.indexOf(node),1);rows.length=0;lineBox.replaceChildren();kind.value='SALES';line(false);},
    restore(value){
     if(!['SALES','PURCHASE'].includes(value.kind)||!Array.isArray(value.lines)||!value.lines.length||value.lines.length>50||Object.keys(value).some(key=>!['legal_entity_id','kind','currency','invoice_number','invoice_date','supply_date','due_date','lines',...Object.keys(parties)].includes(key))||value.lines.some(row=>Object.keys(row).some(key=>!['description','quantity','unit_price_cents','vat_rate'].includes(key))||!Number.isSafeInteger(row.unit_price_cents)||row.unit_price_cents<0))return false;
     this.clear();entity.value=records.some(row=>row.id===value.legal_entity_id)?value.legal_entity_id:'';kind.value=value.kind;number.value=value.invoice_number;date.value=value.invoice_date;supplyDate.value=value.supply_date;dueDate.value=value.due_date;for(const [key,node]of Object.entries(parties))node.value=value[key];
     value.lines.forEach((item,index)=>{const row=index?line(false):rows[0],price=BigInt(item.unit_price_cents);row.nodes.description.value=item.description;row.nodes.quantity.value=String(item.quantity);row.nodes.tax_rate.value=String(item.vat_rate);row.nodes.unit_price.value=String(price/100n)+'.'+String(price%100n).padStart(2,'0');});return true;
    },
    values(){const selected=source();if(!selected||!['SALES','PURCHASE'].includes(kind.value)||!number.value.trim()||!date.value||!supplyDate.value||!dueDate.value)throw error('create_fields');const values=Object.fromEntries(Object.entries(parties).map(([key,node])=>[key,node.value.trim()]));if(Object.values(values).some(value=>!value))throw error('create_fields');
     return{legal_entity_id:selected.id,kind:kind.value,currency:selected.currency,invoice_number:number.value.trim(),invoice_date:date.value,supply_date:supplyDate.value,due_date:dueDate.value,...values,lines:rows.map(({nodes})=>{const description=nodes.description.value.trim(),quantity=decimal(nodes.quantity.value,true),vat_rate=decimal(nodes.tax_rate.value,false);if(!description||Number(vat_rate)>100)throw error('invalid_line');return{description,quantity,unit_price_cents:cents(nodes.unit_price.value,true),vat_rate};})};}
   };
  }
  function visibility(){
   const op=operation.value,monetary=['PAYMENT_RECORD','CREDIT_ALLOCATE','CREDIT_REFUND_RECORD'].includes(op),credit=op==='CREDIT_NOTE_CREATE'||creating;
   labels.operation.hidden=labels.document.hidden=creating;
   for(const [key,visible]of Object.entries({amount:monetary,date:monetary||credit,reference:monetary,number:credit,supply_date:credit,due_date:credit}))labels[key].hidden=!visible;
  }
  function invalidate(){serial++;review=null;confirm.checked=false;reviewBox.replaceChildren();dirty=true;visibility();controls();}
  function clearCreditChoices(){creditSelection=null;creditInputs=[];creditChoices.replaceChildren();creditChoices.hidden=true;}
  for(const node of [operation,documentSelect])node.addEventListener('change',clearCreditChoices);
  for(const node of [operation,documentSelect,amount,date,reference,number,supplyDate,dueDate])node.addEventListener(node.tagName==='SELECT'||[operation,documentSelect].includes(node)?'change':'input',invalidate);
  reason.addEventListener('input',()=>{confirm.checked=false;dirty=true;controls();});confirm.addEventListener('change',controls);
  const actions={};
  function button(key,fn){
   const node=el('button',copy(key));node.type='button';node.setAttribute('data-finance-action',key);
   node.addEventListener('click',async()=>{if(busy||!active())return;busy=true;controls();try{await fn();}catch(value){showError(value);}finally{busy=false;controls();}});buttons.append(node);actions[key]=node;return node;
  }
  function controls(){
   const locked=busy||Boolean(pending)||!initialized;box.setAttribute('aria-busy',String(busy));
   for(const node of inputs)node.disabled=locked||!allowed.length;
   for(const node of creditInputs)node.disabled=locked||!allowed.length;
   draft?.lock(locked||!allowed.length);
   if(actions.preview)actions.preview.disabled=locked||!operation.value||!source();
   if(actions.submit)actions.submit.disabled=locked||!review?.ready||!confirm.checked||!reason.value.trim();
   if(actions.recover)actions.recover.disabled=busy||!pending;
   if(actions.previous)actions.previous.disabled=locked||dirty&&!draft||cursor===0;
   if(actions.next)actions.next.disabled=locked||dirty&&!draft||next===null;
  }
  function ensureEditable(){if(!initialized)throw error('load_first');if(pending)throw error('recover_first');}
  function values(){
   if(draft)return draft.values();
   const invoice=source();if(!invoice)throw error('choose_document');const op=operation.value;
   if(['INVOICE_APPROVE','INVOICE_POST'].includes(op))return{invoice_id:invoice.id};
   if(op==='CREDIT_NOTE_CREATE'){
    if(invoice.kind!=='SALES'||!number.value.trim()||!date.value||!supplyDate.value||!dueDate.value)throw error('credit_fields');
    return{invoice_id:invoice.id,invoice_number:number.value.trim(),invoice_date:date.value,supply_date:supplyDate.value,due_date:dueDate.value,...(creditSelection?{line_ids:clone(creditSelection)}:{})};
   }
   if(!date.value||!reference.value.trim())throw error('payment_fields');
   const common={amount_cents:cents(amount.value),currency:invoice.currency,date:date.value,reference:reference.value.trim()};
   if(op==='PAYMENT_RECORD'){if(invoice.kind==='CREDIT_NOTE')throw error('select_invoice');return{invoice_id:invoice.id,...common};}
   if(invoice.kind!=='CREDIT_NOTE'||typeof invoice.credits_invoice_id!=='string')throw error('select_credit');
   return{credit_note_id:invoice.id,...(op==='CREDIT_ALLOCATE'?{invoice_id:invoice.credits_invoice_id}:{}),...common};
  }
  function validCommand(value){return value&&allowed.includes(value.operation)&&value.input&&typeof value.input==='object'&&typeof value.request_id==='string'&&/^[A-Za-z0-9_.:-]{8,200}$/.test(value.request_id)&&/^[a-f0-9]{64}$/.test(value.expected_source_hash||'')&&value.confirm===true&&typeof value.reason==='string'&&value.reason.trim();}
  function verifyResult(data,command){
   if(!data||data.ok!==true||data.operation!==command.operation||data.request_id!==command.request_id||!['COMMITTED','NOT_APPLIED'].includes(data.state)||data.external_payment_performed!==false)throw error('invalid_result');
   if(data.state==='COMMITTED'){
    const original=data.original_result?.invoice,current=data.current_invoice,expected=command.operation==='CREDIT_NOTE_CREATE'?original?.credits_invoice_id:original?.id;
    const matches=command.operation==='COMMERCE_INVOICE_CREATE'?original?.legal_entity_id===command.input.legal_entity_id&&original?.kind==='SALES'&&original?.invoice_number===command.input.invoice_number&&original?.commerce_source?.order_id===command.input.order_id&&original?.commerce_source?.contact_id===command.input.contact_id&&[data.original_result?.commerce_link,data.current_result?.commerce_link].every(link=>link?.order?.id===command.input.order_id&&link?.order?.invoice_id===original.id&&link?.customer?.id===command.input.contact_id):command.operation==='INVOICE_CREATE'?original?.legal_entity_id===command.input.legal_entity_id&&original?.kind===command.input.kind&&original?.invoice_number===command.input.invoice_number&&original?.currency===command.input.currency:expected===(command.input.credit_note_id||command.input.invoice_id);
    if(!original||!current||typeof original.id!=='string'||original.id!==current.id||!same(current,data.current_result?.invoice)||!matches||!/^[a-f0-9]{64}$/.test(data.original_result_hash||'')||data.bank_settlement_verified!==false)throw error('invalid_result');
   }
  }
  function displayResult(data){
   resultBox.replaceChildren(el('h4',copy('result')));
   if(data.state==='NOT_APPLIED'){resultBox.append(el('p',copy('not_applied')));return;}
   const original=data.original_result.invoice,current=data.current_invoice;
   for(const [label,row]of [['original',original],['current',current]])resultBox.append(el('p',copy('result_row',{label:copy(label),number:row.invoice_number,status:documentStatus(row),amount:money(row.gross_cents,row.currency),open:money(row.outstanding_cents,row.currency)})));
   if(data.current_result.related_invoice){const row=data.current_result.related_invoice;resultBox.append(el('p',copy('result_row',{label:copy('related'),number:row.invoice_number,status:documentStatus(row),amount:money(row.gross_cents,row.currency),open:money(row.outstanding_cents,row.currency)})));}
   if(data.current_result.commerce_link){const link=data.current_result.commerce_link;resultBox.append(el('p',copy('commerce_link',{order:link.order.id,contact:link.customer.id})));}
   resultBox.append(el('p',copy('internal_only')));
  }
  async function listInvoices(at=0){
   const atSerial=serial,data=await request('/api/finance/records/'+(draft?'legal_entities':'invoices')+'?limit=50&cursor='+at);if(!active()||atSerial!==serial)return;
   if(!data||!Array.isArray(data.items)||!Number.isSafeInteger(data.total)||data.items.length>50)throw error('invalid_result');
   records=data.items;cursor=at;next=data.next_cursor;clearCreditChoices();const select=draft?draft.entity:documentSelect,placeholder=draft?el('option',copy('choose_entity')):choose();placeholder.value='';select.replaceChildren(placeholder);select.value='';
   for(const row of records){const option=el('option',draft?copy('entity_option',{name:row.name,currency:row.currency}):copy('document_option',{number:row.invoice_number,entity:row.kind==='PURCHASE'?row.customer_name:row.supplier_name,party:row.kind==='PURCHASE'?row.supplier_name:row.customer_name,status:documentStatus(row),amount:money(row.gross_cents,row.currency)}));option.value=row.id;select.append(option);}
   write(notice,copy(draft?'entity_page':'page',{start:i18n.number(data.items.length?cursor+1:0),end:i18n.number(cursor+data.items.length),total:i18n.number(data.total)}));
  }
  function renderPending(){
   pendingBox.replaceChildren();
   if(!retained.length)return;
   pendingBox.append(el('h4',copy('pending')),el('p',copy('recover_help')));
   for(const item of retained){
    const node=el('button',copy('pending_item',{operation:copy('operation_'+item.operation.toLowerCase()),date:live(()=>i18n.date(item.created_at,{dateStyle:'medium',timeStyle:'medium'}))}));node.type='button';
    node.addEventListener('click',()=>{if(busy||!active())return;pending=clone(item.command);write(notice,copy('recover_first'));controls();});pendingBox.append(node);
   }
  }
  async function load(){
   const at=++serial;initialized=false;
   const pages=await Promise.all(allowed.map(op=>request('/api/finance/invoice-actions/confirmations?operation='+op+'&limit=10')));
   if(!active()||at!==serial)return;
   retained=[];
   for(const page of pages){if(!Array.isArray(page.items)||page.items.some(item=>item.status!=='PENDING'||item.command?.operation!==page.operation||item.command?.request_id!==item.request_id||!validCommand(item.command)))throw error('invalid_result');retained.push(...page.items);}
   pending=retained[0]?clone(retained[0].command):null;renderPending();if(pending)box.open=true;const loaded=await Promise.allSettled([listInvoices(0),draft?.load?.()]);if(!active()||at!==serial)return;const failed=loaded.find(result=>result.status==='rejected');if(failed)throw failed.reason;
   initialized=true;dirty=false;review=null;confirm.checked=false;visibility();if(pending){box.open=true;write(notice,copy('recover_first'));}controls();
  }
  async function finish(data,command){
   verifyResult(data,command);displayResult(data);
   const ack=await request('/api/finance/invoice-actions/acknowledge',{method:'POST',body:JSON.stringify(command)});if(!active()||pending?.request_id!==command.request_id)return;
   if(ack?.operation!==command.operation||ack.request_id!==command.request_id||ack.status!=='ACKNOWLEDGED'||ack.state!==data.state||ack.financial_posting_performed!==false||ack.external_payment_performed!==false)throw error('invalid_result');
   pending=null;review=null;reason.value='';confirm.checked=false;reviewBox.replaceChildren();dirty=false;if(draft&&data.state==='COMMITTED'){draft.clear();for(const node of [number,date,supplyDate,dueDate])node.value='';}
   try{await load();}catch(value){if(active()&&data.state==='COMMITTED'){write(notice,copy('saved_refresh_needed'));controls();return;}throw value;}if(!active()||pending)return;
   if(draft&&data.state==='NOT_APPLIED'&&draft.restore(command.input)){reason.value=command.reason;dirty=true;write(notice,copy('not_applied_restored'));controls();return;}
   if(data.state==='COMMITTED'&&onComplete){let refreshed=false;try{refreshed=await onComplete(data);}catch{}if(!active())return;if(refreshed===false){write(notice,copy('saved_refresh_needed'));return;}}
   write(notice,copy(data.state==='NOT_APPLIED'?'not_applied':data.deduplicated?'recovered':'saved'));
  }
  box.append(el(creating?'summary':'h3',copy(commerceCreation?'commerce_title':invoiceCreation?'create_title':'title')),el('p',copy(commerceCreation?'commerce_scope':invoiceCreation?'create_scope':'scope')),pendingBox,fields,creditChoices,buttons,notice,reviewBox,resultBox);
  button('previous',async()=>{ensureEditable();if(dirty&&!draft)throw error('clear_first');if(cursor>0){if(draft)invalidate();await listInvoices(Math.max(0,cursor-50));}});
  button('next',async()=>{ensureEditable();if(dirty&&!draft)throw error('clear_first');if(next!==null){if(draft)invalidate();await listInvoices(next);}});
  button('clear',async()=>{if(pending)throw error('recover_first');for(const node of [amount,date,reference,number,supplyDate,dueDate,reason])node.value='';draft?.clear();confirm.checked=false;review=null;reviewBox.replaceChildren();dirty=false;await load();});
  button('preview',async()=>{
   ensureEditable();const input=values(),op=operation.value,at=++serial;review=null;confirm.checked=false;
   const data=await request('/api/finance/invoice-actions/preview',{method:'POST',body:JSON.stringify({operation:op,input})});if(!active()||at!==serial)return;
   if(data?.operation!==op||typeof data.ready!=='boolean'||!Array.isArray(data.blockers)||!/^[a-f0-9]{64}$/.test(data.source_hash||'')||data.financial_posting_performed!==false||data.external_payment_performed!==false)throw error('invalid_result');
   if(op==='CREDIT_NOTE_CREATE'){
    const lines=data.summary?.source_lines;
    if(data.summary?.original_invoice_id!==input.invoice_id||!Array.isArray(lines)||!lines.length||lines.length>500||lines.some(line=>typeof line.id!=='string'||line.invoice_id!==input.invoice_id||typeof line.already_credited!=='boolean')||new Set(lines.map(line=>line.id)).size!==lines.length)throw error('invalid_result');
    creditChoices.replaceChildren(el('legend',copy('credit_lines')),el('p',copy('credit_lines_help')));creditChoices.hidden=false;creditInputs=[];
    for(const line of lines){
     const label=el('label'),node=el('input');node.type='checkbox';node.checked=!creditSelection||creditSelection.includes(line.id);node.setAttribute('data-finance-credit-line',line.id);
     label.append(node,el('span',copy('review_line',{description:line.description,quantity:live(()=>i18n.number(line.quantity)),unit:money(line.unit_price_cents,data.summary.currency),net:money(line.net_cents,data.summary.currency),tax:live(()=>i18n.number(line.vat_rate)),gross:money(line.gross_cents,data.summary.currency)})));creditChoices.append(label);creditInputs.push(node);
     if(line.already_credited)label.append(el('span',copy('credit_line_reserved')));
     node.addEventListener('change',()=>{if(busy||pending||!active())return;creditSelection=creditInputs.filter(n=>n.checked).map(n=>n.getAttribute('data-finance-credit-line'));invalidate();});
    }
   }
   const prepared=op==='COMMERCE_INVOICE_CREATE'?data.prepared_invoice:input;
   if(op==='COMMERCE_INVOICE_CREATE'&&(!prepared||prepared.legal_entity_id!==input.legal_entity_id||prepared.kind!=='SALES'||prepared.commerce_source?.order_id!==input.order_id||prepared.commerce_source?.contact_id!==input.contact_id||prepared.invoice_number!==input.invoice_number||!Array.isArray(data.summary?.lines)||data.summary.lines.length<1||data.summary.lines.length>50))throw error('invalid_result');
   review={...data,input:clone(input),operation:op};reviewBox.replaceChildren(el('h4',copy('review')),el('p',copy(data.ready?'ready':'blocked')));
   const blockerKey=code=>/ORDER_ALREADY_LINKED/.test(code)?'block_order_linked':/ORDER_NOT_INVOICEABLE|ORDER_LINES_REQUIRE_REVIEW/.test(code)?'block_order':/PURCHASE_NOT_APPROVED/.test(code)?'block_approval':/PERIOD/.test(code)?'block_period':/CURRENCY/.test(code)?'block_currency':/ACCOUNT_MAPPING/.test(code)?'block_account':/REFUND_EXCEEDS_RECORDED_RECEIPTS/.test(code)?'block_receipt':/NUMBER_EXISTS|FULL_CREDIT_EXCEEDS/.test(code)?'block_duplicate':/AMOUNT|BALANCE|TOTALS/.test(code)?'block_amount':'block_source';
   for(const key of new Set(data.blockers.map(blockerKey)))reviewBox.append(el('p',copy(key)));
   if(['INVOICE_CREATE','COMMERCE_INVOICE_CREATE'].includes(op)){
    reviewBox.append(el('p',copy('review_value',{label:copy('invoice_kind'),value:copy('kind_'+prepared.kind.toLowerCase())})));
    for(const key of ['supplier_name','supplier_address','supplier_vat_id','supplier_kvk_number','customer_name','customer_address'])reviewBox.append(el('p',copy('review_value',{label:copy(key),value:prepared[key]})));
    for(const [key,value]of [['date',prepared.invoice_date],['supply_date',prepared.supply_date],['due_date',prepared.due_date]])reviewBox.append(el('p',copy('review_value',{label:copy(key),value:live(()=>i18n.date(value,{dateStyle:'medium'}))})));
    if(op==='COMMERCE_INVOICE_CREATE')reviewBox.append(el('p',copy('commerce_review',{order:input.order_id,order_revision:live(()=>i18n.number(prepared.commerce_source.order_revision)),contact:input.contact_id,contact_revision:live(()=>i18n.number(prepared.commerce_source.contact_revision))})));
   }
   if(['INVOICE_APPROVE','INVOICE_CREATE','COMMERCE_INVOICE_CREATE','CREDIT_NOTE_CREATE'].includes(op)){
    if(data.summary?.invoice_number)reviewBox.append(el('p',copy('review_document',{number:data.summary.invoice_number})));
    if(data.summary?.supplier_name)reviewBox.append(el('p',copy('review_supplier',{supplier:data.summary.supplier_name})));
    for(const line of data.summary?.lines||[])reviewBox.append(el('p',copy('review_line',{description:line.description,quantity:live(()=>i18n.number(line.quantity)),unit:money(line.unit_price_cents,data.summary.currency),net:money(line.net_cents,data.summary.currency),tax:live(()=>i18n.number(line.vat_rate)),gross:money(line.gross_cents,data.summary.currency)})));
   }
   if(Number.isSafeInteger(data.summary?.amount_cents))reviewBox.append(el('p',copy('review_amount',{amount:money(data.summary.amount_cents,data.summary.currency)})));
   if(data.summary?.date)reviewBox.append(el('p',copy('review_date',{date:live(()=>i18n.date(data.summary.date,{dateStyle:'medium'}))})));
   write(notice,copy(data.ready?'ready':'blocked'));
  });
  button('submit',async()=>{
   ensureEditable();if(!review?.ready||!confirm.checked||!reason.value.trim()||!same(review.input,values())||review.operation!==operation.value)throw error('confirm_first');
   const command={operation:review.operation,input:clone(review.input),expected_source_hash:review.source_hash,request_id:root.crypto.randomUUID(),confirm:true,reason:reason.value.trim()};pending=command;controls();
   const saved=await request('/api/finance/invoice-actions/confirmations',{method:'POST',body:JSON.stringify(command)});if(!active()||pending!==command)return;
   if(saved?.request_id!==command.request_id||saved.operation!==command.operation||!same(saved.command,command)||!['PENDING','ACKNOWLEDGED'].includes(saved.status)||saved.financial_posting_performed!==false||saved.external_payment_performed!==false)throw error('invalid_result');
   const data=await request('/api/finance/invoice-actions/'+(saved.status==='ACKNOWLEDGED'?'recover':'execute'),{method:'POST',body:JSON.stringify(command)});if(!active()||pending!==command)return;
   await finish(data,command);
  });
  button('recover',async()=>{if(!pending)throw error('load_first');const command=clone(pending),data=await request('/api/finance/invoice-actions/recover',{method:'POST',body:JSON.stringify(command)});if(!active()||pending?.request_id!==command.request_id)return;await finish(data,command);});
  box.canLeave=()=>{if(busy||dirty||pending){write(notice,copy(pending?'recover_first':'clear_first'));return false;}return true;};
  box.refresh=()=>{if(!box.canLeave())return Promise.resolve(false);return load();};
  visibility();controls();box.ready=load().catch(value=>{showError(value);controls();});return box;
 }
 root.FoundlyFinanceInvoiceActions={create,cents,OPERATIONS};
})(globalThis);
