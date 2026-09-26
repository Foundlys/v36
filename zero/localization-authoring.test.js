'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process'),path=require('node:path');
const {scanSource}=require('../zero-evaluation/localization-dynamic-inventory');
test('presentation audit follows actual DOM helpers while excluding shadowed functions, payload values and IDs',()=>{
 const source=`const el=(tag,text='')=>{const n=document.createElement(tag);n.textContent=text;return n;};
 const field=(host,label,value)=>{const n=el('label',label);const i=el('input');i.value=value;host.append(n,i);};
 field(host,'Visible label','PRIVATE VALUE');el('div','Direct label');document.createTextNode('Text node');
 {const el=(id,payload)=>save(id,payload);el('INTERNAL_ID','CUSTOMER PAYLOAD');}
 function inner({el}){el('ID','SHADOWED CUSTOMER');}
 const make=(tag,text)=>{const e=document.createElement(tag);e.textContent=String(text);return e;};make('span','Visible make');
 function nested(text){function unrelated(){const e=document.createElement('p');e.textContent=text;return e;}return send(text);}
 nested('BUSINESS DATA');
 let mutable=(tag,text)=>{const e=document.createElement(tag);e.textContent=text;return e;};mutable=save;mutable('ID','NOT PROVEN');`;
 assert.deepEqual(scanSource(source).items.map(r=>r.text),['Visible label','Direct label','Text node','Visible make']);
});
test('incremental static binding preserves markup and does not translate business defaults',()=>{
 const script=`import importlib.util, pathlib
p=pathlib.Path('zero-evaluation/localize-static-html.py')
s=importlib.util.spec_from_file_location('binder',p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
m.LOOKUP={'A':'label.a','B':'label.b'}
source='<label data-i18n-text="{&quot;0&quot;:&quot;label.a&quot;}">A<input value="B">B</label><textarea>B</textarea><option>B</option>'
b=m.Binder(source);b.feed(source);result=b.result()
assert result.count('<label')==1 and result.count('</label>')==1 and result.count('<input value="B">')==1,result
assert '&quot;2&quot;:&quot;label.b&quot;' in result,result
assert '<textarea>B</textarea>' in result,result
assert '<option value="B"' in result,result
c=m.Binder(result);c.feed(result);assert c.result()==result
`;
 execFileSync('python3',['-c',script],{cwd:path.resolve(__dirname,'..')});
});
