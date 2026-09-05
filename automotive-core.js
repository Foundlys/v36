'use strict';

const crypto = require('crypto');

const AUTOMOTIVE_SCHEMA_VERSION = '1.0.0';
const AUTOMOTIVE_TRANSFORMATION_VERSION = 'foundly-automotive-normalizer/1.1.0';
const AUTOMOTIVE_SEARCH_VERSION = 'foundly-automotive-search/1.1.0';
const AUTOMOTIVE_COMPARABLE_VERSION = 'foundly-automotive-comparables/1.0.0';
const AUTOMOTIVE_BUY_SCORE_VERSION = 'foundly-buy-score/1.0.0';
const BPM_RULE_VERSION = 'NL_BPM_2026_PASSENGER_CAR_FORFAIT_ESTIMATE/1.0.0';
const FRESHNESS_VALUES = Object.freeze(['LIVE', 'CACHED', 'STALE', 'UNAVAILABLE']);
const MARKETPLACE_PROVIDERS = Object.freeze(['mobile_de', 'marktplaats', 'autoscout24']);
const SUPPORTED_PROVIDERS = Object.freeze(['rdw', ...MARKETPLACE_PROVIDERS]);
const PROVIDER_FRESHNESS_POLICIES = Object.freeze({
  default: Object.freeze({ live_seconds: 15 * 60, cached_seconds: 6 * 60 * 60 }),
  mobile_de: Object.freeze({ live_seconds: 15 * 60, cached_seconds: 6 * 60 * 60 }),
  marktplaats: Object.freeze({ live_seconds: 10 * 60, cached_seconds: 4 * 60 * 60 }),
  autoscout24: Object.freeze({ live_seconds: 15 * 60, cached_seconds: 6 * 60 * 60 }),
  rdw: Object.freeze({ live_seconds: 24 * 60 * 60, cached_seconds: 7 * 24 * 60 * 60 })
});

// Only enum values verified against mobile.de's official reference-data API
// belong here. Unmapped user options are retained for conservative post-filtering.
const MOBILE_DE_FEATURE_FILTERS = Object.freeze({
  panoramadak: 'PANORAMIC_GLASS_ROOF',
  luchtvering: 'AIR_SUSPENSION',
  'head up display': 'HEAD_UP_DISPLAY',
  stoelventilatie: 'VENTILATED_SEATS'
});

const MAKE_ALIASES = Object.freeze([
  ['mercedes-benz', 'Mercedes-Benz'], ['mercedes benz', 'Mercedes-Benz'], ['mercedes', 'Mercedes-Benz'],
  ['land rover', 'Land Rover'], ['range rover', 'Land Rover'], ['volkswagen', 'Volkswagen'],
  ['alfa romeo', 'Alfa Romeo'], ['aston martin', 'Aston Martin'], ['rolls-royce', 'Rolls-Royce'],
  ['bmw', 'BMW'], ['porsche', 'Porsche'], ['audi', 'Audi'], ['volvo', 'Volvo'], ['lexus', 'Lexus'],
  ['jaguar', 'Jaguar'], ['tesla', 'Tesla'], ['toyota', 'Toyota'], ['ford', 'Ford'], ['kia', 'Kia'],
  ['hyundai', 'Hyundai'], ['skoda', 'Skoda'], ['seat', 'SEAT'], ['cupra', 'CUPRA'], ['mini', 'MINI'],
  ['maserati', 'Maserati'], ['ferrari', 'Ferrari'], ['lamborghini', 'Lamborghini'], ['bentley', 'Bentley'],
  ['nissan', 'Nissan'], ['honda', 'Honda'], ['mazda', 'Mazda'], ['peugeot', 'Peugeot'], ['renault', 'Renault'],
  ['citroën', 'Citroën'], ['citroen', 'Citroën'], ['fiat', 'Fiat'], ['opel', 'Opel'], ['jeep', 'Jeep']
]);

function automotiveError(statusCode, code, message, details) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  if (details !== undefined) error.details = details;
  return error;
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function text(value, max = 500) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function secretField(name = '') {
  const key = String(name).toLowerCase().replace(/[.\-\s]+/g, '_');
  return /^(?:authorization|cookie|set_cookie|password|secret|token)$/.test(key)
    || /(?:^|_)(?:password|secret|token|api_?key|private_key)$/.test(key);
}

function sanitize(value, key = '', depth = 0) {
  if (secretField(key)) return undefined;
  if (value === null || value === undefined) return value;
  if (depth > 8) return '[depth-limited]';
  if (Array.isArray(value)) return value.slice(0, 250).map(item => sanitize(item, '', depth + 1)).filter(item => item !== undefined);
  if (typeof value === 'object') {
    const output = {};
    for (const [childKey, child] of Object.entries(value)) {
      const safe = sanitize(child, childKey, depth + 1);
      if (safe !== undefined) output[childKey] = safe;
    }
    return output;
  }
  if (typeof value === 'string') return text(value, 4000);
  return value;
}

function containsSecretField(value, key = '') {
  if (value === null || value === undefined) return false;
  if (secretField(key) && String(value).length > 0) return true;
  if (Array.isArray(value)) return value.some(item => containsSecretField(item));
  if (typeof value === 'object') return Object.entries(value).some(([childKey, child]) => containsSecretField(child, childKey));
  return false;
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function stableId(prefix, ...values) {
  return `${prefix}_${sha256(values.map(value => String(value ?? '')).join('\u001f')).slice(0, 32)}`;
}

function number(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const normalized = String(value).trim().replace(/[^0-9,.-]/g, '');
  if (!normalized) return null;
  let result = normalized;
  if (result.includes(',') && result.includes('.')) result = result.lastIndexOf(',') > result.lastIndexOf('.') ? result.replace(/\./g, '').replace(',', '.') : result.replace(/,/g, '');
  else if (/^\d{1,3}(?:\.\d{3})+$/.test(result)) result = result.replace(/\./g, '');
  else if (/^\d{1,3}(?:,\d{3})+$/.test(result)) result = result.replace(/,/g, '');
  else result = result.replace(',', '.');
  const parsed = Number(result);
  return Number.isFinite(parsed) ? parsed : null;
}

function integer(value) {
  const parsed = number(value);
  return parsed === null ? null : Math.round(parsed);
}

function firstNumber(...values) {
  for (const value of values) {
    const parsed = number(value);
    if (parsed !== null) return parsed;
  }
  return null;
}

function firstText(...values) {
  for (const value of values) {
    const parsed = text(value);
    if (parsed) return parsed;
  }
  return null;
}

function readPath(source, path) {
  let value = source;
  for (const part of path.split('.')) {
    if (value === null || value === undefined) return undefined;
    value = value[part];
  }
  return value;
}

function pick(source, ...paths) {
  for (const path of paths) {
    const value = readPath(source, path);
    if (value !== null && value !== undefined && value !== '') return value;
  }
  return null;
}

function safeUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(String(value));
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

function normalizedDate(value) {
  const raw = text(value, 80);
  if (!raw) return null;
  if (/^\d{8}$/.test(raw)) return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  if (/^\d{6}$/.test(raw)) return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-01`;
  if (/^\d{4}$/.test(raw)) return `${raw}-01-01`;
  if (/^\d{4}-\d{2}$/.test(raw)) return `${raw}-01`;
  const parsed = new Date(raw);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString().slice(0, 10) : null;
}

function yearOf(value) {
  const date = normalizedDate(value);
  return date ? Number(date.slice(0, 4)) : null;
}

function normalizeMake(value) {
  const raw = text(value, 100);
  if (!raw) return null;
  const known = MAKE_ALIASES.find(([alias]) => alias === raw.toLowerCase());
  if (known) return known[1];
  return raw.toLowerCase().replace(/(^|[\s-])\p{L}/gu, match => match.toUpperCase());
}

function normalizeFuel(value) {
  const raw = text(value, 100).toLowerCase();
  if (!raw) return null;
  if (/plug.?in|phev|e.?hybrid/.test(raw)) return 'PLUGIN_HYBRID';
  if (/hybrid|hybride/.test(raw)) return 'HYBRID';
  if (/electric|elektr|battery|bev/.test(raw)) return 'ELECTRIC';
  if (/diesel/.test(raw)) return 'DIESEL';
  if (/petrol|gasoline|benzine/.test(raw)) return 'PETROL';
  if (/lpg/.test(raw)) return 'LPG';
  if (/hydrogen|waterstof/.test(raw)) return 'HYDROGEN';
  return raw.toUpperCase().replace(/[^A-Z0-9]+/g, '_');
}

function normalizeTransmission(value) {
  const raw = text(value, 100).toLowerCase();
  if (!raw) return null;
  if (/automatic|automaat|automatik|cvt/.test(raw)) return 'AUTOMATIC';
  if (/manual|handgeschakeld|schaltgetriebe/.test(raw)) return 'MANUAL';
  return raw.toUpperCase().replace(/[^A-Z0-9]+/g, '_');
}

function normalizeDrivetrain(value) {
  const raw = text(value, 100).toLowerCase();
  if (!raw) return null;
  if (/awd|4wd|4x4|all.?wheel|vierwiel|xdrive|quattro/.test(raw)) return 'AWD';
  if (/rear|achterwiel|rwd/.test(raw)) return 'RWD';
  if (/front|voorwiel|fwd/.test(raw)) return 'FWD';
  return raw.toUpperCase().replace(/[^A-Z0-9]+/g, '_');
}

function normalizeCountry(value) {
  const raw = text(value, 80).toLowerCase();
  if (!raw) return null;
  const aliases = { nl: 'NL', nederland: 'NL', netherlands: 'NL', de: 'DE', duitsland: 'DE', germany: 'DE', deutschland: 'DE', be: 'BE', belgie: 'BE', 'belgië': 'BE', belgium: 'BE', fr: 'FR', frankrijk: 'FR', france: 'FR' };
  return aliases[raw] || (raw.length === 2 ? raw.toUpperCase() : raw.toUpperCase().slice(0, 3));
}

function stringList(value) {
  const source = Array.isArray(value) ? value : value ? String(value).split(/[,;|]/) : [];
  return [...new Set(source.map(item => text(typeof item === 'object' ? pick(item, 'name', 'description', 'value', 'label') : item, 200)).filter(Boolean))].slice(0, 150);
}

function normalizeImages(value) {
  const queue = Array.isArray(value) ? [...value] : value ? [value] : [];
  const output = [];
  let inspected = 0;
  while (queue.length && output.length < 30 && inspected++ < 500) {
    const item = queue.shift();
    if (!item) continue;
    if (Array.isArray(item)) { queue.push(...item); continue; }
    if (typeof item === 'string') {
      const url = safeUrl(item);
      if (url && !output.includes(url)) output.push(url);
      continue;
    }
    if (typeof item !== 'object') continue;
    const direct = safeUrl(pick(item, 'xxxl', 'XXXL', 'xxl', 'XXL', 'xl', 'XL', 'large', 'l', 'url', 'uri', 'href', 'src', 'm', 's', 'icon'));
    if (direct && !output.includes(direct)) output.push(direct);
    for (const nested of [item.images, item.image, item.items, item.representations, item._embedded]) if (nested) queue.push(nested);
    if (item._embedded && typeof item._embedded === 'object') queue.push(...Object.values(item._embedded));
  }
  return output;
}

function normalizeStatus(value) {
  const raw = text(value, 80).toUpperCase();
  if (/DELETED|REMOVED|SOLD|INACTIVE|EXPIRED/.test(raw)) return raw.includes('SOLD') ? 'SOLD' : 'INACTIVE';
  if (/^(?:ONLINE|PUBLISHED|AVAILABLE)$/.test(raw)) return 'ACTIVE';
  return raw || 'ACTIVE';
}

function classifyFreshness(timestamp, now = new Date(), mode = 'cache', provider = 'default') {
  const parsed = Date.parse(timestamp || '');
  if (!Number.isFinite(parsed)) return { classification: 'UNAVAILABLE', observed_at: null, age_seconds: null };
  const ageSeconds = Math.max(0, Math.floor((new Date(now).getTime() - parsed) / 1000));
  const policy = PROVIDER_FRESHNESS_POLICIES[provider] || PROVIDER_FRESHNESS_POLICIES.default;
  let classification = 'STALE';
  if (mode === 'live' && ageSeconds <= policy.live_seconds) classification = 'LIVE';
  else if (ageSeconds <= policy.cached_seconds) classification = 'CACHED';
  return { classification, observed_at: new Date(parsed).toISOString(), age_seconds: ageSeconds };
}

function parseHumanNumber(raw) {
  const value = number(raw);
  if (value === null) return null;
  return /k\s*$/i.test(String(raw).trim()) ? value * 1000 : value;
}

function parseSearchCriteria(input, previousCriteria = {}) {
  const payload = typeof input === 'string' ? { query: input } : (input || {});
  const query = text(payload.query || payload.message || '', 4000);
  const lower = query.toLowerCase();
  const criteria = sanitize({ ...(previousCriteria || {}), ...(payload.criteria || {}) });

  let makeMatch = null;
  for (const [alias, canonical] of MAKE_ALIASES) {
    const match = lower.match(new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'));
    if (match && (!makeMatch || match.index < makeMatch.index || alias.length > makeMatch.alias.length)) makeMatch = { alias, canonical, index: match.index };
  }
  if (makeMatch) {
    criteria.make = makeMatch.canonical;
    const tail = query.slice(makeMatch.index + makeMatch.alias.length).trim();
    const stop = tail.search(/\b(?:vanaf|vóór|voor|tussen|max(?:imaal)?|min(?:imaal)?|tot|onder|boven|met|uit|in\s+(?:duitsland|nederland|belgi[eë])|\d{4}\s*(?:-|tot))\b|€|\beur\b/i);
    const vehiclePhrase = text(stop >= 0 ? tail.slice(0, stop) : tail, 160).replace(/^[,;:-]+|[,;:-]+$/g, '').trim();
    const trimPatterns = [/\bm\s*sport\b/i, /\bamg(?:\s+line)?\b/i, /\bs\s*line\b/i, /\br-?design\b/i, /\bf\s*sport\b/i, /\bautobiography\b/i, /\bhse\b/i];
    const trimMatch = trimPatterns.map(pattern => vehiclePhrase.match(pattern)).find(Boolean);
    if (trimMatch) criteria.trim = text(trimMatch[0], 80);
    const variantMatch = vehiclePhrase.match(/\b(?:\d{2,3}[a-z]{1,3}|e-?hybrid|plug-?in\s*hybrid|p\d{3}e|t\d{1,2}|xdrive\d*[a-z]*|[a-z]{2,5}\d{2,3})\b/i);
    if (variantMatch) criteria.variant = text(variantMatch[0], 80);
    let modelPhrase = vehiclePhrase;
    if (trimMatch) modelPhrase = modelPhrase.replace(trimMatch[0], '');
    if (variantMatch) modelPhrase = modelPhrase.replace(variantMatch[0], '');
    modelPhrase = modelPhrase.replace(/\b(?:diesel|benzine|petrol|elektrisch|electric|hybride?|plug-?in|automaat|automatic|handgeschakeld|manual|awd|4wd|4x4|rwd|fwd)\b/gi, ' ');
    modelPhrase = text(modelPhrase, 100);
    if (makeMatch.alias === 'range rover') modelPhrase = `Range Rover ${modelPhrase}`.trim();
    if (modelPhrase) criteria.model = modelPhrase;
  }

  const yearMin = lower.match(/\b(?:vanaf|na|min(?:imaal)?|bouwjaar\s*(?:vanaf|>=?)?)\s*(20\d{2}|19\d{2})\b/i);
  const yearMax = lower.match(/\b(?:tot|voor|max(?:imaal)?|bouwjaar\s*(?:tot|<=?)?)\s*(20\d{2}|19\d{2})\b/i);
  const yearRange = lower.match(/\b(20\d{2}|19\d{2})\s*(?:-|tot|t\/m)\s*(20\d{2}|19\d{2})\b/i);
  if (yearRange) { criteria.year_min = Number(yearRange[1]); criteria.year_max = Number(yearRange[2]); }
  else {
    if (yearMin) criteria.year_min = Number(yearMin[1]);
    if (yearMax && !/max(?:imaal)?\s+(?:€|eur)/i.test(yearMax[0])) criteria.year_max = Number(yearMax[1]);
  }

  const mileageMax = lower.match(/\b(?:max(?:imaal)?|tot|onder)\s*([\d.,]+\s*k?)\s*(?:km|kilometer)/i);
  const mileageMin = lower.match(/\b(?:min(?:imaal)?|vanaf|boven)\s*([\d.,]+\s*k?)\s*(?:km|kilometer)/i);
  if (mileageMax) criteria.mileage_max_km = Math.round(parseHumanNumber(mileageMax[1]));
  if (mileageMin) criteria.mileage_min_km = Math.round(parseHumanNumber(mileageMin[1]));

  const euroMatches = [...lower.matchAll(/(?:€|eur\s*)\s*([\d.,]+\s*k?)|([\d.,]+\s*k?)\s*(?:euro|eur)\b/gi)];
  if (euroMatches.length) {
    const match = euroMatches.at(-1);
    const amount = parseHumanNumber(match[1] || match[2]);
    const lead = lower.slice(Math.max(0, match.index - 35), match.index);
    if (/min(?:imaal)?|vanaf|boven/.test(lead)) criteria.purchase_price_min_eur = amount;
    else criteria.purchase_price_max_eur = amount;
  }

  const countries = [['duitsland', 'DE'], ['deutschland', 'DE'], ['germany', 'DE'], ['nederland', 'NL'], ['netherlands', 'NL'], ['belgiё', 'BE'], ['belgië', 'BE'], ['belgie', 'BE'], ['belgium', 'BE'], ['frankrijk', 'FR'], ['france', 'FR']];
  const country = countries.find(([name]) => lower.includes(name));
  if (country) criteria.country = country[1];
  if (/plug.?in|phev|e-?hybrid/.test(lower)) criteria.fuel = 'PLUGIN_HYBRID';
  else if (/\bhybride?\b/.test(lower)) criteria.fuel = 'HYBRID';
  else if (/\belektrisch|electric|\bbev\b/.test(lower)) criteria.fuel = 'ELECTRIC';
  else if (/\bdiesel\b/.test(lower)) criteria.fuel = 'DIESEL';
  else if (/\bbenzine|petrol\b/.test(lower)) criteria.fuel = 'PETROL';
  if (/\bautomaat|automatic\b/.test(lower)) criteria.transmission = 'AUTOMATIC';
  else if (/\bhandgeschakeld|manual\b/.test(lower)) criteria.transmission = 'MANUAL';
  if (/\b(?:awd|4wd|4x4|vierwielaandrijving|xdrive|quattro)\b/.test(lower)) criteria.drivetrain = 'AWD';
  else if (/\b(?:rwd|achterwielaandrijving)\b/.test(lower)) criteria.drivetrain = 'RWD';
  else if (/\b(?:fwd|voorwielaandrijving)\b/.test(lower)) criteria.drivetrain = 'FWD';
  const power = lower.match(/\b(?:min(?:imaal)?|vanaf)?\s*(\d{2,4})\s*(kw|pk|hp)\b/i);
  if (power) criteria.power_min_kw = power[2].toLowerCase() === 'kw' ? Number(power[1]) : Math.round(Number(power[1]) * 0.735499);
  if (/\b(?:dealer|handelaar)\b/.test(lower)) criteria.seller_type = 'DEALER';
  else if (/\bparticulier|private seller\b/.test(lower)) criteria.seller_type = 'PRIVATE';

  const optionPatterns = [
    ['panoramadak', /panorama(?:dak|roof)?/i], ['trekhaak', /trekhaak|tow.?bar/i], ['luchtvering', /luchtvering|air suspension/i],
    ['adaptieve cruise control', /adaptieve? cruise|adaptive cruise|\bacc\b/i], ['head-up display', /head.?up display|\bhud\b/i],
    ['360 camera', /360.?camera/i], ['stoelventilatie', /stoelventilatie|ventilated seats/i], ['laserlicht', /laserlicht|laser light/i]
  ];
  const options = optionPatterns.filter(([, pattern]) => pattern.test(query)).map(([name]) => name);
  if (options.length) criteria.options = [...new Set([...(criteria.options || []), ...options])];

  for (const field of ['year_min', 'year_max', 'mileage_min_km', 'mileage_max_km', 'purchase_price_min_eur', 'purchase_price_max_eur', 'power_min_kw']) {
    if (criteria[field] !== undefined && criteria[field] !== null) criteria[field] = number(criteria[field]);
  }
  if (criteria.make) criteria.make = normalizeMake(criteria.make);
  if (criteria.country) criteria.country = normalizeCountry(criteria.country);
  if (criteria.fuel) criteria.fuel = normalizeFuel(criteria.fuel);
  if (criteria.transmission) criteria.transmission = normalizeTransmission(criteria.transmission);
  if (criteria.drivetrain) criteria.drivetrain = normalizeDrivetrain(criteria.drivetrain);
  criteria.options = stringList(criteria.options);

  const meaningful = ['make', 'model', 'year_min', 'year_max', 'mileage_max_km', 'purchase_price_max_eur', 'country', 'fuel'].some(field => criteria[field] !== undefined && criteria[field] !== null && criteria[field] !== '');
  const missingFields = meaningful ? [] : ['make_or_search_constraint'];
  return {
    original_query: query || null,
    criteria,
    interpretation_version: AUTOMOTIVE_SEARCH_VERSION,
    status: missingFields.length ? 'needs_input' : 'interpreted',
    needs_clarification: missingFields.length > 0,
    missing_fields: missingFields,
    clarification: missingFields.length ? 'Noem minimaal een merk/model of een concrete zoekgrens.' : null
  };
}

function canonicalVehicleId(provider, providerListingId, vehicle = {}) {
  const vin = text(vehicle.vin, 80).toUpperCase();
  const registration = text(vehicle.registration, 40).toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (vin) return stableId('veh', 'vin', vin);
  if (registration) return stableId('veh', 'registration', registration);
  return stableId('veh', provider, providerListingId, vehicle.make, vehicle.model, vehicle.variant, vehicle.first_registration, vehicle.mileage_km);
}

function sourceManifest(provider, providerListingId, raw, fetchedAt) {
  return {
    id: stableId('rawref', provider, providerListingId, sha256(JSON.stringify(sanitize(raw)))),
    provider,
    provider_record_id: text(providerListingId, 240),
    record_digest_sha256: sha256(JSON.stringify(sanitize(raw))),
    observed_at: fetchedAt,
    payload_stored: false,
    retention: 'REFERENCE_ONLY',
    contains_provider_secret: false
  };
}

function baseListing(provider, providerListingId, raw, fetchedAt, fields) {
  const manifest = sourceManifest(provider, providerListingId, raw, fetchedAt);
  const vehicle = fields.vehicle;
  return {
    schema_version: AUTOMOTIVE_SCHEMA_VERSION,
    record_kind: 'AUTOMOTIVE_LISTING',
    canonical_listing_id: stableId('listing', provider, providerListingId),
    canonical_vehicle_id: canonicalVehicleId(provider, providerListingId, vehicle),
    identity: {
      canonical_vehicle_id: canonicalVehicleId(provider, providerListingId, vehicle),
      provider,
      provider_listing_id: text(providerListingId, 240),
      source_url: safeUrl(fields.source_url)
    },
    listing: {
      status: normalizeStatus(fields.status),
      created_at: normalizedDate(fields.created_at),
      modified_at: normalizedDate(fields.modified_at),
      fetched_at: fetchedAt,
      last_verified_at: fetchedAt,
      freshness: classifyFreshness(fetchedAt, new Date(fetchedAt), 'live', provider)
    },
    seller: {
      type: fields.seller_type ? text(fields.seller_type, 80).toUpperCase() : null,
      name: text(fields.seller_name, 240) || null,
      company_id: text(fields.seller_id, 160) || null,
      country: normalizeCountry(fields.country),
      city: text(fields.city, 160) || null,
      contact: sanitize(fields.contact || {})
    },
    vehicle: {
      make: normalizeMake(vehicle.make), model: text(vehicle.model, 140) || null, variant: text(vehicle.variant, 180) || null,
      trim: text(vehicle.trim, 140) || null, generation: text(vehicle.generation, 100) || null,
      body_type: text(vehicle.body_type, 100).toUpperCase() || null, build_year: integer(vehicle.build_year) || yearOf(vehicle.first_registration),
      first_registration: normalizedDate(vehicle.first_registration), mileage_km: integer(vehicle.mileage_km), fuel: normalizeFuel(vehicle.fuel),
      hybrid_ev: sanitize(vehicle.hybrid_ev || {}), transmission: normalizeTransmission(vehicle.transmission), drivetrain: normalizeDrivetrain(vehicle.drivetrain),
      power_kw: integer(vehicle.power_kw), power_hp: integer(vehicle.power_hp) || (number(vehicle.power_kw) !== null ? Math.round(number(vehicle.power_kw) / 0.735499) : null),
      engine_displacement_cc: integer(vehicle.engine_displacement_cc), doors: integer(vehicle.doors), seats: integer(vehicle.seats),
      exterior_color: text(vehicle.exterior_color, 100) || null, interior_color: text(vehicle.interior_color, 100) || null,
      features: stringList(vehicle.features), images: normalizeImages(vehicle.images), vin: text(vehicle.vin, 80).toUpperCase() || null,
      registration: text(vehicle.registration, 40).toUpperCase() || null, co2_g_km: integer(vehicle.co2_g_km),
      environmental: sanitize(vehicle.environmental || {})
    },
    commercial: {
      currency: text(fields.currency || 'EUR', 8).toUpperCase(), gross_price_eur: number(fields.gross_price_eur),
      net_price_eur: number(fields.net_price_eur), vat: sanitize(fields.vat || { status: 'UNKNOWN', evidence: null }),
      negotiable: typeof fields.negotiable === 'boolean' ? fields.negotiable : null
    },
    provenance: {
      provider, provider_verified: true, raw_source_reference: manifest.id, ingestion_timestamp: fetchedAt,
      provider_modified_at: normalizedDate(fields.modified_at), transformation_version: AUTOMOTIVE_TRANSFORMATION_VERSION
    },
    raw_source_manifest: manifest
  };
}

function mobilePrice(raw) {
  const gross = firstNumber(
    pick(raw, 'price.consumerPriceGross', 'price.gross', 'price.amount', 'price.value'),
    pick(raw, 'vehicle.price.consumerPriceGross', 'vehicle.price.gross'), raw.consumerPriceGross, raw.priceGross
  );
  const net = firstNumber(pick(raw, 'price.vatReclaimableNet', 'price.net'), raw.netPrice);
  const currency = firstText(pick(raw, 'price.currency', 'vehicle.price.currency'), raw.currency, 'EUR');
  return { gross, net, currency };
}

function mobilePhone(value) {
  const phones = Array.isArray(value) ? value : value ? [value] : [];
  const phone = phones[0];
  if (!phone) return null;
  if (typeof phone === 'string') return text(phone, 80) || null;
  return firstText(phone.phone, phone.value, [phone.internationalPrefix, phone.nationalPrefix, phone.number].filter(Boolean).join(''));
}

function normalizeMobileDeRecord(raw, options = {}) {
  const fetchedAt = new Date(options.fetchedAt || Date.now()).toISOString();
  const providerListingId = firstText(raw.mobileAdId, raw.id, raw.key, raw.adKey, pick(raw, 'ad.id', 'vehicle.id'));
  if (!providerListingId) return null;
  const price = mobilePrice(raw);
  const vehicleSource = raw.vehicle || raw;
  const make = firstText(pick(vehicleSource, 'make.localDescription', 'make.name', 'make.id'), vehicleSource.makeName, raw.make);
  const model = firstText(pick(vehicleSource, 'model.localDescription', 'model.name', 'model.id'), typeof vehicleSource.model === 'string' ? vehicleSource.model : null, vehicleSource.modelDescription, raw.model);
  const sourceUrl = firstText(raw.url, raw.webUrl, raw.detailPageUrl, raw.mobileAdUrl, pick(raw, '_links.self.href'));
  const features = vehicleSource.features || raw.features || [];
  const plugInHybrid = stringList(features).some(feature => /HYBRID_PLUGIN|PLUG.?IN/i.test(feature));
  const vatExplicit = pick(raw, 'price.vatReclaimable', 'vatReclaimable', 'price.vatRate', 'vatRate');
  const vat = vatExplicit === null ? { status: 'UNKNOWN', evidence: null } : {
    status: /true|yes|ja|reclaim/i.test(String(vatExplicit)) ? 'VAT_RECLAIMABLE' : (/false|no|nee/i.test(String(vatExplicit)) ? 'VAT_NOT_RECLAIMABLE' : 'EXPLICIT_PROVIDER_VALUE'),
    evidence: text(vatExplicit, 100)
  };
  return baseListing('mobile_de', providerListingId, raw, fetchedAt, {
    source_url: sourceUrl, status: firstText(raw.status, raw.adStatus), created_at: firstText(raw.creationDate, raw.createdAt),
    modified_at: firstText(raw.modificationDate, raw.modifiedAt, raw.lastModified), seller_type: firstText(pick(raw, 'seller.type'), raw.sellerType),
    seller_name: firstText(pick(raw, 'seller.companyName', 'seller.name'), raw.sellerName), seller_id: firstText(pick(raw, 'seller.mobileSellerId', 'seller.id', 'seller.key'), raw.mobileSellerId),
    country: firstText(pick(raw, 'seller.address.country', 'seller.country'), raw.country), city: firstText(pick(raw, 'seller.address.city'), raw.city),
    contact: { phone: mobilePhone(pick(raw, 'seller.phones', 'seller.phone') || raw.phone), email: firstText(pick(raw, 'seller.email'), raw.email) },
    currency: price.currency, gross_price_eur: price.currency === 'EUR' ? price.gross : null, net_price_eur: price.currency === 'EUR' ? price.net : null,
    vat, negotiable: typeof raw.negotiable === 'boolean' ? raw.negotiable : null,
    vehicle: {
      make, model, variant: firstText(vehicleSource.modelDescription, vehicleSource.variant, raw.variant), trim: firstText(vehicleSource.trimLine, vehicleSource.trim, raw.trim),
      generation: firstText(vehicleSource.generation), body_type: firstText(pick(vehicleSource, 'category.localDescription', 'category.name'), vehicleSource.category, vehicleSource.bodyType),
      build_year: firstNumber(vehicleSource.buildYear, vehicleSource.year), first_registration: firstText(vehicleSource.firstRegistration, raw.firstRegistration),
      mileage_km: firstNumber(pick(vehicleSource, 'mileage.value'), vehicleSource.mileage, raw.mileage), fuel: plugInHybrid ? 'PLUGIN_HYBRID' : firstText(pick(vehicleSource, 'fuel.localDescription', 'fuel.name'), vehicleSource.fuel),
      hybrid_ev: { electric_range_km: firstNumber(vehicleSource.electricRange, pick(vehicleSource, 'electricRange.value')), battery_kwh: firstNumber(vehicleSource.batteryCapacity) },
      transmission: firstText(pick(vehicleSource, 'gearbox.localDescription', 'gearbox.name'), vehicleSource.gearbox, vehicleSource.transmission), drivetrain: firstText(vehicleSource.drivingMode, vehicleSource.drivetrain),
      power_kw: firstNumber(pick(vehicleSource, 'power.value'), vehicleSource.power, vehicleSource.powerKw), power_hp: firstNumber(vehicleSource.powerHp),
      engine_displacement_cc: firstNumber(pick(vehicleSource, 'cubicCapacity.value'), vehicleSource.cubicCapacity), doors: firstNumber(vehicleSource.doors, vehicleSource.numDoors), seats: firstNumber(vehicleSource.seats, vehicleSource.numSeats),
      exterior_color: firstText(pick(vehicleSource, 'exteriorColor.localDescription'), vehicleSource.exteriorColor), interior_color: firstText(vehicleSource.interiorColor),
      features, images: raw.images || vehicleSource.images, vin: firstText(vehicleSource.vin, raw.vin),
      registration: firstText(vehicleSource.licensePlate, raw.licensePlate), co2_g_km: firstNumber(pick(vehicleSource, 'emissionFuelConsumption.co2Emission.combined'), vehicleSource.co2Emission),
      environmental: { emission_class: firstText(vehicleSource.emissionClass), consumption: sanitize(vehicleSource.emissionFuelConsumption || {}) }
    }
  });
}

function marktplaatsAttributes(raw) {
  const output = {};
  const rows = raw.attributes || raw.attribute || pick(raw, 'advertisement.attributes') || [];
  for (const item of Array.isArray(rows) ? rows : []) {
    const key = text(item.key || item.name || item.attribute || item.label, 100).toLowerCase();
    if (key) output[key] = item.value ?? item.values ?? item.description;
  }
  return output;
}

function marktplaatsTranslation(raw) {
  const translations = Array.isArray(raw.translations) ? raw.translations : [];
  return translations.find(row => /^nl(?:-|$)/i.test(String(row?.locale || ''))) || translations[0] || {};
}

function yearFromProviderText(value) {
  const match = text(value, 4000).match(/\b((?:19|20)\d{2})\b/);
  return match ? Number(match[1]) : null;
}

function mileageFromProviderText(value) {
  const match = text(value, 4000).match(/\b([\d.,]+\s*k?)\s*(?:km|kilometer)\b/i);
  return match ? Math.round(parseHumanNumber(match[1])) : null;
}

function normalizeMarktplaatsRecord(source, options = {}) {
  const raw = source.advertisement || source.ad || source;
  const fetchedAt = new Date(options.fetchedAt || Date.now()).toISOString();
  const providerListingId = firstText(raw.id, raw.itemId, raw.advertisementId, raw.adId, raw.key);
  if (!providerListingId) return null;
  const attrs = marktplaatsAttributes(raw), translation = marktplaatsTranslation(raw);
  const title = firstText(raw.title, translation.title, raw.subject, raw.description, translation.description) || '';
  const providerText = [title, firstText(raw.description, translation.description)].filter(Boolean).join(' ');
  const detectedMake = MAKE_ALIASES.find(([alias]) => title.toLowerCase().includes(alias));
  const amountRaw = firstNumber(pick(raw, 'priceModel.askingPrice', 'price.amount', 'price.value', 'price.currencyAmount', 'price.amountInCents'), raw.priceCents, typeof raw.price === 'number' ? raw.price : null);
  // Marktplaats v2 defines monetary values in euro cents. Do not reinterpret a
  // provider amount as whole euros unless an explicit future contract says so.
  const centsSemantics = amountRaw !== null;
  const amount = amountRaw === null ? null : (centsSemantics ? amountRaw / 100 : amountRaw);
  const currency = firstText(pick(raw, 'priceModel.currency', 'price.currency'), raw.currency, 'EUR');
  const vatRaw = firstText(attrs.btw, attrs.vat, raw.vatType, raw.taxType);
  return baseListing('marktplaats', providerListingId, raw, fetchedAt, {
    source_url: firstText(raw.url, raw.vipUrl, raw.webUrl, pick(raw, '_links.mp:advertisement-website-link.href', '_links.self.href')), status: firstText(raw.status, raw.state),
    created_at: firstText(raw.startDate, raw.dateCreated, raw.createdAt, raw.creationDate), modified_at: firstText(raw.dateModified, raw.updatedAt, raw.modificationDate),
    seller_type: firstText(pick(raw, 'seller.type'), raw.sellerType), seller_name: firstText(pick(raw, 'seller.sellerName', 'seller.name', 'seller.companyName'), raw.sellerName),
    seller_id: firstText(pick(raw, 'seller.sellerId', 'seller.id'), raw.sellerId), country: firstText(pick(raw, 'location.countryCode', 'seller.country'), raw.country),
    city: firstText(pick(raw, 'location.cityName', 'location.city'), raw.city), contact: { phone: firstText(pick(raw, 'seller.phoneNumber')) }, currency, gross_price_eur: currency === 'EUR' ? amount : null,
    net_price_eur: null, vat: vatRaw ? { status: 'EXPLICIT_PROVIDER_VALUE', evidence: vatRaw } : { status: 'UNKNOWN', evidence: null },
    negotiable: typeof raw.negotiable === 'boolean' ? raw.negotiable : null,
    vehicle: {
      make: firstText(attrs.merk, attrs.make, raw.makeDescription, raw.make, detectedMake?.[1]), model: firstText(attrs.model, raw.model, raw.modelDescription),
      variant: firstText(attrs.variant, attrs.type, raw.variant, raw.modelDescription, title), trim: firstText(attrs.uitvoering, attrs.trim, raw.trim), generation: firstText(attrs.generatie, raw.generation),
      body_type: firstText(attrs.carrosserie, attrs.body, raw.bodyType, raw.body), build_year: firstNumber(attrs.bouwjaar, attrs.year, raw.buildYear, raw.constructionYear, raw.year, yearFromProviderText(providerText)),
      first_registration: firstText(attrs.eerste_toelating, attrs.first_registration, raw.firstRegistration), mileage_km: firstNumber(attrs.kilometerstand, attrs.mileage, raw.mileageKm, raw.mileage, mileageFromProviderText(providerText)),
      fuel: firstText(attrs.brandstof, attrs.fuel, raw.fuelType, raw.fuel, /plug.?in|phev|hybride?|electric|elektr|diesel|benzine|petrol|lpg|waterstof|hydrogen/i.test(providerText) ? providerText : null),
      transmission: firstText(attrs.transmissie, attrs.gearbox, raw.gearbox, raw.transmission, /automaat|automatic|handgeschakeld|manual|schaltgetriebe|cvt/i.test(providerText) ? providerText : null),
      drivetrain: firstText(attrs.aandrijving, attrs.drivetrain, raw.drivetrain), power_kw: firstNumber(attrs.vermogen_kw, attrs.power_kw, raw.powerKw),
      power_hp: firstNumber(attrs.vermogen_pk, attrs.power_hp, raw.powerHp), engine_displacement_cc: firstNumber(attrs.cilinderinhoud, raw.engineDisplacement),
      doors: firstNumber(attrs.deuren, raw.doors), seats: firstNumber(attrs.zitplaatsen, raw.seats), exterior_color: firstText(attrs.kleur, raw.color),
      interior_color: firstText(attrs.interieurkleur, raw.interiorColor), features: raw.features || raw.options || attrs.opties || attrs.accessoires,
      images: raw.images || raw.pictures || pick(raw, 'media.images', '_embedded.mp:advertisement-images', '_embedded.mp:advertisement-image'), vin: firstText(attrs.vin, raw.vin), registration: firstText(attrs.kenteken, raw.licensePlate),
      co2_g_km: firstNumber(attrs.co2, attrs.co2_emissie, raw.co2Emission), environmental: { emission_class: firstText(attrs.emissieklasse, raw.emissionClass) }
    }
  });
}

function normalizeRdwRecord(raw, options = {}) {
  const fetchedAt = new Date(options.fetchedAt || Date.now()).toISOString();
  const registration = text(raw.kenteken, 40).toUpperCase();
  if (!registration) return null;
  const vehicle = {
    make: normalizeMake(raw.merk), model: firstText(raw.handelsbenaming), variant: firstText(raw.type, raw.variant), trim: firstText(raw.uitvoering),
    generation: null, body_type: firstText(raw.inrichting, raw.voertuigsoort), build_year: yearOf(raw.datum_eerste_toelating),
    first_registration: normalizedDate(raw.datum_eerste_toelating), mileage_km: null, fuel: normalizeFuel(raw.brandstof_omschrijving),
    hybrid_ev: {}, transmission: null, drivetrain: null, power_kw: firstNumber(raw.vermogen_massarijklaar), power_hp: null,
    engine_displacement_cc: firstNumber(raw.cilinderinhoud), doors: null, seats: firstNumber(raw.aantal_zitplaatsen),
    exterior_color: firstText(raw.eerste_kleur), interior_color: null, features: [], images: [], vin: null, registration,
    co2_g_km: firstNumber(raw.co2_uitstoot_gecombineerd), environmental: {
      emission_class: firstText(raw.emissiecode_omschrijving), energy_label: firstText(raw.zuinigheidsclassificatie),
      catalog_price_eur: firstNumber(raw.catalogusprijs), original_bpm_eur: firstNumber(raw.bruto_bpm),
      registration_nl: normalizedDate(raw.datum_eerste_tenaamstelling_in_nederland)
    }
  };
  const manifest = sourceManifest('rdw', registration, raw, fetchedAt);
  return {
    schema_version: AUTOMOTIVE_SCHEMA_VERSION,
    record_kind: 'AUTOMOTIVE_VEHICLE_TRUTH',
    canonical_vehicle_id: canonicalVehicleId('rdw', registration, vehicle),
    identity: { canonical_vehicle_id: canonicalVehicleId('rdw', registration, vehicle), provider: 'rdw', provider_record_id: registration, registration, source_url: `https://opendata.rdw.nl/resource/m9d7-ebf2.json?kenteken=${encodeURIComponent(registration)}` },
    vehicle,
    provenance: { provider: 'rdw', provider_verified: true, raw_source_reference: manifest.id, ingestion_timestamp: fetchedAt, provider_modified_at: null, transformation_version: AUTOMOTIVE_TRANSFORMATION_VERSION },
    raw_source_manifest: manifest
  };
}

function listingKey(record) {
  return `${record.identity?.provider || ''}:${record.identity?.provider_listing_id || ''}`;
}

function normalizedToken(value) {
  return text(value, 240).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function canonicalOption(value) {
  const option = normalizedToken(value);
  if (/panorama(?:dak|roof)|panoramic (?:glass )?roof/.test(option)) return 'PANORAMIC_ROOF';
  if (/trekhaak|tow ?bar|trailer coupling/.test(option)) return 'TRAILER_COUPLING';
  if (/luchtvering|air suspension/.test(option)) return 'AIR_SUSPENSION';
  if (/adapt(?:ieve|ive) cruise|adaptive cruise|\bacc\b/.test(option)) return 'ADAPTIVE_CRUISE_CONTROL';
  if (/head up display|\bhud\b/.test(option)) return 'HEAD_UP_DISPLAY';
  if (/360 (?:degree )?camera|surround view/.test(option)) return 'CAMERA_360';
  if (/stoelventilatie|seat ventilation|ventilated seats/.test(option)) return 'VENTILATED_SEATS';
  if (/laserlicht|laser light/.test(option)) return 'LASER_LIGHT';
  return option;
}

function matchesCriteria(record, criteria = {}) {
  const vehicle = record.vehicle || {};
  const commercial = record.commercial || {};
  const seller = record.seller || {};
  const includes = (actual, expected) => normalizedToken(actual).includes(normalizedToken(expected));
  if (criteria.make && normalizedToken(vehicle.make) !== normalizedToken(criteria.make)) return false;
  if (criteria.model && !includes(`${vehicle.model || ''} ${vehicle.variant || ''}`, criteria.model)) return false;
  if (criteria.variant && !includes(`${vehicle.variant || ''} ${vehicle.trim || ''} ${vehicle.model || ''}`, criteria.variant)) return false;
  if (criteria.trim && !includes(`${vehicle.trim || ''} ${vehicle.variant || ''}`, criteria.trim)) return false;
  if (criteria.year_min && (!vehicle.build_year || vehicle.build_year < criteria.year_min)) return false;
  if (criteria.year_max && (!vehicle.build_year || vehicle.build_year > criteria.year_max)) return false;
  if (criteria.mileage_min_km && (vehicle.mileage_km === null || vehicle.mileage_km < criteria.mileage_min_km)) return false;
  if (criteria.mileage_max_km && (vehicle.mileage_km === null || vehicle.mileage_km > criteria.mileage_max_km)) return false;
  if (criteria.purchase_price_min_eur && (commercial.gross_price_eur === null || commercial.gross_price_eur < criteria.purchase_price_min_eur)) return false;
  if (criteria.purchase_price_max_eur && (commercial.gross_price_eur === null || commercial.gross_price_eur > criteria.purchase_price_max_eur)) return false;
  if (criteria.country && seller.country !== normalizeCountry(criteria.country)) return false;
  if (criteria.fuel && vehicle.fuel !== normalizeFuel(criteria.fuel)) return false;
  if (criteria.transmission && vehicle.transmission !== normalizeTransmission(criteria.transmission)) return false;
  if (criteria.drivetrain && vehicle.drivetrain !== normalizeDrivetrain(criteria.drivetrain)) return false;
  if (criteria.power_min_kw && (vehicle.power_kw === null || vehicle.power_kw < criteria.power_min_kw)) return false;
  if (criteria.seller_type && seller.type !== String(criteria.seller_type).toUpperCase()) return false;
  if ((criteria.options || []).some(option => !(vehicle.features || []).some(feature => includes(feature, option) || canonicalOption(feature) === canonicalOption(option)))) return false;
  return true;
}

function duplicateEvidence(left, right) {
  if (listingKey(left) === listingKey(right)) return { duplicate: true, confidence: 1, evidence: ['EXACT_PROVIDER_LISTING_ID'] };
  const leftVin = normalizedToken(left.vehicle?.vin), rightVin = normalizedToken(right.vehicle?.vin);
  if (leftVin && rightVin && leftVin === rightVin) return { duplicate: true, confidence: 1, evidence: ['EXACT_VIN'] };
  const leftRegistration = normalizedToken(left.vehicle?.registration), rightRegistration = normalizedToken(right.vehicle?.registration);
  if (leftRegistration && rightRegistration && leftRegistration === rightRegistration) return { duplicate: true, confidence: 1, evidence: ['EXACT_REGISTRATION'] };
  const sameCore = ['make', 'model', 'variant'].every(field => normalizedToken(left.vehicle?.[field]) && normalizedToken(left.vehicle?.[field]) === normalizedToken(right.vehicle?.[field]));
  const sameYear = left.vehicle?.build_year && left.vehicle.build_year === right.vehicle?.build_year;
  const closeMileage = number(left.vehicle?.mileage_km) !== null && number(right.vehicle?.mileage_km) !== null && Math.abs(left.vehicle.mileage_km - right.vehicle.mileage_km) <= 100;
  const samePrice = number(left.commercial?.gross_price_eur) !== null && left.commercial.gross_price_eur === right.commercial?.gross_price_eur;
  const sameSeller = normalizedToken(left.seller?.name) && normalizedToken(left.seller?.name) === normalizedToken(right.seller?.name) && normalizedToken(left.seller?.city) === normalizedToken(right.seller?.city);
  const imageOverlap = (left.vehicle?.images || []).some(image => (right.vehicle?.images || []).includes(image));
  if (sameCore && sameYear && closeMileage && samePrice && sameSeller && imageOverlap) return { duplicate: true, confidence: 0.99, evidence: ['MAKE_MODEL_VARIANT', 'YEAR', 'MILEAGE_WITHIN_100KM', 'EXACT_PRICE', 'SELLER_LOCATION', 'IMAGE_OVERLAP'] };
  return { duplicate: false, confidence: sameCore && sameYear && closeMileage && samePrice ? 0.82 : 0, evidence: sameCore ? ['SIMILAR_CORE_NOT_MERGED'] : [] };
}

function deduplicateListings(records = []) {
  const groups = [];
  for (const record of records) {
    let target = null;
    let proof = null;
    for (const group of groups) {
      const result = duplicateEvidence(group.items[0], record);
      if (result.duplicate) { target = group; proof = result; break; }
    }
    if (!target) groups.push({ group_id: stableId('dedup', listingKey(record)), items: [record], confidence: 1, evidence: ['UNIQUE_LISTING'] });
    else {
      target.items.push(record);
      target.confidence = Math.min(target.confidence, proof.confidence);
      target.evidence = [...new Set([...target.evidence.filter(item => item !== 'UNIQUE_LISTING'), ...proof.evidence])];
    }
  }
  const items = groups.map(group => {
    const sorted = [...group.items].sort((a, b) => Date.parse(b.listing?.last_verified_at || 0) - Date.parse(a.listing?.last_verified_at || 0));
    const representative = clone(sorted[0]);
    representative.entity_resolution = {
      group_id: group.group_id,
      duplicate_count: Math.max(0, sorted.length - 1),
      confidence: group.confidence,
      evidence: group.evidence,
      conservative_merge: true,
      alternate_listings: sorted.slice(1).map(item => ({ canonical_listing_id: item.canonical_listing_id, provider: item.identity.provider, provider_listing_id: item.identity.provider_listing_id, source_url: item.identity.source_url }))
    };
    return representative;
  });
  return { items, input_count: records.length, output_count: items.length, duplicates_resolved: records.length - items.length, groups: groups.filter(group => group.items.length > 1).map(group => ({ group_id: group.group_id, listing_ids: group.items.map(item => item.canonical_listing_id), confidence: group.confidence, evidence: group.evidence })) };
}

function percentile(values, p) {
  const sorted = values.filter(value => Number.isFinite(value)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index), upper = Math.ceil(index);
  return Math.round((sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower)) * 100) / 100;
}

function comparableSimilarity(candidate, comparable) {
  const a = candidate.vehicle || {}, b = comparable.vehicle || {};
  if (normalizedToken(a.make) !== normalizedToken(b.make) || normalizedToken(a.model) !== normalizedToken(b.model)) return { score: 0, evidence: ['MAKE_OR_MODEL_MISMATCH'] };
  let score = 50;
  const evidence = ['MAKE_EXACT', 'MODEL_EXACT'];
  if (normalizedToken(a.variant) && normalizedToken(a.variant) === normalizedToken(b.variant)) { score += 12; evidence.push('VARIANT_EXACT'); }
  if (a.build_year && b.build_year) { const diff = Math.abs(a.build_year - b.build_year); score += Math.max(0, 12 - diff * 4); evidence.push(`YEAR_DIFF_${diff}`); }
  if (number(a.mileage_km) !== null && number(b.mileage_km) !== null) { const diff = Math.abs(a.mileage_km - b.mileage_km); score += Math.max(0, 12 - Math.floor(diff / 15000) * 3); evidence.push(`MILEAGE_DIFF_${Math.round(diff)}`); }
  if (a.fuel && a.fuel === b.fuel) { score += 6; evidence.push('FUEL_EXACT'); }
  if (normalizedToken(a.trim) && normalizedToken(a.trim) === normalizedToken(b.trim)) { score += 4; evidence.push('TRIM_EXACT'); }
  if (a.body_type && a.body_type === b.body_type) { score += 2; evidence.push('BODY_EXACT'); }
  const candidateFeatures = new Set((a.features || []).map(normalizedToken));
  const overlap = (b.features || []).map(normalizedToken).filter(feature => candidateFeatures.has(feature)).length;
  if (overlap) { score += Math.min(2, overlap); evidence.push(`FEATURE_OVERLAP_${overlap}`); }
  return { score: Math.min(100, score), evidence };
}

function fullMonthsBetween(from, to) {
  const start = new Date(from), end = new Date(to);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start > end) return null;
  let months = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth();
  if (end.getUTCDate() < start.getUTCDate()) months--;
  return Math.max(0, months);
}

const BPM_DEPRECIATION_SEGMENTS = Object.freeze([
  { start: 0, end: 1, base: 0, monthly: 12 }, { start: 1, end: 3, base: 12, monthly: 4 },
  { start: 3, end: 5, base: 20, monthly: 3.5 }, { start: 5, end: 9, base: 27, monthly: 1.5 },
  { start: 9, end: 18, base: 33, monthly: 1 }, { start: 18, end: 30, base: 42, monthly: 0.75 },
  { start: 30, end: 42, base: 51, monthly: 0.5 }, { start: 42, end: 54, base: 57, monthly: 0.42 },
  { start: 54, end: 66, base: 62, monthly: 0.42 }, { start: 66, end: 78, base: 67, monthly: 0.42 },
  { start: 78, end: 90, base: 72, monthly: 0.25 }, { start: 90, end: 102, base: 75, monthly: 0.25 },
  { start: 102, end: 114, base: 78, monthly: 0.25 }, { start: 114, end: 214, base: 81, monthly: 0.19 }
]);

function bpmDepreciationPercent(firstRegistration, referenceDate = new Date()) {
  const months = fullMonthsBetween(firstRegistration, referenceDate);
  if (months === null) return null;
  if (months >= 214) return { age_months: months, depreciation_percent: 100, method: 'FORFAITAIRE_TABEL' };
  const segment = BPM_DEPRECIATION_SEGMENTS.find(item => months >= item.start && months < item.end) || BPM_DEPRECIATION_SEGMENTS[0];
  return { age_months: months, depreciation_percent: Math.min(100, Math.round((segment.base + (months - segment.start) * segment.monthly) * 100) / 100), method: 'FORFAITAIRE_TABEL' };
}

function calculateBpm2026(input = {}) {
  const co2 = number(input.co2_g_km), fuel = normalizeFuel(input.fuel), firstRegistration = normalizedDate(input.first_registration), referenceDate = input.reference_date ? new Date(input.reference_date) : new Date();
  if (co2 === null || co2 < 0) return { status: 'needs_input', type: 'UNKNOWN', missing_fields: ['co2_g_km'], rule_version: BPM_RULE_VERSION };
  let gross;
  if (co2 <= 77) gross = 687 + co2 * 2;
  else if (co2 <= 100) gross = 841 + (co2 - 77) * 82;
  else if (co2 <= 139) gross = 2727 + (co2 - 100) * 181;
  else if (co2 <= 155) gross = 9786 + (co2 - 139) * 297;
  else gross = 14538 + (co2 - 155) * 594;
  const dieselSurcharge = fuel === 'DIESEL' && co2 > 69 ? (co2 - 69) * 114.83 : 0;
  const grossWithSurcharge = Math.round(gross + dieselSurcharge);
  if (!firstRegistration) return { status: 'needs_input', type: 'CALCULATION', gross_bpm_2026_eur: grossWithSurcharge, missing_fields: ['first_registration'], rule_version: BPM_RULE_VERSION };
  const depreciation = bpmDepreciationPercent(firstRegistration, referenceDate);
  if (!depreciation) return { status: 'needs_input', type: 'UNKNOWN', missing_fields: ['valid_first_registration'], rule_version: BPM_RULE_VERSION };
  return {
    status: 'estimated', type: 'ESTIMATE', gross_bpm_2026_eur: grossWithSurcharge, diesel_surcharge_eur: Math.round(dieselSurcharge * 100) / 100,
    depreciation, estimated_payable_bpm_eur: Math.max(0, Math.round(grossWithSurcharge * (1 - depreciation.depreciation_percent / 100))),
    rule_version: BPM_RULE_VERSION,
    source: 'Belastingdienst 2026 personenauto BPM-tabel en forfaitaire afschrijving',
    warnings: ['Voor gebruikte importauto’s moet de gunstigste toegestane historische/current rate en koerslijst/taxatie worden vergeleken; dit is geen definitieve aangifte.']
  };
}

function providerSafeError(error) {
  const status = Number(error?.provider_status || error?.statusCode || error?.status || 0) || null;
  const code = error?.code || (status === 401 || status === 403 ? 'PROVIDER_AUTH_REQUIRED' : status === 429 ? 'PROVIDER_RATE_LIMITED' : error?.name === 'TimeoutError' ? 'PROVIDER_TIMEOUT' : 'PROVIDER_UNAVAILABLE');
  return { code: text(code, 120), provider_http_status: status, message: status ? `Provider request failed (HTTP ${status})` : text(error?.message || 'Provider request failed', 240) };
}

async function responseJson(response, provider) {
  const raw = await response.text();
  let data;
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = {}; }
  if (!response.ok) {
    const error = automotiveError(response.status === 401 || response.status === 403 ? 503 : 502, response.status === 401 || response.status === 403 ? 'PROVIDER_AUTH_REQUIRED' : 'PROVIDER_REJECTED', `${provider} provider request failed`, { provider_http_status: response.status });
    error.provider_status = response.status;
    throw error;
  }
  return data;
}

function mobileRecords(data) {
  if (Array.isArray(data)) return data;
  for (const value of [data.ads, data.vehicles, data.results, data.items, data.advertisements, readPath(data, '_embedded.ads')]) {
    if (Array.isArray(value)) return value;
    if (Array.isArray(value?.ad)) return value.ad;
  }
  return [];
}

function marktplaatsRecords(data) {
  if (Array.isArray(data)) return data;
  for (const value of [data.advertisements, data.searchResults, data.results, data.items, readPath(data, '_embedded.advertisements'), readPath(data, '_embedded.mp:search-result')]) if (Array.isArray(value)) return value;
  return [];
}

function escapeSoql(value) {
  return String(value || '').replace(/'/g, "''").replace(/[\u0000-\u001f\u007f]/g, ' ');
}

function mobileRefId(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
}

function mobileFuelFilter(value) {
  return ({ PETROL: 'PETROL', DIESEL: 'DIESEL', ELECTRIC: 'ELECTRICITY', HYBRID: 'HYBRID', PLUGIN_HYBRID: 'HYBRID', LPG: 'LPG', HYDROGEN: 'HYDROGENIUM' })[normalizeFuel(value)] || null;
}

function mobileGearboxFilter(value) {
  return ({ AUTOMATIC: 'AUTOMATIC_GEAR', MANUAL: 'MANUAL_GEAR' })[normalizeTransmission(value)] || null;
}

function providerPageBatch(records, pagination = {}, timing = {}) {
  return { records: Array.isArray(records) ? records : [], pagination: sanitize(pagination), timing: sanitize(timing) };
}

function unpackProviderPageBatch(value) {
  return Array.isArray(value) ? { records: value, pagination: {}, timing: {} } : providerPageBatch(value?.records, value?.pagination, value?.timing);
}

function safeProviderPageUrl(value, baseUrl) {
  if (!value) return null;
  try {
    const base = new URL(baseUrl), next = new URL(String(value), base);
    return next.protocol === 'https:' && next.origin === base.origin && !next.username && !next.password ? next.toString() : null;
  } catch {
    return null;
  }
}

class FoundlyAutomotiveCore {
  constructor(adapter = {}) {
    if (typeof adapter.bucket !== 'function' || typeof adapter.persist !== 'function' || typeof adapter.fetch !== 'function') throw new TypeError('Automotive Core requires existing bucket, persistence and fetch adapters');
    this.adapter = { id: () => crypto.randomUUID(), now: () => new Date(), providerConfig: () => ({}), emit: () => {}, ...adapter };
  }

  scope(context, principal = {}) {
    const tenantId = text(context?.tenant_id, 160), dealerId = text(context?.dealer_id, 160);
    if (!tenantId || !dealerId || !/^[A-Za-z0-9_.:-]+$/.test(tenantId) || !/^[A-Za-z0-9_.:-]+$/.test(dealerId)) throw automotiveError(400, 'automotive_scope_invalid', 'Geldige tenant_id en dealer_id zijn verplicht');
    const roles = Array.isArray(principal.roles) ? principal.roles.map(role => String(role).toUpperCase()) : [];
    if (!principal.id || !roles.length || roles.includes('UNAUTHENTICATED')) throw automotiveError(403, 'automotive_access_denied', 'Geauthenticeerde principal met rol is verplicht');
    return { ctx: { tenant_id: tenantId, dealer_id: dealerId }, principal: { id: text(principal.id, 160), roles } };
  }

  bucket(ctx, name) { return this.adapter.bucket(ctx, `automotive:${name}`); }
  now() { return new Date(this.adapter.now()).toISOString(); }
  commit() { this.adapter.persist(); }

  providerConfiguration(provider, ctx) {
    const config = this.adapter.providerConfig(provider, ctx) || {};
    if (provider === 'rdw') return { configured: true, authenticated: true, base_url: config.base_url || 'https://opendata.rdw.nl' };
    if (provider === 'mobile_de') return { configured: Boolean(config.username && config.password), authenticated: Boolean(config.username && config.password), username: config.username, password: config.password, base_url: config.base_url || 'https://services.mobile.de' };
    if (provider === 'marktplaats') return { configured: Boolean(config.client_id || config.access_token), authenticated: Boolean(config.access_token), access_token: config.access_token, base_url: config.base_url || 'https://api.marktplaats.nl' };
    if (provider === 'autoscout24') return { configured: Boolean(config.api_key || config.access_token), authenticated: Boolean(config.api_key || config.access_token), base_url: config.base_url || null };
    return { configured: false, authenticated: false, base_url: null };
  }

  providerStatuses(context, principal) {
    const { ctx } = this.scope(context, principal);
    const executions = this.bucket(ctx, 'telemetry');
    return SUPPORTED_PROVIDERS.map(provider => {
      const config = this.providerConfiguration(provider, ctx), latest = [...executions].reverse().find(row => row.provider === provider && row.operation === 'SEARCH');
      return {
        provider, category: provider === 'rdw' ? 'VEHICLE_TRUTH' : 'MARKETPLACE', configured: Boolean(config.configured), authenticated: Boolean(config.authenticated),
        adapter_available: provider !== 'autoscout24', probe: latest?.success === true ? 'PASS' : latest?.success === false ? 'FAIL' : 'NOT_RUN',
        real_search: latest?.success === true ? 'PASS' : latest?.success === false ? 'FAIL' : 'NOT_RUN', last_attempt_at: latest?.completed_at || null,
        last_error: latest?.error || null, secrets_exposed: false
      };
    });
  }

  async request(url, options, provider) {
    const response = await this.adapter.fetch(url, { ...options, signal: options?.signal || AbortSignal.timeout(Number(this.adapter.providerTimeoutMs || 9000)) });
    return responseJson(response, provider);
  }

  async searchRdw(criteria, ctx) {
    const config = this.providerConfiguration('rdw', ctx), params = new URLSearchParams();
    params.set('$select', 'kenteken,voertuigsoort,inrichting,merk,handelsbenaming,datum_eerste_toelating,datum_eerste_tenaamstelling_in_nederland,bruto_bpm,catalogusprijs,zuinigheidsclassificatie,cilinderinhoud,aantal_zitplaatsen,eerste_kleur');
    const where = [];
    if (criteria.make) where.push(`upper(merk)='${escapeSoql(criteria.make.toUpperCase())}'`);
    if (criteria.model) where.push(`upper(handelsbenaming) like '%${escapeSoql(criteria.model.toUpperCase())}%'`);
    if (criteria.year_min) where.push(`datum_eerste_toelating >= '${Math.round(criteria.year_min)}0101'`);
    if (criteria.year_max) where.push(`datum_eerste_toelating <= '${Math.round(criteria.year_max)}1231'`);
    if (where.length) params.set('$where', where.join(' AND '));
    params.set('$limit', String(Math.min(100, Number(criteria.limit) || 50)));
    const data = await this.request(`${config.base_url.replace(/\/$/, '')}/resource/m9d7-ebf2.json?${params}`, { method: 'GET', headers: { accept: 'application/json' } }, 'rdw');
    return Array.isArray(data) ? data : [];
  }

  async searchMobileDe(criteria, ctx) {
    const config = this.providerConfiguration('mobile_de', ctx);
    if (!config.configured) throw automotiveError(503, 'PROVIDER_NOT_CONFIGURED', 'mobile.de is niet geconfigureerd');
    const totalLimit = Math.max(1, Math.min(2000, Number(criteria.limit) || 50));
    const pageSize = Math.max(1, Math.min(100, Number(criteria.page_size) || Math.min(100, totalLimit)));
    const maxPageRequests = Math.max(1, Math.min(20, Number(criteria.max_pages) || Math.ceil(totalLimit / pageSize)));
    const params = new URLSearchParams({ 'page.number': '1', 'page.size': String(pageSize) });
    if (criteria.make) params.append('classification', `refdata/classes/Car/makes/${mobileRefId(criteria.make)}`);
    else params.append('classification', 'refdata/classes/Car');
    if (criteria.model || criteria.variant) params.set('modelDescription', [criteria.model, criteria.variant].filter(Boolean).join(' '));
    if (criteria.year_min) params.set('firstRegistrationDate.min', `${Math.round(criteria.year_min)}-01`);
    if (criteria.year_max) params.set('firstRegistrationDate.max', `${Math.round(criteria.year_max)}-12`);
    if (criteria.mileage_min_km) params.set('mileage.min', String(Math.round(criteria.mileage_min_km)));
    if (criteria.mileage_max_km) params.set('mileage.max', String(Math.round(criteria.mileage_max_km)));
    if (criteria.purchase_price_min_eur) params.set('price.min', String(Math.round(criteria.purchase_price_min_eur)));
    if (criteria.purchase_price_max_eur) params.set('price.max', String(Math.round(criteria.purchase_price_max_eur)));
    if (criteria.country) params.append('country', criteria.country);
    const fuel = mobileFuelFilter(criteria.fuel);
    if (fuel) params.append('fuel', fuel);
    const gearbox = mobileGearboxFilter(criteria.transmission);
    if (gearbox) params.append('gearbox', gearbox);
    if (criteria.power_min_kw) params.set('power.min', String(Math.round(criteria.power_min_kw)));
    const featureFilters = (criteria.options || []).map(option => MOBILE_DE_FEATURE_FILTERS[normalizedToken(option)]).filter(Boolean);
    if (normalizeFuel(criteria.fuel) === 'PLUGIN_HYBRID') featureFilters.push('HYBRID_PLUGIN');
    for (const feature of [...new Set(featureFilters)]) params.append('feature', feature);
    const authorization = `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`;
    const records = [], requestStarted = Date.now();
    let pagesReceived = 0, providerTotal = null, providerMaxPages = null;
    for (let page = 1; page <= maxPageRequests && records.length < totalLimit; page++) {
      params.set('page.number', String(page));
      const data = await this.request(`${config.base_url.replace(/\/$/, '')}/search-api/search?${params}`, { method: 'GET', headers: { accept: 'application/vnd.de.mobile.api+json', authorization } }, 'mobile_de');
      const rows = mobileRecords(data), remaining = totalLimit - records.length;
      records.push(...rows.slice(0, remaining));
      pagesReceived++;
      if (providerTotal === null) providerTotal = integer(data?.total);
      if (providerMaxPages === null) providerMaxPages = integer(data?.maxPages);
      const currentPage = integer(data?.currentPage) || page;
      if (!rows.length || rows.length < pageSize || (providerMaxPages !== null && currentPage >= providerMaxPages)) break;
    }
    return providerPageBatch(records, { strategy: 'PAGE_NUMBER', page_size: pageSize, pages_received: pagesReceived, provider_total: providerTotal, provider_max_pages: providerMaxPages, result_limit: totalLimit, bounded: true }, { provider_latency_ms: Date.now() - requestStarted });
  }

  async searchMarktplaats(criteria, ctx) {
    const config = this.providerConfiguration('marktplaats', ctx);
    if (!config.configured) throw automotiveError(503, 'PROVIDER_NOT_CONFIGURED', 'Marktplaats is niet geconfigureerd');
    if (!config.authenticated) throw automotiveError(503, 'PROVIDER_AUTH_REQUIRED', 'Marktplaats OAuth-token ontbreekt');
    const query = [criteria.make, criteria.model, criteria.variant, criteria.trim, ...(criteria.options || [])].filter(Boolean).join(' ') || 'auto';
    const totalLimit = Math.max(1, Math.min(1000, Number(criteria.limit) || 100));
    const pageSize = Math.max(1, Math.min(200, Number(criteria.page_size) || Math.min(200, totalLimit)));
    const maxPageRequests = Math.max(1, Math.min(25, Number(criteria.max_pages) || Math.ceil(totalLimit / pageSize)));
    const baseUrl = config.base_url.replace(/\/$/, '');
    const params = new URLSearchParams({ query, offset: '0', limit: String(pageSize), withImages: 'true' });
    let nextUrl = `${baseUrl}/v2/search?${params}`;
    const records = [], requestStarted = Date.now();
    let pagesReceived = 0, providerTotal = null, followedNextLinks = 0;
    for (let page = 0; page < maxPageRequests && records.length < totalLimit; page++) {
      const data = await this.request(nextUrl, { method: 'GET', headers: { accept: 'application/json', authorization: `Bearer ${config.access_token}` } }, 'marktplaats');
      const rows = marktplaatsRecords(data), remaining = totalLimit - records.length;
      records.push(...rows.slice(0, remaining));
      pagesReceived++;
      if (providerTotal === null) providerTotal = integer(data?.totalCount);
      if (!rows.length || rows.length < pageSize || records.length >= totalLimit) break;
      const advertisedNext = pick(data, '_links.next.href');
      if (advertisedNext) {
        const safeNext = safeProviderPageUrl(advertisedNext, baseUrl);
        if (!safeNext) throw automotiveError(502, 'PROVIDER_PAGINATION_URL_REJECTED', 'Marktplaats pagination link wees buiten de geconfigureerde provider-origin');
        nextUrl = safeNext;
        followedNextLinks++;
      } else {
        params.set('offset', String((page + 1) * pageSize));
        nextUrl = `${baseUrl}/v2/search?${params}`;
      }
    }
    return providerPageBatch(records, { strategy: followedNextLinks ? 'HAL_NEXT_LINK' : 'OFFSET', page_size: pageSize, pages_received: pagesReceived, provider_total: providerTotal, next_links_followed: followedNextLinks, result_limit: totalLimit, bounded: true }, { provider_latency_ms: Date.now() - requestStarted });
  }

  normalize(provider, raw, fetchedAt) {
    if (provider === 'rdw') return normalizeRdwRecord(raw, { fetchedAt });
    if (provider === 'mobile_de') return normalizeMobileDeRecord(raw, { fetchedAt });
    if (provider === 'marktplaats') return normalizeMarktplaatsRecord(raw, { fetchedAt });
    return null;
  }

  recordTelemetry(ctx, input) {
    const row = { id: this.adapter.id(), tenant_id: ctx.tenant_id, dealer_id: ctx.dealer_id, ...sanitize(input), contains_secrets: false };
    const rows = this.bucket(ctx, 'telemetry');
    rows.push(row);
    if (rows.length > 1000) rows.splice(0, rows.length - 1000);
    return row;
  }

  upsertManifest(ctx, manifest) {
    const rows = this.bucket(ctx, 'raw_source_manifests');
    if (!rows.some(row => row.id === manifest.id)) rows.push({ ...manifest, tenant_id: ctx.tenant_id, dealer_id: ctx.dealer_id });
  }

  upsertRecord(ctx, record) {
    const name = record.record_kind === 'AUTOMOTIVE_LISTING' ? 'listings' : 'vehicle_truth';
    const idField = record.record_kind === 'AUTOMOTIVE_LISTING' ? 'canonical_listing_id' : 'canonical_vehicle_id';
    const rows = this.bucket(ctx, name), index = rows.findIndex(row => row[idField] === record[idField]);
    this.upsertManifest(ctx, record.raw_source_manifest);
    const clean = { ...record, tenant_id: ctx.tenant_id, dealer_id: ctx.dealer_id };
    delete clean.raw_source_manifest;
    if (index < 0) {
      clean.first_seen_at = record.provenance.ingestion_timestamp;
      clean.revision = 1;
      rows.push(clean);
      return clean;
    }
    const prior = rows[index], priorDigest = sha256(JSON.stringify({ vehicle: prior.vehicle, seller: prior.seller, commercial: prior.commercial, status: prior.listing?.status })), nextDigest = sha256(JSON.stringify({ vehicle: clean.vehicle, seller: clean.seller, commercial: clean.commercial, status: clean.listing?.status }));
    if (priorDigest !== nextDigest) {
      this.bucket(ctx, 'listing_history').push({ id: this.adapter.id(), canonical_listing_id: prior.canonical_listing_id, revision: prior.revision, changed_at: this.now(), snapshot: clone(prior), provider_verified: true });
    }
    rows[index] = { ...prior, ...clean, first_seen_at: prior.first_seen_at, revision: priorDigest === nextDigest ? prior.revision : prior.revision + 1 };
    return rows[index];
  }

  cachedListings(ctx, provider, criteria) {
    return this.bucket(ctx, 'listings').filter(record => record.provenance?.provider_verified && record.identity?.provider === provider && record.listing?.status === 'ACTIVE' && matchesCriteria(record, criteria)).map(record => {
      const copy = clone(record);
      copy.listing.freshness = classifyFreshness(copy.listing.last_verified_at, this.adapter.now(), 'cache', copy.identity?.provider);
      return copy;
    });
  }

  refreshListingFreshness(record, mode = 'live') {
    const copy = clone(record);
    if (copy?.listing) copy.listing.freshness = classifyFreshness(copy.listing.last_verified_at, this.adapter.now(), mode, copy.identity?.provider);
    return copy;
  }

  async search(context, principal, input = {}, options = {}) {
    const { ctx } = this.scope(context, principal), parsed = parseSearchCriteria(input, options.previous_criteria || input.previous_criteria || {});
    if (parsed.needs_clarification) return { ok: false, status: 'needs_input', ...parsed, results: [], provider_executions: [], real_data_only: true };
    const correlationId = text(options.correlation_id || input.correlation_id, 160) || this.adapter.id();
    const requested = Array.isArray(input.providers) ? input.providers.filter(provider => SUPPORTED_PROVIDERS.includes(provider)) : ['rdw', 'mobile_de', 'marktplaats'];
    const providers = [...new Set(requested)], startedAt = Date.now();
    const runs = await Promise.all(providers.map(async provider => {
      const providerStarted = Date.now(), fetchedAt = this.now();
      try {
        let providerOutput;
        if (provider === 'rdw') providerOutput = await this.searchRdw(parsed.criteria, ctx);
        else if (provider === 'mobile_de') providerOutput = await this.searchMobileDe(parsed.criteria, ctx);
        else if (provider === 'marktplaats') providerOutput = await this.searchMarktplaats(parsed.criteria, ctx);
        else throw automotiveError(503, 'PROVIDER_ADAPTER_UNAVAILABLE', 'AutoScout24 adapter is niet actief zonder geverifieerde toegang');
        const batch = unpackProviderPageBatch(providerOutput), raw = batch.records, normalizationStarted = Date.now();
        const normalized = raw.map(item => this.normalize(provider, item, fetchedAt)).filter(Boolean), rejected = raw.length - normalized.length, normalizationMs = Date.now() - normalizationStarted;
        const persistenceStarted = Date.now();
        const stored = normalized.map(record => this.upsertRecord(ctx, record));
        const execution = { provider, category: provider === 'rdw' ? 'VEHICLE_TRUTH' : 'MARKETPLACE', state: 'LIVE', success: true, called: true, latency_ms: Date.now() - providerStarted, provider_latency_ms: number(batch.timing.provider_latency_ms) ?? Math.max(0, normalizationStarted - providerStarted), normalization_ms: normalizationMs, persistence_ms: Date.now() - persistenceStarted, cache_lookup_ms: 0, records_received: raw.length, records_normalized: normalized.length, records_rejected: rejected, pagination: batch.pagination, cache: 'MISS', completed_at: this.now(), error: null };
        this.recordTelemetry(ctx, { ...execution, operation: 'SEARCH', correlation_id: correlationId });
        return { execution, records: stored };
      } catch (error) {
        const safe = providerSafeError(error), cacheStarted = Date.now(), cached = provider === 'rdw' ? [] : this.cachedListings(ctx, provider, parsed.criteria), cacheLookupMs = Date.now() - cacheStarted;
        const state = cached.length ? (cached.some(record => record.listing.freshness.classification === 'CACHED') ? 'CACHED' : 'STALE') : 'UNAVAILABLE';
        const execution = { provider, category: provider === 'rdw' ? 'VEHICLE_TRUTH' : 'MARKETPLACE', state, success: false, called: true, latency_ms: Date.now() - providerStarted, provider_latency_ms: Date.now() - providerStarted - cacheLookupMs, normalization_ms: 0, persistence_ms: 0, cache_lookup_ms: cacheLookupMs, records_received: 0, records_normalized: 0, records_rejected: 0, records_from_cache: cached.length, pagination: {}, cache: cached.length ? 'HIT' : 'MISS', completed_at: this.now(), error: safe };
        this.recordTelemetry(ctx, { ...execution, operation: 'SEARCH', correlation_id: correlationId });
        return { execution, records: cached };
      }
    }));
    const listings = runs.flatMap(run => run.records).filter(record => record.record_kind === 'AUTOMOTIVE_LISTING' && matchesCriteria(record, parsed.criteria));
    const truths = runs.flatMap(run => run.records).filter(record => record.record_kind === 'AUTOMOTIVE_VEHICLE_TRUTH');
    const dedup = deduplicateListings(listings);
    const searchId = this.adapter.id(), providerExecutions = runs.map(run => run.execution);
    const marketplaceReachable = providerExecutions.some(row => row.category === 'MARKETPLACE' && (row.success || row.records_from_cache));
    const status = dedup.items.length ? (providerExecutions.every(row => row.success) ? 'completed' : 'partial') : (marketplaceReachable ? 'no_results' : 'unavailable');
    const searchRecord = {
      id: searchId, tenant_id: ctx.tenant_id, dealer_id: ctx.dealer_id, correlation_id: correlationId, original_query: parsed.original_query,
      criteria: parsed.criteria, interpretation_version: parsed.interpretation_version, provider_executions: providerExecutions,
      listing_ids: dedup.items.map(record => record.canonical_listing_id), vehicle_truth_ids: truths.map(record => record.canonical_vehicle_id),
      duplicate_groups: dedup.groups, created_at: this.now(), status, real_data_only: true, synthetic_records: 0
    };
    this.bucket(ctx, 'searches').push(searchRecord);
    if (this.bucket(ctx, 'searches').length > 500) this.bucket(ctx, 'searches').splice(0, this.bucket(ctx, 'searches').length - 500);
    this.adapter.emit(ctx, { event_name: 'automotive_search_completed', entity_type: 'automotive_search', entity_id: searchId, correlation_id: correlationId, properties: { status, result_count: dedup.items.length, providers: providerExecutions.map(row => ({ provider: row.provider, state: row.state })) } });
    this.commit();
    return {
      ok: status === 'completed' || status === 'partial' || status === 'no_results', status, search_id: searchId, correlation_id: correlationId,
      original_query: parsed.original_query, criteria: parsed.criteria, interpretation_version: parsed.interpretation_version,
      provider_executions: providerExecutions, results: dedup.items, vehicle_truth: truths,
      deduplication: { input_count: dedup.input_count, output_count: dedup.output_count, duplicates_resolved: dedup.duplicates_resolved, groups: dedup.groups },
      observability: { total_latency_ms: Date.now() - startedAt, ranking_completed: false, comparable_count: 0 },
      real_data_only: true, synthetic_records: 0
    };
  }

  getSearch(context, principal, searchId) {
    const { ctx } = this.scope(context, principal), search = this.bucket(ctx, 'searches').find(row => row.id === searchId);
    if (!search) throw automotiveError(404, 'automotive_search_not_found', 'Automotive zoekopdracht niet gevonden');
    const listings = this.bucket(ctx, 'listings').filter(row => search.listing_ids.includes(row.canonical_listing_id)).map(row => this.refreshListingFreshness(row, 'cache'));
    return { ...clone(search), results: listings };
  }

  getVehicle(context, principal, vehicleId) {
    const { ctx } = this.scope(context, principal);
    const listings = this.bucket(ctx, 'listings').filter(row => row.canonical_vehicle_id === vehicleId || row.canonical_listing_id === vehicleId).map(row => this.refreshListingFreshness(row, 'cache'));
    const truth = this.bucket(ctx, 'vehicle_truth').filter(row => row.canonical_vehicle_id === vehicleId || listings.some(listing => listing.vehicle?.registration && listing.vehicle.registration === row.vehicle?.registration));
    if (!listings.length && !truth.length) throw automotiveError(404, 'automotive_vehicle_not_found', 'Voertuig niet gevonden');
    return { canonical_vehicle_id: listings[0]?.canonical_vehicle_id || truth[0]?.canonical_vehicle_id, listings: clone(listings), vehicle_truth: clone(truth), provider_verified: [...listings, ...truth].every(row => row.provenance?.provider_verified) };
  }

  comparables(context, principal, vehicleId, options = {}) {
    const { ctx } = this.scope(context, principal), candidate = this.bucket(ctx, 'listings').find(row => row.canonical_listing_id === vehicleId || row.canonical_vehicle_id === vehicleId);
    if (!candidate) throw automotiveError(404, 'automotive_candidate_not_found', 'Kandidaatlisting niet gevonden');
    const rows = this.bucket(ctx, 'listings').filter(row => row.canonical_listing_id !== candidate.canonical_listing_id && row.provenance?.provider_verified && row.listing?.status === 'ACTIVE' && row.seller?.country === (options.country || 'NL') && number(row.commercial?.gross_price_eur) !== null);
    const matches = rows.map(record => ({ record, ...comparableSimilarity(candidate, record) })).filter(item => item.score >= 58).sort((a, b) => b.score - a.score).slice(0, Math.min(100, Number(options.limit) || 30));
    const prices = matches.map(item => item.record.commercial.gross_price_eur), mileages = matches.map(item => number(item.record.vehicle?.mileage_km)).filter(value => value !== null), years = matches.map(item => number(item.record.vehicle?.build_year)).filter(value => value !== null), sourceMix = {};
    for (const item of matches) sourceMix[item.record.identity.provider] = (sourceMix[item.record.identity.provider] || 0) + 1;
    const freshness = matches.map(item => classifyFreshness(item.record.listing?.last_verified_at, this.adapter.now(), 'cache', item.record.identity?.provider).classification), stale = freshness.filter(value => value === 'STALE').length;
    const confidence = matches.length >= 8 && stale <= Math.floor(matches.length / 4) ? 'HIGH' : matches.length >= 4 ? 'MEDIUM' : matches.length ? 'LOW' : 'UNAVAILABLE';
    return {
      ok: true, available: matches.length > 0, candidate_id: candidate.canonical_listing_id, country: options.country || 'NL', comparable_count: matches.length,
      price_distribution_eur: { min: percentile(prices, 0), p25: percentile(prices, 0.25), median: percentile(prices, 0.5), p75: percentile(prices, 0.75), max: percentile(prices, 1) },
      mileage_distribution_km: { min: percentile(mileages, 0), median: percentile(mileages, 0.5), max: percentile(mileages, 1) },
      year_distribution: { min: percentile(years, 0), median: percentile(years, 0.5), max: percentile(years, 1) },
      source_mix: sourceMix, freshness: { classifications: freshness, stale_count: stale }, confidence,
      version: AUTOMOTIVE_COMPARABLE_VERSION, observed_at: this.now(),
      listings: matches.map(item => ({ canonical_listing_id: item.record.canonical_listing_id, provider: item.record.identity.provider, provider_listing_id: item.record.identity.provider_listing_id, source_url: item.record.identity.source_url, price_eur: item.record.commercial.gross_price_eur, mileage_km: item.record.vehicle.mileage_km, build_year: item.record.vehicle.build_year, similarity_score: item.score, evidence: item.evidence, freshness: classifyFreshness(item.record.listing.last_verified_at, this.adapter.now(), 'cache', item.record.identity?.provider) }))
    };
  }

  calculateEconomics(context, principal, vehicleId, input = {}) {
    const { ctx } = this.scope(context, principal), candidate = this.bucket(ctx, 'listings').find(row => row.canonical_listing_id === vehicleId || row.canonical_vehicle_id === vehicleId);
    if (!candidate) throw automotiveError(404, 'automotive_candidate_not_found', 'Kandidaatlisting niet gevonden');
    const purchase = number(input.purchase_price_eur) ?? number(candidate.commercial?.gross_price_eur), currency = candidate.commercial?.currency || 'EUR';
    const destination = normalizeCountry(input.destination_country || 'NL'), sourceCountry = normalizeCountry(input.source_country || candidate.seller?.country);
    const comparables = this.comparables(context, principal, candidate.canonical_listing_id, { country: destination });
    const missing = [];
    if (purchase === null) missing.push('purchase_price_eur');
    if (currency !== 'EUR' && number(input.fx_rate_to_eur) === null) missing.push('fx_rate_to_eur');
    const purchaseEur = purchase === null ? null : currency === 'EUR' ? purchase : purchase * number(input.fx_rate_to_eur);
    const imported = sourceCountry && destination && sourceCountry !== destination;
    let bpm;
    if (!imported && sourceCountry === 'NL') bpm = { status: 'not_applicable', type: 'FACT', estimated_payable_bpm_eur: 0, rule_version: BPM_RULE_VERSION, explanation: 'Nederlandse listing; geen nieuwe import-BPM aan acquisition toegevoegd.' };
    else bpm = calculateBpm2026({ co2_g_km: input.co2_g_km ?? candidate.vehicle?.co2_g_km, fuel: input.fuel || candidate.vehicle?.fuel, first_registration: input.first_registration || candidate.vehicle?.first_registration, reference_date: input.reference_date });
    if (imported && bpm.status === 'needs_input') missing.push(...bpm.missing_fields);
    const costs = {
      transport_eur: number(input.transport_eur), registration_eur: number(input.registration_eur), inspection_eur: number(input.inspection_eur),
      handling_eur: number(input.handling_eur), other_eur: number(input.other_eur)
    };
    if (imported) for (const [field, value] of Object.entries(costs)) if (value === null && ['transport_eur', 'registration_eur', 'handling_eur'].includes(field)) missing.push(field);
    const knownCosts = Object.values(costs).filter(value => value !== null).reduce((sum, value) => sum + value, 0), bpmValue = number(bpm.estimated_payable_bpm_eur);
    const allIn = purchaseEur !== null && (!imported || (bpmValue !== null && !['transport_eur', 'registration_eur', 'handling_eur'].some(field => costs[field] === null))) ? purchaseEur + knownCosts + (bpmValue || 0) : null;
    const retail = comparables.comparable_count >= 3 ? { low_eur: comparables.price_distribution_eur.p25, expected_eur: comparables.price_distribution_eur.median, high_eur: comparables.price_distribution_eur.p75, type: 'ESTIMATE', evidence: `${comparables.comparable_count} real provider-verified Dutch listings`, confidence: comparables.confidence } : { low_eur: null, expected_eur: null, high_eur: null, type: 'UNKNOWN', evidence: 'Minimaal 3 bruikbare Nederlandse comparables vereist', confidence: 'UNAVAILABLE' };
    const margin = allIn !== null && retail.low_eur !== null ? { low_eur: Math.round((retail.low_eur - allIn) * 100) / 100, expected_eur: Math.round((retail.expected_eur - allIn) * 100) / 100, high_eur: Math.round((retail.high_eur - allIn) * 100) / 100, type: 'ESTIMATE' } : { low_eur: null, expected_eur: null, high_eur: null, type: 'UNKNOWN' };
    const uniqueMissing = [...new Set(missing)];
    return {
      ok: true, status: uniqueMissing.length || retail.type === 'UNKNOWN' ? 'needs_input' : 'estimated', candidate_id: candidate.canonical_listing_id,
      breakdown: [
        { component: 'purchase_price', value_eur: purchaseEur, type: purchaseEur === number(candidate.commercial?.gross_price_eur) ? 'FACT' : 'CALCULATION', source: candidate.identity.provider },
        { component: 'bpm', value_eur: bpmValue, type: bpm.type, source: bpm.source || null },
        ...Object.entries(costs).map(([component, value]) => ({ component, value_eur: value, type: value === null ? 'UNKNOWN' : 'ESTIMATE', source: value === null ? null : 'dealer_input' }))
      ],
      all_in_acquisition_eur: allIn, expected_retail_range: retail, expected_gross_margin_range: margin, bpm,
      comparables: { count: comparables.comparable_count, confidence: comparables.confidence, version: comparables.version },
      missing_fields: uniqueMissing, assumptions: sanitize(input.assumptions || []), calculated_at: this.now(), calculation_version: 'foundly-acquisition-economics/1.0.0', unsupported_precision: false
    };
  }

  dealerProfile(context, principal) {
    const { ctx } = this.scope(context, principal), row = this.bucket(ctx, 'dealer_profiles').at(-1);
    return row ? clone(row) : {
      id: null, tenant_id: ctx.tenant_id, dealer_id: ctx.dealer_id, configuration_status: 'UNCONFIGURED', display_name: null,
      pilot_configuration: false, preferences: {}, cost_assumptions: {}, history: { available: false, source: null, records: 0 },
      warning: 'Geen dealerprofiel aangeleverd; dealer-fit en historische performance blijven UNKNOWN.'
    };
  }

  saveDealerProfile(context, principal, input = {}) {
    const { ctx, principal: actor } = this.scope(context, principal);
    if (!actor.roles.some(role => ['ADMIN', 'SUPER_ADMIN', 'FOUNDER', 'MANAGER'].includes(role))) throw automotiveError(403, 'automotive_profile_write_denied', 'Dealerprofiel wijzigen vereist ADMIN, MANAGER of equivalent');
    if (containsSecretField(input)) throw automotiveError(422, 'automotive_profile_secret_rejected', 'Secrets horen niet in het dealerprofiel');
    const preferences = input.preferences || input;
    const allowed = {
      preferred_makes: stringList(preferences.preferred_makes), preferred_models: stringList(preferences.preferred_models), segments: stringList(preferences.segments),
      purchase_price_min_eur: number(preferences.purchase_price_min_eur), purchase_price_max_eur: number(preferences.purchase_price_max_eur),
      retail_price_min_eur: number(preferences.retail_price_min_eur), retail_price_max_eur: number(preferences.retail_price_max_eur),
      mileage_max_km: number(preferences.mileage_max_km), year_min: number(preferences.year_min), powertrains: stringList(preferences.powertrains).map(normalizeFuel),
      preferred_options: stringList(preferences.preferred_options), acceptable_margin_eur: number(preferences.acceptable_margin_eur), target_margin_eur: number(preferences.target_margin_eur),
      inventory_mix: sanitize(preferences.inventory_mix || {}), risk_tolerance: text(preferences.risk_tolerance, 40).toUpperCase() || null,
      sourcing_countries: stringList(preferences.sourcing_countries).map(normalizeCountry), target_days_to_sale: number(preferences.target_days_to_sale), exclusions: stringList(preferences.exclusions)
    };
    const historyInput = input.history || {};
    const history = historyInput.available === true && Number(historyInput.records) > 0 ? { available: true, source: text(historyInput.source, 200), records: Math.round(Number(historyInput.records)), verified_at: normalizedDate(historyInput.verified_at) } : { available: false, source: null, records: 0 };
    const row = {
      id: this.adapter.id(), tenant_id: ctx.tenant_id, dealer_id: ctx.dealer_id, configuration_status: 'CONFIGURED', display_name: text(input.display_name, 200) || null,
      pilot_configuration: Boolean(input.pilot_configuration), preferences: allowed,
      cost_assumptions: { transport_eur: number(input.cost_assumptions?.transport_eur), registration_eur: number(input.cost_assumptions?.registration_eur), inspection_eur: number(input.cost_assumptions?.inspection_eur), handling_eur: number(input.cost_assumptions?.handling_eur), other_eur: number(input.cost_assumptions?.other_eur), source: text(input.cost_assumptions?.source, 200) || null },
      history, configured_at: this.now(), configured_by: actor.id, source: input.pilot_configuration ? 'EXPLICIT_PILOT_CONFIGURATION' : 'TENANT_CONFIGURATION', schema_version: AUTOMOTIVE_SCHEMA_VERSION
    };
    this.bucket(ctx, 'dealer_profiles').push(row);
    this.adapter.emit(ctx, { event_name: 'automotive_dealer_profile_configured', entity_type: 'dealer_profile', entity_id: row.id, properties: { pilot_configuration: row.pilot_configuration, history_available: row.history.available } });
    this.commit();
    return clone(row);
  }

  dealerFit(candidate, profile) {
    if (!profile || profile.configuration_status !== 'CONFIGURED') return { available: false, score: null, confidence: 'UNAVAILABLE', evidence: ['DEALER_PROFILE_NOT_CONFIGURED'], version: 'foundly-dealer-fit/1.0.0' };
    const p = profile.preferences || {}, vehicle = candidate.vehicle || {}, price = number(candidate.commercial?.gross_price_eur), components = [];
    const add = (name, matched, weight, evidence) => components.push({ name, matched, weight, evidence });
    if (p.preferred_makes?.length) add('preferred_make', p.preferred_makes.some(value => normalizedToken(value) === normalizedToken(vehicle.make)), 20, vehicle.make);
    if (p.preferred_models?.length) add('preferred_model', p.preferred_models.some(value => normalizedToken(`${vehicle.model} ${vehicle.variant}`).includes(normalizedToken(value))), 20, `${vehicle.model || ''} ${vehicle.variant || ''}`.trim());
    if (p.purchase_price_max_eur !== null) add('purchase_band', price !== null && price <= p.purchase_price_max_eur && (p.purchase_price_min_eur === null || price >= p.purchase_price_min_eur), 15, price);
    if (p.mileage_max_km !== null) add('mileage', number(vehicle.mileage_km) !== null && vehicle.mileage_km <= p.mileage_max_km, 10, vehicle.mileage_km);
    if (p.year_min !== null) add('year', number(vehicle.build_year) !== null && vehicle.build_year >= p.year_min, 10, vehicle.build_year);
    if (p.powertrains?.length) add('powertrain', p.powertrains.includes(vehicle.fuel), 10, vehicle.fuel);
    if (p.sourcing_countries?.length) add('source_country', p.sourcing_countries.includes(candidate.seller?.country), 5, candidate.seller?.country);
    if (p.preferred_options?.length) {
      const features = (vehicle.features || []).map(normalizedToken), matched = p.preferred_options.filter(option => features.some(feature => feature.includes(normalizedToken(option))));
      add('options', matched.length === p.preferred_options.length, 10, matched);
    }
    if (!components.length) return { available: false, score: null, confidence: 'UNAVAILABLE', evidence: ['DEALER_PREFERENCES_EMPTY'], version: 'foundly-dealer-fit/1.0.0' };
    const weight = components.reduce((sum, item) => sum + item.weight, 0), score = Math.round(components.reduce((sum, item) => sum + (item.matched ? item.weight : 0), 0) / weight * 100);
    return { available: true, score, confidence: components.length >= 5 ? 'HIGH' : components.length >= 3 ? 'MEDIUM' : 'LOW', evidence: components, history_used: profile.history?.available === true, version: 'foundly-dealer-fit/1.0.0' };
  }

  marketSignals(candidate, comparables) {
    const price = number(candidate.commercial?.gross_price_eur), median = number(comparables.price_distribution_eur?.median), count = comparables.comparable_count;
    return {
      current_supply: { value: count, label: 'matched_current_listings', type: 'FACT', confidence: comparables.confidence },
      listing_scarcity: { value: count === 0 ? null : count <= 3 ? 'HIGH' : count <= 8 ? 'MEDIUM' : 'LOW', type: count === 0 ? 'UNKNOWN' : 'CALCULATION', evidence: `${count} matched Dutch listings`, version: AUTOMOTIVE_COMPARABLE_VERSION },
      price_position: { value: price !== null && median !== null ? Math.round((price / median - 1) * 10000) / 100 : null, unit: 'percent_vs_median', type: price !== null && median !== null ? 'CALCULATION' : 'UNKNOWN' },
      actual_sales_demand: { value: null, type: 'UNKNOWN', explanation: 'Listing supply is geen bewijs van verkochte vraag.' }
    };
  }

  buyScore(candidate, comparables, economics, dealerFit) {
    const components = [], price = number(candidate.commercial?.gross_price_eur), median = number(comparables.price_distribution_eur?.median), margin = number(economics.expected_gross_margin_range?.expected_eur);
    const push = (name, score, weight, evidence, confidence, provenance) => { if (number(score) !== null) components.push({ name, score: Math.max(0, Math.min(100, Math.round(score))), weight, evidence, confidence, provenance, version: AUTOMOTIVE_BUY_SCORE_VERSION, timestamp: this.now() }); };
    if (price !== null && median !== null && median > 0) push('Acquisition Advantage', 50 + (median - price) / median * 250, 25, { candidate_price_eur: price, nl_median_eur: median }, comparables.confidence, comparables.listings.map(row => row.canonical_listing_id));
    if (margin !== null && price) push('Expected Margin', Math.min(100, Math.max(0, margin / Math.max(price * 0.2, 1) * 100)), 25, economics.expected_gross_margin_range, economics.status === 'estimated' ? 'MEDIUM' : 'LOW', [candidate.canonical_listing_id]);
    if (comparables.comparable_count) push('Supply Scarcity', comparables.comparable_count <= 3 ? 85 : comparables.comparable_count <= 8 ? 65 : 40, 12, { matched_listings: comparables.comparable_count, signal: 'listing_scarcity_not_sales_demand' }, comparables.confidence, comparables.listings.map(row => row.canonical_listing_id));
    if (dealerFit.available) push('Dealer Fit', dealerFit.score, 18, dealerFit.evidence, dealerFit.confidence, [dealerFit.version]);
    const completenessFields = [candidate.vehicle?.make, candidate.vehicle?.model, candidate.vehicle?.build_year, candidate.vehicle?.mileage_km, candidate.commercial?.gross_price_eur, candidate.seller?.country, candidate.identity?.source_url];
    const completeness = completenessFields.filter(value => value !== null && value !== undefined && value !== '').length / completenessFields.length * 100;
    push('Data Confidence', completeness, 10, { populated_fields: completenessFields.filter(value => value !== null && value !== undefined && value !== '').length, total_fields: completenessFields.length, provider_verified: candidate.provenance?.provider_verified === true }, completeness >= 85 ? 'HIGH' : completeness >= 60 ? 'MEDIUM' : 'LOW', [candidate.identity.provider]);
    const riskScore = candidate.listing?.freshness?.classification === 'LIVE' ? 90 : candidate.listing?.freshness?.classification === 'CACHED' ? 70 : 40;
    push('Risk', riskScore, 10, { freshness: candidate.listing?.freshness?.classification, vat_status: candidate.commercial?.vat?.status || 'UNKNOWN', missing_vin: !candidate.vehicle?.vin }, 'MEDIUM', [candidate.canonical_listing_id]);
    if (components.length < 3) return { available: false, score: null, confidence: 'UNAVAILABLE', components, version: AUTOMOTIVE_BUY_SCORE_VERSION, reason: 'Minimaal drie evidence-backed componenten vereist' };
    const totalWeight = components.reduce((sum, component) => sum + component.weight, 0), score = Math.round(components.reduce((sum, component) => sum + component.score * component.weight, 0) / totalWeight);
    const confidence = comparables.confidence === 'HIGH' && economics.status === 'estimated' && (dealerFit.confidence === 'HIGH' || dealerFit.confidence === 'MEDIUM') ? 'HIGH' : comparables.comparable_count >= 3 ? 'MEDIUM' : 'LOW';
    return { available: true, score, confidence, components, version: AUTOMOTIVE_BUY_SCORE_VERSION, calculated_at: this.now(), opaque_model: false };
  }

  analyseCandidate(context, principal, vehicleId, input = {}) {
    const { ctx } = this.scope(context, principal), storedCandidate = this.bucket(ctx, 'listings').find(row => row.canonical_listing_id === vehicleId || row.canonical_vehicle_id === vehicleId);
    if (!storedCandidate) throw automotiveError(404, 'automotive_candidate_not_found', 'Kandidaatlisting niet gevonden');
    const candidate = this.refreshListingFreshness(storedCandidate, input.freshness_mode || 'live');
    const comparables = this.comparables(context, principal, candidate.canonical_listing_id, input.comparables || {}), profile = this.dealerProfile(context, principal), fit = this.dealerFit(candidate, profile);
    const economicsInput = { ...(profile.cost_assumptions || {}), ...(input.economics || input) }, economics = this.calculateEconomics(context, principal, candidate.canonical_listing_id, economicsInput), signals = this.marketSignals(candidate, comparables), buyScore = this.buyScore(candidate, comparables, economics, fit);
    const risks = [];
    if (!candidate.vehicle?.vin) risks.push({ code: 'VIN_UNKNOWN', severity: 'MEDIUM', fact: true });
    if (candidate.commercial?.vat?.status === 'UNKNOWN') risks.push({ code: 'VAT_SEMANTICS_UNKNOWN', severity: 'MEDIUM', fact: true });
    if (candidate.listing?.freshness?.classification === 'STALE') risks.push({ code: 'LISTING_STALE', severity: 'HIGH', fact: true });
    if (comparables.comparable_count < 3) risks.push({ code: 'INSUFFICIENT_NL_COMPARABLES', severity: 'HIGH', fact: true });
    if (economics.missing_fields.length) risks.push({ code: 'ECONOMICS_INPUT_MISSING', severity: 'MEDIUM', fields: economics.missing_fields, fact: true });
    return { candidate: clone(candidate), comparables, economics, market_signals: signals, dealer_fit: fit, buy_score: buyScore, risks, observed_at: this.now(), evidence_backed: true };
  }

  todayOpportunities(context, principal, input = {}) {
    const { ctx } = this.scope(context, principal), profile = this.dealerProfile(context, principal), all = this.bucket(ctx, 'listings').filter(row => row.provenance?.provider_verified && row.listing?.status === 'ACTIVE' && MARKETPLACE_PROVIDERS.includes(row.identity?.provider));
    if (!all.length) return { ok: false, status: 'unavailable', reason: 'NO_REAL_MARKETPLACE_DATA', opportunities: [], profile, explanation: 'Er zijn geen echte provider-verified marketplace listings in de tenantcache; Foundly verzint geen Top 3.' };
    const fresh = all.map(row => { const copy = clone(row); copy.listing.freshness = classifyFreshness(copy.listing.last_verified_at, this.adapter.now(), 'cache', copy.identity?.provider); return copy; }).filter(row => row.listing.freshness.classification !== 'UNAVAILABLE');
    const eligible = profile.configuration_status === 'CONFIGURED' ? fresh.filter(row => {
      const p = profile.preferences || {};
      if (p.preferred_makes?.length && !p.preferred_makes.some(make => normalizedToken(make) === normalizedToken(row.vehicle.make))) return false;
      if (p.purchase_price_max_eur !== null && number(row.commercial.gross_price_eur) > p.purchase_price_max_eur) return false;
      if (p.mileage_max_km !== null && number(row.vehicle.mileage_km) > p.mileage_max_km) return false;
      if (p.year_min !== null && number(row.vehicle.build_year) < p.year_min) return false;
      return true;
    }) : fresh;
    const dedup = deduplicateListings(eligible), analyses = [];
    for (const candidate of dedup.items.slice(0, 40)) {
      const analysis = this.analyseCandidate(context, principal, candidate.canonical_listing_id, { ...input, freshness_mode: 'cache' });
      if (analysis.buy_score.available) analyses.push(analysis);
    }
    analyses.sort((a, b) => b.buy_score.score - a.buy_score.score || (a.candidate.commercial.gross_price_eur || Infinity) - (b.candidate.commercial.gross_price_eur || Infinity));
    const limit = Math.max(1, Math.min(3, Number(input.limit) || 3)), opportunities = analyses.slice(0, limit).map((analysis, index) => ({ rank: index + 1, ...analysis }));
    return {
      ok: opportunities.length > 0, status: opportunities.length ? (profile.configuration_status === 'CONFIGURED' ? 'completed' : 'partial') : 'insufficient_evidence',
      opportunities, evaluated: dedup.items.length, profile, personalisation: profile.configuration_status === 'CONFIGURED' ? 'TENANT_CONFIGURATION' : 'UNCONFIGURED',
      real_data_only: true, ranking_version: AUTOMOTIVE_BUY_SCORE_VERSION, observed_at: this.now(),
      warning: profile.configuration_status === 'CONFIGURED' ? null : 'Dealerprofiel ontbreekt; aanbevelingen bevatten geen House of Cars-specifieke fit.'
    };
  }

  diagnostics(context, principal) {
    const { ctx } = this.scope(context, principal), listings = this.bucket(ctx, 'listings'), telemetry = this.bucket(ctx, 'telemetry'), searches = this.bucket(ctx, 'searches');
    const counts = {};
    for (const record of listings) counts[record.identity.provider] = (counts[record.identity.provider] || 0) + 1;
    return {
      ok: true, schema_version: AUTOMOTIVE_SCHEMA_VERSION, providers: this.providerStatuses(context, principal), records: { listings: listings.length, vehicle_truth: this.bucket(ctx, 'vehicle_truth').length, raw_source_manifests: this.bucket(ctx, 'raw_source_manifests').length, by_provider: counts },
      searches: { total: searches.length, last: searches.at(-1) ? { id: searches.at(-1).id, status: searches.at(-1).status, created_at: searches.at(-1).created_at } : null },
      telemetry: clone(telemetry.slice(-100).reverse()), persistence: { adapter: 'FOUNDLY_EXISTING_TENANT_BUCKET', separate_database: false },
      security: { server_side_provider_credentials: true, secrets_in_output: false }, no_fake_data: true
    };
  }
}

module.exports = {
  FoundlyAutomotiveCore, AUTOMOTIVE_SCHEMA_VERSION, AUTOMOTIVE_TRANSFORMATION_VERSION, AUTOMOTIVE_SEARCH_VERSION,
  AUTOMOTIVE_COMPARABLE_VERSION, AUTOMOTIVE_BUY_SCORE_VERSION, BPM_RULE_VERSION, FRESHNESS_VALUES, PROVIDER_FRESHNESS_POLICIES, MARKETPLACE_PROVIDERS,
  parseSearchCriteria, classifyFreshness, normalizeMobileDeRecord, normalizeMarktplaatsRecord, normalizeRdwRecord,
  matchesCriteria, duplicateEvidence, deduplicateListings, comparableSimilarity, bpmDepreciationPercent, calculateBpm2026, automotiveError
};
