'use strict';

// Industry packs describe fields; domain services remain the permission and storage boundary.
function fieldContract(resolver,ctx,actor,moduleId){
  const resolved=resolver.resolve(ctx,actor),extension=resolved.industry_extensions?.[moduleId]||{};
  return {industry_id:resolved.industry_id,fields:(extension.fields||[]).map(name=>({name,type:extension.field_schema?.[name]?.type||'string',label:extension.field_schema?.[name]?.label||name}))};
}
function validateFields(contract,input,previous){
  const fail=(code,message)=>{throw Object.assign(new Error(message),{code,statusCode:422});};
  if(!input||typeof input!=='object'||Array.isArray(input))fail('industry_field_invalid','Branchevelden moeten een object zijn');
  if(previous?.industry_field_pack_id&&previous.industry_field_pack_id!==contract.industry_id&&Object.keys(previous.industry_fields||{}).length)fail('industry_pack_conflict','Bewaarde branchevelden horen bij een ander pakket; herstel dat pakket om deze velden te wijzigen');
  if(!previous?.industry_field_pack_id&&Object.keys(previous?.industry_fields||{}).some(name=>!contract.fields.some(field=>field.name===name)))fail('industry_pack_conflict','Oudere branchevelden passen niet bij het actieve pakket; de bestaande gegevens blijven behouden');
  for(const [name,value] of Object.entries(input)){
    const field=contract.fields.find(row=>row.name===name);
    if(!field)fail('industry_field_unavailable','Veld hoort niet bij het actieve branchepakket');
    if(typeof value!==field.type||!['string','number','boolean'].includes(field.type)||field.type==='number'&&!Number.isFinite(value)||field.type==='string'&&value.length>1000)fail('industry_field_invalid','Brancheveld heeft een ongeldige waarde');
  }
  return {...previous?.industry_fields,...input};
}
module.exports={fieldContract,validateFields};
