'use strict';
// Isolated HTTP evidence: the real handler commits to the encrypted store,
// then the selected success reply is physically lost. No domain response or
// provider is mocked. A separate marker observes the real authenticated await.
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const emit = http.Server.prototype.emit, on = http.IncomingMessage.prototype.on;
http.Server.prototype.emit = function(event, req, res, ...rest) {
  if (event === 'request' && req.method === 'POST' && /^\/api\/(?:finance\/|zero\/turn$)/.test(req.url) && req.headers['x-fixture-finance-drop'] === 'committed-reply') {
    const end = res.end;
    res.end = function(...args) {if ([200, 201].includes(this.statusCode)) {this.socket.destroy(); return this;} return end.apply(this, args);};
  }
  return emit.call(this, event, req, res, ...rest);
};
http.IncomingMessage.prototype.on = function(event, listener) {
  const result = on.call(this, event, listener);
  if (event === 'end' && this.headers?.['x-fixture-finance-barrier'] === 'body' && /at body \(/.test(new Error().stack || '')) {
    fs.writeFileSync(path.join(process.env.FOUNDLY_DATA_DIR, 'finance-body-boundary'), 'authenticated-await');
  }
  return result;
};
