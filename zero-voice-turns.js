'use strict';
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.FoundlyVoiceTurns=api.VoiceTurns;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 const fail=code=>Object.assign(Error(code),{code});
 class VoiceTurns{
  constructor({session='voice',timeout_ms=4000}={}){this.session=session;this.timeout=timeout_ms;this.items=new Map();this.responses=new Map();this.current=null;}
  start(itemId){
   if(typeof itemId!=='string'||!itemId||itemId.length>160)return;
   if(this.current&&this.current!==itemId)this.items.get(this.current)?.cancel?.();
   this.current=itemId;if(!this.items.has(itemId))this.items.set(itemId,{id:itemId,transcript:null,pending:null});
   if(this.items.size>200)for(const key of this.items.keys()){if(key!==itemId)this.items.delete(key);if(this.items.size<=100)break;}
  }
  transcript(itemId,text){
   const item=this.items.get(itemId);if(!item||itemId!==this.current||typeof text!=='string'||!text.trim()||text.length>4000)return false;
   if(item.transcript!==null&&item.transcript!==text.trim()){item.cancel?.();return false;}
   item.transcript=text.trim();item.ready?.();return true;
  }
  response(responseId){if(responseId&&this.current)this.responses.set(responseId,this.current);if(this.responses.size>300)this.responses.delete(this.responses.keys().next().value);}
  async execute(call,dispatch){
   const itemId=this.responses.get(call?.response_id),item=this.items.get(itemId);
   if(!item||itemId!==this.current)throw fail('voice_utterance_unavailable');
   // Deduplicate by the actual audio item, not the model's chosen call ID.
   if(item.pending)return item.pending;
   item.pending=(async()=>{
    if(!item.transcript){let timer;try{await new Promise((resolve,reject)=>{item.ready=resolve;item.cancel=()=>reject(fail('voice_utterance_interrupted'));timer=setTimeout(()=>reject(fail('voice_transcript_unavailable')),this.timeout);});}finally{clearTimeout(timer);item.ready=null;item.cancel=null;}}
    if(this.current!==itemId)throw fail('voice_utterance_interrupted');
    // Model arguments never substitute for a completed user transcription.
    return dispatch({message:item.transcript,turn_id:'voice:'+this.session+':'+itemId,item_id:itemId});
   })();return item.pending;
  }
  close(){for(const item of this.items.values())item.cancel?.();this.current=null;this.responses.clear();}
 }
 return {VoiceTurns};
});
