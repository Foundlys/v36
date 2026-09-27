'use strict';
// This gate only narrows legacy natural-language mutation detection. It cannot
// create a tool, authorize a high-risk action or replace typed native approvals.
const DISCUSSION=/^(?:how\b|why\b|what\b|explain\b|describe\b|compare\b|suppose\b|imagine\b|if\b|hoe\b|waarom\b|wat\b|leg\s+uit\b|beschrijf\b|vergelijk\b|stel\s+dat\b|als\b|wie\b|warum\b|was\b|erkläre\b|wenn\b|comment\b|pourquoi\b|explique\b|si\b|cómo\b|por\s+qué\b|explica\b|hvis\b|hvordan\b|hvorfor\b|förklara\b|hur\b|varför\b|om\b)/iu;
const COMMAND=/^(?:(?:please|graag|alstublieft|bitte|s'il vous plaît|por favor|venligst|vær så snill|snälla)\s+)?(?:(?:kun|wil|kan|zou)\s+je\s+|(?:can|could|will|would)\s+you\s+)?(?:sync|synchroniseer|ververs|haal|update|herstel|controleer|test|voeg|registreer|maak|ontwerp|bouw|plan|zet|genereer|stel\s+op|schrijf|bereid|create|design|build|generate|add|schedule|draft|prepare|refresh|erstelle|plane|crée|créer|prépare|planifie|crea|prepara|programa|opret|planlæg|opprett|lag|planlegg|skapa|planera)\b/iu;
const NEGATION=/\b(?:niet|nooit|don't|do\s+not|never|not\s+yet|nicht|niemals|pas|jamais|no\s+(?:crees|hagas|ejecutes)|ikke|aldrig|inte)\b/iu;
function naturalMutationAllowed(message){
 const q=String(message||'').normalize('NFKC').trim().replace(/^(?:zero|jarvis)[,:]?\s+/iu,'');
 return Boolean(q&&!DISCUSSION.test(q)&&!NEGATION.test(q)&&COMMAND.test(q));
}
function discussionOnly(message){const q=String(message||'').normalize('NFKC').trim();return DISCUSSION.test(q)||NEGATION.test(q);}
module.exports={naturalMutationAllowed,discussionOnly};
