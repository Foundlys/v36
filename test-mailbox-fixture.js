'use strict';
// Explicit isolated server preload; application runtime never imports fixtures.
require('./test-masterbuild-fetch-mock');
const fs=require('node:fs');
require('./communication-imap').createReader=()=>async(config,{authorize,offset})=>{
 const path=process.env.FOUNDLY_IMAP_FIXTURE;if(!path)throw Error('Explicit IMAP fixture path required');const fixture=JSON.parse(fs.readFileSync(path,'utf8'));if(fixture.fixture!=='READ_ONLY_IMAP_CONTRACT_NOT_LIVE')throw Error('Explicit read-only IMAP fixture marker required');authorize();fs.writeFileSync(path+'.started','READ_ONLY_FIXTURE_NO_PROVIDER_MUTATION');
 if(fixture.wait){for(let n=0;n<250&&!fs.existsSync(path+'.release');n++)await new Promise(resolve=>setTimeout(resolve,20));if(!fs.existsSync(path+'.release'))throw Error('Fixture release timeout');}
 authorize();if(fixture.reject)throw Object.assign(Error('Fixture rejected'),{code:'imap_command_rejected',statusCode:502});
 const uids=fixture.empty?[]:fixture.thread?[1,2,3]:[1,2],items=uids.slice(offset,offset+20).map(uid=>{const raw=Buffer.from(`From: sender@example.test\r\nTo: recipient@example.test\r\nSubject: Provider fixture ${uid}\r\nMessage-ID: <fixture-${uid}@example.test>\r\n${uid===3?'In-Reply-To: <fixture-1@example.test>\r\nReferences: <fixture-1@example.test>\r\n':''}Content-Type: text/plain; charset=utf-8\r\n\r\nUNTRUSTED_IMAP_RAW_MARKER_${uid}`),draft=uid===2||fixture.draft===true;return {uid,size:raw.length,flags:draft?['\\Draft']:[],raw:draft?null:raw,unavailable:draft?'PROVIDER_DRAFT_EXCLUDED':null};});
 return {authenticated:true,tls_verified:true,read_only:true,provider_mutated:false,folder:'INBOX',uidvalidity:fixture.uidvalidity||321,total_uids_observed:uids.length,uid_set:uids,items,missing_uids:[],offset,next_offset:null,coverage_complete:offset===0,mailbox_changed:false,observed_at:new Date().toISOString()};
};
