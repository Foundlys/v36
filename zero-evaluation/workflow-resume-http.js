'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto');
// Each intentional fixture continuation reviews and confirms the exact current
// native step. Repeating an original execute request is never resume authority.
async function resume(request,run){const p=await request('/api/automation/runs/'+run.run_id+'/resume-preview','GET');assert.equal(p.status,200,JSON.stringify(p.body));assert.equal(p.body.run_id,run.run_id);assert.equal(p.body.request_signature,run.request_signature);return request('/api/automation/runs/'+run.run_id+'/resume-confirmation','POST',{request_id:crypto.randomUUID(),confirm:true,reason:'Explicit reviewed native fixture continuation',run_id:run.run_id,request_signature:run.request_signature,step_index:p.body.step_index,preview_fingerprint:p.body.preview_fingerprint});}
module.exports={resume};
