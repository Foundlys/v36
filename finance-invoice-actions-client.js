'use strict';
(function(root){
 const OPERATIONS=['INVOICE_POST','INVOICE_APPROVE','PAYMENT_RECORD','CREDIT_NOTE_CREATE','CREDIT_ALLOCATE','CREDIT_REFUND_RECORD'];
 const clone=value=>JSON.parse(JSON.stringify(value));
 const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
 const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
 function cents(value){
  if(typeof value!=='string'||!/^\d{1,14}(?:[.,]\d{1,2})?$/.test(value.trim()))throw Object.assign(Error('amount'),{localKey:'invalid_amount'});
  const [whole,fraction='']=value.trim().split(/[.,]/),amount=BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0'));
  if(amount<=0n||amount>BigInt(Number.MAX_SAFE_INTEGER))throw Object.assign(Error('amount'),{localKey:'invalid_amount'});
  return Number(amount);
 }
 function create({document,request,isActive=()=>true,operations=[]}){
  const i18n=root.FoundlyI18n,allowed=OPERATIONS.filter(operation=>operations.includes(operation));
  const copy=(key,params={})=>i18n.message('finance.actions.'+key,params),write=(node,value)=>i18n.renderText(node,value);
  const el=(tag,value)=>{const node=document.createElement(tag);if(value!==undefined)write(node,value);return node;};
  const live=read=>Object.freeze({toString:read}),money=(amount,currency)=>live(()=>Number.isSafeInteger(amount)&&/^[A-Z]{3}$/.test(currency)?i18n.currencyCents(amount,currency):i18n.t('common.unknown'));
  const statusText=status=>['DRAFT','POSTED','PARTIALLY_PAID','PAID','OVERDUE','SETTLED','PARTIALLY_SETTLED'].includes(status)?copy('status_'+status.toLowerCase()):i18n.message('common.unknown');
  const documentStatus=row=>row.kind==='PURCHASE'?copy('purchase_status',{status:statusText(row.status),approval:copy(row.approval_status==='APPROVED'?'approval_approved':'approval_pending')}):statusText(row.status);
  const box=el('section'),fields=el('div'),buttons=el('div'),notice=el('output'),reviewBox=el('div'),resultBox=el('div'),pendingBox=el('div');
  box.className='finance-invoice-actions';fields.className='finance-action-fields';buttons.className='finance-action-buttons';notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');
  let busy=false,initialized=false,serial=0,dirty=false,review=null,pending=null,records=[],cursor=0,next=null,retained=[];
  const active=()=>box.isConnected&&isActive();
  const error=key=>Object.assign(Error(key),{localKey:key});
  function showError(value){if(!active())return;write(notice,copy(value.localKey||(pending?'uncertain':'failed')));}
  const inputs=[],labels={};
  function field(key,type='input'){
   const label=el('label'),caption=el('span',copy(key)),node=el(type);label.append(caption,node);fields.append(label);node.setAttribute('data-finance-field',key);labels[key]=label;inputs.push(node);return node;
  }
  const operation=field('operation','select'),documentSelect=field('document','select'),amount=field('amount'),date=field('date'),reference=field('reference'),number=field('number'),supplyDate=field('supply_date'),dueDate=field('due_date'),reason=field('reason'),confirm=field('confirm');
  amount.inputMode='decimal';date.type=supplyDate.type=dueDate.type='date';reference.maxLength=240;number.maxLength=60;reason.maxLength=500;confirm.type='checkbox';
  const choose=()=>{const node=el('option',copy('choose_document'));node.value='';return node;};
  for(const name of allowed){const option=el('option',copy('operation_'+name.toLowerCase()));option.value=name;operation.append(option);}operation.value=allowed[0]||'';
  documentSelect.append(choose());
  const source=()=>records.find(row=>row.id===documentSelect.value);
  function visibility(){
   const op=operation.value,monetary=['PAYMENT_RECORD','CREDIT_ALLOCATE','CREDIT_REFUND_RECORD'].includes(op),credit=op==='CREDIT_NOTE_CREATE';
   for(const [key,visible]of Object.entries({amount:monetary,date:monetary||credit,reference:monetary,number:credit,supply_date:credit,due_date:credit}))labels[key].hidden=!visible;
  }
  function invalidate(){serial++;review=null;confirm.checked=false;reviewBox.replaceChildren();dirty=true;visibility();controls();}
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
   if(actions.preview)actions.preview.disabled=locked||!operation.value||!source();
   if(actions.submit)actions.submit.disabled=locked||!review?.ready||!confirm.checked||!reason.value.trim();
   if(actions.recover)actions.recover.disabled=busy||!pending;
   if(actions.previous)actions.previous.disabled=locked||dirty||cursor===0;
   if(actions.next)actions.next.disabled=locked||dirty||next===null;
  }
  function ensureEditable(){if(!initialized)throw error('load_first');if(pending)throw error('recover_first');}
  function values(){
   const invoice=source();if(!invoice)throw error('choose_document');const op=operation.value;
   if(['INVOICE_APPROVE','INVOICE_POST'].includes(op))return{invoice_id:invoice.id};
   if(op==='CREDIT_NOTE_CREATE'){
    if(invoice.kind!=='SALES'||!number.value.trim()||!date.value||!supplyDate.value||!dueDate.value)throw error('credit_fields');
    return{invoice_id:invoice.id,invoice_number:number.value.trim(),invoice_date:date.value,supply_date:supplyDate.value,due_date:dueDate.value};
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
    if(!original||!current||original.id!==current.id||!same(current,data.current_result?.invoice)||expected!==(command.input.credit_note_id||command.input.invoice_id)||!/^[a-f0-9]{64}$/.test(data.original_result_hash||'')||data.bank_settlement_verified!==false)throw error('invalid_result');
   }
  }
  function displayResult(data){
   resultBox.replaceChildren(el('h4',copy('result')));
   if(data.state==='NOT_APPLIED'){resultBox.append(el('p',copy('not_applied')));return;}
   const original=data.original_result.invoice,current=data.current_invoice;
   for(const [label,row]of [['original',original],['current',current]])resultBox.append(el('p',copy('result_row',{label:copy(label),number:row.invoice_number,status:documentStatus(row),amount:money(row.gross_cents,row.currency),open:money(row.outstanding_cents,row.currency)})));
   if(data.current_result.related_invoice){const row=data.current_result.related_invoice;resultBox.append(el('p',copy('result_row',{label:copy('related'),number:row.invoice_number,status:documentStatus(row),amount:money(row.gross_cents,row.currency),open:money(row.outstanding_cents,row.currency)})));}
   resultBox.append(el('p',copy('internal_only')));
  }
  async function listInvoices(at=0){
   const atSerial=serial,data=await request('/api/finance/records/invoices?limit=50&cursor='+at);if(!active()||atSerial!==serial)return;
   if(!data||!Array.isArray(data.items)||!Number.isSafeInteger(data.total)||data.items.length>50)throw error('invalid_result');
   records=data.items;cursor=at;next=data.next_cursor;documentSelect.replaceChildren(choose());documentSelect.value='';
   for(const row of records){const option=el('option',copy('document_option',{number:row.invoice_number,entity:row.kind==='PURCHASE'?row.customer_name:row.supplier_name,party:row.kind==='PURCHASE'?row.supplier_name:row.customer_name,status:documentStatus(row),amount:money(row.gross_cents,row.currency)}));option.value=row.id;documentSelect.append(option);}
   write(notice,copy('page',{start:i18n.number(data.items.length?cursor+1:0),end:i18n.number(cursor+data.items.length),total:i18n.number(data.total)}));
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
   pending=retained[0]?clone(retained[0].command):null;renderPending();await listInvoices(0);if(!active()||at!==serial)return;
   initialized=true;dirty=false;review=null;confirm.checked=false;visibility();if(pending)write(notice,copy('recover_first'));controls();
  }
  async function finish(data,command){
   verifyResult(data,command);displayResult(data);
   const ack=await request('/api/finance/invoice-actions/acknowledge',{method:'POST',body:JSON.stringify(command)});if(!active()||pending?.request_id!==command.request_id)return;
   if(ack?.operation!==command.operation||ack.request_id!==command.request_id||ack.status!=='ACKNOWLEDGED'||ack.state!==data.state||ack.financial_posting_performed!==false||ack.external_payment_performed!==false)throw error('invalid_result');
   pending=null;review=null;reason.value='';confirm.checked=false;reviewBox.replaceChildren();dirty=false;
   await load();if(active()&&!pending)write(notice,copy(data.state==='NOT_APPLIED'?'not_applied':data.deduplicated?'recovered':'saved'));
  }
  box.append(el('h3',copy('title')),el('p',copy('scope')),pendingBox,fields,buttons,notice,reviewBox,resultBox);
  button('previous',async()=>{ensureEditable();if(dirty)throw error('clear_first');if(cursor>0)await listInvoices(Math.max(0,cursor-50));});
  button('next',async()=>{ensureEditable();if(dirty)throw error('clear_first');if(next!==null)await listInvoices(next);});
  button('clear',async()=>{if(pending)throw error('recover_first');for(const node of [amount,date,reference,number,supplyDate,dueDate,reason])node.value='';confirm.checked=false;review=null;reviewBox.replaceChildren();dirty=false;await load();});
  button('preview',async()=>{
   ensureEditable();const input=values(),op=operation.value,at=++serial;review=null;confirm.checked=false;
   const data=await request('/api/finance/invoice-actions/preview',{method:'POST',body:JSON.stringify({operation:op,input})});if(!active()||at!==serial)return;
   if(data?.operation!==op||typeof data.ready!=='boolean'||!Array.isArray(data.blockers)||!/^[a-f0-9]{64}$/.test(data.source_hash||'')||data.financial_posting_performed!==false||data.external_payment_performed!==false)throw error('invalid_result');
   review={...data,input:clone(input),operation:op};reviewBox.replaceChildren(el('h4',copy('review')),el('p',copy(data.ready?'ready':'blocked')));
   const blockerKey=code=>/PURCHASE_NOT_APPROVED/.test(code)?'block_approval':/PERIOD/.test(code)?'block_period':/CURRENCY/.test(code)?'block_currency':/ACCOUNT_MAPPING/.test(code)?'block_account':/REFUND_EXCEEDS_RECORDED_RECEIPTS/.test(code)?'block_receipt':/NUMBER_EXISTS|FULL_CREDIT_EXCEEDS/.test(code)?'block_duplicate':/AMOUNT|BALANCE|TOTALS/.test(code)?'block_amount':'block_source';
   for(const key of new Set(data.blockers.map(blockerKey)))reviewBox.append(el('p',copy(key)));
   if(op==='INVOICE_APPROVE'){
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
  visibility();controls();box.ready=load().catch(showError);return box;
 }
 root.FoundlyFinanceInvoiceActions={create,cents,OPERATIONS};
})(globalThis);
