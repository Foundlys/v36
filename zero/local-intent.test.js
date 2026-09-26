'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {isTimeRequest,isWeatherRequest}=require('./local-intent');
test('clock/weather shortcuts require a complete request rather than incidental business or emotional language',()=>{
 for(const text of ['Ik heb weinig tijd en raak gefrustreerd door onduidelijke prioriteiten.','Dit kost me te veel tijd.','Ik baal dat dit weer gebeurt.','Leg dit nog een keer uit, zonder weer dezelfde vraag te stellen.','Ik heb hier veel tijd in gestoken.','Help me de tijd tussen klantreacties vergelijken.','Welke datum moet op de factuur staan?','Hoe laat komt mijn levering?','Hoe is de temperatuur van de motor?','De planning liep door regen mis; help me prioriteren.','Nu weer serieus: help me met deze fout.']){
  assert.equal(isTimeRequest(text),false,text);assert.equal(isWeatherRequest(text),false,text);
 }
 for(const text of ['Hoe laat is het?','Hoe laat is het in New York?','Welke dag is het vandaag?','Wat is de datum?','ZERO, zeg me hoe laat het is.','tijd nu','Kun je me vertellen hoe laat het is in Amsterdam?'])assert.equal(isTimeRequest(text),true,text);
 for(const text of ['Hoe is het weer?','Weer morgen in Amsterdam','Regent het morgen?','Wat voor weer wordt het in Utrecht?','Hoe warm is het vandaag?','ZERO, weerbericht voor Brussel.'])assert.equal(isWeatherRequest(text),true,text);
});
