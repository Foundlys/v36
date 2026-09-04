'use strict';

// CommonJS compatibility for integrations that imported the former filename.
// HTTP clients receive zero-audio.js for either asset route in server.js.
if(typeof module!=='undefined'&&module.exports)module.exports=require('./zero-audio.js');
