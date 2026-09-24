'use strict';
// This authoring pass only binds direct presentation expressions to entries
// already reviewed in the explicit catalog. It never rewrites arbitrary data,
// object keys, canonical enum values, network payloads or rich HTML templates.
const fs=require('node:fs'),path=require('node:path');
const {scan,inventory}=require('./localization-dynamic-inventory');
const {staticLookup}=require('../foundly-locales');
const root=path.resolve(__dirname,'..');
const SAFE_CONTEXTS=new Set(['textContent','innerText','placeholder','element_text','aria-label','alt','toast','prompt','alert','confirm','zero_state_detail']);
function edits(file){return scan(file).items.filter(row=>SAFE_CONTEXTS.has(row.context)&&!row.rich_text&&Object.hasOwn(staticLookup,row.text));}
function apply(file,rows){
 const filename=path.resolve(root,file);if(!filename.startsWith(root+path.sep)||!filename.endsWith('.js'))throw Error('Invalid authoring target');
 const source=fs.readFileSync(filename,'utf8');let result=source,boundary=source.length;
 for(const row of [...rows].sort((a,b)=>b.start-a.start)){
  if(row.end>boundary)throw Error('Overlapping presentation expressions require manual review');boundary=row.start;
  const parameters=row.parameters.length?',{'+row.parameters.map((expression,i)=>JSON.stringify('p'+i)+':('+expression+')').join(',')+'}':'';
  const call='(globalThis.FoundlyI18n?globalThis.FoundlyI18n.t('+JSON.stringify(staticLookup[row.text])+parameters+'):'+source.slice(row.start,row.end)+')';
  result=result.slice(0,row.start)+call+result.slice(row.end);
 }
 fs.writeFileSync(filename,result);
}
if(require.main===module){const write=process.argv.includes('--write'),requested=process.argv.slice(2).filter(arg=>!arg.startsWith('--')),files=requested.length?requested:inventory().files.map(row=>row.file);for(const file of files){const rows=edits(file);if(rows.length){if(write)apply(file,rows);console.log(JSON.stringify({file,copy_sites:rows.length,write,keys:[...new Set(rows.map(row=>row.text))]}));}}}
module.exports={edits,apply};
