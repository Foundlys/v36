'use strict';
const C=require('./contracts');
const MODULES=new Set(['crm','sales','finance','procurement','marketing','calendar','communication','automation']);
// Deliberately bounded whole-message forms. These preserve a read selection;
// they are not general intent recognition and never authorize an action.
const FORMS=[
 /^(?:maak (?:het|dat|je antwoord) (?:korter|concreter)|leg (?:dit|dat) (?:(?:kort|uitgebreider) )?uit|geef (?:me )?(?:(?:alleen )?(?:de|één|een) )?(?:volgende|eerstvolgende) (?:controle|stap)|wat bedoel je daarmee|waarom die keuze)[.?!]?$/iu,
 /^(?:make (?:it|that|your answer) (?:shorter|more concrete)|explain (?:that|this)(?: (?:briefly|in more detail))?|give me (?:only )?the next (?:check|step)|what do you mean by that|why that choice)[.?!]?$/iu,
 /^(?:mach (?:es|das) kürzer|erkläre das kurz|warum diese wahl)[.?!]?$/iu,
 /^(?:fais plus court|explique (?:cela|ça) brièvement|pourquoi ce choix)[.?!]?$/iu,
 /^(?:hazlo más breve|explica eso brevemente|por qué esa elección)[.?!]?$/iu,
 /^(?:gør det kortere|forklar det kort|hvorfor det valg)[.?!]?$/iu,
 /^(?:gjør det kortere|forklar det kort|hvorfor det valget)[.?!]?$/iu,
 /^(?:gör det kortare|förklara det kort|varför det valet)[.?!]?$/iu
];
function isReadFollowup(query){return typeof query==='string'&&query.length<=240&&FORMS.some(form=>form.test(query.normalize('NFKC').trim()));}
function reference(history,audit){
 if(!Array.isArray(history)||history.length<2||!audit)return null;
 const [user,answer]=history.slice(-2),snapshot=audit.result_snapshot,ref=snapshot?.zero_context_reference;
 if(user?.role!=='user'||answer?.role!=='assistant'||!audit.owner_id||user.owner_id!==audit.owner_id||answer.owner_id!==audit.owner_id||!audit.timestamp||user.at!==audit.timestamp||answer.at!==audit.timestamp||user.content!==audit.transcript)return null;
 if(!ref||ref.read_only!==true||snapshot.verification?.source_reverified!==true||ref.message_hash!==C.hash(user.content)||!Array.isArray(snapshot.actions)||snapshot.actions.length||!Array.isArray(audit.actions)||audit.actions.length)return null;
 const modules=ref.native_modules,analysis_id=snapshot.plan?.agent_plan_id;
 if(!Array.isArray(modules)||modules.length<2||modules.length>MODULES.size||new Set(modules).size!==modules.length||modules.some(m=>!MODULES.has(m))||typeof audit.turn_id!=='string'||!audit.turn_id||typeof analysis_id!=='string'||!analysis_id)return null;
 return {turn_id:audit.turn_id,analysis_id,modules:[...modules]};
}
module.exports={isReadFollowup,reference};
