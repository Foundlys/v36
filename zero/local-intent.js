'use strict';
// These deterministic shortcuts answer a complete narrow request. A word such
// as Dutch "weer" (again) or "tijd" (time/attention) is not enough to interrupt
// a business conversation. Other/compound phrasing stays with normal reasoning.
function question(message){
 return String(message||'').normalize('NFKC').trim().toLowerCase()
  .replace(/^(?:zero|jarvis)[,:]?\s+/u,'')
  .replace(/^(?:kun je|kunt u|kan je|wil je)\s+(?:(?:me|mij)\s+)?(?:vertellen|zeggen)\s+/u,'')
  .replace(/^(?:vertel|zeg)\s+(?:(?:me|mij)\s+)?/u,'')
  .replace(/[?!.]+$/u,'').trim();
}
function isTimeRequest(message){
 const q=question(message);
 return /^(?:hoe laat(?: is het| het is)?|wat is (?:de|het) (?:(?:huidige|actuele) )?(?:tijd|tijdstip)|welke (?:dag|datum) is het|wat is de datum|datum vandaag|tijd(?:stip|zone)?)(?:\s+(?:nu|vandaag))?(?:\s+(?:in|voor)\s+[\p{L}\p{N}_/ .'-]{2,80})?$/u.test(q);
}
function isWeatherRequest(message){
 const q=question(message);
 return /^(?:hoe (?:is|wordt) het weer|wat (?:is|wordt) het weer|wat voor weer (?:is|wordt) het|weersverwachting|weerbericht|(?:het )?weer|temperatuur|hoe warm (?:is|wordt) het|hoeveel graden (?:is|wordt) het|(?:gaat het|zal het) (?:regenen|sneeuwen)|(?:regent|sneeuwt) het|(?:is|wordt) het (?:zonnig|bewolkt))(?:(?:\s+(?:nu|vandaag|morgen|overmorgen|vanmiddag|vanavond))|(?:\s+(?:in|voor)\s+[\p{L}\p{N} .'-]{2,80})){0,2}$/u.test(q);
}
module.exports={isTimeRequest,isWeatherRequest};
