(function(root,factory){'use strict';if(typeof module==='object'&&module.exports)module.exports=factory(require('./foundly-locales'));else root.FoundlyI18n=factory(root.FoundlyLocales,root);})(typeof globalThis!=='undefined'?globalThis:this,function(catalog,root){
  'use strict';
  const aliases={nl:'nl-NL',en:'en-GB',de:'de-DE',fr:'fr-FR',es:'es-ES',da:'da-DK',nb:'nb-NO',no:'nb-NO',sv:'sv-SE'};
  function normalize(value){const locale=aliases[value]||value;if(!catalog.locales.includes(locale))throw Error('locale_unsupported');return locale;}
  function create(value='nl-NL'){
    let locale=normalize(value);const missing=new Set();
    function t(key,params={}){let text=catalog.messages[locale][key];if(text&&typeof text==='object'){if(!Number.isFinite(params.count))throw Error('plural_count_required');text=text[new Intl.PluralRules(locale).select(params.count)]||text.other;}
      if(typeof text!=='string'){missing.add(key);return '⟦'+key+':'+locale+'⟧';}
      return text.replace(/\{([a-z_][a-z_0-9]*)\}/g,(_,name)=>{if(!Object.hasOwn(params,name))throw Error('translation_parameter_required:'+name);return name==='count'&&typeof params[name]==='number'?new Intl.NumberFormat(locale).format(params[name]):String(params[name]);});}
    const valid=value=>typeof value==='number'&&Number.isFinite(value);
    return {get locale(){return locale;},setLocale(value){locale=normalize(value);missing.clear();return locale;},t,
      number(value,options={}){return valid(value)?new Intl.NumberFormat(locale,options).format(value):t('common.unknown');},
      currency(value,currency){return valid(value)&&/^[A-Z]{3}$/.test(currency||'')?new Intl.NumberFormat(locale,{style:'currency',currency}).format(value):t('common.unknown');},
      currencyCents(value,currency){
        // Native Finance amounts are exact hundredths. Keep the integer and
        // fraction separate so division through Number cannot round a cent.
        if(!/^[A-Z]{3}$/.test(currency||'')||!(typeof value==='bigint'||Number.isSafeInteger(value)||typeof value==='string'&&/^-?\d{1,40}$/.test(value)))return t('common.unknown');
        const cents=BigInt(value),negative=cents<0n,absolute=negative?-cents:cents,whole=absolute/100n;
        const parts=new Intl.NumberFormat(locale,{style:'currency',currency,minimumFractionDigits:2,maximumFractionDigits:2}).formatToParts(negative?(whole===0n?-0:-whole):whole);
        const fraction=new Intl.NumberFormat(locale,{minimumIntegerDigits:2,useGrouping:false}).format(absolute%100n);
        return parts.map(part=>part.type==='fraction'?fraction:part.value).join('');
      },
      date(value,{timeZone='UTC',...options}={}){if(value===null||value===undefined||value==='')return t('common.unknown');const date=new Date(value);return Number.isFinite(date.getTime())?new Intl.DateTimeFormat(locale,{timeZone,...options}).format(date):t('common.unknown');},
      missingKeys(){return [...missing];}};
  }
  if(!root?.document)return {create,normalize,locales:catalog.locales};
  const document=root.document,anonymous=root.location.pathname==='/login';
  let initial='nl-NL';if(!anonymous)try{initial=normalize(document.documentElement.lang);}catch{}
  if(anonymous)for(const language of root.navigator.languages||[root.navigator.language]){try{initial=normalize(language);break;}catch{try{initial=normalize(language?.split('-')[0]);break;}catch{}}}
  const api=create(initial),allowedAttributes=['aria-label','title','placeholder','alt'],bindings=new WeakMap(),parameters=new WeakMap(),messages=new WeakMap();
  api.forLocale=value=>create(value);
  function paint(owner,target,slot,key,read,write,format=value=>value){
    const currentTarget=typeof target==='function'?target:()=>target;
    if(!currentTarget())return;let state=bindings.get(owner);if(!state){state=new Map();bindings.set(owner,state);}const previous=state.get(slot);
    // Native renderers may replace a placeholder with customer content. An old
    // static label must never overwrite that content on a later locale change.
    if(previous&&previous.key===key&&(previous.target!==currentTarget()||previous.value!==read()))return;
    const value=format(api.t(key,parameters.get(owner)?.get(slot)||{}));write(value);state.set(slot,{key,target:currentTarget(),value});
  }
  const selector='[data-i18n],[data-i18n-text],'+allowedAttributes.map(a=>'[data-i18n-'+a+']').join(',');
  api.translate=function(container=document){const nodes=Array.from(container.querySelectorAll(selector));if(container.matches?.(selector))nodes.unshift(container);
    for(const node of nodes){
      const key=node.getAttribute('data-i18n');if(key){const target=()=>node.firstChild||node;paint(node,target,'text',key,()=>target().textContent,value=>target().textContent=value);}
      const direct=node.getAttribute('data-i18n-text');if(direct){const keys=JSON.parse(direct);for(const [index,key]of Object.entries(keys)){const text=node.childNodes?.[Number(index)];if(text?.nodeType!==3)continue;const owned=parameters.get(node)?.has('direct:'+index),prefix=owned?'':text.textContent.match(/^\s*/)[0],suffix=owned?'':text.textContent.match(/\s*$/)[0];paint(node,text,'direct:'+index,key,()=>text.textContent,value=>text.textContent=value,value=>prefix+value+suffix);}}
      for(const attr of allowedAttributes){const k=node.getAttribute('data-i18n-'+attr);if(k)paint(node,node,attr,k,()=>node.getAttribute(attr),value=>node.setAttribute(attr,value));}}
    for(const selector of document.querySelectorAll('[data-ui-locale]'))selector.value=api.locale;
    document.documentElement.lang=api.locale;};
  let localeRevision=0;
  const change=api.setLocale;api.setLocale=function(value){change(value);localeRevision++;api.translate();document.dispatchEvent(new CustomEvent('foundly:locale',{detail:{locale:api.locale}}));return api.locale;};
  function resetTextOwnership(node){
    // An explicit native repaint starts a new owned text layout. Retire direct
    // slots too, otherwise a later deliberate binding sees obsolete text nodes.
    // Ordinary DOM writes still retain the customer-content protection in paint.
    for(const state of [bindings.get(node),parameters.get(node)])if(state)for(const slot of state.keys())if(slot==='text'||slot.startsWith('direct:'))state.delete(slot);
  }
  api.bind=function(node,key,attribute,params={}){
    if(attribute&&!allowedAttributes.includes(attribute))throw Error('translation_attribute_unsupported');
    const slot=attribute||'text';if(!attribute)resetTextOwnership(node);let values=parameters.get(node);if(!values){values=new Map();parameters.set(node,values);}values.set(slot,Object.freeze({...params}));
    node.setAttribute(attribute?'data-i18n-'+attribute:'data-i18n',key);if(!attribute)node.removeAttribute('data-i18n-text');else bindings.get(node)?.delete(slot);
    if(attribute)paint(node,node,attribute,key,()=>node.getAttribute(attribute),value=>node.setAttribute(attribute,value));else{const target=()=>node.firstChild||node;paint(node,target,'text',key,()=>target().textContent,value=>target().textContent=value);}return node;
  };
  api.bindText=function(node,index,key,params={}){
    const target=node.childNodes?.[index];if(!Number.isInteger(index)||index<0||target?.nodeType!==3)throw Error('translation_text_node_required');
    const slot='direct:'+index,keys=JSON.parse(node.getAttribute('data-i18n-text')||'{}');keys[index]=key;
    node.removeAttribute('data-i18n');node.setAttribute('data-i18n-text',JSON.stringify(keys));
    const state=bindings.get(node);state?.delete('text');state?.delete(slot);
    let values=parameters.get(node);if(!values){values=new Map();parameters.set(node,values);}values.delete('text');values.set(slot,Object.freeze({...params}));
    // Explicit fragments own the whole text node. Whitespace inside their
    // parameters is source content, not static markup padding to repeat.
    paint(node,target,slot,key,()=>target.textContent,value=>target.textContent=value);return node;
  };
  // Only an explicit descriptor created by this instance can become a live
  // binding. Ordinary strings and customer-shaped objects remain literal.
  api.message=function(key,params={}){const values=Object.freeze({...params}),message=Object.freeze({toString:()=>api.t(key,values)});messages.set(message,{key,params:values});return message;};
  api.renderText=function(node,value){const message=messages.get(value);if(message)return api.bind(node,message.key,undefined,message.params);
    node.removeAttribute('data-i18n');node.removeAttribute('data-i18n-text');resetTextOwnership(node);parameters.get(node)?.delete('text');node.textContent=String(value??'');return node;};
  api.renderAttribute=function(node,attribute,value){if(!allowedAttributes.includes(attribute))throw Error('translation_attribute_unsupported');const message=messages.get(value);if(message)return api.bind(node,message.key,attribute,message.params);
    node.removeAttribute('data-i18n-'+attribute);bindings.get(node)?.delete(attribute);parameters.get(node)?.delete(attribute);node.setAttribute(attribute,String(value??''));return node;};
  api.errorKey=function(code,status){const known={'identity_credentials_invalid':'identity.credentials_invalid','identity_invitation_invalid':'identity.invitation_invalid','identity_password_invalid':'identity.password_invalid','identity_auth_required':'identity.auth_required','auth_invalid':'identity.auth_required'};return (Object.hasOwn(known,code)?known[code]:null)||(status===429?'common.rate_limited':status===403?'common.access_denied':'common.request_failed');};
  api.error=function(code,status){return api.t(api.errorKey(code,status));};
  api.installLocaleControl=function(selector){
    selector.replaceChildren(...catalog.locales.map((locale,i)=>{const option=document.createElement('option');option.value=locale;option.textContent=catalog.names[i];return option;}));selector.value=api.locale;
    const notice=document.createElement('output');notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');selector.after(notice);
    selector.addEventListener('change',async()=>{const previous=api.locale,next=normalize(selector.value);selector.disabled=true;notice.textContent='';try{
      const response=await root.fetch('/api/zero/preferences',{method:'PUT',credentials:'same-origin',signal:root.AbortSignal?.timeout?.(5000),headers:{'content-type':'application/json'},body:JSON.stringify({ui_locale:next})});
      if(!response.ok){let result={};try{result=await response.json();}catch{}throw Object.assign(Error(api.error(result.code,response.status)),{localized:true});}
      const result=await response.json();api.setLocale(result.preferences.ui_locale);
    }catch(error){selector.value=previous;notice.textContent=error.localized?error.message:api.t('common.request_failed');}finally{selector.disabled=false;}});
  };
  const initialRevision=localeRevision;
  api.ready=anonymous?Promise.resolve():root.fetch('/api/zero/preferences',{credentials:'same-origin',signal:root.AbortSignal?.timeout?.(5000),headers:{accept:'application/json'}}).then(async response=>{if(!response.ok)return;const body=await response.json();if(body.preferences?.ui_locale&&localeRevision===initialRevision)api.setLocale(body.preferences.ui_locale);}).catch(()=>{});
  api.translate();for(const selector of document.querySelectorAll('[data-ui-locale]'))api.installLocaleControl(selector);return api;
});
