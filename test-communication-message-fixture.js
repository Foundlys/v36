'use strict';
// Isolated test preload only. This file is never loaded by the application.
// It supplies deterministic retained mail in lieu of authenticated provider input.
require('./test-identity-body-barrier');
const fs=require('node:fs'),{BusinessDomain}=require('./business-domains');
const original=BusinessDomain.prototype.bucket,applied=new WeakMap();
BusinessDomain.prototype.bucket=function(ctx,entity){
 const rows=original.call(this,ctx,entity),file=process.env.FOUNDLY_MESSAGE_SOURCE_FIXTURE;
 if(this.id==='communication'&&entity==='messages'&&file&&fs.existsSync(file)){
  const input=fs.readFileSync(file,'utf8');
  if(applied.get(rows)!==input){const source=JSON.parse(input);if(source.fixture!=='RETAINED_MESSAGE_CONTRACT_NOT_LIVE')throw Error('Explicit message fixture required');const index=rows.findIndex(row=>row.id===source.id);if(index<0)rows.push(source);else rows[index]=source;applied.set(rows,input);}
 }return rows;
};
