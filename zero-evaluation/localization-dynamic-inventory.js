'use strict';
// Authoring audit only; not a production dependency or proof of rendered copy.
// Use a locally installed Acorn, or the parser bundled with this Node runtime.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
function parser(){try{return require('acorn');}catch{const source=process.binding('natives')['internal/deps/acorn/acorn/dist/acorn'];if(!source)throw Error('This authoring audit requires Acorn. No source is downloaded automatically.');const module={exports:{}};vm.runInNewContext(source,{module,exports:module.exports});return module.exports;}}
const acorn=parser();
function children(node){return Object.entries(node).filter(([key])=>!['start','end','loc'].includes(key)).flatMap(([,value])=>Array.isArray(value)?value:[value]).filter(value=>value&&typeof value==='object'&&value.type);}
function walk(node,visit,parent=null){if(!node?.type)return;visit(node,parent);for(const child of children(node))walk(child,visit,node);}
function pattern(node,source){
 if(node?.type==='Literal'&&typeof node.value==='string')return {text:node.value,parameters:[]};
 if(node?.type==='TemplateLiteral')return {text:node.quasis.map((q,i)=>q.value.cooked+(i<node.expressions.length?'{p'+i+'}':'')).join(''),parameters:node.expressions.map(n=>source.slice(n.start,n.end))};
 return null;
}
// Resolve helper bindings lexically. A local business function called `el` or
// `button` must never inherit a different scope's presentation argument.
function presentationHelpers(tree){
 const scopes=new WeakMap(),functions=new Map(),top={parent:null,bindings:new Map(),functionScope:true};
 const isFunction=node=>['FunctionDeclaration','FunctionExpression','ArrowFunctionExpression'].includes(node?.type);
 const identifier=node=>node?.type==='AssignmentPattern'?identifier(node.left):node?.type==='Identifier'?node.name:null;
 function bind(scope,name,fn=null){if(name)scope.bindings.set(name,{fn});}
 function names(node){if(!node)return [];if(node.type==='Identifier')return [node.name];if(node.type==='AssignmentPattern')return names(node.left);if(node.type==='RestElement')return names(node.argument);if(node.type==='ArrayPattern')return node.elements.flatMap(names);if(node.type==='ObjectPattern')return node.properties.flatMap(p=>names(p.type==='RestElement'?p.argument:p.value));return [];}
 function visit(node,scope){
  if(isFunction(node)){
   if(node.type==='FunctionDeclaration')bind(scope,node.id?.name,node);
   const own={parent:scope,bindings:new Map(),functionScope:true};scopes.set(node,own);
   if(node.id)bind(own,node.id.name,node);for(const param of node.params)for(const name of names(param))bind(own,name);
   functions.set(node,{params:node.params.map(identifier),body:node.body});visit(node.body,own);return;
  }
  if(['BlockStatement','ForStatement','ForInStatement','ForOfStatement','SwitchStatement','CatchClause'].includes(node.type))scope={parent:scope,bindings:new Map()};
  scopes.set(node,scope);
  if(node.type==='CatchClause')for(const name of names(node.param))bind(scope,name);
  if(node.type==='VariableDeclaration')for(const declaration of node.declarations){let target=scope;if(node.kind==='var')while(!target.functionScope)target=target.parent;for(const name of names(declaration.id))bind(target,name,isFunction(declaration.init)?declaration.init:null);}
  if(node.type==='ClassDeclaration')bind(scope,node.id?.name);
  for(const child of children(node))visit(child,scope);
 }
 visit(tree,top);
 function resolve(node){if(node?.type!=='Identifier')return null;let scope=scopes.get(node);while(scope){if(scope.bindings.has(node.name))return scope.bindings.get(node.name).fn;scope=scope.parent;}return null;}
 // Reassigned helpers cannot be established from this static proof.
 walk(tree,node=>{if(node.type==='AssignmentExpression'&&node.left.type==='Identifier'){let scope=scopes.get(node.left);while(scope){if(scope.bindings.has(node.left.name)){scope.bindings.get(node.left.name).fn=null;break;}scope=scope.parent;}}});
 function ownWalk(node,visitor){if(!node||isFunction(node))return;visitor(node);for(const child of children(node))ownWalk(child,visitor);}
 const known=new Map();
 function parameter(node,params){if(node?.type==='CallExpression'&&node.callee.name==='String'&&node.arguments.length===1)node=node.arguments[0];return node?.type==='Identifier'?params.indexOf(node.name):-1;}
 for(let changed=true;changed;){changed=false;for(const [fn,{params,body}]of functions){
   const positions=new Set(known.get(fn)||[]);let createsElement=false;const assignments=[];
   ownWalk(body,node=>{
    if(node.type==='AssignmentExpression'&&node.left.type==='MemberExpression'&&['textContent','innerText'].includes(node.left.property.name))assignments.push(node.right);
    if(node.type==='CallExpression'){
     if(node.callee.type==='MemberExpression'&&node.callee.property.name==='createElement'&&node.callee.object.name==='document')createsElement=true;
     for(const position of known.get(resolve(node.callee))||[]){const index=parameter(node.arguments[position],params);if(index>=0)positions.add(index);}
    }
   });
   if(createsElement)for(const value of assignments){const index=parameter(value,params);if(index>=0)positions.add(index);}
   if(positions.size>(known.get(fn)?.size||0)){known.set(fn,positions);changed=true;}
  }}
 return node=>known.get(resolve(node))||[];
}
function scanSource(source,file='<source>'){
 const tree=acorn.parse(source,{ecmaVersion:'latest',sourceType:'script',locations:true}),helpers=presentationHelpers(tree),items=[];
 const add=(node,context)=>{const value=pattern(node,source);if(!value||!/[\p{L}]/u.test(value.text)||value.text.length>4000)return;items.push({line:node.loc.start.line,start:node.start,end:node.end,context,...value,rich_text:/<[a-z][^>]*>/i.test(value.text)});};
 walk(tree,node=>{
  if(node.type==='AssignmentExpression'&&node.left.type==='MemberExpression'&&['textContent','innerText','placeholder','title','innerHTML'].includes(node.left.property.name))add(node.right,node.left.property.name);
  if(node.type==='CallExpression'){
   for(const position of helpers(node.callee))add(node.arguments[position],'element_text');
   if(node.callee.type==='MemberExpression'&&node.callee.property.name==='createTextNode'&&node.callee.object.name==='document')add(node.arguments[0],'element_text');
   if(node.callee.name==='setZeroState')add(node.arguments[1],'zero_state_detail');
   if(['toast','prompt','alert','confirm'].includes(node.callee.name))add(node.arguments[0],node.callee.name);
   if(node.callee.property?.name==='setAttribute'&&['aria-label','title','placeholder','alt'].includes(node.arguments[0]?.value))add(node.arguments[1],node.arguments[0].value);
  }
  if(node.type==='NewExpression'&&node.callee.name==='Error')add(node.arguments[0],'error_message_requires_control_flow_review');
 });
 return {file,sha256:crypto.createHash('sha256').update(source).digest('hex'),items:[...new Map(items.map(row=>[row.start,row])).values()]};
}
function scan(file){return scanSource(fs.readFileSync(path.join(root,file),'utf8'),file);}
function inventory(){
 const files=new Set();for(const html of fs.readdirSync(root).filter(f=>f.endsWith('.html')))for(const m of fs.readFileSync(path.join(root,html),'utf8').matchAll(/<script\b[^>]*\bsrc="\/([^"?]+\.js)"/g))if(!m[1].startsWith('foundly-i18n')&&!m[1].startsWith('foundly-locales')&&!m[1].startsWith('foundly-static-copy'))files.add(m[1]);
 return {schema_version:1,parser:'Acorn '+acorn.version,scope:'Conservative direct UI expression candidates. Conditional/concatenated copy, server-generated messages, UI configuration objects, runtime states and markup fragments need additional review. No automatic translation of arbitrary rendered/customer text.',files:[...files].sort().map(scan)};
}
if(require.main===module){const report=inventory();fs.writeFileSync(path.join(root,'docs/run2/localization-dynamic-inventory.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({files:report.files.length,candidates:report.files.reduce((n,f)=>n+f.items.length,0),main_dashboard:report.files.find(f=>f.file==='index-script.js')?.items.length}));}
module.exports={scan,scanSource,inventory};
