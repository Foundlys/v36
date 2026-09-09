'use strict';
(()=>{
  const form=document.getElementById('identityForm'),username=document.getElementById('identityUsername'),password=document.getElementById('identityPassword'),button=document.getElementById('identitySubmit'),notice=document.getElementById('identityNotice');
  let invitation=new URLSearchParams(location.hash.slice(1)).get('invite');
  if(invitation){history.replaceState(null,'','/login');document.getElementById('identityTitle').textContent='Persoonlijk account activeren';document.getElementById('identityDescription').textContent='Kies een eigen wachtwoord van 15–128 tekens. De uitnodiging kan één keer worden gebruikt.';document.getElementById('usernameLabel').hidden=true;username.disabled=true;password.minLength=15;password.autocomplete='new-password';button.textContent='Account activeren';}
  async function request(path,payload){const response=await fetch(path,{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(payload)}),result=await response.json();if(!response.ok)throw new Error(result.error||'Aanmelden is niet gelukt.');return result;}
  form.addEventListener('submit',async event=>{event.preventDefault();button.disabled=true;notice.textContent='Even geduld…';try{
    if(invitation){const result=await request('/api/identity/enroll',{invite_token:invitation,password:password.value});invitation=null;username.value=result.member.username;username.disabled=false;document.getElementById('usernameLabel').hidden=false;document.getElementById('identityTitle').textContent='Aanmelden';password.autocomplete='current-password';button.textContent='Aanmelden';}
    await request('/api/identity/login',{username:username.value.trim(),password:password.value});password.value='';location.assign('/');
  }catch(error){notice.textContent=error.message;}finally{button.disabled=false;}});
})();
