'use strict';
// Encoded upload stays below the existing 5,000,000-character API body bound.
// Current file bytes plus base64/MIME folding stay below the wire limit.
module.exports=Object.freeze({BINARY_BYTES:3*1024*1024,CURRENT_BYTES:6*1024*1024,WIRE_BYTES:9*1024*1024,ARCHIVE_BYTES:24*1024*1024,ARCHIVE_ENTRIES:500});
