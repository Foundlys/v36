'use strict';
const fs=require('node:fs'),vm=require('node:vm'),{browserFixture}=require('./dom-fixture'),{CrmView}=require('./crm-dashboard-fixture'),{CrmObjects}=require('../crm-objects'),{CapabilityResolver}=require('../capability-resolver');
class ObjectView extends CrmView{
 get tagName(){return this.tag.toUpperCase();}
 get parentElement(){return this.parentNode||null;}
 append(...nodes){super.append(...nodes);for(const child of nodes)for(const node of child.all?.()||[])node.isConnected=this.isConnected;if(this.tag==='select'&&!this.value)this.value=this.children[0]?.value||'';}
 remove(){if(this.parentNode){const parent=this.parentNode;parent.children=parent.children.filter(n=>n!==this);parent.childNodes=parent.childNodes.filter(n=>n!==this);this.parentNode=null;}for(const node of this.all())node.isConnected=false;}
}
async function fixture(){const f=browserFixture('en-GB'),calls=[],writes=[],exported=[],state=new Map(),ctx={tenant_id:'objects_source_fixture',dealer_id:'default'},actor={id:'objects_owner',roles:['ADMIN','SUPER_ADMIN']};let key=0,denied=false,lose=false,malformed=false,hold=null,holdPath='',started;
 const adapter={bucket(c,s){const k=JSON.stringify([c,s]);if(!state.has(k))state.set(k,[]);return state.get(k);},persist(){},audit(){},readRelated(){return {id:'literal_contact',owner_id:actor.id};}},resolver=new CapabilityResolver(adapter);resolver.configure(ctx,actor,{entitlements:['crm'],expected_revision:0});const core=new CrmObjects(adapter,resolver),definition=core.saveDefinition(ctx,actor,'object_literal',{expected_revision:0,definition:{key:'literal_object',name:'Private literal object',version:1,fields:[{key:'title',label:'Private literal title',type:'TEXT',required:true},{key:'amount',label:'Private literal amount',type:'MONEY',required:false}]}}).record,record=core.saveRecord(ctx,actor,'record_literal',{object_id:definition.id,schema_revision:1,expected_revision:0,values:{title:'Private literal record',amount:{amount_cents:-123,currency:'USD'}}}).record;
 const request=async(route,options={})=>{calls.push({route,options});if(denied)throw Object.assign(Error('PRIVATE RAW DENIAL'),{status:403,statusCode:403,code:'capability_disabled'});const url=new URL(route,'https://fixture.test'),input=options.body?JSON.parse(options.body):undefined;let result,m;
  if(url.pathname==='/api/crm/objects')result=core.listDefinitions(ctx,actor);
  else if(url.pathname==='/api/crm/objects/export')result=core.export(ctx,actor);
  else if((m=url.pathname.match(/^\/api\/crm\/objects\/([^/]+)\/records\/([^/]+)$/)))result=core.saveRecord(ctx,actor,m[2],{...input,object_id:m[1]});
  else if((m=url.pathname.match(/^\/api\/crm\/objects\/([^/]+)\/records$/)))result=core.listRecords(ctx,actor,m[1],Object.fromEntries(url.searchParams));
  else if((m=url.pathname.match(/^\/api\/crm\/objects\/records\/([^/]+)\/history$/)))result=core.history(ctx,actor,m[1],Object.fromEntries(url.searchParams));
  else if((m=url.pathname.match(/^\/api\/crm\/objects\/records\/([^/]+)(\/restore)?$/)))result=core.archive(ctx,actor,m[1],input,Boolean(m[2]));
  else if((m=url.pathname.match(/^\/api\/crm\/objects\/(records\/)?([^/]+)\/access$/)))result=core.setAccess(ctx,actor,m[1]?'records':'definitions',m[2],input);
  else if((m=url.pathname.match(/^\/api\/crm\/objects\/([^/]+)$/)))result=core.saveDefinition(ctx,actor,m[1],input);
  else throw Error('Unexpected fixture route '+route);
  if(options.method){writes.push({route,options});if(lose){lose=false;throw Error('Lost durable reply');}if(malformed){malformed=false;result={ok:true};}}
  if(hold&&route.includes(holdPath)){const pending=hold;hold=null;started();await pending;}return result;
 };
 f.context.document.createElement=tag=>new ObjectView(tag);f.context.crypto={randomUUID:()=> 'objects_fixture_'+(++key)};vm.runInContext(fs.readFileSync(require.resolve('../crm-objects-client'),'utf8'),f.context);const box=f.context.FoundlyCrmObjects.create({document:f.context.document,request,onExport:async result=>exported.push(result)});f.nodes.objectBox=box;await box.ready;
 const translated=text=>{const entry=Object.entries(require('../foundly-locales').messages['nl-NL']).find(([key,value])=>key.startsWith('crm.objects.')&&value===text);if(entry)return f.context.FoundlyI18n.t(entry[0]);for(const [suffix,key]of [[' (valutacode)','currency_label'],[' (bedrag in centen)','minor_label']])if(text.endsWith(suffix))return f.context.FoundlyI18n.t('crm.objects.'+key,{label:text.slice(0,-suffix.length)});return text;},find=(tag,text)=>box.all().find(n=>n.tag===tag&&n.textContent===text)||box.all().find(n=>n.tag===tag&&n.textContent===translated(text)),field=text=>{const match=label=>box.all().find(n=>n.tag==='label'&&(n.childNodes.find(c=>c.nodeType===3)?.textContent===label||n.children.find(c=>c.tag==='span')?.textContent===label)),label=match(text)||match(translated(text));return label?.children.find(n=>['input','select','textarea'].includes(n.tag));},button=text=>find('button',text),choose=async()=>{const select=field('Objecttype en versie');select.value=definition.id;await select.fire('change');};await choose();
 return {...f,i:f.context.FoundlyI18n,box,core,ctx,actor,definition,record,calls,writes,exported,field,button,find,choose,deny(){denied=true;},allow(){denied=false;},lose(){lose=true;},malformed(){malformed=true;},hold(path){holdPath=path;let release;hold=new Promise(resolve=>release=resolve);release.started=new Promise(resolve=>started=resolve);return release;}};
}
module.exports={fixture,ObjectView};
