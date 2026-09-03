'use strict';

const assert=require('assert');
const fs=require('fs');
const {DoubleClapGate}=require('./jarvis-audio.js');

const clap={rms:.045,peak:.62,attack:.11,highRatio:.34};
const speech={rms:.24,peak:.39,attack:.05,highRatio:.2};

let gate=new DoubleClapGate();
assert.equal(gate.push(clap,1000).activated,false,'a single clap may not activate Jarvis');
assert.equal(gate.push(clap,1320).activated,true,'two valid transients inside the timing window must activate Jarvis');
assert.equal(gate.push(clap,1510).activated,false,'cooldown must reject an immediate third transient');

gate=new DoubleClapGate();
assert.equal(gate.push(clap,2000).activated,false);
assert.equal(gate.push(clap,2070).activated,false,'transients that are too close are one clap');
assert.equal(gate.push(clap,2450).activated,true,'a later second clap can complete the new pair');

gate=new DoubleClapGate();
assert.equal(gate.push(speech,3000).candidate,false,'ordinary speech-shaped energy may not count as a clap');
gate.suppress(1000,3100);
assert.equal(gate.push(clap,3300).reason,'suppressed','output playback must suppress wake detection');

const html=fs.readFileSync(__dirname+'/index.html','utf8');
const js=fs.readFileSync(__dirname+'/index-script.js','utf8');
const neural=fs.readFileSync(__dirname+'/neural-runtime.js','utf8');
const audio=fs.readFileSync(__dirname+'/jarvis-audio.js','utf8');
const server=fs.readFileSync(__dirname+'/server.js','utf8');
const ui=html+'\n'+js+'\n'+neural+'\n'+audio+'\n'+server;

for(const token of ['/neural-runtime.js','/jarvis-audio.js','initializeFoundly','FoundlyClapDetector','DoubleClapGate','FoundlyAudioScene','attachRemote','local_double_clap_plus_web_speech_wake_word','/api/jarvis/preferences','/api/jarvis/client-event','requestFullscreen','setAutoQuality','REALTIME · CONVERSATION'])assert(ui.includes(token),`missing client contract: ${token}`);
for(const id of ['initializeFoundly','settingsToggle','settingsClose','saveSettings','fullscreen','mic','send']){assert(html.includes(`id="${id}"`),`missing UI control ${id}`);assert(js.includes(`$('#${id}')`),`missing UI handler ${id}`)}
assert.equal((js.match(/async function connectRealtime\(/g)||[]).length,1,'there must be one authoritative Realtime client path');
assert(!js.includes('if(Math.random()<.06&&links.length)'), 'visual activity may not be randomly fabricated');
assert(!/Yoo bro/i.test(ui));
assert(!/sk-[A-Za-z0-9_-]{12,}/.test(ui),'server credentials may not appear in client assets');

console.log(JSON.stringify({ok:true,version:'5.1.0',double_clap_gate:'pass',standby_privacy:'contract_pass',single_realtime_pipeline:'pass',audio_unlock_and_ducking:'contract_pass',runtime_bound_visuals:'pass',fake_activity_removed:'pass'},null,2));
