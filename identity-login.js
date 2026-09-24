'use strict';
(()=>{
  const i18n=globalThis.FoundlyI18n,form=document.getElementById('identityForm'),username=document.getElementById('identityUsername'),password=document.getElementById('identityPassword'),button=document.getElementById('identitySubmit'),notice=document.getElementById('identityNotice'),locale=document.getElementById('identityLocale');
  let invitation=new URLSearchParams(location.hash.slice(1)).get('invite'),localeChanged=false;
  locale.value=i18n.locale;locale.addEventListener('change',()=>{i18n.setLocale(locale.value);localeChanged=true;});
  function label(id,key){i18n.bind(document.getElementById(id),key);}
  if(invitation){history.replaceState(null,'','/login');label('identityTitle','identity.activate_title');label('identityDescription','identity.invitation_help');document.getElementById('usernameLabel').hidden=true;username.disabled=true;password.minLength=15;password.autocomplete='new-password';label('identitySubmit','identity.activate');}
  for(const input of [username,password]){input.addEventListener('invalid',()=>{input.setCustomValidity(i18n.t(input.validity.tooShort?'identity.password_invalid':'common.required'));});input.addEventListener('input',()=>input.setCustomValidity(''));}
  async function request(path,payload,method='POST'){
    let response;try{response=await fetch(path,{method,credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});}catch{throw new Error(i18n.t('common.offline'));}
    let result;try{result=await response.json();}catch{throw new Error(i18n.t('common.request_failed'));}if(!response.ok)throw Object.assign(new Error(i18n.error(result.code,response.status)),{code:result.code,status:response.status});return result;
  }
  form.addEventListener('submit',async event=>{event.preventDefault();button.disabled=true;label('identityNotice','common.wait');try{
    if(invitation){const result=await request('/api/identity/enroll',{invite_token:invitation,password:password.value});invitation=null;username.value=result.member.username;username.disabled=false;document.getElementById('usernameLabel').hidden=false;label('identityTitle','identity.sign_in');label('identityDescription','identity.description');password.autocomplete='current-password';password.minLength=0;label('identitySubmit','identity.sign_in');}
    await request('/api/identity/login',{username:username.value.trim(),password:password.value});password.value='';
    if(localeChanged)await request('/api/zero/preferences',{ui_locale:i18n.locale},'PUT');location.assign('/');
  }catch(error){notice.removeAttribute('data-i18n');notice.textContent=error.message;}finally{button.disabled=false;}});
})();
