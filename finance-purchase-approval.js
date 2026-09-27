'use strict';
const crypto=require('node:crypto');
const OMIT=new Set(['revision','approval_status','approved_at','approved_by','approval_reason','approval_version','approval_source_hash']);
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
function sourceHash(core,ctx,invoice){
 const entity=core.collection(ctx,'legal_entities').find(row=>row.id===invoice.legal_entity_id),lines=core.collection(ctx,'invoice_lines').filter(row=>row.invoice_id===invoice.id).slice().sort((a,b)=>String(a.id).localeCompare(String(b.id)));
 const source={entity,invoice:Object.fromEntries(Object.entries(invoice).filter(([key])=>!OMIT.has(key))),lines};
 return crypto.createHash('sha256').update(JSON.stringify(canonical(source))).digest('hex');
}
function current(core,ctx,invoice){return invoice.approval_status==='APPROVED'&&invoice.approval_version===1&&invoice.approval_source_hash===sourceHash(core,ctx,invoice);}
module.exports={sourceHash,current};
