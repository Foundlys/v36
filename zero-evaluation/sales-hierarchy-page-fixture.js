'use strict';
const {page:forecastPage}=require('./sales-forecast-page-fixture');
async function page(options={}){
 const f=await forecastPage({entity:'forecast_hierarchies',...options});f.i.setLocale('nl-NL');
 const labels={title:'Hiërarchienaam',key:'Hiërarchiecode',version:'Versienummer',readers:'Lezer-ID’s (één per regel)',confirm:'Ik bevestig deze nieuwe hiërarchieversie',node_id:'Nodecode',node_label:'Nodenaam',node_parent:'Oudernodecode (leeg voor hoofdnode)',node_owners:'Eigenaar-ID’s (één per regel)',catalog:'Bewaarde hiërarchieversie',node:'Prognosenode',from:'Van',to:'Tot en met',currency:'Valuta (leeg voor alle)',pipeline:'Pipeline-ID (leeg voor alle toegankelijke)'},actions={create:'Nieuwe hiërarchie',new_version:'Nieuwe hiërarchieversie',save:'Hiërarchieversie bewaren',refresh:'Hiërarchieën verversen',add_node:'Node toevoegen',remove_node:'Node verwijderen',calculate:'Nodeprognose berekenen'};
 const box=()=>f.content.children[1],field=(name,host=f.content)=>host.all().find(n=>n.getAttribute?.('data-hierarchy-field')===name)||f.fieldIn(host,labels[name]),control=(name,host=f.content)=>host.all().find(n=>n.getAttribute?.('data-hierarchy-action')===name)||f.find(host,'button',actions[name]);
 async function fill(){await control('create').fire('click');for(const [k,v]of Object.entries({title:'Literal private hierarchy draft',key:'fixture_team',node_owners:f.actor.id})){field(k).value=v;await field(k).fire('input');}field('confirm').checked=true;await field('confirm').fire('change');}
 return {...f,box,field,control,fill,submit:()=>control('save').parentElement.fire('submit'),writes:()=>f.forecastCalls.filter(c=>c.method==='PUT'),recoveries:()=>f.forecastCalls.filter(c=>c.route.endsWith('/hierarchy-requests/recover'))};
}
module.exports={page};
