'use strict';
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.FoundlyConfirmation=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 const phrases=['bevestig','bevestig dit','ja bevestig','ja bevestig dit','doe maar','akkoord','voer uit','yes','confirm','yes confirm','i confirm','bestätigen','bestätige','ja bestätigen','ich bestätige','genehmigen','je confirme','confirme','oui je confirme','confirmer','confirmo','confirmar','sí confirmo','yo confirmo','bekræft','ja bekræft','jeg bekræfter','bekreft','ja bekreft','jeg bekrefter','bekräfta','ja bekräfta','jag bekräftar'];
 const normalized=value=>String(value||'').normalize('NFKC').trim().toLocaleLowerCase().replace(/[.,!]+/g,' ').replace(/\s+/g,' ').trim();
 const accepted=new Set(phrases.map(normalized));return {isConfirmation:value=>accepted.has(normalized(value))||/^(?:ja )?(?:bevestig|doe maar|akkoord|voer uit|yes|confirm)(?: dit)?$/.test(normalized(value))};
});
