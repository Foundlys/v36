'use strict';

// Deterministic public-provider transport used only by the masterbuild
// regression suite. It is contract evidence, never live-provider evidence.
const dns = require('dns').promises;
const upstreamLookup = dns.lookup.bind(dns);
const upstreamFetch = globalThis.fetch;

dns.lookup = async (hostname, options) => {
  if (['opendata.rdw.nl', 'www.ecb.europa.eu'].includes(String(hostname))) {
    return options?.all ? [{ address: '93.184.216.34', family: 4 }] : { address: '93.184.216.34', family: 4 };
  }
  return upstreamLookup(hostname, options);
};

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(String(typeof input === 'string' || input instanceof URL ? input : input.url));
  if (url.hostname === 'opendata.rdw.nl') {
    return new Response(JSON.stringify([{ kenteken: 'CONTRACT' }]), { status: 200, headers: { 'content-type': 'application/json', 'x-foundly-fixture': 'MASTERBUILD_CONTRACT_NOT_PROVIDER_PROOF' } });
  }
  if (url.hostname === 'www.ecb.europa.eu') {
    return new Response('<Envelope><Cube currency="USD" rate="1.0000"/></Envelope>', { status: 200, headers: { 'content-type': 'application/xml', 'x-foundly-fixture': 'MASTERBUILD_CONTRACT_NOT_PROVIDER_PROOF' } });
  }
  return upstreamFetch(input, init);
};
