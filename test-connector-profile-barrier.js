'use strict';
// Test-only DNS boundary. No lookup or HTTP request reaches a provider.
require('./test-identity-body-barrier');
const fs=require('node:fs'),dns=require('node:dns').promises,lookup=dns.lookup;
dns.lookup=async function(host,...args){if(host!=='profile-await.fixture.test')return lookup.call(this,host,...args);const path=process.env.FOUNDLY_PROFILE_LOOKUP_BARRIER;if(!path)throw Error('Explicit profile lookup fixture path required');fs.writeFileSync(path+'.started','ISOLATED_DNS_BOUNDARY');for(let n=0;n<250&&!fs.existsSync(path+'.release');n++)await new Promise(resolve=>setTimeout(resolve,20));if(!fs.existsSync(path+'.release'))throw Error('Profile lookup fixture timed out');return [{address:'93.184.216.34',family:4}];};
