'use strict';
// Minimal DOM for controller state/ownership tests; not browser or layout evidence.
const fs=require('node:fs'),vm=require('node:vm');
class Element{
 constructor(tag='div'){Object.assign(this,{tag,attrs:{},handlers:{},children:[],childNodes:[],value:'',validity:{},disabled:false,nodeType:1,isConnected:true});}
 get firstChild(){return this.childNodes[0]||null;}get textContent(){return this.childNodes.map(node=>node.textContent||'').join('');}set textContent(value){this.children=[];this.childNodes=String(value)?[{nodeType:3,textContent:String(value)}]:[];}
 setAttribute(k,v){this.attrs[k]=String(v);}getAttribute(k){return this.attrs[k]??null;}removeAttribute(k){delete this.attrs[k];}
 matches(selector){return selector.split(',').some(s=>Object.hasOwn(this.attrs,s.trim().slice(1,-1)));}
 addEventListener(k,f){(this.handlers[k]??=[]).push(f);}async fire(k,event={}){for(const f of this.handlers[k]||[])await f({preventDefault(){},target:this,...event});}
 append(...nodes){for(const node of nodes){node.parentNode=this;node.isConnected=this.isConnected;this.childNodes.push(node);if(node.nodeType===1)this.children.push(node);}}replaceChildren(...nodes){for(const node of this.childNodes){node.parentNode=null;node.isConnected=false;}this.children=[];this.childNodes=[];this.append(...nodes);}after(node){this.following=node;}setCustomValidity(text){this.validationMessage=text;}
 get dataset(){return Object.fromEntries(Object.entries(this.attrs).filter(([key])=>key.startsWith('data-')).map(([key,value])=>[key.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase()),value]));}
 closest(tag){return this.tag===tag?this:this.parentNode?.closest?.(tag)||null;}
 querySelectorAll(selector){return this.all().slice(1).filter(node=>node.matches(selector));}
 all(){return [this,...this.children.flatMap(node=>node.all())];}
}
function browserFixture(locale='fr-FR',fetch=async()=>({ok:false,status:401,json:async()=>({code:'identity_credentials_invalid',error:'RAW_DUTCH_SECRET'})}),path='/login',htmlLocale='nl'){
 const nodes={},document=new Element('document');document.documentElement={lang:htmlLocale};document.createElement=tag=>new Element(tag);document.createTextNode=text=>({nodeType:3,textContent:String(text)});document.querySelector=selector=>selector.startsWith('#')?nodes[selector.slice(1)]||null:null;document.getElementById=id=>nodes[id]??=new Element();document.querySelectorAll=selector=>[...new Set(Object.values(nodes).flatMap(node=>node.all()))].filter(n=>n.matches(selector));document.dispatchEvent=event=>document.fire(event.type,event);
 for(const id of ['identityForm','identityUsername','identityPassword','identitySubmit','identityNotice','identityLocale','identityTitle','identityDescription','usernameLabel'])document.getElementById(id);
 const customer=document.getElementById('customer');customer.textContent='Aanmelden';
 const context={document,navigator:{languages:[locale]},location:{pathname:path,hash:'',assign(value){this.redirect=value;}},history:{replaceState(){}},fetch,URLSearchParams,Intl,CustomEvent:class{constructor(type,options){this.type=type;Object.assign(this,options);}}};
 vm.createContext(context);for(const file of ['foundly-static-copy.js','foundly-locales.js','foundly-i18n.js'])vm.runInContext(fs.readFileSync(require.resolve('../'+file),'utf8'),context);
 return {context,nodes,loadLogin(){vm.runInContext(fs.readFileSync(require.resolve('../identity-login.js'),'utf8'),context);}};
}
module.exports={Element,browserFixture};
