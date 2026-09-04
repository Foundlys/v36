'use strict';

(function exposeSpeechFormatter(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.FoundlySpeechFormatter=api;
})(typeof globalThis!=='undefined'?globalThis:this,function buildSpeechFormatter(){
  const SMALL=['nul','een','twee','drie','vier','vijf','zes','zeven','acht','negen','tien','elf','twaalf','dertien','veertien','vijftien','zestien','zeventien','achttien','negentien'];
  const TENS=['','','twintig','dertig','veertig','vijftig','zestig','zeventig','tachtig','negentig'];
  const UNIT_JOIN=['','eenen','tweeën','drieën','vieren','vijfen','zesen','zevenen','achten','negenen'];
  const LETTERS={A:'aa',B:'bee',C:'see',D:'dee',E:'ee',F:'ef',G:'gee',H:'haa',I:'ie',J:'jee',K:'kaa',L:'el',M:'em',N:'en',O:'oo',P:'pee',Q:'kuu',R:'er',S:'es',T:'tee',U:'uu',V:'vee',W:'wee',X:'iks',Y:'ij',Z:'zet'};
  const MONTHS=['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december'];
  const clampText=(value,limit=12000)=>String(value??'').slice(0,Math.max(0,limit));
  function decodePresentationEntities(value){const named={amp:'en',lt:' ',gt:' ',quot:'',apos:'',nbsp:' '};return String(value).replace(/&(#x?[0-9a-f]+|amp|lt|gt|quot|apos|nbsp);/gi,(_,entity)=>{if(entity[0]==='#'){const hex=entity[1]?.toLowerCase()==='x',code=parseInt(entity.slice(hex?2:1),hex?16:10);return Number.isFinite(code)?String.fromCodePoint(Math.min(code,0x10ffff)):' '}return named[entity.toLowerCase()]??' '})}

  function integerToDutch(value){
    let n=Math.trunc(Math.abs(Number(value)||0));
    if(n<20)return SMALL[n];
    if(n<100){const tens=Math.floor(n/10),unit=n%10;return unit?`${UNIT_JOIN[unit]}${TENS[tens]}`:TENS[tens]}
    if(n<1000){const hundreds=Math.floor(n/100),rest=n%100;return `${hundreds===1?'':integerToDutch(hundreds)}honderd${rest?' '+integerToDutch(rest):''}`}
    if(n<1000000){const thousands=Math.floor(n/1000),rest=n%1000;return `${thousands===1?'':integerToDutch(thousands)}duizend${rest?' '+integerToDutch(rest):''}`}
    if(n<1000000000){const millions=Math.floor(n/1000000),rest=n%1000000;return `${integerToDutch(millions)} miljoen${rest?' '+integerToDutch(rest):''}`}
    return String(n).split('').map(d=>SMALL[Number(d)]).join(' ');
  }

  function numberToDutch(raw){
    const source=String(raw||'').trim(),negative=source.startsWith('-'),unsigned=source.replace(/^-/,'');
    const normalized=unsigned.replace(/[.\s](?=\d{3}(?:\D|$))/g,'');
    const [wholeRaw,decimalRaw]=normalized.split(',');
    const whole=integerToDutch(Number(wholeRaw||0));
    const decimal=decimalRaw?` komma ${decimalRaw.split('').map(d=>SMALL[Number(d)]||d).join(' ')}`:'';
    return `${negative?'min ':''}${whole}${decimal}`;
  }

  function sanitizeForSpeech(value,{locale='nl-NL',limit=12000}={}){
    let text=decodePresentationEntities(clampText(value,limit).normalize('NFKC'))
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,' ')
      .replace(/```[\s\S]*?```/g,block=>block.replace(/```[^\n]*\n?/g,'').replace(/```/g,''))
      .replace(/!\[([^\]]*)\]\([^)]*\)/g,'$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g,'$1')
      .replace(/\\([#*_`~>\-|\[\]{}])/g,'$1')
      .replace(/<br\s*\/?>/gi,'. ')
      .replace(/<[^>]+>/g,' ')
      .replace(/^\s{0,3}#{1,6}\s*/gm,'')
      .replace(/^\s{0,3}>\s?/gm,'')
      .replace(/^\s{0,3}(?:[-+*•]|\d+[.)])\s+/gm,'')
      .replace(/^\s*\|?(?:\s*:?-{3,}:?\s*\|)+\s*$/gm,'')
      .replace(/\|/g,', ')
      .replace(/~~([^~]+)~~/g,'$1')
      .replace(/[*_`]+/g,'')
      .replace(/\b[a-z][a-z0-9+.-]*:\/\/[^\s)]+/gi,'een webadres')
      .replace(/\bwww\.[^\s)]+/gi,'een webadres')
      .replace(/\bmailto:[^\s)]+/gi,'een e-mailadres')
      .replace(/\b([A-Z0-9._%+-]+)@([A-Z0-9.-]+)\.([A-Z]{2,})\b/gi,(_,user,host,tld)=>`${user.replace(/[._-]+/g,' ')} apenstaartje ${host.replace(/[.-]+/g,' punt ')} punt ${tld}`);

    if(/^nl(?:-|$)/i.test(locale)){
      text=text
        .replace(/€\s*(-?\d{1,3}(?:[.\s]\d{3})*(?:,\d+)?|-?\d+(?:,\d+)?)/g,(_,n)=>`${numberToDutch(n)} euro`)
        .replace(/\b(-?\d+(?:,\d+)?)\s*%/g,(_,n)=>`${numberToDutch(n)} procent`)
        .replace(/\b(0?[1-9]|[12]\d|3[01])[-/.](0?[1-9]|1[0-2])[-/.](19\d{2}|20\d{2}|21\d{2})\b/g,(_,day,month,year)=>`${integerToDutch(Number(day))} ${MONTHS[Number(month)-1]} ${integerToDutch(Number(year))}`)
        .replace(/\b([01]?\d|2[0-3]):([0-5]\d)\b/g,(_,h,m)=>`${integerToDutch(Number(h))} uur${Number(m)?' '+integerToDutch(Number(m)):''}`)
        .replace(/\b(19\d{2}|20\d{2}|21\d{2})\b/g,(_,year)=>integerToDutch(Number(year)))
        .replace(/\b(\d+(?:,\d+)?)\s*km\/u\b/gi,(_,n)=>`${numberToDutch(n)} kilometer per uur`)
        .replace(/\b(\d+(?:,\d+)?)\s*km\b/gi,(_,n)=>`${numberToDutch(n)} kilometer`)
        .replace(/\b([A-Za-z]{1,12})(\d{1,3})([A-Za-z])?\b/g,(_,prefix,n,suffix)=>{const spokenPrefix=/^xdrive$/i.test(prefix)?'iks drive':(/^[A-Z]{1,6}$/.test(prefix)?prefix.split('').map(letter=>LETTERS[letter]||letter).join(' '):prefix);const spokenSuffix=suffix?(LETTERS[suffix.toUpperCase()]||suffix):'';return `${spokenPrefix} ${integerToDutch(Number(n))}${spokenSuffix?' '+spokenSuffix:''}`})
        .replace(/\b[A-Z]{2,6}\b/g,word=>word.split('').map(letter=>LETTERS[letter]||letter).join(' '));
    }

    return text
      .replace(/[{}\[\]<>*_`#~\\^]/g,' ')
      .replace(/(^|\s)>+(?=\s|$)/g,'$1')
      .replace(/\s+([,.;:!?])/g,'$1')
      .replace(/([,.;:!?]){2,}/g,'$1')
      .replace(/[ \t]+/g,' ')
      .replace(/\n\s*\n+/g,'. ')
      .replace(/\s*\n\s*/g,'. ')
      .replace(/\.{2,}/g,'.')
      .replace(/^[,;:\s]+|[,;:\s]+$/g,'')
      .trim();
  }

  function formatJarvisResponse(value,options={}){
    const display_text=clampText(value,options.limit||20000);
    return {display_text,spoken_text:sanitizeForSpeech(display_text,{locale:options.locale||'nl-NL',limit:options.spokenLimit||12000})};
  }

  return {sanitizeForSpeech,formatJarvisResponse,numberToDutch,integerToDutch};
});
