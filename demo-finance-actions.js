'use strict';

// Only retain the identity of a native preparation. The real Finance contract
// owns validation, atomic effects, receipts and current authority on every try.
const L=require('./demo-universe-law'),{scopedMutation}=require('./scoped-mutation');
const SCOPE='demo:finance-preparations';
const fail=(code,statusCode=409)=>{throw Object.assign(Error(code),{code,statusCode});};
function retained(engine,ctx,actor,row,node,input,key){
  const matches=engine.adapter.bucket(ctx,SCOPE).filter(r=>r.request_id===key);
  if(matches.length>1)fail('demo_finance_preparation_invalid');
  const prior=matches[0];
  if(prior&&(prior.owner_id!==actor.id||prior.universe_id!==row.id||prior.node_id!==node.id||prior.plan_fingerprint!==row.plan_fingerprint||prior.input_hash!==L.hash(input)||!/^[a-f0-9]{64}$/.test(prior.source_hash)))fail('demo_finance_preparation_invalid');
  return prior||null;
}
function mutableDependency(node,ref){
  // A committed native action can change precisely its invoice or order while
  // the demo cursor is still old. Its retained original Finance request proves
  // that effect; all other native dependencies still require their exact hash.
  const operation=node.input.operation,fields=operation==='COMMERCE_INVOICE_CREATE'?['order_id']:['INVOICE_APPROVE','INVOICE_POST','PAYMENT_RECORD'].includes(operation)?['invoice_id']:operation==='CREDIT_ALLOCATE'?['credit_note_id','invoice_id']:operation==='CREDIT_REFUND_RECORD'?['credit_note_id']:[];
  return fields.some(field=>node.input.values[field]?.$ref===ref);
}
function execute(engine,ctx,actor,row,node,input,key,prior){
  if(!engine.finance)fail('demo_contract_unavailable',422);
  if(!prior){
    const preview=engine.finance.previewInvoiceAction(ctx,actor,{operation:input.operation,input:input.values});
    if(!preview.ready)fail('demo_finance_action_not_ready',422);
    if(!/^[a-f0-9]{64}$/.test(preview.source_hash))fail('demo_finance_preparation_invalid');
    prior={request_id:key,owner_id:actor.id,universe_id:row.id,node_id:node.id,plan_fingerprint:row.plan_fingerprint,input_hash:L.hash(input),source_hash:preview.source_hash};
    scopedMutation(engine.adapter,ctx,[SCOPE],()=>{const rows=engine.adapter.bucket(ctx,SCOPE);if(rows.length>=20000)fail('demo_finance_preparation_capacity',507);rows.push(prior);});
  }
  const request={operation:input.operation,input:input.values,request_id:key,expected_source_hash:prior.source_hash,confirm:true,reason:input.reason};
  const result=engine.finance.executeInvoiceAction(ctx,actor,request);
  if(result.state!=='COMMITTED'||!result.original_result_is_current||result.external_payment_performed!==false)fail('demo_native_source_changed');
  const current=engine.finance.inspectInvoiceAction(ctx,actor,request);
  if(current.state!=='COMMITTED'||!current.original_result_is_current||current.original_result_hash!==result.original_result_hash||current.external_payment_performed!==false)fail('demo_native_source_changed');
  return node.entity==='payments'?current.current_result.payment:current.current_invoice;
}
module.exports={SCOPE,retained,mutableDependency,execute};
