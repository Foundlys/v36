'use strict';
// Authoring audit only; not a production dependency or proof of rendered copy.
// Use a locally installed Acorn, or the parser bundled with this Node runtime.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
function parser(){try{return require('acorn');}catch{const source=process.binding('natives')['internal/deps/acorn/acorn/dist/acorn'];if(!source)throw Error('This authoring audit requires Acorn. No source is downloaded automatically.');const module={exports:{}};vm.runInNewContext(source,{module,exports:module.exports});return module.exports;}}
const acorn=parser();
function walk(node,visit,parent=null){if(!node||typeof node!=='object')return;if(node.type)visit(node,parent);for(const [key,value]of Object.entries(node)){if(['start','end','loc'].includes(key))continue;if(Array.isArray(value))for(const child of value)walk(child,visit,node);else if(value&&typeof value==='object')walk(value,visit,node);}}
function pattern(node,source){
 if(node?.type==='Literal'&&typeof node.value==='string')return {text:node.value,parameters:[]};
 if(node?.type==='TemplateLiteral')return {text:node.quasis.map((q,i)=>q.value.cooked+(i<node.expressions.length?'{p'+i+'}':'')).join(''),parameters:node.expressions.map(n=>source.slice(n.start,n.end))};
 return null;
}
function scan(file){
 const source=fs.readFileSync(path.join(root,file),'utf8'),tree=acorn.parse(source,{ecmaVersion:'latest',sourceType:'script',locations:true}),items=[];
 const add=(node,context)=>{const value=pattern(node,source);if(!value||!/[\p{L}]/u.test(value.text)||value.text.length>4000)return;items.push({line:node.loc.start.line,start:node.start,end:node.end,context,...value,rich_text:/<[a-z][^>]*>/i.test(value.text)});};
 walk(tree,node=>{
  if(node.type==='AssignmentExpression'&&node.left.type==='MemberExpression'&&['textContent','innerText','placeholder','title','innerHTML'].includes(node.left.property.name))add(node.right,node.left.property.name);
  if(node.type==='CallExpression'){
   if(['node','make'].includes(node.callee.name))add(node.arguments[2],'element_text');
   if(node.callee.name==='setZeroState')add(node.arguments[1],'zero_state_detail');
   if(['toast','prompt','alert','confirm'].includes(node.callee.name))add(node.arguments[0],node.callee.name);
   if(node.callee.property?.name==='setAttribute'&&['aria-label','title','placeholder','alt'].includes(node.arguments[0]?.value))add(node.arguments[1],node.arguments[0].value);
  }
  if(node.type==='NewExpression'&&node.callee.name==='Error')add(node.arguments[0],'error_message_requires_control_flow_review');
 });
 return {file,sha256:crypto.createHash('sha256').update(source).digest('hex'),items:[...new Map(items.map(row=>[row.start,row])).values()]};
}
function inventory(){
 const files=new Set();for(const html of fs.readdirSync(root).filter(f=>f.endsWith('.html')))for(const m of fs.readFileSync(path.join(root,html),'utf8').matchAll(/<script\b[^>]*\bsrc="\/([^"?]+\.js)"/g))if(!m[1].startsWith('foundly-i18n')&&!m[1].startsWith('foundly-locales')&&!m[1].startsWith('foundly-static-copy'))files.add(m[1]);
 return {schema_version:1,parser:'Acorn '+acorn.version,scope:'Conservative direct UI expression candidates. Conditional/concatenated copy, server-generated messages, UI configuration objects, runtime states and markup fragments need additional review. No automatic translation of arbitrary rendered/customer text.',files:[...files].sort().map(scan)};
}
if(require.main===module){const report=inventory();fs.writeFileSync(path.join(root,'docs/run2/localization-dynamic-inventory.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({files:report.files.length,candidates:report.files.reduce((n,f)=>n+f.items.length,0),main_dashboard:report.files.find(f=>f.file==='index-script.js')?.items.length}));}
module.exports={scan,inventory};
