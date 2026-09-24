'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {naturalMutationAllowed,discussionOnly}=require('./intent');
test('discussion, hypothetical, negative and quoted commands cannot authorize a mutation',()=>{
 for(const q of ['Hoe maak ik een taak voor morgen?','Leg uit: maak een lead Alice','What happens if I create a lead?','Erkläre: erstelle eine Aufgabe','Comment créer une tâche ?','Cómo crear una tarea','Hvordan opretter jeg en opgave?','Hvordan oppretter jeg en oppgave?','Hur skapar jag en uppgift?','Maak nog niet een taak','Create a task, but do not execute yet','"Maak een taak"','Vergelijk maak een taak met workflow aanmaken'])assert.equal(naturalMutationAllowed(q),false,q);
 assert.equal(discussionOnly('Wat als ik een factuur betaal?'),true);
});
test('explicit existing low-risk requests survive the gate without inventing tool support',()=>{
 for(const q of ['Maak een taak om Alice terug te bellen','Voeg lead Alice toe','ZERO, synchroniseer de connector','Kun je maak een rapport over voorraad','Prepare a draft','Create a task'])assert.equal(naturalMutationAllowed(q),true,q);
});
