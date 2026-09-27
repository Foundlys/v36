'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {isConfirmation}=require('../zero-confirmation');
test('explicit approval is exact across eight languages; quoted, negative and partial phrases cannot approve',()=>{
 for(const text of ['Bevestig dit.','I confirm','Ich bestätige','Je confirme','Sí, confirmo','Ja, bekræft','Jeg bekrefter','Jag bekräftar'])assert.equal(isConfirmation(text),true,text);
 for(const text of ['Do not confirm','Ik bevestig niet','What if I confirm','"confirm"','No confirmo','Ikke bekræft','Bekräfta inte','confirm and pay another invoice','confi','ja'])assert.equal(isConfirmation(text),false,text);
});
