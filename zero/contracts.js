'use strict';
const crypto = require('node:crypto');
const {coreAllowed} = require('../core-access-contracts');
const LOCALES = Object.freeze(['nl-NL','en-GB','de-DE','fr-FR','es-ES','da-DK','nb-NO','sv-SE']);
const LAYERS = Object.freeze(['SESSION','TASK','USER','ORGANIZATION','WORKFLOW','SEMANTIC','INDUSTRY','OUTCOME']);
const PRIVATE_LAYERS = new Set(['SESSION','TASK','USER','WORKFLOW','OUTCOME']);
function fail(code, status = 400, message = code) { throw Object.assign(new Error(message), {code, statusCode:status}); }
function object(value) { if(!value || typeof value !== 'object' || Array.isArray(value))fail('zero_object_required'); return value; }
function keys(value, allowed) { object(value); if(Object.keys(value).some(key=>!allowed.includes(key)))fail('zero_unknown_field'); }
function string(value, max, required = true) {
  if(typeof value !== 'string' || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value) || required && !value.trim())fail('zero_text_invalid');
  return value.trim();
}
function identifier(value, max = 160) { const s=string(value,max); if(!/^[\p{L}\p{N}_.:/@ -]+$/u.test(s))fail('zero_identifier_invalid'); return s; }
function date(value, fallback = null) {
  if(value === undefined || value === null)return fallback;
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(value)||!Number.isFinite(Date.parse(value)))fail('zero_date_invalid');
  return new Date(value).toISOString();
}
function scope(ctx, actor) {
  if(!ctx?.tenant_id || !ctx?.dealer_id || !actor?.id)fail('zero_identity_required',401);
  // Accessing live principal getters here also revalidates current membership.
  return {tenant_id:identifier(ctx.tenant_id),dealer_id:identifier(ctx.dealer_id),owner_id:identifier(actor.id),roles:[...(actor.roles||[])]};
}
function permit(actor, permission) { if(!coreAllowed(actor,permission))fail('zero_permission_denied',403); }
function locale(value, fallback='nl-NL') {
  const aliases={en:'en-GB',nl:'nl-NL',de:'de-DE',fr:'fr-FR',es:'es-ES',da:'da-DK',no:'nb-NO',nb:'nb-NO',sv:'sv-SE'};
  const result=aliases[value]||value||fallback;if(!LOCALES.includes(result))fail('zero_locale_unsupported');return result;
}
const clone = value => JSON.parse(JSON.stringify(value));
const hash = value => crypto.createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const sameScope = (row, ctx) => row.tenant_id===ctx.tenant_id && row.dealer_id===ctx.dealer_id;
module.exports={LOCALES,LAYERS,PRIVATE_LAYERS,fail,object,keys,string,identifier,date,scope,permit,locale,clone,hash,sameScope};
