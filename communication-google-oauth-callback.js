'use strict';
// Runs on a fixed public return page. It only completes after an explicit
// same-origin action, preserving the application's SameSite=Strict session.
(()=>{
 const status=document.getElementById('mailOAuthStatus'),button=document.getElementById('mailOAuthComplete');let input=null,busy=false;
 try{const params=new URL(location.href).searchParams,keys=[...params.keys()];if(keys.some(key=>!['state','code','error','scope','authuser','prompt','hd'].includes(key)||params.getAll(key).length!==1)||!/^[A-Za-z0-9_-]{43}$/.test(params.get('state')||'')||!params.get('code')||params.get('code').length>8192||params.get('error'))throw Error();input=Object.fromEntries(params);}catch{status.textContent='De toestemming is onvolledig. Start een nieuwe aanvraag in Communication.';button.disabled=true;}
 // Authorization codes/state stay in this page's memory, never storage or DOM.
 history.replaceState(null,'','/communication');
 button.addEventListener('click',async()=>{if(busy||!input)return;busy=true;button.disabled=true;status.textContent='Mailtoestemming afronden…';try{const response=await fetch('/api/communication/mail-oauth/callback',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(input)});if(!response.ok){status.textContent=response.status===401?'Meld je opnieuw aan en start een nieuwe mailaanvraag.':response.status===403?'De huidige sessie heeft geen toegang tot deze aanvraag.':'De toestemming kon niet worden afgerond. Bekijk de mailtoegang in Communication.';return;}const result=await response.json();if(result.grant_available!==true)throw Error();input=null;location.assign('/communication');}catch{status.textContent='Het resultaat is niet beschikbaar. Je kunt deze bevestiging opnieuw controleren; een afgeronde aanvraag wisselt de code niet opnieuw uit.';button.disabled=false;}finally{busy=false;}});
})();
