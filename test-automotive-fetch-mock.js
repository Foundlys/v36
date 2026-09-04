'use strict';

const fs = require('fs');
const dns = require('dns').promises;
const upstreamLookup = dns.lookup.bind(dns);
const upstreamFetch = globalThis.fetch;
const FIXTURE = 'SYNTHETIC_AUTOMOTIVE_INTEGRATION_FIXTURE_NOT_PROVIDER_PROOF';

dns.lookup = async (hostname, options) => {
  if (['opendata.rdw.nl', 'services.mobile.de', 'api.marktplaats.nl', 'example.test'].includes(String(hostname))) {
    return options?.all ? [{ address: '93.184.216.34', family: 4 }] : { address: '93.184.216.34', family: 4 };
  }
  return upstreamLookup(hostname, options);
};

function json(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
}

function mobile(id, price, mileage, country, city, year = 2022) {
  return {
    fixture: FIXTURE,
    id,
    url: `https://example.test/${id}`,
    status: 'ACTIVE',
    modificationDate: '2026-09-04',
    seller: { type: 'DEALER', companyName: `Integration Fixture ${city}`, id: `seller-${id}`, address: { country, city } },
    price: { consumerPriceGross: price, currency: 'EUR', vatReclaimable: false },
    vehicle: {
      make: { name: 'BMW' }, model: { name: 'X5' }, modelDescription: 'X5 45e', variant: '45e', trimLine: 'M Sport',
      firstRegistration: `${year}-03`, mileage, fuel: { name: 'Plug-in Hybrid' }, gearbox: { name: 'Automatic' },
      drivingMode: 'xDrive', powerKw: 290, co2Emission: 49, features: ['Panoramadak', 'Trekhaak'],
      images: [`https://example.test/${id}.jpg`], vin: `WBAINTEGRATION${id.slice(-3).padStart(3, '0')}`
    }
  };
}

function marktplaats(id, priceEur, mileage, city, year = 2022) {
  return {
    fixture: FIXTURE,
    id,
    title: `BMW X5 45e M Sport ${year}`,
    url: `https://example.test/${id}`,
    status: 'ACTIVE',
    dateModified: '2026-09-04',
    seller: { type: 'DEALER', name: `Integration Fixture ${city}`, id: `seller-${id}` },
    location: { countryCode: 'NL', cityName: city },
    price: { amount: priceEur * 100, currency: 'EUR' },
    images: [{ url: `https://example.test/${id}.jpg` }],
    attributes: [
      { key: 'merk', value: 'BMW' }, { key: 'model', value: 'X5' }, { key: 'variant', value: '45e' },
      { key: 'uitvoering', value: 'M Sport' }, { key: 'bouwjaar', value: year }, { key: 'kilometerstand', value: mileage },
      { key: 'brandstof', value: 'Plug-in hybride' }, { key: 'transmissie', value: 'Automaat' },
      { key: 'vermogen_kw', value: 290 }, { key: 'opties', value: 'Panoramadak, Trekhaak' }
    ]
  };
}

const mobileRows = [
  mobile('mobile-int-001', 48900, 62000, 'DE', 'Düsseldorf'),
  mobile('mobile-int-002', 49750, 55000, 'DE', 'Köln'),
  mobile('mobile-int-003', 49900, 48000, 'DE', 'München', 2023),
  mobile('mobile-nl-004', 70500, 61000, 'NL', 'Utrecht'),
  mobile('mobile-nl-005', 73900, 49000, 'NL', 'Rotterdam', 2023)
];
const marktplaatsRows = [
  marktplaats('mp-int-001', 68900, 68000, 'Breda'),
  marktplaats('mp-int-002', 71250, 60000, 'Amsterdam'),
  marktplaats('mp-int-003', 73500, 52000, 'Eindhoven', 2023),
  marktplaats('mp-int-004', 74950, 45000, 'Zwolle', 2023),
  marktplaats('mp-int-005', 69850, 65000, 'Groningen')
];

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(String(typeof input === 'string' || input instanceof URL ? input : input.url));
  const fail = process.env.AUTOMOTIVE_TEST_FAIL_FILE && fs.existsSync(process.env.AUTOMOTIVE_TEST_FAIL_FILE);
  if (url.hostname === 'opendata.rdw.nl') {
    return json([{ fixture: FIXTURE, kenteken: 'TEST01', voertuigsoort: 'Personenauto', inrichting: 'SUV', merk: 'BMW', handelsbenaming: 'X5 XDRIVE45E', datum_eerste_toelating: '20220329', datum_eerste_tenaamstelling_in_nederland: '20230321', bruto_bpm: '577', catalogusprijs: '106374', co2_uitstoot_gecombineerd: '49', zuinigheidsclassificatie: 'A', cilinderinhoud: '2998', aantal_zitplaatsen: '5', eerste_kleur: 'ZWART' }]);
  }
  if (url.hostname === 'services.mobile.de') {
    const headers = new Headers(init.headers || {});
    if (!headers.get('authorization')?.startsWith('Basic ')) return json({ error: 'missing fixture auth' }, 401);
    if (fail) return json({ error: 'controlled fixture outage' }, 503);
    return json({ ads: { ad: mobileRows } });
  }
  if (url.hostname === 'api.marktplaats.nl') {
    const headers = new Headers(init.headers || {});
    if (!headers.get('authorization')?.startsWith('Bearer ')) return json({ error: 'missing fixture auth' }, 401);
    if (fail) return json({ error: 'controlled fixture outage' }, 503);
    return json({ advertisements: marktplaatsRows });
  }
  if (url.hostname === 'example.test' && url.pathname.endsWith('.jpg')) {
    return new Response(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+Xw1fWQAAAABJRU5ErkJggg==', 'base64'), { status: 200, headers: { 'content-type': 'image/png' } });
  }
  return upstreamFetch(input, init);
};
