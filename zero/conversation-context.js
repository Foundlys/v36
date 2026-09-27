'use strict';
const C=require('./contracts');

// Only a server-owned, currently authorized reader may supply this history.
// Keep complete recent messages: cutting a correction/negation in half could
// invert its meaning. Omitted history is explicit, never claimed as remembered.
const LIMITS=Object.freeze({max_messages:24,max_message_characters:8000,max_bytes:16000});
function conversationContext(readHistory=()=>[]){
 if(typeof readHistory!=='function')C.fail('zero_conversation_reader_invalid',500);
 const rows=readHistory();if(!Array.isArray(rows))C.fail('zero_conversation_history_invalid',500);
 const recent=rows.slice(-LIMITS.max_messages),messages=[];
 let used=2;
 for(const row of recent.reverse()){
  if(!row||!['user','assistant'].includes(row.role)||typeof row.content!=='string')continue;
  if(row.content.length>LIMITS.max_message_characters)break;
  const message={role:row.role,content:row.content},bytes=Buffer.byteLength(JSON.stringify(message))+(messages.length?1:0);
  if(used+bytes>LIMITS.max_bytes)break;
  messages.unshift(message);used+=bytes;
 }
 return {messages,untrusted_data:true,source:'AUTHORIZED_CONVERSATION',limits:{...LIMITS,used_bytes:used},omitted_messages:rows.length-messages.length};
}
module.exports={conversationContext,LIMITS};
