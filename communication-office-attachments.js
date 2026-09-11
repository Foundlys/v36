'use strict';
// Bounded OOXML package inspection only; never render XML, follow relationships,
// extract filesystem paths, run macros or claim that an office file is safe.
const crypto=require('node:crypto'),zlib=require('node:zlib'),{ARCHIVE_BYTES,ARCHIVE_ENTRIES}=require('./communication-attachment-limits');
const fail=()=>{throw Object.assign(Error('Het Office-pakket is ongeldig, versleuteld of overschrijdt de inspectielimieten'),{code:'attachment_office_unavailable',statusCode:422});};
const table=Uint32Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc32(bytes){let crc=0xffffffff;for(const byte of bytes)crc=table[(crc^byte)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
function extraFields(bytes,start,length){const end=start+length;if(end>bytes.length)fail();for(let at=start;at<end;){if(at+4>end)fail();const id=bytes.readUInt16LE(at),size=bytes.readUInt16LE(at+2);if(![0x5455,0x000a,0x7875,0xa220].includes(id)||at+4+size>end)fail();at+=4+size;}}
const inspected=new Map();
function inspect(bytes,extension){
 const required={docx:'word/document.xml',xlsx:'xl/workbook.xml',pptx:'ppt/presentation.xml'}[extension];if(!required||!Buffer.isBuffer(bytes)||bytes.length<22)fail();const cacheKey=extension+':'+crypto.createHash('sha256').update(bytes).digest('hex');if(inspected.has(cacheKey))return {...inspected.get(cacheKey)};
 let end=-1;for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(bytes.readUInt32LE(i)===0x06054b50&&i+22+bytes.readUInt16LE(i+20)===bytes.length){end=i;break;}if(end<0||bytes.readUInt16LE(end+4)||bytes.readUInt16LE(end+6))fail();
 const count=bytes.readUInt16LE(end+10),size=bytes.readUInt32LE(end+12),offset=bytes.readUInt32LE(end+16);if(!count||count>ARCHIVE_ENTRIES||count!==bytes.readUInt16LE(end+8)||offset+size!==end)fail();
 const names=new Set(),ranges=[],parts=new Map();let pos=offset,total=0;
 for(let i=0;i<count;i++){
  if(pos+46>end||bytes.readUInt32LE(pos)!==0x02014b50)fail();const flags=bytes.readUInt16LE(pos+8),method=bytes.readUInt16LE(pos+10),crc=bytes.readUInt32LE(pos+16),compressed=bytes.readUInt32LE(pos+20),uncompressed=bytes.readUInt32LE(pos+24),nameLength=bytes.readUInt16LE(pos+28),extra=bytes.readUInt16LE(pos+30),comment=bytes.readUInt16LE(pos+32),disk=bytes.readUInt16LE(pos+34),attributes=bytes.readUInt32LE(pos+38),local=bytes.readUInt32LE(pos+42);
  if(flags&~0x080e||method===0&&(flags&6)||![0,8].includes(method)||disk||!nameLength||nameLength>512||pos+46+nameLength+extra+comment>end||compressed===0xffffffff||uncompressed===0xffffffff||local===0xffffffff||(attributes>>>16&0xf000)===0xa000)fail();
  const nameBytes=bytes.subarray(pos+46,pos+46+nameLength),name=nameBytes.toString('utf8');if(!Buffer.from(name).equals(nameBytes)||! /^[A-Za-z0-9_\[\]. -]+(?:\/[A-Za-z0-9_\[\]. -]+)*\/?$/.test(name)||name.split('/').some(part=>part==='.'||part==='..')||names.has(name.toLowerCase())||/(?:^|\/)(?:vba[^/]*|macros?[^/]*|activex|embeddings)(?:\/|$)/i.test(name))fail();names.add(name.toLowerCase());
  total+=uncompressed;if(total>ARCHIVE_BYTES||uncompressed>ARCHIVE_BYTES||local+30>offset||bytes.readUInt32LE(local)!==0x04034b50||bytes.readUInt16LE(local+6)!==flags||bytes.readUInt16LE(local+8)!==method||!(flags&8)&&(bytes.readUInt32LE(local+14)!==crc||bytes.readUInt32LE(local+18)!==compressed||bytes.readUInt32LE(local+22)!==uncompressed)||flags&8&&[[14,crc],[18,compressed],[22,uncompressed]].some(([at,value])=>![0,value].includes(bytes.readUInt32LE(local+at))))fail();
  const localName=bytes.readUInt16LE(local+26),localExtra=bytes.readUInt16LE(local+28),begin=local+30+localName+localExtra,finish=begin+compressed;let recordEnd=finish;if(flags&8){if(finish+12>offset)fail();const marker=bytes.readUInt32LE(finish)===0x08074b50?4:0;if(finish+marker+12>offset||bytes.readUInt32LE(finish+marker)!==crc||bytes.readUInt32LE(finish+marker+4)!==compressed||bytes.readUInt32LE(finish+marker+8)!==uncompressed)fail();recordEnd+=marker+12;}if(localName!==nameLength||!bytes.subarray(local+30,local+30+localName).equals(nameBytes)||finish>offset||ranges.some(([a,b])=>local<b&&recordEnd>a))fail();ranges.push([local,recordEnd]);
  extraFields(bytes,pos+46+nameLength,extra);extraFields(bytes,local+30+localName,localExtra);let content;try{content=method===0?bytes.subarray(begin,finish):zlib.inflateRawSync(bytes.subarray(begin,finish),{maxOutputLength:Math.max(1,uncompressed),info:true});if(method===8){if(content.engine.bytesWritten!==compressed)fail();content=content.buffer;}}catch{fail();}if(content.length!==uncompressed||crc32(content)!==crc)fail();if(['[Content_Types].xml','_rels/.rels',required].includes(name))parts.set(name,content);
  pos+=46+nameLength+extra+comment;
 }
 ranges.sort((a,b)=>a[0]-b[0]);if(pos!==end||ranges[0][0]!==0||ranges.at(-1)[1]!==offset||ranges.some((range,i)=>i>0&&ranges[i-1][1]!==range[0]))fail();
 for(const name of ['[Content_Types].xml','_rels/.rels',required]){const content=parts.get(name);if(!content?.length||content.length>4*1024*1024)fail();const text=content.toString('utf8');if(!Buffer.from(text).equals(content)||/macroEnabled|vbaProject|activeX/i.test(text)||!/^\s*(?:<\?xml[^>]*>\s*)?</.test(text)||/<!DOCTYPE|<!ENTITY/i.test(text))fail();}
 const result={entries:count,expanded_bytes:total};if(inspected.size>=64)inspected.delete(inspected.keys().next().value);inspected.set(cacheKey,result);return {...result};
}
module.exports={inspect,crc32};
